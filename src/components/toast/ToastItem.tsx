'use client';

import React from 'react';
import { Toast as ToastType } from './types';
import './toast.css';

interface ToastItemProps {
  toast: ToastType;
  isVisible: boolean;
  reducedMotion: boolean;
  onDismiss: () => void;
  onPause: () => void;
  onResume: () => void;
}

const severityIcons: Record<string, React.ReactNode> = {
  success: (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="toast-icon">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
    </svg>
  ),
  error: (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="toast-icon">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
    </svg>
  ),
  info: (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="toast-icon">
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 13H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
    </svg>
  ),
  warning: (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="toast-icon">
      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
  ),
};

export default function ToastItem({
  toast,
  isVisible,
  reducedMotion,
  onDismiss,
  onPause,
  onResume,
}: ToastItemProps) {
  const [paused, setPaused] = React.useState(false);
  const handleActionClick = async () => {
    if (!toast.action) return;

    try {
      await toast.action.onClick();
    } catch (error) {
      console.error('Toast action failed', error);
    } finally {
      if (toast.action.dismiss !== false) {
        onDismiss();
      }
    }
  };

  React.useEffect(() => {
    if (paused) {
      onPause();
    } else {
      onResume();
    }
  }, [paused, onPause, onResume]);

  if (!isVisible) return null;

  return (
    <div
      data-toast
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className={`toast toast-${toast.severity}${reducedMotion ? '' : ' toast-enter'}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="toast-icon-wrapper" aria-hidden="true">
        {severityIcons[toast.severity]}
      </div>
      <div className="toast-content">
        <p className="toast-title">{toast.title}</p>
        {toast.description && <p className="toast-description">{toast.description}</p>}
        {toast.action && (
          <button
            type="button"
            className="toast-action"
            onClick={handleActionClick}
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        className="toast-close"
        aria-label="Dismiss notification"
        onClick={onDismiss}
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="toast-close-icon">
          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
        </svg>
      </button>
    </div>
  );
}
