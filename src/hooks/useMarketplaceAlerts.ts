'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface MarketplaceSnapshot {
  id: string;
  title: string;
  price: number;
  status: 'Active' | 'Sold' | 'Cancelled';
}

export interface MarketplaceAlert {
  key: string;
  listingId: string;
  message: string;
  type: 'price-drop' | 'status-change';
}

export function detectMarketplaceAlerts(
  previous: ReadonlyMap<string, MarketplaceSnapshot>,
  current: readonly MarketplaceSnapshot[],
  watchedIds: ReadonlySet<string>,
): MarketplaceAlert[] {
  return current.flatMap((listing) => {
    if (!watchedIds.has(listing.id)) return [];
    const old = previous.get(listing.id);
    if (!old) return [];
    const alerts: MarketplaceAlert[] = [];
    if (listing.price < old.price) {
      alerts.push({
        key: `${listing.id}:price:${listing.price}`,
        listingId: listing.id,
        message: `${listing.title} dropped in price.`,
        type: 'price-drop',
      });
    }
    if (listing.status !== old.status && listing.status !== 'Active') {
      alerts.push({
        key: `${listing.id}:status:${listing.status}`,
        listingId: listing.id,
        message: `${listing.title} is now ${listing.status.toLowerCase()}.`,
        type: 'status-change',
      });
    }
    return alerts;
  });
}

export function useMarketplaceAlerts(
  listings: readonly MarketplaceSnapshot[],
  watchedIds: ReadonlySet<string>,
  notify: (alert: MarketplaceAlert) => void,
) {
  const previousRef = useRef(new Map<string, MarketplaceSnapshot>());
  const seenRef = useRef(new Set<string>());
  const [mutedIds, setMutedIds] = useState<Set<string>>(() => {
    try {
      return new Set(
        JSON.parse(localStorage.getItem('commitlabs:marketplace-alert-mutes') ?? '[]'),
      );
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    const alerts = detectMarketplaceAlerts(previousRef.current, listings, watchedIds);
    alerts.forEach((alert) => {
      if (!mutedIds.has(alert.listingId) && !seenRef.current.has(alert.key)) {
        seenRef.current.add(alert.key);
        notify(alert);
      }
    });
    previousRef.current = new Map(listings.map((listing) => [listing.id, listing]));
  }, [listings, mutedIds, notify, watchedIds]);

  const setMuted = useCallback((listingId: string, muted: boolean) => {
    setMutedIds((current) => {
      const next = new Set(current);
      if (muted) next.add(listingId);
      else next.delete(listingId);
      localStorage.setItem('commitlabs:marketplace-alert-mutes', JSON.stringify([...next]));
      return next;
    });
  }, []);

  return { mutedIds, setMuted };
}
