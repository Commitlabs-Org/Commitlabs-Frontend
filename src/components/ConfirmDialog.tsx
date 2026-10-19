'use client';

import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** While true both buttons are disabled and Escape is ignored. */
  pending?: boolean;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  pending = false,
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
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
      // least-destructive action gets initial focus
      cancelRef.current?.focus();
    } else if (!open && dlg.open) {
      dlg.close();
      trigger.current?.focus?.();
      trigger.current = null;
    }
  }, [open]);

  useEffect(
    () => () => {
      // unmounted while open: still hand focus back
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

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      aria-busy={pending}
      onKeyDown={onKeyDown}
      onCancel={(e) => {
        e.preventDefault();
        if (!pending) onCancel();
      }}
    >
      <h2 id={titleId}>{title}</h2>
      {description && (
        <p id={descId} className="muted">
          {description}
        </p>
      )}
      {children}
      <div className="row dialog-actions">
        <button ref={cancelRef} type="button" className="btn btn-ghost" disabled={pending} onClick={onCancel}>
          {cancelLabel}
        </button>
        <button
          ref={confirmRef}
          type="button"
          className={destructive ? 'btn btn-danger' : 'btn btn-primary'}
          disabled={pending}
          onClick={confirm}
        >
          {pending ? 'Working...' : confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
