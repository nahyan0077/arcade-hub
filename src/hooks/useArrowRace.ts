import { useCallback, useEffect, useRef, useState } from 'react';
import {
  applyRoundResult,
  arrowRaceNewGame,
  arrowRaceRestart,
  arrowRaceStart,
  chooseRaceAnswer,
  createArrowRaceInitialState,
  generateStimulus,
  isCorrectAnswer,
  startRound,
} from '../engine/arrow-race';
import type {
  ArrowDirection,
  ArrowRaceGameConfig,
  ArrowRaceState,
  RaceDifficulty,
} from '../engine/arrow-race';
import type { Player } from '../engine';
import type { RoomSession } from '../net/RoomSession';
import { RACE_ROUND_GAP_MS, RACE_ROUND_MS } from '../net/protocol';
import { playEffect } from '../sound/audio';

const AI_DELAY_MS: Record<RaceDifficulty, number> = {
  easy: 2200,
  medium: 1500,
  hard: 900,
};

const SCORES_KEY = 'arrow-race.scores.v1';

export interface ArrowRaceOptions {
  session?: RoomSession<'arrow-race'> | null;
  aiDelayMs?: number;
}

function loadPersistedScores(): { X: number; O: number; draws: number } {
  try {
    const raw = localStorage.getItem(SCORES_KEY);
    if (raw === null) return { X: 0, O: 0, draws: 0 };
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return { X: 0, O: 0, draws: 0 };
    const v = parsed as Record<string, unknown>;
    if (
      typeof v.X !== 'number' ||
      typeof v.O !== 'number' ||
      typeof v.draws !== 'number'
    ) {
      return { X: 0, O: 0, draws: 0 };
    }
    return { X: v.X, O: v.O, draws: v.draws };
  } catch {
    return { X: 0, O: 0, draws: 0 };
  }
}

function persistScores(next: ArrowRaceState): void {
  try {
    localStorage.setItem(
      SCORES_KEY,
      JSON.stringify({ X: next.scores.X, O: next.scores.O, draws: next.draws }),
    );
  } catch {
    // session-only
  }
}

export function useArrowRace(
  config: Partial<ArrowRaceGameConfig> = {},
  options: ArrowRaceOptions = {},
) {
  const session = options.session ?? null;
  const aiDelayMs = options.aiDelayMs;

  const [state, setState] = useState<ArrowRaceState>(() => {
    if (session) return session.getSnapshot().state;
    const initial = createArrowRaceInitialState(config);
    const persisted = loadPersistedScores();
    return arrowRaceStart({
      ...initial,
      scores: { X: persisted.X, O: persisted.O },
      draws: persisted.draws,
    });
  });

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const [roundDeadline, setRoundDeadline] = useState(0);

  const resolvedRoundRef = useRef(0);
  const nextRoundTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const roundTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aiTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const armedRoundRef = useRef(0);

  const clearTimer = (ref: { current: ReturnType<typeof setTimeout> | null }) => {
    if (ref.current) {
      clearTimeout(ref.current);
      ref.current = null;
    }
  };

  const clearLocalTimers = useCallback(() => {
    clearTimer(nextRoundTimerRef);
    clearTimer(roundTimerRef);
    clearTimer(aiTimerRef);
  }, []);

  // Local round machinery. Defined before effects that call it.
  const resolveLocalRound = useCallback(
    (
      roundId: number,
      answer: { playerId: string; direction: ArrowDirection } | null,
    ) => {
      if (session) return;
      if (resolvedRoundRef.current >= roundId) return;
      const current = stateRef.current;
      if (current.phase !== 'playing' || current.roundId !== roundId) return;
      if (current.stimulus === null) return;
      resolvedRoundRef.current = roundId;

      clearTimer(roundTimerRef);
      clearTimer(aiTimerRef);

      let scorer: Player | null = null;
      let correct = false;
      let answerDirection: ArrowDirection | null = null;

      if (answer !== null) {
        answerDirection = answer.direction;
        correct = isCorrectAnswer(current.stimulus, answer.direction);
        const answererMark: Player = answer.playerId === 'ai' ? 'O' : 'X';
        scorer = correct ? answererMark : answererMark === 'X' ? 'O' : 'X';
      }

      const next = applyRoundResult(current, {
        roundId,
        stimulus: current.stimulus,
        scorer,
        answer: answerDirection,
        correct,
      });

      if (scorer !== null) {
        playEffect(correct ? 'place-x' : 'invalid');
      } else {
        playEffect('timeout');
      }
      if (next.phase === 'finished' && next.result?.type === 'win') {
        playEffect(next.result.player === 'X' ? 'win' : 'lose');
      }

      stateRef.current = next;
      setState(next);
      setRoundDeadline(0);
      persistScores(next);

      if (next.phase === 'playing') {
        nextRoundTimerRef.current = setTimeout(() => {
          nextRoundTimerRef.current = null;
          const latest = stateRef.current;
          if (latest.phase !== 'playing' || latest.stimulus !== null) return;
          const stimulus = generateStimulus();
          const started = startRound(latest, stimulus);
          stateRef.current = started;
          setState(started);
          setRoundDeadline(Date.now() + RACE_ROUND_MS);
          armRoundTimers(started.roundId, started.aiDifficulty);
        }, RACE_ROUND_GAP_MS);
      }
    },
    // armRoundTimers is stable (only reads refs / constants)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session],
  );

  const armRoundTimers = useCallback(
    (roundId: number, difficulty: RaceDifficulty) => {
      if (session) return;
      if (armedRoundRef.current === roundId) return;
      armedRoundRef.current = roundId;

      clearTimer(roundTimerRef);
      clearTimer(aiTimerRef);

      roundTimerRef.current = setTimeout(() => {
        roundTimerRef.current = null;
        resolveLocalRound(roundId, null);
      }, RACE_ROUND_MS);

      const delay = aiDelayMs ?? AI_DELAY_MS[difficulty];
      aiTimerRef.current = setTimeout(() => {
        aiTimerRef.current = null;
        const latest = stateRef.current;
        if (latest.phase !== 'playing' || latest.roundId !== roundId) return;
        if (latest.stimulus === null) return;
        if (resolvedRoundRef.current >= roundId) return;
        const answer = chooseRaceAnswer(latest.stimulus, latest.aiDifficulty);
        resolveLocalRound(roundId, { playerId: 'ai', direction: answer });
      }, delay);
    },
    [session, aiDelayMs, resolveLocalRound],
  );

  useEffect(() => () => clearLocalTimers(), [clearLocalTimers]);

  // Online: mirror session state and compute the round deadline.
  useEffect(() => {
    if (!session) return;
    setState(session.getSnapshot().state);
    return session.subscribe((snapshot) => {
      setState(snapshot.state);
      if (snapshot.state.stimulus !== null && snapshot.turnStartTime > 0) {
        setRoundDeadline(snapshot.turnStartTime + RACE_ROUND_MS);
      } else {
        setRoundDeadline(0);
      }
    });
  }, [session]);

  // Local first round: state starts in playing with no stimulus.
  useEffect(() => {
    if (session) return;
    const current = stateRef.current;
    if (current.phase !== 'playing' || current.stimulus !== null) return;
    if (nextRoundTimerRef.current || roundTimerRef.current) return;
    if (resolvedRoundRef.current > 0 && armedRoundRef.current === resolvedRoundRef.current) {
      return;
    }

    const stimulus = generateStimulus();
    const next = startRound(current, stimulus);
    stateRef.current = next;
    setState(next);
    setRoundDeadline(Date.now() + RACE_ROUND_MS);
    armRoundTimers(next.roundId, next.aiDifficulty);
  }, [session, armRoundTimers]);

  const answer = useCallback(
    (direction: ArrowDirection): boolean => {
      if (session) {
        const accepted = session.answerRaceRound(direction);
        if (!accepted) playEffect('invalid');
        return accepted;
      }

      const current = stateRef.current;
      if (current.phase !== 'playing' || current.stimulus === null) {
        playEffect('invalid');
        return false;
      }
      if (resolvedRoundRef.current >= current.roundId) {
        playEffect('invalid');
        return false;
      }
      resolveLocalRound(current.roundId, { playerId: 'human', direction });
      return true;
    },
    [session, resolveLocalRound],
  );

  const startLocalRound = useCallback(() => {
    const current = stateRef.current;
    if (current.phase !== 'playing' || current.stimulus !== null) return;
    const stimulus = generateStimulus();
    const next = startRound(current, stimulus);
    stateRef.current = next;
    setState(next);
    setRoundDeadline(Date.now() + RACE_ROUND_MS);
    armRoundTimers(next.roundId, next.aiDifficulty);
  }, [armRoundTimers]);

  const rematch = useCallback(() => {
    clearLocalTimers();
    resolvedRoundRef.current = 0;
    armedRoundRef.current = 0;
    setRoundDeadline(0);
    if (session) {
      session.requestRematch();
      return;
    }
    const next = arrowRaceRestart(stateRef.current);
    stateRef.current = next;
    setState(next);
    nextRoundTimerRef.current = setTimeout(() => {
      nextRoundTimerRef.current = null;
      startLocalRound();
    }, RACE_ROUND_GAP_MS);
  }, [session, clearLocalTimers, startLocalRound]);

  const resetMatch = useCallback(() => {
    clearLocalTimers();
    resolvedRoundRef.current = 0;
    armedRoundRef.current = 0;
    setRoundDeadline(0);
    if (session) {
      session.leave();
      return;
    }
    const next = arrowRaceStart(arrowRaceNewGame(stateRef.current));
    stateRef.current = next;
    setState(next);
    persistScores(next);
    startLocalRound();
  }, [session, clearLocalTimers, startLocalRound]);

  return {
    state,
    answer,
    rematch,
    resetMatch,
    roundDeadline,
    roundMs: RACE_ROUND_MS,
  };
}
