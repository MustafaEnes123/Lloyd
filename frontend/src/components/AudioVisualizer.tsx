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
    <div className="flex items-center justify-center gap-1 h-7 px-3">
      {bins.slice(0, 20).map((val, idx) => {
        let barHeight = 4;
        let colorClass = 'bg-cyan-400/40';

        if (companionState === 'SPEAKING') {
          barHeight = Math.max(4, Math.min(26, Math.round(val * 26)));
          colorClass =
            idx % 3 === 0
              ? 'bg-cyan-400 shadow-[0_0_8px_#00f0ff]'
              : idx % 2 === 0
              ? 'bg-sky-400'
              : 'bg-pink-400';
        } else if (companionState === 'LISTENING') {
          const wave = Math.sin(idx * 0.65 + Date.now() * 0.01) * 0.5 + 0.5;
          barHeight = Math.max(4, Math.min(24, Math.round((micLevel * 1.4 + wave * 0.25) * 22)));
          colorClass = 'bg-emerald-400 shadow-[0_0_8px_#10b981]';
        } else if (companionState === 'THINKING') {
          const pulse = Math.sin(idx * 0.5 + Date.now() * 0.008) * 0.5 + 0.5;
          barHeight = Math.max(4, Math.round(pulse * 14));
          colorClass = 'bg-purple-400/80';
        }

        return (
          <div
            key={idx}
            className={`w-1 rounded-full transition-all duration-75 ${colorClass}`}
            style={{ height: `${barHeight}px` }}
          />
        );
      })}
    </div>
  );
};
