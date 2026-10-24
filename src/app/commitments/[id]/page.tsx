'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  validateCommitmentId,
  getCommitment,
  getAttestations,
  getDispute,
  isNotFoundError,
  formatRelativeTime,
  formatAbsoluteTime,
  shortenAddress,
  OnChainCommitment,
  OnChainAttestation,
  OnChainDispute,
} from '@/lib/soroban/read';
import {
  config,
  ESCROW_CONTRACT_ID,
  explorerAccount,
  explorerContractUrl,
} from '@/lib/config';
import { Skeleton } from '@/components/Skeleton';

interface PageProps {
  params: {
    id: string;
  };
}

export default function CommitmentDetailPage({ params }: PageProps) {
  const rawId = params?.id ?? '';
  const validation = validateCommitmentId(rawId);

  const [loading, setLoading] = useState(validation.valid);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [commitment, setCommitment] = useState<OnChainCommitment | null>(null);
  const [attestations, setAttestations] = useState<OnChainAttestation[]>([]);
  const [dispute, setDispute] = useState<OnChainDispute | null>(null);

  const fetchData = useCallback(async () => {
    if (!validation.valid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setNotFound(false);
    setError(null);

    try {
      const [cRecord, aRecords, dRecord] = await Promise.all([
        getCommitment(rawId),
        getAttestations(rawId).catch(() => []),
        getDispute(rawId).catch(() => null),
      ]);

      setCommitment(cRecord);
      setAttestations(aRecords);
      setDispute(dRecord);
    } catch (err: unknown) {
      if (isNotFoundError(err)) {
        setNotFound(true);
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg || 'Failed to load commitment from on-chain escrow.');
      }
    } finally {
      setLoading(false);
    }
  }, [rawId, validation.valid]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // State 1: Invalid ID format (Validation failure without calling RPC)
  if (!validation.valid) {
    return (
      <main className="container narrow page" role="main">
        <div className="card center">
          <div className="error-boundary-icon" aria-hidden="true">
            !
          </div>
          <h1>Invalid Commitment ID</h1>
          <p className="err small" style={{ margin: '12px 0 20px', fontSize: '1rem' }}>
            {validation.error}
          </p>
          <div className="row center-row mt">
            <Link href="/dashboard" className="btn btn-primary">
              &larr; Back to Dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // State 2: Loading Skeleton
  if (loading) {
    return (
      <main className="container page" role="main" aria-busy="true" aria-label="Loading commitment">
        <div className="row between wrap">
          <div>
            <Skeleton width={260} height={36} />
            <div style={{ marginTop: '8px' }}>
              <Skeleton width={180} height={20} />
            </div>
          </div>
          <Skeleton width={120} height={32} borderRadius={999} />
        </div>

        <div className="grid3 mt">
          <div className="card">
            <Skeleton width="60%" height={24} />
            <div style={{ marginTop: '16px' }}>
              <Skeleton width="100%" height={16} />
              <div style={{ marginTop: '8px' }}>
                <Skeleton width="80%" height={16} />
              </div>
            </div>
          </div>
          <div className="card">
            <Skeleton width="60%" height={24} />
            <div style={{ marginTop: '16px' }}>
              <Skeleton width="100%" height={16} />
              <div style={{ marginTop: '8px' }}>
                <Skeleton width="80%" height={16} />
              </div>
            </div>
          </div>
          <div className="card">
            <Skeleton width="60%" height={24} />
            <div style={{ marginTop: '16px' }}>
              <Skeleton width="100%" height={16} />
              <div style={{ marginTop: '8px' }}>
                <Skeleton width="80%" height={16} />
              </div>
            </div>
          </div>
        </div>

        <div className="card mt">
          <Skeleton width={200} height={28} />
          <div style={{ marginTop: '16px' }}>
            <Skeleton width="100%" height={60} />
          </div>
        </div>
      </main>
    );
  }

  // State 3: Not-Found State
  if (notFound) {
    return (
      <main className="container narrow page" role="main">
        <div className="card center">
          <div className="error-boundary-icon" aria-hidden="true" style={{ borderColor: 'var(--warn)', color: 'var(--warn)', background: 'rgba(251, 191, 36, 0.1)' }}>
            ?
          </div>
          <h1>Commitment Not Found</h1>
          <p className="muted" style={{ margin: '12px 0 20px', fontSize: '1.05rem' }}>
            No on-chain commitment exists with ID <b>#{rawId}</b> on the configured escrow contract.
          </p>
          <p className="small muted">
            It may have never been created, or was deployed to a different contract/network.
          </p>
          <div className="row center-row mt">
            <Link href="/dashboard" className="btn btn-primary">
              &larr; Return to Dashboard
            </Link>
            <Link href="/activity" className="btn btn-ghost">
              View Activity Log
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // State 4: Generic Error State with Retry
  if (error || !commitment) {
    return (
      <main className="container narrow page" role="main">
        <div className="card center">
          <div className="error-boundary-icon" aria-hidden="true">
            !
          </div>
          <h1>Error Loading Commitment</h1>
          <p className="err small" style={{ margin: '12px 0 16px' }}>
            {error || 'Unable to retrieve commitment record.'}
          </p>
          <div className="row center-row mt">
            <button className="btn btn-primary" onClick={fetchData}>
              Try Again
            </button>
            <Link href="/dashboard" className="btn btn-ghost">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // State 5: Loaded Commitment Detail View
  const st = commitment.status.toLowerCase();
  const metadataEntries = Object.entries(commitment.metadata);

  return (
    <main className="container page" role="main">
      {/* Header & Status Bar */}
      <div className="row between wrap" style={{ marginBottom: '24px' }}>
        <div>
          <div className="row gap" style={{ alignItems: 'baseline' }}>
            <h1>Commitment #{commitment.id}</h1>
            <span className={`badge ${st}`} style={{ fontSize: '0.85rem', padding: '4px 12px' }}>
              {commitment.status}
            </span>
          </div>
          <p className="muted small">
            On-chain escrow record &middot; Network:{' '}
            <b style={{ color: 'var(--text)' }}>{config.network}</b>
          </p>
        </div>
        <div className="row wrap">
          <Link href="/dashboard" className="btn btn-ghost">
            &larr; Dashboard
          </Link>
          {ESCROW_CONTRACT_ID && (
            <a
              href={explorerContractUrl(ESCROW_CONTRACT_ID)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-ghost"
              title="View Escrow Contract on Stellar.Expert"
            >
              Contract Explorer &rarr;
            </a>
          )}
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid4">
        <div className="card metric">
          <span className="muted small">LOCKED PRINCIPAL</span>
          <b style={{ fontSize: '1.5rem', wordBreak: 'break-all' }}>
            {commitment.amount.toLocaleString('en-US')}
          </b>
          <span className="muted small">Asset: {shortenAddress(commitment.asset)}</span>
        </div>

        <div className="card metric">
          <span className="muted small">ACCRUED YIELD</span>
          <b style={{ fontSize: '1.5rem', color: 'var(--ok)', wordBreak: 'break-all' }}>
            +{commitment.accruedYield.toLocaleString('en-US')}
          </b>
          <span className="muted small">Escrow yield allocation</span>
        </div>

        <div className="card metric">
          <span className="muted small">COMPLIANCE SCORE</span>
          <b
            style={{
              fontSize: '1.5rem',
              color:
                commitment.complianceScore >= 80
                  ? 'var(--ok)'
                  : commitment.complianceScore >= 50
                    ? 'var(--warn)'
                    : 'var(--danger)',
            }}
          >
            {commitment.complianceScore} / 100
          </b>
          <span className="muted small">
            {attestations.length} attestation{attestations.length === 1 ? '' : 's'} recorded
          </span>
        </div>

        <div className="card metric">
          <span className="muted small">RISK & PENALTY</span>
          <b style={{ fontSize: '1.5rem' }}>{commitment.risk}</b>
          <span className="muted small">
            Penalty: {(commitment.penaltyBps / 100).toFixed(2)}% ({commitment.penaltyBps} bps)
          </span>
        </div>
      </div>

      {/* Section: Terms & Specifications */}
      <section className="card mt" aria-labelledby="terms-heading">
        <h2 id="terms-heading">Commitment Terms</h2>
        <ul className="kv">
          <li>
            <span>Commitment ID</span>
            <code>#{commitment.id}</code>
          </li>
          <li>
            <span>Owner Address</span>
            <code>
              <a
                href={explorerAccount(commitment.owner)}
                target="_blank"
                rel="noopener noreferrer"
                className="link"
                title={commitment.owner}
                style={{ wordBreak: 'break-all' }}
              >
                {commitment.owner}
              </a>
            </code>
          </li>
          <li>
            <span>Asset Contract</span>
            <code>
              <a
                href={explorerContractUrl(commitment.asset)}
                target="_blank"
                rel="noopener noreferrer"
                className="link"
                title={commitment.asset}
                style={{ wordBreak: 'break-all' }}
              >
                {commitment.asset}
              </a>
            </code>
          </li>
          <li>
            <span>Locked Principal</span>
            <b>{commitment.amount.toLocaleString('en-US')} units</b>
          </li>
          <li>
            <span>Accrued Yield</span>
            <b style={{ color: 'var(--ok)' }}>
              +{commitment.accruedYield.toLocaleString('en-US')} units
            </b>
          </li>
          <li>
            <span>Risk Profile</span>
            <b>{commitment.risk}</b>
          </li>
          <li>
            <span>Early Exit Penalty</span>
            <b>
              {(commitment.penaltyBps / 100).toFixed(2)}% ({commitment.penaltyBps} basis points)
            </b>
          </li>
          <li>
            <span>Created At</span>
            <span>{formatAbsoluteTime(commitment.createdAt)}</span>
          </li>
          <li>
            <span>Maturity Date</span>
            <span>{formatAbsoluteTime(commitment.maturity)}</span>
          </li>
        </ul>
      </section>

      {/* Section: Timeline & Status Overview */}
      <section className="card mt" aria-labelledby="timeline-heading">
        <h2 id="timeline-heading">Status & Lifecycle Timeline</h2>
        <div className="row wrap" style={{ gap: '16px', margin: '16px 0' }}>
          <div
            style={{
              flex: '1 1 200px',
              padding: '12px 16px',
              borderRadius: '10px',
              background: 'var(--bg2)',
              border: '1px solid var(--line)',
            }}
          >
            <div className="step-n">STEP 1</div>
            <div style={{ fontWeight: 600 }}>Created</div>
            <div className="small muted">{formatAbsoluteTime(commitment.createdAt)}</div>
          </div>

          <div
            style={{
              flex: '1 1 200px',
              padding: '12px 16px',
              borderRadius: '10px',
              background: 'var(--bg2)',
              border: `1px solid ${st !== 'created' ? 'var(--accent)' : 'var(--line)'}`,
            }}
          >
            <div className="step-n">STEP 2</div>
            <div style={{ fontWeight: 600 }}>Funded</div>
            <div className="small muted">
              {st === 'created' ? 'Awaiting initial deposit' : 'Escrow funded & held'}
            </div>
          </div>

          <div
            style={{
              flex: '1 1 200px',
              padding: '12px 16px',
              borderRadius: '10px',
              background: 'var(--bg2)',
              border: `1px solid ${
                st === 'released'
                  ? 'var(--ok)'
                  : st === 'disputed' || st === 'violated'
                    ? 'var(--danger)'
                    : st === 'refunded'
                      ? 'var(--warn)'
                      : 'var(--line)'
              }`,
            }}
          >
            <div className="step-n">STEP 3</div>
            <div style={{ fontWeight: 600 }}>Current: {commitment.status}</div>
            <div className="small muted">
              {st === 'released'
                ? 'Matured and released to owner'
                : st === 'refunded'
                  ? 'Exited early with penalty paid'
                  : st === 'disputed'
                    ? 'Under formal dispute — transfers frozen'
                    : st === 'violated'
                      ? 'Compliance violation triggered'
                      : st === 'cancelled'
                        ? 'Cancelled prior to funding'
                        : 'Active lock until maturity'}
            </div>
          </div>
        </div>
      </section>

      {/* Section: Dispute Notice (Rendered ONLY when dispute exists) */}
      {dispute && (
        <section
          className="card mt"
          style={{ borderColor: 'var(--danger)', background: 'rgba(248, 113, 113, 0.05)' }}
          aria-labelledby="dispute-heading"
        >
          <div className="row between wrap">
            <h2 id="dispute-heading" style={{ color: 'var(--danger)', margin: 0 }}>
              Active Dispute
            </h2>
            <span className="badge disputed">DISPUTED</span>
          </div>
          <p className="small muted" style={{ marginTop: '8px' }}>
            This commitment is under formal dispute on-chain. State-changing token releases are
            frozen until administrative resolution.
          </p>

          <ul className="kv mt">
            <li>
              <span>Reason Category</span>
              <b style={{ color: 'var(--danger)' }}>{dispute.reasonCategory}</b>
            </li>
            <li>
              <span>Opened At</span>
              <span>{formatAbsoluteTime(dispute.disputedAt)}</span>
            </li>
            <li>
              <span>Disputed By</span>
              <code>
                <a
                  href={explorerAccount(dispute.disputedBy)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link"
                  style={{ wordBreak: 'break-all' }}
                >
                  {dispute.disputedBy}
                </a>
              </code>
            </li>
            <li>
              <span>Reason Details</span>
              <p
                style={{
                  margin: '4px 0',
                  color: 'var(--text)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {dispute.reasonText || 'No detail string provided.'}
              </p>
            </li>
          </ul>
        </section>
      )}

      {/* Section: Compliance & Attestations */}
      <section className="card mt" aria-labelledby="attestations-heading">
        <div className="row between wrap">
          <h2 id="attestations-heading" style={{ margin: 0 }}>
            Compliance Attestations
          </h2>
          <span className="small muted">
            {attestations.length} total attestation{attestations.length === 1 ? '' : 's'}
          </span>
        </div>

        {attestations.length === 0 ? (
          <div className="card center" style={{ marginTop: '16px', background: 'var(--bg2)' }}>
            <p className="muted">No compliance attestations recorded yet.</p>
            <p className="small muted">
              Attestations recorded by authorized oracles or keepers will appear here in chronological
              order.
            </p>
          </div>
        ) : (
          <div className="table-wrap mt">
            <table>
              <thead>
                <tr>
                  <th>Attestor</th>
                  <th>Score</th>
                  <th>Recorded (Relative)</th>
                  <th>Timestamp (UTC)</th>
                </tr>
              </thead>
              <tbody>
                {attestations.map((att, idx) => (
                  <tr key={`${att.attestor}-${att.timestamp.toString()}-${idx}`}>
                    <td>
                      <code>
                        <a
                          href={explorerAccount(att.attestor)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link"
                          title={att.attestor}
                        >
                          {shortenAddress(att.attestor)}
                        </a>
                      </code>
                    </td>
                    <td>
                      <span
                        className="badge"
                        style={{
                          borderColor:
                            att.complianceScore >= 80
                              ? 'var(--ok)'
                              : att.complianceScore >= 50
                                ? 'var(--warn)'
                                : 'var(--danger)',
                          color:
                            att.complianceScore >= 80
                              ? 'var(--ok)'
                              : att.complianceScore >= 50
                                ? 'var(--warn)'
                                : 'var(--danger)',
                        }}
                      >
                        {att.complianceScore} / 100
                      </span>
                    </td>
                    <td className="muted">{formatRelativeTime(att.timestamp)}</td>
                    <td className="small muted">{formatAbsoluteTime(att.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Section: Metadata (Arbitrary key/value pairs) */}
      {metadataEntries.length > 0 && (
        <section className="card mt" aria-labelledby="metadata-heading">
          <h2 id="metadata-heading">Commitment Metadata</h2>
          <ul className="kv">
            {metadataEntries.map(([key, val]) => (
              <li key={key}>
                <span style={{ wordBreak: 'break-word', maxWidth: '40%' }}>{key}</span>
                <span
                  style={{
                    color: 'var(--text)',
                    wordBreak: 'break-word',
                    textAlign: 'right',
                    maxWidth: '60%',
                  }}
                >
                  {val}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Section: Protocol Context */}
      <section className="card mt" aria-labelledby="protocol-heading">
        <h2 id="protocol-heading">Contract Verification</h2>
        <ul className="kv">
          <li>
            <span>Escrow Contract</span>
            <code>
              {ESCROW_CONTRACT_ID ? (
                <a
                  href={explorerContractUrl(ESCROW_CONTRACT_ID)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link"
                  style={{ wordBreak: 'break-all' }}
                >
                  {ESCROW_CONTRACT_ID}
                </a>
              ) : (
                'Unconfigured'
              )}
            </code>
          </li>
          <li>
            <span>Network Passphrase</span>
            <code style={{ wordBreak: 'break-all' }}>{config.passphrase}</code>
          </li>
          <li>
            <span>Soroban RPC Endpoint</span>
            <code>{config.sorobanRpcUrl}</code>
          </li>
        </ul>
      </section>
    </main>
  );
}
