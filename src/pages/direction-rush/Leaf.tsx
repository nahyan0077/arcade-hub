import React from 'react';

export interface LeafProps {
  rotate?: number;
  size?: number;
  className?: string;
}

export const Leaf: React.FC<LeafProps> = ({
  rotate = 0,
  size = 46,
  className = '',
}) => {
  return (
    <div
      className={`inline-block select-none pointer-events-none ${className}`}
      style={{
        width: size,
        height: size,
        transform: `rotate(${rotate}deg)`,
        transformOrigin: 'center center',
      }}
    >
      <svg
        viewBox="-24 -24 48 48"
        width={size}
        height={size}
        className="overflow-visible drop-shadow-[0_4px_10px_rgba(0,0,0,0.6)]"
      >
        <defs>
          <linearGradient id="rushLeafGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#86efac" />
            <stop offset="45%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#15803d" />
          </linearGradient>
        </defs>

        {/* Stem at bottom */}
        <path
          d="M 0 16 Q 1 20 3 23"
          stroke="#14532d"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />

        {/* Leaf blade pointing UP towards (0, -22) */}
        <path
          d="M 0 -22 C 14 -10 16 12 0 18 C -16 12 -14 -10 0 -22 Z"
          fill="url(#rushLeafGrad)"
          stroke="#14532d"
          strokeWidth="1.8"
        />

        {/* Center vein */}
        <line
          x1="0"
          y1="-18"
          x2="0"
          y2="14"
          stroke="#14532d"
          strokeWidth="1.6"
          strokeLinecap="round"
        />

        {/* Forward-slanting side veins */}
        <path
          d="M 0 -10 L 7 -5 M 0 -10 L -7 -5 M 0 -2 L 8 4 M 0 -2 L -8 4 M 0 6 L 7 11 M 0 6 L -7 11"
          stroke="#14532d"
          strokeWidth="1.2"
          strokeLinecap="round"
          opacity="0.8"
        />

        {/* High-visibility leaf tip beacon */}
        <circle cx="0" cy="-19" r="2.2" fill="#fde047" stroke="#ca8a04" strokeWidth="0.8" />
      </svg>
    </div>
  );
};
