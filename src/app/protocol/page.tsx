'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Skeleton } from '@/components/Skeleton';
import { InlineError } from '@/components/InlineError';
import { useWallet } from '@/components/WalletProvider';
import { config } from '@/lib/config';
import { loadCommitments, type Commitment } from '@/lib/commitments';
import { coverageForecast, formatStroops } from '@/lib/yield';
import type { YieldPoolStatus } from '@/lib/soroban/protocol-policy';

type LoadState =
  | { phase: 'loading' }
  | { phase: 'not-configured' }
  | { phase: 'error'; message: string }
  | { phase: 'ready'; paused: boolean; pool: YieldPoolStatus };

export default function ProtocolPage() {
  const { status: walletStatus, address } = useWallet();
  const [state, setState] = useState<LoadState>({ phase: 'loading' });
  const [commitments, setCommitments] = useState<Commitment[]>([]);

  const load = useCallback(async () => {
    if (!config.isContractConfigured) {
      setState({ phase: 'not-configured' });
      return;
    }

    setState({ phase: 'loading' });
    try {
      // Loaded on demand so stellar-sdk stays out of the first-load bundle.
      const { getProtocolStatus, getYieldPoolStatus } = await import('@/lib/soroban/protocol-status');
      const [protocol, pool] = await Promise.all([getProtocolStatus(), getYieldPoolStatus()]);

      if (protocol.status !== 'ok') {
        setState({
          phase: 'error',
          message: protocol.error ?? 'Protocol status is currently unavailable.',
        });
        return;
      }

      setState({ phase: 'ready', paused: protocol.paused, pool });
    } catch (err) {
      setState({
        phase: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setCommitments(loadCommitments().items);
  }, []);

  const visibleCommitments = useMemo(() => {
    const funded = commitments.filter((c) => c.status === 'active' || c.status === 'matured');
    if (walletStatus === 'connected' && address) {
      return funded.filter((c) => c.owner === address);
    }
    return funded;
  }, [commitments, address, walletStatus]);

  const forecast = useMemo(() => {
    const available = state.phase === 'ready' ? state.pool.available : 0n;
    return coverageForecast(visibleCommitments, available, Date.now());
  }, [visibleCommitments, state]);

  return (
    <main className="container page">
      <h1>Protocol health</h1>
      <p className="muted">
        Live escrow yield-pool status, plus a forecast of the yield owed to funded commitments.
      </p>

      <div aria-live="polite" aria-busy={state.phase === 'loading'}>
        {state.phase === 'loading' && (
          <div className="stack mt" data-testid="protocol-loading">
            <Skeleton height={24} width="60%" />
            <Skeleton height={90} />
            <Skeleton height={140} />
          </div>
        )}

        {state.phase === 'not-configured' && (
          <div className="card mt" data-testid="protocol-not-configured">
            <h2>Contract not configured</h2>
            <p className="muted">
              The escrow contract is not configured for this deployment, so protocol health cannot be
              read. See the <Link href="/docs">docs</Link> for how to point the app at a deployed
              contract.
            </p>
          </div>
        )}

        {state.phase === 'error' && (
          <div className="mt">
            <InlineError message={state.message} onRetry={load} />
          </div>
        )}

        {state.phase === 'ready' && (
          <>
            <section className="card mt" aria-labelledby="pool-status-heading">
              <div className="row between wrap">
                <h2 id="pool-status-heading">Yield pool</h2>
                <span className={`badge ${state.paused ? '' : 'demo'}`}>
                  {state.paused ? 'Contract paused' : 'Contract active'}
                </span>
              </div>
              <div className="grid3 mt">
                <div className="card metric">
                  <span className="muted small">Balance</span>
                  <b>{formatStroops(state.pool.balance)}</b>
                </div>
                <div className="card metric">
                  <span className="muted small">Reserved yield</span>
                  <b>{formatStroops(state.pool.reserved)}</b>
                </div>
                <div className="card metric">
                  <span className="muted small">Available yield</span>
                  <b>{formatStroops(state.pool.available)}</b>
                </div>
              </div>
            </section>

            <section className="card mt" aria-labelledby="coverage-heading">
              <h2 id="coverage-heading">Coverage forecast</h2>
              <p className="muted small">
                {walletStatus === 'connected' && address
                  ? 'Showing funded commitments owned by your connected wallet.'
                  : 'No wallet connected: showing all funded commitments known to this browser.'}
              </p>

              <div className="table-wrap mt">
                <table>
                  <caption className="sr-only">
                    Yield owed by maturity horizon compared with the available yield pool balance
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Maturity horizon</th>
                      <th scope="col">Yield owed</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecast.buckets.map((bucket) => (
                      <tr key={bucket.horizonDays}>
                        <th scope="row">Within {bucket.horizonDays} days</th>
                        <td>{formatStroops(bucket.needStroops)}</td>
                        <td>
                          {bucket.covered ? (
                            <span className="badge demo">Covered</span>
                          ) : (
                            <span className="badge">
                              At risk: {formatStroops(bucket.shortfallStroops)} short
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="mt" data-testid="coverage-summary">
                {forecast.covered
                  ? 'Available yield covers every commitment maturing within 90 days.'
                  : `Available yield is ${formatStroops(forecast.shortfallStroops)} short of the yield owed within 90 days.`}
              </p>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
