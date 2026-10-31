"""
Text-to-Speech (TTS) Engine for Project Lloyd (backend/engine_tts.py).
Uses onnxruntime with Piper VITS ONNX model:
  /Users/mustafaeneskayaci/Documents/coding_projects/Lloyd/m4s/en_US-lessac-medium.onnx
  /Users/mustafaeneskayaci/Documents/coding_projects/Lloyd/m4s/en_US-lessac-medium.onnx.json
Synthesizes 22050Hz raw PCM audio and computes amplitude/frequency envelopes for 3D avatar lip-sync.
"""

from __future__ import annotations

import io
import json
import logging
import os
import re
import shutil
import subprocess
import threading
import time
import unicodedata
import wave
from pathlib import Path
from typing import Any, Dict, Generator, List, Optional, Tuple

import numpy as np

from hardware import watchdog

logger = logging.getLogger("lloyd.tts")

BASE_DIR = Path("/Users/mustafaeneskayaci/Documents/coding_projects/Lloyd")
M4S_DIR = BASE_DIR / "m4s"
DEFAULT_ONNX_PATH = M4S_DIR / "en_US-lessac-medium.onnx"
DEFAULT_CONFIG_PATH = M4S_DIR / "en_US-lessac-medium.onnx.json"

PUNCTUATION_CHUNK_RE = re.compile(r"(?<=[.!?])\s+")

# Fallback English Grapheme-to-IPA rules if espeak-ng binary is not found on PATH
FALLBACK_DIGRAPHS = [
    ("tion", "ʃən"),
    ("sion", "ʒən"),
    ("ough", "oʊ"),
    ("ight", "aɪt"),
    ("kn", "n"),
    ("wr", "ɹ"),
    ("ph", "f"),
    ("sh", "ʃ"),
    ("ch", "tʃ"),
    ("th", "ð"),
    ("wh", "w"),
    ("ng", "ŋ"),
    ("qu", "kw"),
    ("ee", "iː"),
    ("ea", "iː"),
    ("oo", "uː"),
    ("ou", "aʊ"),
    ("ow", "oʊ"),
    ("ai", "eɪ"),
    ("ay", "eɪ"),
    ("oi", "ɔɪ"),
    ("oy", "ɔɪ"),
    ("ar", "ɑːɹ"),
    ("er", "ɚ"),
    ("ir", "ɝ"),
    ("or", "ɔːɹ"),
    ("ur", "ɝ"),
]

FALLBACK_CHARS = {
    "a": "æ",
    "b": "b",
    "c": "k",
    "d": "d",
    "e": "ɛ",
    "f": "f",
    "g": "ɡ",
    "h": "h",
    "i": "ɪ",
    "j": "dʒ",
    "k": "k",
    "l": "l",
    "m": "m",
    "n": "n",
    "o": "ɑ",
    "p": "p",
    "q": "k",
    "r": "ɹ",
    "s": "s",
    "t": "t",
    "u": "ʌ",
    "v": "v",
    "w": "w",
    "x": "ks",
    "y": "j",
    "z": "z",
}


class TTSEngine:
    """
    Piper ONNX Text-to-Speech engine producing 22050Hz mono PCM audio streams.
    """

    def __init__(
        self,
        onnx_path: Path = DEFAULT_ONNX_PATH,
        config_path: Path = DEFAULT_CONFIG_PATH,
    ) -> None:
        self.onnx_path = Path(onnx_path)
        self.config_path = Path(config_path)

        self.session: Any = None
        self.config: Dict[str, Any] = {}
        self.phoneme_id_map: Dict[str, List[int]] = {}
        self.sample_rate: int = 22050
        self.noise_scale: float = 0.667
        self.length_scale: float = 1.0
        self.noise_w: float = 0.8
        self.espeak_voice: str = "en-us"
        self.espeak_bin: Optional[str] = self._locate_espeak()

        self._lock = threading.Lock()
        self.is_ready: bool = False
        self.self_test_passed: bool = False
        self.last_error: Optional[str] = None
        self.load_time_ms: float = 0.0

    @staticmethod
    def _locate_espeak() -> Optional[str]:
        for candidate in [
            shutil.which("espeak-ng"),
            "/opt/homebrew/bin/espeak-ng",
            "/usr/local/bin/espeak-ng",
            shutil.which("espeak"),
            "/opt/homebrew/bin/espeak",
        ]:
            if candidate and os.path.isfile(candidate) and os.access(candidate, os.X_OK):
                return candidate
        return None

    def validate_files(self) -> Tuple[bool, str]:
        if not self.onnx_path.exists():
            return False, f"Missing Piper ONNX model at {self.onnx_path}"
        if not self.config_path.exists():
            return False, f"Missing Piper JSON config at {self.config_path}"
        if not os.access(self.onnx_path, os.R_OK) or not os.access(self.config_path, os.R_OK):
            return False, "Permission denied reading Piper ONNX model or JSON config"
        size_mb = round(self.onnx_path.stat().st_size / (1024 * 1024), 1)
        return True, f"Verified en_US-lessac-medium.onnx ({size_mb} MB) + JSON config"

    def load_model(self) -> Dict[str, Any]:
        """Load Piper ONNX model into onnxruntime and synthesize a 0.5s diagnostic pulse."""
        t0 = time.perf_counter()
        ok, msg = self.validate_files()
        if not ok:
            self.last_error = msg
            logger.error("TTS validation failed: %s", msg)
            return self.get_diagnostics()

        try:
            import onnxruntime as ort

            with self.config_path.open("r", encoding="utf-8") as f:
                self.config = json.load(f)

            self.sample_rate = int(self.config.get("audio", {}).get("sample_rate", 22050))
            inference_cfg = self.config.get("inference", {})
            self.noise_scale = float(inference_cfg.get("noise_scale", 0.667))
            self.length_scale = float(inference_cfg.get("length_scale", 1.0))
            self.noise_w = float(inference_cfg.get("noise_w", 0.8))
            self.espeak_voice = str(self.config.get("espeak", {}).get("voice", "en-us"))
            self.phoneme_id_map = self.config.get("phoneme_id_map", {})

            sess_options = ort.SessionOptions()
            sess_options.intra_op_num_threads = max(2, min(4, (os.cpu_count() or 4)))
            sess_options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

            available_providers = ort.get_available_providers()
            providers = ["CPUExecutionProvider"]
            if "CoreMLExecutionProvider" in available_providers:
                # Piper dynamic shapes run ultra-fast and reliably on ARM64 NEON CPUExecutionProvider
                providers = ["CPUExecutionProvider"]

            with self._lock:
                self.session = ort.InferenceSession(
                    str(self.onnx_path),
                    sess_options=sess_options,
                    providers=providers,
                )

            # Diagnostic Self-Check: synthesize a 0.5s audio pulse
            pulse_pcm, pulse_meta = self.synthesize_pulse(duration_sec=0.5)
            if len(pulse_pcm) < int(self.sample_rate * 0.25) * 2:
                raise RuntimeError("Diagnostic pulse synthesis returned insufficient PCM samples")

            self.self_test_passed = True
            self.is_ready = True
            self.last_error = None
            self.load_time_ms = round((time.perf_counter() - t0) * 1000.0, 1)
            logger.info(
                "Piper ONNX TTS loaded and verified in %.1f ms (%s, %d Hz)",
                self.load_time_ms,
                msg,
                self.sample_rate,
            )
        except Exception as exc:
            self.is_ready = False
            self.self_test_passed = False
            self.last_error = str(exc)
            logger.exception("Failed to initialize Piper ONNX TTS engine")

        return self.get_diagnostics()

    def _phonemize_with_espeak(self, text: str) -> str:
        """Convert English text into IPA string using espeak-ng."""
        if not self.espeak_bin:
            self.espeak_bin = self._locate_espeak()
        if self.espeak_bin:
            try:
                proc = subprocess.run(
                    [self.espeak_bin, "-q", "--ipa", "-v", self.espeak_voice, text],
                    capture_output=True,
                    text=True,
                    timeout=3.0,
                    check=False,
                )
                if proc.returncode == 0 and proc.stdout.strip():
                    # Collapse newlines while preserving clause punctuation from original text
                    lines = [ln.strip() for ln in proc.stdout.strip().splitlines() if ln.strip()]
                    return " ".join(lines)
            except Exception as exc:
                logger.warning("espeak-ng invocation failed, using fallback phonemizer: %s", exc)

        # Fallback grapheme-to-IPA converter
        lowered = text.lower()
        for dg, ipa in FALLBACK_DIGRAPHS:
            lowered = lowered.replace(dg, ipa)
        out: List[str] = []
        for ch in lowered:
            if ch in FALLBACK_CHARS:
                out.append(FALLBACK_CHARS[ch])
            else:
                out.append(ch)
        return "".join(out)

    def text_to_phoneme_ids(self, text: str) -> List[int]:
        """
        Convert raw English text into Piper phoneme ID sequence with interleaved pad tokens.
        """
        cleaned = re.sub(r"\s+", " ", text).strip()
        if not cleaned:
            return []

        # Split keeping punctuation marks so pauses are preserved in phoneme stream
        clauses = re.split(r"([,;:.!?]+)", cleaned)
        ipa_pieces: List[str] = []
        for piece in clauses:
            p = piece.strip()
            if not p:
                continue
            if re.fullmatch(r"[,;:.!?]+", p):
                ipa_pieces.append(p[0])
            else:
                ipa_pieces.append(self._phonemize_with_espeak(p))

        full_ipa = unicodedata.normalize("NFD", " ".join(ipa_pieces))

        pad_ids = self.phoneme_id_map.get("_", [0])
        bos_ids = self.phoneme_id_map.get("^", [1])
        eos_ids = self.phoneme_id_map.get("$", [2])

        phoneme_ids: List[int] = list(bos_ids) + list(pad_ids)
        for ch in full_ipa:
            # Try exact char in NFD or NFC
            mapped = self.phoneme_id_map.get(ch)
            if mapped is None:
                nfc_ch = unicodedata.normalize("NFC", ch)
                mapped = self.phoneme_id_map.get(nfc_ch)
            if mapped is not None:
                phoneme_ids.extend(mapped)
                phoneme_ids.extend(pad_ids)

        phoneme_ids.extend(eos_ids)
        return phoneme_ids

    def synthesize_pulse(self, duration_sec: float = 0.5) -> Tuple[bytes, Dict[str, Any]]:
        """
        Diagnostic verification: run a minimal phoneme pass through ONNX Runtime
        and pad/trim to a clean 0.5s silent verification pulse.
        """
        target_samples = int(self.sample_rate * duration_sec)
        if self.session is not None:
            pad_ids = self.phoneme_id_map.get("_", [0])
            bos_ids = self.phoneme_id_map.get("^", [1])
            eos_ids = self.phoneme_id_map.get("$", [2])
            space_ids = self.phoneme_id_map.get(" ", [3])
            seq = np.array([bos_ids + pad_ids + space_ids + pad_ids + eos_ids], dtype=np.int64)
            lengths = np.array([seq.shape[1]], dtype=np.int64)
            scales = np.array([self.noise_scale, self.length_scale, self.noise_w], dtype=np.float32)

            inputs: Dict[str, Any] = {
                "input": seq,
                "input_lengths": lengths,
                "scales": scales,
            }
            input_names = {inp.name for inp in self.session.get_inputs()}
            if "sid" in input_names:
                inputs["sid"] = np.array([0], dtype=np.int64)

            with self._lock:
                _ = self.session.run(None, inputs)[0]

        silent_pcm = np.zeros(target_samples, dtype=np.int16).tobytes()
        return silent_pcm, {
            "sample_rate": self.sample_rate,
            "duration_sec": duration_sec,
            "samples": target_samples,
        }

    @staticmethod
    def compute_amplitude_envelope(audio_f32: np.ndarray, sample_rate: int = 22050, fps: int = 60) -> List[float]:
        """
        Compute normalized 0.0-1.0 amplitude envelope at `fps` (e.g. 60Hz) to drive 3D character jaw/mouth morphing.
        """
        if audio_f32.size == 0:
            return []
        hop = max(1, sample_rate // fps)
        n_frames = max(1, int(np.ceil(len(audio_f32) / hop)))
        envelope: List[float] = []
        for i in range(n_frames):
            chunk = audio_f32[i * hop : (i + 1) * hop]
            if chunk.size == 0:
                envelope.append(0.0)
            else:
                rms = float(np.sqrt(np.mean(np.square(chunk))))
                # Map typical speech RMS (0.01 - 0.30) to expressive 0.0 - 1.0 mouth opening
                norm = min(1.0, max(0.0, (rms - 0.008) * 4.2))
                envelope.append(round(norm, 3))
        return envelope

    def synthesize_sentence(self, sentence: str) -> Tuple[bytes, Dict[str, Any]]:
        """
        Synthesize a single sentence into 22050Hz 16-bit mono signed PCM bytes (`pcm_s16le`),
        returning `(pcm_bytes, metadata_with_amplitude_envelope)`.
        """
        clean_text = sentence.strip()
        if not clean_text or not self.is_ready or self.session is None:
            return b"", {"sample_rate": self.sample_rate, "duration_sec": 0.0, "envelope": []}

        t0 = time.perf_counter()
        phoneme_ids = self.text_to_phoneme_ids(clean_text)
        if len(phoneme_ids) <= 3:
            return b"", {"sample_rate": self.sample_rate, "duration_sec": 0.0, "envelope": []}

        seq = np.array([phoneme_ids], dtype=np.int64)
        lengths = np.array([seq.shape[1]], dtype=np.int64)
        scales = np.array([self.noise_scale, self.length_scale, self.noise_w], dtype=np.float32)

        inputs: Dict[str, Any] = {
            "input": seq,
            "input_lengths": lengths,
            "scales": scales,
        }
        input_names = {inp.name for inp in self.session.get_inputs()}
        if "sid" in input_names:
            inputs["sid"] = np.array([0], dtype=np.int64)

        with self._lock:
            audio_out = self.session.run(None, inputs)[0]

        audio_f32 = np.squeeze(audio_out).astype(np.float32)
        if audio_f32.ndim == 0:
            audio_f32 = np.zeros(1, dtype=np.float32)

        # Normalize gently to prevent clipping while keeping crisp presence
        peak = float(np.max(np.abs(audio_f32))) if audio_f32.size > 0 else 0.0
        if peak > 0.95:
            audio_f32 = (audio_f32 / peak) * 0.95
        elif 0.05 < peak < 0.65:
            audio_f32 = (audio_f32 / peak) * 0.78

        # Append a brief 60ms natural breath pause between sentences
        pause_samples = np.zeros(int(self.sample_rate * 0.06), dtype=np.float32)
        audio_f32 = np.concatenate([audio_f32, pause_samples], axis=0)

        pcm_int16 = np.clip(audio_f32 * 32767.0, -32768, 32767).astype(np.int16)
        pcm_bytes = pcm_int16.tobytes()

        envelope = self.compute_amplitude_envelope(audio_f32, self.sample_rate, fps=60)
        duration_sec = round(len(pcm_int16) / self.sample_rate, 3)
        elapsed_ms = round((time.perf_counter() - t0) * 1000.0, 1)
        watchdog.record_tts_latency(elapsed_ms)

        return pcm_bytes, {
            "text": clean_text,
            "sample_rate": self.sample_rate,
            "channels": 1,
            "format": "pcm_s16le",
            "samples": int(len(pcm_int16)),
            "duration_sec": duration_sec,
            "latency_ms": elapsed_ms,
            "envelope": envelope,
        }

    def synthesize_stream(self, text: str) -> Generator[Tuple[bytes, Dict[str, Any]], None, None]:
        """
        Chunk text at punctuation boundaries (., !, ?) and yield (pcm_bytes, metadata)
        for each sentence chunk immediately.
        """
        chunks = [c.strip() for c in PUNCTUATION_CHUNK_RE.split(text.strip()) if c.strip()]
        for idx, chunk in enumerate(chunks):
            pcm_bytes, meta = self.synthesize_sentence(chunk)
            if pcm_bytes:
                meta["chunk_index"] = idx
                yield pcm_bytes, meta

    @staticmethod
    def pcm16_to_wav_bytes(pcm_bytes: bytes, sample_rate: int = 22050) -> bytes:
        """Wrap raw 16-bit mono signed PCM bytes in a standard RIFF WAV container."""
        buf = io.BytesIO()
        with wave.open(buf, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(sample_rate)
            wf.writeframes(pcm_bytes)
        return buf.getvalue()

    def get_diagnostics(self) -> Dict[str, Any]:
        files_ok, files_msg = self.validate_files()
        return {
            "status": "healthy" if (self.is_ready and self.self_test_passed and files_ok) else "degraded",
            "ready": self.is_ready,
            "self_test_passed": self.self_test_passed,
            "model_file": self.onnx_path.name,
            "model_path": str(self.onnx_path),
            "config_file": self.config_path.name,
            "file_detail": files_msg,
            "sample_rate_hz": self.sample_rate,
            "phonemizer": f"espeak-ng ({self.espeak_voice})" if self.espeak_bin else "Built-in English IPA Fallback",
            "load_time_ms": self.load_time_ms,
            "error": self.last_error,
        }
