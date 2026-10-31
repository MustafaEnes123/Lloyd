# MISSION BRIEF: PROJECT LLOYD - V2 POLISH, ONBOARDING INSTALLER & NEURAL UI OVERHAUL

## 1. OBJECTIVE & CORE REQUIREMENTS
Lloyd is being upgraded to a production-ready, consumer-grade desktop application for macOS (Apple Silicon).
Target Repository: https://github.com/MustafaEnes123/Lloyd
License: MIT License (authored by Mustafa Enes Kayaci / Enes).

We need to resolve three primary challenges:
1. Portable Zero-Config DMG Installation: The .dmg bundle distributed to other Macs MUST NOT bundle massive 1GB+ models directly inside the binary. Instead, on first launch, Lloyd must detect missing models in `~/Library/Application Support/Lloyd/models` (or fallback to local `./m4s`), display an ultra-sleek onboarding download screen, stream all verified weights directly with progress percentages, and verify SHA-256 hashes before entering the world.
2. Google Gemini-Inspired Neural Expressive UI: Redesign the user interface using organic, fluid glassmorphism, dynamic glowing ambient backdrops, pill-shaped tactile buttons, smooth micro-interactions, and a bespoke geometric neural spark logo.
3. Character Appearance Customization: Add an interactive styling engine allowing Enes to customize Lloyd's aesthetic (hair color, eye luminescence, cyber-accents, outfit shading, and aura lighting) in real time.

---

## 2. AUTOMATED ONBOARDING & ASSET DOWNLOAD PIPELINE
Implement a dedicated download manager and runtime initialization hook (`frontend/src/components/OnboardingModal.tsx` and `backend/downloader.py`).

### Asset Manifest (Direct Cloud URLs):
1. LLM Brain: `qwen2.5-1.5b-instruct-q4_k_m.gguf` (~986 MB)
   URL: `https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf`
2. Speech-to-Text: `ggml-tiny.en.bin` (~75 MB)
   URL: `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en.bin`
3. Text-to-Speech: `en_US-lessac-medium.onnx` (~60 MB) and its `.onnx.json` config (~5 KB)
   URL: `https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx`
   URL: `https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json`
4. System Prompt: Automatically seed `system_prompt.txt` if missing, upholding strict attribution to Mustafa Enes Kayaci (Enes).

### Onboarding Screen Experience:
- Glassmorphic setup wizard showing step-by-step progress bars, speed telemetry (MB/s), and estimated time remaining.
- Visual status pills for STT, LLM, and TTS with organic pulse animations.
- Once downloaded, automatically trigger the backend self-check and seamlessly transition the camera into the 3D cyber-loft room.

---

## 3. DESIGN SYSTEM: NEURAL EXPRESSIVE LANGUAGE & LOGO
Elevate the UI from utility to premium consumer art:
- Application Logo: Construct a multi-layered, glowing SVG icon representing a four-pointed star / neural spark merging organic curves with futuristic cyber geometry, incorporating gradient blends of electric cyan (#00F2FE), neural violet (#4FACFE), and deep obsidian.
- Floating Glass Navigation: Replace blocky containers with floating frosted glass panels (`backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl`).
- Tactile Buttons: Use subtle hover spring physics, gradient borders, glowing drop shadows, and refined typography (Inter / SF Pro Display style).
- Subtitle & Dialogue Pill: Refactor the speech subtitle into an organic, floating bottom dock with an integrated live audio waveform visualizer.

---

## 4. CHARACTER CUSTOMIZATION ENGINE
Expand `frontend/src/components/Character.tsx` to accept a reactive configuration state (`CharacterCustomizationState`):
- Hair Palette: Silver, Obsidian, Cyber Cyan, Sakura Pink, Electric Gold.
- Eye Luminescence & Core Shimmer: Configurable glow intensities and iris color tones.
- Outfit & Accent Color: Real-time update of cel-shaded material uniforms and inverted-hull outline shaders.
- Ambient Aura Ring: Switchable color trails and telemetry ring frequencies.
- Persist user customization choices locally via `localStorage`.

---

## 5. SETTINGS PANEL & CLEAN USER FLOW
Refactor `SettingsModal.tsx`:
- Tab 1: Appearance (Live color pickers for Lloyd's character mesh and room lighting).
- Tab 2: System & Persona (Author attribution display for Enes, model information, system prompt view).
- Tab 3: Hardware & Diagnostics (Live RAM/Metal GPU stats, speech latency metrics, Push-to-Talk vs. Hands-Free toggle).
- Tab 4: Storage & Models (Option to re-verify or purge model weights).

---

## 6. PACKAGING & DISTRIBUTION SCRIPT ENHANCEMENT
Update `scripts/build_mac.sh`:
- Package Lloyd into a lightweight, clean `.dmg` installer without hardcoding the 1.1GB model binaries into the package payload.
- Configure background drag-and-drop installer window (`Lloyd.app -> /Applications`).
- Ensure the app writes models to the user's standard application support directory (`~/Library/Application Support/Lloyd/`) with correct sandbox permissions.

Implement all updated components cleanly across backend and frontend, update styles, and test the full flow.