import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MatrixBackground } from "../../components/MatrixBackground";
import { isMuted, playEffect, setMuted } from "../../sound/audio";

interface LandingProps {
  onEnter?: () => void;
  autoRedirect?: boolean;
}

const BOOT_STAGES = [
  { progress: 20, label: "INITIALIZING RETRO-CORE ENGINE..." },
  { progress: 50, label: "CONNECTING PEER MULTIPLAYER RELAYS..." },
  { progress: 75, label: "CALIBRATING ADAPTIVE AI OPPONENTS..." },
  { progress: 95, label: "PREPARING 5 VIRTUAL CABINETS..." },
  { progress: 100, label: "SYSTEM OPERATIONAL // READY" },
];

export const Landing: React.FC<LandingProps> = ({ onEnter, autoRedirect = true }) => {
  const navigate = useNavigate();
  const [soundOn, setSoundOn] = useState(!isMuted());
  const [bootIndex, setBootIndex] = useState(0);
  const [progress, setProgress] = useState(15);
  const [isEntering, setIsEntering] = useState(false);

  const handleEnter = useCallback(() => {
    if (isEntering) return;
    setIsEntering(true);
    playEffect("start");
    try {
      window.sessionStorage.setItem("arcade_has_booted", "true");
    } catch {
      // ignore
    }
    setTimeout(() => {
      if (onEnter) {
        onEnter();
      } else {
        navigate("/", { replace: true });
      }
    }, 450);
  }, [isEntering, onEnter, navigate]);

  // Boot sequence animation
  useEffect(() => {
    const interval = setInterval(() => {
      setBootIndex((prev) => {
        if (prev < BOOT_STAGES.length - 1) {
          const next = prev + 1;
          setProgress(BOOT_STAGES[next].progress);
          return next;
        }
        clearInterval(interval);
        return prev;
      });
    }, 550);

    return () => clearInterval(interval);
  }, []);

  // Keyboard shortcut (Space or Enter to start)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        handleEnter();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleEnter]);

  // Auto redirect after 3.2s if enabled
  useEffect(() => {
    if (!autoRedirect) return;
    const timer = setTimeout(() => {
      handleEnter();
    }, 3200);

    return () => clearTimeout(timer);
  }, [autoRedirect, handleEnter]);

  const toggleSound = () => {
    const next = !soundOn;
    setMuted(!next);
    setSoundOn(next);
  };

  const currentStage = BOOT_STAGES[bootIndex];

  return (
    <div
      data-testid="landing-screen"
      className="relative flex min-h-[100dvh] w-full flex-col items-center justify-between overflow-hidden bg-black px-4 py-5 sm:py-7 text-gray-100 select-none"
    >
      {/* Background Matrix Rain */}
      <MatrixBackground opacity={0.28} />

      {/* Radial ambient cyber glow */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-600/15 via-zinc-950/70 to-black"
        aria-hidden="true"
      />

      {/* Laser scanline beam */}
      <div
        className="pointer-events-none absolute left-0 right-0 h-28 bg-gradient-to-b from-cyan-400/0 via-cyan-400/8 to-cyan-400/0 animate-scan"
        aria-hidden="true"
      />

      {/* Top Telemetry Header */}
      <header className="relative z-10 flex w-full max-w-5xl items-center justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 rounded-full border border-cyan-500/40 bg-zinc-900/80 px-3 py-1 text-[10px] sm:text-xs font-mono font-bold text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.2)]">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            <span>SYS.ID // ARCADE-OS v2.4</span>
          </div>
          <span className="hidden md:inline text-[11px] font-mono text-zinc-500 tracking-wider">
            [ ULTRA-LOW LATENCY ]
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleSound}
            aria-label={soundOn ? "Mute audio" : "Unmute audio"}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800/80 text-sm text-zinc-300 transition-all hover:border-zinc-500 hover:bg-zinc-700"
          >
            {soundOn ? "🔊" : "🔇"}
          </button>

          <button
            type="button"
            onClick={handleEnter}
            className="flex items-center gap-1.5 rounded-lg border border-cyan-500/50 bg-cyan-500/10 px-3 py-1.5 text-xs font-bold text-cyan-300 transition-all hover:bg-cyan-500/20 hover:border-cyan-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            aria-label="Skip to games"
          >
            <span>Skip Intro</span>
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </header>

      {/* Center Cinematic Hero */}
      <main className="relative z-10 flex flex-col items-center justify-center text-center max-w-2xl px-2 my-auto">
        {/* Emblem */}
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="relative mb-3 sm:mb-5 flex h-16 w-16 sm:h-24 sm:w-24 items-center justify-center rounded-2xl sm:rounded-3xl border-2 border-cyan-400/50 bg-zinc-900/90 shadow-[0_0_35px_rgba(6,182,212,0.35)] backdrop-blur-md"
        >
          <span className="text-3xl sm:text-5xl select-none" aria-hidden="true">
            🕹️
          </span>
          <span className="absolute -inset-1 rounded-2xl sm:rounded-3xl border border-cyan-400/30 animate-pulse pointer-events-none" />
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.05 }}
        >
          <h1 className="select-none text-3xl sm:text-6xl md:text-7xl font-black tracking-tight">
            <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-fuchsia-500 bg-clip-text text-transparent drop-shadow-[0_0_24px_rgba(59,130,246,0.4)]">
              ARCADE
            </span>{" "}
            <span className="text-white drop-shadow-[0_0_16px_rgba(255,255,255,0.4)]">
              HUB
            </span>
          </h1>

          <p className="mt-1 sm:mt-3 text-[11px] sm:text-sm md:text-base font-semibold text-zinc-400 uppercase tracking-[0.2em] sm:tracking-[0.25em]">
            Multi-Game Virtual Arena • Next-Gen Retro Platform
          </p>
        </motion.div>

        {/* Features Row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25, delay: 0.1 }}
          className="mt-4 sm:mt-6 flex flex-wrap justify-center gap-1.5 sm:gap-2.5 max-w-lg"
        >
          <span className="rounded-full border border-zinc-700/80 bg-zinc-900/80 px-2.5 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-[11px] font-bold text-zinc-300">
            ⚡ Instant Play
          </span>
          <span className="rounded-full border border-blue-500/40 bg-blue-500/10 px-2.5 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-[11px] font-bold text-blue-300">
            👥 Live Multiplayer
          </span>
          <span className="rounded-full border border-purple-500/40 bg-purple-500/10 px-2.5 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-[11px] font-bold text-purple-300">
            🤖 Neural AI
          </span>
          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-[11px] font-bold text-emerald-300">
            🎙️ Voice Chat
          </span>
        </motion.div>

        {/* Boot Diagnostic Box */}
        <motion.div
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.15 }}
          className="mt-5 sm:mt-8 w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/80 p-3.5 sm:p-5 shadow-2xl backdrop-blur-md"
        >
          <div className="flex items-center justify-between text-xs font-mono text-zinc-400 mb-2">
            <span className="font-bold text-cyan-400 tracking-wider">BOOT TELEMETRY</span>
            <span className="font-bold text-gray-200">{progress}%</span>
          </div>

          {/* Progress bar */}
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-zinc-800">
            <motion.div
              className="h-full bg-gradient-to-r from-cyan-400 via-blue-500 to-fuchsia-500 shadow-[0_0_12px_rgba(6,182,212,0.8)]"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>

          <p className="mt-2 text-[10px] sm:text-[11px] font-mono font-semibold text-zinc-400 truncate text-left">
            &gt; {currentStage.label}
          </p>
        </motion.div>

        {/* Big Action / Press Start */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.25, delay: 0.2 }}
          className="mt-5 sm:mt-6 flex flex-col items-center gap-2"
        >
          <button
            type="button"
            onClick={handleEnter}
            aria-label="Enter Arcade"
            className="group relative flex items-center justify-center gap-2.5 sm:gap-3 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 px-7 py-3 sm:px-10 sm:py-4 text-sm sm:text-lg font-black tracking-widest text-white shadow-[0_0_30px_rgba(79,70,229,0.45)] transition-all hover:scale-105 hover:shadow-[0_0_40px_rgba(79,70,229,0.65)] focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-400 active:scale-95"
          >
            <span>ENTER ARCADE</span>
            <span className="transition-transform group-hover:translate-x-1" aria-hidden="true">
              →
            </span>
          </button>
          <span className="text-[10px] sm:text-xs font-mono text-zinc-500 tracking-wider">
            [PRESS SPACE OR ENTER TO START]
          </span>
        </motion.div>
      </main>

      {/* Footer Info */}
      <footer className="relative z-10 flex w-full max-w-5xl items-center justify-between text-[10px] sm:text-xs font-mono text-zinc-500">
        <div>AUTONOMIZE // ARCADE-HUB</div>
        <div>READY FOR PLAYER ONE</div>
      </footer>

      {/* Transition flash overlay when entering */}
      <AnimatePresence>
        {isEntering && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="fixed inset-0 z-50 bg-black pointer-events-none"
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Landing;
