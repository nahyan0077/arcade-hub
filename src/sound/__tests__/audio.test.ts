import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setMuted, isMuted } from '../audio';
import { audioCtor } from '../../test/setup';

async function loadFreshAudio() {
  vi.resetModules();
  const module = await import('../audio');
  return module;
}

describe('sound effects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMuted(false);
  });

  it('creates audio context and schedules oscillator on play', async () => {
    const { playEffect: play } = await loadFreshAudio();
    play('place-x');
    expect(audioCtor).toHaveBeenCalledTimes(1);
  });

  it('plays win as an arpeggio (4 tones)', async () => {
    const { playEffect: play } = await loadFreshAudio();
    play('win');
    const ctorSpy = audioCtor as unknown as ReturnType<typeof vi.fn>;
    const instance = ctorSpy.mock.results[0].value as {
      createOscillator: ReturnType<typeof vi.fn>;
    };
    expect(instance.createOscillator).toHaveBeenCalledTimes(4);
  });

  it('does nothing while muted', async () => {
    const mod = await loadFreshAudio();
    mod.setMuted(true);
    mod.playEffect('win');
    expect(audioCtor).not.toHaveBeenCalled();
  });

  it('toggles mute state', () => {
    setMuted(true);
    expect(isMuted()).toBe(true);
    setMuted(false);
    expect(isMuted()).toBe(false);
  });

  it('reuses the same audio context across plays', async () => {
    const { playEffect: play } = await loadFreshAudio();
    play('place-x');
    play('place-o');
    play('invalid');
    expect(audioCtor).toHaveBeenCalledTimes(1);
  });

  it('resumes suspended context', async () => {
    vi.clearAllMocks();
    audioCtor.mockImplementation(() => {
      const ctx = {
        state: 'suspended',
        currentTime: 0,
        destination: {},
        resume: vi.fn(),
        createOscillator: vi.fn(() => ({
          type: 'sine',
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
          frequency: { value: 440 },
        })),
        createGain: vi.fn(() => ({
          connect: vi.fn(),
          gain: { value: 1, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        })),
      };
      return ctx;
    }) as unknown as typeof audioCtor;

    const { playEffect: play } = await loadFreshAudio();
    play('place-x');
    const instance = audioCtor.mock.results[0].value as unknown as { resume: ReturnType<typeof vi.fn> };
    expect(instance.resume).toHaveBeenCalled();
  });
});