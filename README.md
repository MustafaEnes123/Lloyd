# Project Lloyd — Local 3D Desktop AI Companion (macOS / Apple Silicon)

**Conceptualized, Engineered, and Built by Mustafa Enes Kayaci (Enes)**

Lloyd is a 100% local, offline, autonomous 3D desktop companion engineered specifically for Apple Silicon (`arm64` Metal Unified Memory). Lloyd lives inside an interactive Three.js cyber-loft environment, listens with near-zero latency via Whisper.cpp + WebRTC Voice Activity Detection (800ms silence threshold), thinks on Metal GPU layers via Llama.cpp, and speaks in real time using Piper ONNX synthesis at 22050Hz with live frequency-driven jaw & mouth lip-sync.

---

## Directory Architecture

```text
Lloyd/
├── m4s/                                # Local neural model assets
│   ├── qwen2.5-1.5b-instruct-q4_k_m.gguf
│   ├── ggml-tiny.en.bin
│   ├── en_US-lessac-medium.onnx
│   ├── en_US-lessac-medium.onnx.json
│   └── system_prompt.txt
├── backend/                            # High-performance local inference daemon
│   ├── app.py                          # FastAPI / Uvicorn server & WebSocket orchestrator
│   ├── engine_llm.py                   # llama-cpp-python with Metal acceleration (n_gpu_layers=-1)
│   ├── engine_stt.py                   # whisper.cpp (pywhispercpp) + 800ms VAD pipeline
│   ├── engine_tts.py                   # onnxruntime Piper TTS 22050Hz audio & lip-sync pipeline
│   ├── hardware.py                     # Metal GPU, RAM, & Thermal watchdog
│   └── requirements.txt
├── frontend/                           # React + Vite + Three.js + Tailwind CSS GUI
│   ├── package.json
│   ├── vite.config.ts
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── Canvas3D.tsx            # Three.js 3D Anime Cyber-Loft Scene & Lighting
│   │   │   ├── Character.tsx           # Procedural cel-shaded 3D anime humanoid companion
│   │   │   ├── SettingsModal.tsx       # Top-left frosted-glass configuration & diagnostics panel
│   │   │   ├── DiagnosticBar.tsx       # Hardware, STT, LLM, TTS status indicators
│   │   │   ├── SubtitleOverlay.tsx     # Live conversation captioning & manual text input
│   │   │   └── AudioVisualizer.tsx     # Real-time frequency reactivity during speech
│   │   ├── hooks/
│   │   │   ├── useVoiceLoop.ts         # Continuous VAD & Push-to-Talk (Spacebar) audio loop
│   │   │   └── useLloydSocket.ts       # Full-duplex WebSocket & Web Audio API 22050Hz player
│   │   └── styles/
│   │       └── index.css
│   └── public/
└── scripts/
    ├── dev.sh                          # One-click startup for backend & frontend
    └── build_mac.sh                    # Automated packager into native macOS .app & .dmg
```

---

## Quick Start

### 1. Activate Virtual Environment
```bash
source /Users/mustafaeneskayaci/Documents/coding_projects/Lloyd/.venv/bin/activate
```

### 2. Launch Full Stack in Development Mode
```bash
./scripts/dev.sh
```
- **3D Companion UI**: `http://127.0.0.1:5173`
- **Inference Daemon & Health Check**: `http://127.0.0.1:8000/api/health`

### 3. Build Native macOS `.app` and `.dmg` Installer
```bash
./scripts/build_mac.sh
```
Outputs:
- `/Users/mustafaeneskayaci/Documents/coding_projects/Lloyd/dist/Lloyd.app`
- `/Users/mustafaeneskayaci/Documents/coding_projects/Lloyd/dist/Lloyd-macOS-arm64.dmg`
