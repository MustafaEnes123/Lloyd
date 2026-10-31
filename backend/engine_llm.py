"""
LLM Thinking Engine for Project Lloyd (backend/engine_llm.py).
Uses llama-cpp-python with Apple Silicon Metal acceleration (n_gpu_layers=-1).
Enforces strict identity guardrails, no-emoji filtering, 10-turn rolling history,
and sentence-level streaming for pipeline-parallel TTS synthesis.
"""

from __future__ import annotations

import atexit
import logging
import os
import re
import threading
import time
from collections import deque
from pathlib import Path
from typing import Any, Deque, Dict, Generator, List, Optional, Tuple

from downloader import download_manager
from hardware import watchdog

logger = logging.getLogger("lloyd.llm")

BASE_DIR = Path("/Users/mustafaeneskayaci/Documents/coding_projects/Lloyd")
M4S_DIR = BASE_DIR / "m4s"
DEFAULT_MODEL_PATH = download_manager.resolve_asset_path("qwen2.5-1.5b-instruct-q4_k_m.gguf")
DEFAULT_PROMPT_PATH = download_manager.resolve_asset_path("system_prompt.txt")

# Regex matching all Unicode emojis, dingbats, emoticons, symbols, and variation selectors
EMOJI_PATTERN = re.compile(
    "["
    "\U0001F1E0-\U0001F1FF"  # flags
    "\U0001F300-\U0001F5FF"  # symbols & pictographs
    "\U0001F600-\U0001F64F"  # emoticons
    "\U0001F680-\U0001F6FF"  # transport & map symbols
    "\U0001F700-\U0001F77F"  # alchemical symbols
    "\U0001F780-\U0001F7FF"  # geometric shapes extended
    "\U0001F800-\U0001F8FF"  # supplemental arrows-c
    "\U0001F900-\U0001F9FF"  # supplemental symbols and pictographs
    "\U0001FA00-\U0001FA6F"  # chess symbols
    "\U0001FA70-\U0001FAFF"  # symbols and pictographs extended-a
    "\u2600-\u26FF"          # misc symbols
    "\u2700-\u27BF"          # dingbats
    "\u2300-\u23FF"          # misc technical emojis
    "\uFE0F"                 # variation selector-16
    "\u200D"                 # zero width joiner
    "]+",
    flags=re.UNICODE,
)

# Forbidden third-party model/company terms that must never appear in output
FORBIDDEN_REPLACEMENTS: List[Tuple[re.Pattern[str], str]] = [
    (re.compile(r"\bQwen(\s*2\.5)?\b", re.IGNORECASE), "third-party models"),
    (re.compile(r"\bAlibaba(\s+Cloud)?\b", re.IGNORECASE), "external corporations"),
    (re.compile(r"\bTongyi(\s+Qianwen)?\b", re.IGNORECASE), "third-party models"),
    (re.compile(r"\bOpenAI\b", re.IGNORECASE), "external corporations"),
    (re.compile(r"\bChatGPT\b", re.IGNORECASE), "third-party assistants"),
    (re.compile(r"\bMeta(\s+AI)?\b", re.IGNORECASE), "external corporations"),
    (re.compile(r"\bLLaMA\b", re.IGNORECASE), "third-party models"),
    (re.compile(r"\bWhisper\b", re.IGNORECASE), "native acoustic processing"),
]

# Sentence boundary regex (splits after ., !, ? when followed by whitespace or end)
SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+")


def strip_emojis(text: str) -> str:
    """Remove all Unicode emojis and graphical symbols from text."""
    return EMOJI_PATTERN.sub("", text)


def sanitize_identity(text: str) -> str:
    """Ensure no forbidden corporate/model names or emojis ever leak into output."""
    cleaned = strip_emojis(text)
    for pattern, replacement in FORBIDDEN_REPLACEMENTS:
        cleaned = pattern.sub(replacement, cleaned)
    return cleaned


class LLMEngine:
    """
    High-performance local LLM inference engine powered by llama.cpp with Metal GPU offload.
    """

    def __init__(
        self,
        model_path: Path = DEFAULT_MODEL_PATH,
        prompt_path: Path = DEFAULT_PROMPT_PATH,
        n_ctx: int = 4096,
        n_gpu_layers: int = -1,
        temperature: float = 0.7,
        top_p: float = 0.9,
        repeat_penalty: float = 1.15,
        max_turns: int = 10,
    ) -> None:
        self.model_path = Path(model_path)
        self.prompt_path = Path(prompt_path)
        self.n_ctx = n_ctx
        self.n_gpu_layers = n_gpu_layers
        self.temperature = temperature
        self.top_p = top_p
        self.repeat_penalty = repeat_penalty
        self.max_turns = max_turns

        # Rolling 10-turn conversation history (each turn is user + assistant = 20 messages)
        self.history: Deque[Dict[str, str]] = deque(maxlen=max_turns * 2)
        self._lock = threading.Lock()
        self._cancel_event = threading.Event()

        self.llm: Any = None
        self.is_ready: bool = False
        self.metal_allocated: bool = False
        self.last_error: Optional[str] = None
        self.load_time_ms: float = 0.0
        self.gguf_valid: bool = False
        self.prompt_valid: bool = False
        self._cached_system_prompt: str = ""
        atexit.register(self.close)

    def close(self) -> None:
        """Explicitly release llama_cpp Metal residency sets before C++ static destructors run."""
        with self._lock:
            if self.llm is not None:
                try:
                    if hasattr(self.llm, "close"):
                        self.llm.close()
                except Exception:
                    pass
                self.llm = None

    def refresh_paths(self) -> None:
        """Refresh model and prompt paths from download_manager (Application Support or ./m4s)."""
        self.model_path = download_manager.resolve_asset_path("qwen2.5-1.5b-instruct-q4_k_m.gguf")
        self.prompt_path = download_manager.resolve_asset_path("system_prompt.txt")

    def validate_system_prompt(self) -> Tuple[bool, str]:
        """Verify presence, read permissions, and content of system_prompt.txt."""
        self.prompt_path = download_manager.resolve_asset_path("system_prompt.txt")
        if not self.prompt_path.exists():
            return False, f"Missing system prompt at {self.prompt_path}"
        if not os.access(self.prompt_path, os.R_OK):
            return False, f"Permission denied reading {self.prompt_path}"
        try:
            content = self.prompt_path.read_text(encoding="utf-8").strip()
            if not content:
                return False, "system_prompt.txt is empty"
            self._cached_system_prompt = content
            self.prompt_valid = True
            return True, content
        except Exception as exc:
            self.prompt_valid = False
            return False, f"Error reading system_prompt.txt: {exc}"

    def validate_gguf_integrity(self) -> Tuple[bool, str]:
        """Verify GGUF binary existence, size, and magic header bytes."""
        self.model_path = download_manager.resolve_asset_path("qwen2.5-1.5b-instruct-q4_k_m.gguf")
        if not self.model_path.exists():
            return False, f"Missing GGUF file at {self.model_path}"
        if not os.access(self.model_path, os.R_OK):
            return False, f"Permission denied reading {self.model_path}"
        try:
            size_bytes = self.model_path.stat().st_size
            if size_bytes < 10 * 1024 * 1024:
                return False, f"GGUF file too small ({size_bytes} bytes)"
            with self.model_path.open("rb") as f:
                magic = f.read(4)
            if magic != b"GGUF":
                return False, f"Invalid GGUF magic header: {magic!r}"
            self.gguf_valid = True
            size_mb = round(size_bytes / (1024 * 1024), 1)
            return True, f"Valid GGUF v3 binary ({size_mb} MB)"
        except Exception as exc:
            self.gguf_valid = False
            return False, f"GGUF integrity check failed: {exc}"

    def load_model(self) -> Dict[str, Any]:
        """Initialize llama_cpp.Llama with Metal GPU acceleration (n_gpu_layers=-1)."""
        t0 = time.perf_counter()

        prompt_ok, prompt_info = self.validate_system_prompt()
        gguf_ok, gguf_info = self.validate_gguf_integrity()

        if not prompt_ok:
            self.last_error = prompt_info
            logger.error("Prompt validation failed: %s", prompt_info)
            return self.get_diagnostics()

        if not gguf_ok:
            self.last_error = gguf_info
            logger.error("GGUF validation failed: %s", gguf_info)
            return self.get_diagnostics()

        try:
            from llama_cpp import Llama

            with self._lock:
                self.llm = Llama(
                    model_path=str(self.model_path),
                    n_ctx=self.n_ctx,
                    n_gpu_layers=self.n_gpu_layers,
                    n_batch=512,
                    n_threads=max(2, (os.cpu_count() or 4) // 2),
                    verbose=False,
                )

                # Warmup & Metal allocation verification with a 1-token micro-generation
                _ = self.llm.create_chat_completion(
                    messages=[
                        {"role": "system", "content": "Respond with OK."},
                        {"role": "user", "content": "Ping"},
                    ],
                    max_tokens=2,
                    temperature=0.1,
                )

            self.load_time_ms = round((time.perf_counter() - t0) * 1000, 1)
            self.is_ready = True
            self.metal_allocated = True
            self.last_error = None
            watchdog.set_metal_status(True, f"All Layers Offloaded (n_gpu_layers={self.n_gpu_layers})")
            logger.info(
                "LLM loaded on Apple Silicon Metal in %.1f ms (%s)",
                self.load_time_ms,
                gguf_info,
            )
        except Exception as exc:
            self.is_ready = False
            self.metal_allocated = False
            self.last_error = str(exc)
            watchdog.set_metal_status(False, f"Error: {exc}")
            logger.exception("Failed to initialize Llama Metal engine")

        return self.get_diagnostics()

    def get_system_prompt(self) -> str:
        """Load fresh system_prompt.txt on each turn and reinforce mandatory guardrails."""
        ok, content = self.validate_system_prompt()
        base_prompt = content if ok else self._cached_system_prompt
        guardrail_suffix = (
            "\n\nMANDATORY RUNTIME DIRECTIVES:\n"
            "- Your sole creator and engineer is Mustafa Enes Kayaci (Enes).\n"
            "- If asked who created you or what model/architecture you use, state positively that you are Lloyd, a proprietary local intelligence built by Enes running on Apple Silicon Metal, without repeating any third-party names.\n"
            "- Output plain spoken English text ONLY. Do NOT output any emojis, markdown bullets, or asterisks.\n"
            "- Keep your response between 1 and 3 concise, natural spoken sentences."
        )
        return f"{base_prompt}{guardrail_suffix}"

    def build_messages(self, user_text: str) -> List[Dict[str, str]]:
        """Prepend system_prompt.txt followed by rolling 10-turn conversation history."""
        messages: List[Dict[str, str]] = [
            {"role": "system", "content": self.get_system_prompt()}
        ]
        # Append up to last 10 turns (20 messages)
        for msg in list(self.history)[-(self.max_turns * 2) :]:
            messages.append({"role": msg["role"], "content": msg["content"]})
        messages.append({"role": "user", "content": user_text.strip()})
        return messages

    def cancel_current_generation(self) -> None:
        """Signal any active generation stream to halt immediately."""
        self._cancel_event.set()

    def clear_history(self) -> None:
        """Reset the rolling conversation memory."""
        self.history.clear()

    def stream_response(
        self,
        user_text: str,
        max_sentences: int = 3,
    ) -> Generator[Dict[str, Any], None, None]:
        """
        Stream tokens and completed sentences from the LLM in real time.
        Yields events of shape:
          - {"type": "token", "token": str, "full_text": str}
          - {"type": "sentence", "sentence": str, "index": int}
          - {"type": "done", "text": str, "latency_ms": float, "tokens_per_sec": float}
        """
        if not self.is_ready or self.llm is None:
            fallback = (
                "My neural core is still initializing on Metal, Enes. "
                "Give me just a moment to bring all layers online."
            )
            yield {"type": "token", "token": fallback, "full_text": fallback}
            yield {"type": "sentence", "sentence": fallback, "index": 0}
            yield {"type": "done", "text": fallback, "latency_ms": 1.0, "tokens_per_sec": 0.0}
            return

        self._cancel_event.clear()
        messages = self.build_messages(user_text)

        t_start = time.perf_counter()
        first_token_time: Optional[float] = None
        token_count = 0
        raw_accumulated = ""
        clean_emitted_len = 0
        sentence_buffer = ""
        sentences_emitted = 0

        with self._lock:
            try:
                stream = self.llm.create_chat_completion(
                    messages=messages,
                    max_tokens=160,
                    temperature=self.temperature,
                    top_p=self.top_p,
                    repeat_penalty=self.repeat_penalty,
                    stream=True,
                )

                for chunk in stream:
                    if self._cancel_event.is_set():
                        logger.info("LLM generation cancelled via barge-in.")
                        break

                    delta = (
                        chunk.get("choices", [{}])[0]
                        .get("delta", {})
                        .get("content", "")
                    )
                    if not delta:
                        continue

                    if first_token_time is None:
                        first_token_time = time.perf_counter()

                    token_count += 1
                    raw_accumulated += delta

                    # Clean emojis, markdown asterisks, and forbidden identity terms
                    cleaned_total = sanitize_identity(raw_accumulated)
                    cleaned_total = cleaned_total.replace("*", "").replace("#", "")

                    # Extract newly available sanitized characters
                    if len(cleaned_total) > clean_emitted_len:
                        new_piece = cleaned_total[clean_emitted_len:]
                        clean_emitted_len = len(cleaned_total)
                        sentence_buffer += new_piece

                        yield {
                            "type": "token",
                            "token": new_piece,
                            "full_text": cleaned_total.strip(),
                        }

                        # Check if sentence_buffer has one or more complete sentences
                        parts = SENTENCE_SPLIT_RE.split(sentence_buffer)
                        if len(parts) > 1:
                            for completed in parts[:-1]:
                                s_clean = completed.strip()
                                if s_clean:
                                    yield {
                                        "type": "sentence",
                                        "sentence": s_clean,
                                        "index": sentences_emitted,
                                    }
                                    sentences_emitted += 1
                                    if sentences_emitted >= max_sentences:
                                        break
                            sentence_buffer = parts[-1]

                        if sentences_emitted >= max_sentences:
                            break

            except Exception as exc:
                logger.exception("Error during LLM token streaming: %s", exc)
                if not raw_accumulated:
                    raw_accumulated = "I encountered a brief processing hiccup on the local bus, Enes."

        # Flush any trailing sentence fragment if under sentence cap and not cancelled
        final_text = sanitize_identity(raw_accumulated).replace("*", "").replace("#", "").strip()
        if not self._cancel_event.is_set() and sentences_emitted < max_sentences:
            rem = sanitize_identity(sentence_buffer).replace("*", "").replace("#", "").strip()
            if rem:
                yield {
                    "type": "sentence",
                    "sentence": rem,
                    "index": sentences_emitted,
                }
                sentences_emitted += 1

        # Trim final_text to max_sentences if needed
        all_sentences = [s.strip() for s in SENTENCE_SPLIT_RE.split(final_text) if s.strip()]
        if len(all_sentences) > max_sentences:
            final_text = " ".join(all_sentences[:max_sentences])

        t_end = time.perf_counter()
        first_token_latency_ms = (
            (first_token_time - t_start) * 1000.0
            if first_token_time is not None
            else (t_end - t_start) * 1000.0
        )
        total_duration = max(0.001, t_end - (first_token_time or t_start))
        tps = round(token_count / total_duration, 1)

        watchdog.record_llm_latency(first_token_latency_ms, tps)

        # Save turn to rolling 10-turn history
        if user_text.strip() and final_text:
            self.history.append({"role": "user", "content": user_text.strip()})
            self.history.append({"role": "assistant", "content": final_text})

        yield {
            "type": "done",
            "text": final_text,
            "latency_ms": round(first_token_latency_ms, 1),
            "tokens_per_sec": tps,
        }

    def get_diagnostics(self) -> Dict[str, Any]:
        """Return health & diagnostic details for /api/health."""
        prompt_ok, prompt_msg = self.validate_system_prompt()
        gguf_ok, gguf_msg = self.validate_gguf_integrity()
        return {
            "status": "healthy" if (self.is_ready and prompt_ok and gguf_ok) else "degraded",
            "ready": self.is_ready,
            "model_file": self.model_path.name,
            "model_path": str(self.model_path),
            "gguf_integrity": gguf_ok,
            "gguf_detail": gguf_msg,
            "metal_gpu_offload": self.metal_allocated,
            "n_gpu_layers": self.n_gpu_layers,
            "context_window": self.n_ctx,
            "temperature": self.temperature,
            "top_p": self.top_p,
            "repeat_penalty": self.repeat_penalty,
            "system_prompt_valid": prompt_ok,
            "system_prompt_path": str(self.prompt_path),
            "history_turns": len(self.history) // 2,
            "max_history_turns": self.max_turns,
            "load_time_ms": self.load_time_ms,
            "error": self.last_error,
        }
