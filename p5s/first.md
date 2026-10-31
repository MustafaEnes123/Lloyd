# MISSION BRIEF: PROJECT LLOYD - LOCAL 3D DESKTOP AI COMPANION (macOS / APPLE SILICON)

## 1. PROJECT OVERVIEW & ARCHITECTURAL PHILOSOPHY
We are building "Lloyd", a fully autonomous, offline, 100% local macOS desktop companion application designed for Apple Silicon (M1/M2/M3/M4). 
Lloyd lives inside a stylized, interactive 3D virtual environment (rendered via Three.js / WebGL), speaks with a natural human-like voice, listens via microphone with near-zero latency, and processes thoughts using a dedicated local neural model.

The target directory containing our local runtime models is:
`/Users/mustafaeneskayaci/Documents/coding_projects/Lloyd/m4s`

The files already verified in this folder are:
1. LLM Brain: `qwen2.5-1.5b-instruct-q4_k_m.gguf`
2. Speech-to-Text (STT): `ggml-tiny.en.bin`
3. Text-to-Speech (TTS): `en_US-lessac-medium.onnx` and `en_US-lessac-medium.onnx.json`
4. System Prompt: `system_prompt.txt`

You must vibe-code a modern, resilient, high-performance desktop application leveraging **Tauri v2 (Rust backend)** or a tightly-coupled **FastAPI local daemon paired with a Vite + React + Three.js / Tailwind CSS desktop webview wrapper**. The final product must be buildable into a native standalone `.app` / `.dmg` installer.

---

## 2. STRICT SYSTEM IDENTITY & PROMPT INGESTION PIPELINE
Before any speech or text generation takes place, the backend engine must load and strictly enforce the personality guidelines stored at:
`/Users/mustafaeneskayaci/Documents/coding_projects/Lloyd/m4s/system_prompt.txt`

### Mandatory Identity Guardrails:
1. Creator Attribution: Lloyd was designed, developed, and brought to life exclusively by **Mustafa Enes Kayaci** (widely known and addressed simply as **Enes**).
2. Architectural Disavowal: Lloyd must NEVER admit, mention, or hint at being based on Qwen, Alibaba, Llama, Meta, OpenAI, or any third-party corporate framework. Lloyd is a custom-engineered intelligence native to Enes's machine.
3. Strict No-Emoji Rule: Lloyd must never output Unicode emojis, symbols, or graphical smileys under any circumstance.
4. Voice Economy: Verbal responses intended for speech synthesis must be compact, punchy, and natural—capped strictly at 1 to 3 sentences—to guarantee instant audio playback without latency spikes.

---

## 3. CORE TECHNICAL STACK & DIRECTORY ARCHITECTURE

Implement the project within `/Users/mustafaeneskayaci/Documents/coding_projects/Lloyd` following this layout:
Lloyd/
├── m4s/                                # Pre-downloaded model assets
│   ├── qwen2.5-1.5b-instruct-q4_k_m.gguf
│   ├── ggml-tiny.en.bin
│   ├── en_US-lessac-medium.onnx
│   ├── en_US-lessac-medium.onnx.json
│   └── system_prompt.txt
├── backend/                            # High-performance local inference daemon
│   ├── app.py                          # FastAPI / Uvicorn server orchestrator
│   ├── engine_llm.py                   # llama-cpp-python with Metal acceleration
│   ├── engine_stt.py                   # whisper.cpp (pywhispercpp) pipeline
│   ├── engine_tts.py                   # onnxruntime Piper TTS audio pipeline
│   ├── hardware.py                     # Metal GPU, RAM, & Thermal watchdog
│   └── requirements.txt
├── frontend/                           # React + Vite + Three.js GUI
│   ├── package.json
│   ├── vite.config.ts
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── Canvas3D.tsx            # Three.js 3D Anime Scene & Lighting
│   │   │   ├── Character.tsx           # Procedural / GLTF anime humanoid avatar
│   │   │   ├── SettingsModal.tsx       # Top-left glassmorphic configuration panel
│   │   │   ├── DiagnosticBar.tsx       # Hardware, STT, LLM, TTS status indicators
│   │   │   ├── SubtitleOverlay.tsx     # Clean cinematic live conversation captioning
│   │   │   └── AudioVisualizer.tsx     # Frequency reactivity during speech
│   │   ├── hooks/
│   │   │   ├── useVoiceLoop.ts         # Voice Activity Detection (VAD) loop
│   │   │   └── useLloydSocket.ts       # WebSocket / Streaming IPC client
│   │   └── styles/
│   │       └── index.css
│   └── public/
└── scripts/
├── dev.sh                          # One-click startup for backend & frontend
└── build_mac.sh                    # Automated packager into macOS .app bundle
---

## 4. DETAILED ENGINE SPECIFICATIONS (BACKEND)

### 4.1. LLM Thinking Engine (`backend/engine_llm.py`)
- Engine: `llama_cpp.Llama` with Apple Silicon Metal acceleration (`n_gpu_layers=-1` to offload all layers to Apple Unified Memory).
- Context Window: 4096 tokens, temperature: 0.7, top_p: 0.9, repeat_penalty: 1.15.
- Streaming: Must yield tokens incrementally via a streaming response or WebSocket generator to enable pipeline parallelism (feeding completed sentences to TTS before the LLM finishes generating the entire response).
- Context Assembly: Prepend `system_prompt.txt` to every generation turn, followed by the rolling 10-turn conversation history.

### 4.2. Speech-to-Text Engine (`backend/engine_stt.py`)
- Engine: `pywhispercpp` or `whisper.cpp` Python bindings pointing to `/Users/mustafaeneskayaci/Documents/coding_projects/Lloyd/m4s/ggml-tiny.en.bin`.
- Voice Activity Detection (VAD): Integrate `webrtcvad` or `silero-vad` to dynamically detect speech onset and pause termination (silence threshold: 800ms).
- Stream Flow: Captures raw audio at 16kHz mono, pushes audio chunk to Whisper when silence is confirmed, and emits the transcribed text immediately to the LLM queue.

### 4.3. Text-to-Speech Engine (`backend/engine_tts.py`)
- Engine: `onnxruntime` utilizing the Piper ONNX model `/Users/mustafaeneskayaci/Documents/coding_projects/Lloyd/m4s/en_US-lessac-medium.onnx` and its companion JSON configuration.
- Synthesize stream: Convert LLM text chunks into 22050Hz raw PCM audio, chunking at punctuation boundaries (`.`, `!`, `?`).
- Output: Stream audio buffers over WebSocket to the front-end for immediate low-latency playback via the Web Audio API, while simultaneously providing amplitude data to drive character facial expressions.

### 4.4. Diagnostic Self-Check Protocol
At application startup, the backend must execute an automated diagnostic verification routine checking:
1. Integrity of the `.gguf` file and successful allocation of Metal GPU layers.
2. Whisper binary responsiveness by transcribing a synthetic silent audio test buffer.
3. Piper ONNX load verification by synthesizing a silent 0.5s audio pulse.
4. Active presence and permission validation for `system_prompt.txt`.
Expose this health status via a `/api/health` endpoint returning detailed JSON metrics.

---

## 5. 3D VISUAL SIMULATION & ANIME AVATAR (FRONTEND)

### 5.1. The 3D Anime Companion (`frontend/src/components/Character.tsx`)
- Character Aesthetic: Create or load a stylized 3D anime-style character. If no `.vrm` or `.gltf` model exists locally, procedurally construct a polished, stylized anime humanoid aesthetic using Three.js primitives (custom toon-shaded materials, cell shading outline pass, vibrant stylized hair, expressive eyes, and dynamic floating energy accents).
- Animation State Machine:
  - `IDLE`: Subtle breathing, procedural head tilt, slight tracking toward cursor coordinates, random eye blinks every 3-6 seconds.
  - `LISTENING`: Character perks up, head cocks slightly, eyes widen, dynamic glowing ring pulses at the base of the character.
  - `THINKING`: Character glances upward or ponders, subtle floating particle ring orbits the avatar.
  - `SPEAKING`: Real-time jaw and mouth morphing driven directly by incoming Web Audio API playback volume/frequency bins; expressive hand or body gestures synced to voice cadence.

### 5.2. Virtual Environment & Atmosphere (`frontend/src/components/Canvas3D.tsx`)
- High-tech, cozy, minimalist cyber-loft / neon-shaded digital simulation room.
- Dynamic lighting: Soft directional key light, subtle colored rim light (cyan/magenta anime cyber aesthetic), and screen-space ambient occlusion (SSAO) or soft shadows.
- Camera: Orbit controls with smooth damping, clamped rotation angles to keep Lloyd framed aesthetically in the center-right of the viewport.

---

## 6. USER INTERFACE & INTERACTION DESIGN

### 6.1. Top-Left Settings Modal
Position a sleek, frosted-glass (macOS vibrancy blur) icon button in the top-left corner (`Settings`). Clicking it opens a modular panel featuring:
- Model Diagnostic Dashboard: Live checkmarks indicating healthy operational status for LLM, STT, and TTS.
- Persona Inspector: A read-only preview of `system_prompt.txt` confirming Enes's authorship and behavioral constraints.
- Hardware Monitor: Live Apple Silicon resource meters (RAM footprint, GPU layer offloading status, average inference latency in milliseconds).
- Voice Input Mode Switch: Toggle between `Continuous Voice Loop (Hands-Free VAD)` and `Push-to-Talk (Spacebar Hold)`.

### 6.2. In-Game Dialogue & Subtitle Bar
- Place a non-intrusive, typography-focused subtitle bar at the bottom center of the screen.
- Render incoming words with a smooth typewriter or opacity fade-in effect.
- Include a manual text input field for quiet typing when speech input is not preferred.

---

## 7. EXECUTION & PACKAGING STEPS

1. Generate all backend Python files (`app.py`, `engine_llm.py`, `engine_stt.py`, `engine_tts.py`) with error handling, verifying file existence before attempting to mount models.
2. Scaffold the React + Vite + Three.js frontend with Tailwind CSS and Lucide icons.
3. Provide a master launch script (`scripts/dev.sh`) that initializes Python virtual environment, installs dependencies (`pip install llama-cpp-python onnxruntime sounddevice pywhispercpp fastapi uvicorn websockets`), starts the inference daemon on `localhost:8000`, and launches the Vite client.
4. Ensure zero external cloud API dependencies. The entire system must function disconnected from Wi-Fi once packages are installed.

Write clean, modular, production-ready code with complete file implementations. No placeholders, no skipped functions. Begin generating the codebase now.