import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GameShell } from '../GameShell';
import { SettingsProvider } from '../../settings/SettingsContext';

describe('GameShell component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete document.body.dataset.game;
  });

  it('renders title, subtitle, main landmark and sets data-game on body', () => {
    const { unmount } = render(
      <SettingsProvider>
        <GameShell
          game="ttt"
          title={<h1>TIC TAC TOE</h1>}
          subtitle={<span>MATCH 1</span>}
          onBack={vi.fn()}
          soundOn={true}
          onToggleSound={vi.fn()}
        >
          <div>Board Content</div>
        </GameShell>
      </SettingsProvider>,
    );

    const main = screen.getByRole('main');
    expect(main).toBeInTheDocument();
    expect(main).toHaveAttribute('data-game', 'ttt');
    expect(document.body.dataset.game).toBe('ttt');
    expect(screen.getByText('TIC TAC TOE')).toBeInTheDocument();
    expect(screen.getByText('MATCH 1')).toBeInTheDocument();
    expect(screen.getByText('Board Content')).toBeInTheDocument();

    unmount();
    expect(document.body.dataset.game).toBeUndefined();
  });

  it('calls onBack when back button is clicked', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();

    render(
      <SettingsProvider>
        <GameShell
          game="c4"
          title={<h1>CONNECT FOUR</h1>}
          onBack={onBack}
          backLabel="Exit"
          backAriaLabel="Exit game"
          soundOn={true}
          onToggleSound={vi.fn()}
        >
          <div>Content</div>
        </GameShell>
      </SettingsProvider>,
    );

    const backBtn = screen.getByRole('button', { name: 'Exit game' });
    expect(backBtn).toHaveTextContent('Exit');
    await user.click(backBtn);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('handles sound toggle with custom aria labels', async () => {
    const user = userEvent.setup();
    const onToggleSound = vi.fn();

    const { rerender } = render(
      <SettingsProvider>
        <GameShell
          game="rush"
          title={<h1>RUSH</h1>}
          onBack={vi.fn()}
          soundOn={true}
          onToggleSound={onToggleSound}
          soundAriaLabel={{ mute: 'Mute audio', unmute: 'Unmute audio' }}
        >
          <div>Content</div>
        </GameShell>
      </SettingsProvider>,
    );

    const muteBtn = screen.getByRole('button', { name: 'Mute audio' });
    expect(muteBtn).toHaveTextContent('🔊');
    await user.click(muteBtn);
    expect(onToggleSound).toHaveBeenCalledTimes(1);

    rerender(
      <SettingsProvider>
        <GameShell
          game="rush"
          title={<h1>RUSH</h1>}
          onBack={vi.fn()}
          soundOn={false}
          onToggleSound={onToggleSound}
          soundAriaLabel={{ mute: 'Mute audio', unmute: 'Unmute audio' }}
        >
          <div>Content</div>
        </GameShell>
      </SettingsProvider>,
    );

    const unmuteBtn = screen.getByRole('button', { name: 'Unmute audio' });
    expect(unmuteBtn).toHaveTextContent('🔇');
  });

  it('renders headerRightExtra, confetti, and overlayPanels', () => {
    render(
      <SettingsProvider>
        <GameShell
          game="rush"
          title={<h1>DIRECTION RUSH</h1>}
          onBack={vi.fn()}
          soundOn={true}
          onToggleSound={vi.fn()}
          headerRightExtra={<button>End</button>}
          confetti={<div data-testid="confetti-mock">Confetti</div>}
          overlayPanels={<div data-testid="overlay-mock">Overlay</div>}
        >
          <div>Board</div>
        </GameShell>
      </SettingsProvider>,
    );

    expect(screen.getByText('End')).toBeInTheDocument();
    expect(screen.getByTestId('confetti-mock')).toBeInTheDocument();
    expect(screen.getByTestId('overlay-mock')).toBeInTheDocument();
  });
});
