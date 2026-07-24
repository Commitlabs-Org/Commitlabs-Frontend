'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import ErrorLayout from './ErrorLayout';
import ErrorButton from './ErrorButton';
import { reportError } from '@/lib/observability/reportError';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: Array<string | number>;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary component that catches JavaScript errors in child components,
 * logs them, and displays a friendly fallback UI with recovery actions.
 *
 * Features:
 * - Catches errors in component tree
 * - Logs errors to console (client-side)
 * - Displays friendly error message using ErrorLayout
 * - "Try again" button to reset the error state
 * - "Report issue" button linking to Discord
 * - Accessible focus management
 * - Optional reset keys for programmatic resets
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private resetButtonRef = React.createRef<HTMLButtonElement>();

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to console (client-side pattern)
    console.error('[ErrorBoundary] Caught an error:', error);
    console.error('[ErrorBoundary] Error info:', errorInfo);

    // Forward to the pluggable error-monitoring seam. The default transport is
    // a no-op-ish console sink; operators can swap in Sentry/Datadog/etc. via
    // `setErrorTransport` without touching this component. See
    // docs/observability/ERROR_MONITORING.md.
    const route =
      typeof window !== 'undefined' ? window.location.pathname : '';
    reportError(error, route);

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    const { resetKeys } = this.props;
    const { hasError } = this.state;

    if (hasError && prevProps.resetKeys !== resetKeys) {
      if (prevProps.resetKeys !== undefined && resetKeys !== undefined) {
        const prevKeys = JSON.stringify(prevProps.resetKeys);
        const currentKeys = JSON.stringify(resetKeys);
        if (prevKeys !== currentKeys) {
          this.resetError();
        }
      }
    }
  }

  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  componentDidMount(): void {
    if (this.state.hasError && this.resetButtonRef.current) {
      this.resetButtonRef.current.focus();
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <ErrorLayout>
          <div className="space-y-6">
            <h1 className="text-3xl font-bold mb-4">Something went wrong</h1>
            <p className="text-lg opacity-90 mb-6">
              We encountered an unexpected error. This component failed to load, but the rest of the application is still working.
            </p>
            
            {this.state.error && (
              <div className="bg-white/10 rounded-lg p-4 text-left mb-6">
                <p className="text-sm font-mono opacity-80">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={this.resetError}
                ref={this.resetButtonRef}
                className="px-6 py-3 bg-white text-purple-600 font-semibold rounded-lg hover:bg-white/90 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-purple-600"
              >
                Try Again
              </button>
              <a
                href="https://discord.gg/WV7tdYkJk"
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 bg-white/20 text-white font-semibold rounded-lg hover:bg-white/30 transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-purple-600"
              >
                Report Issue
              </a>
            </div>
          </div>
        </ErrorLayout>
      );
    }

    return this.props.children;
  }
}

/**
 * HOC version of ErrorBoundary for easier wrapping of components
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
): React.ComponentType<P> {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name || 'Component'})`;

  return WrappedComponent;
}
