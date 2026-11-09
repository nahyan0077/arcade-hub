import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ScoreBox } from '../../components/ScoreBox';
import { Confetti } from '../../components/Confetti';
import { VoiceControls } from '../../components/VoiceControls';
import { ChatPanel } from '../../components/ChatPanel';
import { QuickEmoji } from '../../components/QuickEmoji';
import { EmojiBurstLayer, type EmojiBurst } from '../../components/EmojiBurstLayer';
import { useArrowRace } from '../../hooks/useArrowRace';
import { isMuted, playEffect, setMuted } from '../../sound/audio';
import { RACE_AI_PERSONALITIES, RACE_DIFFICULTIES } from '../../engine/arrow-race';
import type { ArrowDirection, RaceDifficulty } from '../../engine/arrow-race';
import { useOnlineSessionSnapshot } from '../../net/OnlineSessionContext';
import { isArrowRaceSession } from '../../net/RoomSession';
import { useSettings } from '../../settings/SettingsContext';

const WS_BASE = import.meta.env.VITE_WS_URL ?? '';

const DIRECTIONS: readonly ArrowDirection[] = ['up', 'down', 'left', 'right'];
const GLYPH: Record<ArrowDirection, string> = {
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
};
const ROTATE: Record<ArrowDirection, number> = {
  up: 0,
  right: 90,
  down: 180,
  left: 270,
};
const SLIDE: Record<ArrowDirection, string> = {
  up: 'translateY(-28px)',
  down: 'translateY(28px)',
  left: 'translateX(-28px)',
  right: 'translateX(28px)',
};

interface NavState {
  name?: string;
  mode?: string;
  difficulty?: string;
}

export const ArrowRace: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { openSettings } = useSettings();
  const { session: anySession, snapshot: onlineSnap, closeRoom } = useOnlineSessionSnapshot();
  const session = isArrowRaceSession(anySession) ? anySession : null;
  const online = session !== null;
  const navState = (location.state ?? null) as NavState | null;

  const playerName = navState?.name?.trim().toUpperCase() || 'PLAYER 1';
  const isPve = !online && navState?.mode !== 'online';
  const difficulty: RaceDifficulty = RACE_DIFFICULTIES.includes(
    (navState?.difficulty ?? 'medium') as RaceDifficulty,
  )
    ? ((navState?.difficulty ?? 'medium') as RaceDifficulty)
    : 'medium';
  const aiName = RACE_AI_PERSONALITIES[difficulty].name;

  const hostName = onlineSnap
    ? onlineSnap.role === 'host'
      ? onlineSnap.myName
      : (onlineSnap.opponentName || 'PLAYER 1')
    : 'PLAYER 1';
  const guestName = onlineSnap
    ? onlineSnap.role === 'guest'
      ? onlineSnap.myName
      : (onlineSnap.opponentName || 'PLAYER 2')
    : 'PLAYER 2';
  const localNames = { X: playerName, O: isPve ? aiName : 'PLAYER 2' };
  const onlineFallbackNames = { X: hostName, O: guestName };

  const { state, answer, rematch, resetMatch, roundDeadline, roundMs } = useArrowRace(
    {
      mode: online ? 'online' : isPve ? 'pve' : 'pvp',
      aiDifficulty: difficulty,
      playerNames: online ? onlineFallbackNames : localNames,
    },
    { session },
  );

  const playerNames =
    online && onlineSnap?.status === 'connected' && state.playerNames
      ? state.playerNames
      : online
        ? onlineFallbackNames
        : state.playerNames;

  const [soundOn, setSoundOn] = useState(!isMuted());
  const [emojiBursts, setEmojiBursts] = useState<EmojiBurst[]>([]);
  const [roundRemaining, setRoundRemaining] = useState(0);
  const [roundKey, setRoundKey] = useState(0);

  useEffect(() => {
    if (!roundDeadline) {
      setRoundRemaining(0);
      return;
    }
    const tick = () => {
      setRoundRemaining(Math.max(0, roundDeadline - Date.now()));
    };
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [roundDeadline]);

  // Restart the slide animation when a new round appears.
  useEffect(() => {
    if (state.stimulus !== null) setRoundKey((k) => k + 1);
  }, [state.roundId, state.stimulus]);

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
      if (event.kind === 'emoji' && event.emoji) addEmojiBurst(event.emoji);
    });
  }, [session, addEmojiBurst]);

  useEffect(() => {
    if (location.pathname === '/room' && !session) {
      navigate('/', { replace: true });
    }
  }, [location.pathname, navigate, session]);

  const isFinished = state.phase === 'finished';
  const liveRound = !isFinished && state.stimulus !== null;
  const waitingNext =
    !isFinished && state.stimulus === null && state.roundId > 0;
  const disconnected = online && onlineSnap?.status === 'disconnected';
  const rematchWaiting =
    online && isFinished && onlineSnap?.rematchRequested === true;

  const perspectiveWin =
    state.result?.type !== 'win'
      ? null
      : online && onlineSnap !== null
        ? state.result.player === onlineSnap.myMark
          ? 'You win!'
          : 'You lose!'
        : isPve
          ? state.result.player === 'X'
            ? 'You win!'
            : 'You lose!'
          : null;

  const showWinnerName = state.result?.type === 'win' && perspectiveWin === 'You lose!';

  let statusText: string;
  if (disconnected) {
    statusText = 'Opponent disconnected';
  } else if (state.result?.type === 'win') {
    statusText = perspectiveWin ?? `${playerNames[state.result.player]} wins!`;
  } else if (waitingNext) {
    statusText = 'Next round…';
  } else if (isPve && liveRound) {
    statusText = `Watch the arrow — ${aiName} is racing`;
  } else if (liveRound) {
    statusText = 'Watch the arrow — answer the slide';
  } else {
    statusText = 'Get ready…';
  }

  const handleLeave = () => {
    closeRoom();
    navigate('/', { replace: true });
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

  const onAnswer = (direction: ArrowDirection) => {
    answer(direction);
  };

  const timerPercent = useMemo(() => {
    if (!liveRound || roundMs <= 0) return 0;
    return Math.max(0, Math.min(100, (roundRemaining / roundMs) * 100));
  }, [liveRound, roundRemaining, roundMs]);

  const stimulus = state.stimulus;

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-2 sm:gap-3 overflow-hidden bg-zinc-900 px-4 py-2 sm:py-4">
      {state.result?.type === 'win' && perspectiveWin !== 'You lose!' && <Confetti />}

      {/* Top Header Bar */}
      <header className="flex w-full max-w-sm sm:max-w-md items-center justify-between px-1">
        <button
          type="button"
          onClick={online ? handleLeave : () => navigate('/')}
          className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 px-3 py-1.5 text-xs font-bold text-zinc-300 transition-all hover:border-zinc-500 hover:bg-zinc-700 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          aria-label="Back to hub"
        >
          <span>← Hub</span>
        </button>

        <h1 className="select-none text-2xl font-black tracking-wider sm:text-3xl md:text-4xl">
          <span className="text-violet-500">ARROW</span>{' '}
          <span className="text-gray-100">RACE</span>
        </h1>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              playEffect('click');
              openSettings();
            }}
            aria-label="Open settings"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800/80 text-sm text-zinc-300 transition-all hover:border-cyan-400 hover:text-cyan-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            ⚙️
          </button>
          <button
            type="button"
            onClick={toggleSound}
            aria-pressed={!soundOn}
            aria-label={soundOn ? 'Mute sound' : 'Unmute sound'}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800/80 text-sm text-zinc-300 transition-all hover:border-zinc-500 hover:bg-zinc-700 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          >
            {soundOn ? '🔊' : '🔇'}
          </button>
        </div>
      </header>

      <div className="flex items-center gap-3 sm:gap-4">
        <ScoreBox
          label={playerNames.X}
          score={state.scores.X}
          active={!isFinished && state.lastResult?.scorer === 'X'}
          accent="text-violet-400"
          testId="score-x"
        />
        <div className="text-center">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 sm:text-xs">
            Draws
          </div>
          <div data-testid="score-draws" className="text-xl font-bold text-gray-300 sm:text-2xl">
            {state.draws}
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
            First to {state.targetScore}
          </div>
        </div>
        <ScoreBox
          label={playerNames.O}
          score={state.scores.O}
          active={!isFinished && state.lastResult?.scorer === 'O'}
          accent="text-fuchsia-400"
          testId="score-o"
        />
      </div>

      <div className="relative flex items-center justify-center h-7">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700/80 bg-zinc-800/90 px-3 py-0.5 shadow-md backdrop-blur-sm">
          {liveRound && (
            <span className="h-2 w-2 rounded-full bg-violet-500" aria-hidden="true" />
          )}
          {isFinished && (
            <span className="text-xs select-none" aria-hidden="true">
              🏆
            </span>
          )}
          <p
            role="status"
            aria-live="polite"
            data-testid="status"
            className="text-xs font-bold tracking-wide text-gray-200 sm:text-sm truncate text-center"
          >
            {statusText}
          </p>
        </div>
      </div>

      <div
        data-testid="race-stage"
        className="relative flex h-36 w-36 sm:h-44 sm:w-44 max-w-[70vw] items-center justify-center overflow-hidden rounded-3xl border-2 border-violet-500/40 bg-zinc-800/90 shadow-[0_0_30px_rgba(139,92,246,0.25)] backdrop-blur-sm"
      >
        {stimulus ? (
          <div key={roundKey} className="relative flex h-full w-full items-center justify-center">
            <span
              aria-label={`Arrow pointing ${stimulus.pointing}, moving ${stimulus.moving}`}
              data-testid="race-arrow"
              className="inline-block select-none text-7xl font-extrabold leading-none text-violet-300 sm:text-8xl"
              style={{ transform: `rotate(${ROTATE[stimulus.pointing]}deg)` }}
            >
              <span
                aria-hidden="true"
                className="inline-block"
                style={{
                  animation: 'race-slide 0.9s ease-in-out infinite alternate',
                  ['--race-slide' as string]: SLIDE[stimulus.moving],
                }}
              >
                ▲
              </span>
            </span>
          </div>
        ) : (
          <p className="text-sm font-bold uppercase tracking-widest text-zinc-500">
            {isFinished ? 'Match over' : 'Next round…'}
          </p>
        )}
        {liveRound && (
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-zinc-700/50">
            <div
              className={`h-full transition-[width] duration-100 ease-linear ${
                roundRemaining <= 2000 ? 'bg-red-500' : 'bg-violet-500'
              }`}
              style={{ width: `${timerPercent}%` }}
            />
          </div>
        )}
      </div>

      <div
        role="group"
        aria-label="Answer direction"
        className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3"
      >
        {DIRECTIONS.map((dir) => (
          <button
            key={dir}
            type="button"
            data-testid={`answer-${dir}`}
            aria-label={`Answer ${dir}`}
            disabled={!liveRound || disconnected}
            onClick={() => onAnswer(dir)}
            className="h-14 w-20 rounded-xl border-2 border-zinc-700 bg-zinc-800/90 text-3xl font-extrabold text-gray-100 shadow-md transition-all hover:border-violet-400 hover:bg-zinc-700 hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:opacity-40 sm:h-16 sm:w-24 sm:text-4xl"
          >
            {GLYPH[dir]}
          </button>
        ))}
      </div>

      <div className="mt-2 flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={rematch}
          className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-500/20 transition-all hover:bg-blue-500 hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-400 sm:px-6 sm:py-3 sm:text-base"
        >
          Rematch
        </button>
        {online ? (
          <button
            type="button"
            onClick={handleLeave}
            className="rounded-xl bg-zinc-800 border border-zinc-700 px-5 py-2.5 text-sm font-bold text-gray-200 shadow-md transition-all hover:bg-zinc-700 hover:border-zinc-600 hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-zinc-500 sm:px-6 sm:py-3 sm:text-base"
          >
            Leave Room
          </button>
        ) : (
          <button
            type="button"
            onClick={resetMatch}
            className="rounded-xl bg-zinc-800 border border-zinc-700 px-5 py-2.5 text-sm font-bold text-gray-200 shadow-md transition-all hover:bg-zinc-700 hover:border-zinc-600 hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-zinc-500 sm:px-6 sm:py-3 sm:text-base"
          >
            Reset Scores
          </button>
        )}
      </div>

      {online && onlineSnap?.status === 'connected' && session && (
        <>
          <QuickEmoji onEmoji={handleQuickEmoji} />
          <EmojiBurstLayer bursts={emojiBursts} />
          <ChatPanel session={session} onEmojiSend={addEmojiBurst} />
          {WS_BASE !== '' && (
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
              Match Over
            </p>
            <p
              className={`${
                showWinnerName ? 'mb-2' : 'mb-6'
              } text-4xl font-extrabold text-gray-100`}
            >
              {state.result?.type === 'win'
                ? perspectiveWin ?? playerNames[state.result.player]
                : 'Draw'}
            </p>
            {state.result?.type === 'win' && showWinnerName && (
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
                {rematchWaiting ? 'Waiting…' : 'Rematch'}
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
