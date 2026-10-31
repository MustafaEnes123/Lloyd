import React from 'react';
import { Cpu, Mic, MicOff, Radio, Volume2, Wifi, WifiOff, Zap } from 'lucide-react';
import type {
  CompanionState,
  HardwareTelemetry,
  HealthSnapshot,
  VoiceInputMode,
} from '../hooks/useLloydSocket';

interface DiagnosticBarProps {
  connected: boolean;
  companionState: CompanionState;
  health: HealthSnapshot | null;
  hardware: HardwareTelemetry | null;
  micEnabled: boolean;
  voiceMode: VoiceInputMode;
  onToggleMic: () => void;
  onInterrupt: () => void;
}

const STATE_BADGE_STYLES: Record<
  CompanionState,
  { label: string; dot: string; border: string; text: string }
> = {
  IDLE: {
    label: 'IDLE // STANDBY',
    dot: 'bg-cyan-400',
    border: 'border-cyan-400/35',
    text: 'text-cyan-300',
  },
  LISTENING: {
    label: 'LISTENING // VOICE CAPTURE',
    dot: 'bg-emerald-400 animate-ping',
    border: 'border-emerald-400/60',
    text: 'text-emerald-300',
  },
  THINKING: {
    label: 'THINKING // METAL INFERENCE',
    dot: 'bg-purple-400 animate-pulse',
    border: 'border-purple-400/60',
    text: 'text-purple-300',
  },
  SPEAKING: {
    label: 'SPEAKING // PIPER 22.05kHz',
    dot: 'bg-pink-400 animate-pulse',
    border: 'border-pink-400/60',
    text: 'text-pink-300',
  },
};

export const DiagnosticBar: React.FC<DiagnosticBarProps> = ({
  connected,
  companionState,
  health,
  hardware,
  micEnabled,
  voiceMode,
  onToggleMic,
  onInterrupt,
}) => {
  const badge = STATE_BADGE_STYLES[companionState];
  const llmOk = health?.engines?.llm?.ready ?? false;
  const sttOk = health?.engines?.stt?.ready ?? false;
  const ttsOk = health?.engines?.tts?.ready ?? false;

  return (
    <div className="fixed top-5 right-5 z-20 flex flex-wrap items-center gap-2.5">
      {/* Companion Animation State Pill */}
      <div
        className={`glass-pill flex items-center gap-2.5 px-3.5 py-2 rounded-2xl border ${badge.border}`}
      >
        <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
        <span className={`text-[11px] font-mono font-bold tracking-wider ${badge.text}`}>
          {badge.label}
        </span>
        {(companionState === 'SPEAKING' || companionState === 'THINKING') && (
          <button
            onClick={onInterrupt}
            className="ml-1 px-2 py-0.5 rounded-lg bg-white/10 hover:bg-rose-500/30 text-[10px] font-semibold text-slate-200 transition-colors"
            title="Stop / Interrupt Current Response"
          >
            STOP
          </button>
        )}
      </div>

      {/* Engine Status Indicators (LLM, STT, TTS, Metal) */}
      <div className="glass-pill hidden md:flex items-center gap-3 px-3.5 py-2 rounded-2xl text-[11px] font-mono">
        <div className="flex items-center gap-1.5" title="Metal GPU Offload">
          <Cpu className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-slate-300">METAL</span>
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              hardware?.metal_active !== false ? 'bg-emerald-400' : 'bg-rose-400'
            }`}
          />
        </div>

        <div className="h-3 w-px bg-white/10" />

        <div className="flex items-center gap-1.5" title="Llama.cpp Qwen 1.5B Engine">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-slate-300">LLM</span>
          <span className={`w-1.5 h-1.5 rounded-full ${llmOk ? 'bg-emerald-400' : 'bg-amber-400'}`} />
        </div>

        <div className="flex items-center gap-1.5" title="Whisper.cpp Tiny.en STT">
          <Radio className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-slate-300">STT</span>
          <span className={`w-1.5 h-1.5 rounded-full ${sttOk ? 'bg-emerald-400' : 'bg-amber-400'}`} />
        </div>

        <div className="flex items-center gap-1.5" title="Piper ONNX Lessac Medium TTS">
          <Volume2 className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-slate-300">TTS</span>
          <span className={`w-1.5 h-1.5 rounded-full ${ttsOk ? 'bg-emerald-400' : 'bg-amber-400'}`} />
        </div>

        <div className="h-3 w-px bg-white/10" />

        <div className="flex items-center gap-1 text-slate-400">
          {connected ? (
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <WifiOff className="w-3.5 h-3.5 text-rose-400" />
          )}
          <span>{hardware?.latency?.last_llm_ms ? `${hardware.latency.last_llm_ms}ms` : 'LOCAL'}</span>
        </div>
      </div>

      {/* Microphone Quick Toggle */}
      <button
        onClick={onToggleMic}
        className={`glass-pill flex items-center gap-2 px-3.5 py-2 rounded-2xl text-xs font-semibold transition-all ${
          micEnabled
            ? 'border-emerald-400/60 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.25)]'
            : 'border-white/15 text-slate-300 hover:border-cyan-400/40'
        }`}
        title={
          micEnabled
            ? `Microphone Active (${voiceMode === 'vad' ? 'Hands-Free VAD' : 'Push-to-Talk'})`
            : 'Click to Enable Microphone'
        }
      >
        {micEnabled ? (
          <>
            <Mic className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span>{voiceMode === 'vad' ? 'VAD ON' : 'MIC READY'}</span>
          </>
        ) : (
          <>
            <MicOff className="w-4 h-4 text-slate-400" />
            <span>MIC OFF</span>
          </>
        )}
      </button>
    </div>
  );
};
