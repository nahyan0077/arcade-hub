import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Start } from '../Start';

function renderStart() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Start />} />
        <Route path="/game" element={<div>game screen</div>} />
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
});