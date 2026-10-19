import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Queue } from '../Queue';
import { OnlineSessionProvider, useOnlineSession } from '../../../net/OnlineSessionContext';

class FakeSocket {
  static instances: FakeSocket[] = [];
  sent: string[] = [];
  closed = false;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(readonly url: string) {
    FakeSocket.instances.push(this);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.onclose?.();
  }

  open(): void {
    this.onopen?.();
  }

  receive(message: object): void {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
}

function StartProbe() {
  return <div>start screen</div>;
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
          },
        )}
      </span>
    </div>
  );
}

function renderQueue(name: string | null = 'ALICE') {
  return render(
    <OnlineSessionProvider>
      <MemoryRouter initialEntries={name === null ? ['/queue'] : [{ pathname: '/queue', state: { name } }]}>
        <Routes>
          <Route path="/" element={<StartProbe />} />
          <Route path="/queue" element={<Queue />} />
          <Route path="/lobby" element={<LobbyProbe />} />
        </Routes>
      </MemoryRouter>
    </OnlineSessionProvider>,
  );
}

function queuedPlayerId(socket: FakeSocket): string {
  const sent = JSON.parse(socket.sent[0]) as { playerId: string };
  return sent.playerId;
}

describe('Queue page', () => {
  beforeEach(() => {
    FakeSocket.instances = [];
    vi.stubGlobal('WebSocket', FakeSocket);
    vi.stubEnv('VITE_WS_URL', 'ws://relay.local:8787');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('queues on mount and announces itself to the matchmaker', async () => {
    renderQueue();
    expect(screen.getByText('Finding an opponent…')).toBeInTheDocument();

    const socket = FakeSocket.instances[0];
    expect(socket.url).toBe('ws://relay.local:8787/matchmake');
    socket.open();

    await waitFor(() => expect(socket.sent).toHaveLength(1));
    expect(JSON.parse(socket.sent[0])).toMatchObject({ type: 'queue' });
  });

  it('opens the matched room and lands in the lobby', async () => {
    renderQueue();
    const socket = FakeSocket.instances[0];
    socket.open();
    await waitFor(() => expect(socket.sent).toHaveLength(1));

    socket.receive({
      type: 'matched',
      playerId: queuedPlayerId(socket),
      roomCode: 'ABC234',
      role: 'guest',
    });

    await screen.findByText('lobby screen');
    const snapshot = JSON.parse(screen.getByTestId('lobby-snapshot').textContent ?? 'null');
    expect(snapshot).toMatchObject({
      role: 'guest',
      roomCode: 'ABC234',
      status: 'connecting',
      myName: 'ALICE',
    });
    expect(socket.closed).toBe(true);
  });

  it('cancels back to the menu and closes the socket', async () => {
    const user = userEvent.setup();
    renderQueue();
    const socket = FakeSocket.instances[0];
    socket.open();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await screen.findByText('start screen');
    expect(socket.closed).toBe(true);
  });

  it('shows the timeout state and can re-queue', async () => {
    vi.useFakeTimers();
    renderQueue();

    const first = FakeSocket.instances[0];
    first.open();
    act(() => {
      vi.advanceTimersByTime(30_100);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(FakeSocket.instances).toHaveLength(2);
    expect(FakeSocket.instances[1].sent).toEqual([]);
  });

  it('redirects to the menu when opened without a name', async () => {
    renderQueue(null);
    await screen.findByText('start screen');
  });
});
