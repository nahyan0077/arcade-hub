import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Start } from '../Start';
import { OnlineSessionProvider, useOnlineSession } from '../../../net/OnlineSessionContext';

function GameProbe() {
  const location = useLocation();
  return (
    <div>
      game screen
      <span data-testid="game-state">{JSON.stringify(location.state)}</span>
    </div>
  );
}

function LobbyProbe() {
  const { session } = useOnlineSession();
  const snapshot = session?.getSnapshot() ?? null;
  return (
    <div>
      lobby screen
      <span data-testid="lobby-snapshot">
        {JSON.stringify(
          snapshot && {
            role: snapshot.role,
            roomCode: snapshot.roomCode,
            status: snapshot.status,
            myName: snapshot.myName,
            game: snapshot.game,
          },
        )}
      </span>
    </div>
  );
}

function QueueProbe() {
  const location = useLocation();
  return (
    <div>
      queue screen
      <span data-testid="queue-state">{JSON.stringify(location.state)}</span>
    </div>
  );
}

function ConnectFourProbe() {
  const location = useLocation();
  return (
    <div>
      connect four screen
      <span data-testid="c4-state">{JSON.stringify(location.state)}</span>
    </div>
  );
}

function renderStart() {
  return render(
    <OnlineSessionProvider>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<Start />} />
          <Route path="/game" element={<GameProbe />} />
          <Route path="/connect-four" element={<ConnectFourProbe />} />
          <Route path="/lobby" element={<LobbyProbe />} />
          <Route path="/queue" element={<QueueProbe />} />
        </Routes>
      </MemoryRouter>
    </OnlineSessionProvider>,
  );
}

function renderStartForGame(game: string) {
  return render(
    <OnlineSessionProvider>
      <MemoryRouter initialEntries={[{ pathname: '/', state: { game } }]}>
        <Routes>
          <Route path="/" element={<Start />} />
          <Route path="/game" element={<GameProbe />} />
          <Route path="/connect-four" element={<ConnectFourProbe />} />
          <Route path="/lobby" element={<LobbyProbe />} />
          <Route path="/queue" element={<QueueProbe />} />
        </Routes>
      </MemoryRouter>
    </OnlineSessionProvider>,
  );
}

function lobbySnapshot() {
  return JSON.parse(screen.getByTestId('lobby-snapshot').textContent ?? 'null');
}

describe('Start screen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    toast.remove();
  });

  it('blocks start without a name', async () => {
    const user = userEvent.setup();
    renderStart();
    await user.click(screen.getByText('Start Game'));
    expect(screen.queryByText('game screen')).not.toBeInTheDocument();
    expect(await screen.findByText('Please Enter your name')).toBeInTheDocument();
  });

  it('blocks start with whitespace-only name', async () => {
    const user = userEvent.setup();
    renderStart();
    await user.type(screen.getByPlaceholderText('Enter your name'), '   ');
    await user.click(screen.getByText('Start Game'));
    expect(screen.queryByText('game screen')).not.toBeInTheDocument();
    expect(await screen.findByText('Please Enter your name')).toBeInTheDocument();
  });

  it('blocks start without selecting a mark', async () => {
    const user = userEvent.setup();
    renderStart();
    await user.type(screen.getByPlaceholderText('Enter your name'), 'Alice');
    await user.click(screen.getByText('Start Game'));
    expect(await screen.findByText('Please select the player type')).toBeInTheDocument();
    expect(screen.queryByText('game screen')).not.toBeInTheDocument();
  });

  it('navigates to game with selected mark and name', async () => {
    const user = userEvent.setup();
    renderStart();
    await user.click(screen.getByRole('button', { name: 'Play as O' }));
    await user.type(screen.getByPlaceholderText('Enter your name'), 'Alice');
    await user.click(screen.getByText('Start Game'));
    expect(await screen.findByText('game screen')).toBeInTheDocument();
  });

  it('defaults to 2-player mode with difficulty hidden', () => {
    renderStart();
    expect(screen.getByRole('button', { name: '2 Players' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'vs AI' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('group', { name: 'AI difficulty' })).not.toBeInTheDocument();
  });

  it('reveals difficulty picker only in vs AI mode', async () => {
    const user = userEvent.setup();
    renderStart();
    await user.click(screen.getByRole('button', { name: 'vs AI' }));
    const group = screen.getByRole('group', { name: 'AI difficulty' });
    expect(within(group).getAllByRole('button')).toHaveLength(4);
    expect(within(group).getByRole('button', { name: 'MEDIUM' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(group).queryByRole('button', { name: 'HARD' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('passes mode and difficulty to the game route', async () => {
    const user = userEvent.setup();
    renderStart();
    await user.click(screen.getByRole('button', { name: 'Play as X' }));
    await user.type(screen.getByPlaceholderText('Enter your name'), 'Bob');
    await user.click(screen.getByRole('button', { name: 'vs AI' }));
    await user.click(screen.getByRole('button', { name: 'HARD' }));
    await user.click(screen.getByText('Start Game'));
    await screen.findByText('game screen');
    const state = JSON.parse(screen.getByTestId('game-state').textContent ?? '{}');
    expect(state).toMatchObject({ playerType: 'X', name: 'Bob', mode: 'pve', difficulty: 'hard' });
  });

  it('passes pvp mode with default difficulty', async () => {
    const user = userEvent.setup();
    renderStart();
    await user.click(screen.getByRole('button', { name: 'Play as X' }));
    await user.type(screen.getByPlaceholderText('Enter your name'), 'Ana');
    await user.click(screen.getByText('Start Game'));
    await screen.findByText('game screen');
    const state = JSON.parse(screen.getByTestId('game-state').textContent ?? '{}');
    expect(state).toMatchObject({ mode: 'pvp', difficulty: 'medium' });
  });
});

describe('Start screen online mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    toast.dismiss();
  });

  it('reveals room actions only in online mode and hides mark selection', async () => {
    const user = userEvent.setup();
    renderStart();

    expect(screen.queryByRole('group', { name: 'Online room' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Online' }));

    const group = screen.getByRole('group', { name: 'Online room' });
    expect(within(group).getByRole('button', { name: 'Create Room' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(group).getByRole('button', { name: 'Join Room' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('button', { name: 'Play as X' })).not.toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'AI difficulty' })).not.toBeInTheDocument();
  });

  it('creates a host room with a generated code and navigates to the lobby', async () => {
    const user = userEvent.setup();
    renderStart();

    await user.type(screen.getByPlaceholderText('Enter your name'), 'Alice');
    await user.click(screen.getByRole('button', { name: 'Online' }));
    await user.click(screen.getByRole('button', { name: 'Create Room' }));
    await user.click(screen.getByRole('button', { name: 'Start Game' }));
    await screen.findByText('lobby screen');

    const snapshot = lobbySnapshot();
    expect(snapshot.role).toBe('host');
    expect(snapshot.status).toBe('waiting');
    expect(snapshot.myName).toBe('ALICE');
    expect(snapshot.roomCode).toMatch(/^[A-Z0-9]{6}$/);
  });

  it('blocks join with an invalid room code', async () => {
    const user = userEvent.setup();
    renderStart();

    await user.type(screen.getByPlaceholderText('Enter your name'), 'Bob');
    await user.click(screen.getByRole('button', { name: 'Online' }));
    await user.click(screen.getByRole('button', { name: 'Join Room' }));
    await user.type(screen.getByRole('textbox', { name: 'Room code' }), '12');
    await user.click(screen.getByRole('button', { name: 'Start Game' }));

    expect(await screen.findByText('Enter a valid 6-character room code')).toBeInTheDocument();
    expect(screen.queryByText('lobby screen')).not.toBeInTheDocument();
  });

  it('joins an existing room and navigates to the lobby', async () => {
    const user = userEvent.setup();
    renderStart();

    await user.type(screen.getByPlaceholderText('Enter your name'), 'Bob');
    await user.click(screen.getByRole('button', { name: 'Online' }));
    await user.click(screen.getByRole('button', { name: 'Join Room' }));
    await user.type(screen.getByRole('textbox', { name: 'Room code' }), 'abc234');
    await user.click(screen.getByRole('button', { name: 'Start Game' }));
    await screen.findByText('lobby screen');

    const snapshot = lobbySnapshot();
    expect(snapshot.role).toBe('guest');
    expect(snapshot.status).toBe('connecting');
    expect(snapshot.roomCode).toBe('ABC234');
  });

  it('requires a name before creating a room', async () => {
    const user = userEvent.setup();
    renderStart();

    await user.click(screen.getByRole('button', { name: 'Online' }));
    await user.click(screen.getByRole('button', { name: 'Start Game' }));

    const messages = await screen.findAllByText('Please Enter your name');
    expect(messages.length).toBeGreaterThan(0);
    expect(screen.queryByText('lobby screen')).not.toBeInTheDocument();
  });
});

describe('Start screen quick play', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    toast.dismiss();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('hides Quick Play when no relay URL is configured', () => {
    renderStart();
    expect(screen.queryByRole('button', { name: 'Quick Play' })).not.toBeInTheDocument();
  });

  it('routes to the queue with the player name when relay is configured', async () => {
    vi.stubEnv('VITE_WS_URL', 'ws://127.0.0.1:8787');
    const user = userEvent.setup();
    renderStart();

    await user.click(screen.getByRole('button', { name: 'Quick Play' }));
    expect(screen.queryByRole('button', { name: 'Play as X' })).not.toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Enter your name'), 'Alice');
    await user.click(screen.getByRole('button', { name: 'Start Game' }));
    await screen.findByText('queue screen');

    const state = JSON.parse(screen.getByTestId('queue-state').textContent ?? 'null');
    expect(state).toEqual({ name: 'Alice', game: 'tictactoe' });
  });

  it('requires a name before quick play', async () => {
    vi.stubEnv('VITE_WS_URL', 'ws://127.0.0.1:8787');
    const user = userEvent.setup();
    renderStart();

    await user.click(screen.getByRole('button', { name: 'Quick Play' }));
    await user.click(screen.getByRole('button', { name: 'Start Game' }));

    const messages = await screen.findAllByText('Please Enter your name');
    expect(messages.length).toBeGreaterThan(0);
    expect(screen.queryByText('queue screen')).not.toBeInTheDocument();
  });
});

describe('Start screen for connect-four', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    toast.dismiss();
  });

  it('shows the connect-four heading without mark selection', () => {
    renderStartForGame('connect-four');
    expect(screen.getByText('CONNECT')).toBeInTheDocument();
    expect(screen.getByText('FOUR')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Play as X' })).not.toBeInTheDocument();
  });

  it('shows online and quick play modes alongside local play', () => {
    renderStartForGame('connect-four');
    expect(screen.getByRole('button', { name: 'Online' })).toBeInTheDocument();
    // Quick Play only appears when a relay URL is configured.
    expect(screen.queryByRole('button', { name: 'Quick Play' })).not.toBeInTheDocument();
  });

  it('creates a connect-four host room tagged with the game', async () => {
    const user = userEvent.setup();
    renderStartForGame('connect-four');
    await user.type(screen.getByPlaceholderText('Enter your name'), 'Zoe');
    await user.click(screen.getByRole('button', { name: 'Online' }));
    await user.click(screen.getByRole('button', { name: 'Create Room' }));
    await user.click(screen.getByRole('button', { name: 'Start Game' }));
    await screen.findByText('lobby screen');
    const snapshot = lobbySnapshot();
    expect(snapshot.game).toBe('connect-four');
    expect(snapshot.role).toBe('host');
  });

  it('offers easy, medium, and hard AI only', async () => {
    const user = userEvent.setup();
    renderStartForGame('connect-four');
    await user.click(screen.getByRole('button', { name: 'vs AI' }));
    const group = screen.getByRole('group', { name: 'AI difficulty' });
    expect(within(group).getByRole('button', { name: 'EASY' })).toBeInTheDocument();
    expect(within(group).getByRole('button', { name: 'MEDIUM' })).toBeInTheDocument();
    expect(within(group).getByRole('button', { name: 'HARD' })).toBeInTheDocument();
    expect(within(group).queryByRole('button', { name: 'IMPOSSIBLE' })).not.toBeInTheDocument();
  });

  it('blocks start without a name', async () => {
    const user = userEvent.setup();
    renderStartForGame('connect-four');
    await user.click(screen.getByRole('button', { name: 'Start Game' }));
    expect(screen.queryByText('connect four screen')).not.toBeInTheDocument();
    const messages = await screen.findAllByText('Please Enter your name');
    expect(messages.length).toBeGreaterThan(0);
  });

  it('navigates to the connect-four route without requiring a mark', async () => {
    const user = userEvent.setup();
    renderStartForGame('connect-four');
    await user.type(screen.getByPlaceholderText('Enter your name'), 'Zoe');
    await user.click(screen.getByRole('button', { name: 'Start Game' }));
    await screen.findByText('connect four screen');
    const state = JSON.parse(screen.getByTestId('c4-state').textContent ?? 'null');
    expect(state).toMatchObject({ name: 'Zoe', mode: 'pvp', difficulty: 'medium' });
  });

  it('passes pve mode and chosen difficulty to the connect-four route', async () => {
    const user = userEvent.setup();
    renderStartForGame('connect-four');
    await user.click(screen.getByRole('button', { name: 'vs AI' }));
    await user.click(screen.getByRole('button', { name: 'HARD' }));
    await user.type(screen.getByPlaceholderText('Enter your name'), 'Zed');
    await user.click(screen.getByRole('button', { name: 'Start Game' }));
    await screen.findByText('connect four screen');
    const state = JSON.parse(screen.getByTestId('c4-state').textContent ?? 'null');
    expect(state).toMatchObject({ name: 'Zed', mode: 'pve', difficulty: 'hard' });
  });
});