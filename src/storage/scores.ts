export interface PersistedScores {
  X: number;
  O: number;
  draws: number;
}

const STORAGE_KEY = 'tic-tac-toe.scores.v1';

export const ZERO_SCORES: PersistedScores = { X: 0, O: 0, draws: 0 };

function isValidScores(value: unknown): value is PersistedScores {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.X === 'number' &&
    typeof v.O === 'number' &&
    typeof v.draws === 'number' &&
    Number.isFinite(v.X) &&
    Number.isFinite(v.O) &&
    Number.isFinite(v.draws) &&
    v.X >= 0 &&
    v.O >= 0 &&
    v.draws >= 0
  );
}

export function loadScores(): PersistedScores {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return { ...ZERO_SCORES };
    const parsed: unknown = JSON.parse(raw);
    if (!isValidScores(parsed)) return { ...ZERO_SCORES };
    return { X: parsed.X, O: parsed.O, draws: parsed.draws };
  } catch (error) {
    console.warn('Failed to load scores, starting fresh', error);
    return { ...ZERO_SCORES };
  }
}

export function saveScores(scores: PersistedScores): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(scores));
  } catch (error) {
    console.warn('Failed to persist scores, session-only', error);
  }
}

export function clearScores(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Failed to clear scores', error);
  }
}