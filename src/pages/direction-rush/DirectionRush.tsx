import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDirectionRush } from '../../hooks/useDirectionRush';
import { LeafField } from './LeafField';
import type { RushDifficulty, RushConfig, RushDirection } from '../../engine/direction-rush';
import { isMuted, playEffect, setMuted, triggerHaptic } from '../../sound/audio';
import { GameShell } from '../../components/GameShell';

type Mode = 'quick' | 'practice' | 'survival';

interface ResultStats {
  finalScore: number;
  accuracy: number;
  correct: number;
  incorrect: number;
  avgRT: number;
  bestRT: number;
  bestStreak: number;
  pointingAcc: number;
  movingAcc: number;
}

const GLYPH: Record<RushDirection, string> = {
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
};

const HINT: Record<RushDirection, string> = {
  up: 'W / ↑',
  down: 'S / ↓',
  left: 'A / ←',
  right: 'D / →',
};

const DirectionRush: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const { mode: navMode = 'quick', difficulty = 'beginner' } = location.state
    ? (location.state as { mode?: Mode; difficulty?: RushDifficulty })
    : { mode: 'quick' as Mode, difficulty: 'beginner' as RushDifficulty };

  const { state, startGame, submitAnswer, pause, resume, restart } = useDirectionRush();

  const [soundOn, setSoundOn] = useState(!isMuted());
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<ResultStats | null>(null);
  const [feedbackFlash, setFeedbackFlash] = useState<'correct' | 'incorrect' | null>(null);
  const [switchAlert, setSwitchAlert] = useState<string | null>(null);
  const prevInstructionRef = useRef<string | null>(null);

  // Quick mode timer (60s countdown)
  const [secondsRemaining, setSecondsRemaining] = useState(navMode === 'quick' ? 60 : 0);
  const [lives, setLives] = useState(3);

  const config = useMemo<RushConfig>(() => {
    const configMap: Record<Mode, RushConfig> = {
      quick: {
        mode: difficulty,
        responseWindowMs: {
          beginner: 1500,
          easy: 1200,
          medium: 900,
          hard: 650,
          expert: 400,
        }[difficulty],
        switchInterval: {
          beginner: 5,
          easy: 4,
          medium: 3,
          hard: 2,
          expert: 1,
        }[difficulty],
      },
      practice: {
        mode: difficulty,
        responseWindowMs: 2000,
        switchInterval: 5,
      },
      survival: {
        mode: difficulty,
        responseWindowMs: {
          beginner: 1500,
          easy: 1200,
          medium: 900,
          hard: 650,
          expert: 400,
        }[difficulty],
        switchInterval: {
          beginner: 5,
          easy: 4,
          medium: 3,
          hard: 2,
          expert: 1,
        }[difficulty],
      },
    };
    return configMap[navMode];
  }, [navMode, difficulty]);

  // Start game on mount
  useEffect(() => {
    startGame(difficulty, config);
    setSecondsRemaining(navMode === 'quick' ? 60 : 0);
    setLives(3);
    setShowResults(false);
    setResults(null);
  }, [startGame, difficulty, config, navMode]);

  // Instruction switch detection
  useEffect(() => {
    if (!state?.instruction) return;
    if (prevInstructionRef.current && prevInstructionRef.current !== state.instruction) {
      setSwitchAlert(state.instruction.toUpperCase());
      const timeout = setTimeout(() => setSwitchAlert(null), 1200);
      return () => clearTimeout(timeout);
    }
    prevInstructionRef.current = state.instruction;
  }, [state?.instruction]);

  const finishGame = useCallback(() => {
    if (!state) return;
    pause();
    playEffect('win');
    const total = state.history.length;
    const correctCount = state.history.filter((r) => r.correct).length;
    const incorrectCount = total - correctCount;
    const acc = total > 0 ? correctCount / total : 0;
    const avgRT =
      state.reactionTimes.length > 0
        ? state.reactionTimes.reduce((a, b) => a + b, 0) / state.reactionTimes.length
        : 0;

    setResults({
      finalScore: correctCount * 100 + (state.bestStreak || 0) * 25,
      accuracy: acc,
      correct: correctCount,
      incorrect: incorrectCount,
      avgRT: Math.round(avgRT),
      bestRT: state.bestReactionTime === Infinity ? 0 : Math.round(state.bestReactionTime),
      bestStreak: state.bestStreak || 0,
      pointingAcc: state.pointingTotal > 0 ? state.pointingCorrect / state.pointingTotal : 0,
      movingAcc: state.movingTotal > 0 ? state.movingCorrect / state.movingTotal : 0,
    });
    setShowResults(true);
  }, [state, pause]);

  // Quick mode countdown timer
  useEffect(() => {
    if (navMode !== 'quick' || showResults || state?.phase !== 'playing') return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          finishGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navMode, showResults, state?.phase, finishGame]);

  // Handle user answer
  const handleAnswer = useCallback(
    (dir: RushDirection) => {
      if (!state || state.phase !== 'playing' || showResults) return;

      const activeStimulus = state.stimulus;
      if (!activeStimulus) return;

      const activeIsMoving = state.instruction === 'moving';
      const isCorrect = activeIsMoving
        ? dir === activeStimulus.moving
        : dir === activeStimulus.pointing;

      if (isCorrect) {
        if ((state.streak + 1) % 5 === 0) {
          playEffect('streak');
          triggerHaptic('heavy');
        } else {
          playEffect('place-x');
          triggerHaptic('light');
        }
        setFeedbackFlash('correct');
      } else {
        playEffect('invalid');
        triggerHaptic('error');
        setFeedbackFlash('incorrect');
        if (navMode === 'survival') {
          setLives((curr) => {
            const next = curr - 1;
            if (next <= 0) {
              setTimeout(finishGame, 200);
            }
            return next;
          });
        }
      }

      setTimeout(() => setFeedbackFlash(null), 250);
      submitAnswer(dir);
    },
    [state, showResults, navMode, submitAnswer, finishGame],
  );

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (['Escape'].includes(e.key)) {
        e.preventDefault();
        finishGame();
        return;
      }
      const dirMap: Record<string, RushDirection> = {
        ArrowUp: 'up',
        KeyW: 'up',
        ArrowDown: 'down',
        KeyS: 'down',
        ArrowLeft: 'left',
        KeyA: 'left',
        ArrowRight: 'right',
        KeyD: 'right',
      };
      const dir = dirMap[e.code] || dirMap[e.key];
      if (dir) {
        e.preventDefault();
        handleAnswer(dir);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleAnswer, finishGame]);

  // Visibility change pause/resume
  useEffect(() => {
    const handler = () => {
      if (document.hidden) pause();
      else if (!showResults) resume();
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [pause, resume, showResults]);

  const toggleSound = () => {
    const next = !soundOn;
    setMuted(!next);
    setSoundOn(next);
  };

  const handlePlayAgain = () => {
    setShowResults(false);
    setResults(null);
    setSecondsRemaining(navMode === 'quick' ? 60 : 0);
    setLives(3);
    restart();
  };

  const handleExit = () => {
    navigate('/');
  };

  if (!state) return null;

  const { stimulus, instruction, streak } = state;
  const score = state.history.filter((r) => r.correct).length * 100 + (streak > 3 ? streak * 20 : 0);

  return (
    <GameShell
      game="rush"
      title={
        <h1 className="select-none text-xl sm:text-2xl font-black tracking-wider">
          <span className="text-emerald-400">DIRECTION</span>{' '}
          <span className="text-gray-100">RUSH</span>
        </h1>
      }
      subtitle={
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
          {navMode.toUpperCase()} MODE
        </span>
      }
      onBack={handleExit}
      backAriaLabel="Exit game"
      soundOn={soundOn}
      onToggleSound={toggleSound}
      soundAriaLabel={{ mute: 'Mute audio', unmute: 'Unmute audio' }}
      headerMaxWidth="max-w-md sm:max-w-xl md:max-w-3xl lg:max-w-5xl"
      headerRightExtra={
        <button
          type="button"
          onClick={finishGame}
          className="rounded-lg border border-zinc-700 bg-zinc-800/80 px-2.5 py-1.5 text-xs font-bold text-zinc-300 transition-all hover:bg-zinc-700"
          aria-label="View results"
        >
          End
        </button>
      }
      className="flex h-[100dvh] max-h-[100dvh] flex-col items-center justify-between gap-1.5 sm:gap-2 overflow-hidden bg-zinc-900 px-3 sm:px-6 py-1.5 sm:py-2.5 text-gray-100"
    >

      {/* HUD Stats */}
      <div className="flex w-full max-w-md sm:max-w-xl md:max-w-3xl lg:max-w-5xl items-center justify-around gap-1 sm:gap-2 rounded-xl sm:rounded-2xl border border-zinc-800 bg-zinc-800/50 px-2 py-1 sm:p-2.5 shadow-md backdrop-blur-sm shrink-0">
        {/* Score */}
        <div className="flex flex-col items-center">
          <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-zinc-400">Score</span>
          <span className="text-lg sm:text-2xl font-black text-emerald-400">{score}</span>
        </div>

        {/* Streak */}
        <div className="flex flex-col items-center">
          <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-zinc-400">Streak</span>
          <span className="flex items-center gap-0.5 sm:gap-1 text-lg sm:text-2xl font-black text-amber-400">
            {streak > 2 && <span className="text-sm sm:text-base animate-bounce">🔥</span>}
            {streak}
          </span>
        </div>

        {/* Timer or Lives */}
        {navMode === 'quick' && (
          <div className="flex flex-col items-center">
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-zinc-400">Time</span>
            <span
              className={`text-lg sm:text-2xl font-black ${
                secondsRemaining <= 10 ? 'text-red-400 animate-pulse' : 'text-blue-400'
              }`}
            >
              {secondsRemaining}s
            </span>
          </div>
        )}

        {navMode === 'survival' && (
          <div className="flex flex-col items-center">
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-zinc-400">Lives</span>
            <span className="text-base sm:text-xl tracking-widest text-red-400">
              {'❤️'.repeat(Math.max(0, lives))}
              {'🖤'.repeat(Math.max(0, 3 - lives))}
            </span>
          </div>
        )}

        {navMode === 'practice' && (
          <div className="flex flex-col items-center">
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-zinc-400">Mode</span>
            <span className="text-xs sm:text-sm font-bold text-purple-400 uppercase">Infinite</span>
          </div>
        )}

        {/* Difficulty Badge */}
        <div className="flex flex-col items-center">
          <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-zinc-400">Level</span>
          <span className="text-[10px] sm:text-xs font-black uppercase text-emerald-400">
            {difficulty}
          </span>
        </div>
      </div>

      {/* Main Game Arena with In-Movement Visual Indicator & Switch Flash */}
      <div
        className={`relative w-full max-w-md sm:max-w-xl md:max-w-3xl lg:max-w-5xl flex-1 min-h-0 rounded-2xl border-2 bg-zinc-950/90 shadow-2xl overflow-hidden transition-all duration-200 ${
          feedbackFlash === 'correct'
            ? 'border-emerald-400 shadow-[0_0_35px_rgba(34,197,94,0.45)]'
            : feedbackFlash === 'incorrect'
              ? 'border-red-500 shadow-[0_0_35px_rgba(239,68,68,0.45)]'
              : switchAlert
                ? 'border-yellow-400 shadow-[0_0_30px_rgba(250,204,21,0.4)] animate-pulse'
                : instruction === 'pointing'
                  ? 'border-amber-500/60 shadow-[0_0_25px_rgba(245,158,11,0.2)]'
                  : 'border-emerald-500/60 shadow-[0_0_25px_rgba(16,185,129,0.2)]'
        }`}
      >
        <LeafField stimulus={stimulus} leafCount={7} />

        {/* IN-MOVEMENT INDICATOR: positioned below inside the arena with clean, minimal text */}
        <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center transition-all duration-300 select-none">
          {instruction === 'pointing' ? (
            <div className="flex items-center gap-2 px-4 py-1 rounded-full border border-amber-400/80 bg-zinc-950/90 shadow-[0_0_15px_rgba(245,158,11,0.35)] backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
              <span className="text-xs sm:text-sm font-black tracking-widest uppercase text-amber-300">
                POINTING
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-4 py-1 rounded-full border border-emerald-400/80 bg-zinc-950/90 shadow-[0_0_15px_rgba(16,185,129,0.35)] backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-xs sm:text-sm font-black tracking-widest uppercase text-emerald-300">
                MOVING
              </span>
            </div>
          )}
        </div>

        {/* IN-ARENA SWITCH FLASH: unmissable alert inside the arena when mode changes */}
        {switchAlert && (
          <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center bg-black/50 backdrop-blur-[2px] animate-fade-in select-none">
            <div className="flex flex-col items-center gap-1 rounded-2xl border-2 border-yellow-400 bg-zinc-950/95 px-5 py-2.5 shadow-[0_0_40px_rgba(250,204,21,0.7)] animate-bounce">
              <span className="text-[10px] font-black uppercase tracking-widest text-yellow-300">
                ⚡ SWITCH!
              </span>
              <span className="text-xl sm:text-2xl font-black tracking-wider text-white">
                {switchAlert}
              </span>
            </div>
          </div>
        )}

        {/* Feedback flash overlay */}
        {feedbackFlash === 'correct' && (
          <div className="absolute inset-0 bg-emerald-500/15 pointer-events-none animate-ping" />
        )}
        {feedbackFlash === 'incorrect' && (
          <div className="absolute inset-0 bg-red-500/20 pointer-events-none animate-ping" />
        )}
      </div>

      {/* Bottom Controls Area */}
      <div className="w-full max-w-md sm:max-w-xl md:max-w-3xl lg:max-w-5xl flex flex-col items-center gap-1 shrink-0 pb-1">
        {/* Per-Answer RT Flash */}
        <div className="flex items-center justify-center h-3.5">
          {state.reactionTimes.length > 0 && state.history.length > 0 && (
            <div className="text-[11px] font-mono font-bold text-zinc-400 flex items-center gap-1">
              <span>⚡ Last:</span>
              <span
                className={
                  state.history[state.history.length - 1].correct
                    ? "text-emerald-400 font-black"
                    : "text-red-400 font-black"
                }
              >
                {Math.round(state.reactionTimes[state.reactionTimes.length - 1])}ms
              </span>
            </div>
          )}
        </div>

        {/* Direction Cross D-Pad with Integrated Center Movement Mode Indicator */}
        <div
          role="grid"
          aria-label="Direction pad"
          className="grid grid-cols-3 grid-rows-3 gap-1 sm:gap-1.5 w-full max-w-[260px] sm:max-w-[290px] mx-auto select-none items-center justify-items-center"
        >
          {/* ROW 1: UP (Center Column) */}
          <div className="col-start-2 row-start-1 w-full flex justify-center">
            <button
              type="button"
              role="gridcell"
              data-testid="btn-up"
              aria-label="Answer up"
              onClick={() => handleAnswer("up")}
              className="flex flex-col items-center justify-center w-[74px] h-10 sm:w-20 sm:h-11 rounded-xl sm:rounded-2xl border-2 border-zinc-700 bg-zinc-800/90 text-gray-100 shadow-md transition-all hover:scale-[1.04] hover:border-emerald-400 hover:bg-zinc-700/90 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 cursor-pointer"
            >
              <span className="text-base sm:text-lg font-black leading-none">{GLYPH.up}</span>
              <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider text-zinc-300">UP</span>
              <span className="text-[7px] sm:text-[8px] font-semibold text-zinc-500 uppercase">{HINT.up}</span>
            </button>
          </div>

          {/* ROW 2: LEFT (Left Column) */}
          <div className="col-start-1 row-start-2 w-full flex justify-center">
            <button
              type="button"
              role="gridcell"
              data-testid="btn-left"
              aria-label="Answer left"
              onClick={() => handleAnswer("left")}
              className="flex flex-col items-center justify-center w-[74px] h-10 sm:w-20 sm:h-11 rounded-xl sm:rounded-2xl border-2 border-zinc-700 bg-zinc-800/90 text-gray-100 shadow-md transition-all hover:scale-[1.04] hover:border-emerald-400 hover:bg-zinc-700/90 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 cursor-pointer"
            >
              <span className="text-base sm:text-lg font-black leading-none">{GLYPH.left}</span>
              <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider text-zinc-300">LEFT</span>
              <span className="text-[7px] sm:text-[8px] font-semibold text-zinc-500 uppercase">{HINT.left}</span>
            </button>
          </div>

          {/* ROW 2: CENTER RULE INDICATOR (Directly inside the movement controls!) */}
          <div className="col-start-2 row-start-2 w-full flex justify-center select-none pointer-events-none">
            {switchAlert ? (
              <div className="flex flex-col items-center justify-center w-[74px] h-10 sm:w-20 sm:h-11 rounded-xl sm:rounded-2xl border-2 border-yellow-400 bg-yellow-500/25 p-0.5 text-center shadow-[0_0_20px_rgba(250,204,21,0.5)] animate-pulse">
                <span className="text-[10px] sm:text-xs font-black text-white uppercase tracking-wider">{switchAlert}</span>
              </div>
            ) : instruction === 'pointing' ? (
              <div className="flex flex-col items-center justify-center w-[74px] h-10 sm:w-20 sm:h-11 rounded-xl sm:rounded-2xl border-2 border-amber-500/70 bg-gradient-to-b from-amber-500/20 to-zinc-900/90 p-0.5 text-center shadow-[0_0_15px_rgba(245,158,11,0.25)] transition-all">
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-amber-300 leading-none">
                  POINTING
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center w-[74px] h-10 sm:w-20 sm:h-11 rounded-xl sm:rounded-2xl border-2 border-emerald-500/70 bg-gradient-to-b from-emerald-500/20 to-zinc-900/90 p-0.5 text-center shadow-[0_0_15px_rgba(16,185,129,0.25)] transition-all">
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-emerald-300 leading-none">
                  MOVING
                </span>
              </div>
            )}
          </div>

          {/* ROW 2: RIGHT (Right Column) */}
          <div className="col-start-3 row-start-2 w-full flex justify-center">
            <button
              type="button"
              role="gridcell"
              data-testid="btn-right"
              aria-label="Answer right"
              onClick={() => handleAnswer("right")}
              className="flex flex-col items-center justify-center w-[74px] h-10 sm:w-20 sm:h-11 rounded-xl sm:rounded-2xl border-2 border-zinc-700 bg-zinc-800/90 text-gray-100 shadow-md transition-all hover:scale-[1.04] hover:border-emerald-400 hover:bg-zinc-700/90 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 cursor-pointer"
            >
              <span className="text-base sm:text-lg font-black leading-none">{GLYPH.right}</span>
              <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider text-zinc-300">RIGHT</span>
              <span className="text-[7px] sm:text-[8px] font-semibold text-zinc-500 uppercase">{HINT.right}</span>
            </button>
          </div>

          {/* ROW 3: DOWN (Center Column) */}
          <div className="col-start-2 row-start-3 w-full flex justify-center">
            <button
              type="button"
              role="gridcell"
              data-testid="btn-down"
              aria-label="Answer down"
              onClick={() => handleAnswer("down")}
              className="flex flex-col items-center justify-center w-[74px] h-10 sm:w-20 sm:h-11 rounded-xl sm:rounded-2xl border-2 border-zinc-700 bg-zinc-800/90 text-gray-100 shadow-md transition-all hover:scale-[1.04] hover:border-emerald-400 hover:bg-zinc-700/90 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 cursor-pointer"
            >
              <span className="text-base sm:text-lg font-black leading-none">{GLYPH.down}</span>
              <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-wider text-zinc-300">DOWN</span>
              <span className="text-[7px] sm:text-[8px] font-semibold text-zinc-500 uppercase">{HINT.down}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Results Dialog */}
      {showResults && results && (
        <div
          role="dialog"
          aria-label="Game Results"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in"
        >
          <div className="w-full max-w-sm rounded-2xl border-2 border-zinc-700 bg-zinc-800 p-6 text-center shadow-2xl">
            <span className="text-4xl" aria-hidden="true">
              🏆
            </span>
            <h2 className="mt-2 text-2xl font-black text-gray-100 uppercase tracking-wider">
              Rush Finished!
            </h2>
            <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mt-0.5">
              {navMode} mode complete
            </p>

            <div className="my-5 grid grid-cols-2 gap-2.5 text-left">
              <div className="rounded-xl border border-zinc-700/60 bg-zinc-900/60 p-3">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                  Final Score
                </span>
                <span className="text-2xl font-black text-emerald-400">{results.finalScore}</span>
              </div>
              <div className="rounded-xl border border-zinc-700/60 bg-zinc-900/60 p-3">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                  Accuracy
                </span>
                <span className="text-2xl font-black text-blue-400">
                  {Math.round(results.accuracy * 100)}%
                </span>
              </div>
              <div className="rounded-xl border border-zinc-700/60 bg-zinc-900/60 p-3">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                  Correct / Wrong
                </span>
                <span className="text-lg font-bold text-gray-200">
                  <span className="text-emerald-400">{results.correct}</span> /{' '}
                  <span className="text-red-400">{results.incorrect}</span>
                </span>
              </div>
              <div className="rounded-xl border border-zinc-700/60 bg-zinc-900/60 p-3">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                  Best Streak
                </span>
                <span className="text-lg font-bold text-amber-400">🔥 {results.bestStreak}</span>
              </div>
            </div>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={handlePlayAgain}
                className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                Play Again
              </button>
              <button
                type="button"
                onClick={handleExit}
                className="rounded-xl border border-zinc-600 bg-zinc-700 px-4 py-2.5 text-sm font-bold text-gray-200 transition-all hover:bg-zinc-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
              >
                Arcade Hub
              </button>
            </div>
          </div>
        </div>
      )}
    </GameShell>
  );
};

export default DirectionRush;
