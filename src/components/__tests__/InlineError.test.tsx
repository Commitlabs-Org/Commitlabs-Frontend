import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from '@/test/axe';
import { InlineError } from '../InlineError';

describe('InlineError', () => {
  it('renders the message inside an alert', () => {
    render(<InlineError message="Could not load commitments" />);

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Could not load commitments');
  });

  it('fires onRetry once when the retry button is clicked', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(<InlineError message="Could not load commitments" onRetry={onRetry} />);

    await user.click(screen.getByRole('button', { name: 'Retry' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders a custom retry label when provided', () => {
    render(
      <InlineError message="Could not load commitments" onRetry={() => {}} retryLabel="Try again" />,
    );

    expect(screen.getByRole('button', { name: 'Try again' })).toBeDefined();
  });

  it('hides the retry button when no handler is provided', () => {
    render(<InlineError message="Could not load commitments" />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(
      <main>
        <InlineError message="Could not load commitments" onRetry={() => {}} />
      </main>,
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
