import '@testing-library/jest-dom';
import { vi } from 'vitest';

const localStorageMock = {
  getItem: vi.fn<(key: string) => string | null>().mockReturnValue(null),
  setItem: vi.fn<(key: string, value: string) => void>(),
  removeItem: vi.fn<(key: string) => void>(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

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

const audioCtor = vi.fn(() => createAudioContextMock()) as unknown as {
  new (): AudioContextMock;
};

Object.defineProperty(window, 'AudioContext', {
  value: audioCtor,
  writable: true,
});

Object.defineProperty(window, 'webkitAudioContext', {
  value: audioCtor,
  writable: true,
});

export { localStorageMock, audioCtor };