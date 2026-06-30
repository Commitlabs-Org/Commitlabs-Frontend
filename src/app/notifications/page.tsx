'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { NotificationList } from '@/components/notifications/NotificationList';
import { AppShellLayout } from '@/components/shell/AppShellLayout';
import type { Notification } from '@/lib/types/domain';

export default function NotificationsPage() {
  const { address, sessionToken, authenticated } = useWallet();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [readState, setReadState] = useState<Record<string, boolean>>({});

  // Fetch notifications from API
  const fetchNotifications = useCallback(async () => {
    if (!address) return;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        ownerAddress: address,
        page: '1',
        pageSize: '50',
      });

      const response = await fetch(`/api/notifications?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch notifications: ${response.statusText}`);
      }

      const data = await response.json();
      const items = data.data?.items || data.items || [];

      // Merge with local read state
      const mergedNotifications = items.map((n: Notification) => ({
        ...n,
        read: readState[n.id] ?? n.read,
      }));

      setNotifications(mergedNotifications);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      console.error('Failed to fetch notifications:', err);
    } finally {
      setIsLoading(false);
    }
  }, [address, readState]);

  // Persist read state to user preferences
  const persistReadState = useCallback(async (notificationId: string, read: boolean) => {
    if (!sessionToken || !authenticated) return;

    try {
      // Get current preferences
      const prefsResponse = await fetch('/api/user/preferences', {
        headers: {
          Authorization: `Bearer ${sessionToken}`,
        },
      });

      if (!prefsResponse.ok) return;

      const prefsData = await prefsResponse.json();
      const currentPrefs = prefsData.data?.preferences || prefsData.preferences || {};

      // Update lastSeenNotification timestamp
      const updatedPrefs = {
        ...currentPrefs,
        lastSeenNotification: new Date().toISOString(),
      };

      await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedPrefs),
      });
    } catch (err) {
      console.error('Failed to persist read state:', err);
    }
  }, [sessionToken, authenticated]);

  // Mark notification as read
  const handleMarkRead = useCallback((id: string) => {
    setReadState((prev) => ({ ...prev, [id]: true }));
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    persistReadState(id, true);
  }, [persistReadState]);

  // Mark notification as unread
  const handleMarkUnread = useCallback((id: string) => {
    setReadState((prev) => ({ ...prev, [id]: false }));
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: false } : n))
    );
  }, []);

  // Fetch notifications on mount and when address changes
  useEffect(() => {
    if (address) {
      fetchNotifications();
    }
  }, [address, fetchNotifications]);

  // Show auth prompt if not authenticated
  if (!authenticated || !address) {
    return (
      <AppShellLayout>
        <main className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white mb-2">Authentication Required</h1>
            <p className="text-white/60">
              Please connect your wallet to view notifications.
            </p>
          </div>
        </main>
      </AppShellLayout>
    );
  }

  return (
    <AppShellLayout>
      <main className="min-h-screen bg-[#0a0a0a]">
        <div className="w-full px-22 py-8 max-[1024px]:px-8 max-[640px]:px-4">
          <NotificationList
            notifications={notifications}
            isLoading={isLoading}
            error={error}
            onMarkRead={handleMarkRead}
            onMarkUnread={handleMarkUnread}
          />
        </div>
      </main>
    </AppShellLayout>
  );
}
