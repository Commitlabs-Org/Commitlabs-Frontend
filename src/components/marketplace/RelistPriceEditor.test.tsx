/**
 * @vitest-environment happy-dom
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import RelistPriceEditor from './RelistPriceEditor';
import type { MarketplaceListing } from '@/types/marketplace';

vi.mock('@/components/toast/ToastProvider', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    dismiss: vi.fn(),
    dismissAll: vi.fn(),
  }),
}));

const activeListing: MarketplaceListing = {
  id: 'lst-001',
  commitmentId: 'CMT-ABC123',
  price: '52000',
  currencyAsset: 'XLM',
  sellerAddress: 'GABCDEF1234567890',
  status: 'Active',
  createdAt: '2026-01-15T00:00:00Z',
  updatedAt: '2026-01-15T00:00:00Z',
};

const cancelledListing: MarketplaceListing = {
  ...activeListing,
  status: 'Cancelled',
};

const sellerAddress = 'GABCDEF1234567890';
const commitmentAsset = 'XLM';

function renderEditor(listing: MarketplaceListing = activeListing) {
  const onPriceUpdated = vi.fn();
  const view = render(
    <RelistPriceEditor
      listing={listing}
      sellerAddress={sellerAddress}
      commitmentAsset={commitmentAsset}
      onPriceUpdated={onPriceUpdated}
    />,
  );
  return { onPriceUpdated, ...view };
}

function setInputValue(input: HTMLElement, value: string) {
  fireEvent.change(input, { target: { value } });
}

function clickButton(name: string | RegExp) {
  fireEvent.click(screen.getByRole('button', { name }));
}

describe('RelistPriceEditor', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  describe('display state', () => {
    it('renders nothing for Sold listings', () => {
      const sold: MarketplaceListing = { ...activeListing, status: 'Sold' };
      const { container } = renderEditor(sold);
      expect(container.textContent).toBe('');
    });

    it('renders current price and Edit price button for active listings', () => {
      renderEditor(activeListing);
      expect(screen.getByText('52000 XLM')).toBeInTheDocument();
      expect(screen.getByText('Edit price')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Edit listing price' })).toBeInTheDocument();
    });

    it('renders Listing Price label and Relist button for cancelled listings', () => {
      renderEditor(cancelledListing);
      expect(screen.getByText('Listing Price')).toBeInTheDocument();
      expect(screen.getByText('52000 XLM')).toBeInTheDocument();
      expect(screen.getByText('Relist')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Relist commitment' })).toBeInTheDocument();
    });
  });

  describe('inline editor', () => {
    it('opens inline editor when Edit price is clicked', () => {
      renderEditor(activeListing);
      clickButton('Edit listing price');
      expect(screen.getByLabelText('Listing price')).toBeInTheDocument();
      expect(screen.getByText('Save')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('pre-fills the input with current price', () => {
      renderEditor(activeListing);
      clickButton('Edit listing price');
      const input = screen.getByLabelText('Listing price') as HTMLInputElement;
      expect(input.value).toBe('52000');
    });

    it('closes editor and resets price on Cancel', () => {
      renderEditor(activeListing);
      clickButton('Edit listing price');
      const input = screen.getByLabelText('Listing price');
      setInputValue(input, '99999');
      clickButton('Cancel editing');
      expect(screen.getByText('52000 XLM')).toBeInTheDocument();
      expect(screen.queryByLabelText('Listing price')).not.toBeInTheDocument();
    });

    it('opens inline editor when Relist is clicked', () => {
      renderEditor(cancelledListing);
      clickButton('Relist commitment');
      expect(screen.getByLabelText('Listing price')).toBeInTheDocument();
      expect(screen.getByText('Save')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('shows Set Price label for cancelled listings in editor', () => {
      renderEditor(cancelledListing);
      clickButton('Relist commitment');
      expect(screen.getByText('Set Price')).toBeInTheDocument();
    });

    it('shows Edit Price label for active listings in editor', () => {
      renderEditor(activeListing);
      clickButton('Edit listing price');
      expect(screen.getByText('Edit Price')).toBeInTheDocument();
    });
  });

  describe('price validation', () => {
    it('shows error for empty price', () => {
      renderEditor(activeListing);
      clickButton('Edit listing price');
      const input = screen.getByLabelText('Listing price');
      setInputValue(input, '');
      clickButton('Save price');
      expect(screen.getByText('Price is required')).toBeInTheDocument();
    });

    it('shows error for negative price', () => {
      renderEditor(activeListing);
      clickButton('Edit listing price');
      const input = screen.getByLabelText('Listing price');
      setInputValue(input, '-100');
      clickButton('Save price');
      expect(screen.getByText('Price must be positive')).toBeInTheDocument();
    });

    it('shows error for zero price', () => {
      renderEditor(activeListing);
      clickButton('Edit listing price');
      const input = screen.getByLabelText('Listing price');
      setInputValue(input, '0');
      clickButton('Save price');
      expect(screen.getByText('Price must be positive')).toBeInTheDocument();
    });

    it('shows error for non-numeric price', () => {
      renderEditor(activeListing);
      clickButton('Edit listing price');
      const input = screen.getByLabelText('Listing price');
      setInputValue(input, 'abc');
      clickButton('Save price');
      expect(screen.getByText('Price must be a valid number')).toBeInTheDocument();
    });

    it('shows error for price exceeding max', () => {
      renderEditor(activeListing);
      clickButton('Edit listing price');
      const input = screen.getByLabelText('Listing price');
      setInputValue(input, '999999999999');
      clickButton('Save price');
      expect(screen.getByText(/Price cannot exceed/)).toBeInTheDocument();
    });

    it('clears validation error when user types', () => {
      renderEditor(activeListing);
      clickButton('Edit listing price');
      const input = screen.getByLabelText('Listing price');
      setInputValue(input, '');
      clickButton('Save price');
      expect(screen.getByText('Price is required')).toBeInTheDocument();
      setInputValue(input, '100');
      expect(screen.queryByText('Price is required')).not.toBeInTheDocument();
    });
  });

  describe('API submission', () => {
    it('cancels existing listing and creates new one on edit price submit', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch');
      fetchMock
        .mockResolvedValueOnce(new Response(JSON.stringify({ cancelled: true }), { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ listing: { id: 'lst-002' } }), { status: 201 }));

      const { onPriceUpdated } = renderEditor(activeListing);
      clickButton('Edit listing price');
      const input = screen.getByLabelText('Listing price');
      setInputValue(input, '55000');
      clickButton('Save price');

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(2);
      });

      expect(fetchMock).toHaveBeenNthCalledWith(
        1,
        '/api/marketplace/listings/lst-001',
        expect.objectContaining({ method: 'DELETE' }),
      );
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        '/api/marketplace/listings',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"price":"55000"'),
        }),
      );
      expect(onPriceUpdated).toHaveBeenCalledWith('55000');
    });

    it('creates new listing on relist submit (no cancel call)', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch');
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ listing: { id: 'lst-003' } }), { status: 201 }));

      const { onPriceUpdated } = renderEditor(cancelledListing);
      clickButton('Relist commitment');
      const input = screen.getByLabelText('Listing price');
      setInputValue(input, '50000');
      clickButton('Save price');

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(1);
      });

      expect(fetchMock).toHaveBeenCalledWith(
        '/api/marketplace/listings',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"price":"50000"'),
        }),
      );
      expect(onPriceUpdated).toHaveBeenCalledWith('50000');
    });

    it('shows error toast and rolls back price on API failure', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch');
      fetchMock.mockRejectedValueOnce(new Error('Network error'));

      renderEditor(activeListing);
      clickButton('Edit listing price');
      const input = screen.getByLabelText('Listing price') as HTMLInputElement;
      setInputValue(input, '99999');
      clickButton('Save price');

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(1);
      });

      clickButton('Cancel editing');
      expect(screen.getByText('52000 XLM')).toBeInTheDocument();
    });

    it('throws error when cancel API returns non-ok status', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch');
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 403 }),
      );

      renderEditor(activeListing);
      clickButton('Edit listing price');
      const input = screen.getByLabelText('Listing price');
      setInputValue(input, '55000');
      clickButton('Save price');

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(1);
      });

      clickButton('Cancel editing');
      expect(screen.getByText('52000 XLM')).toBeInTheDocument();
    });

    it('throws error when create API returns non-ok status', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch');
      fetchMock
        .mockResolvedValueOnce(new Response(JSON.stringify({ cancelled: true }), { status: 200 }))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ message: 'Invalid price' }), { status: 400 }),
        );

      renderEditor(activeListing);
      clickButton('Edit listing price');
      const input = screen.getByLabelText('Listing price');
      setInputValue(input, '55000');
      clickButton('Save price');

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(2);
      });

      clickButton('Cancel editing');
      expect(screen.getByText('52000 XLM')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('associates error message with input via aria-describedby', () => {
      renderEditor(activeListing);
      clickButton('Edit listing price');
      const input = screen.getByLabelText('Listing price');
      setInputValue(input, '');
      clickButton('Save price');

      expect(input).toHaveAttribute('aria-invalid', 'true');
      const errorId = input.getAttribute('aria-describedby');
      expect(errorId).toBeTruthy();
      expect(screen.getByRole('alert')).toHaveAttribute('id', errorId);
    });

    it('disables Save and Cancel buttons while submitting', () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch');
      fetchMock.mockImplementationOnce(
        () => new Promise(() => {}),
      );

      renderEditor(activeListing);
      clickButton('Edit listing price');
      clickButton('Save price');

      expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Cancel editing' })).toBeDisabled();
    });
  });
});
