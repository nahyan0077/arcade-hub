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

const DIRECTIONS: readonly RushDirection[] = ['up', 'down', 'left', 'right'];

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
      headerMaxWidth="max-w-lg"
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
      className="flex min-h-[100dvh] flex-col items-center justify-between gap-2 sm:gap-3 overflow-hidden bg-zinc-900 px-3 sm:px-4 py-2.5 sm:py-4 text-gray-100"
    >

      {/* HUD Stats */}
      <div className="flex w-full max-w-lg items-center justify-around gap-2 rounded-2xl border border-zinc-800 bg-zinc-800/50 p-2 sm:p-3 shadow-md backdrop-blur-sm">
        {/* Score */}
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Score</span>
          <span className="text-2xl font-black text-emerald-400">{score}</span>
        </div>

        {/* Streak */}
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Streak</span>
          <span className="flex items-center gap-1 text-2xl font-black text-amber-400">
            {streak > 2 && <span className="text-base animate-bounce">🔥</span>}
            {streak}
          </span>
        </div>

        {/* Timer or Lives */}
        {navMode === 'quick' && (
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Time</span>
            <span
              className={`text-2xl font-black ${
                secondsRemaining <= 10 ? 'text-red-400 animate-pulse' : 'text-blue-400'
              }`}
            >
              {secondsRemaining}s
            </span>
          </div>
        )}

        {navMode === 'survival' && (
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Lives</span>
            <span className="text-xl tracking-widest text-red-400">
              {'❤️'.repeat(Math.max(0, lives))}
              {'🖤'.repeat(Math.max(0, 3 - lives))}
            </span>
          </div>
        )}

        {navMode === 'practice' && (
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Mode</span>
            <span className="text-sm font-bold text-purple-400 uppercase">Infinite</span>
          </div>
        )}

        {/* Difficulty Badge */}
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Level</span>
          <span className="text-xs font-black uppercase text-emerald-400">
            {difficulty}
          </span>
        </div>
      </div>

      {/* Prominent Active Instruction Banner */}
      <div className="relative flex flex-col items-center justify-center w-full max-w-lg min-h-[52px]">
        {switchAlert ? (
          <div className="animate-bounce flex items-center gap-2 rounded-full border-2 border-yellow-400 bg-yellow-500/25 px-6 py-2 shadow-xl shadow-yellow-500/20">
            <span className="text-xs font-black uppercase tracking-wider text-yellow-300">
              ⚡ SWITCH! NOW:
            </span>
            <span className="text-lg font-black tracking-widest text-white">{switchAlert}</span>
          </div>
        ) : instruction === 'pointing' ? (
          <div className="flex items-center gap-3 rounded-full border-2 border-amber-500/60 bg-amber-500/15 px-6 py-2 shadow-lg shadow-amber-500/10">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">Follow:</span>
            <span className="text-lg sm:text-xl font-black tracking-widest text-amber-300">
              POINTING
            </span>
            <span className="text-xs text-amber-400/80 hidden sm:inline">(where leaf tips point)</span>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-full border-2 border-emerald-500/60 bg-emerald-500/15 px-6 py-2 shadow-lg shadow-emerald-500/10">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Follow:</span>
            <span className="text-lg sm:text-xl font-black tracking-widest text-emerald-300">
              MOVING
            </span>
            <span className="text-xs text-emerald-400/80 hidden sm:inline">(where leaves drift)</span>
          </div>
        )}
      </div>

      {/* Main Game Arena */}
      <div
        className={`relative w-full max-w-lg h-52 sm:h-64 md:h-72 rounded-2xl border-2 bg-zinc-950/90 shadow-2xl overflow-hidden transition-all duration-200 ${
          feedbackFlash === 'correct'
            ? 'border-emerald-400 shadow-[0_0_30px_rgba(34,197,94,0.35)]'
            : feedbackFlash === 'incorrect'
              ? 'border-red-500 shadow-[0_0_30px_rgba(239,68,68,0.35)]'
              : 'border-zinc-700/80 hover:border-zinc-600'
        }`}
      >
        <LeafField stimulus={stimulus} leafCount={7} />

        {/* Feedback flash overlay */}
        {feedbackFlash === 'correct' && (
          <div className="absolute inset-0 bg-emerald-500/15 pointer-events-none animate-ping" />
        )}
        {feedbackFlash === 'incorrect' && (
          <div className="absolute inset-0 bg-red-500/20 pointer-events-none animate-ping" />
        )}
      </div>

      {/* Per-Answer RT Flash */}
      <div className="flex items-center justify-center h-5">
        {state.reactionTimes.length > 0 && state.history.length > 0 && (
          <div className="text-xs font-mono font-bold text-zinc-400 flex items-center gap-1.5">
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

      {/* Direction Input Controls */}
      <div
        role="grid"
        aria-label="Direction pad"
        className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3 w-full max-w-lg"
      >
        {DIRECTIONS.map((dir) => (
          <button
            key={dir}
            type="button"
            role="gridcell"
            data-testid={`btn-${dir}`}
            aria-label={`Answer ${dir}`}
            onClick={() => handleAnswer(dir)}
            className="flex flex-col items-center justify-center h-16 sm:h-20 rounded-xl border-2 border-zinc-700 bg-zinc-800/90 text-gray-100 shadow-lg transition-all hover:scale-[1.03] hover:border-emerald-400 hover:bg-zinc-700/90 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            <span className="text-2xl sm:text-3xl font-black leading-none">{GLYPH[dir]}</span>
            <span className="mt-1 text-[11px] font-bold uppercase tracking-wider text-zinc-300">
              {dir}
            </span>
            <span className="text-[9px] font-semibold text-zinc-500 uppercase">{HINT[dir]}</span>
          </button>
        ))}
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
