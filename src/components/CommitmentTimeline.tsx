'use client';

import { useCallback, useEffect, useState } from 'react';
import { explorerTx } from '@/lib/config';
import { formatAbsoluteTime, formatRelativeTime } from '@/lib/soroban/read';
import type { DecodedEscrowEvent } from '@/lib/soroban/events';

const PAGE_LIMIT = 20;

function eventTimestamp(event: DecodedEscrowEvent): number {
  const timestamp = Date.parse(event.at);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function sortAndDedupeEvents(events: DecodedEscrowEvent[]): DecodedEscrowEvent[] {
  const newestFirst = [...events].sort(
    (a, b) => b.ledger - a.ledger || eventTimestamp(b) - eventTimestamp(a)
  );
  const seenIds = new Set<string>();
  return newestFirst.filter((event) => {
    if (seenIds.has(event.id)) return false;
    seenIds.add(event.id);
    return true;
  });
}

function formatAmount(amount: string): string {
  return /^-?\d+$/.test(amount) ? BigInt(amount).toLocaleString('en-US') : amount;
}

function eventTimeSeconds(event: DecodedEscrowEvent): bigint {
  const timestamp = eventTimestamp(event);
  return timestamp > 0 ? BigInt(Math.floor(timestamp / 1000)) : 0n;
}

export function CommitmentTimeline({ commitmentId }: { commitmentId: string }) {
  const [events, setEvents] = useState<DecodedEscrowEvent[]>([]);
  const [cursor, setCursor] = useState<string>();
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retentionMessage, setRetentionMessage] = useState<string | null>(null);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    setRetentionMessage(null);
    try {
      const { fetchEscrowEvents } = await import('@/lib/soroban/events');
      const result = await fetchEscrowEvents({
        filters: { commitmentId },
        limit: PAGE_LIMIT,
      });
      setEvents(sortAndDedupeEvents(result.events));
      setCursor(result.cursor);
      setHasMore(result.olderEventsAvailable);
      setRetentionMessage(result.retentionOutOfRange ? result.retentionMessage ?? null : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [commitmentId]);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial]);

  const loadOlder = useCallback(async () => {
    if (!cursor || !hasMore || loadingOlder) return;
    setLoadingOlder(true);
    setError(null);
    try {
      const { fetchEscrowEvents } = await import('@/lib/soroban/events');
      const result = await fetchEscrowEvents({
        filters: { commitmentId },
        cursor,
        limit: PAGE_LIMIT,
      });
      setEvents((current) => sortAndDedupeEvents([...current, ...result.events]));
      setCursor(result.cursor);
      setHasMore(result.olderEventsAvailable);
      setRetentionMessage(result.retentionOutOfRange ? result.retentionMessage ?? null : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingOlder(false);
    }
  }, [commitmentId, cursor, hasMore, loadingOlder]);

  return (
    <section
      className="card mt"
      aria-labelledby="event-timeline-heading"
      aria-busy={loading || loadingOlder}
    >
      <h2 id="event-timeline-heading">On-chain Event Timeline</h2>

      {loading && (
        <p className="small muted" role="status" aria-live="polite">
          Loading lifecycle events…
        </p>
      )}

      {retentionMessage && (
        <p className="notice small" role="status">
          {retentionMessage}
        </p>
      )}

      {error && (
        <div className="notice mt" role="alert">
          <p>{error}</p>
          {events.length === 0 && (
            <button type="button" className="btn btn-ghost" onClick={loadInitial}>
              Retry loading events
            </button>
          )}
        </div>
      )}

      {!loading && !error && events.length === 0 && (
        <p className="small muted" role="status">
          No lifecycle events found for this commitment.
        </p>
      )}

      {events.length > 0 && (
        <ol
          aria-label={`Lifecycle events for commitment ${commitmentId}, newest first`}
          style={{
            listStyle: 'none',
            borderLeft: '2px solid var(--line)',
            margin: '20px 0 0 8px',
            padding: '0 0 0 20px',
          }}
        >
          {events.map((event) => {
            const timestamp = eventTimeSeconds(event);
            return (
              <li key={event.id} style={{ position: 'relative', paddingBottom: '20px' }}>
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    left: '-27px',
                    top: '5px',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    background: 'var(--accent)',
                  }}
                />
                <div className="row between wrap" style={{ gap: '8px' }}>
                  <strong>{event.kind}</strong>
                  <span className="small muted">
                    <time dateTime={event.at}>{formatAbsoluteTime(timestamp)}</time>
                    {' · '}{formatRelativeTime(timestamp)}
                    {' · '}Ledger {event.ledger}
                  </span>
                </div>
                <div className="small muted mt">
                  Amount: {event.amount === undefined ? '—' : `${formatAmount(event.amount)} units`}
                </div>
                {event.txHash && (
                  <a
                    className="link small"
                    href={explorerTx(event.txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View transaction
                  </a>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {hasMore && (
        <button
          type="button"
          className="btn btn-ghost mt"
          onClick={loadOlder}
          disabled={loadingOlder}
        >
          {loadingOlder ? 'Loading older events…' : 'Load older'}
        </button>
      )}
    </section>
  );
}
