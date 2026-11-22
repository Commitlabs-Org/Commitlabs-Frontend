'use client';

import { Fragment, useEffect, useId, useRef, type KeyboardEvent } from 'react';
import { STELLAR_DECIMALS, formatAmount } from '@/lib/amount';
import { shortAddress } from '@/lib/wallet';

const STELLAR_ADDRESS_PATTERN = /^[GC][A-Z2-7]{55}$/;

/** Heuristic threshold for treating an unlabeled bigint as a 7-decimal stroop amount (>= 0.1 unit = 1,000,000 stroops). */
const STROOP_HEURISTIC_THRESHOLD = 1_000_000n;

/** Default friendly labels for contract methods, mirroring `ESCROW_METHOD_LABELS` in `escrow.ts`. */
const DEFAULT_METHOD_LABELS: Record<string, string> = {
  create_commitment: 'Create commitment',
  create_commitment_default: 'Create commitment',
  create_commitment_with_default: 'Create commitment',
  fund_escrow: 'Fund escrow',
  release: 'Release matured commitment',
  settle_commitment: 'Settle commitment',
  refund: 'Early exit refund',
  refund_partial: 'Partial early exit refund',
  early_exit_commitment: 'Early exit commitment',
  dispute: 'Report a problem (open dispute)',
  resolve_dispute: 'Resolve dispute',
  cancel_commitment: 'Cancel commitment',
  record_attestation: 'Record compliance attestation',
  transfer_ownership: 'Transfer commitment ownership',
  accept_ownership: 'Accept commitment ownership',
  cancel_ownership_transfer: 'Cancel ownership transfer',
  pause: 'Pause escrow contract',
  unpause: 'Unpause escrow contract',
  deposit_yield_pool: 'Deposit into yield pool',
  withdraw_yield_pool: 'Withdraw from yield pool',
};

interface MethodArgMeta {
  label: string;
  kind?: 'id' | 'amount' | 'address' | 'text';
}

const METHOD_ARG_META: Record<string, MethodArgMeta[]> = {
  dispute: [
    { label: 'Commitment ID', kind: 'id' },
    { label: 'Caller', kind: 'address' },
    { label: 'Reason', kind: 'text' },
  ],
  create_commitment: [
    { label: 'Owner', kind: 'address' },
    { label: 'Asset', kind: 'address' },
    { label: 'Amount', kind: 'amount' },
    { label: 'Risk profile', kind: 'text' },
    { label: 'Duration (days)', kind: 'id' },
    { label: 'Penalty (bps)', kind: 'id' },
    { label: 'Metadata', kind: 'text' },
  ],
  create_commitment_default: [
    { label: 'Owner', kind: 'address' },
    { label: 'Asset', kind: 'address' },
    { label: 'Amount', kind: 'amount' },
    { label: 'Risk profile', kind: 'text' },
    { label: 'Duration (days)', kind: 'id' },
  ],
  fund_escrow: [{ label: 'Commitment ID', kind: 'id' }],
  release: [
    { label: 'Commitment ID', kind: 'id' },
    { label: 'Caller', kind: 'address' },
  ],
  settle_commitment: [
    { label: 'Commitment ID', kind: 'id' },
    { label: 'Caller', kind: 'address' },
  ],
  refund: [{ label: 'Commitment ID', kind: 'id' }],
  refund_partial: [
    { label: 'Commitment ID', kind: 'id' },
    { label: 'Amount', kind: 'amount' },
  ],
  early_exit_commitment: [
    { label: 'Commitment ID', kind: 'id' },
    { label: 'Caller', kind: 'address' },
  ],
  cancel_commitment: [
    { label: 'Commitment ID', kind: 'id' },
    { label: 'Caller', kind: 'address' },
  ],
  resolve_dispute: [
    { label: 'Commitment ID', kind: 'id' },
    { label: 'Release to owner', kind: 'text' },
  ],
  deposit_yield_pool: [{ label: 'Amount', kind: 'amount' }],
  withdraw_yield_pool: [
    { label: 'Recipient', kind: 'address' },
    { label: 'Amount', kind: 'amount' },
  ],
};

function isStellarAddress(value: unknown): value is string {
  return typeof value === 'string' && STELLAR_ADDRESS_PATTERN.test(value);
}

function formatFeeFromStroops(fee: bigint | number | string): string {
  let value = 0n;
  if (typeof fee === 'bigint') {
    value = fee;
  } else if (typeof fee === 'number' && Number.isFinite(fee)) {
    value = BigInt(Math.trunc(fee));
  } else if (typeof fee === 'string') {
    const trimmed = fee.trim();
    if (/^-?\d+$/.test(trimmed)) {
      value = BigInt(trimmed);
    } else {
      return trimmed.endsWith('XLM') ? trimmed : `${trimmed} XLM`;
    }
  }

  const negative = value < 0n;
  const abs = negative ? -value : value;
  const digits = abs.toString().padStart(STELLAR_DECIMALS + 1, '0');
  const whole = digits.slice(0, digits.length - STELLAR_DECIMALS);
  const fraction = digits.slice(digits.length - STELLAR_DECIMALS);
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}${grouped}.${fraction} XLM`;
}

export function formatDecodedValue(
  value: unknown,
  kind?: 'id' | 'amount' | 'address' | 'text',
): string {
  if (value === null || value === undefined) return 'None (void)';
  if (typeof value === 'boolean') return value ? 'true' : 'false';

  if (typeof value === 'string') {
    if (kind === 'address' || isStellarAddress(value)) {
      return value.length > 12 ? shortAddress(value) : value;
    }
    if (kind === 'amount' && /^-?\d+$/.test(value)) {
      return formatAmount(BigInt(value));
    }
    return value;
  }

  if (typeof value === 'bigint') {
    if (kind === 'amount') return formatAmount(value);
    if (kind === 'id') return value.toString();
    if (value >= STROOP_HEURISTIC_THRESHOLD || value <= -STROOP_HEURISTIC_THRESHOLD) {
      return formatAmount(value);
    }
    return value.toString();
  }

  if (typeof value === 'number') {
    if (kind === 'amount' && Number.isInteger(value)) return formatAmount(BigInt(value));
    return String(value);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return 'None';
    return value.map((item) => formatDecodedValue(item)).join(', ');
  }

  if (typeof value === 'object') {
    if ('type' in value && (value as { type?: unknown }).type === 'scvVoid') {
      return 'None (void)';
    }
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return 'None';
    return entries
      .map(([k, v]) => {
        const fieldKind = /amount|payout|yield|penalty|balance|reserved|available/i.test(k)
          ? 'amount'
          : /owner|caller|admin|address|recipient|attestor|by|to/i.test(k)
            ? 'address'
            : /id/i.test(k)
              ? 'id'
              : undefined;
        return `${k}: ${formatDecodedValue(v, fieldKind)}`;
      })
      .join(', ');
  }

  return String(value);
}

export interface TxPreviewData {
  method: string;
  args: unknown[];
  fee: bigint | number | string;
  returnValue?: unknown;
}

export interface TxPreviewDialogProps {
  open: boolean;
  preview: TxPreviewData | null;
  methodLabel?: string;
  pending?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function TxPreviewDialog({
  open,
  preview,
  methodLabel,
  pending = false,
  confirmLabel = 'Sign & submit',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: TxPreviewDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const fired = useRef(false);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (open && !dlg.open) {
      fired.current = false;
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
      trigger.current?.focus?.();
    },
    [],
  );

  function confirm() {
    if (pending || fired.current) return;
    fired.current = true;
    onConfirm();
  }

  function onKeyDown(e: KeyboardEvent<HTMLDialogElement>) {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (!pending) onCancel();
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

  const method = preview?.method ?? '';
  const friendlyMethod = methodLabel ?? DEFAULT_METHOD_LABELS[method] ?? method;
  const argMeta = METHOD_ARG_META[method] ?? [];
  const args = preview?.args ?? [];
  const feeDisplay = preview ? formatFeeFromStroops(preview.fee) : '0.0000000 XLM';
  const returnKind =
    method === 'refund' || method === 'refund_partial' || method === 'release' || method === 'resolve_dispute'
      ? 'amount'
      : method === 'create_commitment' ||
          method === 'create_commitment_default' ||
          method === 'create_commitment_with_default'
        ? 'id'
        : undefined;
  const resultDisplay = formatDecodedValue(preview?.returnValue, returnKind);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={titleId}
      aria-describedby={descId}
      aria-busy={pending}
      onKeyDown={onKeyDown}
      onCancel={(e) => {
        e.preventDefault();
        if (!pending) onCancel();
      }}
    >
      <h2 id={titleId}>Review transaction</h2>
      <p id={descId} className="muted small">
        Simulated on-chain preview. Confirm to open your wallet and sign.
      </p>

      {preview && (
        <dl className="dialog-breakdown">
          <dt>Action</dt>
          <dd>{friendlyMethod}</dd>

          {args.map((arg, index) => {
            const meta = argMeta[index];
            const label = meta?.label ?? `Argument ${index + 1}`;
            const formatted = formatDecodedValue(arg, meta?.kind);
            const fullAddress = isStellarAddress(arg) ? arg : undefined;
            return (
              <Fragment key={`${label}-${index}`}>
                <dt>{label}</dt>
                <dd title={fullAddress}>{formatted}</dd>
              </Fragment>
            );
          })}

          <dt>Estimated network fee</dt>
          <dd>{feeDisplay}</dd>

          <dt>Expected result</dt>
          <dd>{resultDisplay}</dd>
        </dl>
      )}

      <div className="row dialog-actions">
        <button
          ref={cancelRef}
          type="button"
          className="btn btn-ghost"
          disabled={pending}
          onClick={onCancel}
        >
          {cancelLabel}
        </button>
        <button
          ref={confirmRef}
          type="button"
          className="btn btn-primary"
          disabled={pending || !preview}
          onClick={confirm}
        >
          {pending ? 'Signing...' : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
