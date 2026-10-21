import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuickEmoji } from '../QuickEmoji';

describe('QuickEmoji', () => {
  it('opens the reaction picker and sends an emoji, then closes', async () => {
    const onEmoji = vi.fn();
    render(<QuickEmoji onEmoji={onEmoji} />);

    expect(screen.queryByTestId('quick-emoji-panel')).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId('quick-emoji-toggle'));
    expect(screen.getByTestId('quick-emoji-panel')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'react with 👀' }));
    expect(onEmoji).toHaveBeenCalledWith('👀');
    expect(screen.queryByTestId('quick-emoji-panel')).not.toBeInTheDocument();
  });

  it('closes on outside click and Escape', () => {
    const { container } = render(
      <div>
        <QuickEmoji onEmoji={vi.fn()} />
        <div data-testid="outside" />
      </div>,
    );
    fireEvent.click(screen.getByTestId('quick-emoji-toggle'));
    expect(screen.getByTestId('quick-emoji-panel')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(screen.queryByTestId('quick-emoji-panel')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('quick-emoji-toggle'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('quick-emoji-panel')).not.toBeInTheDocument();
    expect(container).toBeInTheDocument();
  });
});
