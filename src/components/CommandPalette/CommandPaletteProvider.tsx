'use client';

import React from 'react';
import { CommandPalette } from './CommandPalette';
import { useCommandPalette } from '@/hooks/useCommandPalette';

/**
 * Mounts the global command palette and wires up the Cmd/Ctrl-K shortcut.
 * Drop this once inside the root layout so it is available on every page.
 */
export function CommandPaletteProvider() {
  const { isOpen, close } = useCommandPalette();

  return <CommandPalette isOpen={isOpen} onClose={close} />;
}
