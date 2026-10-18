import '@testing-library/jest-dom';
import { vi } from 'vitest';

const localStorageMock = {
  getItem: vi.fn<(key: string) => string | null>().mockReturnValue(null),
  setItem: vi.fn<(key: string, value: string) => void>(),
  removeItem: vi.fn<(key: string) => void>(),
  clear: vi.fn(),
};

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
  });

  Object.defineProperty(window, 'matchMedia', {
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
    writable: true,
  });
}

function createAudioContextMock() {
  return {
    state: 'running',
    currentTime: 0,
    destination: {},
    resume: vi.fn(),
    createOscillator: vi.fn(() => ({
      type: 'sine' as OscillatorType,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      frequency: { value: 440 },
    })),
    createGain: vi.fn(() => ({
      connect: vi.fn(),
      gain: {
        value: 1,
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
    })),
  };
}

type AudioContextMock = ReturnType<typeof createAudioContextMock>;

type AudioContextMockCtor = ReturnType<typeof vi.fn> & {
  new (): AudioContextMock;
};

const audioCtor = vi.fn(
  (): AudioContextMock => createAudioContextMock(),
) as unknown as AudioContextMockCtor;

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'AudioContext', {
    value: audioCtor,
    writable: true,
  });

  Object.defineProperty(window, 'webkitAudioContext', {
    value: audioCtor,
    writable: true,
  });
}

if (typeof (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel === 'undefined') {
  class BroadcastChannelPolyfill {
    static registry = new Map<string, Set<BroadcastChannelPolyfill>>();
    onmessage: ((event: { data: unknown }) => void) | null = null;

    constructor(public readonly name: string) {
      const peers = BroadcastChannelPolyfill.registry.get(name) ?? new Set();
      peers.add(this);
      BroadcastChannelPolyfill.registry.set(name, peers);
    }

    postMessage(data: unknown): void {
      const peers = BroadcastChannelPolyfill.registry.get(this.name);
      if (!peers) return;
      for (const peer of peers) {
        if (peer !== this) peer.onmessage?.({ data });
      }
    }

    close(): void {
      BroadcastChannelPolyfill.registry.get(this.name)?.delete(this);
    }
  }

  (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = BroadcastChannelPolyfill;
}

export { localStorageMock, audioCtor };