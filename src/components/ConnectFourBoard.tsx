import React, { useState } from "react";
import type { C4Board, C4WinLine } from "../engine/connect-four/types";
import type { Player } from "../engine";
import { C4_COLS, C4_ROWS } from "../engine/connect-four/types";

const CELL_SIZE = "min(11vw, 11vh, 64px)";

interface ConnectFourBoardProps {
  board: C4Board;
  currentMark: Player;
  onColumnClick: (col: number) => void;
  winningLine: C4WinLine | null;
  interactionEnabled: boolean;
}

function openRow(board: C4Board, col: number): number | null {
  for (let row = 0; row < C4_ROWS; row++) {
    if (board[row * C4_COLS + col] === 0) return row;
  }
  return null;
}

export const ConnectFourBoard: React.FC<ConnectFourBoardProps> = ({
  board,
  currentMark,
  onColumnClick,
  winningLine,
  interactionEnabled,
}) => {
  const [hoverCol, setHoverCol] = useState<number | null>(null);
  const winningCells = winningLine?.cells ?? [];
  const ghostRow =
    hoverCol !== null && interactionEnabled ? openRow(board, hoverCol) : null;

  const columns = Array.from({ length: C4_COLS }, (_, col) => col);
  const rowsTopDown = Array.from({ length: C4_ROWS }, (_, i) => C4_ROWS - 1 - i);

  return (
    <div
      className="grid grid-cols-7 gap-[calc(var(--c4cell)/8)] rounded-2xl bg-zinc-700/70 p-[calc(var(--c4cell)/8)]"
      style={{ "--c4cell": CELL_SIZE } as React.CSSProperties}
    >
      {columns.map((col) => {
        const colOpen = openRow(board, col) !== null;
        return (
          <button
            key={col}
            type="button"
            aria-label={`column ${col + 1}`}
            data-testid={`c4-col-${col}`}
            disabled={!interactionEnabled || !colOpen}
            onClick={() => onColumnClick(col)}
            onMouseEnter={() => setHoverCol(col)}
            onMouseLeave={() => setHoverCol((prev) => (prev === col ? null : prev))}
            className="flex flex-col gap-[calc(var(--c4cell)/8)] rounded-xl focus:outline-none focus-visible:ring-4 focus-visible:ring-blue-400 disabled:cursor-not-allowed"
          >
            {rowsTopDown.map((row) => {
              const index = row * C4_COLS + col;
              const value = board[index];
              const isWinning = winningCells.includes(index);
              const isGhost = value === 0 && ghostRow === row;
              return (
                <span
                  key={index}
                  className={`flex h-[var(--c4cell)] w-[var(--c4cell)] items-center justify-center rounded-full bg-zinc-900 ${
                    isWinning ? "animate-win-pulse ring-4 ring-yellow-400" : ""
                  }`}
                >
                  {value !== 0 && (
                    <span
                      data-testid={`c4-disc-${index}`}
                      aria-hidden="true"
                      className={`h-[72%] w-[72%] rounded-full animate-pop ${
                        value === "X" ? "bg-blue-500" : "bg-red-500"
                      }`}
                    />
                  )}
                  {isGhost && (
                    <span
                      aria-hidden="true"
                      className={`h-[72%] w-[72%] rounded-full opacity-40 ${
                        currentMark === "X" ? "bg-blue-500" : "bg-red-500"
                      }`}
                    />
                  )}
                </span>
              );
            })}
          </button>
        );
      })}
    </div>
  );
};
