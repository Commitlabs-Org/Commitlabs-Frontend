'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '@/lib/apiClient';
import { Commitment, HistoryEvent, HistoryEventKind } from '@/lib/types/domain';
import { Skeleton } from '@/components/Skeleton';

interface FeedEvent extends HistoryEvent {
  commitmentId: string;
}

interface RecentActivityFeedProps {
  commitments: Commitment[];
  maxItems?: number;
}

function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffSeconds < 60) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
  if (diffWeeks < 4) return `${diffWeeks} week${diffWeeks === 1 ? '' : 's'} ago`;
  if (diffMonths < 12) return `${diffMonths} month${diffMonths === 1 ? '' : 's'} ago`;
  const diffYears = Math.floor(diffMonths / 12);
  return `${diffYears} year${diffYears === 1 ? '' : 's'} ago`;
}

function getEventIcon(kind: HistoryEventKind) {
  switch (kind) {
    case 'created':
      return (
        <svg className="w-5 h-5 text-blue-400" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" />
          <path d="M10 6v8M6 10h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'attestation':
      return (
        <svg className="w-5 h-5 text-green-400" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" />
          <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'early_exit':
      return (
        <svg className="w-5 h-5 text-orange-400" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" />
          <path d="M7 10h6M10 7v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'settlement':
      return (
        <svg className="w-5 h-5 text-purple-400" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" />
          <path d="M7 10l2 2 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return null;
  }
}

function getEventTitle(event: FeedEvent): string {
  switch (event.kind) {
    case 'created':
      return `Commitment Created`;
    case 'attestation':
      return `Attestation Recorded`;
    case 'early_exit':
      return `Early Exit`;
    case 'settlement':
      return `Settlement Complete`;
    default:
      return 'Event';
  }
}

function getEventDescription(event: FeedEvent): string {
  switch (event.kind) {
    case 'created':
      return `${event.payload.amount} ${event.payload.asset}`;
    case 'attestation':
      return event.payload.attestationType || 'Health check';
    case 'early_exit':
      return event.payload.exitedBy ? `Exited by ${event.payload.exitedBy.slice(0, 8)}...` : 'Early exit executed';
    case 'settlement':
      return event.payload.settlementAmount ? `Settled: ${event.payload.settlementAmount}` : 'Commitment settled';
    default:
      return '';
  }
}

export function RecentActivityFeed({ commitments, maxItems = 5 }: RecentActivityFeedProps) {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadEvents() {
      if (commitments.length === 0) {
        setLoading(false);
        return;
      }
      
      const allEvents: FeedEvent[] = [];

      for (const commitment of commitments) {
        try {
          const response = await apiGet<{ success: boolean; data: { events: HistoryEvent[] } }>(
            `/api/commitments/${commitment.id}/history`
          );
          
          if (response.success && response.data?.events) {
            response.data.events.forEach((event) => {
              allEvents.push({
                ...event,
                commitmentId: commitment.id,
              });
            });
          }
        } catch (err) {
          console.error(`Failed to load history for ${commitment.id}`, err);
        }
      }

      allEvents.sort(
        (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
      );

      setEvents(allEvents);
      setLoading(false);
    }

    loadEvents();
  }, [commitments]);

  if (loading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-zinc-800">
          <Skeleton className="h-6 w-40" />
        </div>
        <div className="p-4 space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-start gap-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const displayEvents = events.slice(0, maxItems);
  const hasMore = events.length > maxItems;

  if (displayEvents.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
        <h3 className="text-lg font-medium text-white mb-2">No Recent Activity</h3>
        <p className="text-zinc-400 text-sm">
          Activity from your commitments will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
        <h3 className="text-lg font-medium text-white">Recent Activity</h3>
        <span className="text-xs font-semibold bg-zinc-800 text-zinc-400 px-2.5 py-1 rounded-full">
          {events.length} events
        </span>
      </div>
      
      <ul className="divide-y divide-zinc-800/50" role="list" aria-label="Recent activity">
        {displayEvents.map((event) => (
          <li key={event.eventId} className="p-4 hover:bg-zinc-800/50 transition-colors">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 mt-1" aria-hidden="true">
                {getEventIcon(event.kind)}
              </div>
              <div className="flex-1 min-w-0">
                <Link 
                  href={`/commitments/${event.commitmentId}`}
                  className="text-white font-medium hover:underline focus:outline-none focus:ring-2 focus:ring-zinc-500 rounded"
                >
                  {getEventTitle(event)}
                </Link>
                <p className="text-zinc-400 text-sm mt-1">
                  {getEventDescription(event)} · Commitment {event.commitmentId.substring(0, 8)}
                </p>
              </div>
              <time 
                dateTime={event.occurredAt}
                className="text-zinc-500 text-xs whitespace-nowrap"
              >
                {formatRelativeTime(event.occurredAt)}
              </time>
            </div>
          </li>
        ))}
      </ul>

      {hasMore && (
        <div className="p-4 border-t border-zinc-800">
          <Link 
            href="/commitments"
            className="text-sm text-zinc-400 hover:text-white transition-colors inline-flex items-center gap-1"
          >
            View All Activity
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none">
              <path d="M6 12l4-4-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      )}
    </div>
  );
}
