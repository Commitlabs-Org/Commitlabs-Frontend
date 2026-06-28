'use client';

import { useState, useEffect, useCallback } from 'react';
import { isCommandPaletteShortcut } from '@/lib/keyboardShortcuts';

/**
 * Manages global command palette open/close state and wires up the
 * Cmd+K / Ctrl+K keyboard shortcut.
 *
 * Returns `isOpen`, `open`, and `close` so consumers can also open
 * the palette programmatically (e.g. from a button in the nav).
 */
export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Cmd+K (macOS) or Ctrl+K (Windows / Linux)
      if (isCommandPaletteShortcut(event)) {
        event.preventDefault();
        toggle();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggle]);

  return { isOpen, open, close };
}
