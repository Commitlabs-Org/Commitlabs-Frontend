'use client';

import { useCallback } from 'react';
import { useToast } from '@/components/toast/ToastProvider';

interface UseShareLinkOptions {
  commitmentId: string;
  title?: string;
  text?: string;
}

type ShareMethod = 'web-share' | 'clipboard';

interface ShareResult {
  ok: boolean;
  method?: ShareMethod;
}

function getCommitmentShareUrl(commitmentId: string): string {
  const path = `/commitments/${encodeURIComponent(commitmentId)}`;

  if (typeof window === 'undefined') {
    return path;
  }

  return new URL(path, window.location.origin).toString();
}

async function copyToClipboard(url: string): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
    throw new Error('Clipboard API unavailable');
  }

  await navigator.clipboard.writeText(url);
}

export function useShareLink({
  commitmentId,
  title,
  text,
}: UseShareLinkOptions) {
  const toast = useToast();

  const shareLink = useCallback(async (): Promise<ShareResult> => {
    const url = getCommitmentShareUrl(commitmentId);
    const shareData: ShareData = {
      title: title ?? `Commitment ${commitmentId}`,
      text: text ?? 'View this Commitlabs commitment.',
      url,
    };

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        if (!navigator.canShare || navigator.canShare(shareData)) {
          await navigator.share(shareData);
          toast.success({
            title: 'Share sheet opened',
            description: 'Choose where to send this commitment link.',
          });

          return { ok: true, method: 'web-share' };
        }
      } catch {
        // Fall through to clipboard so unsupported or failed share attempts still work.
      }
    }

    try {
      await copyToClipboard(url);
      toast.success({
        title: 'Link copied',
        description: 'Commitment link copied to clipboard.',
      });

      return { ok: true, method: 'clipboard' };
    } catch {
      toast.error({
        title: 'Share unavailable',
        description: 'Could not share or copy this commitment link.',
      });

      return { ok: false };
    }
  }, [commitmentId, text, title, toast]);

  return {
    shareLink,
    shareUrl: getCommitmentShareUrl(commitmentId),
  };
}
