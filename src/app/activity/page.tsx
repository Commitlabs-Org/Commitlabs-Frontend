'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useWallet } from '@/components/WalletProvider';
import { shortAddress } from '@/lib/wallet';
import { explorerContractUrl } from '@/lib/config';
import {
  fetchEscrowEvents,
  DecodedEscrowEvent,
  isLedgerOutOfRangeError,
  MAX_EVENTS_IN_MEMORY,
} from '@/lib/soroban/events';

const EVENT_KINDS = [
  { value: 'all', label: 'All events' },
  { value: 'create_commitment', label: 'Created' },
  { value: 'fund', label: 'Funded' },
  { value: 'release', label: 'Released' },
  { value: 'refund', label: 'Refunded' },
  { value: 'dispute', label: 'Disputed' },
  { value: 'resolve', label: 'Resolved' },
];

export const POLL_INTERVAL_MS = 10000;
const PAGE_LIMIT = 30;

export default function ActivityPage() {
  const { address } = useWallet();
  const [events, setEvents] = useState<DecodedEscrowEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retentionNotice, setRetentionNotice] = useState<string | null>(null);
  const [filterKind, setFilterKind] = useState('all');
  const [onlyMine, setOnlyMine] = useState(false);
  const [olderAvailable, setOlderAvailable] = useState(false);
  const [livePaused, setLivePaused] = useState(false);
  const [newEventsCount, setNewEventsCount] = useState(0);

  const pageCursorRef = useRef<string | undefined>(undefined);
  const latestCursorRef = useRef<string | undefined>(undefined);

  const buildFilters = useCallback(
    () => ({
      kind: filterKind !== 'all' ? filterKind : undefined,
      owner: onlyMine && address ? address : undefined,
    }),
    [filterKind, onlyMine, address]
  );

  const loadInitialEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    setRetentionNotice(null);
    setNewEventsCount(0);
    pageCursorRef.current = undefined;
    latestCursorRef.current = undefined;

    try {
      const res = await fetchEscrowEvents({
        filters: buildFilters(),
        limit: PAGE_LIMIT,
      });

      if (res.retentionOutOfRange) {
        setRetentionNotice(
          res.retentionMessage ||
            'The requested startLedger is outside the Soroban RPC retention window.'
        );
      }

      const bounded = res.events.slice(0, MAX_EVENTS_IN_MEMORY);
      setEvents(bounded);
      pageCursorRef.current = res.cursor;
      latestCursorRef.current = res.cursor || bounded[0]?.id;
      setOlderAvailable(res.olderEventsAvailable);
    } catch (err: any) {
      if (isLedgerOutOfRangeError(err)) {
        setRetentionNotice(
          'The requested startLedger is outside the Soroban RPC retention window (only recent ledgers are retained by RPC).'
        );
        setOlderAvailable(false);
      } else {
        setError(err?.message || 'Failed to fetch events from Soroban RPC.');
      }
    } finally {
      setLoading(false);
    }
  }, [buildFilters]);

  const loadOlderEvents = useCallback(async () => {
    if (loadingMore || loading) return;
    setLoadingMore(true);
    setError(null);

    try {
      const res = await fetchEscrowEvents({
        filters: buildFilters(),
        cursor: pageCursorRef.current,
        limit: PAGE_LIMIT,
      });

      if (res.retentionOutOfRange) {
        setRetentionNotice(
          res.retentionMessage ||
            'Older ledgers are outside the Soroban RPC retention window.'
        );
        setOlderAvailable(false);
        return;
      }

      setEvents((prev) => {
        const existingIds = new Set(prev.map((e) => e.id));
        const additional = res.events.filter((e) => !existingIds.has(e.id));
        return [...prev, ...additional].slice(0, MAX_EVENTS_IN_MEMORY);
      });

      if (res.cursor) {
        pageCursorRef.current = res.cursor;
      }
      setOlderAvailable(res.olderEventsAvailable);
    } catch (err: any) {
      if (isLedgerOutOfRangeError(err)) {
        setRetentionNotice(
          'Older ledgers are outside the Soroban RPC retention window (only recent ledgers are retained by RPC).'
        );
        setOlderAvailable(false);
      } else {
        setError(err?.message || 'Failed to fetch older events from Soroban RPC.');
      }
    } finally {
      setLoadingMore(false);
    }
  }, [buildFilters, loading, loadingMore]);

  const pollLatestEvents = useCallback(async () => {
    try {
      const res = await fetchEscrowEvents({
        filters: buildFilters(),
        cursor: latestCursorRef.current,
        limit: PAGE_LIMIT,
      });

      if (res.retentionOutOfRange) {
        setRetentionNotice(
          res.retentionMessage ||
            'The requested startLedger is outside the Soroban RPC retention window.'
        );
        return;
      }

      if (res.cursor) {
        latestCursorRef.current = res.cursor;
      }

      setEvents((prev) => {
        const existingIds = new Set(prev.map((e) => e.id));
        const newItems = res.events.filter((e) => !existingIds.has(e.id));
        if (newItems.length === 0) return prev;
        setNewEventsCount((count) => count + newItems.length);
        return [...newItems, ...prev].slice(0, MAX_EVENTS_IN_MEMORY);
      });
    } catch (err: any) {
      if (isLedgerOutOfRangeError(err)) {
        setRetentionNotice(
          'The requested startLedger is outside the Soroban RPC retention window.'
        );
      }
    }
  }, [buildFilters]);

  useEffect(() => {
    loadInitialEvents();
  }, [loadInitialEvents]);

  // 10s visibility-aware live polling that stops when hidden, paused, or unmounted
  useEffect(() => {
    if (livePaused) return;

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (intervalId !== null) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }
      intervalId = setInterval(() => {
        if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
          return;
        }
        pollLatestEvents();
      }, POLL_INTERVAL_MS);
    };

    const stopPolling = () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        stopPolling();
      } else {
        startPolling();
      }
    };

    startPolling();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopPolling();
    };
  }, [livePaused, pollLatestEvents]);

  return (
    <section className="container pad-y">
      <div className="between row mb">
        <div>
          <h1>Activity Feed</h1>
          <p className="muted">Live on-chain events emitted by the CommitLabs Soroban escrow contract.</p>
        </div>
        <div className="row gap">
          {newEventsCount > 0 && (
            <button
              type="button"
              className="badge active"
              onClick={() => setNewEventsCount(0)}
              aria-label={`${newEventsCount} new events`}
              title="Click to dismiss new events badge"
            >
              {newEventsCount} new {newEventsCount === 1 ? 'event' : 'events'}
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost"
            aria-pressed={livePaused}
            onClick={() => setLivePaused((prev) => !prev)}
          >
            {livePaused ? 'Resume live' : 'Pause live'}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => loadInitialEvents()}
            disabled={loading}
            title="Refresh feed"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {newEventsCount > 0
          ? `${newEventsCount} new ${newEventsCount === 1 ? 'event' : 'events'} received`
          : livePaused
            ? 'Live updates paused'
            : 'Live updates active'}
      </div>

      <div className="card row between mb filter-bar">
        <div className="row gap">
          <label className="filter-label">
            <span>Filter Kind:</span>
            <select
              aria-label="Filter events by kind"
              value={filterKind}
              onChange={(e) => setFilterKind(e.target.value)}
            >
              {EVENT_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>

          <label className="check row">
            <input
              type="checkbox"
              checked={onlyMine}
              onChange={(e) => setOnlyMine(e.target.checked)}
              disabled={!address}
            />
            <span>Owner = me {address ? `(${shortAddress(address)})` : '(connect wallet)'}</span>
          </label>
        </div>
      </div>

      {retentionNotice && (
        <div className="card notice mb" role="status">
          <p>{retentionNotice}</p>
        </div>
      )}

      {error && (
        <div className="card error-box mb" role="alert">
          <p className="error-text">RPC Error: {error}</p>
          <button className="btn btn-primary" onClick={() => loadInitialEvents()}>
            Retry
          </button>
        </div>
      )}

      {loading && events.length === 0 ? (
        <div className="card center pad-lg">
          <p className="muted">Loading on-chain events from Soroban RPC...</p>
        </div>
      ) : events.length === 0 ? (
        <div className="card center pad-lg">
          <p className="muted">No events found matching criteria.</p>
          {onlyMine && !address && (
            <p className="small muted">Please connect your Freighter wallet to view your activity.</p>
          )}
        </div>
      ) : (
        <div className="card stack">
          <div className="table-responsive">
            <table className="table full-width">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Commitment</th>
                  <th>Owner</th>
                  <th>Amount</th>
                  <th>Ledger</th>
                  <th>Time</th>
                  <th>Tx</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev) => (
                  <tr key={ev.id}>
                    <td>
                      <span className={`badge badge-${ev.kind}`}>{ev.kind}</span>
                    </td>
                    <td>{ev.commitmentId ?? '—'}</td>
                    <td>
                      {ev.owner ? (
                        <span title={ev.owner}>{shortAddress(ev.owner)}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>{ev.amount ?? '—'}</td>
                    <td>{ev.ledger}</td>
                    <td>
                      <span title={ev.at}>{new Date(ev.at).toLocaleTimeString()}</span>
                    </td>
                    <td>
                      {ev.txHash ? (
                        <a
                          href={explorerContractUrl(ev.txHash)}
                          target="_blank"
                          rel="noreferrer"
                          className="link"
                        >
                          View tx
                        </a>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {olderAvailable ? (
            <div className="center pad-sm">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={loadOlderEvents}
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading older...' : 'Load older'}
              </button>
            </div>
          ) : (
            <div className="center pad-sm">
              <span className="small muted">Older events are not available from RPC</span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
