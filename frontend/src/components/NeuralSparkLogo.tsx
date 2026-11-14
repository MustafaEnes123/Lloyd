import React from 'react';

interface NeuralSparkLogoProps {
  size?: number;
  className?: string;
  animated?: boolean;
}

/**
 * Precision Aerospace Orbital Emblem for Lloyd.
 * Features a sleek obsidian-titanium squircle badge with an orbital ring and
 * crisp four-point starlight core.
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
      className={`select-none shrink-0 ${className}`}
    >
      <defs>
        <linearGradient id="lloydSurface" x1="16" y1="8" x2="112" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1E293B" />
          <stop offset="45%" stopColor="#0F172A" />
          <stop offset="100%" stopColor="#050811" />
        </linearGradient>

        <linearGradient id="lloydRim" x1="12" y1="12" x2="116" y2="116" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F8FAFC" stopOpacity="0.45" />
          <stop offset="50%" stopColor="#38BDF8" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#0F172A" stopOpacity="0.1" />
        </linearGradient>

        <linearGradient id="lloydStar" x1="30" y1="24" x2="98" y2="104" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="55%" stopColor="#BAE6FD" />
          <stop offset="100%" stopColor="#38BDF8" />
        </linearGradient>

        <radialGradient id="lloydCore" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#38BDF8" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Precision Squircle Chassis */}
      <rect
        x="10"
        y="10"
        width="108"
        height="108"
        rx="30"
        fill="url(#lloydSurface)"
        stroke="url(#lloydRim)"
        strokeWidth="2.5"
      />

      {/* Ambient Core Glow */}
      <circle cx="64" cy="64" r="38" fill="url(#lloydCore)" />

      {/* Tilted Elliptical Orbital Ring */}
      <ellipse
        cx="64"
        cy="64"
        rx="44"
        ry="18"
        transform="rotate(-28 64 64)"
        stroke="#38BDF8"
        strokeWidth="2.2"
        strokeOpacity="0.55"
        strokeDasharray="6 4"
        className={animated ? 'origin-center animate-[spin_24s_linear_infinite]' : ''}
      />

      {/* Crisp Four-Point Starlight Core */}
      <path
        d="M64 22 C66.8 48.5, 79.5 61.2, 106 64 C79.5 66.8, 66.8 79.5, 64 106 C61.2 79.5, 48.5 66.8, 22 64 C48.5 61.2, 61.2 48.5, 64 22 Z"
        fill="url(#lloydStar)"
      />

      {/* Specular Center Pinpoint */}
      <circle cx="64" cy="64" r="4.5" fill="#FFFFFF" />
    </svg>
  );
};
