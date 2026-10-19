import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Hub } from '../Hub';

function StartProbe() {
  return <div>start page</div>;
}

function renderHub() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Hub />} />
        <Route path="/start" element={<StartProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Hub', () => {
  it('lists tic-tac-toe as playable and the rest as coming soon', () => {
    renderHub();
    expect(screen.getByTestId('hub-card-tictactoe')).toBeInTheDocument();
    expect(screen.getByTestId('hub-card-connect-four')).toBeInTheDocument();
    expect(screen.getByTestId('hub-card-dots-and-boxes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Play' })).toHaveLength(1);
    expect(screen.getAllByText('Coming soon')).toHaveLength(2);
  });

  it('navigates to the start screen on Play', async () => {
    const user = userEvent.setup();
    renderHub();
    await user.click(screen.getByRole('button', { name: 'Play' }));
    expect(screen.getByText('start page')).toBeInTheDocument();
  });
});
