import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  CloudDownload,
  Cpu,
  FileText,
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
  category: 'SYS' | 'LLM' | 'STT' | 'TTS';
  label: string;
  percent: number;
  bytesDownloaded: number;
  totalBytes: number;
  stage: 'pending' | 'streaming' | 'downloading' | 'verified';
  sha256Verified: boolean;
}

const INITIAL_ASSETS: AssetProgressState[] = [
  {
    id: 'system_prompt_txt',
    filename: 'system_prompt.txt',
    category: 'SYS',
    label: 'System Instructions Document (system_prompt.txt)',
    percent: 0,
    bytesDownloaded: 0,
    totalBytes: 1024,
    stage: 'pending',
    sha256Verified: false,
  },
  {
    id: 'llm_qwen_gguf',
    filename: 'qwen2.5-1.5b-instruct-q4_k_m.gguf',
    category: 'LLM',
    label: 'Local AI Reasoning Model (1.04 GB)',
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
    label: 'Whisper Acoustic Speech Engine (74.1 MB)',
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
    label: 'Piper Neural Voice Synthesizer (60.3 MB)',
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
    label: 'Phoneme Synthesis Configuration (4.9 KB)',
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
          throw new Error(`HTTP ${response.status}: Failed to start model installer`);
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
              setErrorMessage(event.error || 'Model installation failed');
            }
          }
        }
      } catch (err) {
        setPhase('error');
        setErrorMessage(
          err instanceof Error ? err.message : 'Network error during model installation'
        );
      }
    },
    [onComplete]
  );

  // Reset to idle whenever modal opens fresh, then automatically start installing
  useEffect(() => {
    if (!isOpen) {
      setPhase('idle');
      return;
    }
    if (phase === 'idle') {
      const timer = window.setTimeout(() => {
        startProvisioning(false);
      }, 600);
      return () => window.clearTimeout(timer);
    }
  }, [isOpen, phase, startProvisioning]);

  if (!isOpen) return null;

  const sysDone = assets.find((a) => a.category === 'SYS')?.sha256Verified ?? false;
  const llmDone = assets.find((a) => a.category === 'LLM')?.sha256Verified ?? false;
  const sttDone = assets.find((a) => a.category === 'STT')?.sha256Verified ?? false;
  const ttsDone = assets
    .filter((a) => a.category === 'TTS')
    .every((a) => a.sha256Verified);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-[#03050a]/85 backdrop-blur-2xl">
      <div className="glass-panel relative w-full max-w-xl rounded-[26px] p-7 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <NeuralSparkLogo size={40} animated />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-semibold tracking-tight text-white">
                  Local AI Model &amp; System Setup
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-sky-500/15 text-sky-300 border border-sky-400/30">
                  First-Launch Setup
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">
                We need to install the local AI model and system instructions onto your Mac so Lloyd can run 100% offline on Apple Silicon Metal.
              </p>
            </div>
          </div>

          <div className="text-right font-mono tabular-nums shrink-0">
            <div className="text-xl font-semibold text-white">
              {Math.round(overallPercent)}%
            </div>
            <div className="text-[11px] text-slate-400">
              {speedMbps > 0 ? `${speedMbps} MB/s` : 'Preparing'} ·{' '}
              {etaSeconds > 0 ? `${etaSeconds}s` : 'Active'}
            </div>
          </div>
        </div>

        {/* Subsystem Readiness Cards */}
        <div className="grid grid-cols-4 gap-2">
          <div
            className={`p-2.5 rounded-xl flex items-center justify-between border transition-all ${
              sysDone
                ? 'border-emerald-400/35 bg-emerald-500/10'
                : 'border-white/[0.08] bg-white/[0.03]'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <div>
                <div className="text-[11px] font-semibold text-white">Instructions</div>
                <div className="text-[9.5px] text-slate-400 font-mono">GitHub Sync</div>
              </div>
            </div>
            {sysDone ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : (
              <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin shrink-0" />
            )}
          </div>

          <div
            className={`p-2.5 rounded-xl flex items-center justify-between border transition-all ${
              llmDone
                ? 'border-emerald-400/35 bg-emerald-500/10'
                : 'border-white/[0.08] bg-white/[0.03]'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <div>
                <div className="text-[11px] font-semibold text-white">AI Brain</div>
                <div className="text-[9.5px] text-slate-400 font-mono">1.5B Metal</div>
              </div>
            </div>
            {llmDone ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : (
              <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin shrink-0" />
            )}
          </div>

          <div
            className={`p-2.5 rounded-xl flex items-center justify-between border transition-all ${
              sttDone
                ? 'border-emerald-400/35 bg-emerald-500/10'
                : 'border-white/[0.08] bg-white/[0.03]'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Radio className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <div>
                <div className="text-[11px] font-semibold text-white">Hearing</div>
                <div className="text-[9.5px] text-slate-400 font-mono">Whisper</div>
              </div>
            </div>
            {sttDone ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : (
              <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin shrink-0" />
            )}
          </div>

          <div
            className={`p-2.5 rounded-xl flex items-center justify-between border transition-all ${
              ttsDone
                ? 'border-emerald-400/35 bg-emerald-500/10'
                : 'border-white/[0.08] bg-white/[0.03]'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <div>
                <div className="text-[11px] font-semibold text-white">Voice</div>
                <div className="text-[9.5px] text-slate-400 font-mono">Piper ONNX</div>
              </div>
            </div>
            {ttsDone ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            ) : (
              <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin shrink-0" />
            )}
          </div>
        </div>

        {/* Master Progress Bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-slate-400" />
              Destination: <code className="text-slate-200 font-mono">{targetDir}</code>
            </span>
            <span className="font-mono">SHA-256 Verified</span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-black/60 overflow-hidden border border-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-400 transition-all duration-200"
              style={{ width: `${Math.min(100, Math.max(3, overallPercent))}%` }}
            />
          </div>
        </div>

        {/* Individual Asset Rows */}
        <div className="space-y-2">
          {assets.map((asset) => (
            <div
              key={asset.id}
              className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.07] space-y-1.5"
            >
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-mono font-medium text-slate-300">
                    {asset.category}
                  </span>
                  <span className="font-medium text-slate-200">{asset.label}</span>
                </div>
                <div className="flex items-center gap-2 font-mono text-[11px] tabular-nums">
                  {asset.sha256Verified ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> Installed
                    </span>
                  ) : (
                    <span className="text-slate-300">{Math.round(asset.percent)}%</span>
                  )}
                </div>
              </div>
              <div className="w-full h-1 rounded-full bg-black/50 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-150 ${
                    asset.sha256Verified ? 'bg-emerald-400' : 'bg-sky-400'
                  }`}
                  style={{ width: `${asset.percent}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-white/[0.08]">
          <div className="flex items-center gap-2 text-xs text-slate-300">
            {phase === 'idle' && (
              <>
                <CloudDownload className="w-3.5 h-3.5 text-sky-400" />
                <span>Starting local AI model &amp; instructions installer…</span>
              </>
            )}
            {phase === 'self_check' && (
              <>
                <Cpu className="w-3.5 h-3.5 text-sky-400 animate-spin" />
                <span>Mounting Metal GPU layers &amp; verifying neural engines…</span>
              </>
            )}
            {phase === 'complete' && (
              <>
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300 font-medium">
                  All models &amp; system instructions installed! Launching Lloyd…
                </span>
              </>
            )}
            {phase === 'downloading' && (
              <>
                <CloudDownload className="w-3.5 h-3.5 text-sky-400 animate-bounce" />
                <span>Installing AI model &amp; system instructions to your Mac…</span>
              </>
            )}
            {phase === 'error' && (
              <span className="text-rose-400 font-medium">{errorMessage}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {phase === 'error' && (
              <button
                onClick={() => startProvisioning(true)}
                className="tactile-btn px-3.5 py-1.5 rounded-xl bg-sky-500/20 border border-sky-400/40 text-xs font-semibold text-sky-200"
              >
                Retry Cloud Download
              </button>
            )}
            {phase === 'complete' && (
              <button
                onClick={onComplete}
                className="tactile-btn btn-primary-titanium px-4 py-1.5 rounded-xl text-xs font-semibold"
              >
                Enter Studio
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
