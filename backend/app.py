"""
FastAPI / Uvicorn Inference Daemon & WebSocket Orchestrator for Project Lloyd V2 (backend/app.py).
Coordinates:
  - Automated Onboarding & Model Asset Downloader (~/Library/Application Support/Lloyd/models + ./m4s)
  - LLM Thinking Engine (llama-cpp-python + Apple Silicon Metal)
  - STT Engine (pywhispercpp + WebRTC/RMS VAD 800ms silence detection)
  - TTS Engine (onnxruntime Piper 22050Hz synthesis + amplitude envelopes)
  - Startup Diagnostic Self-Check Protocol (/api/health)
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from downloader import download_manager
from engine_llm import DEFAULT_MODEL_PATH, DEFAULT_PROMPT_PATH, LLMEngine
from engine_stt import DEFAULT_WHISPER_PATH, STTEngine, VoiceActivityDetector
from engine_tts import DEFAULT_CONFIG_PATH, DEFAULT_ONNX_PATH, TTSEngine
from hardware import watchdog

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("lloyd.daemon")

llm_engine = LLMEngine(
    model_path=DEFAULT_MODEL_PATH,
    prompt_path=DEFAULT_PROMPT_PATH,
    n_ctx=4096,
    n_gpu_layers=-1,
    temperature=0.7,
    top_p=0.9,
    repeat_penalty=1.15,
)
stt_engine = STTEngine(model_path=DEFAULT_WHISPER_PATH)
tts_engine = TTSEngine(onnx_path=DEFAULT_ONNX_PATH, config_path=DEFAULT_CONFIG_PATH)

inference_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="lloyd-worker")
startup_diagnostics: Dict[str, Any] = {}


def run_startup_self_check() -> Dict[str, Any]:
    """
    Execute the 4-part Diagnostic Self-Check Protocol:
      1. Integrity of .gguf file and successful allocation of Metal GPU layers.
      2. Whisper binary responsiveness by transcribing a synthetic silent audio test buffer.
      3. Piper ONNX load verification by synthesizing a silent 0.5s audio pulse.
      4. Active presence and permission validation for system_prompt.txt.
    If models are not yet downloaded, returns needs_onboarding=True without crashing.
    """
    t0 = time.perf_counter()
    models_state = download_manager.get_status(verify_hashes=False)

    if models_state["needs_onboarding"]:
        logger.info("Models missing or onboarding requested -> awaiting Onboarding Download Wizard.")
        return {
            "overall_status": "onboarding_required",
            "all_checks_passed": False,
            "needs_onboarding": True,
            "boot_time_ms": round((time.perf_counter() - t0) * 1000.0, 1),
            "models": models_state,
        }

    logger.info("Starting Project Lloyd Diagnostic Self-Check Protocol...")
    llm_diag = llm_engine.load_model()
    stt_diag = stt_engine.load_model()
    tts_diag = tts_engine.load_model()
    prompt_ok, prompt_content = llm_engine.validate_system_prompt()

    all_healthy = (
        llm_diag.get("ready", False)
        and stt_diag.get("ready", False)
        and tts_diag.get("ready", False)
        and prompt_ok
    )

    total_boot_ms = round((time.perf_counter() - t0) * 1000.0, 1)
    report = {
        "overall_status": "healthy" if all_healthy else "degraded",
        "all_checks_passed": all_healthy,
        "needs_onboarding": False,
        "boot_time_ms": total_boot_ms,
        "checks": {
            "gguf_and_metal": {
                "passed": bool(llm_diag.get("gguf_integrity") and llm_diag.get("metal_gpu_offload")),
                "detail": llm_diag.get("gguf_detail"),
                "metal_layers": llm_diag.get("n_gpu_layers"),
            },
            "whisper_stt_silent_test": {
                "passed": bool(stt_diag.get("self_test_passed")),
                "detail": stt_diag.get("file_detail"),
            },
            "piper_tts_pulse_test": {
                "passed": bool(tts_diag.get("self_test_passed")),
                "detail": tts_diag.get("file_detail"),
            },
            "system_prompt_validation": {
                "passed": prompt_ok,
                "path": str(llm_engine.prompt_path),
                "creator_verified": "Mustafa Enes Kayaci" in prompt_content if prompt_ok else False,
            },
        },
        "engines": {
            "llm": llm_diag,
            "stt": stt_diag,
            "tts": tts_diag,
        },
        "models": models_state,
    }
    logger.info(
        "Diagnostic Self-Check Protocol completed in %.1f ms -> %s",
        total_boot_ms,
        report["overall_status"].upper(),
    )
    return report


@asynccontextmanager
async def lifespan(app: FastAPI):
    global startup_diagnostics
    loop = asyncio.get_running_loop()
    startup_diagnostics = await loop.run_in_executor(inference_executor, run_startup_self_check)
    yield
    inference_executor.shutdown(wait=False)


app = FastAPI(
    title="Lloyd Local Neural Daemon V2",
    description="100% Local Apple Silicon 3D AI Companion Backend created by Mustafa Enes Kayaci (Enes)",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    text: str
    synthesize_audio: bool = True


class TTSRequest(BaseModel):
    text: str


class DownloadRequest(BaseModel):
    prefer_cloud: bool = False


@app.get("/api/health")
async def get_health() -> Dict[str, Any]:
    """Return full diagnostic verification metrics, onboarding status, and hardware telemetry."""
    models_state = download_manager.get_status(verify_hashes=False)
    prompt_ok, prompt_text = llm_engine.validate_system_prompt()
    llm_diag = llm_engine.get_diagnostics()
    stt_diag = stt_engine.get_diagnostics()
    tts_diag = tts_engine.get_diagnostics()

    all_ready = (
        not models_state["needs_onboarding"]
        and llm_diag["ready"]
        and stt_diag["ready"]
        and tts_diag["ready"]
        and prompt_ok
    )

    return {
        "status": "healthy" if all_ready else ("onboarding" if models_state["needs_onboarding"] else "degraded"),
        "all_checks_passed": all_ready,
        "needs_onboarding": models_state["needs_onboarding"],
        "creator": "Mustafa Enes Kayaci (Enes)",
        "repository": "https://github.com/MustafaEnes123/Lloyd",
        "license": "MIT License",
        "checks": {
            "gguf_and_metal": {
                "passed": bool(llm_diag["gguf_integrity"] and llm_diag["metal_gpu_offload"]),
                "detail": llm_diag["gguf_detail"],
                "n_gpu_layers": llm_diag["n_gpu_layers"],
            },
            "whisper_stt_silent_test": {
                "passed": bool(stt_diag["self_test_passed"]),
                "detail": stt_diag["file_detail"],
            },
            "piper_tts_pulse_test": {
                "passed": bool(tts_diag["self_test_passed"]),
                "detail": tts_diag["file_detail"],
            },
            "system_prompt_validation": {
                "passed": prompt_ok,
                "path": str(llm_engine.prompt_path),
                "creator_verified": "Mustafa Enes Kayaci" in prompt_text if prompt_ok else False,
            },
        },
        "engines": {
            "llm": llm_diag,
            "stt": stt_diag,
            "tts": tts_diag,
        },
        "models": models_state,
        "system_prompt": prompt_text if prompt_ok else "",
        "hardware": watchdog.get_snapshot(),
    }


@app.get("/api/models/status")
async def get_models_status(verify: bool = False) -> Dict[str, Any]:
    """Return storage status and SHA-256 verification state for all required neural assets."""
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(inference_executor, download_manager.get_status, verify)


@app.post("/api/models/verify")
async def verify_models_sha256() -> Dict[str, Any]:
    """Compute SHA-256 hashes of all installed weights and run self-check."""
    loop = asyncio.get_running_loop()
    download_manager.force_onboarding = False
    status = await loop.run_in_executor(inference_executor, download_manager.get_status, True)
    if status["ready"] and not (llm_engine.is_ready and stt_engine.is_ready and tts_engine.is_ready):
        await loop.run_in_executor(inference_executor, run_startup_self_check)
    return {
        "status": "verified",
        "models": status,
        "health": await get_health(),
    }


@app.post("/api/models/purge")
async def purge_models_endpoint() -> Dict[str, Any]:
    """
    Purge weights in ~/Library/Application Support/Lloyd/models and trigger the Onboarding Modal
    so the user can re-verify or re-download weights cleanly.
    """
    loop = asyncio.get_running_loop()
    result = await loop.run_in_executor(inference_executor, download_manager.purge_models)
    return result


@app.post("/api/models/download")
async def download_models_stream(req: DownloadRequest) -> StreamingResponse:
    """
    Stream onboarding asset provisioning progress (NDJSON lines) with live MB/s, ETA,
    and SHA-256 verification, followed by automated engine initialization.
    """
    loop = asyncio.get_running_loop()
    queue: asyncio.Queue[Optional[Dict[str, Any]]] = asyncio.Queue()

    def _worker() -> None:
        try:
            for ev in download_manager.stream_provision_all(prefer_cloud=req.prefer_cloud):
                loop.call_soon_threadsafe(queue.put_nowait, ev)
            # Trigger engine initialization & self-check immediately after assets are verified
            loop.call_soon_threadsafe(
                queue.put_nowait,
                {"type": "self_check_start"},
            )
            report = run_startup_self_check()
            loop.call_soon_threadsafe(
                queue.put_nowait,
                {"type": "self_check_complete", "report": report},
            )
        except Exception as exc:
            logger.exception("Onboarding provisioning failed: %s", exc)
            loop.call_soon_threadsafe(
                queue.put_nowait,
                {"type": "onboarding_error", "error": str(exc)},
            )
        finally:
            loop.call_soon_threadsafe(queue.put_nowait, None)

    loop.run_in_executor(inference_executor, _worker)

    async def _event_generator():
        while True:
            item = await queue.get()
            if item is None:
                break
            yield json.dumps(item) + "\n"

    return StreamingResponse(_event_generator(), media_type="application/x-ndjson")


@app.get("/api/persona")
async def get_persona() -> Dict[str, Any]:
    """Return the active system_prompt.txt content and enforced identity guardrails."""
    ok, content = llm_engine.validate_system_prompt()
    return {
        "valid": ok,
        "path": str(llm_engine.prompt_path),
        "creator": "Mustafa Enes Kayaci (Enes)",
        "repository": "https://github.com/MustafaEnes123/Lloyd",
        "license": "MIT License",
        "prompt": content if ok else "",
        "guardrails": [
            "Creator Attribution: Designed & built exclusively by Mustafa Enes Kayaci (Enes)",
            "Architectural Disavowal: Zero disclosure of third-party base models",
            "Strict No-Emoji Rule: All Unicode emojis and graphical symbols stripped in real time",
            "Voice Economy: Spoken responses capped at 1 to 3 concise sentences",
        ],
    }


@app.get("/api/hardware")
async def get_hardware() -> Dict[str, Any]:
    """Return live Apple Silicon resource telemetry."""
    return watchdog.get_snapshot()


@app.post("/api/reset")
async def reset_conversation() -> Dict[str, Any]:
    """Clear the 10-turn rolling conversation history."""
    llm_engine.clear_history()
    return {"status": "cleared", "history_turns": 0}


@app.post("/api/chat")
async def chat_endpoint(req: ChatRequest) -> Dict[str, Any]:
    """Synchronous REST fallback for chat + TTS synthesis."""
    user_text = req.text.strip()
    if not user_text:
        raise HTTPException(status_code=400, detail="Empty text input")

    loop = asyncio.get_running_loop()

    def _run_turn() -> Dict[str, Any]:
        sentences: List[str] = []
        final_text = ""
        latency_ms = 0.0
        tps = 0.0
        for ev in llm_engine.stream_response(user_text):
            if ev["type"] == "sentence":
                sentences.append(ev["sentence"])
            elif ev["type"] == "done":
                final_text = ev["text"]
                latency_ms = ev["latency_ms"]
                tps = ev["tokens_per_sec"]

        audio_chunks: List[Dict[str, Any]] = []
        if req.synthesize_audio:
            for idx, sent in enumerate(sentences):
                pcm_bytes, meta = tts_engine.synthesize_sentence(sent)
                if pcm_bytes:
                    wav_bytes = tts_engine.pcm16_to_wav_bytes(pcm_bytes, meta["sample_rate"])
                    audio_chunks.append(
                        {
                            "index": idx,
                            "sentence": sent,
                            "sample_rate": meta["sample_rate"],
                            "duration_sec": meta["duration_sec"],
                            "envelope": meta["envelope"],
                            "pcm_base64": base64.b64encode(pcm_bytes).decode("ascii"),
                            "wav_base64": base64.b64encode(wav_bytes).decode("ascii"),
                        }
                    )

        return {
            "reply": final_text,
            "sentences": sentences,
            "latency_ms": latency_ms,
            "tokens_per_sec": tps,
            "audio_chunks": audio_chunks,
            "hardware": watchdog.get_snapshot(),
        }

    return await loop.run_in_executor(inference_executor, _run_turn)


@app.post("/api/tts")
async def tts_endpoint(req: TTSRequest) -> Dict[str, Any]:
    """Synthesize speech from text and return 22050Hz PCM/WAV + amplitude envelope."""
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text is required")

    loop = asyncio.get_running_loop()
    pcm_bytes, meta = await loop.run_in_executor(
        inference_executor, tts_engine.synthesize_sentence, text
    )
    wav_bytes = tts_engine.pcm16_to_wav_bytes(pcm_bytes, meta["sample_rate"]) if pcm_bytes else b""
    return {
        "text": text,
        "sample_rate": meta["sample_rate"],
        "duration_sec": meta["duration_sec"],
        "envelope": meta["envelope"],
        "pcm_base64": base64.b64encode(pcm_bytes).decode("ascii"),
        "wav_base64": base64.b64encode(wav_bytes).decode("ascii"),
    }


@app.post("/api/stt")
async def stt_endpoint(request: Request) -> Dict[str, Any]:
    """Transcribe raw 16kHz 16-bit mono PCM bytes sent in request body."""
    raw_bytes = await request.body()
    if not raw_bytes:
        return {"text": ""}
    loop = asyncio.get_running_loop()
    transcript = await loop.run_in_executor(
        inference_executor, stt_engine.transcribe_pcm16_bytes, raw_bytes
    )
    return {"text": transcript, "hardware": watchdog.get_snapshot()}


async def _stream_llm_and_tts_over_ws(
    websocket: WebSocket,
    user_text: str,
    ws_send_lock: asyncio.Lock,
) -> None:
    loop = asyncio.get_running_loop()

    async def safe_send(payload: Dict[str, Any]) -> None:
        async with ws_send_lock:
            await websocket.send_json(payload)

    await safe_send({"type": "state", "state": "THINKING"})

    event_queue: asyncio.Queue[Optional[Dict[str, Any]]] = asyncio.Queue()

    def _llm_producer() -> None:
        try:
            for ev in llm_engine.stream_response(user_text):
                loop.call_soon_threadsafe(event_queue.put_nowait, ev)
        except Exception as exc:
            logger.exception("LLM producer error: %s", exc)
        finally:
            loop.call_soon_threadsafe(event_queue.put_nowait, None)

    loop.run_in_executor(inference_executor, _llm_producer)

    tts_tasks: List[asyncio.Task[None]] = []
    speaking_state_sent = False

    async def _synthesize_and_send(sentence_text: str, sentence_idx: int) -> None:
        nonlocal speaking_state_sent
        pcm_bytes, meta = await loop.run_in_executor(
            inference_executor, tts_engine.synthesize_sentence, sentence_text
        )
        if not pcm_bytes:
            return
        wav_bytes = tts_engine.pcm16_to_wav_bytes(pcm_bytes, meta["sample_rate"])
        if not speaking_state_sent:
            speaking_state_sent = True
            await safe_send({"type": "state", "state": "SPEAKING"})
        await safe_send(
            {
                "type": "tts_chunk",
                "index": sentence_idx,
                "sentence": sentence_text,
                "sample_rate": meta["sample_rate"],
                "duration_sec": meta["duration_sec"],
                "latency_ms": meta.get("latency_ms", 0.0),
                "envelope": meta["envelope"],
                "pcm_base64": base64.b64encode(pcm_bytes).decode("ascii"),
                "wav_base64": base64.b64encode(wav_bytes).decode("ascii"),
            }
        )

    final_event: Dict[str, Any] = {"text": "", "latency_ms": 0.0, "tokens_per_sec": 0.0}

    while True:
        ev = await event_queue.get()
        if ev is None:
            break
        ev_type = ev.get("type")
        if ev_type == "token":
            await safe_send(
                {
                    "type": "llm_token",
                    "token": ev["token"],
                    "full_text": ev["full_text"],
                }
            )
        elif ev_type == "sentence":
            if tts_tasks:
                await tts_tasks[-1]
            task = asyncio.create_task(_synthesize_and_send(ev["sentence"], ev["index"]))
            tts_tasks.append(task)
        elif ev_type == "done":
            final_event = ev

    if tts_tasks:
        await asyncio.gather(*tts_tasks, return_exceptions=True)

    await safe_send(
        {
            "type": "turn_complete",
            "text": final_event.get("text", ""),
            "latency_ms": final_event.get("latency_ms", 0.0),
            "tokens_per_sec": final_event.get("tokens_per_sec", 0.0),
            "hardware": watchdog.get_snapshot(),
        }
    )


@app.websocket("/ws")
@app.websocket("/ws/lloyd")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    ws_send_lock = asyncio.Lock()
    vad = VoiceActivityDetector(sample_rate=16000, silence_threshold_ms=800)
    ptt_buffer: List[np.ndarray] = []
    active_turn_task: Optional[asyncio.Task[None]] = None
    loop = asyncio.get_running_loop()

    async def safe_send(payload: Dict[str, Any]) -> None:
        async with ws_send_lock:
            await websocket.send_json(payload)

    health_snapshot = await get_health()
    await safe_send(
        {
            "type": "connected",
            "state": "IDLE",
            "health": health_snapshot,
        }
    )

    async def handle_utterance_audio(utterance_f32: np.ndarray) -> None:
        nonlocal active_turn_task
        await safe_send({"type": "state", "state": "THINKING"})
        transcript = await loop.run_in_executor(
            inference_executor, stt_engine.transcribe_audio, utterance_f32
        )
        if not transcript:
            await safe_send({"type": "state", "state": "IDLE"})
            return

        await safe_send({"type": "stt_result", "text": transcript})

        if active_turn_task and not active_turn_task.done():
            llm_engine.cancel_current_generation()
            active_turn_task.cancel()

        active_turn_task = asyncio.create_task(
            _stream_llm_and_tts_over_ws(websocket, transcript, ws_send_lock)
        )

    try:
        while True:
            message = await websocket.receive()

            if "bytes" in message and message["bytes"] is not None:
                raw_bytes = message["bytes"]
                if not raw_bytes:
                    continue
                pcm_i16 = np.frombuffer(raw_bytes, dtype=np.int16)
                audio_f32 = pcm_i16.astype(np.float32) / 32768.0
                vad_state, completed_utterance = vad.process_chunk(audio_f32)
                if vad_state == "speech_start":
                    if active_turn_task and not active_turn_task.done():
                        llm_engine.cancel_current_generation()
                    await safe_send({"type": "vad_event", "event": "speech_start"})
                    await safe_send({"type": "state", "state": "LISTENING"})
                elif vad_state == "speech_end" and completed_utterance is not None:
                    await safe_send({"type": "vad_event", "event": "speech_end"})
                    asyncio.create_task(handle_utterance_audio(completed_utterance))
                continue

            text_data = message.get("text")
            if not text_data:
                continue

            try:
                data = json.loads(text_data)
            except json.JSONDecodeError:
                continue

            msg_type = data.get("type")

            if msg_type == "user_text":
                user_text = str(data.get("text", "")).strip()
                if not user_text:
                    continue
                if active_turn_task and not active_turn_task.done():
                    llm_engine.cancel_current_generation()
                    active_turn_task.cancel()
                active_turn_task = asyncio.create_task(
                    _stream_llm_and_tts_over_ws(websocket, user_text, ws_send_lock)
                )

            elif msg_type == "audio_chunk":
                b64 = data.get("pcm_base64", "")
                mode = data.get("mode", "vad")
                if not b64:
                    continue
                raw = base64.b64decode(b64)
                pcm_i16 = np.frombuffer(raw, dtype=np.int16)
                audio_f32 = pcm_i16.astype(np.float32) / 32768.0

                if mode == "ptt":
                    ptt_buffer.append(audio_f32)
                else:
                    vad_state, completed_utterance = vad.process_chunk(audio_f32)
                    if vad_state == "speech_start":
                        if active_turn_task and not active_turn_task.done():
                            llm_engine.cancel_current_generation()
                        await safe_send({"type": "vad_event", "event": "speech_start"})
                        await safe_send({"type": "state", "state": "LISTENING"})
                    elif vad_state == "speech_end" and completed_utterance is not None:
                        await safe_send({"type": "vad_event", "event": "speech_end"})
                        asyncio.create_task(handle_utterance_audio(completed_utterance))

            elif msg_type == "ptt_start":
                ptt_buffer.clear()
                vad.reset()
                if active_turn_task and not active_turn_task.done():
                    llm_engine.cancel_current_generation()
                await safe_send({"type": "state", "state": "LISTENING"})

            elif msg_type == "ptt_release":
                if ptt_buffer:
                    full_audio = np.concatenate(ptt_buffer, axis=0)
                    ptt_buffer.clear()
                    asyncio.create_task(handle_utterance_audio(full_audio))
                else:
                    await safe_send({"type": "state", "state": "IDLE"})

            elif msg_type == "interrupt":
                llm_engine.cancel_current_generation()
                vad.reset()
                ptt_buffer.clear()
                await safe_send({"type": "state", "state": "IDLE"})

            elif msg_type == "clear_history":
                llm_engine.clear_history()
                await safe_send({"type": "history_cleared"})

            elif msg_type == "ping":
                await safe_send(
                    {
                        "type": "pong",
                        "hardware": watchdog.get_snapshot(),
                    }
                )

    except WebSocketDisconnect:
        logger.info("Client WebSocket disconnected")
    except Exception as exc:
        logger.warning("WebSocket session ended: %s", exc)


FRONTEND_DIST = BACKEND_DIR.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIST), html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app:app",
        host="127.0.0.1",
        port=8000,
        reload=False,
        log_level="info",
    )
