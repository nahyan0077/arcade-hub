import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Home } from '../Home';
import { localStorageMock, audioCtor } from '../../../test/setup';
import { setMuted } from '../../../sound/audio';

const KEY = 'tic-tac-toe.scores.v1';

interface NavState {
  playerType: string;
  name: string;
  mode?: string;
  difficulty?: string;
}

function renderGame(state: NavState | null = { playerType: 'X', name: 'Alice' }) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/game', state }]}>
      <Home />
    </MemoryRouter>,
  );
}

function renderPve(overrides: Partial<NavState> = {}) {
  return renderGame({
    playerType: 'X',
    name: 'Alice',
    mode: 'pve',
    difficulty: 'medium',
    ...overrides,
  });
}

function cell(index: number) {
  return screen.getByLabelText(new RegExp(`^cell ${index + 1}(,.*)?$`));
}

function marksOnBoard(mark: string): number {
  return screen
    .queryAllByText(mark)
    .filter((node) => node.tagName === 'SPAN').length;
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
    setMuted(false);
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

  it('mute button silences subsequent moves and unmute restores them', async () => {
    // Fresh module graph: audio caches one AudioContext per module lifetime,
    // and beforeEach clears the ctor's call history — re-import Home so the
    // audio module under test has a fresh, observable context.
    vi.resetModules();
    const { Home: FreshHome } = await import('../Home');
    render(
      <MemoryRouter initialEntries={[{ pathname: '/game', state: { playerType: 'X', name: 'Alice' } }]}>
        <FreshHome />
      </MemoryRouter>,
    );
    const user = userEvent.setup();

    await user.click(cell(0));
    const ctorSpy = audioCtor as unknown as ReturnType<typeof vi.fn>;
    const results = ctorSpy.mock.results;
    const context = results[results.length - 1]?.value as {
      createOscillator: ReturnType<typeof vi.fn>;
    };
    expect(context).toBeDefined();
    context.createOscillator.mockClear();

    await user.click(screen.getByRole('button', { name: 'Mute sound' }));
    await user.click(cell(4));
    expect(context.createOscillator).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Unmute sound' }));
    await user.click(cell(8));
    expect(context.createOscillator).toHaveBeenCalled();
  });

  it('mute state survives a fresh mount', async () => {
    const user = userEvent.setup();
    const { unmount } = renderGame();

    await user.click(screen.getByRole('button', { name: 'Mute sound' }));
    unmount();
    renderGame();

    expect(screen.getByRole('button', { name: 'Unmute sound' })).toBeInTheDocument();
  });

  it('shows the AI personality as opponent and scores a reply move', async () => {
    const user = userEvent.setup();
    renderPve();

    expect(screen.getByTestId('score-o')).toHaveTextContent('SCOUT');
    expect(screen.getByTestId('score-x')).toHaveTextContent('ALICE');

    await user.click(cell(6));
    expect(screen.getByTestId('status')).toHaveTextContent('SCOUT is thinking...');
    expect(cell(6)).toHaveTextContent('X');

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent("ALICE's turn");
    });
    expect(marksOnBoard('O')).toBe(1);
  });

  it('disables the board while the AI is thinking', async () => {
    const user = userEvent.setup();
    renderPve();

    await user.click(cell(6));
    await screen.findByText(/thinking/);
    expect(cell(4)).toBeDisabled();
    expect(cell(0)).toBeDisabled();

    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent("ALICE's turn");
    });
    expect(cell(0)).toBeEnabled();
  });

  it('AI moves first when the human plays as O', async () => {
    renderPve({ playerType: 'O' });

    expect(screen.getByTestId('status')).toHaveTextContent('SCOUT is thinking...');
    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent("ALICE's turn");
    });
    expect(marksOnBoard('X')).toBe(1);
    expect(marksOnBoard('O')).toBe(0);
  });

  it('AI takes an available win', async () => {
    const user = userEvent.setup();
    renderPve();

    // Human X bottom-left; AI takes center; X top-left (threatens col 0);
    // AI blocks at 3; X plays 1 (threatens top row); AI wins on 5 (3-4-5).
    await user.click(cell(6));
    await waitFor(() => expect(marksOnBoard('O')).toBe(1));
    await user.click(cell(0));
    await waitFor(() => expect(marksOnBoard('O')).toBe(2));
    expect(cell(3)).toHaveTextContent('O');

    await user.click(cell(1));
    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('SCOUT wins!');
    });
    const dialog = screen.getByRole('dialog', { name: 'Game result' });
    expect(within(dialog).getByText('SCOUT')).toBeInTheDocument();
    expect(screen.getByTestId('score-o')).toHaveTextContent('1');
  });

  it('AI wins persist across rematch', async () => {
    const user = userEvent.setup();
    renderPve();

    await user.click(cell(6));
    await waitFor(() => expect(marksOnBoard('O')).toBe(1));
    await user.click(cell(0));
    await waitFor(() => expect(marksOnBoard('O')).toBe(2));
    await user.click(cell(1));
    await screen.findByRole('dialog', { name: 'Game result' });

    const dialog = screen.getByRole('dialog', { name: 'Game result' });
    await user.click(within(dialog).getByRole('button', { name: 'Rematch' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('score-o')).toHaveTextContent('1');
  });
});

describe('coach hints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    localStorageMock.setItem.mockReturnValue(undefined);
    setMuted(false);
  });

  it('marks the best cell while the hint is on and clears it when off', async () => {
    const user = userEvent.setup();
    renderGame();

    expect(screen.queryByTestId('hint-cell')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Hint' }));

    const hint = screen.getByTestId('hint-cell');
    expect(hint).toBe(cell(0));

    await user.click(screen.getByRole('button', { name: 'Hint' }));
    expect(screen.queryByTestId('hint-cell')).not.toBeInTheDocument();
  });

  it('recomputes the hint after a move', async () => {
    const user = userEvent.setup();
    renderGame();

    await user.click(screen.getByRole('button', { name: 'Hint' }));
    await user.click(cell(4));

    const hint = screen.getByTestId('hint-cell');
    expect(hint).not.toBe(cell(4));
    expect(hint).toBeEnabled();
  });

  it('disables the hint after the game ends', async () => {
    const user = userEvent.setup();
    renderGame();

    await user.click(screen.getByRole('button', { name: 'Hint' }));
    await playSequence(user, [0, 3, 1, 4, 2]);

    expect(screen.getByRole('button', { name: 'Hint' })).toBeDisabled();
  });
});