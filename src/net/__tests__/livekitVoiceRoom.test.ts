import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createLiveKitVoiceRoom } from '../livekitVoiceRoom';

const harness = vi.hoisted(() => ({
  rooms: [] as Array<{
    on: ReturnType<typeof vi.fn>;
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    localParticipant: { setMicrophoneEnabled: ReturnType<typeof vi.fn> };
    remoteParticipants: Map<unknown, unknown>;
  }>,
}));

vi.mock('livekit-client', () => {
  class Room {
    on = vi.fn();
    connect = vi.fn();
    disconnect = vi.fn();
    localParticipant = { setMicrophoneEnabled: vi.fn() };
    remoteParticipants = new Map();
    constructor() {
      harness.rooms.push(this);
    }
  }
  return {
    Room,
    RoomEvent: {
      Connected: 'connected',
      Disconnected: 'disconnected',
      ParticipantConnected: 'participantConnected',
      ParticipantDisconnected: 'participantDisconnected',
      TrackSubscribed: 'trackSubscribed',
      TrackUnsubscribed: 'trackUnsubscribed',
    },
    Track: { Kind: { Audio: 'audio', Video: 'video' } },
  };
});

function handlerFor(event: string): (...args: unknown[]) => void {
  const room = harness.rooms[harness.rooms.length - 1];
  const call = room.on.mock.calls.find(([name]) => name === event);
  if (call === undefined) throw new Error(`no handler registered for ${event}`);
  return call[1] as (...args: unknown[]) => void;
}

describe('livekitVoiceRoom remote audio', () => {
  beforeEach(() => {
    harness.rooms.length = 0;
  });

  it('attaches subscribed audio tracks and detaches them on unsubscribe', () => {
    createLiveKitVoiceRoom();
    const audio = { kind: 'audio', attach: vi.fn(), detach: vi.fn() };
    const video = { kind: 'video', attach: vi.fn(), detach: vi.fn() };

    handlerFor('trackSubscribed')(audio);
    handlerFor('trackSubscribed')(video);
    expect(audio.attach).toHaveBeenCalledTimes(1);
    expect(video.attach).not.toHaveBeenCalled();

    handlerFor('trackUnsubscribed')(audio);
    expect(audio.detach).toHaveBeenCalledTimes(1);
  });
});
