import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import { isMuted, setMuted, playEffect } from "../../sound/audio";
import { MatrixBackground } from "../../components/MatrixBackground";
import { RetroGrid } from "../../components/RetroGrid";
import { Landing } from "../landing/Landing";
import { useSettings } from "../../settings/SettingsContext";
import { GameHeroCard } from "../../components/hub/GameHeroCard";

interface GameCard {
  id: string;
  title: string;
  category: string;
  tagline: string;
  mark: string;
  markColor: string;
  glowColor: string;
  borderHover: string;
  buttonBg: string;
  buttonHover: string;
  playable: boolean;
  playerBadge: string;
  tags: string[];
}

const GAMES: GameCard[] = [
  {
    id: "tictactoe",
    title: "TIC TAC TOE",
    category: "CLASSIC DUEL",
    tagline: "3 in a row — play locally, challenge smart AI bots, or match online with live voice chat.",
    mark: "✕",
    markColor: "text-blue-400",
    glowColor: "group-hover:shadow-[0_0_30px_rgba(59,130,246,0.22)]",
    borderHover: "hover:border-blue-500/70",
    buttonBg: "border-blue-500/80 bg-blue-500/15 text-blue-300 hover:bg-blue-500/25 hover:border-blue-400 hover:shadow-blue-500/25",
    buttonHover: "focus-visible:ring-blue-400",
    playable: true,
    playerBadge: "1-2 Players",
    tags: ["Local 2P", "AI Bot", "Online Voice"],
  },
  {
    id: "connect-four",
    title: "CONNECT FOUR",
    category: "STRATEGY GRID",
    tagline: "Drop colored discs into the 7×6 grid and connect four in a line before your opponent.",
    mark: "●",
    markColor: "text-amber-400",
    glowColor: "group-hover:shadow-[0_0_30px_rgba(245,158,11,0.22)]",
    borderHover: "hover:border-amber-500/70",
    buttonBg: "border-amber-500/80 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25 hover:border-amber-400 hover:shadow-amber-500/25",
    buttonHover: "focus-visible:ring-amber-400",
    playable: true,
    playerBadge: "1-2 Players",
    tags: ["Gravity Drop", "Smart AI", "Online Room"],
  },
  {
    id: "direction-rush",
    title: "DIRECTION RUSH",
    category: "COGNITIVE RUSH",
    tagline: "Brain training reflex test. Inhibitory control switching between leaf pointing & moving drift.",
    mark: "🍃",
    markColor: "text-emerald-400",
    glowColor: "group-hover:shadow-[0_0_30px_rgba(16,185,129,0.22)]",
    borderHover: "hover:border-emerald-500/70",
    buttonBg: "border-emerald-500/80 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 hover:border-emerald-400 hover:shadow-emerald-500/25",
    buttonHover: "focus-visible:ring-emerald-400",
    playable: true,
    playerBadge: "Solo Rush",
    tags: ["Cognitive Switch", "60s Timer", "Survival"],
  },
];

export const Hub: React.FC = () => {
  const navigate = useNavigate();
  const { settings, openSettings } = useSettings();
  const [selectedGameId, setSelectedGameId] = useState("tictactoe");
  const [soundOn, setSoundOn] = useState(!isMuted());
  const [showLanding, setShowLanding] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return window.sessionStorage.getItem("arcade_has_booted") !== "true";
    } catch {
      return false;
    }
  });

  const selectedGame = GAMES.find((g) => g.id === selectedGameId) || GAMES[0];

  const hasHover =
    typeof window !== "undefined" &&
    window.matchMedia?.("(hover: hover)").matches;

  const handleToggleSound = () => {
    const next = !soundOn;
    setMuted(!next);
    setSoundOn(next);
  };

  const handleLaunchGame = (gameId: string) => {
    if (gameId === "direction-rush") {
      navigate("/direction-rush");
    } else {
      navigate(`/start?game=${gameId}`, { state: { game: gameId } });
    }
  };

  return (
    <>
      <AnimatePresence>
        {showLanding && (
          <motion.div
            key="landing-overlay"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.04 }}
            transition={{ duration: 0.45 }}
            className="fixed inset-0 z-50 overflow-hidden"
          >
            <Landing onEnter={() => setShowLanding(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative min-h-[100dvh] w-full overflow-x-hidden bg-zinc-950 text-gray-100 flex flex-col justify-between px-4 py-6 sm:py-10">
        <Toaster />

        {/* Cyber Matrix Trail Background */}
        {settings.matrixRain && <MatrixBackground opacity={settings.matrixOpacity} />}
        <RetroGrid variant="hub" intensity="subtle" />

        {/* Ambient background glow accents */}
        <div className="pointer-events-none fixed -top-40 left-1/2 h-[450px] w-[700px] -translate-x-1/2 rounded-full bg-blue-600/10 blur-[130px]" />
        <div className="pointer-events-none fixed top-80 right-[-100px] h-[350px] w-[450px] rounded-full bg-violet-600/10 blur-[120px]" />
        <div className="pointer-events-none fixed bottom-10 left-[-80px] h-[350px] w-[450px] rounded-full bg-emerald-600/10 blur-[120px]" />

        {/* Main Container */}
        <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center gap-8 sm:gap-10">
          {/* Header Hero Section */}
          <motion.header
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="flex flex-col items-center text-center gap-3 max-w-2xl"
          >
            {/* Top Bar with Status and Profile Settings Pill */}
            <div className="flex flex-wrap items-center justify-center gap-2.5">
              <div className="inline-flex items-center gap-2 rounded-full border border-zinc-700/80 bg-zinc-900/90 px-3.5 py-1 text-xs font-semibold text-zinc-300 shadow-inner backdrop-blur-md">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>ARCADE PLATFORM • 3 GAMES LIVE</span>
              </div>

              <button
                type="button"
                onClick={() => {
                  playEffect("click");
                  openSettings();
                }}
                aria-label="Open arcade settings"
                className="inline-flex items-center gap-2 rounded-full border border-zinc-700/80 bg-zinc-900/90 px-3.5 py-1 text-xs font-semibold text-zinc-200 hover:border-cyan-400 hover:text-cyan-300 transition shadow-inner backdrop-blur-md focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                <span className="text-sm">{settings.avatar}</span>
                <span>{settings.playerName}</span>
                <span className="text-zinc-500 hover:text-zinc-300">⚙️</span>
              </button>
            </div>

            {/* Main Title */}
            <h1 className="animate-pop text-4xl font-black tracking-tight sm:text-6xl">
              <span className="bg-gradient-to-r from-blue-400 via-gray-100 to-rose-400 bg-clip-text text-transparent">
                ARCADE HUB
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              Multiplayer classics, reflex sprints, and brain training. Play locally on one screen,
              battle adaptive AI bots, or jump online with live voice rooms.
            </p>
          </motion.header>

          {/* Cinematic Featured Game Showcase */}
          <GameHeroCard game={selectedGame} onPlay={handleLaunchGame} />

          {/* Section Heading & Selector */}
          <div className="w-full flex items-center justify-between border-b border-zinc-800/80 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-zinc-300">
                All Games
              </span>
              <span className="text-[10px] font-bold text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded-full border border-zinc-800">
                3 Total
              </span>
            </div>
            <span className="text-[11px] text-zinc-400 hidden sm:inline font-medium">
              Click any game card to preview or play
            </span>
          </div>

          {/* Game Cards Grid (Centered & Symmetrical) */}
          <section
            aria-label="Arcade Games"
            className="flex flex-wrap justify-center gap-5 sm:gap-6 w-full"
          >
            {GAMES.map((game, index) => {
              const isSelected = game.id === selectedGameId;
              return (
                <motion.div
                  key={game.id}
                  data-testid={`hub-card-${game.id}`}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: index * 0.08, ease: "easeOut" }}
                  whileHover={game.playable && hasHover ? { y: -6 } : undefined}
                  onClick={() => setSelectedGameId(game.id)}
                  className={`group relative flex w-full sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)] max-w-sm flex-col justify-between rounded-3xl border-2 p-6 transition-all duration-300 backdrop-blur-md cursor-pointer ${
                    isSelected
                      ? "ring-2 ring-cyan-500/60 border-cyan-500/80 bg-zinc-900/95 shadow-[0_0_25px_rgba(6,182,212,0.2)]"
                      : game.playable
                        ? `border-zinc-800/90 bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 shadow-xl ${game.borderHover} ${game.glowColor}`
                        : "border-zinc-800/60 bg-zinc-950/40 opacity-60 cursor-not-allowed"
                  }`}
                >
                  {/* Card Header: Category & Mode Badge */}
                  <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                      {game.category}
                    </span>
                    <span className="rounded-md border border-zinc-700/60 bg-zinc-800/60 px-2 py-0.5 text-[10px] font-bold text-zinc-300">
                      {game.playerBadge}
                    </span>
                  </div>

                  {/* Card Center: Large Emblem & Typography */}
                  <div className="my-5 flex flex-col items-center text-center">
                    <div className="mb-3 flex h-20 w-20 items-center justify-center rounded-2xl border border-zinc-700/60 bg-zinc-800/50 shadow-inner transition-transform duration-300 group-hover:scale-110">
                      <span
                        aria-hidden="true"
                        className={`select-none text-4xl sm:text-5xl font-black ${game.markColor}`}
                      >
                        {game.mark}
                      </span>
                    </div>

                    <h2 className="text-xl font-black tracking-wide text-gray-100 sm:text-2xl">
                      {game.title}
                    </h2>
                    <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                      {game.tagline}
                    </p>
                  </div>

                  {/* Card Chips */}
                  <div className="mb-4 flex flex-wrap justify-center gap-1.5">
                    {game.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md border border-zinc-800/90 bg-zinc-900/70 px-2 py-0.5 text-[10px] font-semibold text-zinc-400"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Card CTA */}
                  <div className="pt-2">
                    {game.playable ? (
                      <button
                        type="button"
                        aria-label="Play"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLaunchGame(game.id);
                        }}
                        className={`flex w-full items-center justify-center gap-2 rounded-xl border-2 py-2.5 text-sm font-extrabold shadow-md transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus-visible:ring-2 ${game.buttonBg} ${game.buttonHover}`}
                      >
                        <span>Play</span>
                        <span className="text-xs transition-transform group-hover:translate-x-0.5">→</span>
                      </button>
                    ) : (
                      <div className="flex w-full items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/40 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-500">
                        Coming soon
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </section>
        </div>

        {/* Footer Controls & Info */}
        <footer className="relative z-10 mx-auto mt-12 flex w-full max-w-5xl flex-col sm:flex-row items-center justify-between gap-4 border-t border-zinc-800/80 pt-6 text-xs text-zinc-400">
          <div className="flex items-center gap-2 text-zinc-400">
            <span>🎮 Arcade Web Suite</span>
            <span>•</span>
            <span>Fast, Responsive & Zero Dependencies</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                playEffect("click");
                openSettings();
              }}
              aria-label="Open arcade settings"
              className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition-all hover:border-cyan-500/50 hover:bg-zinc-800 hover:text-cyan-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <span>⚙️</span>
              <span>Settings</span>
            </button>

            <button
              type="button"
              onClick={() => setShowLanding(true)}
              aria-label="Replay intro title screen"
              className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition-all hover:border-cyan-500/50 hover:bg-zinc-800 hover:text-cyan-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <span>🎬</span>
              <span>Title Screen</span>
            </button>

            <button
              type="button"
              onClick={handleToggleSound}
              aria-label={soundOn ? "Mute arcade sound effects" : "Unmute arcade sound effects"}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-xs font-semibold text-zinc-300 transition-all hover:border-zinc-700 hover:bg-zinc-800"
            >
              <span>{soundOn ? "🔊" : "🔇"}</span>
              <span>Sound {soundOn ? "On" : "Off"}</span>
            </button>
          </div>
        </footer>
      </div>
    </>
  );
};
