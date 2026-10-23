import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ConnectFour } from '../ConnectFour';
import { localStorageMock } from '../../../test/setup';
import { setMuted } from '../../../sound/audio';

const KEY = 'connect-four.scores.v1';

interface NavState {
  name?: string;
  mode?: string;
  difficulty?: string;
}

function renderGame(state: NavState | null = { name: 'Alice' }) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/connect-four', state }]}>
      <ConnectFour />
    </MemoryRouter>,
  );
}

function renderPve(overrides: Partial<NavState> = {}) {
  return renderGame({
    name: 'Alice',
    mode: 'pve',
    difficulty: 'medium',
    ...overrides,
  });
}

function column(col: number) {
  return screen.getByTestId(`c4-col-${col}`);
}

describe('ConnectFour game screen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    localStorageMock.setItem.mockReturnValue(undefined);
    setMuted(false);
  });

  it('renders an empty board with X serving', () => {
    renderGame();
    expect(screen.getByTestId('status')).toHaveTextContent("ALICE's turn");
    expect(screen.getByTestId('score-x')).toHaveTextContent('0');
    expect(screen.getByTestId('score-draws')).toHaveTextContent('0');
  });

  it('falls back to defaults without navigation state', () => {
    renderGame(null);
    expect(screen.getByTestId('status')).toHaveTextContent("PLAYER 1's turn");
  });

  it('drops a disc when a column is clicked and alternates turns', async () => {
    const user = userEvent.setup();
    renderGame();
    await user.click(column(0));
    expect(screen.getByTestId('c4-disc-0')).toBeInTheDocument();
    expect(screen.getByTestId('status')).toHaveTextContent("PLAYER 2's turn");
    await user.click(column(6));
    expect(screen.getByTestId('c4-disc-6')).toBeInTheDocument();
    expect(screen.getByTestId('status')).toHaveTextContent("ALICE's turn");
  });

  it('disables a column once it is full', async () => {
    const user = userEvent.setup();
    renderGame();
    // Six alternating discs on one column: X rows 0/2/4, O rows 1/3/5 — no four-run.
    for (let i = 0; i < 6; i++) {
      await user.click(column(0));
    }
    expect(column(0)).toBeDisabled();
    expect(column(2)).not.toBeDisabled();
  });

  it('declares a vertical win and updates scores', async () => {
    const user = userEvent.setup();
    renderGame();
    for (const col of [0, 1, 0, 1, 0, 1, 0]) {
      await user.click(column(col));
    }
    expect(screen.getByTestId('status')).toHaveTextContent('ALICE wins!');
    expect(screen.getByTestId('score-x')).toHaveTextContent('1');

    const dialog = screen.getByRole('dialog', { name: 'Game result' });
    expect(within(dialog).getByText('ALICE')).toBeInTheDocument();
    expect(within(dialog).getByText('Rematch')).toBeInTheDocument();
  });

  it('rematch keeps scores and serves the loser', async () => {
    const user = userEvent.setup();
    renderGame();
    for (const col of [0, 1, 0, 1, 0, 1, 0]) {
      await user.click(column(col));
    }
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Rematch' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('status')).toHaveTextContent("PLAYER 2's turn");
    expect(screen.getByTestId('score-x')).toHaveTextContent('1');
  });

  it('resetMatch wipes scores and the board', async () => {
    const user = userEvent.setup();
    renderGame();
    for (const col of [0, 1, 0, 1, 0, 1, 0]) {
      await user.click(column(col));
    }
    await user.click(screen.getByRole('button', { name: 'Reset Scores' }));
    expect(screen.getByTestId('score-x')).toHaveTextContent('0');
    expect(screen.queryAllByTestId(/c4-disc-/)).toHaveLength(0);
    expect(screen.getByTestId('status')).toHaveTextContent("ALICE's turn");
  });

  it('persists scores under the connect-four key', async () => {
    const user = userEvent.setup();
    renderGame();
    for (const col of [0, 1, 0, 1, 0, 1, 0]) {
      await user.click(column(col));
    }
    expect(localStorageMock.setItem).toHaveBeenLastCalledWith(
      KEY,
      JSON.stringify({ X: 1, O: 0, draws: 0 }),
    );
  });

  it('shows the AI thinking status and lets the AI reply', async () => {
    const user = userEvent.setup();
    renderPve();
    await user.click(column(0));
    expect(screen.getByTestId('status')).toHaveTextContent('SCOUT is thinking...');
    // Medium SCOUT prefers the center on a quiet board.
    await waitFor(() => expect(screen.getByTestId('c4-disc-3')).toBeInTheDocument());
    expect(screen.getByTestId('status')).toHaveTextContent("ALICE's turn");
  });

  it('labels an AI loss from the human perspective without confetti', async () => {
    const user = userEvent.setup();
    renderPve();
    const humanTurn = () =>
      waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent("ALICE's turn"));

    // X never threatens; medium SCOUT stacks column 3 for the win.
    await user.click(column(6));
    await humanTurn();
    await user.click(column(5));
    await humanTurn();
    await user.click(column(6));
    await humanTurn();
    await user.click(column(4));

    await waitFor(() =>
      expect(screen.getByTestId('status')).toHaveTextContent('You lose!'),
    );
    expect(screen.getByText('SCOUT wins')).toBeInTheDocument();
    expect(screen.queryByTestId('win-confetti')).not.toBeInTheDocument();
  });

  it('uses the selected difficulty personality', async () => {
    const user = userEvent.setup();
    renderPve({ difficulty: 'hard' });
    await user.click(column(0));
    expect(screen.getByTestId('status')).toHaveTextContent('VANGUARD is thinking...');
  });
});
