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
  const borderColor = accent === 'text-blue-500' ? '#3b82f6' : '#ef4444';

  return (
    <div
      data-testid={testId}
      className={`rounded-xl border-2 px-6 py-3 text-center transition-all relative ${
        active
          ? "border-yellow-400 bg-zinc-800 shadow-[0_0_18px_-4px_rgba(250,204,21,0.55)] animate-pulse"
          : "border-zinc-700 bg-zinc-800/60"
      }`}
    >
      {isActiveTurn && turnTimerMs && (
        <div
          className={`absolute inset-0 rounded-xl border-4 pointer-events-none transition-all duration-100 ${isLowTime ? 'animate-blink-red' : ''}`}
          style={{
            borderColor: isLowTime ? '#ef4444' : borderColor,
            opacity: isLowTime ? 1 : 0.6,
          }}
          aria-label={`Turn time remaining: ${Math.ceil((turnRemaining || 0) / 1000)} seconds`}
        />
      )}
      <div className={`text-xs font-semibold uppercase tracking-wider ${accent}`}>{label}</div>
      <div className="text-3xl font-extrabold text-gray-100">{score}</div>
      {isActiveTurn && turnRemaining !== undefined && turnRemaining > 0 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs font-mono text-yellow-400 whitespace-nowrap">
          {Math.ceil(turnRemaining / 1000)}s
        </div>
      )}
    </div>
  );
};
