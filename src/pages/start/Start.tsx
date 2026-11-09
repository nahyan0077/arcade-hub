import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import "./start.css";
import toast, { Toaster } from "react-hot-toast";
import { AIDIFFICULTIES, PERSONALITIES } from "../../engine";
import type { AIDifficulty } from "../../engine";
import { C4_DIFFICULTIES } from "../../engine/connect-four/types";
import type { C4Difficulty } from "../../engine/connect-four/types";
import { RACE_AI_PERSONALITIES, RACE_DIFFICULTIES } from "../../engine/arrow-race";
import type { RaceDifficulty } from "../../engine/arrow-race";
import { useOnlineSession } from "../../net/OnlineSessionContext";
import {
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
} from "../../net/protocol";

type GameMode = "pvp" | "pve" | "online" | "quick";
type OnlineAction = "create" | "join";
type StartGame = "tictactoe" | "connect-four" | "arrow-race";

const quickPlayEnabled = (): boolean => Boolean(import.meta.env.VITE_WS_URL);

const optionClass = (active: boolean): string =>
  `rounded-lg border-2 px-4 py-2 text-sm font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
    active
      ? "border-blue-500 bg-blue-500/15 text-blue-300"
      : "border-zinc-600 text-zinc-400 hover:border-zinc-400 hover:text-gray-200"
  }`;

export const Start = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { openRoom } = useOnlineSession();

  const paramGame = searchParams.get("game");
  const rawGame =
    ((location.state as { game?: string } | null)?.game) ??
    paramGame;
  const game: StartGame =
    rawGame === "connect-four"
      ? "connect-four"
      : rawGame === "arrow-race"
        ? "arrow-race"
        : "tictactoe";
  const isC4 = game === "connect-four";
  const isRace = game === "arrow-race";
  // Arrow Race has no local 2P mode — only vs AI or online.
  const local2P = !isRace;

  const [playerType, setPlayerType] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<GameMode>("pvp");
  const [difficulty, setDifficulty] = useState<AIDifficulty | C4Difficulty | RaceDifficulty>(
    "medium",
  );
  const [onlineAction, setOnlineAction] = useState<OnlineAction>("create");
  const [joinCode, setJoinCode] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

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
    const trimmedName = name.trim();
    if (!trimmedName) {
      showToast("Please Enter your name");
      return;
    }
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
    if (isRace) {
      navigate("/arrow-race", {
        state: { name: trimmedName, mode: effectiveMode, difficulty },
      });
      return;
    }
    if (isC4) {
      navigate("/connect-four", { state: { name: trimmedName, mode, difficulty } });
      return;
    }
    navigate("/game", { state: { playerType, name: trimmedName, mode, difficulty } });
  };

  const showMarkPicker = local2P && !isC4 && (mode === "pvp" || mode === "pve");
  const difficulties = isRace
    ? RACE_DIFFICULTIES
    : isC4
      ? C4_DIFFICULTIES
      : AIDIFFICULTIES;
  const personalityName = (level: string): string => {
    if (isRace) {
      return RACE_AI_PERSONALITIES[level as RaceDifficulty]?.name ?? level;
    }
    return PERSONALITIES[level as AIDifficulty]?.name ?? level;
  };

  // Race defaults to vs AI when the player has not picked a local mode yet.
  const effectiveMode: GameMode = isRace && mode === "pvp" ? "pve" : mode;
  const showPvpButton = local2P;

  return (
    <div className="relative flex flex-col mx-auto min-h-[100dvh] justify-center items-center bg-zinc-900 px-4 py-4 overflow-hidden">
      {/* Background glow */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-96 w-96 rounded-full bg-blue-500/10 blur-3xl"
        aria-hidden="true"
      />

      {/* Top Bar with Hub Exit */}
      <div className="w-full max-w-md flex items-center justify-between mb-4 z-10">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-1.5 text-xs font-bold text-zinc-300 transition-all hover:border-zinc-500 hover:bg-zinc-700 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          aria-label="Back to hub"
        >
          <span>← Hub</span>
        </button>
        <span className="text-[11px] font-semibold tracking-widest uppercase text-zinc-500">
          Match Setup
        </span>
      </div>

      <div className="w-full max-w-md rounded-2xl border border-zinc-800/90 bg-zinc-900/80 p-5 sm:p-7 shadow-2xl backdrop-blur-md flex flex-col items-center z-10">
        <div className="flex justify-center gap-4 sm:gap-6 w-full pb-4 sm:pb-6 select-none">
          {isRace ? (
            <>
              <h2 className="text-3xl sm:text-4xl text-violet-500 font-extrabold tracking-wider"> ARROW </h2>
              <h2 className="text-3xl sm:text-4xl text-gray-100 font-extrabold tracking-wider"> RACE </h2>
            </>
          ) : isC4 ? (
            <>
              <h2 className="text-3xl sm:text-4xl text-yellow-500 font-extrabold tracking-wider"> CONNECT </h2>
              <h2 className="text-3xl sm:text-4xl text-gray-100 font-extrabold tracking-wider"> FOUR </h2>
            </>
          ) : (
            <>
              <h2 className="text-3xl sm:text-4xl text-blue-500 font-extrabold tracking-wider"> TIC </h2>
              <h2 className="text-3xl sm:text-4xl text-gray-100 font-extrabold tracking-wider"> TAC </h2>
              <h2 className="text-3xl sm:text-4xl text-red-500 font-extrabold tracking-wider"> TOE </h2>
            </>
          )}
        </div>
        <Toaster />

        {showMarkPicker && (
          <div className="flex gap-4 mb-4 sm:mb-5">
            <button
              type="button"
              aria-label="Play as X"
              aria-pressed={playerType === "X"}
              className={`box-content h-16 w-16 sm:h-20 sm:w-20 p-2 sm:p-3 border-2 text-center rounded-2xl text-4xl sm:text-6xl font-black cursor-pointer transition-all hover:scale-105 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-400 ${
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
              className={`box-content h-16 w-16 sm:h-20 sm:w-20 p-2 sm:p-3 border-2 text-center rounded-2xl text-4xl sm:text-6xl font-black cursor-pointer transition-all hover:scale-105 focus:outline-none focus-visible:ring-4 focus-visible:ring-red-400 ${
                playerType === "O"
                  ? "border-red-500 bg-red-500/20 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.35)] ring-2 ring-red-500/40"
                  : "border-zinc-700 bg-zinc-800/80 text-zinc-500 hover:border-zinc-500 hover:text-red-400 hover:bg-zinc-800"
              }`}
              onClick={() => setPlayerType("O")}
            >
              O
            </button>
          </div>
        )}
        {!showMarkPicker && <div className="mb-2" aria-hidden="true" />}

        <input
          className="h-12 w-64 max-w-full px-4 border-2 border-zinc-700 mb-4 sm:mb-5 text-center rounded-xl bg-zinc-800/90 hover:border-zinc-500 text-xl sm:text-2xl font-bold tracking-wider text-gray-100 placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
          placeholder="Enter your name"
          maxLength={24}
          style={{ textTransform: "uppercase" }}
          ref={inputRef}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="mb-4 flex flex-wrap justify-center gap-2 sm:gap-3" role="group" aria-label="Game mode">
          {showPvpButton && (
            <button
              type="button"
              aria-pressed={mode === "pvp"}
              className={optionClass(mode === "pvp")}
              onClick={() => setMode("pvp")}
            >
              2 Players
            </button>
          )}
          <button
            type="button"
            aria-pressed={effectiveMode === "pve"}
            className={optionClass(effectiveMode === "pve")}
            onClick={() => setMode("pve")}
          >
            vs AI
          </button>
          <button
            type="button"
            aria-pressed={mode === "online"}
            className={optionClass(mode === "online")}
            onClick={() => setMode("online")}
          >
            Online
          </button>
          {quickPlayEnabled() && (
            <button
              type="button"
              aria-pressed={mode === "quick"}
              className={optionClass(mode === "quick")}
              onClick={() => setMode("quick")}
            >
              Quick Play
            </button>
          )}
        </div>

        {(effectiveMode === "pve" || (isRace && mode !== "online" && mode !== "quick")) && (
          <div className="mb-4 flex flex-wrap justify-center gap-1.5 sm:gap-2" role="group" aria-label="AI difficulty">
            {difficulties.map((level) => (
              <button
                key={level}
                type="button"
                aria-pressed={difficulty === level}
                title={`AI personality: ${personalityName(level)}`}
                className={optionClass(difficulty === level)}
                onClick={() => setDifficulty(level)}
              >
                {level.toUpperCase()}
              </button>
            ))}
          </div>
        )}

        {mode === "online" && (
          <div className="mb-4 flex flex-col items-center gap-3 w-full" role="group" aria-label="Online room">
            <div className="flex gap-2 sm:gap-3">
              <button
                type="button"
                aria-pressed={onlineAction === "create"}
                className={optionClass(onlineAction === "create")}
                onClick={() => setOnlineAction("create")}
              >
                Create Room
              </button>
              <button
                type="button"
                aria-pressed={onlineAction === "join"}
                className={optionClass(onlineAction === "join")}
                onClick={() => setOnlineAction("join")}
              >
                Join Room
              </button>
            </div>
            {onlineAction === "join" && (
              <input
                className="h-11 w-56 max-w-full rounded-lg border-2 border-zinc-600 bg-zinc-800 px-3 text-center text-lg font-bold uppercase tracking-widest text-gray-100 placeholder:normal-case placeholder:tracking-normal placeholder:text-zinc-500 focus:border-blue-500 focus:outline-none"
                placeholder="Room code"
                aria-label="Room code"
                maxLength={7}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              />
            )}
          </div>
        )}

        <button
          type="button"
          className="mt-1 w-64 max-w-full rounded-xl bg-blue-600 px-8 py-3 text-base sm:text-lg font-extrabold text-white shadow-lg shadow-blue-500/25 transition-all hover:scale-105 hover:bg-blue-500 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-400 active:scale-95"
          onClick={handleStart}
        >
          Start Game
        </button>
      </div>
    </div>
  );
};
