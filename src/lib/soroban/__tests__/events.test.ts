import { describe, it, expect, vi, beforeEach } from 'vitest';
import { nativeToScVal, xdr } from '@stellar/stellar-sdk';
import { decodeEscrowEvent, fetchEscrowEvents, type RawEvent } from '../events';

describe('Soroban Escrow Events Decoder', () => {
  it('decodes Shape A (3 topics: name, id, owner with amount value)', () => {
    const raw: RawEvent = {
      id: '0000000001',
      ledger: 100,
      ledgerClosedAt: '2026-03-01T12:00:00Z',
      topic: [
        nativeToScVal('create_commitment'),
        nativeToScVal(123),
        nativeToScVal('GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ'),
      ],
      value: nativeToScVal(50000000n),
      txHash: 'abcdef0123456789',
    };

    const decoded = decodeEscrowEvent(raw);
    expect(decoded.id).toBe('0000000001');
    expect(decoded.kind).toBe('create_commitment');
    expect(decoded.commitmentId).toBe('123');
    expect(decoded.owner).toBe('GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    expect(decoded.amount).toBe('50000000');
    expect(decoded.ledger).toBe(100);
    expect(decoded.txHash).toBe('abcdef0123456789');
  });

  it('decodes Shape B (2 topics: name, owner with [id, amount] tuple value)', () => {
    const raw: RawEvent = {
      id: '0000000002',
      ledger: 105,
      ledgerClosedAt: '2026-03-01T12:05:00Z',
      topic: [
        nativeToScVal('release'),
        nativeToScVal('GXYZ1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ'),
      ],
      value: nativeToScVal([456, 10000000n]),
      txHash: '9876543210fedcba',
    };

    const decoded = decodeEscrowEvent(raw);
    expect(decoded.id).toBe('0000000002');
    expect(decoded.kind).toBe('release');
    expect(decoded.commitmentId).toBe('456');
    expect(decoded.owner).toBe('GXYZ1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ');
    expect(decoded.amount).toBe('10000000');
    expect(decoded.ledger).toBe(105);
  });

  it('handles unknown event types and invalid topics gracefully without throwing', () => {
    const rawUnknown: RawEvent = {
      id: '0000000003',
      ledger: 110,
      topic: [],
      value: nativeToScVal(0),
    };

    const decoded = decodeEscrowEvent(rawUnknown);
    expect(decoded.id).toBe('0000000003');
    expect(decoded.kind).toBe('unknown');
    expect(decoded.ledger).toBe(110);
  });

  it('handles malformed ScVal topics safely', () => {
    const rawMalformed: RawEvent = {
      id: '0000000004',
      ledger: 115,
      topic: ['invalid_not_an_xdr_string'],
      value: 'invalid_value',
    };

    const decoded = decodeEscrowEvent(rawMalformed);
    expect(decoded.kind).toBe('unknown');
    expect(decoded.ledger).toBe(115);
  });

  it('decodes an object-valued payload', () => {
    const raw: RawEvent = {
      id: '0000000005',
      ledger: 120,
      topic: [nativeToScVal('release')],
      value: nativeToScVal({ owner: 'GOBJECTOWNER', id: 8, amount: 25 }),
    };

    expect(decodeEscrowEvent(raw)).toMatchObject({
      kind: 'release',
      owner: 'GOBJECTOWNER',
      commitmentId: '8',
      amount: '25',
    });
  });

  it('handles non-object decoded values without throwing', () => {
    const raw: RawEvent = {
      id: '0000000006',
      ledger: 125,
      topic: [nativeToScVal('unknown_event')],
      value: nativeToScVal('plain text'),
    };

    expect(() => decodeEscrowEvent(raw)).not.toThrow();
    expect(decodeEscrowEvent(raw).kind).toBe('unknown_event');
  });
});

describe('fetchEscrowEvents', () => {
  let mockServer: any;

  beforeEach(() => {
    mockServer = {
      getLatestLedger: vi.fn().mockResolvedValue({ sequence: 5000 }),
      getEvents: vi.fn(),
    };
  });

  it('fetches, decodes, and deduplicates events', async () => {
    mockServer.getEvents.mockResolvedValue({
      cursor: 'cursor-123',
      events: [
        {
          id: 'evt-1',
          ledger: 4990,
          topic: [
            nativeToScVal('fund'),
            nativeToScVal(1),
            nativeToScVal('GADDR1'),
          ],
          value: nativeToScVal(100),
        },
        // Duplicate event with same id
        {
          id: 'evt-1',
          ledger: 4990,
          topic: [
            nativeToScVal('fund'),
            nativeToScVal(1),
            nativeToScVal('GADDR1'),
          ],
          value: nativeToScVal(100),
        },
        {
          id: 'evt-2',
          ledger: 4995,
          topic: [
            nativeToScVal('release'),
            nativeToScVal(2),
            nativeToScVal('GADDR2'),
          ],
          value: nativeToScVal(200),
        },
      ],
    });

    const res = await fetchEscrowEvents({ limit: 10 }, mockServer);

    expect(mockServer.getLatestLedger).toHaveBeenCalled();
    expect(mockServer.getEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: expect.arrayContaining([
          expect.objectContaining({ type: 'contract' }),
        ]),
        limit: 10,
      })
    );

    // Only 2 unique events
    expect(res.events).toHaveLength(2);
    expect(res.events[0].id).toBe('evt-1');
    expect(res.events[1].id).toBe('evt-2');
    expect(res.cursor).toBe('cursor-123');
  });

  it('applies filters by kind and owner', async () => {
    mockServer.getEvents.mockResolvedValue({
      events: [
        {
          id: 'evt-1',
          ledger: 4990,
          topic: [nativeToScVal('fund'), nativeToScVal('GUSER1')],
          value: nativeToScVal([101, 50]),
        },
        {
          id: 'evt-2',
          ledger: 4991,
          topic: [nativeToScVal('resolve'), nativeToScVal('GUSER2')],
          value: nativeToScVal([102, 75]),
        },
      ],
    });

    const res = await fetchEscrowEvents(
      {
        filters: { kind: 'fund', owner: 'GUSER1' },
      },
      mockServer
    );

    expect(res.events).toHaveLength(1);
    expect(res.events[0].kind).toBe('fund');
    expect(res.events[0].owner).toBe('GUSER1');
  });

  it('uses symbol and u64 topic filters for commitment IDs and matches legacy value IDs', async () => {
    mockServer.getEvents.mockResolvedValue({
      events: [
        {
          id: 'indexed-match',
          ledger: 4990,
          topic: [
            xdr.ScVal.fromXDR('AAAADwAAABFjcmVhdGVfY29tbWl0bWVudAAAAA==', 'base64'),
            nativeToScVal(123n, { type: 'u64' }),
            nativeToScVal('GUSER1'),
          ],
          value: nativeToScVal(500),
        },
        {
          id: 'legacy-match',
          ledger: 4991,
          topic: [
            xdr.ScVal.fromXDR('AAAADwAAAAdyZWxlYXNlAA==', 'base64'),
            nativeToScVal('GUSER1'),
          ],
          value: nativeToScVal([123, 250]),
        },
        {
          id: 'legacy-mismatch',
          ledger: 4992,
          topic: [
            xdr.ScVal.fromXDR('AAAADwAAAAdyZWxlYXNlAA==', 'base64'),
            nativeToScVal('GUSER1'),
          ],
          value: nativeToScVal([456, 250]),
        },
      ],
      cursor: 'commitment-cursor',
    });

    const res = await fetchEscrowEvents({ filters: { commitmentId: '123' } }, mockServer);
    const topics = mockServer.getEvents.mock.calls[0][0].filters[0].topics;

    expect(topics).toEqual(
      expect.arrayContaining([
        [
          'AAAADwAAABFjcmVhdGVfY29tbWl0bWVudAAAAA==',
          nativeToScVal(123n, { type: 'u64' }).toXDR('base64'),
          '*',
        ],
        ['*', nativeToScVal(123n, { type: 'u64' }).toXDR('base64'), '*'],
        ['*', '*'],
        ['*'],
      ])
    );
    expect(res.events.map((event) => event.id)).toEqual(['indexed-match', 'legacy-match']);
  });

  it('keeps commitment topic filters when continuing with the returned cursor', async () => {
    mockServer.getEvents
      .mockResolvedValueOnce({
        cursor: 'cursor-page-one',
        events: [
          {
            id: 'legacy-mismatch',
            ledger: 4990,
            topic: [
              xdr.ScVal.fromXDR('AAAADwAAAAdyZWxlYXNlAA==', 'base64'),
              nativeToScVal('GUSER1'),
            ],
            value: nativeToScVal([456, 250]),
          },
        ],
      })
      .mockResolvedValueOnce({
        cursor: 'cursor-page-two',
        events: [
          {
            id: 'legacy-match',
            ledger: 4991,
            topic: [
              xdr.ScVal.fromXDR('AAAADwAAAAdyZWxlYXNlAA==', 'base64'),
              nativeToScVal('GUSER1'),
            ],
            value: nativeToScVal([123, 250]),
          },
        ],
      });

    const res = await fetchEscrowEvents(
      { filters: { commitmentId: '123' }, limit: 1 },
      mockServer
    );

    expect(mockServer.getEvents).toHaveBeenCalledTimes(2);
    expect(mockServer.getEvents.mock.calls[1][0]).toEqual(
      expect.objectContaining({
        cursor: 'cursor-page-one',
        filters: mockServer.getEvents.mock.calls[0][0].filters,
      })
    );
    expect(res.events.map((event) => event.id)).toEqual(['legacy-match']);
  });

  it('passes cursor when provided for paging', async () => {
    mockServer.getEvents.mockResolvedValue({
      events: [],
      cursor: 'cursor-next',
    });

    await fetchEscrowEvents({ cursor: 'existing-cursor' }, mockServer);

    expect(mockServer.getEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: 'existing-cursor',
      })
    );
  });

  it('page of 50 raw events with 3 matches still reports olderEventsAvailable and hasMore', async () => {
    const page1Events = Array.from({ length: 50 }, (_, idx) => ({
      id: `evt-${idx + 1}`,
      ledger: 4900 + idx,
      topic: [
        nativeToScVal(idx < 3 ? 'fund' : 'release'),
        nativeToScVal(idx + 1),
        nativeToScVal('GUSER1'),
      ],
      value: nativeToScVal(100),
    }));

    mockServer.getEvents.mockResolvedValue({
      cursor: 'cursor-page-1',
      events: page1Events,
    });

    const res = await fetchEscrowEvents(
      {
        limit: 50,
        maxPages: 1,
        filters: { kind: 'fund' },
      },
      mockServer
    );

    expect(res.events).toHaveLength(3);
    expect(res.rawCount).toBe(50);
    expect(res.hasMore).toBe(true);
    expect(res.olderEventsAvailable).toBe(true);
    expect(res.cursor).toBe('cursor-page-1');
  });

  it('fills a filtered page by fetching the next cursor when initial raw page has empty or partial filtered matches', async () => {
    const page1NonMatching = Array.from({ length: 10 }, (_, idx) => ({
      id: `p1-${idx}`,
      ledger: 4800 + idx,
      topic: [nativeToScVal('release'), nativeToScVal(idx), nativeToScVal('GOTHER')],
      value: nativeToScVal(100),
    }));

    const page2Matching = Array.from({ length: 4 }, (_, idx) => ({
      id: `p2-${idx}`,
      ledger: 4850 + idx,
      topic: [nativeToScVal('fund'), nativeToScVal(idx + 100), nativeToScVal('GUSER1')],
      value: nativeToScVal(250),
    }));

    mockServer.getEvents
      .mockResolvedValueOnce({
        cursor: 'cursor-after-p1',
        events: page1NonMatching,
      })
      .mockResolvedValueOnce({
        cursor: 'cursor-after-p2',
        events: page2Matching,
      });

    const res = await fetchEscrowEvents(
      {
        limit: 10,
        filters: { kind: 'fund', owner: 'GUSER1' },
      },
      mockServer
    );

    expect(mockServer.getEvents).toHaveBeenCalledTimes(2);
    expect(mockServer.getEvents).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        cursor: 'cursor-after-p1',
        limit: 10,
      })
    );
    expect(res.events).toHaveLength(4);
    expect(res.rawCount).toBe(14);
    expect(res.hasMore).toBe(false);
    expect(res.olderEventsAvailable).toBe(false);
    expect(res.cursor).toBe('cursor-after-p2');
  });

  it('returns explanatory retention state when startLedger is out of RPC retention range', async () => {
    mockServer.getEvents.mockRejectedValueOnce(
      new Error('startLedger is before oldest ledger (out of range)')
    );

    const res = await fetchEscrowEvents({ startLedger: 10 }, mockServer);

    expect(res.retentionOutOfRange).toBe(true);
    expect(res.retentionMessage).toMatch(/retention/i);
    expect(res.events).toEqual([]);
    expect(res.olderEventsAvailable).toBe(false);
  });

  it('keeps returned events bounded at 500', async () => {
    const hugeBatch = Array.from({ length: 550 }, (_, idx) => ({
      id: `evt-${idx}`,
      ledger: 4000 + idx,
      topic: [nativeToScVal('fund'), nativeToScVal(idx), nativeToScVal('GUSER1')],
      value: nativeToScVal(10),
    }));

    mockServer.getEvents.mockResolvedValue({
      cursor: 'cursor-550',
      events: hugeBatch,
    });

    const res = await fetchEscrowEvents({ limit: 550 }, mockServer);
    expect(res.events).toHaveLength(500);
  });
});
