# Project Lloyd V2 — Local 3D Desktop AI Companion (macOS / Apple Silicon)

**Conceptualized, Engineered, and Built by Mustafa Enes Kayaci (Enes)**  
**Repository**: [https://github.com/MustafaEnes123/Lloyd](https://github.com/MustafaEnes123/Lloyd)  
**License**: [MIT License](file:///Users/mustafaeneskayaci/Documents/coding_projects/Lloyd/LICENSE)

Lloyd is a 100% local, offline, autonomous 3D desktop companion engineered specifically for Apple Silicon (`arm64` Metal Unified Memory). Lloyd lives inside an interactive Three.js cyber-loft environment, features a Google Gemini-inspired Neural Expressive UI, real-time 3D character appearance customization, and a zero-bundle onboarding downloader (`~/Library/Application Support/Lloyd/models`) with cryptographic SHA-256 verification.

---

## Directory Architecture

```text
Lloyd/
├── LICENSE                             # MIT License (Mustafa Enes Kayaci / Enes)
├── m4s/                                # Local developer model fallback cache
│   ├── qwen2.5-1.5b-instruct-q4_k_m.gguf
│   ├── ggml-tiny.en.bin
│   ├── en_US-lessac-medium.onnx
│   ├── en_US-lessac-medium.onnx.json
│   └── system_prompt.txt
├── backend/                            # High-performance local inference daemon
│   ├── app.py                          # FastAPI / Uvicorn server & WebSocket orchestrator
│   ├── downloader.py                   # Onboarding downloader, SHA-256 verifier & Application Support manager
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
│   │   ├── types/
│   │   │   └── customization.ts        # CharacterCustomizationState & Hair Palette presets
│   │   ├── components/
│   │   │   ├── NeuralSparkLogo.tsx     # Multi-layered 4-pointed star / neural spark SVG logo
│   │   │   ├── OnboardingModal.tsx     # Step-by-step model download & SHA-256 verification wizard
│   │   │   ├── Canvas3D.tsx            # Three.js 3D Anime Cyber-Loft Scene & Dynamic Lighting
│   │   │   ├── Character.tsx           # Customizable cel-shaded 3D anime humanoid companion
│   │   │   ├── SettingsModal.tsx       # 4-Tab Studio (Appearance, Persona, Hardware, Storage)
│   │   │   ├── DiagnosticBar.tsx       # Hardware, STT, LLM, TTS status indicators
│   │   │   ├── SubtitleOverlay.tsx     # Floating bottom dialogue dock & waveform visualizer
│   │   │   └── AudioVisualizer.tsx     # Real-time frequency reactivity during speech
│   │   ├── hooks/
│   │   │   ├── useVoiceLoop.ts         # Continuous VAD & Push-to-Talk (Spacebar) audio loop
│   │   │   └── useLloydSocket.ts       # Full-duplex WebSocket & Web Audio API 22050Hz player
│   │   └── styles/
│   │       └── index.css
│   └── public/
│       └── lloyd-icon.svg
└── scripts/
    ├── dev.sh                          # One-click startup for backend & frontend
    └── build_mac.sh                    # Portable macOS .app & drag-and-drop .dmg packager
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

### 3. Build Portable Zero-Config macOS `.app` and `.dmg` Installer
```bash
./scripts/build_mac.sh
```
Outputs:
- `/Users/mustafaeneskayaci/Documents/coding_projects/Lloyd/dist/Lloyd.app`
- `/Users/mustafaeneskayaci/Documents/coding_projects/Lloyd/dist/Lloyd-macOS-arm64.dmg` (Lightweight `<300 KB` installer with `/Applications` drag-and-drop shortcut; models are automatically provisioned into `~/Library/Application Support/Lloyd/models` on first launch).
