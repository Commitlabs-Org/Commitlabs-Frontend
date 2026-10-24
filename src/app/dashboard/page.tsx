'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  effectiveStatus,
  fmt,
  loadCommitments,
  maturityOf,
  progressOf,
  projectedYield,
  resetCommitments,
  sampleCommitments,
  saveCommitments,
  specFor,
  subscribeCommitments,
  type Commitment,
} from '@/lib/commitments';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { DisputeDialog } from '@/components/DisputeDialog';
import { useWallet } from '@/components/WalletProvider';
import { fetchXlmBalance, shortAddress } from '@/lib/wallet';
import type { DecodedEscrowEvent } from '@/lib/soroban/events';
import { DISPUTE_CATEGORY_LABELS, type DisputeRecord } from '@/lib/soroban/dispute';
import { config, explorerTx } from '@/lib/config';
import { InlineError } from '@/components/InlineError';
import { Skeleton } from '@/components/Skeleton';
import { TxErrorNotice } from '@/components/TxErrorNotice';
import DashboardLoading from './loading';

interface Notice {
  message: string;
  canReset: boolean;
}

// Single source for the numbers shown in the exit dialog and applied to the commitment.
function exitBreakdown(c: Commitment) {
  const penaltyAmount = (c.amount * c.penalty) / 100;
  return { principal: c.amount, penaltyPct: c.penalty, penaltyAmount, returned: c.amount - penaltyAmount };
}

type BalanceState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; balance: string }
  | { status: 'unfunded'; friendbotUrl: string }
  | { status: 'error'; message: string };

export default function DashboardPage() {
  const { status, address } = useWallet();
  const [list, setList] = useState<Commitment[] | null>(null);
  const [pending, setPending] = useState<{ kind: 'exit' | 'remove'; id: string } | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [notice, setNotice] = useState<Notice | null>(null);
  const [recentEvents, setRecentEvents] = useState<DecodedEscrowEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [balanceState, setBalanceState] = useState<BalanceState>({ status: 'idle' });
  const [disputeDialog, setDisputeDialog] = useState<Commitment | null>(null);
  const [disputeRecords, setDisputeRecords] = useState<Record<string, DisputeRecord>>({});
  const [disputeError, setDisputeError] = useState<unknown>(null);

  const reload = useCallback(() => {
    const result = loadCommitments();
    setList(result.items);

    const messages: string[] = [];
    let canReset = false;
    if (result.corrupt) {
      messages.push('Some saved commitments could not be read and were discarded.');
      canReset = true;
    } else if (result.dropped > 0) {
      messages.push(
        `${result.dropped} saved commitment${result.dropped === 1 ? '' : 's'} could not be validated and ${result.dropped === 1 ? 'was' : 'were'} skipped.`,
      );
      canReset = true;
    }
    if (result.storageUnavailable) {
      messages.push('Browser storage is unavailable, so changes are kept only for this session.');
    }
    setNotice(messages.length ? { message: messages.join(' '), canReset } : null);
  }, []);

  const loadBalance = useCallback((addr: string, signal?: AbortSignal) => {
    setBalanceState({ status: 'loading' });
    fetchXlmBalance(addr, { signal })
      .then((res) => {
        if (signal?.aborted) return;
        if (res.status === 'success') {
          setBalanceState({ status: 'success', balance: res.balance });
        } else if (res.status === 'unfunded') {
          setBalanceState({ status: 'unfunded', friendbotUrl: res.friendbotUrl });
        } else {
          setBalanceState({ status: 'error', message: res.message });
        }
      })
      .catch((_err) => {
        if (signal?.aborted) return;
        setBalanceState({ status: 'error', message: "Couldn't load balance" });
      });
  }, []);

  useEffect(() => {
    if (!address || status !== 'connected') {
      setBalanceState({ status: 'idle' });
      return;
    }

    const controller = new AbortController();
    loadBalance(address, controller.signal);

    return () => {
      controller.abort();
    };
  }, [address, status, loadBalance]);

  const handleRetryBalance = () => {
    if (address) {
      loadBalance(address);
    }
  };

  useEffect(() => {
    reload();
    return subscribeCommitments(reload);
  }, [reload]);

  useEffect(() => {
    if (address) {
      setEventsLoading(true);
      setEventsError(null);
      // Load the Soroban RPC client lazily so stellar-sdk stays out of the
      // dashboard's first-load bundle (see performance-budgets.json).
      import('@/lib/soroban/events')
        .then(({ fetchEscrowEvents }) =>
          fetchEscrowEvents({
            limit: 5,
            filters: { owner: address },
          }),
        )
        .then((res) => setRecentEvents(res.events))
        .catch((err) => setEventsError(err?.message || 'Failed to load activity'))
        .finally(() => setEventsLoading(false));
    } else {
      setRecentEvents([]);
    }
  }, [address]);

  useEffect(() => {
    if (!address || list === null) return;
    const pending = new Map<string, Promise<void>>();
    for (const c of list) {
      const st = effectiveStatus(c);
      if (
        (st === 'disputed' || st === 'violated') &&
        !disputeRecords[c.id] &&
        !pending.has(c.id)
      ) {
        pending.set(
          c.id,
          (async () => {
            try {
              // Loaded on demand so stellar-sdk stays out of the dashboard's first-load bundle.
              const { getDispute } = await import('@/lib/soroban/escrow');
              const record = await getDispute(c.id, address ?? undefined);
              if (record) {
                setDisputeRecords((prev) => ({ ...prev, [c.id]: record }));
              }
            } catch {
              // Swallow read failures: the frozen state is still informative
              // without the dispute record.
            }
          })(),
        );
      }
    }
  }, [list, address, disputeRecords]);

  function update(id: string, patch: Partial<Commitment>) {
    setList((prev) => {
      const next = (prev ?? []).map((c) => (c.id === id ? { ...c, ...patch } : c));
      saveCommitments(next);
      return next;
    });
  }

  function remove(id: string) {
    setList((prev) => {
      const next = (prev ?? []).filter((c) => c.id !== id);
      saveCommitments(next);
      return next;
    });
  }

  function loadSamples() {
    saveCommitments([...(list ?? []), ...sampleCommitments()]);
    reload();
  }

  function resetStorage() {
    resetCommitments();
    reload();
  }

  function confirmPending() {
    if (!pending) return;
    const c = (list ?? []).find((x) => x.id === pending.id);
    setPending(null);
    if (!c) return;
    if (pending.kind === 'exit') {
      update(c.id, { status: 'exited' });
      setAnnouncement(`Commitment ${c.id} exited early`);
    } else {
      remove(c.id);
      setAnnouncement(`Commitment ${c.id} removed`);
    }
  }

  function handleReportProblem(c: Commitment) {
    setDisputeError(null);
    setDisputeDialog(c);
  }

  async function handleDisputeOpened(c: Commitment) {
    setDisputeDialog(null);
    setDisputeError(null);
    try {
      update(c.id, { status: 'disputed' });
      setAnnouncement(`Commitment ${c.id} is now disputed — funds are frozen until resolved.`);
      const { getDispute } = await import('@/lib/soroban/escrow');
      const record = await getDispute(c.id, address ?? undefined);
      if (record) {
        setDisputeRecords((prev) => ({ ...prev, [c.id]: record }));
      }
    } catch (err) {
      setDisputeError(err);
    }
  }

  if (!list) return <DashboardLoading />;

  const target = pending ? list.find((c) => c.id === pending.id) : undefined;
  const breakdown = target ? exitBreakdown(target) : null;

  const live = list.filter((c) => ['active', 'matured'].includes(effectiveStatus(c)));
  const frozen = list.filter((c) => effectiveStatus(c) === 'disputed' || effectiveStatus(c) === 'violated');
  const locked = [...live, ...frozen].reduce((s, c) => s + c.amount, 0);
  const yieldTotal = [...live, ...frozen].reduce((s, c) => s + projectedYield(c), 0);
  const matured = list.filter((c) => effectiveStatus(c) === 'matured').length;

  return (
    <section className="container page">
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
      <div className="row between wrap">
        <h1>Dashboard</h1>
        <Link href="/create" className="btn btn-primary">
          New commitment
        </Link>
      </div>

      {notice && (
        <div className="notice" role="status">
          <div className="row between wrap">
            <span>{notice.message}</span>
            {notice.canReset && (
              <button className="btn btn-ghost" onClick={resetStorage}>
                Reset demo data
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid4">
        <div className="card metric">
          <span className="muted">Active commitments</span>
          <b>{live.length}</b>
        </div>
        {frozen.length > 0 && (
          <div className="card metric" style={{ borderColor: 'var(--warn)' }}>
            <span className="muted" style={{ color: 'var(--warn)' }}>Frozen commitments</span>
            <b style={{ color: 'var(--warn)' }}>{frozen.length}</b>
          </div>
        )}
        <div className="card metric">
          <span className="muted">Total locked</span>
          <b>{fmt(locked)}</b>
        </div>
        <div className="card metric">
          <span className="muted">Projected yield</span>
          <b>{fmt(yieldTotal)}</b>
        </div>
        <div className="card metric">
          <span className="muted">{status === 'connected' ? `Wallet XLM (${config.networkDetails.label.toLowerCase()})` : 'Ready to settle'}</span>
          {status === 'connected' ? (
            balanceState.status === 'loading' ? (
              <Skeleton width="110px" height="32px" style={{ marginTop: '4px' }} />
            ) : balanceState.status === 'success' ? (
              <b>{fmt(Number(balanceState.balance))}</b>
            ) : balanceState.status === 'unfunded' ? (
              <div className="stack" style={{ gap: '4px', marginTop: '4px' }}>
                <b style={{ fontSize: '1rem', color: 'var(--warn)' }}>Account not funded</b>
                <a
                  href={balanceState.friendbotUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="friendbot-link"
                >
                  Fund via Friendbot &rarr;
                </a>
              </div>
            ) : balanceState.status === 'error' ? (
              <div style={{ marginTop: '6px' }}>
                <InlineError
                  message="Couldn't load balance"
                  onRetry={handleRetryBalance}
                />
              </div>
            ) : (
              <b>n/a</b>
            )
          ) : (
            <b>{matured}</b>
          )}
        </div>
      </div>

      <h2 className="mt">Your commitments</h2>
      {list.length === 0 ? (
        <div className="card center">
          <p className="muted">No commitments yet.</p>
          <div className="row center-row">
            <Link href="/create" className="btn btn-primary">
              Create your first
            </Link>
            <button className="btn btn-ghost" onClick={loadSamples}>
              Load sample commitments
            </button>
          </div>
        </div>
      ) : (
        <div className="stack">
          {list.map((c) => {
            const st = effectiveStatus(c);
            const record = disputeRecords[c.id];
            const pct = Math.round(progressOf(c) * 100);
            const shown = st === 'settled' || st === 'exited' ? 100 : pct;
            const left =Math.max(0, Math.ceil((maturityOf(c) - Date.now()) / 86_400_000));
            const frozen = st === 'disputed' || st === 'violated';
            const ownerIsConnected = !!address && c.owner === address;
            return (
              <article className="card commit" key={c.id}>
                <div className="row between wrap">
                  <div>
                    <h3>
                      {fmt(c.amount)} {c.asset}{' '}
                      <span className={`badge ${st}`}>{st}</span>
                      {c.demo && <span className="badge demo">demo</span>}
                    </h3>
                    <p className="muted small">
                      {/^\d+$/.test(c.id) ? (
                        <Link
                          href={`/commitments/${c.id}`}
                          className="link"
                          title={`View on-chain commitment #${c.id}`}
                        >
                          #{c.id}
                        </Link>
                      ) : (
                        <span>{c.id}</span>
                      )}{' '}
                      &middot; {specFor(c.type).name} &middot; {c.apy}% APY &middot; max
                      loss {c.maxLoss}%
                    </p>
                    {frozen && record && (
                      <p className="muted small">
                        Reported by {shortAddress(record.disputedBy)} on{' '}
                        {new Date(record.disputedAt).toLocaleDateString()}{' '}
                        — {DISPUTE_CATEGORY_LABELS[record.reasonCategory]}.
                      </p>
                    )}
                    {frozen && !record && (
                      <p className="muted small">
                        Funds are frozen. Loading the dispute record...
                      </p>
                    )}
                  </div>
                  <div className="row">
                    {!frozen && st === 'matured' && (
                      <button
                        className="btn btn-primary"
                        onClick={() => {
                          update(c.id, { status: 'settled' });
                          setAnnouncement(`Commitment ${c.id} settled`);
                        }}
                      >
                        Settle
                      </button>
                    )}
                    {!frozen && st === 'active' && (
                      <button
                        className="btn btn-ghost"
                        onClick={() => setPending({ kind: 'exit', id: c.id })}
                      >
                        Early exit
                      </button>
                    )}
                    {!frozen && (st === 'active' || st === 'matured') && (
                      <button
                        className="btn btn-ghost"
                        disabled={!ownerIsConnected || !address}
                        onClick={() => handleReportProblem(c)}
                      >
                        Report a problem
                      </button>
                    )}
                    {(st === 'settled' || st === 'exited') && (
                      <button
                        className="btn btn-ghost"
                        onClick={() => setPending({ kind: 'remove', id: c.id })}
                      >
                        Remove
                      </button>
                    )}
                    {frozen && (
                      <button
                        className="btn btn-ghost"
                        disabled
                        title="Funds are frozen until an operator resolves the dispute."
                      >
                        Frozen
                      </button>
                    )}
                  </div>
                </div>
                <div
                  className="bar"
                  role="progressbar"
                  aria-label={`Lock progress for ${c.id}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={shown}
                  aria-valuetext={
                    st === 'active'
                      ? `${pct}% elapsed, ${left} day${left === 1 ? '' : 's'} left`
                      : st === 'matured'
                        ? '100% elapsed, matured'
                        : st === 'settled'
                          ? 'Settled'
                          : st === 'disputed'
                            ? 'Frozen — disputed, pending operator resolution'
                            : st === 'violated'
                              ? 'Frozen — violated, pending operator resolution'
                              : 'Exited early'
                  }
                >
                  <div style={{ width: `${shown}%` }} />
                </div>
                <p className="muted small">
                  {st === 'active'
                    ? `${pct}% elapsed, ${left} day${left === 1 ? '' : 's'} to maturity`
                    : st === 'matured'
                      ? `Matured. Projected payout ${fmt(c.amount + projectedYield(c))} ${c.asset}`
                      : st === 'settled'
                        ? `Settled with ${fmt(projectedYield(c))} ${c.asset} yield`
                        : st === 'disputed' || st === 'violated'
                          ? `Frozen. Only the operator can release or refund the funds after resolving the dispute.`
                          : `Exited early, ${fmt(exitBreakdown(c).penaltyAmount)} ${c.asset} penalty paid`}
                </p>
              </article>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!pending && !!target}
        title={pending?.kind === 'exit' ? 'Exit early?' : 'Remove commitment?'}
        description={
          pending?.kind === 'exit'
            ? 'Exiting early forfeits part of your principal and cannot be undone.'
            : target
              ? `Remove ${target.id} from your dashboard. This cannot be undone.`
              : undefined
        }
        confirmLabel={pending?.kind === 'exit' ? 'Exit early' : 'Remove'}
        cancelLabel="Keep commitment"
        destructive
        onConfirm={confirmPending}
        onCancel={() => setPending(null)}
      >
        {pending?.kind === 'exit' && target && breakdown && (
          <dl className="dialog-breakdown">
            <dt>Principal</dt>
            <dd>
              {fmt(breakdown.principal)} {target.asset}
            </dd>
            <dt>Penalty</dt>
            <dd>{breakdown.penaltyPct}%</dd>
            <dt>Penalty amount</dt>
            <dd>
              {fmt(breakdown.penaltyAmount)} {target.asset}
            </dd>
            <dt>Amount returned</dt>
            <dd>
              {fmt(breakdown.returned)} {target.asset}
            </dd>
          </dl>
        )}
      </ConfirmDialog>

      {disputeError != null && (
        <div className="notice" role="alert">
          <TxErrorNotice error={disputeError} />
          <button
            className="btn btn-ghost btn-sm"
            style={{ marginLeft: '10px' }}
            onClick={() => setDisputeError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {disputeDialog && (
        <DisputeDialog
          open
          commitment={disputeDialog}
          onClose={() => setDisputeDialog(null)}
          onSuccess={handleDisputeOpened}
        />
      )}

      <div className="row between wrap mt">
        <h2>Recent activity</h2>
        <Link href="/activity" className="btn btn-ghost small">
          View all activity &rarr;
        </Link>
      </div>
      {!address ? (
        <div className="card center">
          <p className="muted">Connect your wallet to see your recent contract activity.</p>
        </div>
      ) : eventsLoading ? (
        <div className="card center">
          <p className="muted">Loading recent on-chain events...</p>
        </div>
      ) : eventsError ? (
        <div className="card center">
          <p className="error-text small">{eventsError}</p>
        </div>
      ) : recentEvents.length === 0 ? (
        <div className="card center">
          <p className="muted">No recent on-chain activity found for your address.</p>
        </div>
      ) : (
        <div className="stack">
          {recentEvents.map((ev) => (
            <div key={ev.id} className="card row between wrap">
              <div className="row gap">
                <span className={`badge ${ev.kind}`}>{ev.kind}</span>
                <span>
                  {ev.commitmentId ? (
                    <Link
                      href={`/commitments/${ev.commitmentId}`}
                      className="link"
                      title={`View Commitment #${ev.commitmentId}`}
                    >
                      Commitment #{ev.commitmentId}
                    </Link>
                  ) : (
                    'Contract Action'
                  )}
                </span>
                {ev.amount && <b className="small">{fmt(Number(ev.amount))} XLM</b>}
              </div>
              <div className="row gap muted small">
                <span>{new Date(ev.at).toLocaleDateString()}</span>
                {ev.txHash && (
                  <a
                    href={explorerTx(ev.txHash)}
                    target="_blank"
                    rel="noreferrer"
                    className="link"
                  >
                    tx
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
