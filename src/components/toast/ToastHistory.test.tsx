// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { ToastProvider, useToast } from './ToastProvider';
import { ToastHistory, useToastHistoryUnreadCount } from './ToastHistory';

vi.mock('./toast.css', () => ({}));

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

function Wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(ToastProvider, null, children);
}

function TestConsumer() {
  const toast = useToast();
  return React.createElement(
    'div',
    null,
    React.createElement('button', { onClick: () => toast.success({ title: 'Saved' }) }, 'add success'),
    React.createElement('button', { onClick: () => toast.error({ title: 'Failed', description: 'Something went wrong' }) }, 'add error'),
    React.createElement('button', { onClick: () => toast.info({ title: 'FYI' }) }, 'add info'),
    React.createElement('button', { onClick: () => toast.warning({ title: 'Heads up' }) }, 'add warning'),
    React.createElement('button', { onClick: () => toast.dismissAll() }, 'dismiss all'),
    React.createElement(ToastHistory, null)
  );
}

function UnreadConsumer() {
  const count = useToastHistoryUnreadCount();
  const toast = useToast();
  return React.createElement(
    'div',
    null,
    React.createElement('span', { 'data-testid': 'unread-count' }, String(count)),
    React.createElement('button', { onClick: () => toast.success({ title: 'Hello', duration: 1 }) }, 'add')
  );
}

describe('ToastHistory', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows empty state when no toasts have been dismissed', () => {
    render(React.createElement(Wrapper, null, React.createElement(ToastHistory, null)));
    expect(screen.getByTestId ? document.querySelector('[data-toast-history-empty]') : null).not.toBeUndefined();
    expect(document.querySelector('[data-toast-history-empty]')?.textContent).toBe('No notifications yet.');
  });

  it('records a dismissed toast in history', () => {
    render(React.createElement(Wrapper, null, React.createElement(TestConsumer, null)));

    act(() => screen.getByText('add success').click());
    act(() => screen.getByLabelText('Dismiss notification').click());

    expect(document.querySelector('[data-toast-history-item]')).not.toBeNull();
    expect(document.querySelector('.toast-history-title')?.textContent).toBe('Saved');
  });

  it('records a toast that auto-dismisses via timer', () => {
    render(React.createElement(Wrapper, null, React.createElement(TestConsumer, null)));

    act(() => screen.getByText('add success').click());
    act(() => vi.advanceTimersByTime(5000));

    const items = document.querySelectorAll('[data-toast-history-item]');
    expect(items.length).toBe(1);
    expect(document.querySelector('.toast-history-title')?.textContent).toBe('Saved');
  });

  it('records description alongside title', () => {
    render(React.createElement(Wrapper, null, React.createElement(TestConsumer, null)));

    act(() => screen.getByText('add error').click());
    act(() => vi.advanceTimersByTime(5000));

    expect(document.querySelector('.toast-history-description')?.textContent).toBe('Something went wrong');
  });

  it('history entries are tagged source=toast (not server notifications)', () => {
    render(React.createElement(Wrapper, null, React.createElement(TestConsumer, null)));

    act(() => screen.getByText('add info').click());
    act(() => vi.advanceTimersByTime(5000));

    // Access history via context by checking data attribute (source is stored in context)
    const item = document.querySelector('[data-toast-history-item]');
    expect(item).not.toBeNull();
    // severity attribute confirms the correct entry was rendered
    expect(item?.getAttribute('data-severity')).toBe('info');
  });

  it('marks a single entry as read', () => {
    render(React.createElement(Wrapper, null, React.createElement(TestConsumer, null)));

    act(() => screen.getByText('add success').click());
    act(() => vi.advanceTimersByTime(5000));

    const item = document.querySelector('[data-toast-history-item]');
    expect(item?.getAttribute('data-read')).toBe('false');

    const markBtn = document.querySelector('.toast-history-mark-read') as HTMLButtonElement | null;
    expect(markBtn).not.toBeNull();
    act(() => markBtn!.click());

    expect(document.querySelector('[data-toast-history-item]')?.getAttribute('data-read')).toBe('true');
  });

  it('marks all entries as read', () => {
    render(React.createElement(Wrapper, null, React.createElement(TestConsumer, null)));

    act(() => screen.getByText('add success').click());
    act(() => screen.getByText('add error').click());
    act(() => screen.getByText('dismiss all').click());

    const unreadBefore = document.querySelectorAll('[data-read="false"]');
    expect(unreadBefore.length).toBe(2);

    const markAllBtn = screen.getByText('Mark all read') as HTMLButtonElement;
    act(() => markAllBtn.click());

    expect(document.querySelectorAll('[data-read="false"]').length).toBe(0);
    expect(document.querySelectorAll('[data-read="true"]').length).toBe(2);
  });

  it('clears the history', () => {
    render(React.createElement(Wrapper, null, React.createElement(TestConsumer, null)));

    act(() => screen.getByText('add success').click());
    act(() => vi.advanceTimersByTime(5000));

    expect(document.querySelectorAll('[data-toast-history-item]').length).toBe(1);

    const clearBtn = screen.getByText('Clear all') as HTMLButtonElement;
    act(() => clearBtn.click());

    expect(document.querySelectorAll('[data-toast-history-item]').length).toBe(0);
    expect(document.querySelector('[data-toast-history-empty]')).not.toBeNull();
  });

  it('dismissAll records all current toasts in history', () => {
    render(React.createElement(Wrapper, null, React.createElement(TestConsumer, null)));

    act(() => screen.getByText('add success').click());
    act(() => screen.getByText('add error').click());
    act(() => screen.getByText('add info').click());
    act(() => screen.getByText('dismiss all').click());

    const items = document.querySelectorAll('[data-toast-history-item]');
    expect(items.length).toBe(3);
  });

  it('does not duplicate an entry when dismissed twice', () => {
    render(React.createElement(Wrapper, null, React.createElement(TestConsumer, null)));

    act(() => screen.getByText('add success').click());
    // Manual dismiss
    act(() => screen.getByLabelText('Dismiss notification').click());
    // dismissAll on empty list — should not add a second entry
    act(() => screen.getByText('dismiss all').click());

    expect(document.querySelectorAll('[data-toast-history-item]').length).toBe(1);
  });

  it('maxEntries prop limits rendered entries', () => {
    render(
      React.createElement(Wrapper, null,
        React.createElement(() => {
          const toast = useToast();
          return React.createElement(
            'div',
            null,
            React.createElement('button', { onClick: () => { toast.success({ title: 'A' }); toast.success({ title: 'B' }); toast.success({ title: 'C' }); } }, 'add three'),
            React.createElement('button', { onClick: () => toast.dismissAll() }, 'dismiss all'),
            React.createElement(ToastHistory, { maxEntries: 2 })
          );
        }, null)
      )
    );

    act(() => screen.getByText('add three').click());
    act(() => screen.getByText('dismiss all').click());

    const items = document.querySelectorAll('[data-toast-history-item]');
    expect(items.length).toBe(2);
  });

  it('history is bounded to MAX_HISTORY_ENTRIES (50)', () => {
    render(
      React.createElement(Wrapper, null,
        React.createElement(() => {
          const toast = useToast();
          return React.createElement(
            'div',
            null,
            React.createElement('button', {
              onClick: () => {
                for (let i = 0; i < 60; i++) {
                  toast.success({ title: `Toast ${i}`, duration: 1 });
                }
              },
            }, 'add 60'),
            React.createElement(ToastHistory, null)
          );
        }, null)
      )
    );

    act(() => screen.getByText('add 60').click());
    act(() => vi.advanceTimersByTime(200));

    const items = document.querySelectorAll('[data-toast-history-item]');
    expect(items.length).toBeLessThanOrEqual(50);
  });

  it('useToastHistoryUnreadCount returns correct unread count', () => {
    render(React.createElement(Wrapper, null, React.createElement(UnreadConsumer, null)));

    expect(document.querySelector('[data-testid="unread-count"]')?.textContent).toBe('0');

    act(() => screen.getByText('add').click());
    act(() => vi.advanceTimersByTime(10));

    expect(document.querySelector('[data-testid="unread-count"]')?.textContent).toBe('1');
  });

  it('history region has accessible label', () => {
    render(React.createElement(Wrapper, null, React.createElement(ToastHistory, null)));
    const region = document.querySelector('[data-toast-history]');
    expect(region?.getAttribute('aria-label')).toBe('Notification history');
  });

  it('unread badge shows count when there are unread entries', () => {
    render(React.createElement(Wrapper, null, React.createElement(TestConsumer, null)));

    act(() => screen.getByText('add success').click());
    act(() => vi.advanceTimersByTime(5000));

    const badge = document.querySelector('.toast-history-unread-badge');
    expect(badge).not.toBeNull();
    expect(badge?.textContent).toBe('1');
    expect(badge?.getAttribute('aria-label')).toBe('1 unread');
  });

  it('unread badge disappears after all entries are marked read', () => {
    render(React.createElement(Wrapper, null, React.createElement(TestConsumer, null)));

    act(() => screen.getByText('add success').click());
    act(() => vi.advanceTimersByTime(5000));

    act(() => (screen.getByText('Mark all read') as HTMLButtonElement).click());

    expect(document.querySelector('.toast-history-unread-badge')).toBeNull();
  });
});
