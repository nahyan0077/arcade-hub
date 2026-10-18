import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./start.css";
import toast, { Toaster } from "react-hot-toast";
import { AIDIFFICULTIES, PERSONALITIES } from "../../engine";
import type { AIDifficulty } from "../../engine";

type GameMode = "pvp" | "pve";

const optionClass = (active: boolean): string =>
  `rounded-lg border-2 px-4 py-2 text-sm font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
    active
      ? "border-blue-500 bg-blue-500/15 text-blue-300"
      : "border-zinc-600 text-zinc-400 hover:border-zinc-400 hover:text-gray-200"
  }`;

export const Start = () => {
  const navigate = useNavigate();

  const [playerType, setPlayerType] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<GameMode>("pvp");
  const [difficulty, setDifficulty] = useState<AIDifficulty>("medium");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (playerType && inputRef.current) {
      inputRef.current.focus();
    }
  }, [playerType]);

  const handleSelectPlayerType = (type: string) => {
    setPlayerType(type);
  };

  const handleStart = () => {
    if (!name) {
      toast.error("Please Enter your name", {
        icon: "❌ ",
        style: {
          borderRadius: "10px",
          background: "#030303",
          color: "#fff",
        },
      });
      return;
    }else if(!playerType){
        toast.error("Please select the player type", {
            icon: "❌ ",
            style: {
              borderRadius: "10px",
              background: "#030303",
              color: "#fff",
            },
          });
          return
    }
    navigate("/game", { state: { playerType, name, mode, difficulty } });
  };

  return (
    <div className="flex flex-col mx-auto min-h-[100dvh] justify-center justify-items-center items-center bg-zinc-900 px-4">
        <div className="flex justify-center gap-8 sm:gap-16 md:gap-24 w-full pb-6 sm:pb-10" > 
            <h2 className="text-3xl sm:text-4xl md:text-5xl text-blue-600 font-extrabold" > TIC </h2>
            <h2 className="text-3xl sm:text-4xl md:text-5xl text-gray-100 font-extrabold" > TAC </h2>
            <h2 className="text-3xl sm:text-4xl md:text-5xl text-red-600 font-extrabold" > TOE </h2>
        </div>
      <Toaster />

      <div className="flex gap-4">

        <button
          type="button"
          aria-label="Play as X"
          aria-pressed={playerType === "X"}
          className={`box-content h-20 w-20 p-4 border-4 mb-8 text-center rounded-xl bg-gray-300 hover:bg-gray-200 text-7xl font-semibold cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-400 ${
            playerType === "X"
              ? "border-blue-600 bg-blue-100 text-blue-600"
              : "border-gray-500 text-blue-600"
          }`}
          onClick={() => handleSelectPlayerType("X")}
        >
          X
        </button>

        <button
          type="button"
          aria-label="Play as O"
          aria-pressed={playerType === "O"}
          className={`box-content h-20 w-20 p-4 border-4 mb-8 text-center rounded-xl bg-gray-300 hover:bg-gray-200 text-7xl font-semibold cursor-pointer focus:outline-none focus-visible:ring-4 focus-visible:ring-red-400 ${
            playerType === "O"
              ? "border-red-600 bg-red-100 text-red-600"
              : "border-gray-500 text-red-600"
          }`}
          onClick={() => handleSelectPlayerType("O")}
        >
          O
        </button>
      </div>
      <>
        <input
          className="box-content h-12 w-64 max-w-full p-4 border-4 border-gray-500 mb-6 text-center rounded-xl bg-gray-300 hover:bg-gray-200 text-2xl sm:text-4xl font-extrabold text-gray-900 focus:outline-none"
          placeholder="Enter your name"
          style={{ textTransform: "uppercase" }}
          ref={inputRef}
          onChange={(e) => setName(e.target.value)}
        />

        <div className="mb-4 flex gap-3" role="group" aria-label="Opponent type">
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

        <button
          type="button"
          className="text-gray-500 cursor-pointer hover:text-gray-300"
          onClick={handleStart}
        >
          Start Game
        </button>
      </>
    </div>
  );
};
