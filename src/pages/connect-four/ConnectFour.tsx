import React, { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ConnectFourBoard } from "../../components/ConnectFourBoard";
import { ScoreBox } from "../../components/ScoreBox";
import { Confetti } from "../../components/Confetti";
import { VoiceControls } from "../../components/VoiceControls";
import { ChatPanel } from "../../components/ChatPanel";
import { QuickEmoji } from "../../components/QuickEmoji";
import { EmojiBurstLayer, type EmojiBurst } from "../../components/EmojiBurstLayer";
import { useConnectFour } from "../../hooks/useConnectFour";
import { isMuted, setMuted } from "../../sound/audio";
import { C4_DIFFICULTIES, C4_PERSONALITIES } from "../../engine/connect-four/types";
import type { C4Difficulty } from "../../engine/connect-four/types";
import { useOnlineSessionSnapshot } from "../../net/OnlineSessionContext";
import { isConnectFourSession } from "../../net/RoomSession";

const WS_BASE = import.meta.env.VITE_WS_URL ?? "";

const AI_DELAY_MS = Number(import.meta.env.VITE_AI_DELAY_MS ?? 600);

interface NavState {
  name?: string;
  mode?: string;
  difficulty?: string;
}

export const ConnectFour: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { session: anySession, snapshot: onlineSnap, closeRoom } = useOnlineSessionSnapshot();
  const session = isConnectFourSession(anySession) ? anySession : null;
  const online = session !== null;
  const navState = (location.state ?? null) as NavState | null;

  const playerName = navState?.name?.trim().toUpperCase() || "PLAYER 1";
  const isPve = navState?.mode === "pve";
  const difficulty: C4Difficulty =
    C4_DIFFICULTIES.find((level) => level === navState?.difficulty) ?? "medium";
  const aiName = C4_PERSONALITIES[difficulty].name;
  const opponentLabel = isPve ? aiName : "PLAYER 2";
  const localNames = { X: playerName, O: opponentLabel };
  const playerNames = online
    ? onlineSnap?.role === "host"
      ? { X: onlineSnap.myName, O: onlineSnap.opponentName ?? "PLAYER 2" }
      : { X: onlineSnap?.opponentName ?? "PLAYER 2", O: onlineSnap?.myName ?? "PLAYER 2" }
    : localNames;

  const { state, playMove, rematch, resetMatch } = useConnectFour(
    {
      playerNames,
      mode: online ? "online" : isPve ? "pve" : "pvp",
      aiDifficulty: difficulty,
    },
    { aiDelayMs: AI_DELAY_MS, session },
  );

  const [soundOn, setSoundOn] = useState(!isMuted());
  const [emojiBursts, setEmojiBursts] = useState<EmojiBurst[]>([]);

  const addEmojiBurst = useCallback((emoji: string) => {
    const id = Date.now() + Math.random();
    setEmojiBursts((prev) => [...prev, { id, emoji }]);
    setTimeout(() => {
      setEmojiBursts((prev) => prev.filter((burst) => burst.id !== id));
    }, 1600);
  }, []);

  useEffect(() => {
    if (!session) return;
    return session.onChat((event) => {
      if (event.kind === "emoji" && event.emoji) addEmojiBurst(event.emoji);
    });
  }, [session, addEmojiBurst]);

  const myTurn = !online || state.currentPlayer === onlineSnap?.myMark;
  const disconnected = online && onlineSnap?.status === "disconnected";
  const rematchWaiting =
    online && state.phase === "finished" && onlineSnap?.rematchRequested === true;

  // Turn timer countdown
  const turnRemaining = online && onlineSnap?.turnStartTime && onlineSnap?.turnTimerMs
    ? Math.max(0, onlineSnap.turnTimerMs - (Date.now() - onlineSnap.turnStartTime))
    : 0;
  const turnPercent = online && onlineSnap?.turnTimerMs
    ? Math.max(0, Math.min(100, (turnRemaining / onlineSnap.turnTimerMs) * 100))
    : 0;

  useEffect(() => {
    if (location.pathname === "/room" && !session) {
      navigate("/", { replace: true });
    }
  }, [location.pathname, navigate, session]);

  const aiTurnPending =
    isPve && !online && state.phase === "playing" && state.currentPlayer === "O";
  const isFinished = state.phase === "finished";
  const winningLine = state.result?.type === "win" ? state.result.line : null;

  const perspectiveWin =
    state.result?.type !== "win"
      ? null
      : online && onlineSnap !== null
        ? state.result.player === onlineSnap.myMark
          ? "You win!"
          : "You lose!"
        : isPve
          ? state.result.player === "X"
            ? "You win!"
            : "You lose!"
          : null;

  const showWinnerName = state.result?.type === "win" && perspectiveWin === "You lose!";

  let statusText: string;
  if (disconnected) {
    statusText = "Opponent disconnected";
  } else if (state.result?.type === "win") {
    statusText = perspectiveWin ?? `${playerNames[state.result.player]} wins!`;
  } else if (state.result?.type === "draw") {
    statusText = "It's a draw!";
  } else if (aiTurnPending) {
    statusText = `${aiName} is thinking...`;
  } else if (online && state.phase === "playing") {
    const turnLabel = turnRemaining > 0
      ? `${playerNames[state.currentPlayer]}'s turn — ${Math.ceil(turnRemaining / 1000)}s`
      : `${playerNames[state.currentPlayer]}'s turn`;
    statusText = turnLabel;
  } else {
    statusText = `${playerNames[state.currentPlayer]}'s turn`;
  }

  const handleLeave = () => {
    closeRoom();
    navigate("/", { replace: true });
  };

  const toggleSound = () => {
    const nextSoundOn = !soundOn;
    setMuted(!nextSoundOn);
    setSoundOn(nextSoundOn);
  };

  const handleQuickEmoji = (emoji: string) => {
    if (!session?.sendEmoji(emoji)) return;
    addEmojiBurst(emoji);
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

      <div className="relative w-full max-w-xs">
        <p
          role="status"
          aria-live="polite"
          data-testid="status"
          className="h-7 text-base font-bold text-gray-200 sm:text-lg truncate"
        >
          {statusText}
        </p>
        {online && state.phase === "playing" && turnRemaining > 0 && (
          <div
            className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-700 overflow-hidden"
            aria-label={`Turn time remaining: ${Math.ceil(turnRemaining / 1000)} seconds`}
          >
            <div
              className="h-full bg-yellow-500 transition-all duration-100 ease-linear"
              style={{ width: `${turnPercent}%` }}
            />
          </div>
        )}
      </div>

      <ConnectFourBoard
        board={state.board}
        currentMark={state.currentPlayer}
        onColumnClick={playMove}
        winningLine={winningLine}
        interactionEnabled={!isFinished && !aiTurnPending && myTurn && !disconnected}
      />

      <div className="mt-2 flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={rematch}
          className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-500 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-400 sm:px-6 sm:py-3 sm:text-base"
        >
          Rematch
        </button>
        {online ? (
          <button
            type="button"
            onClick={handleLeave}
            className="rounded-xl bg-zinc-700 px-5 py-2.5 text-sm font-bold text-gray-200 transition-colors hover:bg-zinc-600 focus:outline-none focus-visible:ring-4 focus-visible:ring-zinc-500 sm:px-6 sm:py-3 sm:text-base"
          >
            Leave Room
          </button>
        ) : (
          <button
            type="button"
            onClick={resetMatch}
            className="rounded-xl bg-zinc-700 px-5 py-2.5 text-sm font-bold text-gray-200 transition-colors hover:bg-zinc-600 focus:outline-none focus-visible:ring-4 focus-visible:ring-zinc-500 sm:px-6 sm:py-3 sm:text-base"
          >
            Reset Scores
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={toggleSound}
        aria-pressed={!soundOn}
        aria-label={soundOn ? "Mute sound" : "Unmute sound"}
        className={`fixed bottom-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-700 text-xl shadow-lg transition-all hover:scale-110 hover:bg-zinc-600 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-400 sm:bottom-52 sm:right-8 ${
          online ? "right-52" : "right-4"
        }`}
      >
        {soundOn ? "🔊" : "🔇"}
      </button>

      {online && onlineSnap?.status === "connected" && session && (
        <>
          <QuickEmoji onEmoji={handleQuickEmoji} />
          <EmojiBurstLayer bursts={emojiBursts} />
          <ChatPanel session={session} onEmojiSend={addEmojiBurst} />
          {WS_BASE !== "" && (
            <VoiceControls
              baseUrl={WS_BASE}
              roomCode={onlineSnap.roomCode}
              name={onlineSnap.myName}
              game={onlineSnap.game}
            />
          )}
        </>
      )}

      {isFinished && !disconnected && (
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
          <div className="animate-pop mx-4 w-full max-w-sm rounded-2xl bg-zinc-800 p-8 text-center shadow-2xl">
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
