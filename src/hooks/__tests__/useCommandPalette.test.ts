import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useCommandPalette } from '../useCommandPalette';

describe('useCommandPalette', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts with the palette closed', () => {
    const { result } = renderHook(() => useCommandPalette());
    expect(result.current.isOpen).toBe(false);
  });

  it('opens the palette when open() is called', () => {
    const { result } = renderHook(() => useCommandPalette());

    act(() => {
      result.current.open();
    });

    expect(result.current.isOpen).toBe(true);
  });

  it('closes the palette when close() is called', () => {
    const { result } = renderHook(() => useCommandPalette());

    act(() => {
      result.current.open();
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.close();
    });
    expect(result.current.isOpen).toBe(false);
  });

  it('toggles the palette on successive open/close calls', () => {
    const { result } = renderHook(() => useCommandPalette());

    act(() => result.current.open());
    expect(result.current.isOpen).toBe(true);

    act(() => result.current.close());
    expect(result.current.isOpen).toBe(false);

    act(() => result.current.open());
    expect(result.current.isOpen).toBe(true);
  });

  it('toggles the palette open via Cmd+K (metaKey)', () => {
    const { result } = renderHook(() => useCommandPalette());
    expect(result.current.isOpen).toBe(false);

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }),
      );
    });

    expect(result.current.isOpen).toBe(true);
  });

  it('toggles the palette open via Ctrl+K (ctrlKey)', () => {
    const { result } = renderHook(() => useCommandPalette());
    expect(result.current.isOpen).toBe(false);

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }),
      );
    });

    expect(result.current.isOpen).toBe(true);
  });

  it('closes the palette when Cmd+K is pressed a second time (toggle)', () => {
    const { result } = renderHook(() => useCommandPalette());

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }),
      );
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }),
      );
    });
    expect(result.current.isOpen).toBe(false);
  });

  it('does not toggle when an unrelated key is pressed', () => {
    const { result } = renderHook(() => useCommandPalette());

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'p', metaKey: true, bubbles: true }),
      );
    });

    expect(result.current.isOpen).toBe(false);
  });

  it('does not toggle when K is pressed without a modifier key', () => {
    const { result } = renderHook(() => useCommandPalette());

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'k', bubbles: true }),
      );
    });

    expect(result.current.isOpen).toBe(false);
  });

  it('removes the keydown listener on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useCommandPalette());
    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'keydown',
      expect.any(Function),
    );
  });

  it('does not respond to keyboard events after unmount', () => {
    const { result, unmount } = renderHook(() => useCommandPalette());

    unmount();

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }),
      );
    });

    // isOpen captured at unmount time — should still be false
    expect(result.current.isOpen).toBe(false);
  });
});
