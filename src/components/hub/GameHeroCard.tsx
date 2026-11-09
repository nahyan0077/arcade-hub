import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TttPreview,
  ConnectFourPreview,
  DirectionRushPreview,
  DefaultPreview,
} from "./GamePreviews";

export interface HeroGame {
  id: string;
  title: string;
  category: string;
  tagline: string;
  mark: string;
  playerBadge: string;
  tags: string[];
  playable: boolean;
  buttonBg: string;
}

interface GameHeroCardProps {
  game: HeroGame;
  onPlay: (gameId: string) => void;
}

export const GameHeroCard: React.FC<GameHeroCardProps> = ({ game, onPlay }) => {
  const renderPreview = () => {
    switch (game.id) {
      case "tictactoe":
        return <TttPreview />;
      case "connect-four":
        return <ConnectFourPreview />;
      case "direction-rush":
        return <DirectionRushPreview />;
      default:
        return <DefaultPreview mark={game.mark} />;
    }
  };

  return (
    <div className="relative w-full overflow-hidden rounded-3xl border border-zinc-800/90 bg-gradient-to-br from-zinc-900/90 via-zinc-900/80 to-zinc-950/95 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 md:gap-8">
        {/* Left: Info */}
        <div className="flex flex-col items-center md:items-start text-center md:text-left gap-3 max-w-xl">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded-full border border-cyan-500/30">
              FEATURED • {game.category}
            </span>
            <span className="text-[10px] font-bold text-zinc-400 bg-zinc-800/60 px-2.5 py-1 rounded-full border border-zinc-700/50">
              {game.playerBadge}
            </span>
          </div>

          <h2 className="text-3xl sm:text-5xl font-black tracking-tight text-white">
            {game.title}
          </h2>

          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed max-w-md">
            {game.tagline}
          </p>

          <div className="flex flex-wrap justify-center md:justify-start gap-1.5 pt-1">
            {game.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-2.5 py-1 text-[11px] font-bold text-zinc-400"
              >
                {tag}
              </span>
            ))}
          </div>

          {/* Large CTA Button */}
          <div className="pt-2 w-full sm:w-auto">
            {game.playable ? (
              <button
                type="button"
                onClick={() => onPlay(game.id)}
                className="w-full sm:w-auto flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 px-8 py-3 text-sm sm:text-base font-black text-white shadow-xl shadow-blue-500/30 transition-all hover:scale-105 hover:brightness-110 active:scale-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-cyan-400"
              >
                <span>▶ PLAY NOW</span>
                <span className="text-sm">→</span>
              </button>
            ) : (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-6 py-2.5 text-xs font-bold uppercase text-zinc-500">
                Coming soon
              </div>
            )}
          </div>
        </div>

        {/* Right: Live Graphic Preview */}
        <div className="flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={game.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
            >
              {renderPreview()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
