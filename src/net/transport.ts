import type { RoomMessage } from './protocol';

export interface RoomTransport {
  post(message: RoomMessage): void;
  subscribe(handler: (message: RoomMessage) => void): () => void;
  close(): void;
}

export function createBroadcastTransport(channelName: string): RoomTransport {
  if (typeof BroadcastChannel === 'undefined') {
    throw new Error('BroadcastChannel is not available in this environment');
  }
  const channel = new BroadcastChannel(channelName);
  const handlers = new Set<(message: RoomMessage) => void>();

  channel.onmessage = (event: MessageEvent) => {
    for (const handler of handlers) handler(event.data as RoomMessage);
  };

  return {
    post(message) {
      channel.postMessage(message);
    },
    subscribe(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    close() {
      handlers.clear();
      channel.close();
    },
  };
}

type FakeEndpoint = { handlers: Set<(message: RoomMessage) => void>; closed: boolean };

export interface FakeTransportBus {
  createEndpoint(): RoomTransport;
}

export function createFakeTransportBus(): FakeTransportBus {
  const endpoints: FakeEndpoint[] = [];

  const deliver = (from: FakeEndpoint, message: RoomMessage) => {
    for (const target of endpoints) {
      if (target === from || target.closed) continue;
      for (const handler of [...target.handlers]) handler(message);
    }
  };

  return {
    createEndpoint() {
      const handlers = new Set<(message: RoomMessage) => void>();
      const endpoint: FakeEndpoint = { handlers, closed: false };
      endpoints.push(endpoint);
      return {
        post(message: RoomMessage) {
          if (endpoint.closed) return;
          deliver(endpoint, message);
        },
        subscribe(handler: (message: RoomMessage) => void) {
          handlers.add(handler);
          return () => handlers.delete(handler);
        },
        close() {
          endpoint.closed = true;
          handlers.clear();
        },
      };
    },
  };
}

export function createFakeTransportPair(): [RoomTransport, RoomTransport] {
  const bus = createFakeTransportBus();
  return [bus.createEndpoint(), bus.createEndpoint()];
}