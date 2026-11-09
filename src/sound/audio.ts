export type SoundEffect =
  | 'place-x'
  | 'place-o'
  | 'win'
  | 'lose'
  | 'draw'
  | 'invalid'
  | 'timeout'
  | 'start'
  | 'click'
  | 'drop'
  | 'chat'
  | 'match'
  | 'streak';

const MUTE_STORAGE_KEY = 'tic-tac-toe.muted.v1';
const MASTER_VOLUME_KEY = 'arcade.master_volume.v1';
const SFX_VOLUME_KEY = 'arcade.sfx_volume.v1';

function loadMuted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(MUTE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function loadVolume(key: string, defaultValue: number): number {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const val = window.localStorage.getItem(key);
    if (val === null) return defaultValue;
    const num = parseFloat(val);
    return Number.isFinite(num) ? Math.max(0, Math.min(1, num)) : defaultValue;
  } catch {
    return defaultValue;
  }
}

let audioContext: AudioContext | null = null;
let muted = loadMuted();
let masterVolume = loadVolume(MASTER_VOLUME_KEY, 1.0);
let sfxVolume = loadVolume(SFX_VOLUME_KEY, 1.0);

type AudioContextCtor = new () => AudioContext;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  const Ctor = w.AudioContext ?? w.webkitAudioContext;
  if (!Ctor) return null;
  if (!audioContext) {
    audioContext = new Ctor();
  }
  const context = audioContext;
  if (context.state === 'suspended') {
    void context.resume();
  }
  return context;
}

interface ToneOptions {
  frequency: number;
  startAt: number;
  duration: number;
  type?: OscillatorType;
  peakGain?: number;
}

function scheduleTone(context: AudioContext, options: ToneOptions): void {
  const { frequency, startAt, duration, type = 'sine', peakGain = 0.15 } = options;
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = type;
  oscillator.frequency.value = frequency;

  const t = context.currentTime + startAt;
  const effectiveGain = Math.max(0.0001, peakGain * masterVolume * sfxVolume);
  gain.gain.setValueAtTime(effectiveGain, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(t);
  oscillator.stop(t + duration);
}

const EFFECTS: Record<SoundEffect, (ctx: AudioContext) => void> = {
  'place-x': (ctx) =>
    scheduleTone(ctx, { frequency: 523.25, startAt: 0, duration: 0.12 }),
  'place-o': (ctx) =>
    scheduleTone(ctx, { frequency: 659.25, startAt: 0, duration: 0.12 }),
  win: (ctx) => {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((frequency, i) => {
      scheduleTone(ctx, {
        frequency,
        startAt: i * 0.12,
        duration: 0.22,
        peakGain: 0.12,
      });
    });
  },
  lose: (ctx) => {
    scheduleTone(ctx, { frequency: 392.0, startAt: 0, duration: 0.22 });
    scheduleTone(ctx, { frequency: 261.63, startAt: 0.2, duration: 0.42, peakGain: 0.1 });
  },
  draw: (ctx) => {
    scheduleTone(ctx, { frequency: 349.23, startAt: 0, duration: 0.18 });
    scheduleTone(ctx, { frequency: 293.66, startAt: 0.18, duration: 0.28 });
  },
  invalid: (ctx) =>
    scheduleTone(ctx, {
      frequency: 110,
      startAt: 0,
      duration: 0.08,
      type: 'square',
      peakGain: 0.08,
    }),
  timeout: (ctx) => {
    scheduleTone(ctx, { frequency: 880, startAt: 0, duration: 0.15, type: 'square', peakGain: 0.12 });
    scheduleTone(ctx, { frequency: 660, startAt: 0.15, duration: 0.15, type: 'square', peakGain: 0.12 });
    scheduleTone(ctx, { frequency: 440, startAt: 0.3, duration: 0.3, type: 'square', peakGain: 0.15 });
  },
  start: (ctx) => {
    scheduleTone(ctx, { frequency: 440, startAt: 0, duration: 0.1, type: 'sine', peakGain: 0.15 });
    scheduleTone(ctx, { frequency: 659.25, startAt: 0.08, duration: 0.12, type: 'sine', peakGain: 0.15 });
    scheduleTone(ctx, { frequency: 880, startAt: 0.16, duration: 0.25, type: 'triangle', peakGain: 0.18 });
  },
  click: (ctx) => {
    scheduleTone(ctx, { frequency: 1200, startAt: 0, duration: 0.03, type: 'sine', peakGain: 0.06 });
  },
  drop: (ctx) => {
    scheduleTone(ctx, { frequency: 440, startAt: 0, duration: 0.08, type: 'sine', peakGain: 0.12 });
    scheduleTone(ctx, { frequency: 220, startAt: 0.05, duration: 0.12, type: 'triangle', peakGain: 0.15 });
  },
  chat: (ctx) => {
    scheduleTone(ctx, { frequency: 659.25, startAt: 0, duration: 0.06, type: 'sine', peakGain: 0.1 });
    scheduleTone(ctx, { frequency: 880, startAt: 0.05, duration: 0.1, type: 'sine', peakGain: 0.1 });
  },
  match: (ctx) => {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      scheduleTone(ctx, { frequency: freq, startAt: i * 0.07, duration: 0.15, type: 'triangle', peakGain: 0.14 });
    });
  },
  streak: (ctx) => {
    scheduleTone(ctx, { frequency: 880, startAt: 0, duration: 0.1, type: 'sine', peakGain: 0.12 });
    scheduleTone(ctx, { frequency: 1174.66, startAt: 0.08, duration: 0.18, type: 'sine', peakGain: 0.16 });
  },
};

export function playEffect(effect: SoundEffect): void {
  if (muted) return;
  const context = getContext();
  if (!context) return;
  EFFECTS[effect]?.(context);
}

export function setMuted(value: boolean): void {
  muted = value;
  try {
    window.localStorage.setItem(MUTE_STORAGE_KEY, String(value));
  } catch {
    // storage unavailable; mute still applies for this session
  }
}

export function isMuted(): boolean {
  return muted;
}

export function setMasterVolume(value: number): void {
  masterVolume = Math.max(0, Math.min(1, value));
  try {
    window.localStorage.setItem(MASTER_VOLUME_KEY, String(masterVolume));
  } catch {
    // storage unavailable
  }
}

export function getMasterVolume(): number {
  return masterVolume;
}

export function setSfxVolume(value: number): void {
  sfxVolume = Math.max(0, Math.min(1, value));
  try {
    window.localStorage.setItem(SFX_VOLUME_KEY, String(sfxVolume));
  } catch {
    // storage unavailable
  }
}

export function getSfxVolume(): number {
  return sfxVolume;
}

export function triggerHaptic(type: 'light' | 'medium' | 'heavy' | 'success' | 'error' = 'light'): void {
  if (typeof window === 'undefined' || !('vibrate' in navigator)) return;
  try {
    switch (type) {
      case 'light':
        navigator.vibrate(10);
        break;
      case 'medium':
        navigator.vibrate(25);
        break;
      case 'heavy':
        navigator.vibrate(45);
        break;
      case 'success':
        navigator.vibrate([15, 30, 25]);
        break;
      case 'error':
        navigator.vibrate([40, 40, 40]);
        break;
    }
  } catch {
    /* haptics unavailable or blocked */
  }
}
