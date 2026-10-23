import React from "react";

export const ScoreBox: React.FC<{
  label: string;
  score: number;
  active: boolean;
  accent: string;
  testId: string;
}> = ({ label, score, active, accent, testId }) => (
  <div
    data-testid={testId}
    className={`rounded-xl border-2 px-6 py-3 text-center transition-all ${
      active
        ? "border-yellow-400 bg-zinc-800 shadow-[0_0_18px_-4px_rgba(250,204,21,0.55)] animate-pulse"
        : "border-zinc-700 bg-zinc-800/60"
    }`}
  >
    <div className={`text-xs font-semibold uppercase tracking-wider ${accent}`}>{label}</div>
    <div className="text-3xl font-extrabold text-gray-100">{score}</div>
  </div>
);
