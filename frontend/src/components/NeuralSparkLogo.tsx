import React from 'react';

interface NeuralSparkLogoProps {
  size?: number;
  className?: string;
  animated?: boolean;
}

/**
 * Multi-layered glowing SVG icon representing a four-pointed star / neural spark
 * merging organic curves with futuristic cyber geometry, incorporating gradient blends
 * of electric cyan (#00F2FE), neural violet (#4FACFE / #8B5CF6), and deep obsidian.
 */
export const NeuralSparkLogo: React.FC<NeuralSparkLogoProps> = ({
  size = 28,
  className = '',
  animated = true,
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 128 128"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`select-none ${className}`}
    >
      <defs>
        <linearGradient id="lloydSparkPrimary" x1="12" y1="12" x2="116" y2="116" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#00F2FE" />
          <stop offset="52%" stopColor="#4FACFE" />
          <stop offset="100%" stopColor="#8B5CF6" />
        </linearGradient>

        <linearGradient id="lloydSparkSecondary" x1="112" y1="16" x2="16" y2="112" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#818CF8" stopOpacity="0.65" />
          <stop offset="100%" stopColor="#050814" stopOpacity="0.95" />
        </linearGradient>

        <radialGradient id="lloydCoreGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="38%" stopColor="#00F2FE" />
          <stop offset="75%" stopColor="#4FACFE" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#050814" stopOpacity="0" />
        </radialGradient>

        <filter id="lloydSoftBloom" x="-25%" y="-25%" width="150%" height="150%">
          <feGaussianBlur stdDeviation="5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Deep Obsidian Cyber Hex Backing */}
      <circle
        cx="64"
        cy="64"
        r="56"
        fill="#050814"
        stroke="url(#lloydSparkPrimary)"
        strokeWidth="2.2"
        strokeOpacity="0.45"
      />

      {/* Orbital Cyber Telemetry Ring */}
      <circle
        cx="64"
        cy="64"
        r="46"
        stroke="url(#lloydSparkPrimary)"
        strokeWidth="1.5"
        strokeDasharray="8 6"
        strokeOpacity="0.6"
        className={animated ? 'origin-center animate-[spin_18s_linear_infinite]' : ''}
      />

      {/* Secondary Rotated Geometric Diamond */}
      <path
        d="M64 20 C68 46, 82 60, 108 64 C82 68, 68 82, 64 108 C60 82, 46 68, 20 64 C46 60, 60 46, 64 20 Z"
        fill="url(#lloydSparkSecondary)"
        transform="rotate(45 64 64) scale(0.76)"
        style={{ transformOrigin: '64px 64px' }}
      />

      {/* Primary Four-Pointed Organic Neural Spark Star */}
      <path
        d="M64 10 C67.5 45, 83 60.5, 118 64 C83 67.5, 67.5 83, 64 118 C60.5 83, 45 67.5, 10 64 C45 60.5, 60.5 45, 64 10 Z"
        fill="url(#lloydSparkPrimary)"
        filter="url(#lloydSoftBloom)"
      />

      {/* Inner Luminous Core */}
      <circle cx="64" cy="64" r="16" fill="url(#lloydCoreGlow)" />
      <circle cx="64" cy="64" r="4.5" fill="#FFFFFF" />
    </svg>
  );
};
