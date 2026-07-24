import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useShareLink } from '../useShareLink';

const toast = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
  dismiss: vi.fn(),
  dismissAll: vi.fn(),
};

vi.mock('@/components/toast/ToastProvider', () => ({
  useToast: () => toast,
}));

function setNavigatorShare(share?: ReturnType<typeof vi.fn>, canShare?: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, 'share', {
    configurable: true,
    value: share,
  });
  Object.defineProperty(navigator, 'canShare', {
    configurable: true,
    value: canShare,
  });
}

function setClipboard(writeText?: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: writeText ? { writeText } : undefined,
  });
}

describe('useShareLink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, '', '/commitments/old');
    setNavigatorShare(undefined, undefined);
    setClipboard(undefined);
  });

  it('builds a canonical commitment URL from the current origin', () => {
    const { result } = renderHook(() => useShareLink({ commitmentId: 'abc-123' }));

    expect(result.current.shareUrl).toBe(`${window.location.origin}/commitments/abc-123`);
  });

  it('uses the Web Share API when available', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const canShare = vi.fn().mockReturnValue(true);
    setNavigatorShare(share, canShare);

    const { result } = renderHook(() =>
      useShareLink({
        commitmentId: '42',
        title: 'Balanced Commitment #42',
      }),
    );

    await act(async () => {
      await expect(result.current.shareLink()).resolves.toEqual({
        ok: true,
        method: 'web-share',
      });
    });

    expect(share).toHaveBeenCalledWith({
      title: 'Balanced Commitment #42',
      text: 'View this Commitlabs commitment.',
      url: `${window.location.origin}/commitments/42`,
    });
    expect(toast.success).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Share sheet opened' }),
    );
  });

  it('falls back to clipboard copy when Web Share is unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard(writeText);

    const { result } = renderHook(() => useShareLink({ commitmentId: '99' }));

    await act(async () => {
      await expect(result.current.shareLink()).resolves.toEqual({
        ok: true,
        method: 'clipboard',
      });
    });

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/commitments/99`);
    expect(toast.success).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Link copied' }),
    );
  });

  it('announces failure without throwing when share and clipboard are unavailable', async () => {
    const share = vi.fn().mockRejectedValue(new Error('blocked'));
    setNavigatorShare(share, vi.fn().mockReturnValue(true));
    setClipboard(vi.fn().mockRejectedValue(new Error('denied')));

    const { result } = renderHook(() => useShareLink({ commitmentId: '100' }));

    await act(async () => {
      await expect(result.current.shareLink()).resolves.toEqual({ ok: false });
    });

    expect(toast.error).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Share unavailable' }),
    );
  });
});
