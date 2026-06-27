/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ToastItem from './ToastItem';
import { Toast, ToastSeverity } from './types';

describe('ToastItem', () => {
  const defaultToast: Toast = {
    id: 'test-id',
    severity: 'success',
    title: 'Success Title',
    description: 'Success Description',
    createdAt: Date.now(),
  };

  const mockOnDismiss = vi.fn();
  const mockOnPause = vi.fn();
  const mockOnResume = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders severity icons and matching styles for all severities', () => {
    const severities: ToastSeverity[] = ['success', 'error', 'info', 'warning'];

    severities.forEach((severity) => {
      const toast = { ...defaultToast, severity, title: `Title ${severity}` };
      const { unmount } = render(
        <ToastItem
          toast={toast}
          isVisible={true}
          reducedMotion={false}
          onDismiss={mockOnDismiss}
          onPause={mockOnPause}
          onResume={mockOnResume}
        />
      );

      // Verify severity class is present
      const toastEl = screen.getByRole('alert');
      expect(toastEl.className).toContain(`toast-${severity}`);
      expect(toastEl.className).toContain('toast-enter');

      // Verify title is rendered
      expect(screen.getByText(`Title ${severity}`)).toBeInTheDocument();

      unmount();
    });
  });

  it('supports unknown/fallback severity gracefully', () => {
    const toast = { ...defaultToast, severity: 'unknown' as any, title: 'Unknown Title' };
    render(
      <ToastItem
        toast={toast}
        isVisible={true}
        reducedMotion={false}
        onDismiss={mockOnDismiss}
        onPause={mockOnPause}
        onResume={mockOnResume}
      />
    );

    // Verify it doesn't crash and renders the title
    expect(screen.getByText('Unknown Title')).toBeInTheDocument();
    const toastEl = screen.getByRole('alert');
    expect(toastEl.className).toContain('toast-unknown');
  });

  it('does not render when isVisible is false', () => {
    render(
      <ToastItem
        toast={defaultToast}
        isVisible={false}
        reducedMotion={false}
        onDismiss={mockOnDismiss}
        onPause={mockOnPause}
        onResume={mockOnResume}
      />
    );

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('triggers onDismiss when the close button is clicked', () => {
    render(
      <ToastItem
        toast={defaultToast}
        isVisible={true}
        reducedMotion={false}
        onDismiss={mockOnDismiss}
        onPause={mockOnPause}
        onResume={mockOnResume}
      />
    );

    const closeBtn = screen.getByLabelText('Dismiss notification');
    fireEvent.click(closeBtn);
    expect(mockOnDismiss).toHaveBeenCalledTimes(1);
  });

  it('calls onPause/onResume on mouse hover events', () => {
    render(
      <ToastItem
        toast={defaultToast}
        isVisible={true}
        reducedMotion={false}
        onDismiss={mockOnDismiss}
        onPause={mockOnPause}
        onResume={mockOnResume}
      />
    );

    // Initial render causes either onPause or onResume call due to state initialization
    // Let's clear mocks after initial mount to test the hover actions explicitly.
    mockOnPause.mockClear();
    mockOnResume.mockClear();

    const toastEl = screen.getByRole('alert');

    // Hover Enter
    fireEvent.mouseEnter(toastEl);
    expect(mockOnPause).toHaveBeenCalledTimes(1);
    expect(mockOnResume).not.toHaveBeenCalled();

    mockOnPause.mockClear();
    mockOnResume.mockClear();

    // Hover Leave
    fireEvent.mouseLeave(toastEl);
    expect(mockOnResume).toHaveBeenCalledTimes(1);
    expect(mockOnPause).not.toHaveBeenCalled();
  });

  it('calls onPause/onResume on focus/blur events', () => {
    render(
      <ToastItem
        toast={defaultToast}
        isVisible={true}
        reducedMotion={false}
        onDismiss={mockOnDismiss}
        onPause={mockOnPause}
        onResume={mockOnResume}
      />
    );

    mockOnPause.mockClear();
    mockOnResume.mockClear();

    const toastEl = screen.getByRole('alert');

    // Focus
    fireEvent.focus(toastEl);
    expect(mockOnPause).toHaveBeenCalledTimes(1);
    expect(mockOnResume).not.toHaveBeenCalled();

    mockOnPause.mockClear();
    mockOnResume.mockClear();

    // Blur
    fireEvent.blur(toastEl);
    expect(mockOnResume).toHaveBeenCalledTimes(1);
    expect(mockOnPause).not.toHaveBeenCalled();
  });

  it('respects reducedMotion=true', () => {
    render(
      <ToastItem
        toast={defaultToast}
        isVisible={true}
        reducedMotion={true}
        onDismiss={mockOnDismiss}
        onPause={mockOnPause}
        onResume={mockOnResume}
      />
    );

    const toastEl = screen.getByRole('alert');
    expect(toastEl.className).toContain('toast-success');
    expect(toastEl.className).not.toContain('toast-enter');
  });

  it('monitors window focusin and focusout to pause/resume', () => {
    render(
      <ToastItem
        toast={defaultToast}
        isVisible={true}
        reducedMotion={false}
        onDismiss={mockOnDismiss}
        onPause={mockOnPause}
        onResume={mockOnResume}
      />
    );

    mockOnPause.mockClear();
    mockOnResume.mockClear();

    // Dispatch focusin event
    fireEvent(window, new Event('focusin'));
    expect(mockOnPause).toHaveBeenCalledTimes(1);

    mockOnPause.mockClear();

    // Dispatch focusout event
    fireEvent(window, new Event('focusout'));
    expect(mockOnResume).toHaveBeenCalledTimes(1);
  });

  it('detects active element inside toast on focusin/mount', () => {
    // Create a mock active element that is inside a toast container
    const dummyButton = document.createElement('button');
    dummyButton.setAttribute('data-toast', 'true');
    document.body.appendChild(dummyButton);

    const spyActiveElement = vi.spyOn(document, 'activeElement', 'get').mockReturnValue(dummyButton);

    render(
      <ToastItem
        toast={defaultToast}
        isVisible={true}
        reducedMotion={false}
        onDismiss={mockOnDismiss}
        onPause={mockOnPause}
        onResume={mockOnResume}
      />
    );

    // Since the activeElement is inside [data-toast], it should initialize as paused
    expect(mockOnPause).toHaveBeenCalled();

    spyActiveElement.mockRestore();
    document.body.removeChild(dummyButton);
  });
});
