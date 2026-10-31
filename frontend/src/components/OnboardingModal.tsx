import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  CloudDownload,
  Cpu,
  HardDrive,
  Loader2,
  Radio,
  ShieldCheck,
  Sparkles,
  Volume2,
  Zap,
} from 'lucide-react';
import { NeuralSparkLogo } from './NeuralSparkLogo';

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

interface AssetProgressState {
  id: string;
  filename: string;
  category: 'LLM' | 'STT' | 'TTS';
  label: string;
  percent: number;
  bytesDownloaded: number;
  totalBytes: number;
  stage: 'pending' | 'streaming' | 'downloading' | 'verified';
  sha256Verified: boolean;
}

const INITIAL_ASSETS: AssetProgressState[] = [
  {
    id: 'llm_qwen_gguf',
    filename: 'qwen2.5-1.5b-instruct-q4_k_m.gguf',
    category: 'LLM',
    label: 'LLM Neural Brain (1.04 GB)',
    percent: 0,
    bytesDownloaded: 0,
    totalBytes: 1117320736,
    stage: 'pending',
    sha256Verified: false,
  },
  {
    id: 'stt_whisper_bin',
    filename: 'ggml-tiny.en.bin',
    category: 'STT',
    label: 'Whisper Acoustic STT (74.1 MB)',
    percent: 0,
    bytesDownloaded: 0,
    totalBytes: 77704715,
    stage: 'pending',
    sha256Verified: false,
  },
  {
    id: 'tts_piper_onnx',
    filename: 'en_US-lessac-medium.onnx',
    category: 'TTS',
    label: 'Piper Neural Voice ONNX (60.3 MB)',
    percent: 0,
    bytesDownloaded: 0,
    totalBytes: 63201294,
    stage: 'pending',
    sha256Verified: false,
  },
  {
    id: 'tts_piper_json',
    filename: 'en_US-lessac-medium.onnx.json',
    category: 'TTS',
    label: 'Piper Phoneme Config (4.9 KB)',
    percent: 0,
    bytesDownloaded: 0,
    totalBytes: 4885,
    stage: 'pending',
    sha256Verified: false,
  },
];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onComplete,
}) => {
  const [assets, setAssets] = useState<AssetProgressState[]>(INITIAL_ASSETS);
  const [overallPercent, setOverallPercent] = useState<number>(0);
  const [speedMbps, setSpeedMbps] = useState<number>(0);
  const [etaSeconds, setEtaSeconds] = useState<number>(0);
  const [targetDir, setTargetDir] = useState<string>(
    '~/Library/Application Support/Lloyd/models'
  );
  const [phase, setPhase] = useState<
    'idle' | 'downloading' | 'self_check' | 'complete' | 'error'
  >('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const startProvisioning = useCallback(
    async (preferCloud = false) => {
      setPhase('downloading');
      setErrorMessage(null);
      setOverallPercent(0);
      setAssets(INITIAL_ASSETS);

      try {
        const response = await fetch('http://127.0.0.1:8000/api/models/download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prefer_cloud: preferCloud }),
        });

        if (!response.ok || !response.body) {
          throw new Error(`HTTP ${response.status}: Failed to start onboarding stream`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            const event = JSON.parse(trimmed);

            if (event.type === 'onboarding_start') {
              if (event.target_dir) setTargetDir(event.target_dir);
            } else if (event.type === 'asset_start') {
              setAssets((prev) =>
                prev.map((a) =>
                  a.id === event.id ? { ...a, stage: 'streaming' } : a
                )
              );
            } else if (event.type === 'asset_progress') {
              if (typeof event.overall_percent === 'number') {
                setOverallPercent(event.overall_percent);
              }
              if (typeof event.speed_mbps === 'number') {
                setSpeedMbps(event.speed_mbps);
              }
              if (typeof event.eta_seconds === 'number') {
                setEtaSeconds(event.eta_seconds);
              }
              setAssets((prev) =>
                prev.map((a) =>
                  a.id === event.id
                    ? {
                        ...a,
                        percent: event.percent ?? a.percent,
                        bytesDownloaded: event.bytes_downloaded ?? a.bytesDownloaded,
                        totalBytes: event.total_bytes ?? a.totalBytes,
                        stage: event.stage === 'verified' ? 'verified' : 'downloading',
                        sha256Verified:
                          event.stage === 'verified' ? true : a.sha256Verified,
                      }
                    : a
                )
              );
            } else if (event.type === 'asset_verified') {
              if (typeof event.overall_percent === 'number') {
                setOverallPercent(event.overall_percent);
              }
              setAssets((prev) =>
                prev.map((a) =>
                  a.id === event.id
                    ? {
                        ...a,
                        percent: 100,
                        stage: 'verified',
                        sha256Verified: Boolean(event.sha256_match),
                      }
                    : a
                )
              );
            } else if (event.type === 'self_check_start') {
              setPhase('self_check');
              setOverallPercent(100);
            } else if (event.type === 'self_check_complete') {
              setPhase('complete');
              window.setTimeout(() => {
                onComplete();
              }, 900);
            } else if (event.type === 'onboarding_error') {
              setPhase('error');
              setErrorMessage(event.error || 'Asset verification failed');
            }
          }
        }
      } catch (err) {
        setPhase('error');
        setErrorMessage(
          err instanceof Error ? err.message : 'Network error during model setup'
        );
      }
    },
    [onComplete]
  );

  // Automatically begin onboarding verification when opened in idle state
  useEffect(() => {
    if (isOpen && phase === 'idle') {
      startProvisioning(false);
    }
  }, [isOpen, phase, startProvisioning]);

  if (!isOpen) return null;

  const llmDone = assets.find((a) => a.category === 'LLM')?.sha256Verified ?? false;
  const sttDone = assets.find((a) => a.category === 'STT')?.sha256Verified ?? false;
  const ttsDone = assets
    .filter((a) => a.category === 'TTS')
    .every((a) => a.sha256Verified);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#050814]/85 backdrop-blur-2xl">
      {/* Ambient Gemini-Inspired Radial Glow Backdrops */}
      <div className="absolute -top-32 left-1/4 w-96 h-96 rounded-full bg-cyan-500/15 blur-[130px] pointer-events-none" />
      <div className="absolute -bottom-32 right-1/4 w-96 h-96 rounded-full bg-indigo-500/20 blur-[130px] pointer-events-none" />

      <div className="glass-panel relative w-full max-w-2xl rounded-3xl p-8 border border-white/15 shadow-2xl space-y-6">
        {/* Header with Neural Spark Logo */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-2.5 rounded-2xl bg-white/5 border border-cyan-400/30 shadow-[0_0_24px_rgba(0,242,254,0.2)]">
              <NeuralSparkLogo size={42} animated />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white">
                  LLOYD NEURAL ONBOARDING
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                  Apple Silicon Metal
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Engineered by Mustafa Enes Kayaci (Enes) • Zero-Cloud Local Intelligence
              </p>
            </div>
          </div>

          <div className="text-right font-mono">
            <div className="text-2xl font-bold neural-gradient-text">
              {Math.round(overallPercent)}%
            </div>
            <div className="text-[11px] text-slate-400">
              {speedMbps > 0 ? `${speedMbps} MB/s` : 'Verifying'} •{' '}
              {etaSeconds > 0 ? `ETA ${etaSeconds}s` : 'Ready'}
            </div>
          </div>
        </div>

        {/* Visual Status Pills for LLM, STT, TTS with Organic Pulse Animations */}
        <div className="grid grid-cols-3 gap-3">
          <div
            className={`glass-pill p-3 rounded-2xl flex items-center justify-between border transition-all ${
              llmDone
                ? 'border-emerald-400/50 bg-emerald-500/10'
                : 'border-cyan-400/30 animate-neural-pulse'
            }`}
          >
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              <div>
                <div className="text-xs font-bold text-white">LLM BRAIN</div>
                <div className="text-[10px] text-slate-400 font-mono">Metal Q4_K_M</div>
              </div>
            </div>
            {llmDone ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
            )}
          </div>

          <div
            className={`glass-pill p-3 rounded-2xl flex items-center justify-between border transition-all ${
              sttDone
                ? 'border-emerald-400/50 bg-emerald-500/10'
                : 'border-cyan-400/30 animate-neural-pulse'
            }`}
          >
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-400" />
              <div>
                <div className="text-xs font-bold text-white">STT EARS</div>
                <div className="text-[10px] text-slate-400 font-mono">16kHz VAD</div>
              </div>
            </div>
            {sttDone ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
            )}
          </div>

          <div
            className={`glass-pill p-3 rounded-2xl flex items-center justify-between border transition-all ${
              ttsDone
                ? 'border-emerald-400/50 bg-emerald-500/10'
                : 'border-cyan-400/30 animate-neural-pulse'
            }`}
          >
            <div className="flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-purple-400" />
              <div>
                <div className="text-xs font-bold text-white">TTS VOICE</div>
                <div className="text-[10px] text-slate-400 font-mono">22.05kHz ONNX</div>
              </div>
            </div>
            {ttsDone ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            ) : (
              <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
            )}
          </div>
        </div>

        {/* Master Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span className="flex items-center gap-1.5 font-medium">
              <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
              Target Vault: <code className="text-cyan-300 font-mono">{targetDir}</code>
            </span>
            <span className="font-mono text-[11px] text-slate-400">
              SHA-256 Cryptographic Verification
            </span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-slate-900/90 overflow-hidden border border-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#00F2FE] via-[#4FACFE] to-[#8B5CF6] transition-all duration-200 shadow-[0_0_16px_#00F2FE]"
              style={{ width: `${Math.min(100, Math.max(3, overallPercent))}%` }}
            />
          </div>
        </div>

        {/* Individual Asset Rows */}
        <div className="space-y-2.5">
          {assets.map((asset) => (
            <div
              key={asset.id}
              className="p-3 rounded-2xl bg-white/[0.04] border border-white/10 space-y-1.5"
            >
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-white/10 text-[10px] font-mono font-bold text-cyan-300">
                    {asset.category}
                  </span>
                  <span className="font-medium text-slate-200">{asset.label}</span>
                </div>
                <div className="flex items-center gap-2 font-mono text-[11px]">
                  {asset.sha256Verified ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> SHA-256 OK
                    </span>
                  ) : (
                    <span className="text-cyan-300">{Math.round(asset.percent)}%</span>
                  )}
                </div>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-950 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-150 ${
                    asset.sha256Verified
                      ? 'bg-emerald-400'
                      : 'bg-gradient-to-r from-cyan-400 to-blue-500'
                  }`}
                  style={{ width: `${asset.percent}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Footer Status / Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-white/10">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            {phase === 'self_check' && (
              <>
                <Cpu className="w-4 h-4 text-cyan-400 animate-spin" />
                <span>Allocating Apple Silicon Metal GPU layers & running self-check...</span>
              </>
            )}
            {phase === 'complete' && (
              <>
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-300 font-semibold">
                  All neural weights verified! Entering 3D Cyber-Loft...
                </span>
              </>
            )}
            {phase === 'downloading' && (
              <>
                <CloudDownload className="w-4 h-4 text-cyan-400 animate-bounce" />
                <span>Provisioning local model vault & seeding Enes system prompt...</span>
              </>
            )}
            {phase === 'error' && (
              <span className="text-rose-400 font-medium">{errorMessage}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {phase === 'error' && (
              <button
                onClick={() => startProvisioning(false)}
                className="tactile-btn px-4 py-2 rounded-2xl bg-cyan-500/25 border border-cyan-400/50 text-xs font-semibold text-cyan-200"
              >
                Retry Verification
              </button>
            )}
            <button
              onClick={onComplete}
              className="tactile-btn px-4 py-2 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-semibold text-slate-200"
            >
              Enter Cyber-Loft
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
