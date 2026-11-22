'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { StrKey } from '@stellar/stellar-sdk';
import { formatAbsoluteTime, shortenAddress, type OnChainCommitment } from '@/lib/soroban/read';
import { explorerAccount } from '@/lib/config';
import { useWallet } from '@/components/WalletProvider';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { TxErrorNotice } from '@/components/TxErrorNotice';
import {
  getPendingOwner,
  proposeTransfer,
  acceptTransfer,
  cancelTransfer,
  type PendingTransferRecord,
} from '@/lib/soroban/escrow';

export interface TransferPanelProps {
  commitment: OnChainCommitment;
  onTransferred?: () => void;
}

export function formatCountdown(target: Date, from: number = Date.now()): string {
  const diffMs = target.getTime() - from;
  if (diffMs <= 0) return 'Expired';
  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

export function TransferPanel({ commitment, onTransferred }: TransferPanelProps) {
  // Panel renders ONLY for funded commitments, matching contract InvalidState rules
  if (commitment.status !== 'Funded') {
    return null;
  }

  const { address } = useWallet();

  const [pendingTransfer, setPendingTransfer] = useState<PendingTransferRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [newOwner, setNewOwner] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<'propose' | 'accept' | 'cancel' | null>(null);
  const [txPending, setTxPending] = useState(false);
  const [txError, setTxError] = useState<unknown | null>(null);
  const [now, setNow] = useState(Date.now());

  const loadPending = useCallback(async () => {
    try {
      const record = await getPendingOwner(commitment.id);
      setPendingTransfer(record);
    } catch {
      setPendingTransfer(null);
    } finally {
      setLoading(false);
    }
  }, [commitment.id]);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const isOwner = Boolean(address && address === commitment.owner);
  const isRecipient = Boolean(address && pendingTransfer && address === pendingTransfer.to);
  const isExpired = Boolean(pendingTransfer && pendingTransfer.expiresAt.getTime() <= now);

  const handleProposeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTxError(null);
    const trimmed = newOwner.trim();
    if (!trimmed) {
      setValidationError('Please enter a recipient Stellar address.');
      return;
    }
    if (!StrKey.isValidEd25519PublicKey(trimmed)) {
      setValidationError('Invalid Stellar address. Must be a valid 56-character G-address.');
      return;
    }
    if (trimmed === commitment.owner) {
      setValidationError('The proposed owner cannot be the current owner.');
      return;
    }
    setValidationError(null);
    setConfirmAction('propose');
  };

  const handleConfirmPropose = async () => {
    if (!address) return;
    setTxPending(true);
    setTxError(null);
    try {
      await proposeTransfer({
        commitmentId: commitment.id,
        caller: address,
        newOwner: newOwner.trim(),
      });
      setNewOwner('');
      setConfirmAction(null);
      await loadPending();
      onTransferred?.();
    } catch (err) {
      setTxError(err);
      setConfirmAction(null);
    } finally {
      setTxPending(false);
    }
  };

  const handleConfirmAccept = async () => {
    if (!address) return;
    setTxPending(true);
    setTxError(null);
    try {
      await acceptTransfer({
        commitmentId: commitment.id,
        caller: address,
      });
      setConfirmAction(null);
      await loadPending();
      onTransferred?.();
    } catch (err) {
      setTxError(err);
      setConfirmAction(null);
    } finally {
      setTxPending(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!address) return;
    setTxPending(true);
    setTxError(null);
    try {
      await cancelTransfer({
        commitmentId: commitment.id,
        caller: address,
      });
      setConfirmAction(null);
      await loadPending();
      onTransferred?.();
    } catch (err) {
      setTxError(err);
      setConfirmAction(null);
    } finally {
      setTxPending(false);
    }
  };

  return (
    <section className="card mt" aria-labelledby="transfer-heading" data-testid="transfer-panel">
      <div className="row between wrap">
        <h2 id="transfer-heading" style={{ margin: 0 }}>
          Ownership Transfer
        </h2>
        {pendingTransfer && (
          <span className={`badge ${isExpired ? 'disputed' : 'funded'}`}>
            {isExpired ? 'Offer Expired' : 'Transfer Pending'}
          </span>
        )}
      </div>

      {loading ? (
        <p className="small muted" style={{ marginTop: '12px' }}>
          Checking transfer status...
        </p>
      ) : isOwner ? (
        /* Role 1: Owner */
        !pendingTransfer ? (
          <div>
            <p className="small muted" style={{ marginTop: '8px' }}>
              Propose transferring ownership of this commitment to a new Stellar account. The recipient
              will have 7 days to accept.
            </p>
            <form onSubmit={handleProposeSubmit} noValidate style={{ marginTop: '16px' }}>
              <div style={{ marginBottom: '12px' }}>
                <label
                  htmlFor="newOwnerAddress"
                  className="small muted"
                  style={{ display: 'block', marginBottom: '6px' }}
                >
                  Proposed New Owner Address
                </label>
                <input
                  id="newOwnerAddress"
                  name="newOwner"
                  type="text"
                  className="input"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--line)',
                    background: 'var(--bg2)',
                    color: 'var(--text)',
                  }}
                  placeholder="G..."
                  value={newOwner}
                  onChange={(e) => {
                    setNewOwner(e.target.value);
                    if (validationError) setValidationError(null);
                  }}
                  aria-invalid={validationError ? 'true' : 'false'}
                />
              </div>

              {validationError && (
                <p
                  className="err small"
                  role="alert"
                  style={{ marginBottom: '12px', color: 'var(--danger)' }}
                >
                  {validationError}
                </p>
              )}

              <button type="submit" className="btn btn-primary" disabled={txPending}>
                Propose transfer
              </button>
            </form>
          </div>
        ) : (
          <div>
            <p className="small muted" style={{ marginTop: '8px' }}>
              An ownership transfer offer is currently pending for this commitment.
            </p>
            <ul className="kv mt">
              <li>
                <span>Proposed Recipient</span>
                <code>
                  <a
                    href={explorerAccount(pendingTransfer.to)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link"
                    title={pendingTransfer.to}
                    style={{ wordBreak: 'break-all' }}
                  >
                    {pendingTransfer.to}
                  </a>
                </code>
              </li>
              <li>
                <span>Expiry</span>
                <span>
                  {isExpired ? (
                    <b style={{ color: 'var(--danger)' }}>
                      Expired ({formatAbsoluteTime(pendingTransfer.rawExpiresAt)})
                    </b>
                  ) : (
                    <>
                      Expires in {formatCountdown(pendingTransfer.expiresAt, now)} (
                      {formatAbsoluteTime(pendingTransfer.rawExpiresAt)})
                    </>
                  )}
                </span>
              </li>
            </ul>

            {isExpired && (
              <p
                className="err small"
                role="alert"
                style={{ color: 'var(--danger)', margin: '12px 0' }}
              >
                The ownership transfer offer has expired (TransferExpired).
              </p>
            )}

            <div className="row wrap mt">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setConfirmAction('cancel')}
                disabled={txPending}
              >
                Cancel transfer
              </button>
            </div>
          </div>
        )
      ) : isRecipient && pendingTransfer ? (
        /* Role 2: Proposed Recipient */
        <div>
          <p className="small muted" style={{ marginTop: '8px' }}>
            You have been proposed as the new owner for this commitment.
          </p>
          <ul className="kv mt">
            <li>
              <span>Current Owner</span>
              <code>{shortenAddress(commitment.owner)}</code>
            </li>
            <li>
              <span>Expiry</span>
              <span>
                {isExpired ? (
                  <b style={{ color: 'var(--danger)' }}>
                    Expired ({formatAbsoluteTime(pendingTransfer.rawExpiresAt)})
                  </b>
                ) : (
                  <>
                    Expires in {formatCountdown(pendingTransfer.expiresAt, now)} (
                    {formatAbsoluteTime(pendingTransfer.rawExpiresAt)})
                  </>
                )}
              </span>
            </li>
          </ul>

          {isExpired ? (
            <p
              className="err small"
              role="alert"
              style={{ color: 'var(--danger)', margin: '12px 0' }}
            >
              The ownership transfer offer has expired (TransferExpired).
            </p>
          ) : (
            <div className="row wrap mt">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setConfirmAction('accept')}
                disabled={txPending}
              >
                Accept transfer
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Role 3: Stranger (no transfer controls) */
        <div>
          {pendingTransfer ? (
            <>
              <p className="small muted" style={{ marginTop: '8px' }}>
                A transfer offer is currently pending to <code>{shortenAddress(pendingTransfer.to)}</code>.
              </p>
              <ul className="kv mt">
                <li>
                  <span>Proposed Recipient</span>
                  <code>{shortenAddress(pendingTransfer.to)}</code>
                </li>
                <li>
                  <span>Expiry</span>
                  <span>
                    {isExpired ? (
                      <b style={{ color: 'var(--danger)' }}>
                        Expired ({formatAbsoluteTime(pendingTransfer.rawExpiresAt)})
                      </b>
                    ) : (
                      <>Expires in {formatCountdown(pendingTransfer.expiresAt, now)}</>
                    )}
                  </span>
                </li>
              </ul>
              {isExpired && (
                <p
                  className="err small"
                  role="alert"
                  style={{ color: 'var(--danger)', margin: '12px 0' }}
                >
                  The ownership transfer offer has expired (TransferExpired).
                </p>
              )}
            </>
          ) : (
            <p className="small muted" style={{ marginTop: '8px' }}>
              No active ownership transfer. Only the commitment owner can propose an ownership transfer.
            </p>
          )}
        </div>
      )}

      {Boolean(txError) && (
        <div style={{ marginTop: '16px' }}>
          <TxErrorNotice error={txError} />
        </div>
      )}

      <ConfirmDialog
        open={confirmAction === 'propose'}
        title="Propose Ownership Transfer"
        description={`Are you sure you want to propose transferring ownership of Commitment #${commitment.id} to ${newOwner.trim()}?`}
        confirmLabel="Propose Transfer"
        pending={txPending}
        onConfirm={handleConfirmPropose}
        onCancel={() => setConfirmAction(null)}
      />

      <ConfirmDialog
        open={confirmAction === 'accept'}
        title="Accept Ownership Transfer"
        description={`Are you sure you want to accept ownership of Commitment #${commitment.id}? You will become the new owner.`}
        confirmLabel="Accept Transfer"
        pending={txPending}
        onConfirm={handleConfirmAccept}
        onCancel={() => setConfirmAction(null)}
      />

      <ConfirmDialog
        open={confirmAction === 'cancel'}
        title="Cancel Ownership Transfer"
        description={`Are you sure you want to cancel the pending ownership transfer for Commitment #${commitment.id}?`}
        confirmLabel="Cancel Transfer"
        destructive
        pending={txPending}
        onConfirm={handleConfirmCancel}
        onCancel={() => setConfirmAction(null)}
      />
    </section>
  );
}
