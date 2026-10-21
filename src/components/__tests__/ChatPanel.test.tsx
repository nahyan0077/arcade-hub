import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatPanel } from '../ChatPanel';
import type { ChatEvent, RoomSession } from '../../net/RoomSession';

function makeFakeSession() {
  const listeners = new Set<(event: ChatEvent) => void>();
  return {
    getSnapshot: () => ({ myId: 'me', myName: 'ME' }),
    onChat(listener: (event: ChatEvent) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    sendChat: vi.fn(() => true),
    sendEmoji: vi.fn(() => true),
    emit(event: ChatEvent) {
      for (const listener of listeners) listener(event);
    },
  };
}

function renderPanel(session: ReturnType<typeof makeFakeSession>) {
  return render(<ChatPanel session={session as unknown as RoomSession} />);
}

describe('ChatPanel', () => {
  it('opens and closes the panel from the toggle button', async () => {
    const user = userEvent.setup();
    renderPanel(makeFakeSession());

    expect(screen.queryByTestId('chat-panel')).not.toBeInTheDocument();
    await user.click(screen.getByTestId('chat-toggle'));
    expect(screen.getByTestId('chat-panel')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close chat panel' }));
    expect(screen.queryByTestId('chat-panel')).not.toBeInTheDocument();
  });

  it('sends a chat message and shows it locally', async () => {
    const session = makeFakeSession();
    renderPanel(session);
    await userEvent.click(screen.getByTestId('chat-toggle'));

    await userEvent.type(screen.getByTestId('chat-input'), 'hello there');
    await userEvent.click(screen.getByTestId('chat-send'));

    expect(session.sendChat).toHaveBeenCalledWith('hello there');
    expect(screen.getByTestId('chat-messages')).toHaveTextContent('hello there');
    expect(screen.getByTestId('chat-input')).toHaveValue('');
  });

  it('sends an emoji and shows a burst', async () => {
    const session = makeFakeSession();
    renderPanel(session);
    await userEvent.click(screen.getByTestId('chat-toggle'));

    await userEvent.click(screen.getByRole('button', { name: 'send emoji 🔥' }));

    expect(session.sendEmoji).toHaveBeenCalledWith('🔥');
    expect(screen.getByTestId('emoji-burst')).toHaveTextContent('🔥');
  });

  it('renders remote chat messages and badges unread while closed', () => {
    const session = makeFakeSession();
    renderPanel(session);

    act(() => {
      session.emit({ kind: 'chat', fromId: 'them', from: 'BOB', text: 'hi there' });
    });
    expect(screen.getByTestId('chat-unread')).toHaveTextContent('1');

    fireEvent.click(screen.getByTestId('chat-toggle'));
    expect(screen.getByTestId('chat-messages')).toHaveTextContent('BOB');
    expect(screen.getByTestId('chat-messages')).toHaveTextContent('hi there');
    expect(screen.queryByTestId('chat-unread')).not.toBeInTheDocument();
  });

  it('disables send while the input is empty', async () => {
    renderPanel(makeFakeSession());
    await userEvent.click(screen.getByTestId('chat-toggle'));
    expect(screen.getByTestId('chat-send')).toBeDisabled();
  });
});
