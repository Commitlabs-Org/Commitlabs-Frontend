'use client';

import React from 'react';
import { useToast } from './ToastProvider';
import { ToastHistoryEntry, ToastSeverity } from './types';

/** Severity label used in the accessible list item description. */
const severityLabel: Record<ToastSeverity, string> = {
  success: 'Success',
  error: 'Error',
  info: 'Info',
  warning: 'Warning',
};

interface ToastHistoryItemProps {
  entry: ToastHistoryEntry;
  onMarkRead: (id: string) => void;
}

function ToastHistoryItem({ entry, onMarkRead }: ToastHistoryItemProps) {
  const date = new Date(entry.dismissedAt);
  const timeString = date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <li
      data-toast-history-item
      data-severity={entry.severity}
      data-read={entry.read}
      aria-label={`${severityLabel[entry.severity]}: ${entry.title}${entry.description ? ` — ${entry.description}` : ''}, dismissed at ${timeString}`}
    >
      <span className={`toast-history-badge toast-history-badge--${entry.severity}`} aria-hidden="true" />
      <div className="toast-history-content">
        <p className="toast-history-title">{entry.title}</p>
        {entry.description && (
          <p className="toast-history-description">{entry.description}</p>
        )}
        <time
          className="toast-history-time"
          dateTime={new Date(entry.dismissedAt).toISOString()}
        >
          {timeString}
        </time>
      </div>
      {!entry.read && (
        <button
          type="button"
          className="toast-history-mark-read"
          aria-label={`Mark "${entry.title}" as read`}
          onClick={() => onMarkRead(entry.id)}
        >
          Mark read
        </button>
      )}
    </li>
  );
}

export interface ToastHistoryProps {
  /** Maximum number of entries rendered. Defaults to all entries. */
  maxEntries?: number;
}

/**
 * ToastHistory renders the bounded history of dismissed client toasts.
 *
 * Place this anywhere inside `ToastProvider`. It integrates with the
 * notifications center by exposing unread counts through the shared context;
 * server-derived notifications are kept separate (source === "toast" filter).
 *
 * Accessibility: the list is wrapped in an `aria-label`ed region so keyboard
 * and assistive-technology users can navigate to it independently.
 */
export function ToastHistory({ maxEntries }: ToastHistoryProps) {
  const { history, clearHistory, markHistoryRead, markAllHistoryRead } = useToast();

  // Filter to client-toast entries only — never mix with server notifications.
  const entries = history
    .filter((e) => e.source === 'toast')
    .slice(0, maxEntries);

  const unreadCount = entries.filter((e) => !e.read).length;

  return (
    <section
      aria-label="Notification history"
      data-toast-history
    >
      <div className="toast-history-header">
        <h2 className="toast-history-heading">
          Notifications
          {unreadCount > 0 && (
            <span
              className="toast-history-unread-badge"
              aria-label={`${unreadCount} unread`}
            >
              {unreadCount}
            </span>
          )}
        </h2>
        <div className="toast-history-actions">
          {unreadCount > 0 && (
            <button
              type="button"
              className="toast-history-action-btn"
              onClick={markAllHistoryRead}
            >
              Mark all read
            </button>
          )}
          {entries.length > 0 && (
            <button
              type="button"
              className="toast-history-action-btn"
              onClick={clearHistory}
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="toast-history-empty" data-toast-history-empty>
          No notifications yet.
        </p>
      ) : (
        <ul
          className="toast-history-list"
          role="list"
          aria-label="Dismissed notifications"
        >
          {entries.map((entry) => (
            <ToastHistoryItem
              key={entry.id}
              entry={entry}
              onMarkRead={markHistoryRead}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

/** Returns the count of unread toast-history entries from context. */
export function useToastHistoryUnreadCount(): number {
  const { history } = useToast();
  return history.filter((e) => e.source === 'toast' && !e.read).length;
}
