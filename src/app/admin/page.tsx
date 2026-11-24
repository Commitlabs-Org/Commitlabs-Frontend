'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useWallet } from '@/components/WalletProvider';
import { useProtocolStatus } from '@/components/ProtocolStatusProvider';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { TxErrorNotice } from '@/components/TxErrorNotice';
import {
  getAdmin,
  getPendingAdmin,
  getGracePeriod,
  getViolationThreshold,
  getIsPaused,
  pause,
  unpause,
  setFeeRecipient,
  setGracePeriod,
  setViolationThreshold,
  proposeAdmin,
  cancelAdminProposal,
  validateGracePeriod,
  validateViolationThreshold,
  validateAddress,
  MAX_LOCK_DURATION_SECONDS,
} from '@/lib/soroban/admin';

export default function AdminPage() {
  const { status: walletStatus, address } = useWallet();
  const { refresh: refreshProtocolStatus } = useProtocolStatus();

  const [adminAddress, setAdminAddress] = useState<string | null>(null);
  const [pendingAdminAddress, setPendingAdminAddress] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [gracePeriod, setGracePeriodState] = useState<bigint | null>(null);
  const [violationThreshold, setViolationThresholdState] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Form states
  const [gracePeriodInput, setGracePeriodInput] = useState('');
  const [thresholdInput, setThresholdInput] = useState('');
  const [feeRecipientInput, setFeeRecipientInput] = useState('');
  const [newAdminInput, setNewAdminInput] = useState('');

  // Form validation errors
  const [gracePeriodErr, setGracePeriodErr] = useState<string | null>(null);
  const [thresholdErr, setThresholdErr] = useState<string | null>(null);
  const [feeRecipientErr, setFeeRecipientErr] = useState<string | null>(null);
  const [newAdminErr, setNewAdminErr] = useState<string | null>(null);

  // Active confirmation dialog
  type DialogAction =
    | { type: 'pause' }
    | { type: 'unpause' }
    | { type: 'grace_period'; value: bigint }
    | { type: 'threshold'; value: number }
    | { type: 'fee_recipient'; value: string }
    | { type: 'propose_admin'; value: string }
    | { type: 'cancel_admin' };

  const [activeDialog, setActiveDialog] = useState<DialogAction | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [txError, setTxError] = useState<unknown | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchAdminData = useCallback(async () => {
    try {
      const [admin, pendingAdmin, paused, grace, threshold] = await Promise.all([
        getAdmin(),
        getPendingAdmin(),
        getIsPaused(),
        getGracePeriod(),
        getViolationThreshold(),
      ]);
      setAdminAddress(admin);
      setPendingAdminAddress(pendingAdmin);
      setIsPaused(Boolean(paused));
      setGracePeriodState(grace);
      setViolationThresholdState(threshold);
    } catch (err) {
      // Keep existing data on read failure
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAdminData();
  }, [fetchAdminData]);

  const isConnected = walletStatus === 'connected' && Boolean(address);
  const isAdmin =
    isConnected &&
    Boolean(adminAddress) &&
    Boolean(address) &&
    adminAddress!.toUpperCase() === address!.toUpperCase();

  const handleConfirmAction = async () => {
    if (!activeDialog || !address) return;
    setIsSubmitting(true);
    setTxError(null);
    setSuccessMessage(null);

    try {
      switch (activeDialog.type) {
        case 'pause':
          await pause(address);
          await refreshProtocolStatus();
          setSuccessMessage('Protocol paused successfully.');
          break;
        case 'unpause':
          await unpause(address);
          await refreshProtocolStatus();
          setSuccessMessage('Protocol unpaused successfully.');
          break;
        case 'grace_period':
          await setGracePeriod({ gracePeriodSeconds: activeDialog.value, caller: address });
          setGracePeriodInput('');
          setSuccessMessage(`Grace period updated to ${activeDialog.value.toString()} seconds.`);
          break;
        case 'threshold':
          await setViolationThreshold({ threshold: activeDialog.value, caller: address });
          setThresholdInput('');
          setSuccessMessage(`Violation threshold updated to ${activeDialog.value}%.`);
          break;
        case 'fee_recipient':
          await setFeeRecipient({ newFeeRecipient: activeDialog.value, caller: address });
          setFeeRecipientInput('');
          setSuccessMessage(`Fee recipient updated to ${activeDialog.value}.`);
          break;
        case 'propose_admin':
          await proposeAdmin({ newAdmin: activeDialog.value, caller: address });
          setNewAdminInput('');
          setSuccessMessage(`Admin proposal submitted for ${activeDialog.value}.`);
          break;
        case 'cancel_admin':
          await cancelAdminProposal(address);
          setSuccessMessage('Admin proposal cancelled successfully.');
          break;
      }
      setActiveDialog(null);
      await fetchAdminData();
    } catch (err) {
      setTxError(err);
      setActiveDialog(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="page container narrow">
      <div className="section">
        <h1>Protocol Administration</h1>
        <p className="lead">
          {isAdmin
            ? 'Operator controls for emergency halts, parameters, fee routing, and ownership handover.'
            : 'Read-only view of protocol status and administrative parameters.'}
        </p>

        {txError != null && (
          <div style={{ marginBottom: '20px' }}>
            <TxErrorNotice error={txError} />
          </div>
        )}

        {successMessage && (
          <div className="notice" role="status" style={{ borderColor: 'var(--ok)', color: 'var(--ok)', background: 'var(--ok-soft)' }}>
            <p>{successMessage}</p>
          </div>
        )}

        {/* Read-only status summary */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <h2>Current Protocol Status</h2>
          <ul className="kv">
            <li>
              <span>Contract Status</span>
              <strong style={{ color: isPaused ? 'var(--danger)' : 'var(--ok)' }}>
                {loading ? 'Loading...' : isPaused ? 'Paused' : 'Active'}
              </strong>
            </li>
            <li>
              <span>Current Admin</span>
              <code>{loading ? 'Loading...' : adminAddress ?? 'Not initialized'}</code>
            </li>
            <li>
              <span>Pending Admin</span>
              <code>{loading ? 'Loading...' : pendingAdminAddress ?? 'None'}</code>
            </li>
            <li>
              <span>Grace Period</span>
              <span>{loading ? 'Loading...' : gracePeriod !== null ? `${gracePeriod.toString()} seconds` : 'Default'}</span>
            </li>
            <li>
              <span>Violation Threshold</span>
              <span>{loading ? 'Loading...' : violationThreshold !== null ? `${violationThreshold}%` : '0%'}</span>
            </li>
          </ul>

          {!isAdmin && (
            <div className="notice" style={{ marginTop: '16px' }} role="status">
              <p>
                {!isConnected
                  ? 'Connect your wallet to access administrative controls.'
                  : 'Your connected wallet is not the contract administrator. Administrative write controls are disabled.'}
              </p>
            </div>
          )}
        </div>

        {/* Admin write controls */}
        {isAdmin && (
          <div className="stack">
            {/* Pause / Unpause */}
            <div className="card">
              <h3>Protocol Circuit Breaker</h3>
              <p className="muted small">
                {isPaused
                  ? 'The contract is currently paused. Write operations are disabled.'
                  : 'The contract is currently active. Emergency pause will disable new commitments, funding, and early exits.'}
              </p>
              <div style={{ marginTop: '16px' }}>
                <button
                  type="button"
                  className={`btn ${isPaused ? 'btn-primary' : 'btn-danger'}`}
                  onClick={() => setActiveDialog({ type: isPaused ? 'unpause' : 'pause' })}
                >
                  {isPaused ? 'Unpause Protocol' : 'Pause Protocol'}
                </button>
              </div>
            </div>

            {/* Grace Period Form */}
            <div className="card">
              <h3>Penalty-Free Grace Period</h3>
              <p className="muted small">
                Configure the duration before commitment maturity during which early exits incur no penalty (max {MAX_LOCK_DURATION_SECONDS.toString()}s / 365 days).
              </p>
              <form
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  const res = validateGracePeriod(gracePeriodInput);
                  if (!res.valid || res.value === undefined) {
                    setGracePeriodErr(res.error ?? 'Invalid grace period.');
                    return;
                  }
                  setGracePeriodErr(null);
                  setActiveDialog({ type: 'grace_period', value: res.value });
                }}
                style={{ marginTop: '16px' }}
              >
                <div className="field">
                  <label htmlFor="grace-period-input">Grace Period (seconds)</label>
                  <input
                    id="grace-period-input"
                    type="number"
                    min="0"
                    max={MAX_LOCK_DURATION_SECONDS.toString()}
                    value={gracePeriodInput}
                    onChange={(e) => {
                      setGracePeriodInput(e.target.value);
                      if (gracePeriodErr) setGracePeriodErr(null);
                    }}
                    placeholder="e.g. 86400"
                    aria-invalid={!!gracePeriodErr}
                    aria-describedby={gracePeriodErr ? 'grace-period-error' : undefined}
                  />
                  {gracePeriodErr && (
                    <span id="grace-period-error" className="err small" role="alert">
                      {gracePeriodErr}
                    </span>
                  )}
                </div>
                <div style={{ marginTop: '12px' }}>
                  <button type="submit" className="btn btn-primary" disabled={!gracePeriodInput.trim()}>
                    Update Grace Period
                  </button>
                </div>
              </form>
            </div>

            {/* Violation Threshold Form */}
            <div className="card">
              <h3>Compliance Violation Threshold</h3>
              <p className="muted small">
                Minimum attestation score (0..=100) below which commitments are automatically frozen as violated.
              </p>
              <form
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  const res = validateViolationThreshold(thresholdInput);
                  if (!res.valid || res.value === undefined) {
                    setThresholdErr(res.error ?? 'Invalid threshold.');
                    return;
                  }
                  setThresholdErr(null);
                  setActiveDialog({ type: 'threshold', value: res.value });
                }}
                style={{ marginTop: '16px' }}
              >
                <div className="field">
                  <label htmlFor="threshold-input">Violation Threshold (0..=100)</label>
                  <input
                    id="threshold-input"
                    type="number"
                    min="0"
                    max="100"
                    value={thresholdInput}
                    onChange={(e) => {
                      setThresholdInput(e.target.value);
                      if (thresholdErr) setThresholdErr(null);
                    }}
                    placeholder="e.g. 80"
                    aria-invalid={!!thresholdErr}
                    aria-describedby={thresholdErr ? 'threshold-error' : undefined}
                  />
                  {thresholdErr && (
                    <span id="threshold-error" className="err small" role="alert">
                      {thresholdErr}
                    </span>
                  )}
                </div>
                <div style={{ marginTop: '12px' }}>
                  <button type="submit" className="btn btn-primary" disabled={!thresholdInput.trim()}>
                    Update Violation Threshold
                  </button>
                </div>
              </form>
            </div>

            {/* Fee Recipient Form */}
            <div className="card">
              <h3>Protocol Fee Recipient</h3>
              <p className="muted small">
                Designate the Stellar account or contract address that receives protocol dispute and exit penalties.
              </p>
              <form
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  const res = validateAddress(feeRecipientInput, 'Fee recipient');
                  if (!res.valid || !res.value) {
                    setFeeRecipientErr(res.error ?? 'Invalid address.');
                    return;
                  }
                  setFeeRecipientErr(null);
                  setActiveDialog({ type: 'fee_recipient', value: res.value });
                }}
                style={{ marginTop: '16px' }}
              >
                <div className="field">
                  <label htmlFor="fee-recipient-input">New Fee Recipient Address</label>
                  <input
                    id="fee-recipient-input"
                    type="text"
                    value={feeRecipientInput}
                    onChange={(e) => {
                      setFeeRecipientInput(e.target.value);
                      if (feeRecipientErr) setFeeRecipientErr(null);
                    }}
                    placeholder="G... or C..."
                    aria-invalid={!!feeRecipientErr}
                    aria-describedby={feeRecipientErr ? 'fee-recipient-error' : undefined}
                  />
                  {feeRecipientErr && (
                    <span id="fee-recipient-error" className="err small" role="alert">
                      {feeRecipientErr}
                    </span>
                  )}
                </div>
                <div style={{ marginTop: '12px' }}>
                  <button type="submit" className="btn btn-primary" disabled={!feeRecipientInput.trim()}>
                    Update Fee Recipient
                  </button>
                </div>
              </form>
            </div>

            {/* Two-Step Admin Handover Form */}
            <div className="card">
              <h3>Two-Step Admin Handover</h3>
              <p className="muted small">
                Transfer contract administrator rights. The proposed admin must accept the nomination before the transfer takes effect.
              </p>

              {pendingAdminAddress ? (
                <div style={{ margin: '16px 0', padding: '12px', background: 'var(--bg2)', borderRadius: '10px' }}>
                  <div className="row between" style={{ flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <span className="muted small" style={{ display: 'block' }}>Pending Admin Proposal</span>
                      <code>{pendingAdminAddress}</code>
                    </div>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => setActiveDialog({ type: 'cancel_admin' })}
                    >
                      Cancel Admin Proposal
                    </button>
                  </div>
                </div>
              ) : null}

              <form
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  const res = validateAddress(newAdminInput, 'New admin');
                  if (!res.valid || !res.value) {
                    setNewAdminErr(res.error ?? 'Invalid address.');
                    return;
                  }
                  setNewAdminErr(null);
                  setActiveDialog({ type: 'propose_admin', value: res.value });
                }}
                style={{ marginTop: '16px' }}
              >
                <div className="field">
                  <label htmlFor="new-admin-input">Propose New Admin Address</label>
                  <input
                    id="new-admin-input"
                    type="text"
                    value={newAdminInput}
                    onChange={(e) => {
                      setNewAdminInput(e.target.value);
                      if (newAdminErr) setNewAdminErr(null);
                    }}
                    placeholder="G... or C..."
                    aria-invalid={!!newAdminErr}
                    aria-describedby={newAdminErr ? 'new-admin-error' : undefined}
                  />
                  {newAdminErr && (
                    <span id="new-admin-error" className="err small" role="alert">
                      {newAdminErr}
                    </span>
                  )}
                </div>
                <div style={{ marginTop: '12px' }}>
                  <button type="submit" className="btn btn-primary" disabled={!newAdminInput.trim()}>
                    Propose Admin
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={activeDialog !== null}
        title={
          activeDialog?.type === 'pause'
            ? 'Pause Protocol Writes?'
            : activeDialog?.type === 'unpause'
              ? 'Resume Protocol Writes?'
              : activeDialog?.type === 'grace_period'
                ? 'Update Grace Period?'
                : activeDialog?.type === 'threshold'
                  ? 'Update Violation Threshold?'
                  : activeDialog?.type === 'fee_recipient'
                    ? 'Update Fee Recipient?'
                    : activeDialog?.type === 'propose_admin'
                      ? 'Propose New Admin?'
                      : activeDialog?.type === 'cancel_admin'
                        ? 'Cancel Admin Proposal?'
                        : 'Confirm Action'
        }
        description={
          activeDialog?.type === 'pause'
            ? 'Emergency pause halts all write operations (new commitments, funding, early exits). Matured releases remain unaffected.'
            : activeDialog?.type === 'unpause'
              ? 'This will resume normal contract operations and allow write transactions again.'
              : activeDialog?.type === 'grace_period'
                ? `Set the penalty-free grace period before maturity to ${activeDialog.value.toString()} seconds?`
                : activeDialog?.type === 'threshold'
                  ? `Set the automatic freeze compliance threshold to ${activeDialog.value}%?`
                  : activeDialog?.type === 'fee_recipient'
                    ? `Set the protocol penalty fee recipient address to ${activeDialog.value}?`
                    : activeDialog?.type === 'propose_admin'
                      ? `Propose ${activeDialog.value} as the contract admin? You will remain admin until they accept.`
                      : activeDialog?.type === 'cancel_admin'
                        ? `Cancel the pending admin nomination for ${pendingAdminAddress}?`
                        : undefined
        }
        confirmLabel={activeDialog?.type === 'pause' ? 'Pause' : 'Confirm'}
        destructive={activeDialog?.type === 'pause' || activeDialog?.type === 'cancel_admin'}
        pending={isSubmitting}
        onConfirm={handleConfirmAction}
        onCancel={() => {
          if (!isSubmitting) setActiveDialog(null);
        }}
      />
    </div>
  );
}
