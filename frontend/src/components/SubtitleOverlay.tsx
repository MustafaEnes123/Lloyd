import React, { useState } from 'react';
import { CornerDownLeft, Mic, Terminal } from 'lucide-react';
import type {
  AudioReactiveMetrics,
  CompanionState,
  VoiceInputMode,
} from '../hooks/useLloydSocket';
import { AudioVisualizer } from './AudioVisualizer';
import { NeuralSparkLogo } from './NeuralSparkLogo';

interface SubtitleOverlayProps {
  liveSubtitle: string;
  lastUserTranscript: string;
  companionState: CompanionState;
  audioMetrics: AudioReactiveMetrics;
  micLevel: number;
  voiceMode: VoiceInputMode;
  isPttHeld: boolean;
  onSendText: (text: string) => void;
  onPttDown: () => void;
  onPttUp: () => void;
}

export const SubtitleOverlay: React.FC<SubtitleOverlayProps> = ({
  liveSubtitle,
  lastUserTranscript,
  companionState,
  audioMetrics,
  micLevel,
  voiceMode,
  isPttHeld,
  onSendText,
  onPttDown,
  onPttUp,
}) => {
  const [inputText, setInputText] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendText(inputText.trim());
    setInputText('');
  };

  const words = liveSubtitle.split(/\s+/).filter(Boolean);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20 w-full max-w-3xl px-5 pointer-events-none">
      {/* Ambient Gemini-Inspired Radial Glow Behind Floating Dock */}
      <div className="absolute inset-x-12 -bottom-4 h-24 rounded-full bg-gradient-to-r from-[#00F2FE]/15 via-[#4FACFE]/15 to-[#8B5CF6]/15 blur-2xl pointer-events-none" />

      <div className="glass-panel pointer-events-auto relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-5 shadow-2xl space-y-3.5">
        {/* Top Row: Neural Spark Badge + User Transcript + Live Audio Waveform Visualizer */}
        <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="px-3 py-1 rounded-full bg-gradient-to-r from-[#00F2FE]/20 to-[#4FACFE]/20 border border-cyan-400/35 text-[11px] font-bold tracking-wider uppercase text-cyan-200 flex items-center gap-2 shrink-0">
              <NeuralSparkLogo size={15} animated={companionState !== 'IDLE'} />
              LLOYD
            </span>
            {lastUserTranscript && (
              <span className="text-xs text-slate-300/90 truncate font-mono">
                Enes: &ldquo;{lastUserTranscript}&rdquo;
              </span>
            )}
          </div>

          <AudioVisualizer
            companionState={companionState}
            audioMetrics={audioMetrics}
            micLevel={micLevel}
          />
        </div>

        {/* Live Cinematic Subtitle Caption Display with Word Fade-In */}
        <div className="min-h-[3.1rem] flex items-center px-1">
          <p className="text-base md:text-lg font-medium leading-relaxed text-slate-100 tracking-wide">
            {words.map((word, idx) => (
              <span
                key={`${idx}-${word}`}
                className="inline-block mr-1.5 animate-word-fade"
              >
                {word}
              </span>
            ))}
          </p>
        </div>

        {/* Tactile Floating Input Pill + Push-to-Talk Control */}
        <form onSubmit={handleSubmit} className="flex items-center gap-2.5 pt-0.5">
          <div className="relative flex-1">
            <Terminal className="w-4 h-4 text-cyan-400/75 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask Lloyd anything, or speak hands-free..."
              className="w-full pl-11 pr-4 py-2.5 rounded-full bg-slate-950/75 border border-white/10 focus:border-cyan-400/60 focus:outline-none text-xs md:text-sm text-white placeholder-slate-400 transition-all"
            />
          </div>

          {voiceMode === 'ptt' && (
            <button
              type="button"
              onMouseDown={onPttDown}
              onMouseUp={onPttUp}
              onMouseLeave={onPttUp}
              onTouchStart={onPttDown}
              onTouchEnd={onPttUp}
              className={`tactile-btn px-4 py-2.5 rounded-full text-xs font-semibold flex items-center gap-1.5 select-none ${
                isPttHeld
                  ? 'bg-emerald-500 text-slate-950 shadow-[0_0_24px_#10b981] scale-95'
                  : 'bg-white/10 hover:bg-white/15 text-slate-200 border border-white/15'
              }`}
              title="Hold Spacebar or Hold Button to Speak"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>{isPttHeld ? 'LISTENING...' : 'HOLD [SPACE]'}</span>
            </button>
          )}

          <button
            type="submit"
            disabled={!inputText.trim()}
            className="tactile-btn px-5 py-2.5 rounded-full bg-gradient-to-r from-[#00F2FE]/25 to-[#4FACFE]/25 hover:from-[#00F2FE]/35 hover:to-[#4FACFE]/35 disabled:opacity-40 border border-cyan-400/50 text-cyan-100 text-xs font-semibold flex items-center gap-1.5 shadow-[0_0_20px_rgba(0,242,254,0.18)]"
          >
            <span>SEND</span>
            <CornerDownLeft className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
