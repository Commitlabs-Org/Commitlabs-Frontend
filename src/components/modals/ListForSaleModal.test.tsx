// @vitest-environment happy-dom

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ListForSaleModal, { parsePrice } from '@/components/modals/ListForSaleModal';

const defaultProps = {
  isOpen: true,
  commitmentId: 'CMT-123',
  asset: 'USDC',
  sellerAddress: 'GABC123',
  sessionToken: 'token-123',
  endpoint: '/api/marketplace/listings',
  onClose: vi.fn(),
  onSuccess: vi.fn(),
} as const;

function renderModal(props: Partial<typeof defaultProps> = {}) {
  return render(<ListForSaleModal {...defaultProps} {...props} />);
}

function fillPriceAndSubmit(value = '12.34') {
  fireEvent.change(screen.getByPlaceholderText('0.00'), {
    target: { value },
  });
  fireEvent.click(screen.getByRole('button', { name: /list for sale/i }));
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
});

describe('parsePrice', () => {
  it('returns null for empty, non-numeric, zero, and negative values', () => {
    expect(parsePrice('')).toBeNull();
    expect(parsePrice('abc')).toBeNull();
    expect(parsePrice('0')).toBeNull();
    expect(parsePrice('-10')).toBeNull();
  });

  it('accepts comma-formatted values and strips whitespace', () => {
    expect(parsePrice(' 1,234.50 ')).toBe(1234.5);
    expect(parsePrice('1,000')).toBe(1000);
  });
});

describe('ListForSaleModal', () => {
  it('shows the submitting state while the listing request is pending', async () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));

    renderModal();
    fillPriceAndSubmit();

    expect(await screen.findByRole('button', { name: /submitting listing/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /submitting listing/i })).toBeDisabled();
  });

  it('shows the success state and calls onSuccess after a successful listing', async () => {
    const onSuccess = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ listing: { id: 'listing-1' } }),
      }),
    );

    renderModal({ onSuccess });
    fillPriceAndSubmit();

    expect(await screen.findByRole('status')).toBeTruthy();
    expect(screen.getByText(/is now listed on the marketplace/i)).toBeTruthy();
    expect(onSuccess).toHaveBeenCalledWith('listing-1');
  });

  it('renders the already listed error message for a 409 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: async () => ({}),
      }),
    );

    renderModal();
    fillPriceAndSubmit();

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('This commitment is already listed on the marketplace.')).toBeTruthy();
  });
});
