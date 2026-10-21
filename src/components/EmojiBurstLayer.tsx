import React from 'react';

export interface EmojiBurst {
  id: number;
  emoji: string;
}

export const EmojiBurstLayer: React.FC<{ bursts: EmojiBurst[] }> = ({ bursts }) => (
  <div
    aria-hidden="true"
    className="pointer-events-none fixed bottom-36 right-4 z-40 flex flex-col items-end gap-2 sm:bottom-40 sm:right-8"
  >
    {bursts.map((burst) => (
      <span
        key={burst.id}
        data-testid="emoji-burst"
        className="animate-emoji-float text-4xl drop-shadow-lg"
      >
        {burst.emoji}
      </span>
    ))}
  </div>
);
