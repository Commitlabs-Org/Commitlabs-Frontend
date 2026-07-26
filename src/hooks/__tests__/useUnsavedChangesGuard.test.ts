import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fire a popstate event as the browser would after history.go() / back(). */
function firePopState() {
  window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
}

/** Create and dispatch a click on a plain <a> element with the given href. */
function clickAnchor(href: string, target?: string): HTMLAnchorElement {
  const a = document.createElement('a');
  a.href = href;
  if (target) a.target = target;
  document.body.appendChild(a);
  a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  document.body.removeChild(a);
  return a;
}

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.spyOn(window, 'confirm').mockReturnValue(false);
  vi.spyOn(history, 'pushState');
  vi.spyOn(history, 'go');
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Dirty-state tracking (existing behaviour)
// ---------------------------------------------------------------------------

describe('dirty-state tracking', () => {
  it('is not dirty on mount', () => {
    const { result } = renderHook(() =>
      useUnsavedChangesGuard({ a: 1, b: 2 }),
    );
    expect(result.current.isDirty).toBe(false);
  });

  it('becomes dirty when state changes', () => {
    const { result, rerender } = renderHook(
      ({ state }: { state: Record<string, number> }) =>
        useUnsavedChangesGuard(state),
      { initialProps: { state: { a: 1, b: 2 } } },
    );

    rerender({ state: { a: 1, b: 3 } });
    expect(result.current.isDirty).toBe(true);
  });

  it('goes back to clean after resetBaseline', () => {
    const { result, rerender } = renderHook(
      ({ state }: { state: Record<string, number> }) =>
        useUnsavedChangesGuard(state),
      { initialProps: { state: { a: 1, b: 2 } } },
    );

    rerender({ state: { a: 1, b: 3 } });
    expect(result.current.isDirty).toBe(true);

    act(() => result.current.resetBaseline());
    expect(result.current.isDirty).toBe(false);
  });

  it('stays dirty after resetBaseline if state is changed again', () => {
    const { result, rerender } = renderHook(
      ({ state }: { state: Record<string, number> }) =>
        useUnsavedChangesGuard(state),
      { initialProps: { state: { a: 1 } } },
    );

    rerender({ state: { a: 2 } });
    act(() => result.current.resetBaseline());
    expect(result.current.isDirty).toBe(false);

    rerender({ state: { a: 3 } });
    expect(result.current.isDirty).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// beforeunload guard
// ---------------------------------------------------------------------------

describe('beforeunload guard', () => {
  it('calls preventDefault and sets returnValue when dirty', () => {
    const { rerender } = renderHook(
      ({ state }: { state: Record<string, number> }) =>
        useUnsavedChangesGuard(state),
      { initialProps: { state: { a: 1 } } },
    );

    rerender({ state: { a: 2 } }); // make dirty

    const event = new Event('beforeunload') as BeforeUnloadEvent;
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    act(() => window.dispatchEvent(event));

    expect(preventDefaultSpy).toHaveBeenCalled();
    // jsdom sets returnValue to true when preventDefault() is called on
    // BeforeUnloadEvent; real browsers set it to ''. Either way the guard
    // fired — we just verify it is truthy.
    expect(event.returnValue).toBeTruthy();
  });

  it('does NOT call preventDefault when not dirty', () => {
    renderHook(() => useUnsavedChangesGuard({ a: 1 }));

    const event = new Event('beforeunload') as BeforeUnloadEvent;
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    act(() => window.dispatchEvent(event));

    expect(preventDefaultSpy).not.toHaveBeenCalled();
  });

  it('removes the beforeunload listener on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useUnsavedChangesGuard({ a: 1 }));
    unmount();
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'beforeunload',
      expect.any(Function),
    );
  });
});

// ---------------------------------------------------------------------------
// popstate (back/forward) guard
// ---------------------------------------------------------------------------

describe('popstate guard', () => {
  it('pushes a sentinel history entry on mount', () => {
    renderHook(() => useUnsavedChangesGuard({ a: 1 }));
    expect(history.pushState).toHaveBeenCalledWith(null, '');
  });

  it('does nothing on popstate when not dirty', () => {
    renderHook(() => useUnsavedChangesGuard({ a: 1 }));
    act(() => firePopState());
    // confirm should never be shown when clean
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it('shows confirm dialog on popstate when dirty', () => {
    const { rerender } = renderHook(
      ({ state }: { state: Record<string, number> }) =>
        useUnsavedChangesGuard(state),
      { initialProps: { state: { a: 1 } } },
    );

    rerender({ state: { a: 2 } }); // make dirty
    act(() => firePopState());

    expect(window.confirm).toHaveBeenCalledWith(
      'You have unsaved changes. Are you sure you want to leave?',
    );
  });

  it('stays on page (re-pushes sentinel) when user cancels', () => {
    vi.mocked(window.confirm).mockReturnValue(false);

    const { rerender } = renderHook(
      ({ state }: { state: Record<string, number> }) =>
        useUnsavedChangesGuard(state),
      { initialProps: { state: { a: 1 } } },
    );

    rerender({ state: { a: 2 } });
    // Clear calls from mount
    vi.mocked(history.pushState).mockClear();

    act(() => firePopState());

    // Should push sentinel again to keep guard active
    expect(history.pushState).toHaveBeenCalledWith(null, '');
    // Should NOT navigate back
    expect(history.go).not.toHaveBeenCalled();
  });

  it('navigates away when user confirms', () => {
    vi.mocked(window.confirm).mockReturnValue(true);

    const { rerender } = renderHook(
      ({ state }: { state: Record<string, number> }) =>
        useUnsavedChangesGuard(state),
      { initialProps: { state: { a: 1 } } },
    );

    rerender({ state: { a: 2 } });
    act(() => firePopState());

    // history.go(-2) = undo sentinel push + perform original navigation
    expect(history.go).toHaveBeenCalledWith(-2);
  });

  it('removes popstate listener on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useUnsavedChangesGuard({ a: 1 }));
    unmount();
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'popstate',
      expect.any(Function),
    );
  });
});

// ---------------------------------------------------------------------------
// Link-click guard
// ---------------------------------------------------------------------------

describe('link-click guard', () => {
  it('does nothing on link click when not dirty', () => {
    renderHook(() => useUnsavedChangesGuard({ a: 1 }));
    // Clicking a link when clean should not trigger confirm
    act(() => clickAnchor('/other-page'));
    expect(window.confirm).not.toHaveBeenCalled();
  });

  it('shows confirm dialog when a link is clicked and state is dirty', () => {
    const { rerender } = renderHook(
      ({ state }: { state: Record<string, number> }) =>
        useUnsavedChangesGuard(state),
      { initialProps: { state: { a: 1 } } },
    );

    rerender({ state: { a: 2 } });
    act(() => clickAnchor('/other-page'));

    expect(window.confirm).toHaveBeenCalledWith(
      'You have unsaved changes. Are you sure you want to leave?',
    );
  });

  it('prevents navigation when user cancels on link click', () => {
    vi.mocked(window.confirm).mockReturnValue(false);

    const { rerender } = renderHook(
      ({ state }: { state: Record<string, number> }) =>
        useUnsavedChangesGuard(state),
      { initialProps: { state: { a: 1 } } },
    );

    rerender({ state: { a: 2 } });

    const a = document.createElement('a');
    a.href = '/other-page';
    document.body.appendChild(a);

    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });
    const preventDefaultSpy = vi.spyOn(clickEvent, 'preventDefault');

    act(() => a.dispatchEvent(clickEvent));

    expect(preventDefaultSpy).toHaveBeenCalled();
    document.body.removeChild(a);
  });

  it('allows navigation when user confirms on link click', () => {
    vi.mocked(window.confirm).mockReturnValue(true);

    const { rerender } = renderHook(
      ({ state }: { state: Record<string, number> }) =>
        useUnsavedChangesGuard(state),
      { initialProps: { state: { a: 1 } } },
    );

    rerender({ state: { a: 2 } });

    const a = document.createElement('a');
    a.href = '/other-page';
    document.body.appendChild(a);

    const clickEvent = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
    });
    const preventDefaultSpy = vi.spyOn(clickEvent, 'preventDefault');

    act(() => a.dispatchEvent(clickEvent));

    expect(preventDefaultSpy).not.toHaveBeenCalled();
    document.body.removeChild(a);
  });

  it('ignores hash-only links when dirty', () => {
    const { rerender } = renderHook(
      ({ state }: { state: Record<string, number> }) =>
        useUnsavedChangesGuard(state),
      { initialProps: { state: { a: 1 } } },
    );

    rerender({ state: { a: 2 } });
    act(() => clickAnchor('#section'));

    expect(window.confirm).not.toHaveBeenCalled();
  });

  it('ignores _blank target links when dirty', () => {
    const { rerender } = renderHook(
      ({ state }: { state: Record<string, number> }) =>
        useUnsavedChangesGuard(state),
      { initialProps: { state: { a: 1 } } },
    );

    rerender({ state: { a: 2 } });
    act(() => clickAnchor('/other-page', '_blank'));

    expect(window.confirm).not.toHaveBeenCalled();
  });

  it('ignores clicks on non-anchor elements', () => {
    const { rerender } = renderHook(
      ({ state }: { state: Record<string, number> }) =>
        useUnsavedChangesGuard(state),
      { initialProps: { state: { a: 1 } } },
    );

    rerender({ state: { a: 2 } });

    const button = document.createElement('button');
    document.body.appendChild(button);
    act(() =>
      button.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true }),
      ),
    );
    document.body.removeChild(button);

    expect(window.confirm).not.toHaveBeenCalled();
  });

  it('removes click listener on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
    const { unmount } = renderHook(() => useUnsavedChangesGuard({ a: 1 }));
    unmount();
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'click',
      expect.any(Function),
      true,
    );
  });
});
