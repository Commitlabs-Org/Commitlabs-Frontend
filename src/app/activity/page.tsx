'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useWallet } from '@/components/WalletProvider';
import { shortAddress } from '@/lib/wallet';
import { explorerContractUrl } from '@/lib/config';
import {
  fetchEscrowEvents,
  DecodedEscrowEvent,
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

export default function ActivityPage() {
  const { address } = useWallet();
  const [events, setEvents] = useState<DecodedEscrowEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterKind, setFilterKind] = useState('all');
  const [onlyMine, setOnlyMine] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>();
  const [olderAvailable, setOlderAvailable] = useState(false);

  const isVisibleRef = useRef(true);

  const loadEvents = useCallback(
    async (isPolling = false) => {
      if (!isPolling) setLoading(true);
      setError(null);

      try {
        const res = await fetchEscrowEvents({
          filters: {
            kind: filterKind !== 'all' ? filterKind : undefined,
            owner: onlyMine && address ? address : undefined,
          },
          cursor: isPolling ? undefined : cursor,
          limit: 30,
        });

        setEvents((prev) => {
          if (isPolling) {
            // Merge & deduplicate by id
            const existingIds = new Set(prev.map((e) => e.id));
            const newItems = res.events.filter((e) => !existingIds.has(e.id));
            return [...newItems, ...prev].slice(0, 500);
          }
          return res.events;
        });

        setOlderAvailable(res.olderEventsAvailable);
      } catch (err: any) {
        setError(err?.message || 'Failed to fetch events from Soroban RPC.');
      } finally {
        if (!isPolling) setLoading(false);
      }
    },
    [filterKind, onlyMine, address, cursor]
  );

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // Handle visibility change and 15s polling
  useEffect(() => {
    const handleVisibility = () => {
      isVisibleRef.current = document.visibilityState === 'visible';
      if (isVisibleRef.current) {
        loadEvents(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    const interval = setInterval(() => {
      if (isVisibleRef.current) {
        loadEvents(true);
      }
    }, 15000);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      clearInterval(interval);
    };
  }, [loadEvents]);

  return (
    <section className="container pad-y">
      <div className="between row mb">
        <div>
          <h1>Activity Feed</h1>
          <p className="muted">Live on-chain events emitted by the CommitLabs Soroban escrow contract.</p>
        </div>
        <button
          className="btn btn-ghost"
          onClick={() => loadEvents(false)}
          disabled={loading}
          title="Refresh feed"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
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

      {error && (
        <div className="card error-box mb">
          <p className="error-text">RPC Error: {error}</p>
          <button className="btn btn-primary" onClick={() => loadEvents(false)}>
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

          {!olderAvailable && (
            <div className="center pad-sm">
              <span className="small muted">Older events are not available from RPC</span>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
