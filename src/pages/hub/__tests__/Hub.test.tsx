import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Hub } from '../Hub';

function StartProbe() {
  return <div>start page</div>;
}

function RushProbe() {
  return <div>direction rush page</div>;
}

function renderHub() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<Hub />} />
        <Route path="/start" element={<StartProbe />} />
        <Route path="/direction-rush" element={<RushProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('Hub', () => {
  it('lists the three live games without placeholder cards', () => {
    renderHub();
    expect(screen.getByTestId('hub-card-tictactoe')).toBeInTheDocument();
    expect(screen.getByTestId('hub-card-connect-four')).toBeInTheDocument();
    expect(screen.getByTestId('hub-card-direction-rush')).toBeInTheDocument();
    expect(screen.queryByTestId('hub-card-arrow-race')).not.toBeInTheDocument();
    expect(screen.queryByTestId('hub-card-dots-and-boxes')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Play' })).toHaveLength(3);
    expect(screen.queryByText('Coming soon')).not.toBeInTheDocument();
  });

  it('navigates to the start screen from the tictactoe card', async () => {
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

  it('navigates to direction-rush from the direction-rush card', async () => {
    const user = userEvent.setup();
    renderHub();
    await user.click(
      within(screen.getByTestId('hub-card-direction-rush')).getByRole('button', { name: 'Play' }),
    );
    expect(screen.getByText('direction rush page')).toBeInTheDocument();
  });
});
