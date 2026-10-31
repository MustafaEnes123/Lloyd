import React, { useState } from 'react';
import { CornerDownLeft, Mic, Sparkles, Terminal } from 'lucide-react';
import type {
  AudioReactiveMetrics,
  CompanionState,
  VoiceInputMode,
} from '../hooks/useLloydSocket';
import { AudioVisualizer } from './AudioVisualizer';

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
      <div className="glass-panel pointer-events-auto rounded-3xl p-5 border border-white/15 shadow-2xl space-y-3.5">
        {/* Top Row: Speaker Tag + User Transcript + Real-Time Frequency Visualizer */}
        <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="px-2.5 py-0.5 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-[11px] font-bold tracking-wider uppercase text-cyan-300 flex items-center gap-1.5 shrink-0">
              <Sparkles className="w-3 h-3" /> LLOYD
            </span>
            {lastUserTranscript && (
              <span className="text-xs text-slate-400 truncate font-mono">
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
        <div className="min-h-[3.25rem] flex items-center">
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

        {/* Manual Quiet Text Input + Push-to-Talk Control */}
        <form onSubmit={handleSubmit} className="flex items-center gap-2.5 pt-1">
          <div className="relative flex-1">
            <Terminal className="w-4 h-4 text-cyan-400/70 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Message Lloyd directly, or speak via microphone..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-950/75 border border-white/10 focus:border-cyan-400/60 focus:outline-none text-xs md:text-sm text-white placeholder-slate-500 transition-colors"
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
              className={`px-3.5 py-2.5 rounded-2xl text-xs font-semibold flex items-center gap-1.5 transition-all select-none ${
                isPttHeld
                  ? 'bg-emerald-500 text-slate-950 shadow-[0_0_20px_#10b981] scale-95'
                  : 'bg-white/10 hover:bg-white/15 text-slate-200 border border-white/10'
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
            className="px-4 py-2.5 rounded-2xl bg-cyan-500/25 hover:bg-cyan-500/35 disabled:opacity-40 border border-cyan-400/50 text-cyan-200 text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <span>SEND</span>
            <CornerDownLeft className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
};
