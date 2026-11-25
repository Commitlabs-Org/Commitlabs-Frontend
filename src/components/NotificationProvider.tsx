'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  deriveNotifications,
  getBrowserNotificationPref,
  isNotificationSupported,
  loadReadNotificationIds,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  requestBrowserNotificationPermission,
  saveReadNotificationIds,
  sendBrowserNotification,
  setBrowserNotificationPref,
  subscribeNotifications,
  type AppNotification,
} from '@/lib/notifications';
import { loadCommitments, subscribeCommitments, type Commitment } from '@/lib/commitments';
import { useProtocolStatus } from './ProtocolStatusProvider';

export interface NotificationContextValue {
  notifications: AppNotification[];
  unreadNotifications: AppNotification[];
  unreadCount: number;
  readIds: Set<string>;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  browserNotificationsEnabled: boolean;
  toggleBrowserNotifications: () => Promise<boolean>;
  isBrowserSupported: boolean;
  permission: NotificationPermission | 'unsupported';
}

const defaultContextValue: NotificationContextValue = {
  notifications: [],
  unreadNotifications: [],
  unreadCount: 0,
  readIds: new Set(),
  markAsRead: () => {},
  markAllAsRead: () => {},
  browserNotificationsEnabled: false,
  toggleBrowserNotifications: async () => false,
  isBrowserSupported: false,
  permission: 'unsupported',
};

const NotificationContext = createContext<NotificationContextValue>(defaultContextValue);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const protocolStatus = useProtocolStatus();
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(() => loadReadNotificationIds());
  const [now, setNow] = useState<number>(() => Date.now());
  const [browserEnabled, setBrowserEnabled] = useState<boolean>(false);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');
  const shownBrowserIdsRef = useRef<Set<string>>(new Set());

  // Reload commitments
  const refreshCommitments = useCallback(() => {
    const res = loadCommitments();
    setCommitments(res.items);
  }, []);

  // Reload read notification IDs from storage
  const refreshReadIds = useCallback(() => {
    setReadIds(loadReadNotificationIds());
  }, []);

  // Sync initial commitments and read IDs on mount
  useEffect(() => {
    refreshCommitments();
    refreshReadIds();
    setBrowserEnabled(getBrowserNotificationPref());
    if (isNotificationSupported()) {
      setPermission(Notification.permission);
    }
  }, [refreshCommitments, refreshReadIds]);

  // Subscribe to storage changes for commitments and read status (cross-tab sync)
  useEffect(() => {
    const unsubCommitments = subscribeCommitments(refreshCommitments);
    const unsubNotifications = subscribeNotifications(refreshReadIds);
    return () => {
      unsubCommitments();
      unsubNotifications();
    };
  }, [refreshCommitments, refreshReadIds]);

  // Tick every 30 seconds to recalculate maturity-based notifications
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Derive notifications
  const allNotifications = useMemo(() => {
    return deriveNotifications(commitments, protocolStatus, now);
  }, [commitments, protocolStatus, now]);

  const unreadNotifications = useMemo(() => {
    return allNotifications.filter((n) => !readIds.has(n.id));
  }, [allNotifications, readIds]);

  const unreadCount = unreadNotifications.length;

  // Send browser notifications for newly derived unread items if enabled
  useEffect(() => {
    if (!browserEnabled || permission !== 'granted') return;

    for (const item of unreadNotifications) {
      if (!shownBrowserIdsRef.current.has(item.id)) {
        shownBrowserIdsRef.current.add(item.id);
        sendBrowserNotification(item.title, {
          body: item.message,
          tag: item.id,
        });
      }
    }
  }, [unreadNotifications, browserEnabled, permission]);

  const markAsRead = useCallback((id: string) => {
    markNotificationAsRead(id);
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    const allIds = allNotifications.map((n) => n.id);
    markAllNotificationsAsRead(allIds);
    setReadIds(new Set(allIds));
  }, [allNotifications]);

  const toggleBrowserNotifications = useCallback(async (): Promise<boolean> => {
    if (!isNotificationSupported()) return false;

    if (!browserEnabled) {
      // Permission prompt only after explicit user action
      const perm = await requestBrowserNotificationPermission();
      setPermission(perm);
      if (perm === 'granted') {
        setBrowserEnabled(true);
        setBrowserNotificationPref(true);
        return true;
      } else {
        setBrowserEnabled(false);
        setBrowserNotificationPref(false);
        return false;
      }
    } else {
      setBrowserEnabled(false);
      setBrowserNotificationPref(false);
      return false;
    }
  }, [browserEnabled]);

  const contextValue = useMemo<NotificationContextValue>(
    () => ({
      notifications: allNotifications,
      unreadNotifications,
      unreadCount,
      readIds,
      markAsRead,
      markAllAsRead,
      browserNotificationsEnabled: browserEnabled,
      toggleBrowserNotifications,
      isBrowserSupported: isNotificationSupported(),
      permission,
    }),
    [
      allNotifications,
      unreadNotifications,
      unreadCount,
      readIds,
      markAsRead,
      markAllAsRead,
      browserEnabled,
      toggleBrowserNotifications,
      permission,
    ],
  );

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  return useContext(NotificationContext);
}
