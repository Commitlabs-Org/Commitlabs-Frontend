'use client';

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useWallet } from '@/components/WalletProvider';
import { TxErrorNotice } from '@/components/TxErrorNotice';
import type { Commitment } from '@/lib/commitments';
import {
  formatAmount,
  MIN_PARTIAL_WITHDRAWAL,
  MIN_REMAINING_PRINCIPAL,
  parseAmount,
  partialExitBreakdown,
  percentToBps,
  type PartialExitBreakdown,
} from '@/lib/amount';
import { isActionBlocked } from '@/lib/soroban/protocol-policy';

interface PartialExitDialogProps {
  open: boolean;
  commitment: Commitment | null;
  paused: boolean;
  onClose: () => void;
  onSuccess: (commitment: Commitment) => void;
}

function validationMessage(reason: string | undefined): string | null {
  switch (reason) {
    case 'empty':
      return 'Enter the amount you want to withdraw.';
    case 'invalid_characters':
      return 'Use digits and one decimal point only.';
    case 'too_many_decimals':
      return 'Use no more than 7 decimal places.';
    case 'zero':
      return 'Enter an amount greater than zero.';
    case 'above_max':
      return 'That amount is too large.';
    case 'below_minimum':
      return `Partial withdrawals must be at least ${formatAmount(MIN_PARTIAL_WITHDRAWAL)}.`;
    case 'remaining_below_minimum':
      return `Leave at least ${formatAmount(MIN_REMAINING_PRINCIPAL)} in the commitment, or withdraw the full principal.`;
    case 'invalid_withdrawal':
      return 'The withdrawal must be greater than zero and no more than the principal.';
    case 'invalid_principal':
      return 'This commitment has no withdrawable principal.';
    case 'invalid_penalty':
      return 'The commitment penalty is invalid.';
    default:
      return null;
  }
}

export function PartialExitDialog({
  open,
  commitment,
  paused,
  onClose,
  onSuccess,
}: PartialExitDialogProps) {
  const { status, address } = useWallet();
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const fired = useRef(false);
  const titleId = useId();
  const amountId = useId();
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      fired.current = false;
      setInput('');
      setError(null);
      trigger.current = document.activeElement as HTMLElement | null;
      dialog.showModal();
      cancelRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
      trigger.current?.focus?.();
      trigger.current = null;
    }
  }, [open]);

  useEffect(
    () => () => {
      trigger.current?.focus?.();
    },
    [],
  );

  const blocked = isActionBlocked('refund_partial', paused);
  const ready = status === 'connected' && !!address && !!commitment;
  const parsed = parseAmount(input);
  const breakdownResult =
    parsed.ok && commitment
      ? partialExitBreakdown(BigInt(commitment.amount), parsed.value, percentToBps(commitment.penalty))
      : null;
  const breakdown: PartialExitBreakdown | null =
    breakdownResult?.ok ? breakdownResult.value : null;
  const validationError = parsed.ok
    ? breakdownResult && !breakdownResult.ok
      ? validationMessage(breakdownResult.reason)
      : null
    : validationMessage(parsed.reason);
  const canSubmit = ready && !blocked && !!breakdown && !pending;

  const submit = useCallback(async () => {
    if (!canSubmit || !commitment || !address || !breakdown || fired.current) return;
    fired.current = true;
    setPending(true);
    setError(null);
    try {
      const { refundPartial } = await import('@/lib/soroban/escrow');
      await refundPartial({
        commitmentId: commitment.id,
        caller: address,
        amount: breakdown.withdrawal,
      });
      onSuccess({
        ...commitment,
        amount: breakdown.remaining.toString(),
        status: breakdown.remaining === 0n ? 'exited' : commitment.status,
      });
    } catch (err) {
      fired.current = false;
      setError(err);
    } finally {
      setPending(false);
    }
  }, [address, breakdown, canSubmit, commitment, onSuccess]);

  function onKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (!pending) onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = [cancelRef.current, confirmRef.current].filter(
      (button): button is HTMLButtonElement => !!button && !button.disabled,
    );
    if (!items.length) {
      event.preventDefault();
      return;
    }
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !items.includes(active as HTMLButtonElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !items.includes(active as HTMLButtonElement))) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={titleId}
      aria-busy={pending}
      onKeyDown={onKeyDown}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onClose();
      }}
    >
      <h2 id={titleId}>Partial exit</h2>
      <p className="muted">Commitment {commitment?.id}</p>
      {!ready && <p className="error-text small">Connect the wallet that owns this commitment.</p>}
      {blocked && <p className="error-text small">Partial refunds are temporarily paused.</p>}
      {error != null && <TxErrorNotice error={error} />}

      <label htmlFor={amountId}>Amount to withdraw</label>
      <input
        id={amountId}
        inputMode="decimal"
        value={input}
        onChange={(event) => setInput(event.target.value)}
        disabled={!ready || blocked || pending}
        aria-describedby={`${amountId}-help ${amountId}-error`}
      />
      <span id={`${amountId}-help`} className="muted small">
        Principal available: {commitment ? formatAmount(BigInt(commitment.amount)) : '—'}
      </span>
      {validationError && (
        <p id={`${amountId}-error`} className="error-text small" role="alert">
          {validationError}
        </p>
      )}

      {breakdown && (
        <dl className="dialog-breakdown">
          <div><dt>Penalty</dt><dd>{formatAmount(breakdown.penalty)} {commitment?.asset}</dd></div>
          <div><dt>You receive</dt><dd>{formatAmount(breakdown.refund)} {commitment?.asset}</dd></div>
          <div><dt>Remaining principal</dt><dd>{formatAmount(breakdown.remaining)} {commitment?.asset}</dd></div>
        </dl>
      )}

      <div className="row dialog-actions">
        <button ref={cancelRef} type="button" className="btn btn-ghost" disabled={pending} onClick={onClose}>
          Cancel
        </button>
        <button ref={confirmRef} type="button" className="btn btn-primary" disabled={!canSubmit} onClick={submit}>
          {pending ? 'Working...' : 'Withdraw amount'}
        </button>
      </div>
    </dialog>
  );
}
