import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { axe } from 'vitest-axe';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TxPreviewDialog, type TxPreviewData } from '../TxPreviewDialog';
import { DisputeDialog } from '../DisputeDialog';
import { signTransaction } from '@stellar/freighter-api';
import { prepareDispute, submitPrepared } from '@/lib/soroban/escrow';
import { TxError } from '@/lib/soroban/errors';
import type { Commitment } from '@/lib/commitments';

vi.mock('@stellar/freighter-api', () => ({
  isConnected: vi.fn().mockResolvedValue(true),
  getPublicKey: vi.fn().mockResolvedValue('GCAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHP'),
  signTransaction: vi.fn().mockResolvedValue('signed-xdr'),
}));

vi.mock('@/components/WalletProvider', () => ({
  useWallet: () => ({
    status: 'connected',
    address: 'GCAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHP',
    message: null,
  }),
}));

vi.mock('@/lib/soroban/escrow', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/soroban/escrow')>();
  return {
    ...actual,
    prepareDispute: vi.fn(),
    submitPrepared: vi.fn(),
    openDispute: vi.fn(),
  };
});

const SAMPLE_ADDRESS = 'GCAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHP';
const SAMPLE_ASSET = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';

const samplePreview: TxPreviewData = {
  method: 'dispute',
  args: [1n, SAMPLE_ADDRESS, 'The payout did not match the agreed amount.'],
  fee: 43_000n,
  returnValue: null,
};

const sampleCommitment: Commitment = {
  id: '1',
  type: 'balanced',
  asset: 'USDC',
  amount: '10000000000',
  durationDays: 30,
  maxLoss: 8,
  penalty: 5,
  apy: 9,
  createdAt: Date.now(),
  status: 'active',
  owner: SAMPLE_ADDRESS,
  txHash: null,
};

function PreviewHarness({
  preview = samplePreview,
  pending = false,
  onConfirm = () => {},
  onCancel = () => {},
}: {
  preview?: TxPreviewData | null;
  pending?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open preview
      </button>
      <TxPreviewDialog
        open={open}
        preview={preview}
        pending={pending}
        onConfirm={onConfirm}
        onCancel={() => {
          setOpen(false);
          onCancel();
        }}
      />
    </>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TxPreviewDialog', () => {
  it('renders friendly method label, decoded args (formatAmount and shortAddress), fee in XLM with 7 decimals, and expected result', () => {
    const createPreview: TxPreviewData = {
      method: 'create_commitment_default',
      args: [SAMPLE_ADDRESS, SAMPLE_ASSET, 25_000_000_000n, 'Balanced', 30],
      fee: 54_321n,
      returnValue: 7n,
    };

    render(
      <TxPreviewDialog
        open
        preview={createPreview}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const dlg = screen.getByRole('dialog', { name: 'Review transaction' });
    expect(within(dlg).getByText('Create commitment')).toBeDefined();
    // Addresses formatted via shortAddress
    expect(within(dlg).getByText('GCAA...AWHP')).toBeDefined();
    expect(within(dlg).getByText('CDLZ...CYSC')).toBeDefined();
    // Amount formatted via formatAmount (25,000_000_000n -> 2,500)
    expect(within(dlg).getByText('2,500')).toBeDefined();
    // Fee formatted with 7 decimals in XLM
    expect(within(dlg).getByText('0.0054321 XLM')).toBeDefined();
    // Simulated return value
    expect(within(dlg).getByText('7')).toBeDefined();
  });

  it('traps focus with Tab and Shift+Tab and returns focus to trigger on Escape', async () => {
    const user = userEvent.setup();
    render(<PreviewHarness />);

    const trigger = screen.getByRole('button', { name: 'Open preview' });
    await user.click(trigger);

    const dlg = screen.getByRole('dialog', { name: 'Review transaction' });
    expect(dlg).toHaveProperty('open', true);

    const cancelBtn = within(dlg).getByRole('button', { name: 'Cancel' });
    const confirmBtn = within(dlg).getByRole('button', { name: 'Sign & submit' });

    expect(document.activeElement).toBe(cancelBtn);

    await user.tab();
    expect(document.activeElement).toBe(confirmBtn);

    await user.tab();
    expect(document.activeElement).toBe(cancelBtn);

    await user.tab({ shift: true });
    expect(document.activeElement).toBe(confirmBtn);

    await user.keyboard('{Escape}');
    expect(dlg).toHaveProperty('open', false);
    expect(document.activeElement).toBe(trigger);
  });

  it('passes vitest-axe with no accessibility violations', async () => {
    const { container } = render(
      <TxPreviewDialog
        open
        preview={samplePreview}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const results = await axe(container, {
      rules: { 'color-contrast': { enabled: false } },
    });
    expect(results.violations).toEqual([]);
  });

  it('never calls signTransaction when the user cancels the preview in DisputeDialog', async () => {
    const user = userEvent.setup();
    vi.mocked(prepareDispute).mockResolvedValue({
      method: 'dispute',
      args: [1n, SAMPLE_ADDRESS, 'payout mismatch'],
      rawArgs: [],
      fee: 12_100n,
      feeXlm: '0.0012100',
      minResourceFee: 12_000n,
      baseFee: 100n,
      returnValue: null,
      authEntries: [],
      txXdr: 'tx-xdr',
      tx: { toXDR: () => 'tx-xdr' },
    });

    const onSuccess = vi.fn();
    render(
      <DisputeDialog
        open
        commitment={sampleCommitment}
        onClose={vi.fn()}
        onSuccess={onSuccess}
      />,
    );

    fireEvent.change(screen.getByRole('textbox', { name: 'Reason' }), {
      target: { value: 'payout mismatch' },
    });
    await user.click(screen.getByRole('button', { name: 'Report problem' }));

    const previewDlg = await screen.findByRole('dialog', { name: 'Review transaction' });
    expect(within(previewDlg).getByText('Report a problem (open dispute)')).toBeDefined();
    expect(within(previewDlg).getByText('0.0012100 XLM')).toBeDefined();

    await user.click(within(previewDlg).getByRole('button', { name: 'Cancel' }));

    expect(submitPrepared).not.toHaveBeenCalled();
    expect(signTransaction).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('submits prepared transaction and calls onSuccess when user confirms the preview in DisputeDialog', async () => {
    const user = userEvent.setup();
    const preparedTx = {
      method: 'dispute',
      args: [1n, SAMPLE_ADDRESS, 'payout mismatch'],
      rawArgs: [],
      fee: 12_100n,
      feeXlm: '0.0012100',
      minResourceFee: 12_000n,
      baseFee: 100n,
      returnValue: null,
      authEntries: [],
      txXdr: 'tx-xdr',
      tx: { toXDR: () => 'tx-xdr' },
    };
    vi.mocked(prepareDispute).mockResolvedValue(preparedTx);
    vi.mocked(submitPrepared).mockResolvedValue({ transactionHash: 'dispute-tx-hash' });

    const onSuccess = vi.fn();
    render(
      <DisputeDialog
        open
        commitment={sampleCommitment}
        onClose={vi.fn()}
        onSuccess={onSuccess}
      />,
    );

    fireEvent.change(screen.getByRole('textbox', { name: 'Reason' }), {
      target: { value: 'payout mismatch' },
    });
    await user.click(screen.getByRole('button', { name: 'Report problem' }));

    const previewDlg = await screen.findByRole('dialog', { name: 'Review transaction' });
    await user.click(within(previewDlg).getByRole('button', { name: 'Sign & submit' }));

    await waitFor(() => expect(submitPrepared).toHaveBeenCalledWith(preparedTx));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith(sampleCommitment));
  });

  it('surfaces simulation error before the preview dialog opens', async () => {
    const user = userEvent.setup();
    vi.mocked(prepareDispute).mockRejectedValue(
      new TxError('simulation', 'The transaction failed on the Stellar network.'),
    );

    render(
      <DisputeDialog
        open
        commitment={sampleCommitment}
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByRole('textbox', { name: 'Reason' }), {
      target: { value: 'payout mismatch' },
    });
    await user.click(screen.getByRole('button', { name: 'Report problem' }));

    await waitFor(() => {
      expect(screen.getByText('The transaction failed on the Stellar network.')).toBeDefined();
    });
    expect(screen.queryByRole('dialog', { name: 'Review transaction' })).toBeNull();
    expect(signTransaction).not.toHaveBeenCalled();
  });
});
