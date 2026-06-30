/**
 * @vitest-environment happy-dom
 */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ExportCommitmentsModal, { ALL_EXPORT_COLUMNS } from './ExportCommitmentsModal';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const fetchMock = vi.fn();

vi.mock('@/components/ui/Dialog', () => ({
  Dialog: ({
    isOpen,
    children,
    labelledById,
    describedById,
  }: {
    isOpen: boolean;
    children: React.ReactNode;
    labelledById?: string;
    describedById?: string;
    onClose?: () => void;
    closeOnEscape?: boolean;
    backdropClassName?: string;
    className?: string;
  }) =>
    isOpen ? (
      <div
        role="dialog"
        aria-labelledby={labelledById}
        aria-describedby={describedById}
        data-testid="dialog"
      >
        {children}
      </div>
    ) : null,
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderModal(
  overrides: Partial<{
    isOpen: boolean;
    onClose: () => void;
    ownerAddress: string;
    sessionToken: string;
    endpoint: string;
  }> = {},
) {
  const props = {
    isOpen: true,
    onClose: vi.fn(),
    ownerAddress: '0xABC123',
    sessionToken: 'tok_test',
    endpoint: '/api/commitments/export',
    ...overrides,
  };
  return { props, ...render(<ExportCommitmentsModal {...props} />) };
}

function makeCsvResponse(rows = 2): Response {
  const header = ALL_EXPORT_COLUMNS.join(',');
  const dataRows = Array.from({ length: rows }, (_, i) => `row${i + 1}`).join('\n');
  const csv = `${header}\n${dataRows}\n`;
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-disposition': 'attachment; filename="commitments.csv"' }),
    blob: async () => new Blob([csv], { type: 'text/csv' }),
  } as unknown as Response;
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);

  // Minimal URL / blob stubs for happy-dom
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'blob:mock'),
    revokeObjectURL: vi.fn(),
  });

  // Suppress localStorage errors in happy-dom
  vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ─── Rendering ────────────────────────────────────────────────────────────────

describe('ExportCommitmentsModal – rendering', () => {
  it('renders the dialog when isOpen is true', () => {
    renderModal();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Export commitment data')).toBeTruthy();
  });

  it('does not render the dialog when isOpen is false', () => {
    renderModal({ isOpen: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders a checkbox for every export column', () => {
    renderModal();
    for (const col of ALL_EXPORT_COLUMNS) {
      expect(screen.getByRole('checkbox', { name: col })).toBeTruthy();
    }
  });

  it('all columns are checked by default', () => {
    renderModal();
    for (const col of ALL_EXPORT_COLUMNS) {
      const checkbox = screen.getByRole('checkbox', { name: col }) as HTMLInputElement;
      expect(checkbox.checked).toBe(true);
    }
  });

  it('renders schedule reminder toggle buttons', () => {
    renderModal();
    expect(screen.getByRole('button', { name: /no reminder/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /daily/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /weekly/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /monthly/i })).toBeTruthy();
  });

  it('"No reminder" is selected by default', () => {
    renderModal();
    const btn = screen.getByRole('button', { name: /no reminder/i });
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });
});

// ─── Column selection ─────────────────────────────────────────────────────────

describe('ExportCommitmentsModal – column selection', () => {
  it('unchecking a column removes it from selection', () => {
    renderModal();
    const checkbox = screen.getByRole('checkbox', { name: 'Owner' }) as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(false);
  });

  it('"Deselect all" unchecks every column', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /deselect all/i }));
    for (const col of ALL_EXPORT_COLUMNS) {
      const cb = screen.getByRole('checkbox', { name: col }) as HTMLInputElement;
      expect(cb.checked).toBe(false);
    }
  });

  it('"Select all" re-checks every column after deselecting all', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /deselect all/i }));
    fireEvent.click(screen.getByRole('button', { name: /select all/i }));
    for (const col of ALL_EXPORT_COLUMNS) {
      const cb = screen.getByRole('checkbox', { name: col }) as HTMLInputElement;
      expect(cb.checked).toBe(true);
    }
  });

  it('shows a warning and disables export when zero columns are selected', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /deselect all/i }));
    expect(screen.getByRole('alert')).toBeTruthy();
    const exportBtn = screen.getByRole('button', { name: /export csv/i }) as HTMLButtonElement;
    expect(exportBtn.disabled).toBe(true);
  });

  it('sending zero columns shows an error message on export attempt', async () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /deselect all/i }));
    fireEvent.click(screen.getByRole('button', { name: /export csv/i }));
    await waitFor(() =>
      expect(screen.getByText(/select at least one column/i)).toBeTruthy(),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ─── Schedule / reminder ──────────────────────────────────────────────────────

describe('ExportCommitmentsModal – schedule reminder', () => {
  it('selecting a schedule interval marks that button as pressed', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /weekly/i }));
    expect(screen.getByRole('button', { name: /weekly/i }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByRole('button', { name: /no reminder/i }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('schedule preference is saved to localStorage on export', async () => {
    fetchMock.mockResolvedValueOnce(makeCsvResponse(1));
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /monthly/i }));
    fireEvent.click(screen.getByRole('button', { name: /export csv/i }));

    await waitFor(() => expect(setItemSpy).toHaveBeenCalled());

    const call = setItemSpy.mock.calls.find(([key]) => key === 'commitlabs.exportPreferences');
    expect(call).toBeTruthy();
    const saved = JSON.parse(call![1] as string) as { scheduleInterval: string };
    expect(saved.scheduleInterval).toBe('monthly');
  });
});

// ─── Preferences persistence ──────────────────────────────────────────────────

describe('ExportCommitmentsModal – preferences persistence', () => {
  it('restores column selection from localStorage when modal opens', () => {
    const storedPrefs = {
      selectedColumns: ['Commitment ID', 'Asset', 'Status'],
      scheduleInterval: 'weekly',
    };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) =>
      key === 'commitlabs.exportPreferences' ? JSON.stringify(storedPrefs) : null,
    );

    renderModal();

    const checkedId = screen.getByRole('checkbox', { name: 'Commitment ID' }) as HTMLInputElement;
    const checkedAsset = screen.getByRole('checkbox', { name: 'Asset' }) as HTMLInputElement;
    const unchecked = screen.getByRole('checkbox', { name: 'Owner' }) as HTMLInputElement;

    expect(checkedId.checked).toBe(true);
    expect(checkedAsset.checked).toBe(true);
    expect(unchecked.checked).toBe(false);
  });

  it('restores schedule interval from localStorage when modal opens', () => {
    const storedPrefs = {
      selectedColumns: [...ALL_EXPORT_COLUMNS],
      scheduleInterval: 'daily',
    };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) =>
      key === 'commitlabs.exportPreferences' ? JSON.stringify(storedPrefs) : null,
    );

    renderModal();

    expect(screen.getByRole('button', { name: /daily/i }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('ignores unknown column names in stored preferences', () => {
    const storedPrefs = {
      selectedColumns: ['Commitment ID', 'Unknown Column XYZ'],
      scheduleInterval: 'never',
    };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key) =>
      key === 'commitlabs.exportPreferences' ? JSON.stringify(storedPrefs) : null,
    );

    renderModal();

    const cb = screen.getByRole('checkbox', { name: 'Commitment ID' }) as HTMLInputElement;
    expect(cb.checked).toBe(true);
    // Only the valid column should be checked, no crash
    const owner = screen.getByRole('checkbox', { name: 'Owner' }) as HTMLInputElement;
    expect(owner.checked).toBe(false);
  });
});

// ─── Export request ───────────────────────────────────────────────────────────

describe('ExportCommitmentsModal – export request', () => {
  it('includes selected columns in the query string', async () => {
    fetchMock.mockResolvedValueOnce(makeCsvResponse(1));
    renderModal();

    // Deselect Owner so only a subset is sent
    fireEvent.click(screen.getByRole('checkbox', { name: 'Owner' }));
    fireEvent.click(screen.getByRole('button', { name: /export csv/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const calledUrl: string = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain('columns=');
    expect(calledUrl).not.toContain('Owner');
    expect(calledUrl).toContain('Commitment%20ID');
  });

  it('shows success message after a successful export', async () => {
    fetchMock.mockResolvedValueOnce(makeCsvResponse(3));
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /export csv/i }));

    await waitFor(() =>
      expect(screen.getByRole('status')).toBeTruthy(),
    );
    expect(screen.getByText(/3 commitments downloaded/i)).toBeTruthy();
  });

  it('shows error message on 401 response', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 } as Response);
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: /export csv/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toBeTruthy(),
    );
    expect(screen.getByText(/sign in again/i)).toBeTruthy();
  });

  it('shows error when no wallet address is provided', async () => {
    renderModal({ ownerAddress: undefined });
    fireEvent.click(screen.getByRole('button', { name: /export csv/i }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toBeTruthy(),
    );
    expect(screen.getByText(/connect a wallet/i)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
