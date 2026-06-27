// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { ToastProvider, useToast } from './ToastProvider';

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

const actionSpy = vi.fn();

function TestConsumer() {
  const toast = useToast();
  return React.createElement('div', null,
    React.createElement('button', { onClick: () => toast.success({ title: 'ok' }) }, 'success'),
    React.createElement('button', { onClick: () => toast.success({ title: 'short', duration: 1000 }) }, 'short success'),
    React.createElement('button', { onClick: () => toast.success({ title: 'actionable', action: { label: 'Undo', onClick: actionSpy } }) }, 'action success'),
    React.createElement('button', { onClick: () => toast.error({ title: 'bad' }) }, 'error'),
    React.createElement('button', { onClick: () => toast.info({ title: 'info' }) }, 'info'),
    React.createElement('button', { onClick: () => toast.warning({ title: 'warn' }) }, 'warning'),
    React.createElement('button', { onClick: () => toast.dismissAll() }, 'dismiss all')
  );
}

describe('ToastProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    actionSpy.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders children and exposes toast methods', () => {
    render(
      React.createElement(ToastProvider, null,
        React.createElement(TestConsumer, null)
      )
    );
    expect(screen.getByText('success')).toBeDefined();
  });

  it('enqueues and auto-dismisses a success toast', () => {
    render(
      React.createElement(ToastProvider, null,
        React.createElement(TestConsumer, null)
      )
    );

    act(() => screen.getByText('success').click());
    expect(screen.getByText('ok')).toBeDefined();

    act(() => vi.advanceTimersByTime(5000));
    expect(screen.queryByText('ok')).toBeNull();
  });

  it('renders no action button for toasts without an action', () => {
    render(
      React.createElement(ToastProvider, null,
        React.createElement(TestConsumer, null)
      )
    );

    act(() => screen.getByText('success').click());
    expect(screen.getByText('ok')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  it('invokes an action and dismisses the toast by default', async () => {
    render(
      React.createElement(ToastProvider, null,
        React.createElement(TestConsumer, null)
      )
    );

    act(() => screen.getByText('action success').click());
    expect(screen.getByText('actionable')).toBeDefined();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    });

    expect(actionSpy).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('actionable')).toBeNull();
  });

  it('pauses auto-dismiss while hovered and resumes with remaining time', () => {
    render(
      React.createElement(ToastProvider, null,
        React.createElement(TestConsumer, null)
      )
    );

    act(() => screen.getByText('short success').click());
    const toastElement = screen.getByText('short').closest('[data-toast]');
    expect(toastElement).not.toBeNull();

    act(() => vi.advanceTimersByTime(500));
    act(() => fireEvent.mouseEnter(toastElement as Element));
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText('short')).toBeDefined();

    act(() => fireEvent.mouseLeave(toastElement as Element));
    act(() => vi.advanceTimersByTime(499));
    expect(screen.getByText('short')).toBeDefined();

    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText('short')).toBeNull();
  });

  it('dismisses a toast manually', () => {
    render(
      React.createElement(ToastProvider, null,
        React.createElement(TestConsumer, null)
      )
    );

    act(() => screen.getByText('error').click());
    expect(screen.getByText('bad')).toBeDefined();

    act(() => screen.getByLabelText('Dismiss notification').click());
    expect(screen.queryByText('bad')).toBeNull();
  });

  it('dismisses all toasts', () => {
    render(
      React.createElement(ToastProvider, null,
        React.createElement(TestConsumer, null)
      )
    );

    act(() => screen.getByText('info').click());
    act(() => screen.getByText('warning').click());
    const toastTitles = document.querySelectorAll('.toast-title');
    expect(toastTitles.length).toBe(2);

    act(() => screen.getByText('dismiss all').click());
    expect(document.querySelectorAll('.toast-title').length).toBe(0);
  });

  it('caps visible toasts to max limit', () => {
    render(
      React.createElement(ToastProvider, null,
        React.createElement(TestConsumer, null)
      )
    );

    act(() => screen.getByText('success').click());
    act(() => screen.getByText('error').click());
    act(() => screen.getByText('info').click());
    act(() => screen.getByText('warning').click());

    const toastTitles = document.querySelectorAll('.toast-title');
    expect(toastTitles.length).toBeLessThanOrEqual(4);
  });

  it('announces toasts in live region', () => {
    render(
      React.createElement(ToastProvider, null,
        React.createElement(TestConsumer, null)
      )
    );

    act(() => screen.getByText('success').click());
    const status = document.querySelector('[role="status"]');
    expect(status?.getAttribute('aria-live')).toBe('assertive');
  });
});
