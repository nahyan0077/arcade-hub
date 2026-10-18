import '@testing-library/jest-dom';
import { vi } from 'vitest';

Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
  writable: true,
});

Object.defineProperty(window, 'AudioContext', {
  value: vi.fn().mockImplementation(() => ({
    createOscillator: () => ({
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      frequency: { value: 440 },
      type: 'sine',
    }),
    createGain: () => ({
      connect: vi.fn(),
      gain: { value: 1, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    }),
    destination: {},
    resume: vi.fn(),
  })),
  writable: true,
});

Object.defineProperty(window, 'webkitAudioContext', {
  value: window.AudioContext,
  writable: true,
});