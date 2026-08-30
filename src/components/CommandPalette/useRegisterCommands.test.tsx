/**
 * @vitest-environment happy-dom
 */

import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import {
  CommandPaletteProvider,
  useCommandPalette,
  useRegisterCommands,
} from '@/components/CommandPalette/CommandPaletteProvider';
import type { CommandItem } from '@/components/CommandPalette/types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  return <CommandPaletteProvider>{children}</CommandPaletteProvider>;
}

function labelsOf(commands: CommandItem[]): string[] {
  return commands.map((c) => c.label);
}

describe('useRegisterCommands', () => {
  afterEach(() => {
    cleanup();
  });

  it('includes the static navigation commands by default', () => {
    const { result } = renderHook(() => useCommandPalette(), { wrapper });
    expect(labelsOf(result.current.commands)).toEqual(
      expect.arrayContaining(['Go to Analytics', 'Create a commitment']),
    );
  });

  it('registers commands on mount and merges them with the static set', () => {
    const command: CommandItem = { id: 'page:foo', label: 'Do the foo thing', run: vi.fn() };

    const { result } = renderHook(
      () => {
        const palette = useCommandPalette();
        useRegisterCommands([command]);
        return palette;
      },
      { wrapper },
    );

    expect(labelsOf(result.current.commands)).toContain('Do the foo thing');
  });

  it('unregisters commands automatically on unmount', () => {
    const command: CommandItem = { id: 'page:bar', label: 'Do the bar thing', run: vi.fn() };

    const { result, unmount } = renderHook(
      () => {
        const palette = useCommandPalette();
        useRegisterCommands([command]);
        return palette;
      },
      { wrapper },
    );

    expect(labelsOf(result.current.commands)).toContain('Do the bar thing');

    unmount();

    const { result: afterUnmount } = renderHook(() => useCommandPalette(), { wrapper });
    expect(labelsOf(afterUnmount.current.commands)).not.toContain('Do the bar thing');
  });

  it('dedupes by id -- a later registration with the same id replaces the earlier one', () => {
    const { result } = renderHook(() => useCommandPalette(), { wrapper });

    act(() => {
      result.current.registerCommands([{ id: 'dup', label: 'First version', run: vi.fn() }]);
    });
    expect(labelsOf(result.current.commands)).toContain('First version');

    act(() => {
      result.current.registerCommands([{ id: 'dup', label: 'Second version', run: vi.fn() }]);
    });

    const labels = labelsOf(result.current.commands);
    expect(labels).toContain('Second version');
    expect(labels).not.toContain('First version');
    expect(result.current.commands.filter((c) => c.id === 'dup')).toHaveLength(1);
  });

  it('supports multiple components registering commands simultaneously', () => {
    const commandA: CommandItem = { id: 'a', label: 'Command A', run: vi.fn() };
    const commandB: CommandItem = { id: 'b', label: 'Command B', run: vi.fn() };

    function useTwoRegistrants() {
      const palette = useCommandPalette();
      useRegisterCommands([commandA]);
      useRegisterCommands([commandB]);
      return palette;
    }

    const { result } = renderHook(() => useTwoRegistrants(), { wrapper });

    const labels = labelsOf(result.current.commands);
    expect(labels).toContain('Command A');
    expect(labels).toContain('Command B');
  });

  it('registerCommands returns an unregister function that removes exactly those ids', () => {
    const { result } = renderHook(() => useCommandPalette(), { wrapper });

    let unregister: () => void = () => {};
    act(() => {
      unregister = result.current.registerCommands([
        { id: 'manual-1', label: 'Manual one', run: vi.fn() },
      ]);
    });

    expect(labelsOf(result.current.commands)).toContain('Manual one');

    act(() => {
      unregister();
    });

    expect(labelsOf(result.current.commands)).not.toContain('Manual one');
  });

  it('open/close/toggle control isOpen', () => {
    const { result } = renderHook(() => useCommandPalette(), { wrapper });
    expect(result.current.isOpen).toBe(false);

    act(() => result.current.open());
    expect(result.current.isOpen).toBe(true);

    act(() => result.current.close());
    expect(result.current.isOpen).toBe(false);

    act(() => result.current.toggle());
    expect(result.current.isOpen).toBe(true);
  });

  it('throws when useCommandPalette is used outside a provider', () => {
    const { result } = renderHook(() => {
      try {
        useCommandPalette();
        return null;
      } catch (err) {
        return err instanceof Error ? err.message : String(err);
      }
    });
    expect(result.current).toBe('useCommandPalette must be used within a CommandPaletteProvider');
  });
});
