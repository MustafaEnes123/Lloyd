import React from 'react';
import {
  Camera,
  Cpu,
  Hand,
  Mic,
  MicOff,
  Smile,
  Sparkles,
  Square,
} from 'lucide-react';
import type {
  CompanionState,
  HardwareTelemetry,
  HealthSnapshot,
  VoiceInputMode,
} from '../hooks/useLloydSocket';
import type { RobotEmotion } from '../types/customization';

interface DiagnosticBarProps {
  connected: boolean;
  companionState: CompanionState;
  health: HealthSnapshot | null;
  hardware: HardwareTelemetry | null;
  micEnabled: boolean;
  voiceMode: VoiceInputMode;
  activeEmotion?: RobotEmotion;
  cameraPreset?: 'default' | 'closeup' | 'wide';
  onEmotionSelect?: (emotion: RobotEmotion) => void;
  onCameraPresetChange?: (preset: 'default' | 'closeup' | 'wide') => void;
  onToggleMic: () => void;
  onInterrupt: () => void;
}

const STATE_CONFIG: Record<
  CompanionState,
  { label: string; dot: string; badgeBg: string; text: string }
> = {
  IDLE: {
    label: 'Online',
    dot: 'bg-sky-400',
    badgeBg: 'border-white/10',
    text: 'text-slate-200',
  },
  LISTENING: {
    label: 'Listening',
    dot: 'bg-emerald-400 animate-ping',
    badgeBg: 'border-emerald-400/40 bg-emerald-500/10',
    text: 'text-emerald-200',
  },
  THINKING: {
    label: 'Reasoning',
    dot: 'bg-indigo-400 animate-pulse',
    badgeBg: 'border-indigo-400/40 bg-indigo-500/10',
    text: 'text-indigo-200',
  },
  SPEAKING: {
    label: 'Speaking',
    dot: 'bg-sky-400 animate-pulse',
    badgeBg: 'border-sky-400/40 bg-sky-500/10',
    text: 'text-sky-200',
  },
};

const EMOTION_OPTIONS: { id: RobotEmotion; label: string }[] = [
  { id: 'happy', label: 'Smile' },
  { id: 'excited', label: 'Joy' },
  { id: 'curious', label: 'Curious' },
  { id: 'wink', label: 'Wink' },
  { id: 'zen', label: 'Zen' },
];

export const DiagnosticBar: React.FC<DiagnosticBarProps> = ({
  connected,
  companionState,
  health,
  hardware,
  micEnabled,
  voiceMode,
  activeEmotion = 'happy',
  cameraPreset = 'default',
  onEmotionSelect,
  onCameraPresetChange,
  onToggleMic,
  onInterrupt,
}) => {
  const badge = STATE_CONFIG[companionState];
  const llmOk = health?.engines?.llm?.ready ?? false;
  const sttOk = health?.engines?.stt?.ready ?? false;
  const ttsOk = health?.engines?.tts?.ready ?? false;
  const allReady = llmOk && sttOk && ttsOk && connected;

  const cycleCamera = () => {
    if (!onCameraPresetChange) return;
    const order: ('default' | 'closeup' | 'wide')[] = ['default', 'closeup', 'wide'];
    const next = order[(order.indexOf(cameraPreset) + 1) % order.length];
    onCameraPresetChange(next);
  };

  return (
    <header className="fixed top-5 right-5 z-20 flex flex-wrap items-center gap-2">
      {/* Interactive Bot Expression Switcher */}
      {onEmotionSelect && (
        <div className="glass-pill hidden lg:flex items-center gap-0.5 p-1 rounded-full">
          <span className="flex items-center gap-1.5 pl-2.5 pr-2 text-[11px] font-medium text-slate-400">
            <Smile className="w-3.5 h-3.5 text-sky-400" />
            <span>Mood</span>
          </span>
          {EMOTION_OPTIONS.map((em) => {
            const isSelected = activeEmotion === em.id;
            return (
              <button
                key={em.id}
                onClick={() => onEmotionSelect(em.id)}
                className={`tactile-btn px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                  isSelected
                    ? 'bg-white/15 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title={`Set Lloyd's expression to ${em.label}`}
              >
                {em.label}
              </button>
            );
          })}
          <button
            onClick={() => onEmotionSelect('excited')}
            className="tactile-btn ml-0.5 px-2.5 py-1 rounded-full bg-sky-500/15 hover:bg-sky-500/25 border border-sky-400/25 text-[11px] font-medium text-sky-200 flex items-center gap-1"
            title="Wave & Greet"
          >
            <Hand className="w-3 h-3" />
            <span>Wave</span>
          </button>
        </div>
      )}

      {/* Camera Framing Toggle */}
      {onCameraPresetChange && (
        <button
          onClick={cycleCamera}
          className="glass-pill tactile-btn hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-full text-[11px] font-medium text-slate-300 hover:text-white"
          title="Switch Camera Framing (Standard / Portrait / Wide Orbit)"
        >
          <Camera className="w-3.5 h-3.5 text-slate-400" />
          <span className="capitalize">
            {cameraPreset === 'default'
              ? 'Orbit View'
              : cameraPreset === 'closeup'
              ? 'Portrait'
              : 'Deep Space'}
          </span>
        </button>
      )}

      {/* Neural Telemetry & Engine Health Pill */}
      <div className="glass-pill hidden md:flex items-center gap-2.5 px-3.5 py-2 rounded-full text-[11px] font-medium text-slate-300 tabular-nums">
        <div
          className="flex items-center gap-1.5"
          title={`Apple Silicon Metal •LLM: ${llmOk ? 'Ready' : 'Loading'} • STT: ${
            sttOk ? 'Ready' : 'Loading'
          } • TTS: ${ttsOk ? 'Ready' : 'Loading'}`}
        >
          <Cpu className="w-3.5 h-3.5 text-slate-400" />
          <span>Metal</span>
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              allReady ? 'bg-emerald-400' : 'bg-amber-400'
            }`}
          />
        </div>

        <div className="h-3 w-px bg-white/10" />

        <div className="flex items-center gap-2 text-slate-400 font-mono text-[10.5px]">
          <span className={llmOk ? 'text-slate-200' : 'text-slate-500'}>LLM</span>
          <span>·</span>
          <span className={sttOk ? 'text-slate-200' : 'text-slate-500'}>STT</span>
          <span>·</span>
          <span className={ttsOk ? 'text-slate-200' : 'text-slate-500'}>TTS</span>
        </div>

        {hardware?.latency?.last_llm_ms ? (
          <>
            <div className="h-3 w-px bg-white/10" />
            <span className="font-mono text-[10.5px] text-sky-300">
              {Math.round(hardware.latency.last_llm_ms)}ms
            </span>
          </>
        ) : null}
      </div>

      {/* Live Companion State Pill */}
      <div
        className={`glass-pill flex items-center gap-2 px-3.5 py-2 rounded-full border ${badge.badgeBg}`}
      >
        <span className="relative flex h-2 w-2">
          <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
        </span>
        <span className={`text-[11px] font-medium tracking-tight ${badge.text}`}>
          {badge.label}
        </span>

        {(companionState === 'SPEAKING' || companionState === 'THINKING') && (
          <button
            onClick={onInterrupt}
            className="tactile-btn ml-1 px-2 py-0.5 rounded-full bg-white/10 hover:bg-rose-500/25 border border-white/10 text-[10px] font-medium text-slate-200 flex items-center gap-1"
            title="Interrupt current response"
          >
            <Square className="w-2.5 h-2.5 fill-current" />
            <span>Stop</span>
          </button>
        )}
      </div>

      {/* Tactile Microphone Control */}
      <button
        onClick={onToggleMic}
        className={`glass-pill tactile-btn flex items-center gap-2 px-3.5 py-2 rounded-full text-[11px] font-medium ${
          micEnabled
            ? 'border-emerald-400/50 bg-emerald-500/10 text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.18)]'
            : 'text-slate-300 hover:text-white hover:border-white/20'
        }`}
        title={
          micEnabled
            ? `Microphone Active (${voiceMode === 'vad' ? 'Hands-Free VAD' : 'Push-to-Talk'})`
            : 'Enable Microphone'
        }
      >
        {micEnabled ? (
          <>
            <Mic className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>{voiceMode === 'vad' ? 'Hands-Free' : 'Mic Active'}</span>
          </>
        ) : (
          <>
            <MicOff className="w-3.5 h-3.5 text-slate-400" />
            <span>Mic Muted</span>
          </>
        )}
      </button>
    </header>
  );
};
