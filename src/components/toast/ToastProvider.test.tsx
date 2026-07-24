// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { ToastProvider, useToast } from './ToastProvider';

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
    const viewport = document.querySelector('[data-toast-viewport]')!;
    expect(viewport.querySelector('.toast-title')?.textContent).toBe('ok');

    act(() => vi.advanceTimersByTime(5000));
    expect(viewport.querySelector('.toast-title')).toBeNull();
  });

  it('renders no action button for toasts without an action', () => {
    render(
      React.createElement(ToastProvider, null,
        React.createElement(TestConsumer, null)
      )
    );

    act(() => screen.getByText('success').click());
    const viewport = document.querySelector('[data-toast-viewport]')!;
    expect(viewport.querySelector('.toast-title')?.textContent).toBe('ok');
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  it('invokes an action and dismisses the toast by default', async () => {
    render(
      React.createElement(ToastProvider, null,
        React.createElement(TestConsumer, null)
      )
    );

    act(() => screen.getByText('action success').click());
    const viewport = document.querySelector('[data-toast-viewport]')!;
    expect(viewport.querySelector('.toast-title')?.textContent).toBe('actionable');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    });

    expect(actionSpy).toHaveBeenCalledTimes(1);
    expect(viewport.querySelector('.toast-title')).toBeNull();
  });

  it('pauses auto-dismiss while hovered and resumes with remaining time', () => {
    render(
      React.createElement(ToastProvider, null,
        React.createElement(TestConsumer, null)
      )
    );

    act(() => screen.getByText('short success').click());
    const toastElement = document.querySelector('[data-toast-viewport] [data-toast]');
    expect(toastElement).not.toBeNull();

    act(() => vi.advanceTimersByTime(500));
    act(() => fireEvent.mouseEnter(toastElement as Element));
    act(() => vi.advanceTimersByTime(1000));
    expect(document.querySelector('[data-toast-viewport] .toast-title')?.textContent).toBe('short');

    act(() => fireEvent.mouseLeave(toastElement as Element));
    act(() => vi.advanceTimersByTime(499));
    expect(document.querySelector('[data-toast-viewport] .toast-title')?.textContent).toBe('short');

    act(() => vi.advanceTimersByTime(1));
    expect(document.querySelector('[data-toast-viewport] .toast-title')).toBeNull();
  });

  it('dismisses a toast manually', () => {
    render(
      React.createElement(ToastProvider, null,
        React.createElement(TestConsumer, null)
      )
    );

    act(() => screen.getByText('error').click());
    const viewport = document.querySelector('[data-toast-viewport]')!;
    expect(viewport.querySelector('.toast-title')?.textContent).toBe('bad');

    act(() => screen.getByLabelText('Dismiss notification').click());
    expect(viewport.querySelector('.toast-title')).toBeNull();
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

  it('announces a success toast in the polite live region', () => {
    render(
      React.createElement(ToastProvider, null,
        React.createElement(TestConsumer, null)
      )
    );

    act(() => screen.getByText('success').click());

    const polite = document.querySelector('[data-toast-announcer="polite"]');
    const assertive = document.querySelector('[data-toast-announcer="assertive"]');
    expect(polite?.textContent).toBe('ok');
    expect(assertive?.textContent).toBe('');
  });

  it('announces an error toast in the assertive live region', () => {
    render(
      React.createElement(ToastProvider, null,
        React.createElement(TestConsumer, null)
      )
    );

    act(() => screen.getByText('error').click());

    const polite = document.querySelector('[data-toast-announcer="polite"]');
    const assertive = document.querySelector('[data-toast-announcer="assertive"]');
    expect(assertive?.textContent).toBe('bad');
    expect(polite?.textContent).toBe('');
  });

  it('announces info and warning toasts in the polite region', () => {
    render(
      React.createElement(ToastProvider, null,
        React.createElement(TestConsumer, null)
      )
    );

    act(() => screen.getByText('info').click());
    expect(document.querySelector('[data-toast-announcer="polite"]')?.textContent).toBe('info');

    act(() => screen.getByText('warning').click());
    expect(document.querySelector('[data-toast-announcer="polite"]')?.textContent).toBe('warn');
    expect(document.querySelector('[data-toast-announcer="assertive"]')?.textContent).toBe('');
  });

  it('clears the opposing region when severity changes', () => {
    render(
      React.createElement(ToastProvider, null,
        React.createElement(TestConsumer, null)
      )
    );

    act(() => screen.getByText('error').click());
    expect(document.querySelector('[data-toast-announcer="assertive"]')?.textContent).toBe('bad');

    act(() => screen.getByText('success').click());
    expect(document.querySelector('[data-toast-announcer="polite"]')?.textContent).toBe('ok');
    expect(document.querySelector('[data-toast-announcer="assertive"]')?.textContent).toBe('');
  });

  it('polite announcer has aria-live="polite" and assertive has aria-live="assertive"', () => {
    render(
      React.createElement(ToastProvider, null,
        React.createElement(TestConsumer, null)
      )
    );

    const polite = document.querySelector('[data-toast-announcer="polite"]');
    const assertive = document.querySelector('[data-toast-announcer="assertive"]');
    expect(polite?.getAttribute('aria-live')).toBe('polite');
    expect(assertive?.getAttribute('aria-live')).toBe('assertive');
  });

  it('announcer regions are visually hidden', () => {
    render(
      React.createElement(ToastProvider, null,
        React.createElement(TestConsumer, null)
      )
    );

    const polite = document.querySelector('[data-toast-announcer="polite"]') as HTMLElement | null;
    expect(polite?.style.position).toBe('absolute');
    expect(polite?.style.width).toBe('1px');
    expect(polite?.style.height).toBe('1px');
    expect(polite?.style.overflow).toBe('hidden');
  });
});
