import {
  C4Board,
  C4_CELL_COUNT,
  C4_COLS,
  C4_DEFAULT_CONFIG,
  C4GameConfig,
  C4GameResult,
  C4GameState,
  C4_INITIAL_BOARD,
  C4Move,
  C4_ROWS,
} from './types';

/** Directions as (dc, dr) pairs: horizontal, vertical, both diagonals. */
const C4_WIN_DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];

export function createC4InitialState(config: Partial<C4GameConfig> = {}): C4GameState {
  const merged = { ...C4_DEFAULT_CONFIG, ...config };
  return {
    board: [...C4_INITIAL_BOARD],
    currentPlayer: merged.startingPlayer,
    phase: 'waiting',
    result: null,
    scores: { X: 0, O: 0 },
    draws: 0,
    mode: merged.mode,
    aiDifficulty: merged.aiDifficulty,
    playerNames: merged.playerNames,
    moveHistory: [],
  };
}

/** Lowest empty row in a column (row 0 = bottom), or null when the column is full. */
export function c4DropRow(board: C4Board, col: number): number | null {
  if (col < 0 || col >= C4_COLS) return null;
  for (let row = 0; row < C4_ROWS; row++) {
    if (board[row * C4_COLS + col] === 0) return row;
  }
  return null;
}

export function c4GetOpenColumns(board: C4Board): number[] {
  const open: number[] = [];
  for (let col = 0; col < C4_COLS; col++) {
    if (c4DropRow(board, col) !== null) open.push(col);
  }
  return open;
}

export function c4IsValidMove(state: C4GameState, col: number): boolean {
  return (
    state.phase === 'playing' &&
    Number.isInteger(col) &&
    c4DropRow(state.board, col) !== null
  );
}

/** Win detection anchored on the most recently placed cell; draw when the board is full. */
export function c4CheckWin(board: C4Board, lastCell: number): C4GameResult {
  const player = board[lastCell];
  if (player === 0) return { type: 'ongoing' };
  const row = Math.floor(lastCell / C4_COLS);
  const col = lastCell % C4_COLS;

  for (const [dc, dr] of C4_WIN_DIRECTIONS) {
    const cells = [lastCell];
    for (const [stepC, stepR] of [
      [dc, dr],
      [-dc, -dr],
    ]) {
      let c = col + stepC;
      let r = row + stepR;
      while (
        c >= 0 &&
        c < C4_COLS &&
        r >= 0 &&
        r < C4_ROWS &&
        board[r * C4_COLS + c] === player
      ) {
        cells.push(r * C4_COLS + c);
        c += stepC;
        r += stepR;
      }
    }
    if (cells.length >= 4) {
      cells.sort((a, b) => a - b);
      return { type: 'win', player, line: { cells } };
    }
  }

  if (board.every((cell) => cell !== 0)) {
    return { type: 'draw' };
  }

  return { type: 'ongoing' };
}

export function c4MakeMove(state: C4GameState, col: number): C4GameState {
  const row = c4DropRow(state.board, col);
  if (state.phase !== 'playing' || row === null) return state;

  const newBoard = [...state.board];
  const cell = row * C4_COLS + col;
  newBoard[cell] = state.currentPlayer;

  const move: C4Move = {
    index: col,
    player: state.currentPlayer,
    timestamp: Date.now(),
    boardBefore: state.board,
  };

  const result = c4CheckWin(newBoard, cell);
  const isFinished = result.type !== 'ongoing';
  const nextPlayer = state.currentPlayer === 'X' ? 'O' : 'X';

  const newScores = { ...state.scores };
  let newDraws = state.draws;
  if (result.type === 'win') {
    newScores[result.player]++;
  }
  if (result.type === 'draw') {
    newDraws++;
  }

  return {
    ...state,
    board: newBoard,
    currentPlayer: isFinished ? state.currentPlayer : nextPlayer,
    phase: isFinished ? 'finished' : 'playing',
    result,
    scores: newScores,
    draws: newDraws,
    moveHistory: [...state.moveHistory, move],
  };
}

export function c4StartGame(state: C4GameState): C4GameState {
  if (state.phase === 'playing') return state;
  return { ...state, phase: 'playing' };
}

export function c4RestartGame(state: C4GameState): C4GameState {
  const newStartingPlayer =
    state.result?.type === 'win'
      ? state.result.player === 'X'
        ? 'O'
        : 'X'
      : state.moveHistory.length % 2 === 0
        ? 'X'
        : 'O';

  return {
    ...state,
    board: [...C4_INITIAL_BOARD],
    currentPlayer: newStartingPlayer,
    phase: 'playing',
    result: null,
    draws: state.draws,
    moveHistory: [],
  };
}

export function c4NewGame(state: C4GameState): C4GameState {
  return createC4InitialState({
    mode: state.mode,
    aiDifficulty: state.aiDifficulty,
    playerNames: state.playerNames,
    startingPlayer: 'X',
  });
}

export function c4IsBoardFull(board: C4Board): boolean {
  return board.length === C4_CELL_COUNT && board.every((cell) => cell !== 0);
}
