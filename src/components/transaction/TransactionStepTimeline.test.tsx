// @vitest-environment happy-dom
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TransactionStepTimeline from './TransactionStepTimeline';

describe('TransactionStepTimeline', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('renders the stepped lifecycle and marks the active step', () => {
    render(<TransactionStepTimeline currentPhase="sign" state="in_progress" />);

    const list = screen.getByRole('list', { name: /transaction progress/i });
    expect(list).toBeInTheDocument();

    const signItem = screen.getByText('Sign').closest('li');
    expect(signItem).toHaveAttribute('aria-current', 'step');
    expect(signItem).toHaveTextContent(/Active/i);
  });

  it('updates elapsed time while the active step is running', () => {
    render(<TransactionStepTimeline currentPhase="submit" state="in_progress" />);

    expect(screen.getByText(/elapsed 0s/i)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(screen.getByText(/elapsed 3s/i)).toBeInTheDocument();
  });

  it('renders failed state and copy action when a step fails', () => {
    const onCopyHash = vi.fn();

    render(
      <TransactionStepTimeline
        currentPhase="submit"
        state="error"
        txHash="abc123"
        onCopyHash={onCopyHash}
      />,
    );

    const submitItem = screen.getByText('Submit').closest('li');
    expect(submitItem).toHaveTextContent(/Failed/i);

    fireEvent.click(screen.getByRole('button', { name: /copy transaction hash/i }));

    expect(onCopyHash).toHaveBeenCalledWith('abc123');
  });
});
