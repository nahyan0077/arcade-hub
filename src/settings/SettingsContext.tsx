import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { DEFAULT_SETTINGS, type GlobalSettings } from './types';
import { setMasterVolume, setSfxVolume, setMuted, isMuted } from '../sound/audio';

const STORAGE_KEY = 'arcade.global_settings.v2';

interface SettingsContextValue {
  settings: GlobalSettings;
  updateSettings: (partial: Partial<GlobalSettings>) => void;
  resetSettings: () => void;
  isSettingsOpen: boolean;
  openSettings: () => void;
  closeSettings: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function loadSavedSettings(): GlobalSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        ...DEFAULT_SETTINGS,
        muted: isMuted(),
      };
    }
    const parsed = JSON.parse(raw) as Partial<GlobalSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      muted: isMuted(), // audio module is source of truth on startup
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<GlobalSettings>(loadSavedSettings);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Apply theme & accessibility attributes to DOM root
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', settings.theme);
    root.setAttribute('data-reduced-motion', settings.reducedMotion ? 'true' : 'false');

    if (settings.reducedMotion) {
      root.classList.add('reduce-motion');
    } else {
      root.classList.remove('reduce-motion');
    }

    // Sync with Web Audio state
    setMasterVolume(settings.masterVolume);
    setSfxVolume(settings.sfxVolume);
    setMuted(settings.muted);
  }, [settings]);

  // Persist settings changes
  const updateSettings = useCallback((partial: Partial<GlobalSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
    } catch {
      /* storage unavailable */
    }
  }, []);

  const openSettings = useCallback(() => setIsSettingsOpen(true), []);
  const closeSettings = useCallback(() => setIsSettingsOpen(false), []);

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSettings,
        resetSettings,
        isSettingsOpen,
        openSettings,
        closeSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};

const defaultFallbackValue: SettingsContextValue = {
  settings: DEFAULT_SETTINGS,
  updateSettings: () => {},
  resetSettings: () => {},
  isSettingsOpen: false,
  openSettings: () => {},
  closeSettings: () => {},
};

export const useSettings = (): SettingsContextValue => {
  const ctx = useContext(SettingsContext);
  return ctx ?? defaultFallbackValue;
};
