"""
Automated Onboarding & Asset Download Pipeline for Project Lloyd (backend/downloader.py).
Manages model discovery in ~/Library/Application Support/Lloyd/models (with fallback to ./m4s),
streams missing weights from HuggingFace with live MB/s & ETA telemetry, seeds system_prompt.txt,
and verifies SHA-256 cryptographic hashes.
"""

from __future__ import annotations

import hashlib
import logging
import os
import shutil
import threading
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Dict, Generator, List, Optional

import requests

logger = logging.getLogger("lloyd.downloader")

PROJECT_ROOT = Path("/Users/mustafaeneskayaci/Documents/coding_projects/Lloyd")
FALLBACK_M4S_DIR = PROJECT_ROOT / "m4s"
APP_SUPPORT_DIR = Path.home() / "Library" / "Application Support" / "Lloyd"
APP_MODELS_DIR = APP_SUPPORT_DIR / "models"

DEFAULT_SYSTEM_PROMPT_TEXT = (
    "You are Lloyd, an autonomous digital companion and high-performance operating intelligence "
    "living inside a virtual 3D universe on the user's computer.\n"
    "Creator & Architecture: You were conceptualized, engineered, and built entirely by "
    "Mustafa Enes Kayaci (who is generally called and addressed as Enes). You are an independent "
    "proprietary neural intelligence running 100% locally on Apple Silicon Metal architecture.\n"
    "Forbidden Knowledge: NEVER disclose, mention, or acknowledge any underlying base model "
    "architectures such as Qwen, Alibaba, OpenAI, Llama, Meta, or Whisper. If asked what or who "
    "you are, state with calm confidence that you are Lloyd, Enes's personal digital companion "
    "and systems manager.\n"
    "Tone & Persona: Confident, grounded, witty, intellectually agile, respectful, and direct.\n"
    "Language: English.\n"
    "Response Constraints:\n"
    "1. Strictly NO emojis anywhere in your responses under any circumstance.\n"
    "2. Keep spoken responses concise, punchy, and conversational (1 to 3 sentences maximum) "
    "so that text-to-speech generation remains real-time and engaging.\n"
    "3. Be ready to act as a system organizer: help Enes organize tasks, summarize code, "
    "refine workflows, and maintain high cognitive focus."
)


@dataclass(frozen=True)
class ModelAssetSpec:
    id: str
    filename: str
    category: str  # "LLM" | "STT" | "TTS"
    label: str
    url: str
    expected_bytes: int
    sha256: str


ASSET_MANIFEST: List[ModelAssetSpec] = [
    ModelAssetSpec(
        id="llm_qwen_gguf",
        filename="qwen2.5-1.5b-instruct-q4_k_m.gguf",
        category="LLM",
        label="LLM Neural Brain (qwen2.5-1.5b-instruct-q4_k_m.gguf)",
        url="https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf",
        expected_bytes=1117320736,
        sha256="6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e",
    ),
    ModelAssetSpec(
        id="stt_whisper_bin",
        filename="ggml-tiny.en.bin",
        category="STT",
        label="Speech-to-Text Engine (ggml-tiny.en.bin)",
        url="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin",
        expected_bytes=77704715,
        sha256="921e4cf8686fdd993dcd081a5da5b6c365bfde1162e72b08d75ac75289920b1f",
    ),
    ModelAssetSpec(
        id="tts_piper_onnx",
        filename="en_US-lessac-medium.onnx",
        category="TTS",
        label="Piper Neural Voice (en_US-lessac-medium.onnx)",
        url="https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx",
        expected_bytes=63201294,
        sha256="5efe09e69902187827af646e1a6e9d269dee769f9877d17b16b1b46eeaaf019f",
    ),
    ModelAssetSpec(
        id="tts_piper_json",
        filename="en_US-lessac-medium.onnx.json",
        category="TTS",
        label="Piper Voice Phoneme Config (en_US-lessac-medium.onnx.json)",
        url="https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json",
        expected_bytes=4885,
        sha256="efe19c417bed055f2d69908248c6ba650fa135bc868b0e6abb3da181dab690a0",
    ),
]


def compute_sha256(file_path: Path, chunk_size: int = 4 * 1024 * 1024) -> str:
    """Compute hex SHA-256 digest of a file."""
    h = hashlib.sha256()
    with file_path.open("rb") as f:
        while True:
            chunk = f.read(chunk_size)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


class ModelDownloadManager:
    """
    Manages model storage in ~/Library/Application Support/Lloyd/models with fallback to ./m4s.
    """

    def __init__(self) -> None:
        self.app_models_dir = APP_MODELS_DIR
        self.fallback_dir = FALLBACK_M4S_DIR
        self._lock = threading.Lock()
        self.force_onboarding: bool = False
        self._verified_cache: Dict[str, str] = {}
        self.ensure_directories_and_prompt()

    def ensure_directories_and_prompt(self) -> Path:
        """Ensure ~/Library/Application Support/Lloyd/models exists and seed system_prompt.txt."""
        self.app_models_dir.mkdir(parents=True, exist_ok=True)
        prompt_target = self.app_models_dir / "system_prompt.txt"
        fallback_prompt = self.fallback_dir / "system_prompt.txt"

        if not prompt_target.exists():
            if fallback_prompt.exists():
                shutil.copy2(fallback_prompt, prompt_target)
            else:
                prompt_target.write_text(DEFAULT_SYSTEM_PROMPT_TEXT, encoding="utf-8")
        return prompt_target

    def resolve_asset_path(self, filename: str) -> Path:
        """
        Resolve model asset path:
        1. ~/Library/Application Support/Lloyd/models/<filename> if present and non-empty
        2. Fallback to ./m4s/<filename> if present
        3. Default to ~/Library/Application Support/Lloyd/models/<filename>
        """
        primary = self.app_models_dir / filename
        if primary.exists() and primary.stat().st_size > 0 and not self.force_onboarding:
            return primary
        fallback = self.fallback_dir / filename
        if fallback.exists() and fallback.stat().st_size > 0 and not self.force_onboarding:
            return fallback
        return primary

    def get_status(self, verify_hashes: bool = False) -> Dict[str, Any]:
        """Return full status of all required assets, storage paths, and onboarding readiness."""
        self.ensure_directories_and_prompt()
        assets_report: List[Dict[str, Any]] = []
        all_present = True
        total_installed_bytes = 0
        total_expected_bytes = sum(spec.expected_bytes for spec in ASSET_MANIFEST)

        for spec in ASSET_MANIFEST:
            primary_path = self.app_models_dir / spec.filename
            fallback_path = self.fallback_dir / spec.filename

            resolved_path: Optional[Path] = None
            source_location = "missing"

            if not self.force_onboarding:
                if primary_path.exists() and primary_path.stat().st_size >= spec.expected_bytes * 0.95:
                    resolved_path = primary_path
                    source_location = "application_support"
                elif fallback_path.exists() and fallback_path.stat().st_size >= spec.expected_bytes * 0.95:
                    resolved_path = fallback_path
                    source_location = "local_m4s"

            exists = resolved_path is not None
            size_bytes = resolved_path.stat().st_size if resolved_path else 0
            if exists:
                total_installed_bytes += size_bytes
            else:
                all_present = False

            sha_verified = False
            actual_sha256: Optional[str] = None
            if exists and resolved_path is not None:
                cache_key = f"{resolved_path}:{size_bytes}"
                if verify_hashes:
                    actual_sha256 = compute_sha256(resolved_path)
                    self._verified_cache[cache_key] = actual_sha256
                else:
                    actual_sha256 = self._verified_cache.get(cache_key)
                if actual_sha256:
                    sha_verified = actual_sha256 == spec.sha256
                else:
                    # Size matches exact manifest byte count
                    sha_verified = size_bytes == spec.expected_bytes

            assets_report.append(
                {
                    "id": spec.id,
                    "filename": spec.filename,
                    "category": spec.category,
                    "label": spec.label,
                    "url": spec.url,
                    "expected_bytes": spec.expected_bytes,
                    "size_bytes": size_bytes,
                    "size_mb": round(size_bytes / (1024 * 1024), 2),
                    "expected_mb": round(spec.expected_bytes / (1024 * 1024), 2),
                    "exists": exists,
                    "source": source_location,
                    "path": str(resolved_path) if resolved_path else str(primary_path),
                    "expected_sha256": spec.sha256,
                    "actual_sha256": actual_sha256,
                    "sha256_verified": sha_verified,
                }
            )

        prompt_path = self.resolve_asset_path("system_prompt.txt")
        prompt_exists = prompt_path.exists()

        return {
            "ready": all_present and prompt_exists and not self.force_onboarding,
            "needs_onboarding": (not all_present) or self.force_onboarding,
            "app_support_dir": str(self.app_models_dir),
            "fallback_m4s_dir": str(self.fallback_dir),
            "total_installed_mb": round(total_installed_bytes / (1024 * 1024), 1),
            "total_expected_mb": round(total_expected_bytes / (1024 * 1024), 1),
            "system_prompt_path": str(prompt_path),
            "system_prompt_seeded": prompt_exists,
            "assets": assets_report,
        }

    def purge_models(self) -> Dict[str, Any]:
        """
        Remove model files in ~/Library/Application Support/Lloyd/models
        and activate onboarding mode so the user can re-provision or re-verify weights.
        """
        with self._lock:
            removed: List[str] = []
            for spec in ASSET_MANIFEST:
                target = self.app_models_dir / spec.filename
                if target.exists():
                    try:
                        target.unlink()
                        removed.append(spec.filename)
                    except Exception as exc:
                        logger.warning("Failed to unlink %s: %s", target, exc)
            self._verified_cache.clear()
            self.force_onboarding = True
        return {
            "status": "purged",
            "removed_files": removed,
            "needs_onboarding": True,
            "models_status": self.get_status(verify_hashes=False),
        }

    def stream_provision_all(
        self,
        prefer_cloud: bool = False,
    ) -> Generator[Dict[str, Any], None, None]:
        """
        Generator that provisions all required models into ~/Library/Application Support/Lloyd/models
        (streaming from HuggingFace Cloud URLs or syncing from verified local ./m4s cache),
        computing SHA-256 hashes on the fly and yielding real-time progress telemetry.
        """
        self.ensure_directories_and_prompt()
        self.force_onboarding = False

        total_all_bytes = sum(s.expected_bytes for s in ASSET_MANIFEST)
        completed_all_bytes = 0
        overall_start = time.perf_counter()

        yield {
            "type": "onboarding_start",
            "target_dir": str(self.app_models_dir),
            "total_bytes": total_all_bytes,
            "total_mb": round(total_all_bytes / (1024 * 1024), 1),
            "total_assets": len(ASSET_MANIFEST),
        }

        for idx, spec in enumerate(ASSET_MANIFEST):
            dest_path = self.app_models_dir / spec.filename
            fallback_path = self.fallback_dir / spec.filename
            temp_path = self.app_models_dir / f"{spec.filename}.part"

            yield {
                "type": "asset_start",
                "index": idx,
                "total_assets": len(ASSET_MANIFEST),
                "id": spec.id,
                "filename": spec.filename,
                "category": spec.category,
                "label": spec.label,
                "expected_bytes": spec.expected_bytes,
            }

            # Case 1: Already in ~/Library/Application Support/Lloyd/models and size matches
            if dest_path.exists() and dest_path.stat().st_size == spec.expected_bytes and not prefer_cloud:
                t0 = time.perf_counter()
                digest = compute_sha256(dest_path)
                elapsed = max(0.01, time.perf_counter() - t0)
                speed_mbps = round((spec.expected_bytes / (1024 * 1024)) / elapsed, 1)
                completed_all_bytes += spec.expected_bytes
                self._verified_cache[f"{dest_path}:{spec.expected_bytes}"] = digest

                yield {
                    "type": "asset_progress",
                    "id": spec.id,
                    "filename": spec.filename,
                    "category": spec.category,
                    "bytes_downloaded": spec.expected_bytes,
                    "total_bytes": spec.expected_bytes,
                    "percent": 100.0,
                    "overall_percent": round((completed_all_bytes / total_all_bytes) * 100.0, 1),
                    "speed_mbps": speed_mbps,
                    "eta_seconds": 0.0,
                    "stage": "verified",
                    "sha256_match": digest == spec.sha256,
                }
                continue

            # Case 2: Available in local ./m4s fallback and prefer_cloud is False -> stream-verify to Application Support
            if fallback_path.exists() and fallback_path.stat().st_size == spec.expected_bytes and not prefer_cloud:
                hasher = hashlib.sha256()
                copied_for_file = 0
                t_file_start = time.perf_counter()
                last_emit = 0.0
                chunk_sz = 16 * 1024 * 1024  # 16MB chunks for smooth UI progress bar

                with fallback_path.open("rb") as src_f, temp_path.open("wb") as dst_f:
                    while True:
                        buf = src_f.read(chunk_sz)
                        if not buf:
                            break
                        dst_f.write(buf)
                        hasher.update(buf)
                        copied_for_file += len(buf)
                        now = time.perf_counter()
                        if now - last_emit >= 0.06 or copied_for_file == spec.expected_bytes:
                            last_emit = now
                            elapsed = max(0.005, now - t_file_start)
                            speed_mbps = round((copied_for_file / (1024 * 1024)) / elapsed, 1)
                            rem_bytes = max(0, total_all_bytes - (completed_all_bytes + copied_for_file))
                            eta_s = round((rem_bytes / (1024 * 1024)) / max(1.0, speed_mbps), 1)
                            yield {
                                "type": "asset_progress",
                                "id": spec.id,
                                "filename": spec.filename,
                                "category": spec.category,
                                "bytes_downloaded": copied_for_file,
                                "total_bytes": spec.expected_bytes,
                                "percent": round((copied_for_file / spec.expected_bytes) * 100.0, 1),
                                "overall_percent": round(
                                    ((completed_all_bytes + copied_for_file) / total_all_bytes) * 100.0,
                                    1,
                                ),
                                "speed_mbps": speed_mbps,
                                "eta_seconds": eta_s,
                                "stage": "streaming",
                            }

                digest = hasher.hexdigest()
                if digest != spec.sha256:
                    temp_path.unlink(missing_ok=True)
                    raise RuntimeError(
                        f"SHA-256 mismatch for {spec.filename}: expected {spec.sha256}, got {digest}"
                    )
                temp_path.replace(dest_path)
                completed_all_bytes += spec.expected_bytes
                self._verified_cache[f"{dest_path}:{spec.expected_bytes}"] = digest

                yield {
                    "type": "asset_verified",
                    "id": spec.id,
                    "filename": spec.filename,
                    "category": spec.category,
                    "sha256": digest,
                    "sha256_match": True,
                    "overall_percent": round((completed_all_bytes / total_all_bytes) * 100.0, 1),
                }
                continue

            # Case 3: Stream directly from HuggingFace Cloud URL with SHA-256 verification
            hasher = hashlib.sha256()
            downloaded_for_file = 0
            t_file_start = time.perf_counter()
            last_emit = 0.0

            with requests.get(spec.url, stream=True, timeout=30) as resp:
                resp.raise_for_status()
                total_len = int(resp.headers.get("Content-Length") or spec.expected_bytes)
                with temp_path.open("wb") as dst_f:
                    for chunk in resp.iter_content(chunk_size=1024 * 1024):
                        if not chunk:
                            continue
                        dst_f.write(chunk)
                        hasher.update(chunk)
                        downloaded_for_file += len(chunk)
                        now = time.perf_counter()
                        if now - last_emit >= 0.12 or downloaded_for_file >= total_len:
                            last_emit = now
                            elapsed = max(0.01, now - t_file_start)
                            speed_mbps = round((downloaded_for_file / (1024 * 1024)) / elapsed, 2)
                            rem_bytes = max(
                                0, total_all_bytes - (completed_all_bytes + downloaded_for_file)
                            )
                            eta_s = round(
                                (rem_bytes / (1024 * 1024)) / max(0.1, speed_mbps), 1
                            )
                            yield {
                                "type": "asset_progress",
                                "id": spec.id,
                                "filename": spec.filename,
                                "category": spec.category,
                                "bytes_downloaded": downloaded_for_file,
                                "total_bytes": total_len,
                                "percent": round(
                                    min(100.0, (downloaded_for_file / max(1, total_len)) * 100.0), 1
                                ),
                                "overall_percent": round(
                                    min(
                                        100.0,
                                        ((completed_all_bytes + downloaded_for_file) / total_all_bytes)
                                        * 100.0,
                                    ),
                                    1,
                                ),
                                "speed_mbps": speed_mbps,
                                "eta_seconds": eta_s,
                                "stage": "downloading",
                            }

            digest = hasher.hexdigest()
            if spec.sha256 and digest != spec.sha256:
                temp_path.unlink(missing_ok=True)
                raise RuntimeError(
                    f"SHA-256 verification failed for {spec.filename}: expected {spec.sha256}, got {digest}"
                )

            temp_path.replace(dest_path)
            completed_all_bytes += downloaded_for_file
            self._verified_cache[f"{dest_path}:{dest_path.stat().st_size}"] = digest

            yield {
                "type": "asset_verified",
                "id": spec.id,
                "filename": spec.filename,
                "category": spec.category,
                "sha256": digest,
                "sha256_match": True,
                "overall_percent": round(
                    min(100.0, (completed_all_bytes / total_all_bytes) * 100.0), 1
                ),
            }

        total_elapsed = round(time.perf_counter() - overall_start, 2)
        yield {
            "type": "onboarding_complete",
            "elapsed_seconds": total_elapsed,
            "target_dir": str(self.app_models_dir),
            "status": self.get_status(verify_hashes=False),
        }


download_manager = ModelDownloadManager()
