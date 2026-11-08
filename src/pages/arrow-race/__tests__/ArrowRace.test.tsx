import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ArrowRace } from '../ArrowRace';
import { localStorageMock } from '../../../test/setup';
import { setMuted } from '../../../sound/audio';

const KEY = 'arrow-race.scores.v1';

interface NavState {
  name?: string;
  mode?: string;
  difficulty?: string;
}

function renderGame(state: NavState | null = { name: 'Alice', mode: 'pve', difficulty: 'medium' }) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/arrow-race', state }]}>
      <ArrowRace />
    </MemoryRouter>,
  );
}

function answerButton(dir: 'up' | 'down' | 'left' | 'right') {
  return screen.getByTestId(`answer-${dir}`);
}

async function answerCorrectly(user: ReturnType<typeof userEvent.setup>) {
  // Read the live stimulus from the arrow's accessible label.
  const arrow = await screen.findByTestId('race-arrow');
  const label = arrow.getAttribute('aria-label') ?? '';
  const match = /moving (up|down|left|right)/.exec(label);
  if (!match) throw new Error(`no moving direction in: ${label}`);
  const dir = match[1] as 'up' | 'down' | 'left' | 'right';
  await user.click(answerButton(dir));
}

describe('ArrowRace game screen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
    localStorageMock.setItem.mockReturnValue(undefined);
    setMuted(false);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders scores, target, and a live stimulus', async () => {
    renderGame();
    expect(screen.getByTestId('score-x')).toHaveTextContent('0');
    expect(screen.getByTestId('score-o')).toHaveTextContent('0');
    expect(screen.getByTestId('score-draws')).toHaveTextContent('0');
    expect(screen.getByText('First to 5')).toBeInTheDocument();
    await screen.findByTestId('race-arrow');
    expect(screen.getByTestId('status')).toHaveTextContent(/answer the slide|racing/i);
    expect(answerButton('up')).toBeEnabled();
  });

  it('falls back to defaults without navigation state', async () => {
    renderGame(null);
    expect(screen.getByTestId('score-x')).toHaveTextContent('0');
    await screen.findByTestId('race-arrow');
  });

  it('scores a correct answer for the human', async () => {
    const user = userEvent.setup();
    renderGame();
    await answerCorrectly(user);
    expect(screen.getByTestId('score-x')).toHaveTextContent('1');
    expect(screen.getByTestId('score-o')).toHaveTextContent('0');
  });

  it('awards the AI when the human answers wrong', async () => {
    const user = userEvent.setup();
    renderGame();
    const arrow = await screen.findByTestId('race-arrow');
    const label = arrow.getAttribute('aria-label') ?? '';
    const match = /moving (up|down|left|right)/.exec(label);
    if (!match) throw new Error(`no moving direction in: ${label}`);
    const moving = match[1] as 'up' | 'down' | 'left' | 'right';
    const wrong = (['up', 'down', 'left', 'right'] as const).find((d) => d !== moving);
    if (!wrong) throw new Error('no wrong direction');
    await user.click(answerButton(wrong));
    expect(screen.getByTestId('score-o')).toHaveTextContent('1');
    expect(screen.getByTestId('score-x')).toHaveTextContent('0');
  });

  it('disables answers until the next round starts', async () => {
    const user = userEvent.setup();
    renderGame();
    await answerCorrectly(user);
    expect(answerButton('up')).toBeDisabled();
    expect(screen.getByTestId('status')).toHaveTextContent('Next round…');
    await waitFor(
      () => expect(answerButton('up')).toBeEnabled(),
      { timeout: 4000 },
    );
  });

  it('persists scores under the arrow-race key', async () => {
    const user = userEvent.setup();
    renderGame();
    await answerCorrectly(user);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      KEY,
      JSON.stringify({ X: 1, O: 0, draws: 0 }),
    );
  });

  it('ends the match at five human points and offers rematch', async () => {
    const user = userEvent.setup();
    renderGame();

    for (let i = 0; i < 5; i++) {
      await answerCorrectly(user);
      if (i < 4) {
        await waitFor(() => expect(answerButton('up')).toBeEnabled(), { timeout: 4000 });
      }
    }

    expect(screen.getByTestId('score-x')).toHaveTextContent('5');
    const dialog = screen.getByRole('dialog', { name: 'Game result' });
    expect(within(dialog).getByText(/You win!/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Rematch' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('score-x')).toHaveTextContent('0');
    await waitFor(() => expect(answerButton('up')).toBeEnabled(), { timeout: 4000 });
  }, 25000);

  it('resetMatch wipes scores and restarts', async () => {
    const user = userEvent.setup();
    renderGame();
    await answerCorrectly(user);
    expect(screen.getByTestId('score-x')).toHaveTextContent('1');
    await user.click(screen.getByRole('button', { name: 'Reset Scores' }));
    expect(screen.getByTestId('score-x')).toHaveTextContent('0');
    await waitFor(() => expect(answerButton('up')).toBeEnabled(), { timeout: 4000 });
  });
});
