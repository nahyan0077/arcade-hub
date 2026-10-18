export type SoundEffect = 'place-x' | 'place-o' | 'win' | 'draw' | 'invalid';

const MUTE_STORAGE_KEY = 'tic-tac-toe.muted.v1';

function loadMuted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(MUTE_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

let audioContext: AudioContext | null = null;
let muted = loadMuted();

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
  gain.gain.setValueAtTime(peakGain, t);
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
};

export function playEffect(effect: SoundEffect): void {
  if (muted) return;
  const context = getContext();
  if (!context) return;
  EFFECTS[effect](context);
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