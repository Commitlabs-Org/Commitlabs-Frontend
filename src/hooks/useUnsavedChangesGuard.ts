import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Hook to track dirty state of a form/object and guard against accidental navigation.
 *
 * @param currentState The current state object (e.g., preferences).
 * @returns {
 *   isDirty: boolean indicating if changes differ from baseline,
 *   resetBaseline: () => void to set current state as new baseline (e.g., after save)
 * }
 */
export function useUnsavedChangesGuard<T extends Record<string, any>>(currentState: T) {
  const baselineRef = useRef<T>(JSON.parse(JSON.stringify(currentState)));
  const [isDirty, setIsDirty] = useState(false);
  const router = useRouter();

  // Compare current state with baseline whenever it changes.
  useEffect(() => {
    const dirty = JSON.stringify(currentState) !== JSON.stringify(baselineRef.current);
    setIsDirty(dirty);
  }, [currentState]);

  const resetBaseline = () => {
    baselineRef.current = JSON.parse(JSON.stringify(currentState));
    setIsDirty(false);
  };

  // Prompt on browser unload (refresh/close)
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // Guard against client-side navigation using Next.js router.
  useEffect(() => {
    const handle = (state: any) => {
      if (isDirty) {
        const confirmLeave = window.confirm('You have unsaved changes. Are you sure you want to leave?');
        if (!confirmLeave) return false;
      }
      return true;
    };
    // @ts-ignore – beforePopState may be undefined in some versions.
    if (router && typeof router.beforePopState === 'function') {
      // @ts-ignore
      router.beforePopState(handle);
    }
    return () => {
      // @ts-ignore
      if (router && typeof router.beforePopState === 'function') {
        // @ts-ignore
        router.beforePopState(() => true);
      }
    };
  }, [router, isDirty]);

  return { isDirty, resetBaseline };
}
