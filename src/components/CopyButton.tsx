'use client';

import { useEffect, useRef, useState } from 'react';

interface CopyButtonProps {
  value: string;
  label?: string;
}

export function CopyButton({ value, label = 'Copy address' }: CopyButtonProps) {
  const [status, setStatus] = useState('');
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (resetTimerRef.current !== null) {
        clearTimeout(resetTimerRef.current);
      }
    },
    []
  );

  const copyValue = async () => {
    if (resetTimerRef.current !== null) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = value;
        textarea.setAttribute('readonly', '');
        textarea.setAttribute('aria-hidden', 'true');
        textarea.tabIndex = -1;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        try {
          textarea.select();
          if (!document.execCommand('copy')) {
            throw new Error('Copy command was unsuccessful');
          }
        } finally {
          textarea.remove();
        }
      }

      setStatus('Copied');
    } catch {
      setStatus('Copy failed');
    }

    resetTimerRef.current = setTimeout(() => {
      setStatus('');
      resetTimerRef.current = null;
    }, 2000);
  };

  return (
    <span className="copy-control">
      <button type="button" className="copy-btn" aria-label={label} onClick={copyValue}>
        Copy
      </button>
      <span className="copy-status" role="status" aria-live="polite" aria-atomic="true">
        {status}
      </span>
    </span>
  );
}
