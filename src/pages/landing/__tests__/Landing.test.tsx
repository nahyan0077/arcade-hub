import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Landing } from '../Landing';

describe('Landing', () => {
  it('renders landing screen, telemetry, and enter button', () => {
    render(
      <MemoryRouter>
        <Landing autoRedirect={false} />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('landing-screen')).toBeInTheDocument();
    expect(screen.getByText('ARCADE')).toBeInTheDocument();
    expect(screen.getByText('HUB')).toBeInTheDocument();
    expect(screen.getByText('SYS.ID // ARCADE-OS v2.4')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ENTER ARCADE/i })).toBeInTheDocument();
  });

  it('invokes onEnter callback when clicking Enter Arcade', async () => {
    vi.useFakeTimers();
    const handleEnter = vi.fn();
    render(
      <MemoryRouter>
        <Landing onEnter={handleEnter} autoRedirect={false} />
      </MemoryRouter>,
    );

    const enterBtn = screen.getByRole('button', { name: /ENTER ARCADE/i });
    fireEvent.click(enterBtn);

    // handles timeout delay for sound/flash
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(handleEnter).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('triggers onEnter when pressing Space or Enter key', async () => {
    vi.useFakeTimers();
    const handleEnter = vi.fn();
    render(
      <MemoryRouter>
        <Landing onEnter={handleEnter} autoRedirect={false} />
      </MemoryRouter>,
    );

    fireEvent.keyDown(window, { code: 'Space' });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(handleEnter).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('toggles audio mute button state', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Landing autoRedirect={false} />
      </MemoryRouter>,
    );

    const soundBtn = screen.getByRole('button', { name: /audio/i });
    const initialText = soundBtn.textContent;
    await user.click(soundBtn);
    expect(soundBtn.textContent).not.toBe(initialText);
  });
});
