import React, { type ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RouteError from './error';

// Simple ErrorBoundary wrapper to test throwing child behavior in React tree
interface BoundaryProps {
  children: ReactNode;
  onReset?: () => void;
}
interface BoundaryState {
  hasError: boolean;
  error: (Error & { digest?: string }) | null;
}

class TestErrorBoundary extends React.Component<BoundaryProps, BoundaryState> {
  constructor(props: BoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { hasError: true, error };
  }

  reset = () => {
    this.props.onReset?.();
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      return <RouteError error={this.state.error} reset={this.reset} />;
    }
    return this.props.children;
  }
}

function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error('Test crash in dashboard child');
  }
  return <div>Normal Content</div>;
}

function TestHarness() {
  const [shouldThrow, setShouldThrow] = React.useState(true);
  return (
    <TestErrorBoundary onReset={() => setShouldThrow(false)}>
      <ThrowingComponent shouldThrow={shouldThrow} />
    </TestErrorBoundary>
  );
}

describe('RouteError component and boundary', () => {
  it('renders fallback for a throwing child and resets when Try again is clicked', () => {
    // Suppress React error boundary console output in test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<TestHarness />);

    expect(screen.getByText('Something went wrong')).toBeDefined();
    expect(screen.getByText(/Test crash in dashboard child/)).toBeDefined();

    const tryAgainBtn = screen.getByRole('button', { name: /try again/i });
    expect(tryAgainBtn).toBeDefined();

    fireEvent.click(tryAgainBtn);

    expect(screen.getByText('Normal Content')).toBeDefined();
    consoleSpy.mockRestore();
  });

  it('directly invokes reset callback when button is clicked', () => {
    const resetSpy = vi.fn();
    const testError = new Error('Database connection failed');

    render(<RouteError error={testError} reset={resetSpy} />);

    expect(screen.getByText('Something went wrong')).toBeDefined();
    expect(screen.getByText(/Database connection failed/)).toBeDefined();

    const button = screen.getByRole('button', { name: /try again/i });
    fireEvent.click(button);

    expect(resetSpy).toHaveBeenCalledTimes(1);
  });

  it('sanitizes query parameters from URLs in production', () => {
    vi.stubEnv('NODE_ENV', 'production');

    const testError = new Error('Failed to fetch https://horizon.stellar.org/accounts/GA123?secret_token=999');
    render(<RouteError error={testError} reset={() => {}} />);

    expect(screen.queryByText(/secret_token=999/)).toBeNull();
    expect(screen.getByText(/https:\/\/horizon\.stellar\.org\/accounts\/GA123/)).toBeDefined();

    vi.unstubAllEnvs();
  });
});
