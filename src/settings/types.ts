import type { Player } from '../engine';

export type ArcadeTheme = 'cyber' | 'synthwave' | 'oled' | 'light';
export type SoundTheme = 'modern' | 'retro' | 'synthwave';
export type AIDifficultySetting = 'easy' | 'medium' | 'hard' | 'impossible';
export type C4DifficultySetting = 'easy' | 'medium' | 'hard';
export type RushDifficultySetting = 'beginner' | 'easy' | 'medium' | 'hard' | 'expert';

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

  // Global Gameplay & Rules
  defaultDifficulty: AIDifficultySetting;
  turnTimerDuration: 15 | 20 | 30 | 60;
  arrowRaceTargetScore: 3 | 5 | 7 | 10;

  // Game-Specific: Tic-Tac-Toe
  tttDifficulty: AIDifficultySetting;
  tttShowHints: boolean;

  // Game-Specific: Connect Four
  c4Difficulty: C4DifficultySetting;
  c4HighlightWinningLine: boolean;

  // Game-Specific: Direction Rush
  rushDifficulty: RushDifficultySetting;
  rushDuration: 30 | 45 | 60 | 90;

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

  // Game-Specific Defaults
  tttDifficulty: 'medium',
  tttShowHints: false,

  c4Difficulty: 'medium',
  c4HighlightWinningLine: true,

  rushDifficulty: 'beginner',
  rushDuration: 60,

  hapticsEnabled: true,
};
