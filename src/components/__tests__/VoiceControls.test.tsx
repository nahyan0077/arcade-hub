import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VoiceControls } from '../VoiceControls';
import { VoiceSession, type VoiceRoom, type VoiceSessionOptions } from '../../net/voiceSession';

class FakeRoom implements VoiceRoom {
  micCalls: boolean[] = [];
  private connectedListener: (() => void) | null = null;
  private disconnectedListener: (() => void) | null = null;
  private participantsListener: ((count: number) => void) | null = null;

  async connect(): Promise<void> {
    this.connectedListener?.();
  }

  disconnect(): void {
    this.disconnectedListener?.();
  }

  async setMicrophoneEnabled(enabled: boolean): Promise<void> {
    this.micCalls.push(enabled);
  }

  onConnected(listener: () => void): void {
    this.connectedListener = listener;
  }

  onDisconnected(listener: () => void): void {
    this.disconnectedListener = listener;
  }

  onRemoteParticipantsChanged(listener: (count: number) => void): void {
    this.participantsListener = listener;
  }

  emitParticipants(count: number): void {
    this.participantsListener?.(count);
  }
}

function tokenResponse(): Response {
  return new Response(JSON.stringify({ url: 'ws://livekit.local:7880', token: 'tok' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function makeSessionFactory(options: { failFirst?: boolean; room?: FakeRoom }) {
  const room = options.room ?? new FakeRoom();
  let attempts = 0;
  const factory = (sessionOptions: VoiceSessionOptions) =>
    new VoiceSession({
      ...sessionOptions,
      fetchFn: (async () => {
        attempts += 1;
        return options.failFirst === true && attempts === 1
          ? new Response('nope', { status: 503 })
          : tokenResponse();
      }) as unknown as typeof fetch,
      roomFactory: async () => room,
    });
  return { factory, room };
}

describe('VoiceControls', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('offers join, surfaces token failures as a toast, and allows retry', async () => {
    const user = userEvent.setup();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { factory } = makeSessionFactory({ failFirst: true });
    render(<VoiceControls baseUrl="ws://relay.local" roomCode="ABC234" name="ALICE" sessionFactory={factory} />);

    await user.click(screen.getByRole('button', { name: 'Join voice' }));
    expect(await screen.findByText('Voice unavailable')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Join voice' }));
    expect(await screen.findByTestId('voice-status')).toBeInTheDocument();
    errorSpy.mockRestore();
  });

  it('goes live, toggles the mic, tracks participants, and leaves', async () => {
    const user = userEvent.setup();
    const { factory, room } = makeSessionFactory({});
    render(<VoiceControls baseUrl="ws://relay.local" roomCode="ABC234" name="ALICE" sessionFactory={factory} />);

    await user.click(screen.getByRole('button', { name: 'Join voice' }));

    const status = await screen.findByTestId('voice-status');
    expect(status).toHaveTextContent('Voice live · 1');
    expect(screen.getByRole('button', { name: 'Unmute' })).toHaveAttribute('aria-pressed', 'false');

    room.emitParticipants(1);
    await waitFor(() => expect(status).toHaveTextContent('Voice live · 2'));

    await user.click(screen.getByRole('button', { name: 'Unmute' }));
    expect(room.micCalls).toEqual([true]);
    expect(screen.getByRole('button', { name: 'Mute' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Leave voice' }));
    expect(await screen.findByRole('button', { name: 'Join voice' })).toBeInTheDocument();
  });
});
