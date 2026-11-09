import React, { useState, useEffect } from 'react';
import { useSettings } from '../settings/SettingsContext';
import { playEffect, triggerHaptic } from '../sound/audio';
import type { ArcadeTheme, AIDifficultySetting } from '../settings/types';

const AVATARS = ['🎮', '🤖', '👾', '⚡', '🚀', '👑', '🔥', '🐱', '⭐', '🎯'];

type TabKey = 'audio' | 'display' | 'profile' | 'gameplay';

export const SettingsModal: React.FC = () => {
  const { settings, updateSettings, resetSettings, isSettingsOpen, closeSettings } = useSettings();
  const [activeTab, setActiveTab] = useState<TabKey>('audio');

  // Close on Escape
  useEffect(() => {
    if (!isSettingsOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeSettings();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSettingsOpen, closeSettings]);

  if (!isSettingsOpen) return null;

  const handleTabChange = (tab: TabKey) => {
    playEffect('click');
    triggerHaptic('light');
    setActiveTab(tab);
  };

  const handleSoundTest = () => {
    playEffect('streak');
    triggerHaptic('success');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeSettings();
      }}
    >
      <div className="relative w-full max-w-xl max-h-[90vh] flex flex-col bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden text-zinc-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/60">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">⚙️</span>
            <h2 id="settings-modal-title" className="text-lg font-bold tracking-wide text-zinc-100">
              Arcade Settings
            </h2>
          </div>
          <button
            onClick={() => {
              playEffect('click');
              closeSettings();
            }}
            aria-label="Close settings"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div
          role="tablist"
          aria-label="Arcade settings tabs"
          className="flex border-b border-zinc-800 bg-zinc-900/80 px-4 pt-2 gap-1 overflow-x-auto"
        >
          {[
            { id: 'audio', label: '🔊 Audio', desc: 'Sound & Volume' },
            { id: 'display', label: '🎨 Display', desc: 'Themes & Effects' },
            { id: 'profile', label: '👤 Profile', desc: 'Identity' },
            { id: 'gameplay', label: '⏱️ Gameplay', desc: 'Rules & Timer' },
          ].map((tab) => (
            <button
              key={tab.id}
              role="tab"
              id={`tab-${tab.id}`}
              aria-selected={activeTab === tab.id}
              aria-controls={`tabpanel-${tab.id}`}
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => handleTabChange(tab.id as TabKey)}
              className={`px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-t-lg transition whitespace-nowrap border-b-2 ${
                activeTab === tab.id
                  ? 'border-cyan-400 text-cyan-300 bg-zinc-800/80 shadow-sm'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div
          role="tabpanel"
          id={`tabpanel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
          className="flex-1 overflow-y-auto p-6 space-y-6"
        >
          {/* AUDIO TAB */}
          {activeTab === 'audio' && (
            <div className="space-y-5 animate-fade-in">
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-800/50 border border-zinc-700/50">
                <div>
                  <div className="font-semibold text-zinc-200">Mute All Sounds</div>
                  <div className="text-xs text-zinc-400">Silence synthesized game sound effects</div>
                </div>
                <button
                  onClick={() => {
                    playEffect('click');
                    updateSettings({ muted: !settings.muted });
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.muted ? 'bg-rose-500' : 'bg-emerald-600'
                  }`}
                  aria-pressed={settings.muted}
                  aria-label="Mute All Sounds"
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.muted ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Master Volume */}
              <div className="space-y-2 p-3.5 rounded-xl bg-zinc-800/50 border border-zinc-700/50">
                <div className="flex justify-between items-center text-sm font-semibold text-zinc-200">
                  <span>Master Volume</span>
                  <span className="text-cyan-400 font-mono">
                    {Math.round(settings.masterVolume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  aria-label="Master Volume"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.masterVolume}
                  disabled={settings.muted}
                  onChange={(e) => updateSettings({ masterVolume: parseFloat(e.target.value) })}
                  className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-cyan-400 disabled:opacity-40"
                />
              </div>

              {/* SFX Volume */}
              <div className="space-y-2 p-3.5 rounded-xl bg-zinc-800/50 border border-zinc-700/50">
                <div className="flex justify-between items-center text-sm font-semibold text-zinc-200">
                  <span>Game Effects (SFX) Volume</span>
                  <span className="text-cyan-400 font-mono">
                    {Math.round(settings.sfxVolume * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  aria-label="Game Effects SFX Volume"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.sfxVolume}
                  disabled={settings.muted}
                  onChange={(e) => updateSettings({ sfxVolume: parseFloat(e.target.value) })}
                  className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-cyan-400 disabled:opacity-40"
                />
              </div>

              {/* Sound Test Button */}
              <div className="pt-2">
                <button
                  onClick={handleSoundTest}
                  disabled={settings.muted}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold text-sm transition shadow-md disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  <span>🎵</span> Test Sound Chime
                </button>
              </div>
            </div>
          )}

          {/* DISPLAY TAB */}
          {activeTab === 'display' && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <label className="block text-sm font-semibold text-zinc-200 mb-2">
                  Color Theme
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { id: 'cyber', name: 'Cyber Neon', border: 'border-cyan-500', color: 'from-zinc-950 to-cyan-950' },
                    { id: 'synthwave', name: 'Synthwave', border: 'border-fuchsia-500', color: 'from-zinc-950 to-fuchsia-950' },
                    { id: 'oled', name: 'OLED Pitch Black', border: 'border-zinc-400', color: 'bg-black' },
                    { id: 'light', name: 'Crisp Light', border: 'border-amber-400', color: 'from-slate-100 to-zinc-200 text-zinc-900' },
                  ].map((themeOpt) => (
                    <button
                      key={themeOpt.id}
                      onClick={() => {
                        playEffect('click');
                        updateSettings({ theme: themeOpt.id as ArcadeTheme });
                      }}
                      className={`p-3 rounded-xl border text-left transition flex flex-col justify-between h-20 ${
                        settings.theme === themeOpt.id
                          ? `${themeOpt.border} bg-zinc-800 ring-2 ring-cyan-400/50`
                          : 'border-zinc-700/60 bg-zinc-800/40 hover:border-zinc-500'
                      }`}
                    >
                      <span className="font-semibold text-sm">{themeOpt.name}</span>
                      <div className={`h-4 w-full rounded bg-gradient-to-r ${themeOpt.color}`} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Matrix Rain Toggle & Opacity */}
              <div className="p-3.5 rounded-xl bg-zinc-800/50 border border-zinc-700/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-sm text-zinc-200">Matrix Rain Canvas</div>
                    <div className="text-xs text-zinc-400">Animated code rain in arcade menus</div>
                  </div>
                  <button
                    onClick={() => {
                      playEffect('click');
                      updateSettings({ matrixRain: !settings.matrixRain });
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      settings.matrixRain ? 'bg-cyan-600' : 'bg-zinc-700'
                    }`}
                    aria-pressed={settings.matrixRain}
                    aria-label="Toggle matrix rain canvas"
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        settings.matrixRain ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {settings.matrixRain && (
                  <div className="pt-2 border-t border-zinc-700/40">
                    <div className="flex justify-between items-center text-xs font-semibold text-zinc-300 mb-1">
                      <span>Rain Opacity</span>
                      <span className="font-mono text-cyan-400">
                        {Math.round(settings.matrixOpacity * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      aria-label="Matrix Rain Opacity"
                      min="0.05"
                      max="0.4"
                      step="0.02"
                      value={settings.matrixOpacity}
                      onChange={(e) => updateSettings({ matrixOpacity: parseFloat(e.target.value) })}
                      className="w-full h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                    />
                  </div>
                )}
              </div>

              {/* Reduced Motion Toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-800/50 border border-zinc-700/50">
                <div>
                  <div className="font-semibold text-sm text-zinc-200">Reduced Motion</div>
                  <div className="text-xs text-zinc-400">Minimize animations and particle effects</div>
                </div>
                <button
                  onClick={() => {
                    playEffect('click');
                    updateSettings({ reducedMotion: !settings.reducedMotion });
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.reducedMotion ? 'bg-cyan-600' : 'bg-zinc-700'
                  }`}
                  aria-pressed={settings.reducedMotion}
                  aria-label="Toggle reduced motion"
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.reducedMotion ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Confetti Toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-800/50 border border-zinc-700/50">
                <div>
                  <div className="font-semibold text-sm text-zinc-200">Victory Confetti</div>
                  <div className="text-xs text-zinc-400">Explosive particle bursts upon winning</div>
                </div>
                <button
                  onClick={() => {
                    playEffect('click');
                    updateSettings({ confettiEnabled: !settings.confettiEnabled });
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.confettiEnabled ? 'bg-cyan-600' : 'bg-zinc-700'
                  }`}
                  aria-pressed={settings.confettiEnabled}
                  aria-label="Toggle victory confetti"
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.confettiEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <div className="space-y-5 animate-fade-in">
              {/* Player Name */}
              <div>
                <label className="block text-sm font-semibold text-zinc-200 mb-1.5">
                  Player Display Name
                </label>
                <div className="relative">
                  <input
                    type="text"
                    maxLength={16}
                    value={settings.playerName}
                    onChange={(e) => updateSettings({ playerName: e.target.value })}
                    placeholder="Enter your handle..."
                    className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition text-sm"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-zinc-500 font-mono">
                    {settings.playerName.length}/16
                  </span>
                </div>
              </div>

              {/* Avatar Picker */}
              <div>
                <label className="block text-sm font-semibold text-zinc-200 mb-2">
                  Arcade Avatar
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {AVATARS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        playEffect('click');
                        triggerHaptic('light');
                        updateSettings({ avatar: emoji });
                      }}
                      className={`text-2xl p-2.5 rounded-xl border transition flex items-center justify-center ${
                        settings.avatar === emoji
                          ? 'border-cyan-400 bg-cyan-950/60 ring-2 ring-cyan-400/50 scale-105'
                          : 'border-zinc-700/60 bg-zinc-800/40 hover:bg-zinc-800'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Preferred Mark */}
              <div>
                <label className="block text-sm font-semibold text-zinc-200 mb-2">
                  Preferred Solo Piece
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {(['X', 'O'] as const).map((mark) => (
                    <button
                      key={mark}
                      onClick={() => {
                        playEffect('click');
                        updateSettings({ preferredMark: mark });
                      }}
                      className={`py-3 rounded-xl border font-black text-xl transition flex items-center justify-center gap-2 ${
                        settings.preferredMark === mark
                          ? mark === 'X'
                            ? 'border-cyan-400 bg-cyan-950/50 text-cyan-400 ring-2 ring-cyan-400/40'
                            : 'border-rose-400 bg-rose-950/50 text-rose-400 ring-2 ring-rose-400/40'
                          : 'border-zinc-700/60 bg-zinc-800/40 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <span>{mark}</span>
                      <span className="text-xs font-normal text-zinc-400">
                        {mark === 'X' ? '(First move)' : '(Second move)'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* GAMEPLAY TAB */}
          {activeTab === 'gameplay' && (
            <div className="space-y-5 animate-fade-in">
              {/* Default AI Difficulty */}
              <div>
                <label className="block text-sm font-semibold text-zinc-200 mb-2">
                  Default AI Difficulty
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['easy', 'medium', 'hard', 'impossible'] as AIDifficultySetting[]).map((diff) => (
                    <button
                      key={diff}
                      onClick={() => {
                        playEffect('click');
                        updateSettings({ defaultDifficulty: diff });
                      }}
                      className={`py-2.5 px-2 rounded-xl border text-xs font-semibold capitalize transition ${
                        settings.defaultDifficulty === diff
                          ? 'border-cyan-400 bg-cyan-950/60 text-cyan-300 ring-1 ring-cyan-400'
                          : 'border-zinc-700/60 bg-zinc-800/40 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {diff}
                    </button>
                  ))}
                </div>
              </div>

              {/* Turn Timer Duration */}
              <div>
                <label className="block text-sm font-semibold text-zinc-200 mb-2">
                  Online Turn Timer Duration
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {([15, 20, 30, 60] as const).map((secs) => (
                    <button
                      key={secs}
                      onClick={() => {
                        playEffect('click');
                        updateSettings({ turnTimerDuration: secs });
                      }}
                      className={`py-2 px-1 rounded-xl border text-xs font-semibold transition ${
                        settings.turnTimerDuration === secs
                          ? 'border-cyan-400 bg-cyan-950/60 text-cyan-300 ring-1 ring-cyan-400'
                          : 'border-zinc-700/60 bg-zinc-800/40 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      {secs}s {secs === 15 ? '⚡ Blitz' : secs === 30 ? '♟️ Std' : ''}
                    </button>
                  ))}
                </div>
              </div>

              {/* Mobile Haptics */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-zinc-800/50 border border-zinc-700/50">
                <div>
                  <div className="font-semibold text-sm text-zinc-200">Mobile Haptic Feedback</div>
                  <div className="text-xs text-zinc-400">Vibrate on tap and game events (Mobile devices)</div>
                </div>
                <button
                  onClick={() => {
                    playEffect('click');
                    triggerHaptic('medium');
                    updateSettings({ hapticsEnabled: !settings.hapticsEnabled });
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.hapticsEnabled ? 'bg-cyan-600' : 'bg-zinc-700'
                  }`}
                  aria-pressed={settings.hapticsEnabled}
                  aria-label="Toggle mobile haptic feedback"
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.hapticsEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-zinc-800 bg-zinc-950/60">
          <button
            onClick={() => {
              if (window.confirm('Reset all arcade settings to default?')) {
                resetSettings();
                playEffect('invalid');
              }
            }}
            className="text-xs text-zinc-400 hover:text-rose-400 transition"
          >
            Reset Defaults
          </button>

          <button
            onClick={() => {
              playEffect('click');
              closeSettings();
            }}
            className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-zinc-950 font-bold text-sm transition shadow-lg shadow-cyan-500/20"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
