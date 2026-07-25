import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  exportTransactionHistory,
  filterTransactions,
  mapHistoryEventToTransaction,
  fetchTransactionsForOwner,
  Transaction,
} from '@/lib/backend/services/transactionHistoryExport';
import type { HistoryEvent } from '@/lib/types/domain';
import type { ChainCommitment } from '@/lib/backend/services/contracts';

vi.mock('@/lib/backend/services/contracts', () => ({
  getUserCommitmentsFromChain: vi.fn(),
}));

vi.mock('@/lib/backend/services/commitmentHistory', () => ({
  getCommitmentHistory: vi.fn(),
}));

import { getUserCommitmentsFromChain } from '@/lib/backend/services/contracts';
import { getCommitmentHistory } from '@/lib/backend/services/commitmentHistory';

const mockedGetUserCommitmentsFromChain = vi.mocked(getUserCommitmentsFromChain);
const mockedGetCommitmentHistory = vi.mocked(getCommitmentHistory);

const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx-1',
    timestamp: '2026-01-10T10:00:00.000Z',
    type: 'created',
    asset: 'XLM',
    amount: '50000',
    status: 'ACTIVE',
    txHash: '0x123',
    commitmentId: 'CMT-001',
    ownerAddress: 'GOWNER1',
  },
  {
    id: 'tx-2',
    timestamp: '2026-01-15T12:00:00.000Z',
    type: 'attestation',
    asset: 'XLM',
    amount: '50000',
    status: 'ACTIVE',
    txHash: '0x456',
    commitmentId: 'CMT-001',
    ownerAddress: 'GOWNER1',
  },
  {
    id: 'tx-3',
    timestamp: '2026-02-01T08:00:00.000Z',
    type: 'settlement',
    asset: 'USDC',
    amount: '100000',
    status: 'SETTLED',
    txHash: '0x789',
    commitmentId: 'CMT-002',
    ownerAddress: 'GOWNER1',
  },
  {
    id: 'tx-4',
    timestamp: '2026-02-10T14:30:00.000Z',
    type: 'early_exit',
    asset: 'USDC',
    amount: '25,000',
    status: 'EARLY_EXIT',
    txHash: '0xabc',
    commitmentId: 'CMT-003',
    ownerAddress: 'GOWNER1',
  },
];

describe('transactionHistoryExport Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('mapHistoryEventToTransaction', () => {
    const commitment = {
      id: 'CMT-100',
      ownerAddress: 'GOWNER',
      asset: 'XLM',
      amount: '1000',
      status: 'ACTIVE',
    };

    it('maps created event correctly', () => {
      const event: HistoryEvent = {
        eventId: 'created:CMT-100',
        kind: 'created',
        occurredAt: '2026-01-01T00:00:00Z',
        payload: { asset: 'XLM', amount: '1000' },
      };
      const tx = mapHistoryEventToTransaction(event, commitment);
      expect(tx.id).toBe('created:CMT-100');
      expect(tx.type).toBe('created');
      expect(tx.asset).toBe('XLM');
      expect(tx.amount).toBe('1000');
    });

    it('maps attestation event with specific attestationType', () => {
      const event: HistoryEvent = {
        eventId: 'attestation:ATTR-1',
        kind: 'attestation',
        occurredAt: '2026-01-02T00:00:00Z',
        txHash: '0xhash',
        payload: {
          attestationId: 'ATTR-1',
          attestationType: 'health_check',
          complianceScore: 90,
        },
      };
      const tx = mapHistoryEventToTransaction(event, commitment);
      expect(tx.id).toBe('attestation:ATTR-1');
      expect(tx.type).toBe('health_check');
      expect(tx.txHash).toBe('0xhash');
    });

    it('maps early_exit event with penalty amount', () => {
      const event: HistoryEvent = {
        eventId: 'early_exit:CMT-100',
        kind: 'early_exit',
        occurredAt: '2026-01-05T00:00:00Z',
        payload: { penaltyAmount: '50' },
      };
      const tx = mapHistoryEventToTransaction(event, commitment);
      expect(tx.type).toBe('early_exit');
      expect(tx.amount).toBe('50');
    });

    it('maps settlement event with settlement amount', () => {
      const event: HistoryEvent = {
        eventId: 'settlement:CMT-100',
        kind: 'settlement',
        occurredAt: '2026-01-10T00:00:00Z',
        payload: { settlementAmount: '1050', finalStatus: 'SETTLED' },
      };
      const tx = mapHistoryEventToTransaction(event, commitment);
      expect(tx.type).toBe('settlement');
      expect(tx.amount).toBe('1050');
    });
  });

  describe('fetchTransactionsForOwner', () => {
    it('fetches commitments and history events for owner', async () => {
      const mockCommitment: ChainCommitment = {
        id: 'CMT-001',
        ownerAddress: 'GOWNER',
        asset: 'XLM',
        amount: '500',
        status: 'ACTIVE',
        complianceScore: 100,
        currentValue: '500',
        feeEarned: '0',
        violationCount: 0,
        createdAt: '2026-01-01T00:00:00Z',
      };

      mockedGetUserCommitmentsFromChain.mockResolvedValue([mockCommitment]);
      mockedGetCommitmentHistory.mockResolvedValue({
        events: [
          {
            eventId: 'created:CMT-001',
            kind: 'created',
            occurredAt: '2026-01-01T00:00:00Z',
            payload: { asset: 'XLM', amount: '500' },
          },
        ],
        total: 1,
      });

      const result = await fetchTransactionsForOwner('GOWNER');
      expect(mockedGetUserCommitmentsFromChain).toHaveBeenCalledWith('GOWNER');
      expect(mockedGetCommitmentHistory).toHaveBeenCalledWith(mockCommitment);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('created:CMT-001');
    });

    it('falls back to commitment record if history fetch fails or returns empty', async () => {
      const mockCommitment: ChainCommitment = {
        id: 'CMT-002',
        ownerAddress: 'GOWNER',
        asset: 'USDC',
        amount: '1000',
        status: 'SETTLED',
        complianceScore: 95,
        currentValue: '1000',
        feeEarned: '10',
        violationCount: 0,
        createdAt: '2026-01-02T00:00:00Z',
      };

      mockedGetUserCommitmentsFromChain.mockResolvedValue([mockCommitment]);
      mockedGetCommitmentHistory.mockRejectedValue(new Error('History error'));

      const result = await fetchTransactionsForOwner('GOWNER');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('CMT-002');
      expect(result[0].asset).toBe('USDC');
      expect(result[0].amount).toBe('1000');
    });
  });

  describe('filterTransactions', () => {
    it('returns all transactions when no filters are provided', () => {
      const filtered = filterTransactions(MOCK_TRANSACTIONS, {});
      expect(filtered).toHaveLength(4);
    });

    it('filters by date range (startDate and endDate)', () => {
      const filtered = filterTransactions(MOCK_TRANSACTIONS, {
        dateRange: {
          startDate: '2026-01-12T00:00:00.000Z',
          endDate: '2026-02-05T00:00:00.000Z',
        },
      });
      expect(filtered).toHaveLength(2);
      expect(filtered.map((t) => t.id)).toEqual(['tx-2', 'tx-3']);
    });

    it('filters by single type (case-insensitive)', () => {
      const filtered = filterTransactions(MOCK_TRANSACTIONS, {
        type: 'CREATED',
      });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('tx-1');
    });

    it('filters by multiple types', () => {
      const filtered = filterTransactions(MOCK_TRANSACTIONS, {
        type: ['created', 'settlement'],
      });
      expect(filtered).toHaveLength(2);
      expect(filtered.map((t) => t.id)).toEqual(['tx-1', 'tx-3']);
    });

    it('filters by single asset (case-insensitive)', () => {
      const filtered = filterTransactions(MOCK_TRANSACTIONS, {
        asset: 'xlm',
      });
      expect(filtered).toHaveLength(2);
      expect(filtered.map((t) => t.id)).toEqual(['tx-1', 'tx-2']);
    });

    it('filters by multiple assets', () => {
      const filtered = filterTransactions(MOCK_TRANSACTIONS, {
        asset: ['XLM', 'USDC'],
      });
      expect(filtered).toHaveLength(4);
    });

    it('filters by amount range (minAmount and maxAmount)', () => {
      const filtered = filterTransactions(MOCK_TRANSACTIONS, {
        amountRange: {
          minAmount: 30000,
          maxAmount: 80000,
        },
      });
      expect(filtered).toHaveLength(2);
      expect(filtered.map((t) => t.id)).toEqual(['tx-1', 'tx-2']);
    });

    it('handles formatted amounts with commas in amountRange filtering', () => {
      const filtered = filterTransactions(MOCK_TRANSACTIONS, {
        amountRange: {
          minAmount: 20000,
          maxAmount: 30000,
        },
      });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('tx-4');
    });

    it('combines multiple filters correctly', () => {
      const filtered = filterTransactions(MOCK_TRANSACTIONS, {
        asset: 'USDC',
        type: 'settlement',
        amountRange: { minAmount: 50000 },
      });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('tx-3');
    });
  });

  describe('exportTransactionHistory', () => {
    it('exports transactions to JSON format', async () => {
      const output = await exportTransactionHistory({
        format: 'JSON',
        transactions: [MOCK_TRANSACTIONS[0]],
      });

      const parsed = JSON.parse(output);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].id).toBe('tx-1');
      expect(parsed[0].asset).toBe('XLM');
    });

    it('exports transactions to JSON format (lowercase format argument)', async () => {
      const output = await exportTransactionHistory({
        format: 'json',
        transactions: [MOCK_TRANSACTIONS[0]],
      });

      expect(output).toContain('"id": "tx-1"');
    });

    it('exports transactions to CSV format with RFC 4180 headers and CRLF line endings', async () => {
      const output = await exportTransactionHistory({
        format: 'CSV',
        transactions: [MOCK_TRANSACTIONS[0]],
      });

      expect(output).toContain('Transaction ID,Date,Type,Asset,Amount,Status,Tx Hash,Commitment ID\r\n');
      expect(output).toContain('tx-1,2026-01-10T10:00:00.000Z,created,XLM,50000,ACTIVE,0x123,CMT-001\r\n');
    });

    it('escapes CSV special characters according to RFC 4180', async () => {
      const specialTx: Transaction = {
        id: 'tx-spec',
        timestamp: '2026-01-01T00:00:00.000Z',
        type: 'test,type',
        asset: '"XLM"',
        amount: '100\nLine2',
        status: '=1+1',
        txHash: '0x999',
        commitmentId: 'CMT-SPEC',
      };

      const output = await exportTransactionHistory({
        format: 'CSV',
        transactions: [specialTx],
      });

      // Verification of escaping quotes, commas, newlines, formula prefix
      expect(output).toContain('"test,type"');
      expect(output).toContain('"""XLM"""');
      expect(output).toContain('"100\nLine2"');
      expect(output).toContain("'=1+1");
    });

    it('applies filters during export', async () => {
      const output = await exportTransactionHistory({
        format: 'JSON',
        transactions: MOCK_TRANSACTIONS,
        asset: 'USDC',
        amountRange: { maxAmount: 50000 },
      });

      const parsed = JSON.parse(output);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].id).toBe('tx-4');
    });

    it('queries transactions by ownerAddress if transactions array is omitted', async () => {
      const mockCommitment: ChainCommitment = {
        id: 'CMT-OWNER',
        ownerAddress: 'GOWNER',
        asset: 'XLM',
        amount: '500',
        status: 'ACTIVE',
        complianceScore: 100,
        currentValue: '500',
        feeEarned: '0',
        violationCount: 0,
        createdAt: '2026-01-01T00:00:00Z',
      };

      mockedGetUserCommitmentsFromChain.mockResolvedValue([mockCommitment]);
      mockedGetCommitmentHistory.mockResolvedValue({
        events: [
          {
            eventId: 'created:CMT-OWNER',
            kind: 'created',
            occurredAt: '2026-01-01T00:00:00Z',
            payload: { asset: 'XLM', amount: '500' },
          },
        ],
        total: 1,
      });

      const output = await exportTransactionHistory({
        format: 'JSON',
        ownerAddress: 'GOWNER',
      });

      const parsed = JSON.parse(output);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].id).toBe('created:CMT-OWNER');
    });

    it('throws error for unsupported format', async () => {
      await expect(
        exportTransactionHistory({
          format: 'XML' as unknown as 'JSON',
          transactions: [],
        }),
      ).rejects.toThrow('Unsupported export format');
    });
  });
});
