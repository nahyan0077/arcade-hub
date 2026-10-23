import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useConnectFour } from '../useConnectFour';
import { localStorageMock } from '../../test/setup';

const KEY = 'connect-four.scores.v1';

describe('useConnectFour', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    localStorageMock.setItem.mockReturnValue(undefined);
  });

  it('starts in playing phase with X serving', () => {
    const { result } = renderHook(() => useConnectFour());
    expect(result.current.state.phase).toBe('playing');
    expect(result.current.state.currentPlayer).toBe('X');
    expect(result.current.state.board).toHaveLength(42);
  });

  it('loads persisted scores on init', () => {
    localStorageMock.getItem.mockReturnValue(
      JSON.stringify({ X: 4, O: 2, draws: 1 }),
    );
    const { result } = renderHook(() => useConnectFour());
    expect(result.current.state.scores).toEqual({ X: 4, O: 2 });
    expect(result.current.state.draws).toBe(1);
  });

  it('persists scores whenever they change', () => {
    const { result } = renderHook(() => useConnectFour());
    act(() => {
      result.current.playMove(0);
    });
    expect(localStorageMock.setItem).toHaveBeenLastCalledWith(
      KEY,
      JSON.stringify({ X: 0, O: 0, draws: 0 }),
    );
    localStorageMock.setItem.mockClear();

    // X already took col 0 row 0 above; stacking three more Xs there wins
    // (O fills col 1 without blocking).
    act(() => {
      result.current.playMove(1);
      result.current.playMove(0);
      result.current.playMove(1);
      result.current.playMove(0);
      result.current.playMove(1);
      result.current.playMove(0);
    });
    expect(localStorageMock.setItem).toHaveBeenCalledTimes(1);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      KEY,
      JSON.stringify({ X: 1, O: 0, draws: 0 }),
    );
  });

  it('rejects moves on full columns and finished games', () => {
    const { result } = renderHook(() => useConnectFour());
    // Fill columns 0 and 1 completely (three discs each), leaving X to move.
    for (let i = 0; i < 6; i++) {
      act(() => {
        result.current.playMove(0);
        result.current.playMove(1);
      });
    }
    let moved = true;
    act(() => {
      moved = result.current.playMove(0);
    });
    expect(moved).toBe(false);

    // Win down column 2 instead.
    act(() => {
      result.current.playMove(2);
      result.current.playMove(3);
      result.current.playMove(2);
      result.current.playMove(3);
      result.current.playMove(2);
      result.current.playMove(3);
      result.current.playMove(2);
    });
    expect(result.current.state.result?.type).toBe('win');
    act(() => {
      moved = result.current.playMove(6);
    });
    expect(moved).toBe(false);
  });

  it('rematch clears the board but keeps scores and serves the loser', () => {
    const { result } = renderHook(() => useConnectFour());
    act(() => {
      result.current.playMove(0);
      result.current.playMove(1);
      result.current.playMove(0);
      result.current.playMove(1);
      result.current.playMove(0);
      result.current.playMove(1);
      result.current.playMove(0);
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
    const { result } = renderHook(() => useConnectFour());
    act(() => {
      result.current.playMove(0);
      result.current.playMove(1);
      result.current.playMove(0);
      result.current.playMove(1);
      result.current.playMove(0);
      result.current.playMove(1);
      result.current.playMove(0);
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
