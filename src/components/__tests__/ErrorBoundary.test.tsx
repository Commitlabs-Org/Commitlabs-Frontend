/**
 * @vitest-environment happy-dom
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary, withErrorBoundary } from '@/components/ErrorBoundary';
import {
  setErrorTransport,
  type ClientErrorRecord,
} from '@/lib/observability/reportError';

// Component that throws an error
class ThrowingComponent extends Component<{ shouldThrow?: boolean }> {
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Prevent React from logging to console during tests
    console.error(error, errorInfo);
  }

  render() {
    if (this.props.shouldThrow) {
      throw new Error('Test error from ThrowingComponent');
    }
    return <div>Normal component content</div>;
  }
}

describe('ErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>Child component</div>
      </ErrorBoundary>,
    );

    expect(screen.getByText('Child component')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('catches errors and renders fallback UI', () => {
    // Suppress React's error boundary warning for this test
    const originalError = console.error;
    console.error = vi.fn();

    try {
      render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>,
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByText('Try Again')).toBeInTheDocument();
      expect(screen.getByText('Report Issue')).toBeInTheDocument();
    } finally {
      console.error = originalError;
    }
  });

  it('displays error message in fallback UI', () => {
    const originalError = console.error;
    console.error = vi.fn();

    try {
      render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>,
      );

      expect(screen.getByText('Test error from ThrowingComponent')).toBeInTheDocument();
    } finally {
      console.error = originalError;
    }
  });

  it('calls onError callback when error is caught', () => {
    const onError = vi.fn();
    const originalError = console.error;
    console.error = vi.fn();

    try {
      render(
        <ErrorBoundary onError={onError}>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>,
      );

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          componentStack: expect.any(String),
        }),
      );
    } finally {
      console.error = originalError;
    }
  });

  it('logs error to console', () => {
    const originalError = console.error;
    console.error = vi.fn();

    try {
      render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>,
      );

      expect(console.error).toHaveBeenCalledWith(
        '[ErrorBoundary] Caught an error:',
        expect.any(Error),
      );
    } finally {
      console.error = originalError;
    }
  });

  it('renders custom fallback when provided', () => {
    const customFallback = <div>Custom error fallback</div>;
    const originalError = console.error;
    console.error = vi.fn();

    try {
      render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>,
      );

      expect(screen.getByText('Custom error fallback')).toBeInTheDocument();
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    } finally {
      console.error = originalError;
    }
  });

  it('Report Issue link points to Discord', () => {
    const originalError = console.error;
    console.error = vi.fn();

    try {
      render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>,
      );

      const reportLink = screen.getByText('Report Issue').closest('a');
      expect(reportLink).toHaveAttribute('href', 'https://discord.gg/WV7tdYkJk');
      expect(reportLink).toHaveAttribute('target', '_blank');
      expect(reportLink).toHaveAttribute('rel', 'noopener noreferrer');
    } finally {
      console.error = originalError;
    }
  });

  it('handles multiple children', () => {
    render(
      <ErrorBoundary>
        <div>First child</div>
        <div>Second child</div>
        <div>Third child</div>
      </ErrorBoundary>,
    );

    expect(screen.getByText('First child')).toBeInTheDocument();
    expect(screen.getByText('Second child')).toBeInTheDocument();
    expect(screen.getByText('Third child')).toBeInTheDocument();
  });

  it('handles null children gracefully', () => {
    render(
      <ErrorBoundary>
        {null}
      </ErrorBoundary>,
    );

    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });
});

describe('withErrorBoundary HOC', () => {
  it('wraps component with ErrorBoundary', () => {
    const SafeComponent = withErrorBoundary(function TestComponent() {
      return <div>Safe component</div>;
    });

    render(<SafeComponent />);

    expect(screen.getByText('Safe component')).toBeInTheDocument();
  });

  it('sets display name correctly', () => {
    function TestComponent() {
      return <div>Test</div>;
    }

    const SafeComponent = withErrorBoundary(TestComponent);

    expect(SafeComponent.displayName).toBe('withErrorBoundary(TestComponent)');
  });

  it('handles components without display name', () => {
    const SafeComponent = withErrorBoundary(function () {
      return <div>Anonymous</div>;
    });

    expect(SafeComponent.displayName).toBe('withErrorBoundary(Component)');
  });
});

describe('ErrorBoundary — error-monitoring seam', () => {
  afterEach(() => {
    // Restore the default (console) transport so other suites are unaffected.
    setErrorTransport((r) => console.error('[reportError]', r));
  });

  it('forwards caught errors to the reportError seam', () => {
    const captured: ClientErrorRecord[] = [];
    setErrorTransport((r) => captured.push(r));

    const originalError = console.error;
    console.error = vi.fn();
    try {
      render(
        <ErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ErrorBoundary>,
      );
    } finally {
      console.error = originalError;
    }

    expect(captured).toHaveLength(1);
    expect(captured[0].message).toContain('Test error from ThrowingComponent');
    expect(typeof captured[0].timestamp).toBe('string');
    expect(typeof captured[0].route).toBe('string');
  });

  it('does not report when no error is thrown', () => {
    const captured: ClientErrorRecord[] = [];
    setErrorTransport((r) => captured.push(r));

    render(
      <ErrorBoundary>
        <div>Healthy child</div>
      </ErrorBoundary>,
    );

    expect(captured).toHaveLength(0);
  });
});
