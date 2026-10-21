import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./start.css";
import toast, { Toaster } from "react-hot-toast";
import { AIDIFFICULTIES, PERSONALITIES } from "../../engine";
import type { AIDifficulty } from "../../engine";
import { useOnlineSession } from "../../net/OnlineSessionContext";
import {
  generateRoomCode,
  isValidRoomCode,
  normalizeRoomCode,
} from "../../net/protocol";

type GameMode = "pvp" | "pve" | "online" | "quick";
type OnlineAction = "create" | "join";

const quickPlayEnabled = (): boolean => Boolean(import.meta.env.VITE_WS_URL);

const optionClass = (active: boolean): string =>
  `rounded-lg border-2 px-4 py-2 text-sm font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
    active
      ? "border-blue-500 bg-blue-500/15 text-blue-300"
      : "border-zinc-600 text-zinc-400 hover:border-zinc-400 hover:text-gray-200"
  }`;

export const Start = () => {
  const navigate = useNavigate();
  const { openRoom } = useOnlineSession();

  const [playerType, setPlayerType] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<GameMode>("pvp");
  const [difficulty, setDifficulty] = useState<AIDifficulty>("medium");
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
    if (!name) {
      showToast("Please Enter your name");
      return;
    }
    if (mode === "quick") {
      navigate("/queue", { state: { name } });
      return;
    }
    if (mode === "online") {
      if (onlineAction === "join") {
        const code = normalizeRoomCode(joinCode);
        if (!isValidRoomCode(code)) {
          showToast("Enter a valid 6-character room code");
          return;
        }
        openRoom({ role: "guest", roomCode: code, name });
      } else {
        openRoom({ role: "host", roomCode: generateRoomCode(), name });
      }
      navigate("/lobby");
      return;
    }
    if (!playerType) {
      showToast("Please select the player type");
      return;
    }
    navigate("/game", { state: { playerType, name, mode, difficulty } });
  };

  return (
    <div className="animate-fade-in flex flex-col mx-auto min-h-[100dvh] justify-center justify-items-center items-center bg-zinc-900 px-4">
        <div className="flex justify-center gap-8 sm:gap-16 md:gap-24 w-full pb-6 sm:pb-10" >
            <h2 className="animate-pop text-3xl sm:text-4xl md:text-5xl text-blue-600 font-extrabold" > TIC </h2>
            <h2 className="animate-pop text-3xl sm:text-4xl md:text-5xl text-gray-100 font-extrabold" style={{ animationDelay: "90ms" }} > TAC </h2>
            <h2 className="animate-pop text-3xl sm:text-4xl md:text-5xl text-red-600 font-extrabold" style={{ animationDelay: "180ms" }} > TOE </h2>
        </div>
      <Toaster />

      {(mode === "pvp" || mode === "pve") && (
        <div className="flex gap-4">
          <button
            type="button"
            aria-label="Play as X"
            aria-pressed={playerType === "X"}
            className={`box-content h-20 w-20 p-4 border-4 mb-8 text-center rounded-xl bg-gray-300 hover:bg-gray-200 text-7xl font-semibold cursor-pointer transition-transform hover:scale-105 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-400 ${
              playerType === "X"
                ? "border-blue-600 bg-blue-100 text-blue-600"
                : "border-gray-500 text-blue-600"
            }`}
            onClick={() => setPlayerType("X")}
          >
            X
          </button>

          <button
            type="button"
            aria-label="Play as O"
            aria-pressed={playerType === "O"}
            className={`box-content h-20 w-20 p-4 border-4 mb-8 text-center rounded-xl bg-gray-300 hover:bg-gray-200 text-7xl font-semibold cursor-pointer transition-transform hover:scale-105 focus:outline-none focus-visible:ring-4 focus-visible:ring-red-400 ${
              playerType === "O"
                ? "border-red-600 bg-red-100 text-red-600"
                : "border-gray-500 text-red-600"
            }`}
            onClick={() => setPlayerType("O")}
          >
            O
          </button>
        </div>
      )}
      {(mode === "online" || mode === "quick") && (
        <div className="mb-8" aria-hidden="true" />
      )}

      <>
        <input
          className="box-content h-12 w-64 max-w-full p-4 border-4 border-gray-500 mb-6 text-center rounded-xl bg-gray-300 hover:bg-gray-200 text-2xl sm:text-4xl font-extrabold text-gray-900 focus:outline-none"
          placeholder="Enter your name"
          style={{ textTransform: "uppercase" }}
          ref={inputRef}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="mb-4 flex flex-wrap justify-center gap-3" role="group" aria-label="Game mode">
          <button
            type="button"
            aria-pressed={mode === "pvp"}
            className={optionClass(mode === "pvp")}
            onClick={() => setMode("pvp")}
          >
            2 Players
          </button>
          <button
            type="button"
            aria-pressed={mode === "pve"}
            className={optionClass(mode === "pve")}
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

        {mode === "pve" && (
          <div className="mb-4 flex flex-wrap justify-center gap-2" role="group" aria-label="AI difficulty">
            {AIDIFFICULTIES.map((level) => (
              <button
                key={level}
                type="button"
                aria-pressed={difficulty === level}
                title={`AI personality: ${PERSONALITIES[level].name}`}
                className={optionClass(difficulty === level)}
                onClick={() => setDifficulty(level)}
              >
                {level.toUpperCase()}
              </button>
            ))}
          </div>
        )}

        {mode === "online" && (
          <div className="mb-4 flex flex-col items-center gap-3" role="group" aria-label="Online room">
            <div className="flex gap-3">
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
          className="mt-2 w-64 max-w-full rounded-xl bg-blue-600 px-8 py-3 text-lg font-extrabold text-white shadow-lg shadow-blue-500/25 transition-all hover:scale-105 hover:bg-blue-500 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-400"
          onClick={handleStart}
        >
          Start Game
        </button>
      </>
    </div>
  );
};