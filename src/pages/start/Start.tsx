import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import "./start.css";
import toast, { Toaster } from "react-hot-toast";
import { AIDIFFICULTIES, PERSONALITIES } from "../../engine";
import type { AIDifficulty } from "../../engine";
import { C4_DIFFICULTIES, C4_PERSONALITIES } from "../../engine/connect-four/types";
import type { C4Difficulty } from "../../engine/connect-four/types";
import { useOnlineSession } from "../../net/OnlineSessionContext";
import { useSettings } from "../../settings/SettingsContext";
import { playEffect } from "../../sound/audio";
import { RetroGrid } from "../../components/RetroGrid";
import {
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
} from "../../net/protocol";

type GameMode = "pvp" | "pve" | "online" | "quick";
type OnlineAction = "create" | "join";
type StartGame = "tictactoe" | "connect-four";

const quickPlayEnabled = (): boolean => Boolean(import.meta.env.VITE_WS_URL);

export const Start = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { openRoom } = useOnlineSession();
  const { settings, updateSettings, openSettings } = useSettings();

  const paramGame = searchParams.get("game");
  const rawGame =
    ((location.state as { game?: string } | null)?.game) ??
    paramGame;
  const game: StartGame =
    rawGame === "connect-four"
      ? "connect-four"
      : "tictactoe";
  const isC4 = game === "connect-four";
  const local2P = true;

  const [playerType, setPlayerType] = useState("");
  const [name, setName] = useState(() => {
    return settings.playerName && settings.playerName !== "Player 1" ? settings.playerName : "";
  });
  const [mode, setMode] = useState<GameMode>("pvp");
  const [difficulty, setDifficulty] = useState<AIDifficulty | C4Difficulty>(() => {
    if (isC4) {
      return (
        settings.c4Difficulty ??
        (settings.defaultDifficulty === "impossible" ? "hard" : settings.defaultDifficulty)
      );
    }
    return settings.tttDifficulty ?? settings.defaultDifficulty;
  });
  const [onlineAction, setOnlineAction] = useState<OnlineAction>("create");
  const [joinCode, setJoinCode] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!name && settings.playerName && settings.playerName !== "Player 1") {
      setName(settings.playerName);
    }
  }, [settings.playerName, name]);

  useEffect(() => {
    if (playerType && inputRef.current) {
      inputRef.current.focus();
    }
  }, [playerType]);

  const showToast = (message: string) => {
    toast.error(message, {
      icon: "❌ ",
      style: {
        borderRadius: "10px",
        background: "#030303",
        color: "#fff",
      },
    });
  };

  const handleStart = () => {
    const rawName = name.trim() || (settings.playerName && settings.playerName !== "Player 1" ? settings.playerName.trim() : "");
    if (!rawName) {
      showToast("Please Enter your name");
      return;
    }
    const trimmedName = rawName;
    updateSettings({ playerName: trimmedName });
    if (mode === "quick") {
      navigate("/queue", { state: { name: trimmedName, game } });
      return;
    }
    if (mode === "online") {
      if (onlineAction === "join") {
        const code = normalizeRoomCode(joinCode);
        if (!isValidRoomCode(code)) {
          showToast("Enter a valid 6-character room code");
          return;
        }
        openRoom({ role: "guest", roomCode: code, name: trimmedName, game });
      } else {
        openRoom({ role: "host", roomCode: generateRoomCode(), name: trimmedName, game });
      }
      navigate("/lobby");
      return;
    }
    if (local2P && !isC4 && !playerType) {
      showToast("Please select the player type");
      return;
    }
    if (isC4) {
      navigate("/connect-four", {
        state: { name: trimmedName, playerType: playerType || "X", mode, difficulty },
      });
      return;
    }
    navigate("/game", { state: { playerType, name: trimmedName, mode, difficulty } });
  };

  const showMarkPicker = local2P && !isC4 && (mode === "pvp" || mode === "pve");
  const difficulties = isC4 ? C4_DIFFICULTIES : AIDIFFICULTIES;
  const personalityName = (level: string): string => {
    if (isC4) {
      return C4_PERSONALITIES[level as C4Difficulty]?.name ?? level;
    }
    return PERSONALITIES[level as AIDifficulty]?.name ?? level;
  };

  const effectiveMode: GameMode = mode;
  const showPvpButton = true;

  return (
    <main className="relative flex flex-col mx-auto min-h-[100dvh] justify-center items-center bg-zinc-950 px-3 sm:px-4 py-2 sm:py-4 overflow-hidden text-gray-100">
      {/* Dynamic ambient retro grid */}
      <RetroGrid variant={isC4 ? "c4" : "ttt"} />

      {/* Top Bar with Hub Exit & Settings */}
      <div className="w-full max-w-xl flex items-center justify-between mb-2 sm:mb-3 z-10 px-1">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-xs font-bold text-zinc-300 transition-all hover:border-zinc-600 hover:bg-zinc-800 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          aria-label="Back to hub"
        >
          <span>← Hub</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] font-black tracking-widest uppercase text-zinc-400">
            Battle Setup
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            playEffect("click");
            openSettings();
          }}
          aria-label="Open settings"
          className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-xs font-bold text-zinc-300 transition-all hover:border-cyan-400 hover:text-cyan-300"
        >
          <span>{settings.avatar}</span>
          <span>⚙️</span>
        </button>
      </div>

      {/* Main Glassmorphism Card */}
      <div className="w-full max-w-xl rounded-3xl border border-zinc-800/50 bg-zinc-950/25 p-3.5 sm:p-6 shadow-[0_0_50px_rgba(0,0,0,0.4)] backdrop-blur-[2px] flex flex-col items-center z-10 space-y-2.5 sm:space-y-4">
        {/* Game Title Heading */}
        <div className="flex justify-center items-center gap-3 w-full pb-0.5 select-none">
          {isC4 ? (
            <>
              <h2 className="text-2xl sm:text-3xl text-amber-400 font-black tracking-wider">CONNECT</h2>
              <h2 className="text-2xl sm:text-3xl text-white font-black tracking-wider">FOUR</h2>
            </>
          ) : (
            <>
              <h2 className="text-2xl sm:text-3xl text-blue-400 font-black tracking-wider">TIC</h2>
              <h2 className="text-2xl sm:text-3xl text-white font-black tracking-wider">TAC</h2>
              <h2 className="text-2xl sm:text-3xl text-red-500 font-black tracking-wider">TOE</h2>
            </>
          )}
        </div>

        <Toaster />

        {/* STEP 1: Game Mode Cards */}
        <div className="w-full flex flex-col gap-1.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 px-1">
            Step 1: Choose How to Play
          </div>
          <div
            className={`${
              quickPlayEnabled()
                ? "grid grid-cols-2 sm:grid-cols-4"
                : "grid grid-cols-3"
            } gap-2 sm:gap-2.5 w-full justify-center items-stretch`}
            role="group"
            aria-label="Game mode"
          >
            {showPvpButton && (
              <button
                type="button"
                aria-label="2 Players"
                aria-pressed={mode === "pvp"}
                onClick={() => setMode("pvp")}
                className={`flex flex-col items-center justify-center p-2 sm:p-3 rounded-xl sm:rounded-2xl border-2 transition-all text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                  mode === "pvp"
                    ? "border-blue-500 bg-blue-500/20 text-white shadow-[0_0_15px_rgba(59,130,246,0.25)] ring-1 ring-blue-400/50 scale-[1.02]"
                    : "border-zinc-800 bg-zinc-800/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200 hover:bg-zinc-800/70"
                }`}
              >
                <span aria-hidden="true" className="text-base sm:text-xl mb-0.5 sm:mb-1 select-none">👥</span>
                <span className="text-xs font-black">2 Players</span>
                <span aria-hidden="true" className="text-[10px] text-zinc-400 font-medium hidden sm:inline">Pass & Play</span>
              </button>
            )}

            <button
              type="button"
              aria-label="vs AI"
              aria-pressed={effectiveMode === "pve"}
              onClick={() => setMode("pve")}
              className={`flex flex-col items-center justify-center p-2 sm:p-3 rounded-xl sm:rounded-2xl border-2 transition-all text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                effectiveMode === "pve"
                  ? "border-purple-500 bg-purple-500/20 text-white shadow-[0_0_15px_rgba(168,85,247,0.25)] ring-1 ring-purple-400/50 scale-[1.02]"
                  : "border-zinc-800 bg-zinc-800/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200 hover:bg-zinc-800/70"
              }`}
            >
              <span aria-hidden="true" className="text-base sm:text-xl mb-0.5 sm:mb-1 select-none">🤖</span>
              <span className="text-xs font-black">vs AI</span>
              <span aria-hidden="true" className="text-[10px] text-zinc-400 font-medium hidden sm:inline">Solo Match</span>
            </button>

            <button
              type="button"
              aria-label="Online"
              aria-pressed={mode === "online"}
              onClick={() => setMode("online")}
              className={`flex flex-col items-center justify-center p-2 sm:p-3 rounded-xl sm:rounded-2xl border-2 transition-all text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                mode === "online"
                  ? "border-emerald-500 bg-emerald-500/20 text-white shadow-[0_0_15px_rgba(16,185,129,0.25)] ring-1 ring-emerald-400/50 scale-[1.02]"
                  : "border-zinc-800 bg-zinc-800/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200 hover:bg-zinc-800/70"
              }`}
            >
              <span aria-hidden="true" className="text-base sm:text-xl mb-0.5 sm:mb-1 select-none">🌐</span>
              <span className="text-xs font-black">Online</span>
              <span aria-hidden="true" className="text-[10px] text-zinc-400 font-medium hidden sm:inline">Host or Join</span>
            </button>

            {quickPlayEnabled() && (
              <button
                type="button"
                aria-label="Quick Play"
                aria-pressed={mode === "quick"}
                onClick={() => setMode("quick")}
                className={`flex flex-col items-center justify-center p-2 sm:p-3 rounded-xl sm:rounded-2xl border-2 transition-all text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                  mode === "quick"
                    ? "border-amber-500 bg-amber-500/20 text-white shadow-[0_0_15px_rgba(245,158,11,0.25)] ring-1 ring-amber-400/50 scale-[1.02]"
                    : "border-zinc-800 bg-zinc-800/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200 hover:bg-zinc-800/70"
                }`}
              >
                <span aria-hidden="true" className="text-base sm:text-xl mb-0.5 sm:mb-1 select-none">⚡</span>
                <span className="text-xs font-black">Quick Play</span>
                <span aria-hidden="true" className="text-[10px] text-zinc-400 font-medium hidden sm:inline">Fast Queue</span>
              </button>
            )}
          </div>
        </div>

        {/* STEP 2: Player & Match Customization */}
        <div className="w-full flex flex-col gap-2 pt-0.5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 px-1">
            Step 2: Player Setup
          </div>

          {/* Mark Selection for Tic-Tac-Toe */}
          {showMarkPicker && (
            <div className="flex flex-col items-center gap-1 w-full">
              <span className="text-xs text-zinc-400 font-medium">Pick Your Symbol</span>
              <div className="flex gap-3">
                <button
                  type="button"
                  aria-label="Play as X"
                  aria-pressed={playerType === "X"}
                  className={`box-content h-11 w-11 sm:h-14 sm:w-14 p-1.5 sm:p-2 border-2 text-center rounded-xl sm:rounded-2xl text-2xl sm:text-4xl font-black cursor-pointer transition-all hover:scale-105 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-400 ${
                    playerType === "X"
                      ? "border-blue-500 bg-blue-500/20 text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.35)] ring-2 ring-blue-500/40"
                      : "border-zinc-700 bg-zinc-800/80 text-zinc-500 hover:border-zinc-500 hover:text-blue-400 hover:bg-zinc-800"
                  }`}
                  onClick={() => setPlayerType("X")}
                >
                  X
                </button>

                <button
                  type="button"
                  aria-label="Play as O"
                  aria-pressed={playerType === "O"}
                  className={`box-content h-11 w-11 sm:h-14 sm:w-14 p-1.5 sm:p-2 border-2 text-center rounded-xl sm:rounded-2xl text-2xl sm:text-4xl font-black cursor-pointer transition-all hover:scale-105 focus:outline-none focus-visible:ring-4 focus-visible:ring-red-400 ${
                    playerType === "O"
                      ? "border-red-500 bg-red-500/20 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.35)] ring-2 ring-red-500/40"
                      : "border-zinc-700 bg-zinc-800/80 text-zinc-500 hover:border-zinc-500 hover:text-red-400 hover:bg-zinc-800"
                  }`}
                  onClick={() => setPlayerType("O")}
                >
                  O
                </button>
              </div>
            </div>
          )}

          {/* Name Input Field */}
          <div className="flex items-center justify-center w-full">
            <div className="relative w-full max-w-sm">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base select-none">
                {settings.avatar || "👤"}
              </span>
              <input
                className="h-10 sm:h-12 w-full pl-9 pr-3 sm:pl-10 sm:pr-4 border-2 border-zinc-700 text-center rounded-xl bg-zinc-800/90 hover:border-zinc-500 text-base sm:text-xl font-bold tracking-wider text-gray-100 placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
                placeholder="Enter your name"
                maxLength={24}
                style={{ textTransform: "uppercase" }}
                ref={inputRef}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>

          {/* AI Difficulty Selector */}
          {effectiveMode === "pve" && (
            <div className="flex flex-col items-center gap-1.5 w-full pt-1">
              <span className="text-xs text-zinc-400 font-medium">Difficulty Level</span>
              <div
                className="flex flex-wrap justify-center gap-2 w-full"
                role="group"
                aria-label="AI difficulty"
              >
                {difficulties.map((level) => (
                  <button
                    key={level}
                    type="button"
                    aria-pressed={difficulty === level}
                    title={`AI personality: ${personalityName(level)}`}
                    className={`rounded-xl border-2 px-3.5 py-1.5 text-xs sm:text-sm font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 ${
                      difficulty === level
                        ? "border-purple-500 bg-purple-500/25 text-purple-200 shadow-[0_0_12px_rgba(168,85,247,0.3)] ring-1 ring-purple-400/40"
                        : "border-zinc-700 bg-zinc-800/60 text-zinc-400 hover:border-zinc-500 hover:text-gray-200"
                    }`}
                    onClick={() => setDifficulty(level)}
                  >
                    {level.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Online Room Controls */}
          {mode === "online" && (
            <div
              className="flex flex-col items-center gap-3 w-full pt-1"
              role="group"
              aria-label="Online room"
            >
              <div className="flex gap-2.5">
                <button
                  type="button"
                  aria-pressed={onlineAction === "create"}
                  className={`rounded-xl border-2 px-4 py-2 text-xs sm:text-sm font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                    onlineAction === "create"
                      ? "border-emerald-500 bg-emerald-500/25 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.3)] ring-1 ring-emerald-400/40"
                      : "border-zinc-700 bg-zinc-800/60 text-zinc-400 hover:border-zinc-500 hover:text-gray-200"
                  }`}
                  onClick={() => setOnlineAction("create")}
                >
                  Create Room
                </button>
                <button
                  type="button"
                  aria-pressed={onlineAction === "join"}
                  className={`rounded-xl border-2 px-4 py-2 text-xs sm:text-sm font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                    onlineAction === "join"
                      ? "border-emerald-500 bg-emerald-500/25 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.3)] ring-1 ring-emerald-400/40"
                      : "border-zinc-700 bg-zinc-800/60 text-zinc-400 hover:border-zinc-500 hover:text-gray-200"
                  }`}
                  onClick={() => setOnlineAction("join")}
                >
                  Join Room
                </button>
              </div>

              {onlineAction === "join" && (
                <input
                  className="h-11 w-56 max-w-full rounded-xl border-2 border-zinc-700 bg-zinc-800 px-3 text-center text-lg font-bold uppercase tracking-widest text-gray-100 placeholder:normal-case placeholder:tracking-normal placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
                  placeholder="Room code"
                  aria-label="Room code"
                  maxLength={7}
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                />
              )}
            </div>
          )}
        </div>

        {/* STEP 3: Launch Action */}
        <div className="w-full pt-1 sm:pt-2 flex flex-col items-center">
          <button
            type="button"
            className="w-full max-w-sm rounded-xl sm:rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 px-6 sm:px-8 py-2.5 sm:py-3.5 text-base sm:text-lg font-black text-white shadow-xl shadow-blue-500/25 transition-all hover:scale-[1.02] hover:brightness-110 active:scale-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-cyan-400"
            onClick={handleStart}
          >
            Start Game
          </button>
        </div>
      </div>
    </main>
  );
};
