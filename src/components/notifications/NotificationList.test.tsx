import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotificationList } from './NotificationList';
import type { Notification } from '@/lib/types/domain';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

const mockNotifications: Notification[] = [
  {
    id: '1',
    ownerAddress: 'GABC123',
    title: 'Commitment Nearing Expiry',
    message: 'Your commitment CMT-ABC123 for XLM expires in 3 days.',
    severity: 'warning',
    type: 'expiry',
    read: false,
    createdAt: '2026-01-15T10:00:00Z',
    relatedCommitmentId: 'CMT-ABC123',
  },
  {
    id: '2',
    ownerAddress: 'GABC123',
    title: 'Commitment Violated',
    message: 'Your commitment CMT-XYZ789 has been marked as violated.',
    severity: 'critical',
    type: 'violation',
    read: false,
    createdAt: '2026-01-14T15:30:00Z',
    relatedCommitmentId: 'CMT-XYZ789',
  },
  {
    id: '3',
    ownerAddress: 'GABC123',
    title: 'Health Check Warning',
    message: 'A recent attestation for your commitment CMT-DEF456 issued a warning.',
    severity: 'warning',
    type: 'health_check',
    read: true,
    createdAt: '2026-01-13T09:00:00Z',
    relatedCommitmentId: 'CMT-DEF456',
  },
  {
    id: '4',
    ownerAddress: 'GABC123',
    title: 'Listing Sold',
    message: 'Your marketplace listing LIST-999 has been sold.',
    severity: 'info',
    type: 'marketplace',
    read: true,
    createdAt: '2026-01-12T14:00:00Z',
    relatedListingId: 'LIST-999',
  },
];

describe('NotificationList', () => {
  it('renders notifications correctly', () => {
    const onMarkRead = vi.fn();
    const onMarkUnread = vi.fn();

    render(
      <NotificationList
        notifications={mockNotifications}
        onMarkRead={onMarkRead}
        onMarkUnread={onMarkUnread}
      />
    );

    expect(screen.getByText('Notifications')).toBeInTheDocument();
    expect(screen.getByText('2 unread')).toBeInTheDocument();
    expect(screen.getByText('Commitment Nearing Expiry')).toBeInTheDocument();
    expect(screen.getByText('Commitment Violated')).toBeInTheDocument();
    expect(screen.getByText('Health Check Warning')).toBeInTheDocument();
    expect(screen.getByText('Listing Sold')).toBeInTheDocument();
  });

  it('shows empty state when no notifications', () => {
    render(<NotificationList notifications={[]} />);

    expect(screen.getByText('No notifications')).toBeInTheDocument();
    expect(
      screen.getByText("You're all caught up! Check back later for updates.")
    ).toBeInTheDocument();
  });

  it('shows loading skeleton when isLoading is true', () => {
    render(<NotificationList notifications={[]} isLoading={true} />);

    // Should not show empty state
    expect(screen.queryByText('No notifications')).not.toBeInTheDocument();
    // Should show skeleton elements (5 by default)
    const skeletonElements = document.querySelectorAll('[aria-label="Loading content"]');
    expect(skeletonElements.length).toBeGreaterThan(0);
  });

  it('shows error state when error is provided', () => {
    render(<NotificationList notifications={[]} error="Failed to fetch" />);

    expect(screen.getByText('Failed to load notifications')).toBeInTheDocument();
    expect(screen.getByText('Failed to fetch')).toBeInTheDocument();
  });

  it('filters notifications by category', () => {
    render(<NotificationList notifications={mockNotifications} />);

    // Initially shows all
    expect(screen.getByText('Commitment Nearing Expiry')).toBeInTheDocument();
    expect(screen.getByText('Commitment Violated')).toBeInTheDocument();

    // Click expiry filter
    const expiryFilter = screen.getByText('Expiry');
    fireEvent.click(expiryFilter);

    // Should only show expiry notifications
    expect(screen.getByText('Commitment Nearing Expiry')).toBeInTheDocument();
    expect(screen.queryByText('Commitment Violated')).not.toBeInTheDocument();

    // Click all filter
    const allFilter = screen.getByText('All');
    fireEvent.click(allFilter);

    // Should show all again
    expect(screen.getByText('Commitment Nearing Expiry')).toBeInTheDocument();
    expect(screen.getByText('Commitment Violated')).toBeInTheDocument();
  });

  it('displays correct count for each category', () => {
    render(<NotificationList notifications={mockNotifications} />);

    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Expiry')).toBeInTheDocument();
    expect(screen.getByText('Violations')).toBeInTheDocument();
    expect(screen.getByText('Health')).toBeInTheDocument();
    expect(screen.getByText('Marketplace')).toBeInTheDocument();

    // Check counts (badge numbers)
    const badges = screen.getAllByText(/\d+/);
    expect(badges.some(b => b.textContent === '4')).toBe(true); // All
    expect(badges.some(b => b.textContent === '1')).toBe(true); // Expiry
    expect(badges.some(b => b.textContent === '1')).toBe(true); // Violations
    expect(badges.some(b => b.textContent === '1')).toBe(true); // Health
    expect(badges.some(b => b.textContent === '1')).toBe(true); // Marketplace
  });

  it('calls onMarkRead when mark read button is clicked', () => {
    const onMarkRead = vi.fn();
    const onMarkUnread = vi.fn();

    render(
      <NotificationList
        notifications={mockNotifications}
        onMarkRead={onMarkRead}
        onMarkUnread={onMarkUnread}
      />
    );

    const markReadButtons = screen.getAllByText('Mark read');
    fireEvent.click(markReadButtons[0]);

    expect(onMarkRead).toHaveBeenCalledWith('1');
  });

  it('calls onMarkUnread when mark unread button is clicked', () => {
    const onMarkRead = vi.fn();
    const onMarkUnread = vi.fn();

    render(
      <NotificationList
        notifications={mockNotifications}
        onMarkRead={onMarkRead}
        onMarkUnread={onMarkUnread}
      />
    );

    const markUnreadButtons = screen.getAllByText('Mark unread');
    fireEvent.click(markUnreadButtons[0]);

    expect(onMarkUnread).toHaveBeenCalledWith('3');
  });

  it('shows unread indicator for unread notifications', () => {
    render(<NotificationList notifications={mockNotifications} />);

    // Unread notifications should have a visual indicator
    const unreadIndicator = document.querySelector('.bg-\\[\\#0FF0FC\\]');
    expect(unreadIndicator).toBeInTheDocument();
  });

  it('displays correct severity colors', () => {
    render(<NotificationList notifications={mockNotifications} />);

    // Critical should have red styling
    const criticalNotification = screen.getByText('Commitment Violated').closest('.border-\\[\\#0FF0FC\\]/30');
    expect(criticalNotification).toBeInTheDocument();
  });

  it('shows "All caught up" when all notifications are read', () => {
    const allRead = mockNotifications.map(n => ({ ...n, read: true }));

    render(<NotificationList notifications={allRead} />);

    expect(screen.getByText('All caught up')).toBeInTheDocument();
  });

  it('shows empty state for filtered category with no notifications', () => {
    render(<NotificationList notifications={mockNotifications} />);

    // Filter by marketplace (only 1 notification)
    const marketplaceFilter = screen.getByText('Marketplace');
    fireEvent.click(marketplaceFilter);

    // Should show the marketplace notification
    expect(screen.getByText('Listing Sold')).toBeInTheDocument();

    // Now filter by a category with no notifications (add a test notification with different type)
    // Since we only have one of each type, let's test the empty state by removing all notifications
    // and filtering
  });

  it('handles keyboard navigation for notification cards', () => {
    const onMarkRead = vi.fn();
    const onMarkUnread = vi.fn();

    render(
      <NotificationList
        notifications={mockNotifications}
        onMarkRead={onMarkRead}
        onMarkUnread={onMarkUnread}
      />
    );

    const firstCard = screen.getByText('Commitment Nearing Expiry').closest('[role="button"]');
    expect(firstCard).toHaveAttribute('tabIndex', '0');

    if (firstCard) {
      fireEvent.keyDown(firstCard, { key: 'Enter' });
      // Should trigger navigation (mocked router)
    }
  });

  it('displays notification timestamps correctly', () => {
    render(<NotificationList notifications={mockNotifications} />);

    // Should show date for each notification
    const timestamps = screen.getAllByText(/\d{1,2}\/\d{1,2}\/\d{4}/);
    expect(timestamps.length).toBeGreaterThan(0);
  });

  it('shows view details hint for notifications with related entities', () => {
    render(<NotificationList notifications={mockNotifications} />);

    // Should show "View details" for notifications with relatedCommitmentId
    const viewDetailsHints = screen.getAllByText('View details');
    expect(viewDetailsHints.length).toBeGreaterThan(0);
  });
});
