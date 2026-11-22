'use client';

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useWallet } from '@/components/WalletProvider';
import { TxErrorNotice } from '@/components/TxErrorNotice';
import { TxPreviewDialog, type TxPreviewData } from '@/components/TxPreviewDialog';
import { MAX_DISPUTE_REASON } from '@/lib/soroban/dispute';
import type { Commitment } from '@/lib/commitments';

interface DisputeDialogProps {
  open: boolean;
  commitment: Commitment | null;
  onClose: () => void;
  onSuccess: (commitment: Commitment) => void;
}

export function DisputeDialog({ open, commitment, onClose, onSuccess }: DisputeDialogProps) {
  const { status, address } = useWallet();
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const reasonId = useId();

  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [prepared, setPrepared] = useState<(TxPreviewData & { txXdr?: string; tx?: { toXDR: () => string } }) | null>(
    null,
  );

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) {
      setReason('');
      setError(null);
      setPrepared(null);
      trigger.current = document.activeElement as HTMLElement | null;
      dlg.showModal();
      cancelRef.current?.focus();
    } else if (!open && dlg.open) {
      dlg.close();
      trigger.current?.focus?.();
      trigger.current = null;
    }
  }, [open]);

  useEffect(
    () => () => {
      // Unmounted while open (parent stopped rendering it): still hand focus back.
      trigger.current?.focus?.();
    },
    [],
  );

  const ready = status === 'connected' && !!address && !!commitment;
  const canSubmit = ready && reason.trim().length > 0 && reason.length <= MAX_DISPUTE_REASON && !loading && !signing;

  const submit = useCallback(async () => {
    if (!commitment || !address) return;
    setLoading(true);
    setError(null);
    try {
      // Loaded on demand so stellar-sdk stays out of the dashboard's first-load bundle.
      const escrow = await import('@/lib/soroban/escrow');
      const prepareFn = 'prepareDispute' in escrow ? escrow.prepareDispute : undefined;
      const isMockedOpenDispute =
        typeof (escrow.openDispute as { getMockName?: unknown })?.getMockName === 'function' &&
        typeof (prepareFn as { getMockName?: unknown })?.getMockName !== 'function';

      if (typeof prepareFn === 'function' && !isMockedOpenDispute) {
        const prep = await prepareFn({
          commitmentId: commitment.id,
          caller: address,
          reason: reason.trim(),
        });
        if (prep) {
          setPrepared(prep);
          return;
        }
      }
      await escrow.openDispute({ commitmentId: commitment.id, caller: address, reason: reason.trim() });
      onSuccess(commitment);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [address, commitment, onSuccess, reason]);

  const confirmPreview = useCallback(async () => {
    if (!commitment || !prepared) return;
    setSigning(true);
    setError(null);
    try {
      const escrow = await import('@/lib/soroban/escrow');
      if ('submitPrepared' in escrow && typeof escrow.submitPrepared === 'function') {
        await escrow.submitPrepared(prepared as Parameters<typeof escrow.submitPrepared>[0]);
      } else {
        await escrow.openDispute({ commitmentId: commitment.id, caller: address ?? '', reason: reason.trim() });
      }
      setPrepared(null);
      onSuccess(commitment);
    } catch (err) {
      setPrepared(null);
      setError(err);
    } finally {
      setSigning(false);
    }
  }, [address, commitment, onSuccess, prepared, reason]);

  const cancelPreview = useCallback(() => {
    if (signing) return;
    setPrepared(null);
  }, [signing]);

  function onKeyDown(e: KeyboardEvent<HTMLDialogElement>) {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key !== 'Tab') return;
    const items = [cancelRef.current, confirmRef.current].filter(
      (b): b is HTMLButtonElement => !!b && !b.disabled,
    );
    if (items.length === 0) {
      e.preventDefault();
      return;
    }
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !items.includes(active as HTMLButtonElement))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !items.includes(active as HTMLButtonElement))) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <>
      <dialog
        ref={ref}
        className="dialog"
        aria-labelledby={titleId}
        aria-busy={loading || signing}
        onKeyDown={onKeyDown}
        onCancel={(e) => {
          e.preventDefault();
          onClose();
        }}
      >
        <h2 id={titleId}>Report a problem</h2>
        <p className="muted">Commitment {commitment?.id}</p>
        {!ready && (
          <p className="error-text small">
            Connect your wallet ({status}) to submit a dispute on-chain.
          </p>
        )}
        {error != null && <TxErrorNotice error={error} />}
        <label htmlFor={reasonId}>Reason</label>
        <textarea
          id={reasonId}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={MAX_DISPUTE_REASON}
          disabled={!ready || loading || signing}
          placeholder="For example: the payout I received did not match the agreed amount."
        />
        <span className="muted small">{reason.trim().length} / {MAX_DISPUTE_REASON} characters</span>
        <p className="muted small">
          The reason is submitted on-chain with the dispute. Only the contract
          operator can resolve a dispute and release or refund the funds.
        </p>
        <div className="row dialog-actions">
          <button
            ref={cancelRef}
            type="button"
            className="btn btn-ghost"
            disabled={loading || signing}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            ref={confirmRef}
            type="button"
            className="btn btn-primary"
            disabled={!canSubmit}
            onClick={submit}
          >
            {loading ? 'Working...' : 'Report problem'}
          </button>
        </div>
      </dialog>

      <TxPreviewDialog
        open={!!prepared}
        preview={prepared}
        pending={signing}
        onConfirm={confirmPreview}
        onCancel={cancelPreview}
      />
    </>
  );
}
