import React from "react";

export type RetroGridVariant = "ttt" | "c4" | "rush" | "hub" | "default";

interface RetroGridProps {
  variant?: RetroGridVariant;
  className?: string;
  intensity?: "subtle" | "normal" | "vibrant";
}

const THEMES: Record<
  RetroGridVariant,
  {
    gridColor: string;
    glowColor: string;
    horizonColor: string;
    accentColor: string;
  }
> = {
  ttt: {
    gridColor: "rgba(56, 189, 248, 0.16)", // cyan-400
    glowColor: "rgba(56, 189, 248, 0.18)",
    horizonColor: "rgba(139, 92, 246, 0.22)", // violet
    accentColor: "#38bdf8",
  },
  c4: {
    gridColor: "rgba(251, 191, 36, 0.16)", // amber-400
    glowColor: "rgba(245, 158, 11, 0.18)",
    horizonColor: "rgba(239, 68, 68, 0.20)", // red
    accentColor: "#fbbf24",
  },
  rush: {
    gridColor: "rgba(52, 211, 153, 0.16)", // emerald-400
    glowColor: "rgba(16, 185, 129, 0.20)",
    horizonColor: "rgba(168, 85, 247, 0.22)", // purple
    accentColor: "#34d399",
  },
  hub: {
    gridColor: "rgba(99, 102, 241, 0.14)", // indigo-500
    glowColor: "rgba(59, 130, 246, 0.16)",
    horizonColor: "rgba(236, 72, 153, 0.18)",
    accentColor: "#818cf8",
  },
  default: {
    gridColor: "rgba(161, 161, 170, 0.12)",
    glowColor: "rgba(113, 113, 122, 0.15)",
    horizonColor: "rgba(82, 82, 91, 0.15)",
    accentColor: "#a1a1aa",
  },
};

export const RetroGrid: React.FC<RetroGridProps> = ({
  variant = "default",
  className = "",
  intensity = "normal",
}) => {
  const theme = THEMES[variant] || THEMES.default;
  const opacityMultiplier = intensity === "vibrant" ? 1.4 : intensity === "subtle" ? 0.7 : 1.0;

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden select-none z-0 ${className}`}
    >
      {/* Top Ambient Horizon / Sun Glow */}
      <div
        className="absolute -top-32 left-1/2 -translate-x-1/2 h-96 w-[650px] rounded-full blur-3xl transition-colors duration-700"
        style={{
          background: `radial-gradient(ellipse at center, ${theme.glowColor} 0%, transparent 70%)`,
          opacity: opacityMultiplier,
        }}
      />

      {/* SVG Fine Background Grid Pattern */}
      <svg
        className="absolute inset-0 h-full w-full opacity-70"
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="100%"
      >
        <defs>
          <pattern
            id={`retro-grid-pattern-${variant}`}
            width="36"
            height="36"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 36 0 L 0 0 0 36"
              fill="none"
              stroke={theme.gridColor}
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#retro-grid-pattern-${variant})`} />
      </svg>

      {/* Retro 3D Perspective Ground Grid (Bottom Horizon) */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[48%] overflow-hidden"
        style={{
          maskImage: "linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.8) 40%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.8) 40%, transparent 100%)",
        }}
      >
        <div
          className="absolute -bottom-[20%] left-[-50%] right-[-50%] h-[160%] origin-bottom"
          style={{
            transform: "perspective(320px) rotateX(68deg)",
            backgroundImage: `
              linear-gradient(to right, ${theme.gridColor} 1.5px, transparent 1.5px),
              linear-gradient(to bottom, ${theme.gridColor} 1.5px, transparent 1.5px)
            `,
            backgroundSize: "40px 40px",
            opacity: opacityMultiplier,
          }}
        />
        {/* Horizon Light Strip */}
        <div
          className="absolute top-0 left-0 right-0 h-[2px] blur-[1px]"
          style={{
            background: `linear-gradient(to right, transparent 5%, ${theme.accentColor} 50%, transparent 95%)`,
            opacity: 0.6 * opacityMultiplier,
          }}
        />
      </div>

      {/* Vignette Edge Shading for Maximum Content Focus */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at 50% 45%, transparent 45%, rgba(9, 9, 11, 0.75) 100%)",
        }}
      />
    </div>
  );
};
