import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useUnsavedChangesGuard } from './useUnsavedChangesGuard';

describe('useUnsavedChangesGuard', () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it('blocks App Router link navigation when the user declines confirmation', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderHook(() => useUnsavedChangesGuard(true, 'Leave this page?'));

    const link = document.createElement('a');
    link.href = '/another-page';
    document.body.append(link);
    const click = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      button: 0,
    });

    link.dispatchEvent(click);

    expect(window.confirm).toHaveBeenCalledWith('Leave this page?');
    expect(click.defaultPrevented).toBe(true);
  });

  it('allows App Router link navigation when the user confirms', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderHook(() => useUnsavedChangesGuard(true));

    const link = document.createElement('a');
    link.href = '/another-page';
    document.body.append(link);
    const click = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      button: 0,
    });

    link.dispatchEvent(click);

    expect(window.confirm).toHaveBeenCalledOnce();
    expect(click.defaultPrevented).toBe(false);
  });
});
