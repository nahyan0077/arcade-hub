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
}> = ({ label, score, active, accent, testId, turnRemaining, turnTimerMs }) => {
  const hasTimer = turnRemaining !== undefined && turnTimerMs !== undefined && turnTimerMs > 0;
  const isLowTime = hasTimer && turnRemaining > 0 && turnRemaining <= 5000;
  const turnPercent = hasTimer
    ? Math.max(0, Math.min(100, (turnRemaining / turnTimerMs) * 100))
    : 0;
  const progressBgClass = isLowTime
    ? "bg-red-500"
    : accent === "text-blue-500"
      ? "bg-blue-500"
      : "bg-red-500";

  return (
    <div
      data-testid={testId}
      className={`rounded-xl border-2 px-6 py-3 text-center transition-all relative overflow-hidden ${
        active
          ? "border-yellow-400 bg-zinc-800 shadow-[0_0_18px_-4px_rgba(250,204,21,0.45)]"
          : "border-zinc-700 bg-zinc-800/60"
      }`}
    >
      {hasTimer && turnRemaining > 0 && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-zinc-700/40">
          <div
            className={`h-full transition-[width] duration-100 ease-linear ${progressBgClass}`}
            style={{
              width: `${turnPercent}%`,
              boxShadow: isLowTime ? "0 0 8px rgba(239, 68, 68, 0.8)" : undefined,
            }}
          />
        </div>
      )}
      <div className={`text-xs font-semibold uppercase tracking-wider ${accent} relative z-10`}>
        {label}
      </div>
      <div className="text-3xl font-extrabold text-gray-100 relative z-10">{score}</div>
    </div>
  );
};
