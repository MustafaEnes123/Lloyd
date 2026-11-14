import React from 'react';
import type { AudioReactiveMetrics, CompanionState } from '../hooks/useLloydSocket';

interface AudioVisualizerProps {
  companionState: CompanionState;
  audioMetrics: AudioReactiveMetrics;
  micLevel: number;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  companionState,
  audioMetrics,
  micLevel,
}) => {
  const bins = audioMetrics.frequencyBins;

  return (
    <div
      className="flex items-center justify-center gap-[3px] h-5 px-2"
      aria-label="Live Acoustic Spectrum"
    >
      {bins.slice(0, 16).map((val, idx) => {
        // Symmetric center-weighted envelope for studio-grade acoustic meter aesthetics
        const centerDist = Math.abs(idx - 7.5) / 7.5;
        const envelope = 1 - centerDist * 0.45;
        let barHeight = 3;
        let colorClass = 'bg-slate-500/40';

        if (companionState === 'SPEAKING') {
          barHeight = Math.max(3, Math.min(18, Math.round(val * 22 * envelope)));
          colorClass = 'bg-sky-300 shadow-[0_0_8px_rgba(56,189,248,0.45)]';
        } else if (companionState === 'LISTENING') {
          const wave = Math.sin(idx * 0.7 + Date.now() * 0.012) * 0.5 + 0.5;
          barHeight = Math.max(
            3,
            Math.min(18, Math.round((micLevel * 1.45 + wave * 0.2) * 18 * envelope))
          );
          colorClass = 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)]';
        } else if (companionState === 'THINKING') {
          const pulse = Math.sin(idx * 0.55 + Date.now() * 0.008) * 0.5 + 0.5;
          barHeight = Math.max(3, Math.round(pulse * 11 * envelope));
          colorClass = 'bg-indigo-300/80';
        }

        return (
          <div
            key={idx}
            className={`w-[2.5px] rounded-full transition-all duration-75 ${colorClass}`}
            style={{ height: `${barHeight}px` }}
          />
        );
      })}
    </div>
  );
};
