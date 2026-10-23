import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ConnectFourBoard } from "../../components/ConnectFourBoard";
import { ScoreBox } from "../../components/ScoreBox";
import { Confetti } from "../../components/Confetti";
import { useConnectFour } from "../../hooks/useConnectFour";
import { isMuted, setMuted } from "../../sound/audio";
import { C4_DIFFICULTIES, C4_PERSONALITIES } from "../../engine/connect-four/types";
import type { C4Difficulty } from "../../engine/connect-four/types";

const AI_DELAY_MS = Number(import.meta.env.VITE_AI_DELAY_MS ?? 600);

interface NavState {
  name?: string;
  mode?: string;
  difficulty?: string;
}

export const ConnectFour: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const navState = (location.state ?? null) as NavState | null;

  const playerName = navState?.name?.trim().toUpperCase() || "PLAYER 1";
  const isPve = navState?.mode === "pve";
  const difficulty: C4Difficulty =
    C4_DIFFICULTIES.find((level) => level === navState?.difficulty) ?? "medium";
  const aiName = C4_PERSONALITIES[difficulty].name;
  const playerNames = { X: playerName, O: isPve ? aiName : "PLAYER 2" };

  const { state, playMove, rematch, resetMatch } = useConnectFour(
    {
      playerNames,
      mode: isPve ? "pve" : "pvp",
      aiDifficulty: difficulty,
    },
    { aiDelayMs: AI_DELAY_MS },
  );

  const [soundOn, setSoundOn] = useState(!isMuted());

  const aiTurnPending = isPve && state.phase === "playing" && state.currentPlayer === "O";
  const isFinished = state.phase === "finished";
  const winningLine = state.result?.type === "win" ? state.result.line : null;

  const perspectiveWin =
    state.result?.type !== "win"
      ? null
      : isPve
        ? state.result.player === "X"
          ? "You win!"
          : "You lose!"
        : null;

  const showWinnerName = state.result?.type === "win" && perspectiveWin === "You lose!";

  let statusText: string;
  if (state.result?.type === "win") {
    statusText = perspectiveWin ?? `${playerNames[state.result.player]} wins!`;
  } else if (state.result?.type === "draw") {
    statusText = "It's a draw!";
  } else if (aiTurnPending) {
    statusText = `${aiName} is thinking...`;
  } else {
    statusText = `${playerNames[state.currentPlayer]}'s turn`;
  }

  const toggleSound = () => {
    const nextSoundOn = !soundOn;
    setMuted(!nextSoundOn);
    setSoundOn(nextSoundOn);
  };

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 overflow-hidden bg-zinc-900 px-4 py-4 pb-20 sm:pb-4">
      {state.result?.type === "win" && perspectiveWin !== "You lose!" && <Confetti />}

      <h1 className="animate-fade-in select-none text-3xl font-extrabold sm:text-4xl md:text-5xl">
        <span className="text-yellow-500">CONNECT</span>{" "}
        <span className="text-gray-100">FOUR</span>
      </h1>

      <div className="flex items-center gap-3 sm:gap-4">
        <ScoreBox
          label={playerNames.X}
          score={state.scores.X}
          active={!isFinished && state.currentPlayer === "X"}
          accent="text-blue-500"
          testId="score-x"
        />
        <div className="text-center">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 sm:text-xs">
            Draws
          </div>
          <div data-testid="score-draws" className="text-xl font-bold text-gray-300 sm:text-2xl">
            {state.draws}
          </div>
        </div>
        <ScoreBox
          label={playerNames.O}
          score={state.scores.O}
          active={!isFinished && state.currentPlayer === "O"}
          accent="text-red-500"
          testId="score-o"
        />
      </div>

      <p
        role="status"
        aria-live="polite"
        data-testid="status"
        className="h-7 text-base font-bold text-gray-200 sm:text-lg"
      >
        {statusText}
      </p>

      <ConnectFourBoard
        board={state.board}
        currentMark={state.currentPlayer}
        onColumnClick={playMove}
        winningLine={winningLine}
        interactionEnabled={!isFinished && !aiTurnPending}
      />

      <div className="mt-2 flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={rematch}
          className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-500 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-400 sm:px-6 sm:py-3 sm:text-base"
        >
          Rematch
        </button>
        <button
          type="button"
          onClick={resetMatch}
          className="rounded-xl bg-zinc-700 px-5 py-2.5 text-sm font-bold text-gray-200 transition-colors hover:bg-zinc-600 focus:outline-none focus-visible:ring-4 focus-visible:ring-zinc-500 sm:px-6 sm:py-3 sm:text-base"
        >
          Reset Scores
        </button>
      </div>

      <button
        type="button"
        onClick={toggleSound}
        aria-pressed={!soundOn}
        aria-label={soundOn ? "Mute sound" : "Unmute sound"}
        className="fixed bottom-4 right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-700 text-xl shadow-lg transition-all hover:scale-110 hover:bg-zinc-600 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-400 sm:bottom-52 sm:right-8"
      >
        {soundOn ? "🔊" : "🔇"}
      </button>

      {isFinished && (
        <div
          role="dialog"
          aria-label="Game result"
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60"
        >
          <div className="animate-pop mx-4 w-full max-w-sm rounded-2xl bg-zinc-800 p-8 text-center shadow-2xl">
            <p className="mb-1 text-sm font-semibold uppercase tracking-widest text-zinc-400">
              {state.result?.type === "draw" || perspectiveWin ? "Match Over" : "Winner"}
            </p>
            <p
              className={`${
                showWinnerName ? "mb-2" : "mb-6"
              } text-4xl font-extrabold text-gray-100`}
            >
              {state.result?.type === "win"
                ? perspectiveWin ?? playerNames[state.result.player]
                : "Draw"}
            </p>
            {state.result?.type === "win" && showWinnerName && (
              <p className="mb-6 text-sm font-semibold uppercase tracking-widest text-zinc-400">
                {playerNames[state.result.player]} wins
              </p>
            )}
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={rematch}
                className="rounded-xl bg-blue-600 px-6 py-3 font-bold text-white transition-colors hover:bg-blue-500 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-400"
              >
                Rematch
              </button>
              <button
                type="button"
                onClick={() => navigate("/", { replace: true })}
                className="rounded-xl bg-zinc-700 px-6 py-3 font-bold text-gray-200 transition-colors hover:bg-zinc-600 focus:outline-none focus-visible:ring-4 focus-visible:ring-zinc-500"
              >
                Back to menu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
