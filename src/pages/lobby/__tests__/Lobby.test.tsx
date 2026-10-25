import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Lobby } from '../Lobby';
import { OnlineSessionProvider } from '../../../net/OnlineSessionContext';
import { RoomSession } from '../../../net/RoomSession';
import { createFakeTransportBus } from '../../../net/transport';
import type { RoomTransport } from '../../../net/transport';

const CODE = 'ABC234';

const TIMING = {
  heartbeatMs: 50,
  timeoutMs: 200,
  joinTimeoutMs: 100,
};

function makeSession(
  transport: RoomTransport,
  role: 'host' | 'guest',
  name: string,
  id: string,
) {
  return new RoomSession({
    role,
    roomCode: CODE,
    myId: id,
    myName: name,
    transport,
    ...TIMING,
  });
}

function renderLobby(session: RoomSession | null) {
  return render(
    <OnlineSessionProvider initialSession={session}>
      <MemoryRouter initialEntries={['/lobby']}>
        <Routes>
          <Route path="/lobby" element={<Lobby />} />
          <Route path="/" element={<div><Toaster />start screen</div>} />
          <Route path="/room" element={<div>room screen</div>} />
        </Routes>
      </MemoryRouter>
    </OnlineSessionProvider>,
  );
}

describe('Lobby', () => {
  const sessions: RoomSession[] = [];

  function tracked(transport: RoomTransport, role: 'host' | 'guest', name: string, id: string) {
    const session = makeSession(transport, role, name, id);
    sessions.push(session);
    return session;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    for (const session of sessions.splice(0)) session.destroy();
    vi.unstubAllEnvs();
  });

  it('redirects home when there is no session', () => {
    renderLobby(null);
    expect(screen.getByText('start screen')).toBeInTheDocument();
  });

  it('shows the room code and waiting status for the host', () => {
    const bus = createFakeTransportBus();
    const host = tracked(bus.createEndpoint(), 'host', 'ALICE', 'host-1');
    renderLobby(host);

    expect(screen.getByRole('button', { name: 'Copy room code' })).toHaveTextContent(CODE);
    expect(screen.getByTestId('lobby-status')).toHaveTextContent('Waiting for opponent to join');
  });

  it('shows joining status for the guest', () => {
    const bus = createFakeTransportBus();
    const guest = tracked(bus.createEndpoint(), 'guest', 'BOB', 'guest-1');
    renderLobby(guest);

    expect(screen.getByTestId('lobby-status')).toHaveTextContent('Joining room');
    expect(screen.queryByRole('button', { name: 'Copy room code' })).not.toBeInTheDocument();
  });

  it('navigates to the room when an opponent connects', async () => {
    const bus = createFakeTransportBus();
    const host = tracked(bus.createEndpoint(), 'host', 'ALICE', 'host-1');
    renderLobby(host);

    const guest = tracked(bus.createEndpoint(), 'guest', 'BOB', 'guest-1');
    act(() => guest.start());

    expect(await screen.findByText('room screen')).toBeInTheDocument();
  });

  it('guest navigates to the room once welcomed', async () => {
    const bus = createFakeTransportBus();
    const host = tracked(bus.createEndpoint(), 'host', 'ALICE', 'host-1');
    act(() => host.start());

    const guest = tracked(bus.createEndpoint(), 'guest', 'BOB', 'guest-1');
    renderLobby(guest);

    expect(await screen.findByText('room screen')).toBeInTheDocument();
  });

  it('returns home when no host answers the join', async () => {
    const bus = createFakeTransportBus();
    const guest = tracked(bus.createEndpoint(), 'guest', 'BOB', 'guest-1');
    renderLobby(guest);

    await screen.findByText(/Joining room/);

    expect(await screen.findByText(/Couldn't reach the host/, {}, { timeout: 1500 })).toBeInTheDocument();
    expect(await screen.findByText('start screen', {}, { timeout: 1500 })).toBeInTheDocument();
  });

  it('keeps the server-mode rejection message when VITE_WS_URL is set', async () => {
    vi.stubEnv('VITE_WS_URL', 'ws://127.0.0.1:8787');
    const bus = createFakeTransportBus();
    const guest = tracked(bus.createEndpoint(), 'guest', 'BOB', 'guest-1');
    renderLobby(guest);

    expect(await screen.findByText('Room not found or full', {}, { timeout: 1500 })).toBeInTheDocument();
  });

  it('leaves the room and returns home', async () => {
    const user = userEvent.setup();
    const bus = createFakeTransportBus();
    const host = tracked(bus.createEndpoint(), 'host', 'ALICE', 'host-1');
    renderLobby(host);

    await user.click(screen.getByRole('button', { name: 'Leave' }));

    expect(screen.getByText('start screen')).toBeInTheDocument();
  });

  it('renders CONNECT FOUR header when room game is connect-four', () => {
    const bus = createFakeTransportBus();
    const host = new RoomSession({
      role: 'host',
      roomCode: CODE,
      myId: 'host-1',
      myName: 'ALICE',
      transport: bus.createEndpoint(),
      game: 'connect-four',
      ...TIMING,
    });
    sessions.push(host);
    renderLobby(host);

    expect(screen.getByText('CONNECT')).toBeInTheDocument();
    expect(screen.getByText('FOUR')).toBeInTheDocument();
  });
});