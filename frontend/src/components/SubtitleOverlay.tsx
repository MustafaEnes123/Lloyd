import React, { useState } from 'react';
import { ArrowUp, Mic, Sparkles } from 'lucide-react';
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

const QUICK_PROMPTS = [
  'How can you help me today?',
  'Help me plan a focus sprint',
  'Tell me a quick space fact',
];

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
    <section
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-20 w-full max-w-2xl px-4 pointer-events-none"
      aria-label="Lloyd Dialogue & Command Dock"
    >
      {/* Subtle Starlight Underglow */}
      <div className="absolute inset-x-16 -bottom-3 h-20 rounded-full bg-sky-500/10 blur-2xl pointer-events-none" />

      <div className="glass-panel pointer-events-auto relative rounded-[24px] p-4 space-y-3">
        {/* Top Row: Companion Identity + User Transcript + Live Acoustic Spectrum */}
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] pb-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="px-2.5 py-1 rounded-full bg-white/[0.06] border border-white/10 flex items-center gap-2 shrink-0">
              <NeuralSparkLogo size={14} animated={companionState !== 'IDLE'} />
              <span className="text-[11px] font-semibold tracking-tight text-white">
                Lloyd
              </span>
            </div>

            {lastUserTranscript ? (
              <span className="text-xs text-slate-400 truncate">
                <span className="text-slate-500 font-medium mr-1">You:</span>
                &ldquo;{lastUserTranscript}&rdquo;
              </span>
            ) : (
              <div className="hidden sm:flex items-center gap-1.5 overflow-x-auto">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => onSendText(prompt)}
                    className="tactile-btn px-2.5 py-0.5 rounded-full bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.07] text-[11px] text-slate-400 hover:text-slate-200 whitespace-nowrap"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}
          </div>

          <AudioVisualizer
            companionState={companionState}
            audioMetrics={audioMetrics}
            micLevel={micLevel}
          />
        </div>

        {/* Editorial-Grade Live Subtitle Display */}
        <div className="min-h-[2.6rem] flex items-center px-1.5">
          <p className="text-[15px] md:text-[16px] font-normal leading-relaxed text-slate-100 tracking-[-0.011em]">
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

        {/* Precision Command Input Bar */}
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 p-1.5 pl-3.5 rounded-2xl bg-black/40 border border-white/10 focus-within:border-white/25 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Message Lloyd, or speak naturally..."
            className="flex-1 bg-transparent text-[13px] text-white placeholder-slate-500 focus:outline-none"
          />

          {voiceMode === 'ptt' && (
            <button
              type="button"
              onMouseDown={onPttDown}
              onMouseUp={onPttUp}
              onMouseLeave={onPttUp}
              onTouchStart={onPttDown}
              onTouchEnd={onPttUp}
              className={`tactile-btn px-3 py-1.5 rounded-xl text-[11px] font-medium flex items-center gap-1.5 select-none ${
                isPttHeld
                  ? 'bg-emerald-400 text-slate-950 font-semibold shadow-[0_0_20px_rgba(52,211,153,0.4)]'
                  : 'bg-white/[0.06] hover:bg-white/[0.1] text-slate-300 border border-white/10'
              }`}
              title="Hold Spacebar or Hold Button to Talk"
            >
              <Mic className="w-3 h-3" />
              <span>{isPttHeld ? 'Listening' : 'Hold'}</span>
              {!isPttHeld && <kbd className="kbd-badge">Space</kbd>}
            </button>
          )}

          <button
            type="submit"
            disabled={!inputText.trim()}
            className="tactile-btn btn-primary-titanium px-3.5 py-1.5 rounded-xl text-[12px] font-semibold flex items-center gap-1.5 disabled:opacity-30 disabled:pointer-events-none"
            title="Send Message"
          >
            <span>Send</span>
            <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
        </form>
      </div>
    </section>
  );
};
