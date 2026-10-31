#!/usr/bin/env bash
# ============================================================================
# PROJECT LLOYD — ONE-CLICK LOCAL DEVELOPMENT LAUNCHER (macOS Apple Silicon)
# Engineered by Mustafa Enes Kayaci (Enes)
# ============================================================================
set -euo pipefail

PROJECT_ROOT="/Users/mustafaeneskayaci/Documents/coding_projects/Lloyd"
M4S_DIR="${PROJECT_ROOT}/m4s"
VENV_DIR="${PROJECT_ROOT}/.venv"
BACKEND_DIR="${PROJECT_ROOT}/backend"
FRONTEND_DIR="${PROJECT_ROOT}/frontend"

export PATH="/opt/homebrew/bin:/usr/local/bin:${PATH}"

echo "=================================================================="
echo "  LLOYD // LOCAL 3D APPLE SILICON AI COMPANION"
echo "  Creator: Mustafa Enes Kayaci (Enes)"
echo "=================================================================="

# 1. Verify mandatory local model assets in m4s/
REQUIRED_FILES=(
  "${M4S_DIR}/qwen2.5-1.5b-instruct-q4_k_m.gguf"
  "${M4S_DIR}/ggml-tiny.en.bin"
  "${M4S_DIR}/en_US-lessac-medium.onnx"
  "${M4S_DIR}/en_US-lessac-medium.onnx.json"
  "${M4S_DIR}/system_prompt.txt"
)

for f in "${REQUIRED_FILES[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "[ERROR] Missing required model asset: $f"
    exit 1
  fi
done
echo "[OK] Verified all 5 local neural assets in ${M4S_DIR}"

# 2. Initialize & activate Python virtual environment
PYTHON_BIN="/opt/homebrew/bin/python3.12"
if [[ ! -x "${PYTHON_BIN}" ]]; then
  PYTHON_BIN="$(command -v python3)"
fi

if [[ ! -d "${VENV_DIR}" ]]; then
  echo "[INFO] Creating Python virtual environment at ${VENV_DIR}..."
  "${PYTHON_BIN}" -m venv "${VENV_DIR}"
fi

# shellcheck disable=SC1091
source "${VENV_DIR}/bin/activate"

# Verify core Python packages; install if missing
if ! python -c "import llama_cpp, onnxruntime, pywhispercpp, fastapi, uvicorn, websockets" >/dev/null 2>&1; then
  echo "[INFO] Installing Python inference dependencies with Apple Silicon Metal acceleration..."
  CMAKE_ARGS="-DGGML_METAL=on" pip install --upgrade pip
  CMAKE_ARGS="-DGGML_METAL=on" pip install llama-cpp-python onnxruntime sounddevice pywhispercpp fastapi "uvicorn[standard]" websockets webrtcvad-wheels psutil numpy python-multipart
fi

# 3. Verify frontend node_modules
cd "${FRONTEND_DIR}"
if [[ ! -d "node_modules" ]]; then
  echo "[INFO] Installing frontend packages..."
  npm install
  if [[ -f "node_modules/esbuild/install.js" ]]; then
    node node_modules/esbuild/install.js
  fi
fi

# Cleanup child processes on exit
BACKEND_PID=""
FRONTEND_PID=""
cleanup() {
  echo ""
  echo "[INFO] Shutting down Lloyd services..."
  [[ -n "${FRONTEND_PID}" ]] && kill "${FRONTEND_PID}" 2>/dev/null || true
  [[ -n "${BACKEND_PID}" ]] && kill "${BACKEND_PID}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# 4. Launch Backend Inference Daemon on localhost:8000
echo "[INFO] Starting FastAPI Metal Inference Daemon on http://127.0.0.1:8000 ..."
cd "${BACKEND_DIR}"
"${VENV_DIR}/bin/python" app.py &
BACKEND_PID=$!

# 5. Launch Vite React + Three.js Client on localhost:5173
echo "[INFO] Starting Vite 3D Frontend on http://127.0.0.1:5173 ..."
cd "${FRONTEND_DIR}"
npm run dev &
FRONTEND_PID=$!

echo "=================================================================="
echo "  Lloyd is live at: http://127.0.0.1:5173"
echo "  Health Endpoint : http://127.0.0.1:8000/api/health"
echo "  Press Ctrl+C to stop all services."
echo "=================================================================="

wait
