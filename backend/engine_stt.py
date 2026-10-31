"""
Speech-to-Text (STT) Engine & Voice Activity Detection (VAD) for Project Lloyd (backend/engine_stt.py).
Uses pywhispercpp pointing to /Users/mustafaeneskayaci/Documents/coding_projects/Lloyd/m4s/ggml-tiny.en.bin.
Integrates WebRTC VAD + adaptive energy VAD to detect speech onset and 800ms pause termination.
"""

from __future__ import annotations

import logging
import os
import threading
import time
import wave
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

import numpy as np

from downloader import download_manager
from hardware import watchdog

logger = logging.getLogger("lloyd.stt")

BASE_DIR = Path("/Users/mustafaeneskayaci/Documents/coding_projects/Lloyd")
M4S_DIR = BASE_DIR / "m4s"
DEFAULT_WHISPER_PATH = download_manager.resolve_asset_path("ggml-tiny.en.bin")

try:
    import webrtcvad
except ImportError:
    webrtcvad = None  # type: ignore

# Common Whisper hallucinations on near-silent buffers
WHISPER_HALLUCINATIONS = {
    "",
    "[blank_audio]",
    "(blank audio)",
    "[silence]",
    "[music]",
    "(music)",
    "[applause]",
    "you",
    "thank you.",
    "thanks for watching!",
    "thank you for watching.",
    "subtitles by the amara.org community",
}


class VoiceActivityDetector:
    """
    Hybrid WebRTC VAD + RMS energy detector operating on 16kHz 16-bit mono PCM streams.
    Dynamically detects speech onset and triggers transcription after `silence_threshold_ms` (800ms).
    """

    def __init__(
        self,
        sample_rate: int = 16000,
        aggressiveness: int = 2,
        silence_threshold_ms: int = 800,
        min_speech_ms: int = 280,
        max_utterance_s: float = 18.0,
        rms_threshold: float = 0.012,
    ) -> None:
        self.sample_rate = sample_rate
        self.silence_threshold_ms = silence_threshold_ms
        self.min_speech_ms = min_speech_ms
        self.max_utterance_samples = int(max_utterance_s * sample_rate)
        self.rms_threshold = rms_threshold

        self.vad = webrtcvad.Vad(aggressiveness) if webrtcvad is not None else None
        self.frame_duration_ms = 30  # 30ms WebRTC frame = 480 samples at 16kHz
        self.frame_samples = int(sample_rate * self.frame_duration_ms / 1000)

        self.reset()

    def reset(self) -> None:
        self.is_speaking: bool = False
        self.speech_samples: List[np.ndarray] = []
        self.total_speech_ms: float = 0.0
        self.trailing_silence_ms: float = 0.0
        self._preroll_chunks: List[np.ndarray] = []

    def is_frame_speech(self, pcm_int16: np.ndarray, float_samples: np.ndarray) -> bool:
        """Evaluate whether a chunk of 16kHz audio contains active human speech."""
        rms = float(np.sqrt(np.mean(np.square(float_samples)))) if len(float_samples) > 0 else 0.0
        if rms < self.rms_threshold * 0.45:
            return False

        if self.vad is not None and len(pcm_int16) >= self.frame_samples:
            speech_frames = 0
            total_frames = 0
            n_frames = len(pcm_int16) // self.frame_samples
            for i in range(n_frames):
                sub = pcm_int16[i * self.frame_samples : (i + 1) * self.frame_samples]
                try:
                    if self.vad.is_speech(sub.tobytes(), self.sample_rate):
                        speech_frames += 1
                    total_frames += 1
                except Exception:
                    pass
            if total_frames > 0:
                return (speech_frames / total_frames) >= 0.4 and rms >= (self.rms_threshold * 0.65)

        return rms >= self.rms_threshold

    def process_chunk(self, audio_float32: np.ndarray) -> Tuple[str, Optional[np.ndarray]]:
        """
        Feed a chunk of 16kHz float32 mono samples ([-1.0, 1.0]).
        Returns (state, completed_utterance_array_or_None)
        where state is one of: 'idle', 'speech_start', 'speaking', 'speech_end'.
        """
        if audio_float32.size == 0:
            return ("speaking" if self.is_speaking else "idle"), None

        chunk_ms = (len(audio_float32) / self.sample_rate) * 1000.0
        pcm_int16 = np.clip(audio_float32 * 32767.0, -32768, 32767).astype(np.int16)
        has_speech = self.is_frame_speech(pcm_int16, audio_float32)

        if has_speech:
            if not self.is_speaking:
                self.is_speaking = True
                self.trailing_silence_ms = 0.0
                self.total_speech_ms = chunk_ms
                # Prepend brief pre-roll so initial consonants are never clipped
                self.speech_samples = list(self._preroll_chunks[-4:]) + [audio_float32.copy()]
                self._preroll_chunks.clear()
                return "speech_start", None
            else:
                self.trailing_silence_ms = 0.0
                self.total_speech_ms += chunk_ms
                self.speech_samples.append(audio_float32.copy())

                total_len = sum(len(x) for x in self.speech_samples)
                if total_len >= self.max_utterance_samples:
                    utterance = np.concatenate(self.speech_samples, axis=0)
                    self.reset()
                    return "speech_end", utterance
                return "speaking", None
        else:
            if self.is_speaking:
                self.speech_samples.append(audio_float32.copy())
                self.trailing_silence_ms += chunk_ms
                if self.trailing_silence_ms >= self.silence_threshold_ms:
                    utterance = np.concatenate(self.speech_samples, axis=0)
                    had_enough_speech = self.total_speech_ms >= self.min_speech_ms
                    self.reset()
                    if had_enough_speech:
                        return "speech_end", utterance
                    return "idle", None
                return "speaking", None
            else:
                self._preroll_chunks.append(audio_float32.copy())
                if len(self._preroll_chunks) > 5:
                    self._preroll_chunks.pop(0)
                return "idle", None


class STTEngine:
    """
    Whisper.cpp Speech-to-Text engine backed by ggml-tiny.en.bin.
    """

    def __init__(self, model_path: Path = DEFAULT_WHISPER_PATH) -> None:
        self.model_path = Path(model_path)
        self.model: Any = None
        self._lock = threading.Lock()
        self.is_ready: bool = False
        self.self_test_passed: bool = False
        self.last_error: Optional[str] = None
        self.load_time_ms: float = 0.0
        self.sample_rate: int = 16000

    def validate_model_file(self) -> Tuple[bool, str]:
        self.model_path = download_manager.resolve_asset_path("ggml-tiny.en.bin")
        if not self.model_path.exists():
            return False, f"Missing Whisper model at {self.model_path}"
        if not os.access(self.model_path, os.R_OK):
            return False, f"Permission denied reading {self.model_path}"
        size_bytes = self.model_path.stat().st_size
        if size_bytes < 1024 * 1024:
            return False, f"Whisper binary unexpectedly small ({size_bytes} bytes)"
        return True, f"Verified ggml-tiny.en.bin ({round(size_bytes / (1024 * 1024), 1)} MB)"

    def load_model(self) -> Dict[str, Any]:
        """Load ggml-tiny.en.bin via pywhispercpp and run a silent buffer diagnostic check."""
        t0 = time.perf_counter()
        ok, msg = self.validate_model_file()
        if not ok:
            self.last_error = msg
            logger.error("STT validation failed: %s", msg)
            return self.get_diagnostics()

        try:
            from pywhispercpp.model import Model

            with self._lock:
                self.model = Model(
                    str(self.model_path),
                    n_threads=max(2, min(6, (os.cpu_count() or 4))),
                    print_realtime=False,
                    print_progress=False,
                )

            # Diagnostic self-check: transcribe a synthetic 0.6s silent audio test buffer
            silent_buffer = np.zeros(int(self.sample_rate * 0.6), dtype=np.float32)
            _ = self.transcribe_audio(silent_buffer, is_diagnostic=True)

            self.self_test_passed = True
            self.is_ready = True
            self.last_error = None
            self.load_time_ms = round((time.perf_counter() - t0) * 1000.0, 1)
            logger.info(
                "Whisper STT engine initialized and verified in %.1f ms (%s)",
                self.load_time_ms,
                msg,
            )
        except Exception as exc:
            self.is_ready = False
            self.self_test_passed = False
            self.last_error = str(exc)
            logger.exception("Failed to initialize Whisper STT engine")

        return self.get_diagnostics()

    def transcribe_audio(
        self,
        audio_data: np.ndarray,
        is_diagnostic: bool = False,
    ) -> str:
        """
        Transcribe a 16kHz mono float32 or int16 numpy buffer using ggml-tiny.en.bin.
        """
        if self.model is None and not is_diagnostic:
            return ""

        t0 = time.perf_counter()
        samples = np.asarray(audio_data)
        if samples.dtype == np.int16:
            samples = samples.astype(np.float32) / 32768.0
        else:
            samples = samples.astype(np.float32)

        if samples.ndim > 1:
            samples = samples.mean(axis=-1)

        # Normalize peak if quiet speech
        peak = float(np.max(np.abs(samples))) if samples.size > 0 else 0.0
        if not is_diagnostic and peak < 0.004:
            return ""
        if 0.02 < peak < 0.85:
            samples = (samples / peak) * 0.85

        with self._lock:
            try:
                segments = self.model.transcribe(samples)
                text_parts = [seg.text.strip() for seg in segments if getattr(seg, "text", "").strip()]
                transcript = " ".join(text_parts).strip()
            except Exception as exc:
                if is_diagnostic:
                    raise
                logger.error("Whisper transcription error: %s", exc)
                return ""

        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        if not is_diagnostic:
            watchdog.record_stt_latency(elapsed_ms)

        # Filter blank/hallucinated tokens
        cleaned_lower = transcript.lower().strip()
        if cleaned_lower in WHISPER_HALLUCINATIONS:
            return ""
        if cleaned_lower.startswith("[") and cleaned_lower.endswith("]"):
            return ""
        if cleaned_lower.startswith("(") and cleaned_lower.endswith(")"):
            return ""

        return transcript

    def transcribe_pcm16_bytes(self, pcm_bytes: bytes) -> str:
        """Convert raw 16kHz 16-bit mono signed PCM bytes to float32 and transcribe."""
        if not pcm_bytes:
            return ""
        pcm_int16 = np.frombuffer(pcm_bytes, dtype=np.int16)
        audio_f32 = pcm_int16.astype(np.float32) / 32768.0
        return self.transcribe_audio(audio_f32)

    def get_diagnostics(self) -> Dict[str, Any]:
        file_ok, file_msg = self.validate_model_file()
        return {
            "status": "healthy" if (self.is_ready and self.self_test_passed and file_ok) else "degraded",
            "ready": self.is_ready,
            "self_test_passed": self.self_test_passed,
            "model_file": self.model_path.name,
            "model_path": str(self.model_path),
            "file_detail": file_msg,
            "sample_rate_hz": self.sample_rate,
            "vad_engine": "WebRTC VAD + Adaptive RMS (800ms silence threshold)"
            if webrtcvad is not None
            else "Adaptive RMS VAD (800ms silence threshold)",
            "load_time_ms": self.load_time_ms,
            "error": self.last_error,
        }
