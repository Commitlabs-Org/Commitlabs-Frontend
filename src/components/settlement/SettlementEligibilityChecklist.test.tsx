/** @vitest-environment happy-dom */

import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { SettlementEligibilityChecklist } from './SettlementEligibilityChecklist';

const fetchMock = vi.fn();

function mockPreviewResponse(payload: unknown) {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ success: true, data: payload }),
  } as Response);
}

describe('SettlementEligibilityChecklist', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders an eligible preview and enables the settle action', async () => {
    mockPreviewResponse({ eligible: true, reason: null, estimatedSettlement: '1200' });

    render(<SettlementEligibilityChecklist commitmentId="abc123" onSettle={vi.fn()} />);

    expect(screen.getByText('Settlement preview')).toBeTruthy();
    expect(screen.getByRole('button', { name: /settle/i })).toBeDisabled();

    await waitFor(() => {
      expect(screen.getByText('Eligible now')).toBeTruthy();
    });

    expect(screen.getByRole('button', { name: /settle/i })).not.toBeDisabled();
    expect(screen.getByText('Estimated settlement')).toBeTruthy();
  });

  it('shows the blocking reason when the preview is ineligible', async () => {
    mockPreviewResponse({ eligible: false, reason: 'Commitment has not matured yet and cannot be settled.', estimatedSettlement: null });

    render(<SettlementEligibilityChecklist commitmentId="abc123" onSettle={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Blocked')).toBeTruthy();
    });

    expect(screen.getAllByText('Commitment has not matured yet and cannot be settled.').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /settle/i })).toBeDisabled();
  });

  it('renders an error state when the preview request fails', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));

    render(<SettlementEligibilityChecklist commitmentId="abc123" />);

    await waitFor(() => {
      expect(screen.getByText(/unable to verify settlement eligibility/i)).toBeTruthy();
    });
  });
});
