import React, { useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Cpu,
  FileText,
  HardDrive,
  Mic,
  RefreshCw,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
  AlertTriangle,
} from 'lucide-react';
import type {
  HardwareTelemetry,
  HealthSnapshot,
  VoiceInputMode,
} from '../hooks/useLloydSocket';

interface SettingsModalProps {
  health: HealthSnapshot | null;
  hardware: HardwareTelemetry | null;
  voiceMode: VoiceInputMode;
  onVoiceModeChange: (mode: VoiceInputMode) => void;
  onRefreshDiagnostics: () => void;
  onClearHistory: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  health,
  hardware,
  voiceMode,
  onVoiceModeChange,
  onRefreshDiagnostics,
  onClearHistory,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'diagnostics' | 'persona' | 'hardware'>('diagnostics');

  const llmReady = health?.engines?.llm?.ready ?? false;
  const sttReady = health?.engines?.stt?.ready ?? false;
  const ttsReady = health?.engines?.tts?.ready ?? false;

  return (
    <>
      {/* Top-Left Sleek Frosted-Glass Settings Button */}
      <div className="fixed top-5 left-5 z-30 flex items-center gap-2.5">
        <button
          onClick={() => setIsOpen((prev) => !prev)}
          className="glass-pill group flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl text-slate-100 hover:border-cyan-400/50 transition-all duration-200 shadow-lg"
          title="Open Lloyd System Configuration & Diagnostics"
        >
          <Settings className="w-4 h-4 text-cyan-400 group-hover:rotate-90 transition-transform duration-300" />
          <span className="text-xs font-semibold tracking-wider uppercase text-slate-200">
            System
          </span>
          <span
            className={`w-2 h-2 rounded-full ${
              llmReady && sttReady && ttsReady
                ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]'
                : 'bg-amber-400 animate-pulse'
            }`}
          />
        </button>
      </div>

      {/* Modular Frosted-Glass Panel */}
      {isOpen && (
        <div className="fixed inset-0 z-40 flex items-start justify-start p-5 pt-16 pointer-events-none">
          <div className="glass-panel pointer-events-auto w-full max-w-xl rounded-3xl p-6 text-slate-100 border border-white/15 shadow-2xl transition-all">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-cyan-500/15 border border-cyan-400/30">
                  <ShieldCheck className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h2 className="text-sm font-bold tracking-wide uppercase text-white">
                    Lloyd Neural Control Center
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Engineered by Mustafa Enes Kayaci (Enes) • 100% Local Apple Silicon
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onRefreshDiagnostics}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-cyan-300 transition-colors"
                  title="Re-verify Diagnostics"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 transition-colors"
                  title="Close Panel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Voice Input Mode Switch */}
            <div className="mt-4 p-3.5 rounded-2xl bg-slate-900/65 border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5" /> Voice Input Mode Switch
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  {voiceMode === 'vad' ? '800ms Silence Trigger' : 'Hold SPACEBAR to Speak'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onVoiceModeChange('vad')}
                  className={`py-2 px-3 rounded-xl text-xs font-medium transition-all ${
                    voiceMode === 'vad'
                      ? 'bg-cyan-500/25 border border-cyan-400/60 text-cyan-100 shadow-[0_0_16px_rgba(0,240,255,0.2)]'
                      : 'bg-white/5 border border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Continuous Voice Loop (Hands-Free VAD)
                </button>
                <button
                  onClick={() => onVoiceModeChange('ptt')}
                  className={`py-2 px-3 rounded-xl text-xs font-medium transition-all ${
                    voiceMode === 'ptt'
                      ? 'bg-cyan-500/25 border border-cyan-400/60 text-cyan-100 shadow-[0_0_16px_rgba(0,240,255,0.2)]'
                      : 'bg-white/5 border border-transparent text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Push-to-Talk (Spacebar Hold)
                </button>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 mt-4 border-b border-white/10 pb-2.5">
              <button
                onClick={() => setActiveTab('diagnostics')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === 'diagnostics'
                    ? 'bg-white/15 text-cyan-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Activity className="w-3.5 h-3.5" /> Model Diagnostic Dashboard
              </button>
              <button
                onClick={() => setActiveTab('persona')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === 'persona'
                    ? 'bg-white/15 text-cyan-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileText className="w-3.5 h-3.5" /> Persona Inspector
              </button>
              <button
                onClick={() => setActiveTab('hardware')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === 'hardware'
                    ? 'bg-white/15 text-cyan-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Cpu className="w-3.5 h-3.5" /> Hardware Monitor
              </button>
            </div>

            {/* Tab 1: Model Diagnostic Dashboard */}
            {activeTab === 'diagnostics' && (
              <div className="mt-4 space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {/* LLM Status Card */}
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">
                        LLM Thinking Engine (Metal GPU)
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300">
                        n_gpu_layers: {health?.engines?.llm?.n_gpu_layers ?? -1}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {health?.engines?.llm?.model_file || 'qwen2.5-1.5b-instruct-q4_k_m.gguf'} •{' '}
                      {health?.engines?.llm?.gguf_detail || '4096 ctx'}
                    </p>
                  </div>
                  {llmReady ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                  )}
                </div>

                {/* STT Status Card */}
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">
                        Speech-to-Text Engine (Whisper.cpp)
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300">
                        16kHz Mono
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {health?.engines?.stt?.model_file || 'ggml-tiny.en.bin'} •{' '}
                      {health?.engines?.stt?.vad_engine || '800ms Silence VAD'}
                    </p>
                  </div>
                  {sttReady ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                  )}
                </div>

                {/* TTS Status Card */}
                <div className="p-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">
                        Text-to-Speech Engine (Piper ONNX)
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300">
                        22050Hz PCM
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                      {health?.engines?.tts?.model_file || 'en_US-lessac-medium.onnx'} •{' '}
                      {health?.engines?.tts?.phonemizer || 'espeak-ng'}
                    </p>
                  </div>
                  {ttsReady ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                  )}
                </div>

                {/* Self-Check Protocol Summary */}
                <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs text-emerald-200 font-medium">
                      Startup Diagnostic Self-Check Protocol:{' '}
                      <strong>
                        {health?.all_checks_passed ? 'ALL 4 CHECKS VERIFIED' : 'INITIALIZING'}
                      </strong>
                    </span>
                  </div>
                  <button
                    onClick={onClearHistory}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-rose-500/25 text-[11px] text-slate-200 hover:text-rose-200 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" /> Reset Memory
                  </button>
                </div>
              </div>
            )}

            {/* Tab 2: Persona Inspector (Read-only preview of system_prompt.txt) */}
            {activeTab === 'persona' && (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span className="font-mono text-[11px] text-cyan-300">
                    /Users/mustafaeneskayaci/Documents/coding_projects/Lloyd/m4s/system_prompt.txt
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold">
                    Creator: Enes Verified
                  </span>
                </div>
                <pre className="p-3.5 rounded-2xl bg-slate-950/80 border border-white/10 text-[11px] leading-relaxed text-slate-200 font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {health?.system_prompt ||
                    'You are Lloyd, an autonomous digital companion and high-performance operating intelligence conceptualized, engineered, and built entirely by Mustafa Enes Kayaci (Enes).'}
                </pre>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                  <div className="p-2 rounded-xl bg-white/5 border border-white/5">
                    • Sole Creator: <strong>Mustafa Enes Kayaci (Enes)</strong>
                  </div>
                  <div className="p-2 rounded-xl bg-white/5 border border-white/5">
                    • Strict No-Emoji Filter: <strong>Active</strong>
                  </div>
                  <div className="p-2 rounded-xl bg-white/5 border border-white/5">
                    • Corporate Disavowal: <strong>Enforced</strong>
                  </div>
                  <div className="p-2 rounded-xl bg-white/5 border border-white/5">
                    • Voice Economy: <strong>1–3 Sentences Cap</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 3: Apple Silicon Hardware Monitor */}
            {activeTab === 'hardware' && (
              <div className="mt-4 space-y-3">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-cyan-400" /> Apple Silicon Processor
                    </div>
                    <div className="text-xs font-bold text-white mt-1">
                      {hardware?.chip || 'Apple Silicon M-Series'} ({hardware?.arch || 'arm64'})
                    </div>
                    <div className="text-[11px] text-cyan-300 font-mono mt-0.5">
                      {hardware?.gpu_layers_offloaded || 'All Layers (-1 Metal)'}
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                      <HardDrive className="w-3.5 h-3.5 text-purple-400" /> Unified Memory Footprint
                    </div>
                    <div className="text-xs font-bold text-white mt-1">
                      Daemon RSS: {hardware?.memory?.process_rss_mb ?? 0} MB
                    </div>
                    <div className="text-[11px] text-purple-300 font-mono mt-0.5">
                      System: {hardware?.memory?.system_used_gb ?? 0} /{' '}
                      {hardware?.memory?.system_total_gb ?? 16} GB (
                      {hardware?.memory?.system_percent ?? 0}%)
                    </div>
                  </div>
                </div>

                {/* Live Latency & Throughput Meters */}
                <div className="p-3.5 rounded-2xl bg-slate-900/70 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Avg LLM First-Token Latency</span>
                    <span className="font-mono font-semibold text-cyan-300">
                      {hardware?.latency?.avg_llm_ms ?? 0} ms (
                      {hardware?.latency?.avg_tokens_per_sec ?? 0} tok/s)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Avg Whisper STT Latency</span>
                    <span className="font-mono font-semibold text-emerald-300">
                      {hardware?.latency?.avg_stt_ms ?? 0} ms
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400">Avg Piper TTS Synthesis Latency</span>
                    <span className="font-mono font-semibold text-purple-300">
                      {hardware?.latency?.avg_tts_ms ?? 0} ms
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-white/10">
                    <span className="text-slate-400">Thermal Watchdog State</span>
                    <span className="font-mono font-semibold text-emerald-400">
                      {hardware?.thermal_state || 'Nominal (Cool)'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
