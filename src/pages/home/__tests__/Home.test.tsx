import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Home } from '../Home';
import { localStorageMock } from '../../../test/setup';

const KEY = 'tic-tac-toe.scores.v1';

function renderGame(state: { playerType: string; name: string } | null = { playerType: 'X', name: 'Alice' }) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/game', state }]}>
      <Home />
    </MemoryRouter>,
  );
}

function cell(index: number) {
  return screen.getByLabelText(new RegExp(`^cell ${index + 1}(,.*)?$`));
}

async function playSequence(user: ReturnType<typeof userEvent.setup>, moves: number[]) {
  for (const move of moves) {
    await user.click(cell(move));
  }
}

describe('Home game screen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    localStorageMock.setItem.mockReturnValue(undefined);
  });

  it('renders empty board with first player turn', () => {
    renderGame();
    expect(screen.getByTestId('status')).toHaveTextContent("ALICE's turn");
    expect(screen.getByTestId('score-x')).toHaveTextContent('0');
    expect(screen.getByTestId('score-draws')).toHaveTextContent('0');
  });

  it('falls back to defaults without navigation state', () => {
    renderGame(null);
    expect(screen.getByTestId('status')).toHaveTextContent("PLAYER 1's turn");
  });

  it('alternates marks between players', async () => {
    const user = userEvent.setup();
    renderGame();
    await playSequence(user, [0, 4]);
    expect(cell(0)).toHaveTextContent('X');
    expect(cell(4)).toHaveTextContent('O');
    expect(screen.getByTestId('status')).toHaveTextContent("ALICE's turn");
  });

  it('ignores clicks on occupied cells', async () => {
    const user = userEvent.setup();
    renderGame();
    await playSequence(user, [0, 0]);
    expect(cell(0)).toHaveTextContent('X');
    expect(screen.getByTestId('status')).toHaveTextContent("PLAYER 2's turn");
  });

  it('declares winner, shows dialog and increments score on win', async () => {
    const user = userEvent.setup();
    renderGame();
    await playSequence(user, [0, 3, 1, 4, 2]); // X wins top row

    expect(screen.getByTestId('status')).toHaveTextContent('ALICE wins!');
    const dialog = screen.getByRole('dialog', { name: 'Game result' });
    expect(within(dialog).getByText('ALICE')).toBeInTheDocument();
    expect(screen.getByTestId('score-x')).toHaveTextContent('1');
    expect(screen.getByTestId('score-o')).toHaveTextContent('0');
  });

  it('disables the board after the game finishes', async () => {
    const user = userEvent.setup();
    renderGame();
    await playSequence(user, [0, 3, 1, 4, 2]);
    expect(cell(5)).toBeDisabled();
  });

  it('rematch from dialog clears the board but keeps scores', async () => {
    const user = userEvent.setup();
    renderGame();
    await playSequence(user, [0, 3, 1, 4, 2]);

    const dialog = screen.getByRole('dialog', { name: 'Game result' });
    await user.click(within(dialog).getByRole('button', { name: 'Rematch' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(cell(0)).toBeEmptyDOMElement();
    expect(screen.getByTestId('score-x')).toHaveTextContent('1');
    expect(screen.getByTestId('status')).toHaveTextContent("PLAYER 2's turn");
  });

  it('new game from dialog resets scores', async () => {
    const user = userEvent.setup();
    renderGame();
    await playSequence(user, [0, 3, 1, 4, 2]);

    const dialog = screen.getByRole('dialog', { name: 'Game result' });
    await user.click(within(dialog).getByRole('button', { name: 'New Game' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('score-x')).toHaveTextContent('0');
    expect(screen.getByTestId('score-draws')).toHaveTextContent('0');
    expect(screen.getByTestId('status')).toHaveTextContent("ALICE's turn");
  });

  it('handles a draw with dialog and draw counter', async () => {
    const user = userEvent.setup();
    renderGame();
    // X O X / X O O / O X X
    await playSequence(user, [0, 1, 2, 4, 3, 5, 7, 6, 8]);

    expect(screen.getByTestId('status')).toHaveTextContent("It's a draw!");
    const dialog = screen.getByRole('dialog', { name: 'Game result' });
    expect(within(dialog).getByText('Draw')).toBeInTheDocument();
    expect(screen.getByTestId('score-draws')).toHaveTextContent('1');
    expect(screen.getByTestId('score-x')).toHaveTextContent('0');
  });

  it('persists scores to localStorage when they change', async () => {
    const user = userEvent.setup();
    renderGame();
    await playSequence(user, [0, 3, 1, 4, 2]);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      KEY,
      JSON.stringify({ X: 1, O: 0, draws: 0 }),
    );
  });

  it('restores scores from localStorage on load', () => {
    localStorageMock.getItem.mockReturnValue(
      JSON.stringify({ X: 7, O: 3, draws: 2 }),
    );
    renderGame();
    expect(screen.getByTestId('score-x')).toHaveTextContent('7');
    expect(screen.getByTestId('score-o')).toHaveTextContent('3');
    expect(screen.getByTestId('score-draws')).toHaveTextContent('2');
  });

  it('toggles sound button state', async () => {
    const user = userEvent.setup();
    renderGame();
    const toggle = screen.getByRole('button', { name: 'Mute sound' });
    await user.click(toggle);
    expect(screen.getByRole('button', { name: 'Unmute sound' })).toBeInTheDocument();
  });
});