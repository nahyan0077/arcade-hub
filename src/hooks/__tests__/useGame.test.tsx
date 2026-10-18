import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGame } from '../useGame';
import { localStorageMock } from '../../test/setup';

const KEY = 'tic-tac-toe.scores.v1';

describe('useGame', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    localStorageMock.setItem.mockReturnValue(undefined);
  });

  it('starts in playing phase', () => {
    const { result } = renderHook(() => useGame());
    expect(result.current.state.phase).toBe('playing');
    expect(result.current.state.currentPlayer).toBe('X');
  });

  it('loads persisted scores on init', () => {
    localStorageMock.getItem.mockReturnValue(
      JSON.stringify({ X: 4, O: 2, draws: 1 }),
    );
    const { result } = renderHook(() => useGame());
    expect(result.current.state.scores).toEqual({ X: 4, O: 2 });
    expect(result.current.state.draws).toBe(1);
  });

  it('persists scores whenever they change', () => {
    const { result } = renderHook(() => useGame());
    act(() => {
      result.current.playMove(0);
    });
    expect(localStorageMock.setItem).toHaveBeenLastCalledWith(
      KEY,
      JSON.stringify({ X: 0, O: 0, draws: 0 }),
    );
    localStorageMock.setItem.mockClear();

    // X wins: 0, 3, 1, 4, 2
    act(() => {
      result.current.playMove(3);
      result.current.playMove(1);
      result.current.playMove(4);
      result.current.playMove(2);
    });
    expect(localStorageMock.setItem).toHaveBeenCalledTimes(1);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      KEY,
      JSON.stringify({ X: 1, O: 0, draws: 0 }),
    );
  });

  it('rejects moves on occupied cells and finished games', () => {
    const { result } = renderHook(() => useGame());
    let moved = false;
    act(() => {
      moved = result.current.playMove(0);
    });
    expect(moved).toBe(true);
    act(() => {
      moved = result.current.playMove(0);
    });
    expect(moved).toBe(false);

    act(() => {
      result.current.playMove(3);
      result.current.playMove(1);
      result.current.playMove(4);
      result.current.playMove(2);
    });
    expect(result.current.playMove(5)).toBe(false);
  });

  it('rematch clears the board but keeps scores and alternates starter', () => {
    const { result } = renderHook(() => useGame());
    act(() => {
      result.current.playMove(0);
      result.current.playMove(3);
      result.current.playMove(1);
      result.current.playMove(4);
      result.current.playMove(2); // X wins
    });
    expect(result.current.state.scores.X).toBe(1);

    act(() => {
      result.current.rematch();
    });
    expect(result.current.state.board.every((c) => c === 0)).toBe(true);
    expect(result.current.state.scores.X).toBe(1);
    expect(result.current.state.phase).toBe('playing');
    expect(result.current.state.currentPlayer).toBe('O');
  });

  it('resetMatch clears scores and board', () => {
    const { result } = renderHook(() => useGame());
    act(() => {
      result.current.playMove(0);
      result.current.playMove(3);
      result.current.playMove(1);
      result.current.playMove(4);
      result.current.playMove(2);
    });

    act(() => {
      result.current.resetMatch();
    });
    expect(result.current.state.scores).toEqual({ X: 0, O: 0 });
    expect(result.current.state.draws).toBe(0);
    expect(result.current.state.board.every((c) => c === 0)).toBe(true);
    expect(result.current.state.currentPlayer).toBe('X');
  });
});