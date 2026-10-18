import type { RoomMessage } from './protocol';
import type { RoomTransport } from './transport';

export function createWebSocketTransport(url: string): RoomTransport {
  const socket = new WebSocket(url);
  const handlers = new Set<(message: RoomMessage) => void>();
  const outbox: string[] = [];

  socket.onopen = () => {
    while (outbox.length > 0 && socket.readyState === WebSocket.OPEN) {
      socket.send(outbox.shift() as string);
    }
  };

  socket.onmessage = (event: MessageEvent) => {
    if (typeof event.data !== 'string') return;
    let message: RoomMessage;
    try {
      message = JSON.parse(event.data) as RoomMessage;
    } catch {
      return;
    }
    for (const handler of handlers) handler(message);
  };

  return {
    post(message: RoomMessage) {
      const payload = JSON.stringify(message);
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(payload);
      } else if (socket.readyState === WebSocket.CONNECTING) {
        outbox.push(payload);
      }
    },
    subscribe(handler: (message: RoomMessage) => void) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    close() {
      handlers.clear();
      outbox.length = 0;
      socket.close();
    },
  };
}
