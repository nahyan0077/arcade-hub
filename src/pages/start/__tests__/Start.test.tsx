import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Start } from '../Start';

function GameProbe() {
  const location = useLocation();
  return (
    <div>
      game screen
      <span data-testid="game-state">{JSON.stringify(location.state)}</span>
    </div>
  );
}

function renderStart() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Start />} />
        <Route path="/game" element={<GameProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Start screen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks start without a name', async () => {
    const user = userEvent.setup();
    renderStart();
    await user.click(screen.getByText('Start Game'));
    expect(screen.queryByText('game screen')).not.toBeInTheDocument();
    expect(await screen.findByText('Please Enter your name')).toBeInTheDocument();
  });

  it('blocks start without selecting a mark', async () => {
    const user = userEvent.setup();
    renderStart();
    await user.type(screen.getByPlaceholderText('Enter your name'), 'Alice');
    await user.click(screen.getByText('Start Game'));
    expect(await screen.findByText('Please select the player type')).toBeInTheDocument();
    expect(screen.queryByText('game screen')).not.toBeInTheDocument();
  });

  it('navigates to game with selected mark and name', async () => {
    const user = userEvent.setup();
    renderStart();
    await user.click(screen.getByRole('button', { name: 'Play as O' }));
    await user.type(screen.getByPlaceholderText('Enter your name'), 'Alice');
    await user.click(screen.getByText('Start Game'));
    expect(await screen.findByText('game screen')).toBeInTheDocument();
  });

  it('defaults to 2-player mode with difficulty hidden', () => {
    renderStart();
    expect(screen.getByRole('button', { name: '2 Players' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'vs AI' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('group', { name: 'AI difficulty' })).not.toBeInTheDocument();
  });

  it('reveals difficulty picker only in vs AI mode', async () => {
    const user = userEvent.setup();
    renderStart();
    await user.click(screen.getByRole('button', { name: 'vs AI' }));
    const group = screen.getByRole('group', { name: 'AI difficulty' });
    expect(within(group).getAllByRole('button')).toHaveLength(4);
    expect(within(group).getByRole('button', { name: 'MEDIUM' })).toHaveAttribute('aria-pressed', 'true');
    expect(within(group).queryByRole('button', { name: 'HARD' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('passes mode and difficulty to the game route', async () => {
    const user = userEvent.setup();
    renderStart();
    await user.click(screen.getByRole('button', { name: 'Play as X' }));
    await user.type(screen.getByPlaceholderText('Enter your name'), 'Bob');
    await user.click(screen.getByRole('button', { name: 'vs AI' }));
    await user.click(screen.getByRole('button', { name: 'HARD' }));
    await user.click(screen.getByText('Start Game'));
    await screen.findByText('game screen');
    const state = JSON.parse(screen.getByTestId('game-state').textContent ?? '{}');
    expect(state).toMatchObject({ playerType: 'X', name: 'Bob', mode: 'pve', difficulty: 'hard' });
  });

  it('passes pvp mode with default difficulty', async () => {
    const user = userEvent.setup();
    renderStart();
    await user.click(screen.getByRole('button', { name: 'Play as X' }));
    await user.type(screen.getByPlaceholderText('Enter your name'), 'Ana');
    await user.click(screen.getByText('Start Game'));
    await screen.findByText('game screen');
    const state = JSON.parse(screen.getByTestId('game-state').textContent ?? '{}');
    expect(state).toMatchObject({ mode: 'pvp', difficulty: 'medium' });
  });
});