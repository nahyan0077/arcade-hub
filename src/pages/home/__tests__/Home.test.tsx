import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Home } from '../Home';
import { localStorageMock, audioCtor } from '../../../test/setup';
import { setMuted } from '../../../sound/audio';
import { OnlineSessionProvider } from '../../../net/OnlineSessionContext';
import { RoomSession } from '../../../net/RoomSession';
import { createFakeTransportBus } from '../../../net/transport';

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
      expect(screen.getByTestId('status')).toHaveTextContent('You lose!');
    });
    const dialog = screen.getByRole('dialog', { name: 'Game result' });
    expect(within(dialog).getByText('You lose!')).toBeInTheDocument();
    expect(within(dialog).getByText('SCOUT wins')).toBeInTheDocument();
    expect(screen.getByTestId('score-o')).toHaveTextContent('1');
  });

  it('human win over the AI shows You win!', async () => {
    const user = userEvent.setup();
    renderPve();

    // Deterministic line vs medium SCOUT (tactical win/block, else best
    // preferred square): X 0 → O 4; X 8 → O 2; X 6 → O 3; X 7 wins 6-7-8.
    await user.click(cell(0));
    await waitFor(() => expect(marksOnBoard('O')).toBe(1));
    expect(cell(4)).toHaveTextContent('O');
    await user.click(cell(8));
    await waitFor(() => expect(marksOnBoard('O')).toBe(2));
    expect(cell(2)).toHaveTextContent('O');
    await user.click(cell(6));
    await waitFor(() => expect(marksOnBoard('O')).toBe(3));
    expect(cell(3)).toHaveTextContent('O');

    await user.click(cell(7));
    await waitFor(() => {
      expect(screen.getByTestId('status')).toHaveTextContent('You win!');
    });
    const dialog = screen.getByRole('dialog', { name: 'Game result' });
    expect(within(dialog).getByText('You win!')).toBeInTheDocument();
    expect(within(dialog).queryByText(/wins/)).not.toBeInTheDocument();
    expect(screen.getByTestId('score-x')).toHaveTextContent('1');
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

describe('online game screen', () => {
  const live: RoomSession[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    localStorageMock.setItem.mockReturnValue(undefined);
    setMuted(false);
  });

  afterEach(() => {
    for (const session of live) session.destroy();
    live.length = 0;
  });

  function connectedPair() {
    const bus = createFakeTransportBus();
    const host = new RoomSession({
      role: 'host',
      roomCode: 'ABC234',
      myId: 'host-1',
      myName: 'ALICE',
      transport: bus.createEndpoint(),
      heartbeatMs: 100,
      timeoutMs: 10_000,
      joinTimeoutMs: 5_000,
    });
    const guest = new RoomSession({
      role: 'guest',
      roomCode: 'ABC234',
      myId: 'guest-1',
      myName: 'BOB',
      transport: bus.createEndpoint(),
      heartbeatMs: 100,
      timeoutMs: 10_000,
      joinTimeoutMs: 5_000,
    });
    host.start();
    guest.start();
    live.push(host, guest);
    return { host, guest };
  }

  function mount(session: RoomSession) {
    const view = render(
      <OnlineSessionProvider initialSession={session}>
        <MemoryRouter initialEntries={[{ pathname: '/room' }]}>
          <Home />
        </MemoryRouter>
      </OnlineSessionProvider>,
    );
    return view.container;
  }

  function cellIn(container: HTMLElement, index: number) {
    return within(container).getByLabelText(new RegExp(`^cell ${index + 1}(,.*)?$`));
  }

  async function hostWins(user: ReturnType<typeof userEvent.setup>, hostBoard: HTMLElement, guestBoard: HTMLElement) {
    await user.click(cellIn(hostBoard, 0));
    await user.click(cellIn(guestBoard, 3));
    await user.click(cellIn(hostBoard, 1));
    await user.click(cellIn(guestBoard, 4));
    await user.click(cellIn(hostBoard, 2));
    await within(hostBoard).findByRole('dialog', { name: 'Game result' });
  }

  it('shows both player names and enforces turn order', async () => {
    const user = userEvent.setup();
    const { host, guest } = connectedPair();
    const hostBoard = mount(host);
    const guestBoard = mount(guest);

    expect(within(hostBoard).getByTestId('score-x')).toHaveTextContent('ALICE');
    expect(within(hostBoard).getByTestId('score-o')).toHaveTextContent('BOB');
    expect(within(guestBoard).getByTestId('score-x')).toHaveTextContent('ALICE');

    expect(cellIn(guestBoard, 0)).toBeDisabled();

    await user.click(cellIn(hostBoard, 0));
    await waitFor(() => expect(cellIn(guestBoard, 0)).toHaveTextContent('X'));
    expect(within(hostBoard).getByTestId('status')).toHaveTextContent("BOB's turn");

    await user.click(cellIn(guestBoard, 4));
    await waitFor(() => expect(cellIn(hostBoard, 4)).toHaveTextContent('O'));
  });

  it('scores a win in-session without persisting to localStorage', async () => {
    const user = userEvent.setup();
    const { host, guest } = connectedPair();
    const hostBoard = mount(host);
    const guestBoard = mount(guest);

    await hostWins(user, hostBoard, guestBoard);

    expect(within(hostBoard).getByTestId('score-x')).toHaveTextContent('1');
    expect(within(guestBoard).getByTestId('score-x')).toHaveTextContent('1');
    expect(within(hostBoard).getByTestId('status')).toHaveTextContent('You win!');
    expect(within(guestBoard).getByTestId('status')).toHaveTextContent('You lose!');
    const hostDialog = within(hostBoard).getByRole('dialog', { name: 'Game result' });
    expect(within(hostDialog).getByText('You win!')).toBeInTheDocument();
    const guestDialog = within(guestBoard).getByRole('dialog', { name: 'Game result' });
    expect(within(guestDialog).getByText('You lose!')).toBeInTheDocument();
    expect(within(hostBoard).getByTestId('win-confetti')).toBeInTheDocument();
    expect(within(guestBoard).queryByTestId('win-confetti')).not.toBeInTheDocument();
    expect(localStorageMock.setItem).not.toHaveBeenCalledWith(KEY, expect.anything());
  });

  it('rematches only after both players request it', async () => {
    const user = userEvent.setup();
    const { host, guest } = connectedPair();
    const hostBoard = mount(host);
    const guestBoard = mount(guest);

    await hostWins(user, hostBoard, guestBoard);

    const hostDialog = within(hostBoard).getByRole('dialog', { name: 'Game result' });
    await user.click(within(hostDialog).getByRole('button', { name: 'Rematch' }));

    const waiting = within(hostBoard).getByRole('button', { name: 'Waiting…' });
    expect(waiting).toBeDisabled();
    expect(cellIn(guestBoard, 0)).toHaveTextContent('X');

    const guestDialog = within(guestBoard).getByRole('dialog', { name: 'Game result' });
    await user.click(within(guestDialog).getByRole('button', { name: 'Rematch' }));

    await waitFor(() => {
      expect(within(hostBoard).queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(cellIn(hostBoard, 0)).toBeEmptyDOMElement();
    expect(cellIn(guestBoard, 0)).toBeEmptyDOMElement();
    expect(within(hostBoard).getByTestId('score-x')).toHaveTextContent('1');
  });

  it('shows a disconnect dialog when the opponent leaves', async () => {
    const user = userEvent.setup();
    const { host, guest } = connectedPair();
    const hostBoard = mount(host);
    const guestBoard = mount(guest);

    await user.click(within(guestBoard).getByRole('button', { name: 'Leave Room' }));

    await waitFor(() =>
      expect(
        within(hostBoard).getByRole('dialog', { name: 'Opponent disconnected' }),
      ).toBeInTheDocument(),
    );
    expect(within(hostBoard).getByTestId('status')).toHaveTextContent(
      'Opponent disconnected',
    );
  });

  it('redirects /room to the menu without a session', async () => {
    render(
      <MemoryRouter initialEntries={[{ pathname: '/room' }]}>
        <OnlineSessionProvider>
          <Routes>
            <Route path="/" element={<div>start screen</div>} />
            <Route path="/room" element={<Home />} />
          </Routes>
        </OnlineSessionProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText('start screen')).toBeInTheDocument();
  });
});