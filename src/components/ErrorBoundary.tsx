'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional fallback rendered when an error is caught. */
  fallback?: ReactNode;
  /** Called when an error is caught — useful for telemetry. */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Generic React error boundary that isolates rendering failures to a
 * bounded section of the tree. Used by the commitment detail page to
 * keep health metrics, attestation panels, and other sections
 * independently recoverable.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Report to telemetry without leaking secrets
    try {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[ErrorBoundary] caught:', error.message, errorInfo.componentStack);
      }
    } catch {
      // Swallow — boundary must never throw
    }
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          role="alert"
          className="rounded-xl bg-[#1a0a0a] border border-[#331515] p-6 text-center"
        >
          <p className="text-[#f87171] font-medium mb-2">Something went wrong</p>
          <p className="text-[#888] text-sm mb-4">
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="rounded-lg px-4 py-2 bg-[#222] text-white text-sm hover:bg-[#333] transition-colors"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
