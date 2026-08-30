'use client';

import { useCallback, useState } from 'react';
import { useToast } from '@/components/toast/ToastProvider';

interface UseShareLinkOptions {
  commitmentId: string;
  title: string;
  text?: string;
}

interface UseShareLinkReturn {
  shareLink: () => Promise<void>;
  isSharing: boolean;
}

/**
 * Generates a shareable URL for a commitment detail page and copies it
 * to the clipboard. Falls back gracefully when the Clipboard API is
 * unavailable.
 */
export function useShareLink({ commitmentId, title, text }: UseShareLinkOptions): UseShareLinkReturn {
  const [isSharing, setIsSharing] = useState(false);
  const { success, error: showError } = useToast();

  const shareLink = useCallback(async () => {
    setIsSharing(true);
    try {
      const url = `${window.location.origin}/commitments/${commitmentId}`;
      if (navigator.share) {
        await navigator.share({ title, text: text ?? title, url });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        success({
          title: 'Link copied',
          description: 'Commitment link has been copied to your clipboard.',
        });
      } else {
        success({
          title: 'Share link',
          description: url,
        });
      }
    } catch {
      showError({
        title: 'Share failed',
        description: 'Unable to share or copy the link. Please try again.',
      });
    } finally {
      setIsSharing(false);
    }
  }, [commitmentId, title, text, success, showError]);

  return { shareLink, isSharing };
}
