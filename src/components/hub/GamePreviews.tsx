import React from "react";

export const TttPreview: React.FC = () => {
  return (
    <div className="relative flex h-36 w-36 items-center justify-center rounded-2xl border border-blue-500/30 bg-blue-950/20 p-2 shadow-[0_0_30px_rgba(59,130,246,0.15)]">
      <div className="grid grid-cols-3 grid-rows-3 gap-1.5 h-full w-full">
        <div className="flex items-center justify-center rounded-lg bg-zinc-800/60 font-black text-xl text-blue-400 animate-pulse">
          ✕
        </div>
        <div className="rounded-lg bg-zinc-800/30" />
        <div className="flex items-center justify-center rounded-lg bg-zinc-800/60 font-black text-xl text-red-400">
          ○
        </div>
        <div className="rounded-lg bg-zinc-800/30" />
        <div className="flex items-center justify-center rounded-lg bg-blue-500/20 font-black text-2xl text-blue-300 ring-2 ring-blue-400/40 animate-pulse">
          ✕
        </div>
        <div className="rounded-lg bg-zinc-800/30" />
        <div className="flex items-center justify-center rounded-lg bg-zinc-800/60 font-black text-xl text-red-400">
          ○
        </div>
        <div className="rounded-lg bg-zinc-800/30" />
        <div className="flex items-center justify-center rounded-lg bg-zinc-800/60 font-black text-xl text-blue-400">
          ✕
        </div>
      </div>
    </div>
  );
};

export const ConnectFourPreview: React.FC = () => {
  return (
    <div className="relative flex h-36 w-44 items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-950/20 p-2.5 shadow-[0_0_30px_rgba(245,158,11,0.15)]">
      <div className="flex flex-col gap-1.5 w-full h-full justify-center">
        <div className="flex justify-around">
          <div className="h-4 w-4 rounded-full bg-zinc-800/40" />
          <div className="h-4 w-4 rounded-full bg-zinc-800/40" />
          <div className="h-4 w-4 rounded-full bg-yellow-400 animate-bounce shadow-[0_0_8px_rgba(250,204,21,0.6)]" />
          <div className="h-4 w-4 rounded-full bg-zinc-800/40" />
          <div className="h-4 w-4 rounded-full bg-zinc-800/40" />
        </div>
        <div className="flex justify-around">
          <div className="h-4 w-4 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]" />
          <div className="h-4 w-4 rounded-full bg-zinc-800/40" />
          <div className="h-4 w-4 rounded-full bg-yellow-400 shadow-[0_0_6px_rgba(250,204,21,0.5)]" />
          <div className="h-4 w-4 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]" />
          <div className="h-4 w-4 rounded-full bg-zinc-800/40" />
        </div>
        <div className="flex justify-around">
          <div className="h-4 w-4 rounded-full bg-yellow-400 shadow-[0_0_6px_rgba(250,204,21,0.5)]" />
          <div className="h-4 w-4 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]" />
          <div className="h-4 w-4 rounded-full bg-yellow-400 shadow-[0_0_6px_rgba(250,204,21,0.5)]" />
          <div className="h-4 w-4 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]" />
          <div className="h-4 w-4 rounded-full bg-yellow-400 shadow-[0_0_6px_rgba(250,204,21,0.5)]" />
        </div>
      </div>
    </div>
  );
};

export const ArrowRacePreview: React.FC = () => {
  return (
    <div className="relative flex h-36 w-36 items-center justify-center rounded-2xl border border-violet-500/30 bg-violet-950/20 p-2 shadow-[0_0_30px_rgba(139,92,246,0.15)]">
      <div className="flex flex-col items-center justify-center gap-2">
        <span className="text-4xl text-violet-400 animate-pulse font-black">
          ▲
        </span>
        <div className="flex items-center gap-1.5 text-[11px] font-black text-violet-300 uppercase tracking-widest bg-violet-500/20 px-2 py-0.5 rounded-full border border-violet-500/40">
          <span>SLIDE</span>
          <span>→</span>
        </div>
      </div>
    </div>
  );
};

export const DirectionRushPreview: React.FC = () => {
  return (
    <div className="relative flex h-36 w-36 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-2 shadow-[0_0_30px_rgba(16,185,129,0.15)]">
      <div className="flex flex-col items-center justify-center gap-2">
        <span className="text-5xl animate-bounce select-none">
          🍃
        </span>
        <div className="flex items-center gap-1 text-[11px] font-black text-emerald-300 uppercase tracking-wider bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/40">
          <span>POINTING</span>
          <span>↑</span>
        </div>
      </div>
    </div>
  );
};

export const DefaultPreview: React.FC<{ mark: string }> = ({ mark }) => {
  return (
    <div className="flex h-36 w-36 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/60 p-2">
      <span className="text-4xl font-black text-zinc-600 select-none">{mark}</span>
    </div>
  );
};
