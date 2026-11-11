import type { RoomMessage } from './protocol';
import type { RoomTransport } from './transport';

export function createWebSocketTransport(url: string): RoomTransport {
  let socket: WebSocket | null = null;
  const handlers = new Set<(message: RoomMessage) => void>();
  const outbox: string[] = [];
  let isClosed = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function connect() {
    if (isClosed) return;
    try {
      socket = new WebSocket(url);
    } catch {
      scheduleReconnect();
      return;
    }

    socket.onopen = () => {
      while (outbox.length > 0 && socket && socket.readyState === WebSocket.OPEN) {
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

    socket.onclose = () => {
      if (!isClosed) {
        scheduleReconnect();
      }
    };

    socket.onerror = () => {
      // Browser standard triggers onclose right after onerror
    };
  }

  function scheduleReconnect() {
    if (isClosed || reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, 1000);
  }

  connect();

  return {
    post(message: RoomMessage) {
      const payload = JSON.stringify(message);
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(payload);
      } else if (!isClosed) {
        outbox.push(payload);
        if (socket && socket.readyState === WebSocket.CLOSED) {
          scheduleReconnect();
        }
      }
    },
    subscribe(handler: (message: RoomMessage) => void) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    close() {
      isClosed = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      handlers.clear();
      outbox.length = 0;
      socket?.close();
      socket = null;
    },
  };
}
