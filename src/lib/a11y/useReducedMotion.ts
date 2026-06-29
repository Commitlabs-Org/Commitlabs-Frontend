'use client';

import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Shared motion policy hook for data-visualization surfaces.
 *
 * Reads the `prefers-reduced-motion` media query and returns `true` when the
 * user has requested reduced motion. Consumers use this to gate chart and meter
 * animations so they remain accessible and feel faster.
 *
 * - SSR-safe: returns `false` on the server and on the first client render to
 *   avoid hydration mismatches, then updates after mount.
 * - Resilient: if `matchMedia` is unsupported it falls back to `false`
 *   (animations enabled) rather than throwing.
 * - Live: subscribes to media-query changes so toggling the OS setting updates
 *   the value without a reload.
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia(QUERY);
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedMotion;
}

export default useReducedMotion;
