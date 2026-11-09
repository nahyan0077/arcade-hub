import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { SettingsProvider, useSettings } from '../SettingsContext';
import { SettingsModal } from '../../components/SettingsModal';

const TestConsumer: React.FC = () => {
  const { settings, updateSettings, openSettings, resetSettings } = useSettings();
  return (
    <div>
      <div data-testid="player-name">{settings.playerName}</div>
      <div data-testid="theme">{settings.theme}</div>
      <div data-testid="master-volume">{settings.masterVolume}</div>
      <button data-testid="rename-btn" onClick={() => updateSettings({ playerName: 'ApexGamer' })}>
        Rename
      </button>
      <button data-testid="theme-btn" onClick={() => updateSettings({ theme: 'synthwave' })}>
        Theme
      </button>
      <button data-testid="open-settings-btn" onClick={openSettings}>
        Open
      </button>
      <button data-testid="reset-btn" onClick={resetSettings}>
        Reset
      </button>
    </div>
  );
};

describe('SettingsContext and SettingsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('provides default settings and updates them reactively', () => {
    render(
      <SettingsProvider>
        <TestConsumer />
      </SettingsProvider>,
    );

    expect(screen.getByTestId('player-name').textContent).toBe('Player 1');
    expect(screen.getByTestId('theme').textContent).toBe('cyber');

    act(() => {
      fireEvent.click(screen.getByTestId('rename-btn'));
    });
    expect(screen.getByTestId('player-name').textContent).toBe('ApexGamer');

    act(() => {
      fireEvent.click(screen.getByTestId('theme-btn'));
    });
    expect(screen.getByTestId('theme').textContent).toBe('synthwave');
    expect(document.documentElement.getAttribute('data-theme')).toBe('synthwave');
  });

  it('opens and closes settings modal correctly', () => {
    render(
      <SettingsProvider>
        <SettingsModal />
        <TestConsumer />
      </SettingsProvider>,
    );

    expect(screen.queryByRole('dialog')).toBeNull();

    act(() => {
      fireEvent.click(screen.getByTestId('open-settings-btn'));
    });

    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText('Arcade Settings')).toBeDefined();

    act(() => {
      fireEvent.click(screen.getByLabelText('Close settings'));
    });

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
