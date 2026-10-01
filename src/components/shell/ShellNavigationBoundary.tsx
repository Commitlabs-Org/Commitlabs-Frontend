'use client';

import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  evaluateNavigationBoundary,
  validateSessionSnapshot,
  type BoundaryDecision,
  type BoundaryFailure,
  type ShellAuthInput,
} from '@/lib/shell/navigationBoundary';

export type ShellNavigationBoundaryProps = {
  children: ReactNode;
  auth: ShellAuthInput;
  sessionSnapshot?: unknown;
  onRetry?: () => void;
};

function failureFrom(decision: BoundaryDecision): BoundaryFailure | null {
  return decision.ok ? null : decision;
}

export function ShellNavigationBoundary({
  children,
  auth,
  sessionSnapshot,
  onRetry,
}: ShellNavigationBoundaryProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mainRef = useRef<HTMLDivElement>(null);
  const [retryTick, setRetryTick] = useState(0);

  const decision = useMemo(() => {
    const routeDecision = evaluateNavigationBoundary(
      { pathname: pathname ?? '/', search: searchParams ?? undefined },
      auth,
    );
    if (!routeDecision.ok) return routeDecision;
    if (sessionSnapshot !== undefined) {
      const sessionDecision = validateSessionSnapshot(sessionSnapshot, auth.address);
      if (!sessionDecision.ok) return sessionDecision;
    }
    return routeDecision;
    // retryTick is an explicit recovery signal
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams, auth, sessionSnapshot, retryTick]);

  const failure = failureFrom(decision);

  const handleRetry = useCallback(() => {
    setRetryTick((value) => value + 1);
    onRetry?.();
    queueMicrotask(() => {
      mainRef.current?.focus();
    });
  }, [onRetry]);

  if (failure) {
    return (
      <div
        ref={mainRef}
        tabIndex={-1}
        role="alert"
        data-testid="shell-boundary-failure"
        data-error-code={failure.code}
        className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-6 text-center text-white"
      >
        <h2 className="text-xl font-semibold">Navigation blocked</h2>
        <p className="max-w-md text-sm text-white/70">{failure.message}</p>
        <p className="text-xs uppercase tracking-wide text-white/40">{failure.code}</p>
        {failure.recoverable ? (
          <button
            type="button"
            onClick={handleRetry}
            className="mt-2 rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950"
          >
            Retry navigation
          </button>
        ) : (
          <a href="/" className="mt-2 text-sm text-cyan-300 underline">
            Return to overview
          </a>
        )}
      </div>
    );
  }

  return (
    <div ref={mainRef} tabIndex={-1} data-testid="shell-boundary-ready">
      {children}
    </div>
  );
}
