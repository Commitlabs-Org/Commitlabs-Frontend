import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Hook to track dirty state of a form/object and guard against accidental navigation.
 *
 * Works with the Next.js App Router. Guards against:
 *   - Browser unload (refresh/tab close) via `beforeunload`
 *   - Browser back/forward navigation via `popstate`
 *   - Link-click navigation via a document-level `click` interceptor
 *
 * @param currentState The current state object to track (e.g., form values).
 * @returns {
 *   isDirty: boolean indicating if the current state differs from the baseline,
 *   resetBaseline: () => void to accept the current state as the new baseline (e.g., after save)
 * }
 */
export function useUnsavedChangesGuard<T extends Record<string, unknown>>(
  currentState: T,
): { isDirty: boolean; resetBaseline: () => void } {
  const baselineRef = useRef<T>(JSON.parse(JSON.stringify(currentState)));
  const [isDirty, setIsDirty] = useState(false);

  // Keep a ref so event handlers always see the current isDirty without
  // needing to be re-registered on every render.
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  // Compare current state with baseline whenever it changes.
  useEffect(() => {
    const dirty =
      JSON.stringify(currentState) !== JSON.stringify(baselineRef.current);
    setIsDirty(dirty);
  }, [currentState]);

  const resetBaseline = useCallback(() => {
    baselineRef.current = JSON.parse(JSON.stringify(currentState));
    setIsDirty(false);
  }, [currentState]);

  // Guard against browser unload (refresh / tab close).
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        e.preventDefault();
        // Setting returnValue is required by some browsers to trigger the
        // native "Leave site?" dialog.
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  // Guard against browser back/forward navigation (popstate).
  // When the user navigates back/forward and there are unsaved changes, we
  // push the current entry back onto the history stack and show a confirm
  // dialog. If the user confirms, we let the navigation proceed.
  useEffect(() => {
    // Push a sentinel entry so we have something to restore to when the user
    // presses back. This is harmless if the entry already exists.
    history.pushState(null, '');

    const handlePopState = () => {
      if (!isDirtyRef.current) return;

      // Re-push the sentinel to keep the guard active for subsequent attempts.
      history.pushState(null, '');

      const confirmLeave = window.confirm(
        'You have unsaved changes. Are you sure you want to leave?',
      );
      if (confirmLeave) {
        // User confirmed — go back twice: once to undo our sentinel push and
        // once to perform the navigation the user originally requested.
        history.go(-2);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Guard against client-side link-click navigation.
  // Intercepts clicks on <a> elements that would navigate away from the page.
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!isDirtyRef.current) return;

      const target = (e.target as HTMLElement).closest('a');
      if (!target) return;

      const href = target.getAttribute('href');
      // Ignore hash-only links, javascript: links, and links that open in a
      // new tab (those won't unload the current page).
      if (
        !href ||
        href.startsWith('#') ||
        href.startsWith('javascript:') ||
        target.target === '_blank'
      ) {
        return;
      }

      // Ignore links to the current page (same pathname + search).
      try {
        const url = new URL(href, window.location.href);
        if (
          url.pathname === window.location.pathname &&
          url.search === window.location.search
        ) {
          return;
        }
      } catch {
        // Malformed href — let it through.
        return;
      }

      const confirmLeave = window.confirm(
        'You have unsaved changes. Are you sure you want to leave?',
      );
      if (!confirmLeave) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, []);

  return { isDirty, resetBaseline };
}
