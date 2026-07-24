// @vitest-environment happy-dom

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ExportCommitmentsModal from '@/components/export/ExportCommitmentsModal';

function renderModal(props: Partial<React.ComponentProps<typeof ExportCommitmentsModal>> = {}) {
  return render(
    <ExportCommitmentsModal
      isOpen={true}
      onClose={vi.fn()}
      ownerAddress="GOWNERADDRESS"
      sessionToken="session-token"
      {...props}
    />
  );
}

function mockSuccessfulFetch(
  csvBody = 'Commitment ID,Owner\r\ncommitment-1,GOWNERADDRESS\r\n',
  filename = 'commitments.csv',
  headers: Record<string, string> = {}
) {
  vi.mocked(fetch).mockResolvedValue(
    new Response(csvBody, {
      status: 200,
      headers: {
        'content-disposition': `attachment; filename="${filename}"`,
        'content-type': 'text/csv; charset=utf-8',
        ...headers,
      },
    })
  );
}

describe('ExportCommitmentsModal', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.sessionStorage.clear();
    window.localStorage.clear();

    vi.stubGlobal('fetch', vi.fn());
    Object.defineProperty(window.URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:commitments'),
    });
    Object.defineProperty(window.URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  it('calls the export endpoint with the owner address and session token, then downloads the CSV', async () => {
    mockSuccessfulFetch();

    renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/commitments/export?ownerAddress=GOWNERADDRESS',
        {
          method: 'GET',
          headers: {
            Authorization: 'Bearer session-token',
          },
        }
      );
    });

    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
    expect(screen.getByText('Export ready. 1 commitment downloaded as CSV.')).toBeTruthy();
  });

  it('uses an explicit sessionToken prop over any stored token', async () => {
    window.sessionStorage.setItem('commitlabs.sessionToken', 'stored-token');
    mockSuccessfulFetch();

    renderModal({ sessionToken: 'explicit-token' });

    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: { Authorization: 'Bearer explicit-token' },
        })
      );
    });
  });

  it('resolves session token from sessionStorage using the first STORED_TOKEN_KEYS key', async () => {
    window.sessionStorage.setItem('commitlabs.sessionToken', 'session-stored-token');
    mockSuccessfulFetch();

    renderModal({ sessionToken: undefined });

    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: { Authorization: 'Bearer session-stored-token' },
        })
      );
    });
  });

  it('falls back to localStorage when sessionStorage has no token', async () => {
    window.localStorage.setItem('commitlabs.sessionToken', 'local-stored-token');
    mockSuccessfulFetch();

    renderModal({ sessionToken: undefined });

    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: { Authorization: 'Bearer local-stored-token' },
        })
      );
    });
  });

  it('walks the STORED_TOKEN_KEYS fallback chain', async () => {
    window.localStorage.setItem('commitlabs:sessionToken', 'colon-key-token');
    mockSuccessfulFetch();

    renderModal({ sessionToken: undefined });

    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: { Authorization: 'Bearer colon-key-token' },
        })
      );
    });
  });

  it('reports an empty CSV export without treating it as a failure', async () => {
    mockSuccessfulFetch('Commitment ID,Owner\r\n');

    renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

    await screen.findByText(
      'Export ready. No commitment rows found, so a header-only CSV was downloaded.'
    );
  });

  it('shows a sign-in error before calling the endpoint when no session token exists', async () => {
    renderModal({ sessionToken: undefined });

    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Sign in again before exporting your commitments.');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shows an error when no owner address is provided', async () => {
    renderModal({ ownerAddress: undefined });

    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Connect a wallet before exporting commitments.');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shows a 401-specific error message', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 401 }));

    renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Sign in again before exporting your commitments.');
  });

  it('shows a 403-specific error message', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 403 }));

    renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain(
      'This export is only available for the connected owner address.'
    );
  });

  it('shows a 429-specific error message', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 429 }));

    renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Too many export attempts.');
  });

  it('shows a generic error message for non-specific status codes', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 500 }));

    renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Export failed. Try again in a moment.');
  });

  it('shows a generic error message when fetch throws', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network failure'));

    renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Export failed. Try again in a moment.');
  });

  it('shows loading state while the export is in progress', async () => {
    let resolveFetch: (value: Response) => void;
    const fetchPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    vi.mocked(fetch).mockReturnValue(fetchPromise);

    renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

    expect(screen.getByText('Preparing export')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Preparing export' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Close export dialog' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();

    resolveFetch!(
      new Response('Commitment ID,Owner\r\ncommitment-1,GOWNERADDRESS\r\n', {
        status: 200,
        headers: {
          'content-disposition': 'attachment; filename="commitments.csv"',
          'content-type': 'text/csv; charset=utf-8',
        },
      })
    );

    await screen.findByText('Export ready. 1 commitment downloaded as CSV.');
  });

  it('closes with Escape when it is not preparing an export', () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('blocks Escape from closing while an export is in progress', async () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('disables close and cancel buttons while loading', () => {
    const fetchPromise = new Promise<Response>(() => {});
    vi.mocked(fetch).mockReturnValue(fetchPromise);

    renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

    expect(screen.getByRole('button', { name: 'Close export dialog' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });

  it('keeps keyboard focus inside the dialog', () => {
    renderModal();

    const dialog = screen.getByRole('dialog');
    const closeButton = screen.getByRole('button', { name: 'Close export dialog' });
    const exportButton = screen.getByRole('button', { name: 'Export CSV' });

    exportButton.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });

    expect(document.activeElement).toBe(closeButton);
  });

  it('resets status and message when the dialog reopens', () => {
    const { rerender } = render(
      <ExportCommitmentsModal
        isOpen={false}
        onClose={vi.fn()}
        ownerAddress="GOWNERADDRESS"
        sessionToken="session-token"
      />
    );

    rerender(
      <ExportCommitmentsModal
        isOpen={true}
        onClose={vi.fn()}
        ownerAddress="GOWNERADDRESS"
        sessionToken="session-token"
      />
    );

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('does not render the session token into the DOM before or after export', () => {
    mockSuccessfulFetch();

    renderModal({ sessionToken: 'sensitive-token-value' });

    expect(document.body.innerHTML).not.toContain('sensitive-token-value');

    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

    expect(document.body.innerHTML).not.toContain('sensitive-token-value');
  });

  it('uses the filename from the content-disposition header', async () => {
    mockSuccessfulFetch('Commitment ID,Owner\r\nc-1,ADDR\r\n', 'my-custom-export.csv');

    renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

    await screen.findByText('Export ready. 1 commitment downloaded as CSV.');
  });

  it('reports multiple commitments correctly', async () => {
    mockSuccessfulFetch(
      'Commitment ID,Owner\r\nc-1,ADDR\r\nc-2,ADDR\r\nc-3,ADDR\r\n'
    );

    renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

    await screen.findByText('Export ready. 3 commitments downloaded as CSV.');
  });

  it('recovers from an error after a second export attempt', async () => {
    vi.mocked(fetch)
      .mockRejectedValueOnce(new Error('Network failure'))
      .mockResolvedValueOnce(
        new Response('Commitment ID,Owner\r\ncommitment-1,GOWNERADDRESS\r\n', {
          status: 200,
          headers: {
            'content-disposition': 'attachment; filename="commitments.csv"',
            'content-type': 'text/csv; charset=utf-8',
          },
        })
      );

    renderModal();

    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    await screen.findByText('Export failed. Try again in a moment.');

    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    await screen.findByText('Export ready. 1 commitment downloaded as CSV.');
  });

  it('strips whitespace from ownerAddress and sessionToken', async () => {
    mockSuccessfulFetch();

    renderModal({ ownerAddress: '  GOWNERADDRESS  ', sessionToken: '  token-with-space  ' });

    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/commitments/export?ownerAddress=GOWNERADDRESS',
        expect.objectContaining({
          headers: { Authorization: 'Bearer token-with-space' },
        })
      );
    });
  });

  it('skips whitespace-only tokens and falls through to the next storage key', async () => {
    window.sessionStorage.setItem('commitlabs.sessionToken', '   ');
    window.localStorage.setItem('commitlabs:sessionToken', 'fallback-token');

    mockSuccessfulFetch();

    renderModal({ sessionToken: undefined });

    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: { Authorization: 'Bearer fallback-token' },
        })
      );
    });
  });
});
