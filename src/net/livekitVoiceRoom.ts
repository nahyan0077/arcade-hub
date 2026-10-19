import { Room, RoomEvent } from 'livekit-client';
import type { VoiceRoom } from './voiceSession';

export function createLiveKitVoiceRoom(): VoiceRoom {
  const room = new Room();
  return {
    connect: (url, token) => room.connect(url, token),
    disconnect: () => room.disconnect(true),
    setMicrophoneEnabled: async (enabled) => {
      await room.localParticipant.setMicrophoneEnabled(enabled);
    },
    onConnected: (listener) => {
      room.on(RoomEvent.Connected, listener);
    },
    onDisconnected: (listener) => {
      room.on(RoomEvent.Disconnected, listener);
    },
    onRemoteParticipantsChanged: (listener) => {
      const emit = () => listener(room.remoteParticipants.size);
      room.on(RoomEvent.ParticipantConnected, emit);
      room.on(RoomEvent.ParticipantDisconnected, emit);
    },
  };
}
