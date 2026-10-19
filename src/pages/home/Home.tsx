import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Board } from "../../components/Board";
import { useGame } from "../../hooks/useGame";
import { isMuted, setMuted } from "../../sound/audio";
import { AIDIFFICULTIES, PERSONALITIES, getBestMove } from "../../engine";
import type { AIDifficulty, Player } from "../../engine";
import { useOnlineSessionSnapshot } from "../../net/OnlineSessionContext";
import { VoiceControls } from "../../components/VoiceControls";

const WS_BASE = import.meta.env.VITE_WS_URL ?? "";

const CONFETTI_COLORS = [
  "#3b82f6",
  "#ef4444",
  "#facc15",
  "#22c55e",
  "#a855f7",
  "#06b6d4",
];

const AI_DELAY_MS = Number(import.meta.env.VITE_AI_DELAY_MS ?? 600);

const Confetti: React.FC = () => {
  const pieces = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        duration: 1.8 + Math.random() * 1.4,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        size: 8 + Math.random() * 6,
      })),
    [],
  );

  return (
    <div aria-hidden="true" data-testid="win-confetti" className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className="absolute top-0 animate-confetti-fall rounded-sm"
          style={{
            left: `${piece.left}%`,
            width: piece.size,
            height: piece.size * 0.6,
            backgroundColor: piece.color,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
          }}
        />
      ))}
    </div>
  );
};

interface NavState {
  playerType?: string;
  name?: string;
  mode?: string;
  difficulty?: string;
}

const ScoreBox: React.FC<{
  label: string;
  score: number;
  active: boolean;
  accent: string;
  testId: string;
}> = ({ label, score, active, accent, testId }) => (
  <div
    data-testid={testId}
    className={`rounded-xl border-2 px-6 py-3 text-center transition-all ${
      active
        ? "border-yellow-400 bg-zinc-800 shadow-[0_0_18px_-4px_rgba(250,204,21,0.55)] animate-pulse"
        : "border-zinc-700 bg-zinc-800/60"
    }`}
  >
    <div className={`text-xs font-semibold uppercase tracking-wider ${accent}`}>{label}</div>
    <div className="text-3xl font-extrabold text-gray-100">{score}</div>
  </div>
);

export const Home: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { session, snapshot: onlineSnap, closeRoom } = useOnlineSessionSnapshot();
  const online = session !== null;
  const navState = (location.state ?? null) as NavState | null;

  const playerMark: Player = navState?.playerType === "O" ? "O" : "X";
  const playerName = navState?.name?.trim().toUpperCase() || "PLAYER 1";
  const isPve = navState?.mode === "pve";
  const difficulty: AIDifficulty =
    AIDIFFICULTIES.find((level) => level === navState?.difficulty) ?? "medium";
  const aiMark: Player = playerMark === "X" ? "O" : "X";
  const aiName = PERSONALITIES[difficulty].name;
  const opponentLabel = isPve ? aiName : "PLAYER 2";
  const localNames: Record<Player, string> =
    playerMark === "X"
      ? { X: playerName, O: opponentLabel }
      : { O: playerName, X: opponentLabel };
  const playerNames: Record<Player, string> = online
    ? onlineSnap?.role === "host"
      ? { X: onlineSnap.myName, O: onlineSnap.opponentName ?? "PLAYER 2" }
      : { X: onlineSnap?.opponentName ?? "PLAYER 2", O: onlineSnap?.myName ?? "PLAYER 2" }
    : localNames;

  const { state, playMove, rematch, resetMatch } = useGame(
    {
      playerNames,
      mode: online ? "online" : isPve ? "pve" : "pvp",
      aiDifficulty: difficulty,
    },
    { humanMark: playerMark, aiDelayMs: AI_DELAY_MS, session },
  );
  const [shaking, setShaking] = useState(false);
  const [soundOn, setSoundOn] = useState(!isMuted());
  const [hintOn, setHintOn] = useState(false);

  const myTurn = !online || state.currentPlayer === onlineSnap?.myMark;
  const disconnected = online && onlineSnap?.status === "disconnected";
  const rematchWaiting =
    online && state.phase === "finished" && onlineSnap?.rematchRequested === true;

  useEffect(() => {
    if (location.pathname === "/room" && !session) {
      navigate("/", { replace: true });
    }
  }, [location.pathname, navigate, session]);

  const aiTurnPending =
    isPve && state.phase === "playing" && state.currentPlayer === aiMark;

  useEffect(() => {
    if (!shaking) return;
    const timer = setTimeout(() => setShaking(false), 350);
    return () => clearTimeout(timer);
  }, [shaking]);

  const handleCellClick = (index: number) => {
    const moved = playMove(index);
    if (!moved) setShaking(true);
  };

  const handleLeave = () => {
    closeRoom();
    navigate("/", { replace: true });
  };

  const toggleSound = () => {
    const nextSoundOn = !soundOn;
    setMuted(!nextSoundOn);
    setSoundOn(nextSoundOn);
  };

  const winningLine = state.result?.type === "win" ? state.result.line : null;
  const isFinished = state.phase === "finished";

  const perspectiveWin =
    online && onlineSnap !== null && state.result?.type === "win"
      ? state.result.player === onlineSnap.myMark
        ? "You win!"
        : "You lose!"
      : null;

  const hintIndex =
    hintOn && !online && state.phase === "playing" && !aiTurnPending
      ? getBestMove(state.board, state.currentPlayer)
      : null;

  let statusText: string;
  if (disconnected) {
    statusText = "Opponent disconnected";
  } else if (state.result?.type === "win") {
    statusText = perspectiveWin ?? `${playerNames[state.result.player]} wins!`;
  } else if (state.result?.type === "draw") {
    statusText = "It's a draw!";
  } else if (aiTurnPending) {
    statusText = `${aiName} is thinking...`;
  } else {
    statusText = `${playerNames[state.currentPlayer]}'s turn`;
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-3 overflow-hidden bg-zinc-900 px-4 py-4">
      {state.result?.type === "win" && perspectiveWin !== "You lose!" && (
        <Confetti />
      )}

      <h1 className="select-none text-3xl font-extrabold sm:text-4xl md:text-5xl">
        <span className="text-blue-500">TIC</span>{" "}
        <span className="text-gray-100">TAC</span>{" "}
        <span className="text-red-500">TOE</span>
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

      <div className={shaking ? "animate-shake" : ""}>
        <Board
          board={state.board}
          onCellClick={handleCellClick}
          winningLine={winningLine}
          interactionEnabled={!isFinished && !aiTurnPending && myTurn && !disconnected}
          hintIndex={hintIndex}
        />
      </div>

      <div className="mt-2 flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={rematch}
          className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-500 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-400 sm:px-6 sm:py-3 sm:text-base"
        >
          Rematch
        </button>
        {!online && (
          <button
            type="button"
            onClick={resetMatch}
            className="rounded-xl bg-zinc-700 px-5 py-2.5 text-sm font-bold text-gray-200 transition-colors hover:bg-zinc-600 focus:outline-none focus-visible:ring-4 focus-visible:ring-zinc-500 sm:px-6 sm:py-3 sm:text-base"
          >
            Reset Scores
          </button>
        )}
        {online && (
          <button
            type="button"
            onClick={handleLeave}
            className="rounded-xl bg-zinc-700 px-5 py-2.5 text-sm font-bold text-gray-200 transition-colors hover:bg-zinc-600 focus:outline-none focus-visible:ring-4 focus-visible:ring-zinc-500 sm:px-6 sm:py-3 sm:text-base"
          >
            Leave Room
          </button>
        )}
        {online && onlineSnap?.status === "connected" && WS_BASE !== "" && (
          <VoiceControls
            baseUrl={WS_BASE}
            roomCode={onlineSnap.roomCode}
            name={onlineSnap.myName}
            game={onlineSnap.game}
          />
        )}
        {!online && (
          <button
            type="button"
            onClick={() => setHintOn((on) => !on)}
            aria-pressed={hintOn}
            disabled={isFinished}
            className="rounded-xl bg-zinc-700 px-5 py-2.5 text-sm font-bold text-gray-200 transition-colors hover:bg-zinc-600 focus:outline-none focus-visible:ring-4 focus-visible:ring-zinc-500 disabled:opacity-40 sm:px-6 sm:py-3 sm:text-base"
          >
            Hint
          </button>
        )}
        <button
          type="button"
          onClick={toggleSound}
          aria-pressed={!soundOn}
          aria-label={soundOn ? "Mute sound" : "Unmute sound"}
          className="rounded-xl bg-zinc-700 px-3.5 py-2.5 text-lg text-gray-200 transition-colors hover:bg-zinc-600 focus:outline-none focus-visible:ring-4 focus-visible:ring-zinc-500 sm:px-4 sm:py-3 sm:text-xl"
        >
          {soundOn ? "🔊" : "🔇"}
        </button>
      </div>

      {isFinished && !disconnected && (
        <div
          role="dialog"
          aria-label="Game result"
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60"
        >
          <div className="mx-4 w-full max-w-sm rounded-2xl bg-zinc-800 p-8 text-center shadow-2xl">
            <p className="mb-1 text-sm font-semibold uppercase tracking-widest text-zinc-400">
              {state.result?.type === "draw" || perspectiveWin ? "Match Over" : "Winner"}
            </p>
            <p className="mb-6 text-4xl font-extrabold text-gray-100">
              {state.result?.type === "win"
                ? perspectiveWin ?? playerNames[state.result.player]
                : "Draw"}
            </p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                onClick={rematch}
                disabled={rematchWaiting}
                className="rounded-xl bg-blue-600 px-6 py-3 font-bold text-white transition-colors hover:bg-blue-500 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-400 disabled:opacity-50"
              >
                {rematchWaiting ? "Waiting…" : "Rematch"}
              </button>
              {online ? (
                <button
                  type="button"
                  onClick={handleLeave}
                  className="rounded-xl bg-zinc-700 px-6 py-3 font-bold text-gray-200 transition-colors hover:bg-zinc-600 focus:outline-none focus-visible:ring-4 focus-visible:ring-zinc-500"
                >
                  Leave Room
                </button>
              ) : (
                <button
                  type="button"
                  onClick={resetMatch}
                  className="rounded-xl bg-zinc-700 px-6 py-3 font-bold text-gray-200 transition-colors hover:bg-zinc-600 focus:outline-none focus-visible:ring-4 focus-visible:ring-zinc-500"
                >
                  New Game
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {disconnected && (
        <div
          role="dialog"
          aria-label="Opponent disconnected"
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60"
        >
          <div className="mx-4 w-full max-w-sm rounded-2xl bg-zinc-800 p-8 text-center shadow-2xl">
            <p className="mb-6 text-2xl font-extrabold text-gray-100">
              Opponent disconnected
            </p>
            <button
              type="button"
              onClick={handleLeave}
              className="rounded-xl bg-blue-600 px-6 py-3 font-bold text-white transition-colors hover:bg-blue-500 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-400"
            >
              Back to menu
            </button>
          </div>
        </div>
      )}
    </div>
  );
};