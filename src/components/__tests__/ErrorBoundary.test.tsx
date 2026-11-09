import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorBoundary } from '../ErrorBoundary';

const Bomb: React.FC<{ shouldThrow?: boolean }> = ({ shouldThrow = true }) => {
  if (shouldThrow) {
    throw new Error('Test Explosion');
  }
  return <div>Safe Content</div>;
};

describe('ErrorBoundary component', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renders children when no error is thrown', () => {
    render(
      <ErrorBoundary>
        <div>All Systems Normal</div>
      </ErrorBoundary>,
    );

    expect(screen.getByText('All Systems Normal')).toBeInTheDocument();
  });

  it('catches runtime errors and renders default alert UI', () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Arena Glitch Encountered')).toBeInTheDocument();
    expect(screen.getByText('Test Explosion')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back to hub/i })).toBeInTheDocument();
  });

  it('renders custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={<div>Custom Error UI</div>}>
        <Bomb />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Custom Error UI')).toBeInTheDocument();
    expect(screen.queryByText('Arena Glitch Encountered')).not.toBeInTheDocument();
  });

  it('resets error state and calls onReset when Try Again is clicked', async () => {
    const user = userEvent.setup();
    const handleReset = vi.fn();

    const StatefulWrapper = () => {
      const [explode, setExplode] = useState(true);
      return (
        <ErrorBoundary
          onReset={() => {
            handleReset();
            setExplode(false);
          }}
        >
          <Bomb shouldThrow={explode} />
        </ErrorBoundary>
      );
    };

    render(<StatefulWrapper />);

    expect(screen.getByText('Arena Glitch Encountered')).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /try again/i });
    await user.click(retryBtn);

    expect(handleReset).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Safe Content')).toBeInTheDocument();
  });
});
