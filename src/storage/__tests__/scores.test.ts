import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadScores, saveScores, clearScores, ZERO_SCORES, C4_SCORES_KEY } from '../scores';

const KEY = 'tic-tac-toe.scores.v1';
const store = localStorage as unknown as Record<string, ReturnType<typeof vi.fn>>;

describe('score persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.getItem.mockReturnValue(null);
    store.setItem.mockReturnValue(undefined);
    store.removeItem.mockReturnValue(undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('returns zero scores when nothing stored', () => {
    expect(loadScores()).toEqual(ZERO_SCORES);
  });

  it('saves and loads scores round-trip', () => {
    const scores = { X: 3, O: 2, draws: 5 };
    saveScores(scores);
    expect(store.setItem).toHaveBeenCalledWith(KEY, JSON.stringify(scores));

    store.getItem.mockReturnValue(JSON.stringify(scores));
    expect(loadScores()).toEqual(scores);
  });

  it('returns zero scores on corrupted JSON', () => {
    store.getItem.mockReturnValue('{not json');
    expect(loadScores()).toEqual(ZERO_SCORES);
    expect(console.warn).toHaveBeenCalled();
  });

  it('returns zero scores on invalid shape', () => {
    store.getItem.mockReturnValue(JSON.stringify({ X: 'three', O: 1, draws: 0 }));
    expect(loadScores()).toEqual(ZERO_SCORES);
  });

  it('rejects negative values', () => {
    store.getItem.mockReturnValue(JSON.stringify({ X: -1, O: 1, draws: 0 }));
    expect(loadScores()).toEqual(ZERO_SCORES);
  });

  it('clears stored scores', () => {
    clearScores();
    expect(store.removeItem).toHaveBeenCalledWith(KEY);
  });

  it('does not throw when storage is unavailable', () => {
    store.setItem.mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    expect(() => saveScores({ X: 1, O: 0, draws: 0 })).not.toThrow();
    expect(console.warn).toHaveBeenCalled();
  });

  it('round-trips connect-four scores under their own key', () => {
    const scores = { X: 7, O: 5, draws: 2 };
    saveScores(scores, C4_SCORES_KEY);
    expect(store.setItem).toHaveBeenCalledWith(C4_SCORES_KEY, JSON.stringify(scores));

    store.getItem.mockReturnValue(JSON.stringify(scores));
    expect(loadScores(C4_SCORES_KEY)).toEqual(scores);
  });

  it('clears connect-four scores without touching the tic-tac-toe key', () => {
    clearScores(C4_SCORES_KEY);
    expect(store.removeItem).toHaveBeenCalledWith(C4_SCORES_KEY);
    expect(store.removeItem).not.toHaveBeenCalledWith(KEY);
  });
});