"use client";

import { WifiOff, Wifi } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface ConnectionStatusBannerProps {
  isOnline: boolean;
}

export function ConnectionStatusBanner({ isOnline }: ConnectionStatusBannerProps) {
  const [showReconnect, setShowReconnect] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const wasOffline = useRef(false);
  const prefersReducedMotion = useRef(false);

  useEffect(() => {
    prefersReducedMotion.current = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
  }, []);

  // Track offline transitions and reset state
  useEffect(() => {
    if (!isOnline) {
      wasOffline.current = true;
      setShowReconnect(false);
      setDismissed(false);
    }
  }, [isOnline]);

  // Show reconnect confirmation when coming back online from a real offline state
  useEffect(() => {
    if (!isOnline || !wasOffline.current) return;

    wasOffline.current = false;
    setShowReconnect(true);

    if (prefersReducedMotion.current) return;

    const timeout = window.setTimeout(() => {
      setShowReconnect(false);
    }, 2400);

    return () => window.clearTimeout(timeout);
  }, [isOnline]);

  const isOffline = !isOnline;

  // Visibility: offline & not dismissed, or online & showing reconnect
  const shouldShow = (isOffline && !dismissed) || (isOnline && showReconnect);

  if (!shouldShow) {
    return null;
  }

  const title = isOffline ? 'You are offline' : 'Back online';
  const description = isOffline
    ? 'Queued actions will resume once the connection is restored.'
    : 'Your connection is restored. You can continue with queued actions.';

  return (
    <div
      role="status"
      aria-live="polite"
      className="border-b border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 backdrop-blur motion-reduce:backdrop-blur-none supports-[backdrop-filter]:bg-amber-500/15 dark:text-amber-100"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <div className="flex items-start gap-2">
          {isOffline ? (
            <WifiOff size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          ) : (
            <Wifi size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
          )}
          <div>
            <p className="font-semibold">{title}</p>
            <p className="text-xs opacity-90">{description}</p>
          </div>
        </div>
        {isOffline && (
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="rounded-md border border-amber-600/40 px-2.5 py-1 text-xs font-medium hover:bg-amber-600/10"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
