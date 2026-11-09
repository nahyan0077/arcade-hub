import type { Player } from '../engine';

export type ArcadeTheme = 'cyber' | 'synthwave' | 'oled' | 'light';
export type SoundTheme = 'modern' | 'retro' | 'synthwave';
export type AIDifficultySetting = 'easy' | 'medium' | 'hard' | 'impossible';

export interface GlobalSettings {
  // Audio
  masterVolume: number; // 0..1
  sfxVolume: number; // 0..1
  muted: boolean;
  soundTheme: SoundTheme;

  // Display & Graphics
  theme: ArcadeTheme;
  matrixRain: boolean;
  matrixOpacity: number; // 0.05..0.5
  reducedMotion: boolean;
  confettiEnabled: boolean;

  // Profile
  playerName: string;
  avatar: string;
  preferredMark: Player;

  // Gameplay & Rules
  defaultDifficulty: AIDifficultySetting;
  turnTimerDuration: 15 | 20 | 30 | 60;
  arrowRaceTargetScore: 3 | 5 | 7 | 10;

  // Controls & Accessibility
  hapticsEnabled: boolean;
}

export const DEFAULT_SETTINGS: GlobalSettings = {
  masterVolume: 1.0,
  sfxVolume: 1.0,
  muted: false,
  soundTheme: 'modern',

  theme: 'cyber',
  matrixRain: true,
  matrixOpacity: 0.18,
  reducedMotion: false,
  confettiEnabled: true,

  playerName: 'Player 1',
  avatar: '🎮',
  preferredMark: 'X',

  defaultDifficulty: 'medium',
  turnTimerDuration: 20,
  arrowRaceTargetScore: 5,

  hapticsEnabled: true,
};
