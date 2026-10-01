/** @vitest-environment happy-dom */

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { buildReceiptFilename, SettlementReceipt } from './SettlementReceipt';

const data = {
  commitmentId: 'commitment/1',
  finalValue: '$100',
  fees: '$2',
  transactionHash: '0xabc',
  settledAt: '2026-07-30T10:00:00.000Z',
};

describe('SettlementReceipt', () => {
  it('sanitizes the printable filename', () => {
    expect(buildReceiptFilename(data.commitmentId, data.settledAt)).toBe(
      'settlement-receipt-commitment-1-2026-07-30',
    );
  });

  it('renders only after success and prints from the accessible action', () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    const { rerender } = render(<SettlementReceipt status="pending" data={data} />);
    expect(screen.queryByRole('region', { name: 'Settlement receipt' })).not.toBeInTheDocument();

    rerender(<SettlementReceipt status="success" data={data} />);
    fireEvent.click(screen.getByRole('button', { name: 'Download receipt' }));
    expect(print).toHaveBeenCalledOnce();
    print.mockRestore();
  });
});
