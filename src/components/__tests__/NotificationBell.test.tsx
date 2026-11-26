import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { NotificationBell } from '../NotificationBell';
import { NotificationProvider } from '../NotificationProvider';
import * as commitmentsModule from '@/lib/commitments';

describe('NotificationBell Component', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();

    // Default Notification mock
    (window as any).Notification = class MockNotification {
      static permission: NotificationPermission = 'default';
      static requestPermission = vi.fn().mockResolvedValue('granted');
      constructor(public title: string, public options?: NotificationOptions) {}
    };
  });

  it('bell label includes unread count', () => {
    // Mock commitments with 2 items that are matured
    vi.spyOn(commitmentsModule, 'loadCommitments').mockReturnValue({
      items: [
        {
          id: 'CMT-1',
          type: 'safe',
          asset: 'XLM',
          amount: '10000000',
          durationDays: 7,
          maxLoss: 2,
          penalty: 3,
          apy: 4.5,
          createdAt: 1000,
          status: 'matured',
          owner: 'GBUSER',
          txHash: null,
        },
        {
          id: 'CMT-2',
          type: 'balanced',
          asset: 'USDC',
          amount: '50000000',
          durationDays: 14,
          maxLoss: 8,
          penalty: 5,
          apy: 9,
          createdAt: 1000,
          status: 'matured',
          owner: 'GBUSER',
          txHash: null,
        },
      ],
      dropped: 0,
      corrupt: false,
      storageUnavailable: false,
    });

    render(
      <NotificationProvider>
        <NotificationBell />
      </NotificationProvider>,
    );

    const button = screen.getByRole('button', { name: /notifications \(2 unread\)/i });
    expect(button).toBeDefined();
    expect(button.getAttribute('aria-label')).toBe('Notifications (2 unread)');
  });

  it('bell label shows 0 unread when there are no unread notifications', () => {
    vi.spyOn(commitmentsModule, 'loadCommitments').mockReturnValue({
      items: [],
      dropped: 0,
      corrupt: false,
      storageUnavailable: false,
    });

    render(
      <NotificationProvider>
        <NotificationBell />
      </NotificationProvider>,
    );

    const button = screen.getByRole('button', { name: /notifications \(0 unread\)/i });
    expect(button).toBeDefined();
  });

  it('Notification permission requested only after clicking the toggle', async () => {
    render(
      <NotificationProvider>
        <NotificationBell />
      </NotificationProvider>,
    );

    // Initial render must not request permission
    expect(window.Notification.requestPermission).not.toHaveBeenCalled();

    // Open popover
    const bellBtn = screen.getByRole('button', { name: /notifications/i });
    fireEvent.click(bellBtn);

    // Permission still not requested just by opening popover
    expect(window.Notification.requestPermission).not.toHaveBeenCalled();

    // Toggle desktop alerts
    const toggle = screen.getByLabelText(/toggle desktop notifications/i);
    await act(async () => {
      fireEvent.click(toggle);
    });

    // Explicit user action triggers permission request
    expect(window.Notification.requestPermission).toHaveBeenCalledTimes(1);
  });

  it('axe passes for both closed and open states', async () => {
    const { container } = render(
      <NotificationProvider>
        <NotificationBell />
      </NotificationProvider>,
    );

    let results = await axe(container, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(results.violations).toEqual([]);

    // Open popover
    const bellBtn = screen.getByRole('button', { name: /notifications/i });
    fireEvent.click(bellBtn);

    results = await axe(container, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });
});
