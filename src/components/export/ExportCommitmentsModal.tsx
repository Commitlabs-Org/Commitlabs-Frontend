'use client';

import React, { useCallback, useEffect, useId, useState } from 'react';
import { AlertCircle, Bell, CheckCircle2, Download, Loader2, X } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';

type ExportStatus = 'idle' | 'loading' | 'success' | 'error';

export const ALL_EXPORT_COLUMNS = [
  'Commitment ID',
  'Owner',
  'Asset',
  'Amount',
  'Status',
  'Compliance Score',
  'Current Value',
  'Fee Earned',
  'Violation Count',
  'Created At',
  'Expires At',
] as const;

export type ExportColumn = (typeof ALL_EXPORT_COLUMNS)[number];

export type ScheduleInterval = 'never' | 'daily' | 'weekly' | 'monthly';

const SCHEDULE_OPTIONS: { value: ScheduleInterval; label: string }[] = [
  { value: 'never', label: 'No reminder' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const PREFS_STORAGE_KEY = 'commitlabs.exportPreferences';

interface ExportPreferences {
  selectedColumns: ExportColumn[];
  scheduleInterval: ScheduleInterval;
}

function loadExportPreferences(): ExportPreferences {
  if (typeof window === 'undefined') {
    return { selectedColumns: [...ALL_EXPORT_COLUMNS], scheduleInterval: 'never' };
  }
  try {
    const raw = window.localStorage.getItem(PREFS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ExportPreferences>;
      const selectedColumns = Array.isArray(parsed.selectedColumns)
        ? (parsed.selectedColumns.filter((c) =>
            (ALL_EXPORT_COLUMNS as readonly string[]).includes(c),
          ) as ExportColumn[])
        : [...ALL_EXPORT_COLUMNS];
      const scheduleInterval =
        parsed.scheduleInterval &&
        SCHEDULE_OPTIONS.some((o) => o.value === parsed.scheduleInterval)
          ? parsed.scheduleInterval
          : 'never';
      return { selectedColumns, scheduleInterval };
    }
  } catch {
    // ignore malformed storage
  }
  return { selectedColumns: [...ALL_EXPORT_COLUMNS], scheduleInterval: 'never' };
}

function saveExportPreferences(prefs: ExportPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore storage errors
  }
}

interface ExportCommitmentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  ownerAddress?: string;
  sessionToken?: string;
  endpoint?: string;
}

const STORED_TOKEN_KEYS = [
  'commitlabs.sessionToken',
  'commitlabs:sessionToken',
  'sessionToken',
];

function getStoredSessionToken(): string | undefined {
  if (typeof window === 'undefined') return undefined;

  for (const key of STORED_TOKEN_KEYS) {
    const value =
      window.sessionStorage.getItem(key) ??
      window.localStorage.getItem(key);

    if (value?.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function getFilename(response: Response): string {
  const contentDisposition = response.headers.get('content-disposition') ?? '';
  const match = contentDisposition.match(/filename="?([^";]+)"?/i);
  return match?.[1] ?? 'commitments.csv';
}

function countDataRows(csv: string): number {
  const lines = csv
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((line) => line.trim().length > 0);

  return Math.max(0, lines.length - 1);
}

async function downloadCsv(blob: Blob, filename: string): Promise<void> {
  const href = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(href);
}

function getExportErrorMessage(status: number): string {
  if (status === 401) return 'Sign in again before exporting your commitments.';
  if (status === 403) return 'This export is only available for the connected owner address.';
  if (status === 429) return 'Too many export attempts. Wait a moment and try again.';
  return 'Export failed. Try again in a moment.';
}

function scheduleReminderNotification(interval: ScheduleInterval): void {
  if (interval === 'never' || typeof window === 'undefined') return;
  if (!('Notification' in window)) return;

  const intervalMs: Record<Exclude<ScheduleInterval, 'never'>, number> = {
    daily: 24 * 60 * 60 * 1000,
    weekly: 7 * 24 * 60 * 60 * 1000,
    monthly: 30 * 24 * 60 * 60 * 1000,
  };

  const ms = intervalMs[interval as Exclude<ScheduleInterval, 'never'>];
  if (!ms) return;

  Notification.requestPermission().then((permission) => {
    if (permission !== 'granted') return;
    setTimeout(() => {
      // eslint-disable-next-line no-new
      new Notification('CommitLabs export reminder', {
        body: `Your ${interval} commitment export reminder is ready.`,
        icon: '/favicon.ico',
      });
    }, ms);
  });
}

export default function ExportCommitmentsModal({
  isOpen,
  onClose,
  ownerAddress,
  sessionToken,
  endpoint = '/api/commitments/export',
}: ExportCommitmentsModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const columnSectionId = useId();
  const scheduleSectionId = useId();

  const [status, setStatus] = useState<ExportStatus>('idle');
  const [message, setMessage] = useState('');
  const [selectedColumns, setSelectedColumns] = useState<ExportColumn[]>([...ALL_EXPORT_COLUMNS]);
  const [scheduleInterval, setScheduleInterval] = useState<ScheduleInterval>('never');

  // Restore preferences when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setStatus('idle');
    setMessage('');
    const prefs = loadExportPreferences();
    setSelectedColumns(prefs.selectedColumns);
    setScheduleInterval(prefs.scheduleInterval);
  }, [isOpen]);

  const toggleColumn = useCallback((column: ExportColumn) => {
    setSelectedColumns((prev) =>
      prev.includes(column) ? prev.filter((c) => c !== column) : [...prev, column],
    );
  }, []);

  const allChecked = selectedColumns.length === ALL_EXPORT_COLUMNS.length;
  const noneChecked = selectedColumns.length === 0;

  const toggleAll = useCallback(() => {
    setSelectedColumns(allChecked ? [] : [...ALL_EXPORT_COLUMNS]);
  }, [allChecked]);

  const handleExport = useCallback(async () => {
    if (noneChecked) {
      setStatus('error');
      setMessage('Select at least one column before exporting.');
      return;
    }

    const normalizedAddress = ownerAddress?.trim();
    const resolvedToken = sessionToken?.trim() || getStoredSessionToken();

    if (!normalizedAddress) {
      setStatus('error');
      setMessage('Connect a wallet before exporting commitments.');
      return;
    }

    if (!resolvedToken) {
      setStatus('error');
      setMessage('Sign in again before exporting your commitments.');
      return;
    }

    const prefs: ExportPreferences = { selectedColumns, scheduleInterval };
    saveExportPreferences(prefs);
    scheduleReminderNotification(scheduleInterval);

    setStatus('loading');
    setMessage('');

    try {
      const url = new URL(endpoint, window.location.origin);
      url.searchParams.set('ownerAddress', normalizedAddress);
      url.searchParams.set('columns', selectedColumns.join(','));

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${resolvedToken}`,
        },
      });

      if (!response.ok) {
        setStatus('error');
        setMessage(getExportErrorMessage(response.status));
        return;
      }

      const filename = getFilename(response);
      const blob = await response.blob();
      const csv = await blob.text();
      const recordCount = countDataRows(csv);
      const downloadableBlob = new Blob([csv], { type: 'text/csv;charset=utf-8' });

      await downloadCsv(downloadableBlob, filename);

      setStatus('success');
      setMessage(
        recordCount === 0
          ? 'Export ready. No commitment rows found, so a header-only CSV was downloaded.'
          : `Export ready. ${recordCount} commitment${recordCount === 1 ? '' : 's'} downloaded as CSV.`,
      );
    } catch {
      setStatus('error');
      setMessage('Export failed. Try again in a moment.');
    }
  }, [endpoint, ownerAddress, sessionToken, selectedColumns, scheduleInterval, noneChecked]);

  const isLoading = status === 'loading';

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      closeOnEscape={!isLoading}
      labelledById={titleId}
      describedById={descriptionId}
      backdropClassName="bg-black/70 px-4 py-6"
      className="w-full max-w-[520px] rounded-[18px] border border-[#0FF0FC33] bg-[#0A0A0A] p-6 text-white shadow-[0_24px_70px_rgba(0,0,0,0.55)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0FF0FC]"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#0FF0FC]">
            Portfolio export
          </p>
          <h2 id={titleId} className="mt-2 text-2xl font-semibold leading-tight">
            Export commitment data
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          aria-label="Close export dialog"
          className="rounded-full border border-white/10 p-2 text-white/70 transition-colors hover:border-white/30 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0FF0FC] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <X size={18} />
        </button>
      </div>

      <p id={descriptionId} className="mt-4 text-sm leading-6 text-white/70">
        Download a CSV snapshot for the connected owner address. Choose which columns to
        include and optionally set a reminder to export regularly.
      </p>

      <div className="mt-6 grid gap-4">
        <label className="flex items-center gap-3 rounded-[14px] border border-[#0FF0FC33] bg-[#0FF0FC0D] px-4 py-3">
          <input type="radio" name="exportScope" checked readOnly />
          <span className="text-sm font-medium">All commitments</span>
        </label>

        <label className="flex items-center justify-between gap-3 rounded-[14px] border border-white/10 px-4 py-3 text-white/40">
          <span className="flex items-center gap-3">
            <input type="radio" name="exportScope" disabled />
            <span className="text-sm font-medium">Selected commitments</span>
          </span>
          <span className="text-xs uppercase tracking-[0.16em]">Soon</span>
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm text-white/70">
            Date range
            <select
              className="rounded-[12px] border border-white/10 bg-black px-3 py-2 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0FF0FC]"
              defaultValue="all"
            >
              <option value="all">All time</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="year">This year</option>
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm text-white/70">
            Format
            <select
              className="rounded-[12px] border border-white/10 bg-black px-3 py-2 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0FF0FC]"
              defaultValue="csv"
            >
              <option value="csv">CSV</option>
              <option value="json" disabled>
                JSON soon
              </option>
            </select>
          </label>
        </div>
      </div>

      {/* Column selection */}
      <section aria-labelledby={columnSectionId} className="mt-6">
        <div className="flex items-center justify-between">
          <h3
            id={columnSectionId}
            className="text-sm font-semibold uppercase tracking-[0.14em] text-white/60"
          >
            Columns
          </h3>
          <button
            type="button"
            onClick={toggleAll}
            className="text-xs text-[#0FF0FC] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0FF0FC]"
            aria-label={allChecked ? 'Deselect all columns' : 'Select all columns'}
          >
            {allChecked ? 'Deselect all' : 'Select all'}
          </button>
        </div>

        {noneChecked && (
          <p role="alert" className="mt-2 text-xs text-[#FECACA]">
            Select at least one column to enable export.
          </p>
        )}

        <ul
          className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2"
          aria-label="Export column selection"
        >
          {ALL_EXPORT_COLUMNS.map((col) => {
            const checked = selectedColumns.includes(col);
            return (
              <li key={col}>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-white/80 hover:text-white">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleColumn(col)}
                    aria-label={col}
                    className="accent-[#0FF0FC] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0FF0FC]"
                  />
                  {col}
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Schedule / reminder */}
      <section aria-labelledby={scheduleSectionId} className="mt-6">
        <h3
          id={scheduleSectionId}
          className="text-sm font-semibold uppercase tracking-[0.14em] text-white/60"
        >
          Export reminder
        </h3>
        <p className="mt-1 text-xs text-white/40">
          A browser notification reminds you to export again. No data is sent automatically.
        </p>

        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-labelledby={scheduleSectionId}>
          {SCHEDULE_OPTIONS.map(({ value, label }) => {
            const selected = scheduleInterval === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setScheduleInterval(value)}
                aria-pressed={selected}
                className={`flex items-center gap-1.5 rounded-[10px] border px-3 py-1.5 text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0FF0FC] ${
                  selected
                    ? 'border-[#0FF0FC66] bg-[#0FF0FC1A] text-white'
                    : 'border-white/10 text-white/50 hover:border-white/30 hover:text-white/80'
                }`}
              >
                {value !== 'never' && <Bell size={12} aria-hidden />}
                {label}
              </button>
            );
          })}
        </div>
      </section>

      {message ? (
        <div
          role={status === 'error' ? 'alert' : 'status'}
          className={`mt-5 flex gap-3 rounded-[14px] border px-4 py-3 text-sm leading-6 ${
            status === 'error'
              ? 'border-[#F9737333] bg-[#F9737312] text-[#FECACA]'
              : 'border-[#22C55E33] bg-[#22C55E12] text-[#BBF7D0]'
          }`}
        >
          {status === 'error' ? (
            <AlertCircle className="mt-0.5 shrink-0" size={18} />
          ) : (
            <CheckCircle2 className="mt-0.5 shrink-0" size={18} />
          )}
          <span>{message}</span>
        </div>
      ) : null}

      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onClose}
          disabled={isLoading}
          className="rounded-[14px] border border-white/10 px-5 py-3 text-sm font-semibold text-white/80 transition-colors hover:border-white/30 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0FF0FC] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleExport}
          disabled={isLoading || noneChecked}
          aria-disabled={noneChecked}
          className="inline-flex items-center justify-center gap-2 rounded-[14px] border border-[#0FF0FC66] bg-[#0FF0FC1A] px-5 py-3 text-sm font-semibold text-white shadow-[0_0_18px_rgba(15,240,252,0.22)] transition-all hover:bg-[#0FF0FC26] hover:shadow-[0_0_24px_rgba(15,240,252,0.34)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0FF0FC] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
          {isLoading ? 'Preparing export' : 'Export CSV'}
        </button>
      </div>
    </Dialog>
  );
}
