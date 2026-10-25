import React from "react";

export const ScoreBox: React.FC<{
  label: string;
  score: number;
  active: boolean;
  accent: string;
  testId: string;
  turnRemaining?: number;
  turnTimerMs?: number;
  isMyTurn?: boolean;
}> = ({ label, score, active, accent, testId, turnRemaining, turnTimerMs, isMyTurn }) => {
  const isLowTime = turnRemaining !== undefined && turnRemaining > 0 && turnRemaining <= 5000;
  const isActiveTurn = isMyTurn && turnRemaining !== undefined && turnRemaining > 0;
  const turnPercent = turnRemaining !== undefined && turnTimerMs && turnTimerMs > 0
    ? Math.max(0, Math.min(100, (turnRemaining / turnTimerMs) * 100))
    : 0;
  const borderColor = accent === 'text-blue-500' ? '#3b82f6' : '#ef4444';
  const progressColor = isLowTime ? '#ef4444' : borderColor;

  // Build a linear gradient for the progress bar background
  const progressStyle = isActiveTurn && turnTimerMs
    ? {
        background: `linear-gradient(90deg, ${progressColor} ${turnPercent}%, transparent ${turnPercent}%)`,
        backgroundSize: '100% 3px',
        backgroundPosition: 'top',
        backgroundRepeat: 'no-repeat',
      } as React.CSSProperties
    : {};

  return (
    <div
      data-testid={testId}
      className={`rounded-xl border-2 px-6 py-3 text-center transition-all relative overflow-hidden ${
        active
          ? "border-yellow-400 bg-zinc-800 shadow-[0_0_18px_-4px_rgba(250,204,21,0.55)] animate-pulse"
          : "border-zinc-700 bg-zinc-800/60"
      }`}
      style={progressStyle}
    >
      {isActiveTurn && turnTimerMs && isLowTime && (
        <div
          className="absolute top-0 left-0 right-0 h-1 pointer-events-none animate-blink-red"
          style={{ backgroundColor: progressColor }}
          aria-hidden="true"
        />
      )}
      <div className={`text-xs font-semibold uppercase tracking-wider ${accent} relative z-10`}>{label}</div>
      <div className="text-3xl font-extrabold text-gray-100 relative z-10">{score}</div>
    </div>
  );
};
