'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, AlertTriangle, Clock, Store, Check, X, Filter } from 'lucide-react';
import { Skeleton } from '@/components/Skeleton';
import ErrorLayout from '@/components/ErrorLayout';
import type { Notification, NotificationType } from '@/lib/types/domain';

interface NotificationListProps {
  notifications: Notification[];
  isLoading?: boolean;
  error?: string | null;
  onMarkRead?: (id: string) => void;
  onMarkUnread?: (id: string) => void;
}

type CategoryFilter = 'all' | NotificationType;

const CATEGORY_LABELS: Record<CategoryFilter, string> = {
  all: 'All',
  expiry: 'Expiry',
  violation: 'Violations',
  health_check: 'Health',
  marketplace: 'Marketplace',
};

const CATEGORY_ICONS: Record<NotificationType, React.ReactNode> = {
  expiry: <Clock size={16} />,
  violation: <AlertTriangle size={16} />,
  health_check: <Bell size={16} />,
  marketplace: <Store size={16} />,
};

const SEVERITY_COLORS: Record<Notification['severity'], string> = {
  info: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  warning: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  critical: 'text-red-400 bg-red-400/10 border-red-400/20',
};

export function NotificationList({
  notifications,
  isLoading = false,
  error = null,
  onMarkRead,
  onMarkUnread,
}: NotificationListProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<CategoryFilter>('all');

  const filteredNotifications = useMemo(() => {
    if (filter === 'all') return notifications;
    return notifications.filter((n) => n.type === filter);
  }, [notifications, filter]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.read).length;
  }, [notifications]);

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read && onMarkRead) {
      onMarkRead(notification.id);
    }

    if (notification.relatedCommitmentId) {
      router.push(`/commitments/${notification.relatedCommitmentId}`);
    } else if (notification.relatedListingId) {
      router.push(`/marketplace?listing=${notification.relatedListingId}`);
    }
  };

  const handleMarkRead = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (onMarkRead) onMarkRead(id);
  };

  const handleMarkUnread = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (onMarkUnread) onMarkUnread(id);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-[#0a0a0a] border border-[#222] rounded-xl p-5">
            <div className="flex items-start gap-4">
              <Skeleton width={40} height={40} rounded="full" />
              <div className="flex-1 space-y-2">
                <Skeleton width="60%" height={20} />
                <Skeleton width="80%" height={16} />
                <Skeleton width="40%" height={14} />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <ErrorLayout>
        <div className="text-center py-12">
          <p className="text-red-400 mb-4">Failed to load notifications</p>
          <p className="text-white/60 text-sm">{error}</p>
        </div>
      </ErrorLayout>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="text-center py-16">
        <Bell size={48} className="mx-auto text-white/20 mb-4" />
        <h3 className="text-lg font-medium text-white mb-2">No notifications</h3>
        <p className="text-white/60 text-sm">
          You're all caught up! Check back later for updates.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Notifications</h1>
          <p className="text-white/60 text-sm">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-white/40" />
          <span className="text-white/60 text-sm">Filter</span>
        </div>
      </div>

      {/* Category filters */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(CATEGORY_LABELS) as CategoryFilter[]).map((category) => {
          const count =
            category === 'all'
              ? notifications.length
              : notifications.filter((n) => n.type === category).length;

          return (
            <button
              key={category}
              onClick={() => setFilter(category)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
                ${
                  filter === category
                    ? 'bg-[#0FF0FC]/10 text-[#0FF0FC] border border-[#0FF0FC]/20'
                    : 'text-white/70 hover:text-white hover:bg-white/5 border border-transparent'
                }
              `}
              aria-pressed={filter === category}
            >
              {category !== 'all' && CATEGORY_ICONS[category]}
              <span>{CATEGORY_LABELS[category]}</span>
              {count > 0 && (
                <span
                  className={`
                    px-2 py-0.5 rounded-full text-xs
                    ${
                      filter === category
                        ? 'bg-[#0FF0FC]/20 text-[#0FF0FC]'
                        : 'bg-white/10 text-white/60'
                    }
                  `}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Notifications list */}
      {filteredNotifications.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-white/60">No notifications in this category</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotifications.map((notification) => (
            <div
              key={notification.id}
              onClick={() => handleNotificationClick(notification)}
              className={`
                relative bg-[#0a0a0a] border rounded-xl p-5 cursor-pointer transition-all
                ${
                  notification.read
                    ? 'border-[#222] opacity-70 hover:opacity-100'
                    : 'border-[#0FF0FC]/30 hover:border-[#0FF0FC]/50'
                }
              `}
              role="button"
              tabIndex={0}
              aria-label={`Notification: ${notification.title}`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleNotificationClick(notification);
                }
              }}
            >
              {/* Unread indicator */}
              {!notification.read && (
                <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-[#0FF0FC]" />
              )}

              <div className="flex items-start gap-4">
                {/* Icon based on type */}
                <div
                  className={`
                    flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center
                    ${SEVERITY_COLORS[notification.severity]}
                  `}
                >
                  {CATEGORY_ICONS[notification.type] || <Bell size={20} />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <h3 className="font-medium text-white truncate">
                      {notification.title}
                    </h3>
                    <span className="text-white/40 text-xs whitespace-nowrap">
                      {new Date(notification.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-white/60 text-sm mb-3 line-clamp-2">
                    {notification.message}
                  </p>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2">
                    {notification.read ? (
                      <button
                        onClick={(e) => handleMarkUnread(e, notification.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/60 hover:text-white hover:bg-white/5 transition-colors"
                        aria-label="Mark as unread"
                      >
                        <X size={14} />
                        <span>Mark unread</span>
                      </button>
                    ) : (
                      <button
                        onClick={(e) => handleMarkRead(e, notification.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#0FF0FC] hover:bg-[#0FF0FC]/10 transition-colors"
                        aria-label="Mark as read"
                      >
                        <Check size={14} />
                        <span>Mark read</span>
                      </button>
                    )}

                    {(notification.relatedCommitmentId || notification.relatedListingId) && (
                      <span className="text-white/40 text-xs">
                        → View details
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
