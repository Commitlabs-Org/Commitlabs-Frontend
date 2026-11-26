'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useNotifications } from './NotificationProvider';

export function NotificationBell() {
  const {
    notifications,
    unreadNotifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    browserNotificationsEnabled,
    toggleBrowserNotifications,
    isBrowserSupported,
  } = useNotifications();

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close on Escape or click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="notification-bell-container" ref={containerRef} style={{ position: 'relative' }}>
      <button
        ref={buttonRef}
        type="button"
        className="btn btn-ghost notification-bell-button"
        aria-label={`Notifications (${unreadCount} unread)`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-controls="notification-inbox-popover"
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          position: 'relative',
          padding: '8px 12px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Bell SVG */}
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>

        {unreadCount > 0 && (
          <span
            className="notification-badge"
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              minWidth: '18px',
              height: '18px',
              padding: '0 4px',
              fontSize: '11px',
              fontWeight: 700,
              lineHeight: '18px',
              textAlign: 'center',
              borderRadius: '999px',
              background: 'var(--accent, #6366f1)',
              color: '#ffffff',
            }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          id="notification-inbox-popover"
          role="dialog"
          aria-label="Notification Inbox"
          className="card notification-inbox-popover"
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            width: '360px',
            maxWidth: '90vw',
            maxHeight: '480px',
            overflowY: 'auto',
            zIndex: 1000,
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
            padding: '16px',
          }}
        >
          <div className="row between mb" style={{ alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Notifications</h2>
            {unreadCount > 0 && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={markAllAsRead}
                style={{ fontSize: '0.8rem', padding: '4px 8px' }}
              >
                Mark all read
              </button>
            )}
          </div>

          {isBrowserSupported && (
            <div
              className="row between mb"
              style={{
                alignItems: 'center',
                padding: '8px 10px',
                background: 'var(--bg2, rgba(255, 255, 255, 0.05))',
                borderRadius: '6px',
                fontSize: '0.85rem',
              }}
            >
              <label htmlFor="browser-notifications-toggle" style={{ cursor: 'pointer', margin: 0 }}>
                Desktop alerts
              </label>
              <input
                id="browser-notifications-toggle"
                type="checkbox"
                checked={browserNotificationsEnabled}
                onChange={() => {
                  void toggleBrowserNotifications();
                }}
                aria-label="Toggle desktop notifications"
              />
            </div>
          )}

          {notifications.length === 0 ? (
            <div className="center pad-sm" style={{ padding: '24px 0', textAlign: 'center' }}>
              <p className="muted" style={{ margin: 0 }}>
                No notifications yet.
              </p>
            </div>
          ) : (
            <div className="stack" style={{ gap: '8px' }}>
              {notifications.map((item) => {
                const isUnread = unreadNotifications.some((u) => u.id === item.id);
                return (
                  <div
                    key={item.id}
                    className={`card pad-sm ${isUnread ? 'notification-unread' : ''}`}
                    style={{
                      padding: '10px',
                      background: isUnread ? 'var(--bg2, rgba(99, 102, 241, 0.08))' : 'transparent',
                      border: isUnread ? '1px solid var(--accent, #6366f1)' : '1px solid var(--line, #333)',
                      borderRadius: '8px',
                    }}
                  >
                    <div className="row between" style={{ alignItems: 'flex-start', gap: '8px' }}>
                      <div>
                        <div style={{ fontWeight: isUnread ? 600 : 500, fontSize: '0.9rem' }}>
                          {item.title}
                        </div>
                        <p className="muted small" style={{ margin: '4px 0', fontSize: '0.8rem' }}>
                          {item.message}
                        </p>
                      </div>
                      {isUnread && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => markAsRead(item.id)}
                          aria-label={`Mark ${item.title} as read`}
                          title="Mark as read"
                          style={{ padding: '2px 6px', fontSize: '0.75rem', flexShrink: 0 }}
                        >
                          &times;
                        </button>
                      )}
                    </div>
                    {item.link && (
                      <div className="mt" style={{ marginTop: '6px' }}>
                        <Link
                          href={item.link}
                          className="link small"
                          onClick={() => {
                            markAsRead(item.id);
                            setIsOpen(false);
                          }}
                        >
                          View details &rarr;
                        </Link>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
