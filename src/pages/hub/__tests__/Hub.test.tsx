import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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
  it('lists two playable games and the rest as coming soon', () => {
    renderHub();
    expect(screen.getByTestId('hub-card-tictactoe')).toBeInTheDocument();
    expect(screen.getByTestId('hub-card-connect-four')).toBeInTheDocument();
    expect(screen.getByTestId('hub-card-dots-and-boxes')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Play' })).toHaveLength(2);
    expect(screen.getAllByText('Coming soon')).toHaveLength(1);
  });

  it('navigates to the start screen for each playable card', async () => {
    const user = userEvent.setup();
    renderHub();
    await user.click(
      within(screen.getByTestId('hub-card-tictactoe')).getByRole('button', { name: 'Play' }),
    );
    expect(screen.getByText('start page')).toBeInTheDocument();
  });

  it('navigates to the start screen from the connect-four card', async () => {
    const user = userEvent.setup();
    renderHub();
    await user.click(
      within(screen.getByTestId('hub-card-connect-four')).getByRole('button', { name: 'Play' }),
    );
    expect(screen.getByText('start page')).toBeInTheDocument();
  });
});
