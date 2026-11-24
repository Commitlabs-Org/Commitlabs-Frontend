import { getActiveConfig } from '../config';
import { nativeToScVal, rpc, scValToNative, xdr } from '@stellar/stellar-sdk';

export interface DecodedEscrowEvent {
  id: string;
  kind: string;
  commitmentId?: string;
  owner?: string;
  amount?: string;
  description?: string;
  ledger: number;
  txHash: string;
  at: string;
}

export type RawEvent = Pick<rpc.Api.EventResponse, 'ledger'> &
  Partial<Omit<rpc.Api.EventResponse, 'ledger' | 'topic' | 'value'>> & {
    topic: (xdr.ScVal | string)[];
    value: xdr.ScVal | string | { xdr: string };
  };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function toScVal(val: unknown): xdr.ScVal {
  if (val instanceof xdr.ScVal) {
    return val as unknown as xdr.ScVal;
  }
  if (
    isRecord(val) &&
    ('switch' in val || 'arm' in val || 'type' in val || typeof val.toXDR === 'function')
  ) {
    return val as unknown as xdr.ScVal;
  }
  if (typeof val === 'string') {
    return xdr.ScVal.fromXDR(val, 'base64');
  }
  if (isRecord(val) && typeof val.xdr === 'string') {
    return xdr.ScVal.fromXDR(val.xdr, 'base64');
  }
  throw new Error('Unsupported ScVal representation');
}

export function decodeEscrowEvent(event: RawEvent): DecodedEscrowEvent {
  const eventId = event.id || `${event.ledger}-${event.txHash || 'event'}`;
  const at = event.ledgerClosedAt || new Date().toISOString();
  const txHash = event.txHash || '';
  const ledger = event.ledger;

  try {
    if (!event.topic || event.topic.length === 0) {
      return { id: eventId, kind: 'unknown', ledger, txHash, at };
    }

    const decodedTopics = event.topic.map((t) => {
      try {
        return scValToNative(toScVal(t));
      } catch {
        return null;
      }
    });

    let decodedValue: unknown = null;
    try {
      decodedValue = scValToNative(toScVal(event.value));
    } catch {
      decodedValue = null;
    }

    const kind = typeof decodedTopics[0] === 'string' ? decodedTopics[0] : 'unknown';
    let commitmentId: string | undefined;
    let owner: string | undefined;
    let amount: string | undefined;
    let description: string | undefined;

    // Shape A: (name, id, owner)
    if (decodedTopics.length >= 3) {
      if (decodedTopics[1] !== null && decodedTopics[1] !== undefined) {
        commitmentId = String(decodedTopics[1]);
      }
      if (typeof decodedTopics[2] === 'string') {
        owner = decodedTopics[2];
      }
      if (typeof decodedValue === 'bigint' || typeof decodedValue === 'number') {
        amount = String(decodedValue);
      } else if (Array.isArray(decodedValue) && decodedValue.length > 0) {
        amount = String(decodedValue[0]);
      } else if (isRecord(decodedValue)) {
        if ('amount' in decodedValue) amount = String(decodedValue.amount);
        if ('reason' in decodedValue) description = String(decodedValue.reason).slice(0, 100);
      }
    }
    // Shape B: (name, owner)
    else if (decodedTopics.length === 2) {
      if (typeof decodedTopics[1] === 'string') {
        owner = decodedTopics[1];
      }
      if (Array.isArray(decodedValue)) {
        if (decodedValue[0] !== undefined) commitmentId = String(decodedValue[0]);
        if (decodedValue[1] !== undefined) amount = String(decodedValue[1]);
      } else if (isRecord(decodedValue)) {
        if ('id' in decodedValue) commitmentId = String(decodedValue.id);
        if ('amount' in decodedValue) amount = String(decodedValue.amount);
        if ('reason' in decodedValue) description = String(decodedValue.reason).slice(0, 100);
      } else if (typeof decodedValue === 'bigint' || typeof decodedValue === 'number') {
        amount = String(decodedValue);
      }
    }
    // Shape C: (name)
    else {
      if (isRecord(decodedValue)) {
        if ('owner' in decodedValue) owner = String(decodedValue.owner);
        if ('id' in decodedValue) commitmentId = String(decodedValue.id);
        if ('amount' in decodedValue) amount = String(decodedValue.amount);
      }
    }

    return {
      id: eventId,
      kind,
      commitmentId,
      owner,
      amount,
      description,
      ledger,
      txHash,
      at,
    };
  } catch {
    return {
      id: eventId,
      kind: 'unknown',
      ledger,
      txHash,
      at,
    };
  }
}

export const MAX_EVENTS_IN_MEMORY = 500;
export const DEFAULT_PAGE_LIMIT = 50;
export const RETENTION_WINDOW = 2000;
const MAX_FILTER_PAGES = 10;
const COMMITMENT_EVENT_NAMES = [
  'create_commitment',
  'fund',
  'fund_escrow',
  'cancel_commitment',
  'release',
  'dispute',
  'refund',
  'refund_partial',
  'resolve',
  'resolve_dispute',
  'commitment_violated',
];

function encodeSymbolTopic(name: string): string {
  // Encode the ScVal type and XDR string directly to avoid SDK symbol encoding issues in browsers.
  const symbolBytes = Array.from(name, (character) => character.charCodeAt(0));
  if (symbolBytes.some((byte) => byte > 0x7f)) {
    throw new Error('Soroban event symbols must contain ASCII characters.');
  }
  const padding = (4 - (symbolBytes.length % 4)) % 4;
  const xdrBytes = [
    0,
    0,
    0,
    15,
    0,
    0,
    0,
    symbolBytes.length,
    ...symbolBytes,
    ...Array(padding).fill(0),
  ];
  return btoa(String.fromCharCode(...xdrBytes));
}

export interface FetchEventsOptions {
  startLedger?: number;
  cursor?: string;
  limit?: number;
  maxPages?: number;
  contractId?: string;
  filters?: {
    kind?: string;
    owner?: string;
    commitmentId?: string;
  };
}

export interface FetchEventsResult {
  events: DecodedEscrowEvent[];
  cursor?: string;
  latestLedger: number;
  rawCount: number;
  hasMore: boolean;
  olderEventsAvailable: boolean;
  retentionOutOfRange?: boolean;
  retentionMessage?: string;
}

export function isLedgerOutOfRangeError(err: unknown): boolean {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : String(err ?? '');
  return /startLedger|start is before oldest ledger|start is after newest ledger|ledger range|out of range|retention|oldest ledger|outside.*range|-32600|-32602/i.test(
    msg
  );
}

export async function fetchEscrowEvents(
  options: FetchEventsOptions = {},
  customServer?: rpc.Server
): Promise<FetchEventsResult> {
  const config = getActiveConfig();
  const contractId =
    options.contractId || config.escrowContractId || (customServer ? 'CCONTRACTFORTESTS' : '');
  if (!contractId) {
    return {
      events: [],
      latestLedger: 0,
      rawCount: 0,
      hasMore: false,
      olderEventsAvailable: false,
    };
  }

  const server = customServer || new rpc.Server(config.sorobanRpcUrl);
  const latestLedgerRes = await server.getLatestLedger();
  const latestLedger = latestLedgerRes.sequence;

  const limit = options.limit ?? DEFAULT_PAGE_LIMIT;
  const startLedger = options.startLedger ?? Math.max(1, latestLedger - RETENTION_WINDOW);
  const hasActiveFilters = Boolean(
    (options.filters?.kind && options.filters.kind !== 'all') ||
      options.filters?.owner ||
      options.filters?.commitmentId
  );
  const maxPages = options.maxPages ?? (hasActiveFilters ? MAX_FILTER_PAGES : 1);
  const commitmentId = options.filters?.commitmentId;
  if (commitmentId !== undefined && !/^\d+$/.test(commitmentId)) {
    throw new RangeError('commitmentId must be a valid u64 integer.');
  }
  const commitmentIdAsBigInt = commitmentId === undefined ? undefined : BigInt(commitmentId);
  if (
    commitmentIdAsBigInt !== undefined &&
    (commitmentIdAsBigInt < 0n || commitmentIdAsBigInt > 18446744073709551615n)
  ) {
    throw new RangeError('commitmentId must be a valid u64 integer.');
  }
  const commitmentIdTopic =
    commitmentIdAsBigInt === undefined
      ? undefined
      : nativeToScVal(commitmentIdAsBigInt, { type: 'u64' }).toXDR('base64');
  const seenIds = new Set<string>();
  const decoded: DecodedEscrowEvent[] = [];
  let currentCursor = options.cursor;
  let lastCursor = options.cursor;
  let totalRawCount = 0;
  let hasMore = false;
  let pagesFetched = 0;

  while (pagesFetched < maxPages) {
    const topics =
      commitmentIdTopic === undefined
        ? undefined
        : [
            ...COMMITMENT_EVENT_NAMES.map((name) => [
              encodeSymbolTopic(name),
              commitmentIdTopic,
              '*',
            ]),
            ['*', commitmentIdTopic, '*'],
            // Legacy events put the commitment ID in the value rather than topic 1.
            ['*', '*'],
            ['*'],
          ];
    const eventFilter = {
      type: 'contract' as const,
      contractIds: [contractId],
      ...(topics ? { topics } : {}),
    };
    const getEventsParams: Parameters<rpc.Server['getEvents']>[0] = currentCursor
      ? { filters: [eventFilter], limit, cursor: currentCursor }
      : { filters: [eventFilter], limit, startLedger };

    let response: rpc.Api.GetEventsResponse;
    try {
      response = await server.getEvents(getEventsParams);
    } catch (err) {
      if (isLedgerOutOfRangeError(err)) {
        return {
          events: decoded.slice(0, MAX_EVENTS_IN_MEMORY),
          cursor: lastCursor,
          latestLedger,
          rawCount: totalRawCount,
          hasMore: false,
          olderEventsAvailable: false,
          retentionOutOfRange: true,
          retentionMessage:
            'Requested startLedger is outside the Soroban RPC retention window. Showing available recent events within the retention range.',
        };
      }
      throw err;
    }

    pagesFetched += 1;
    const rawEvents = response.events;
    const pageRawCount = rawEvents.length;
    totalRawCount += pageRawCount;

    const nextCursor: string | undefined =
      response.cursor || (pageRawCount > 0 ? rawEvents[pageRawCount - 1]?.id : undefined);
    if (nextCursor) {
      lastCursor = nextCursor;
    }

    for (const raw of rawEvents) {
      if (seenIds.has(raw.id)) continue;
      seenIds.add(raw.id);

      const item = decodeEscrowEvent(raw as RawEvent);

      if (
        options.filters?.kind &&
        options.filters.kind !== 'all' &&
        item.kind !== options.filters.kind
      ) {
        continue;
      }
      if (options.filters?.owner && item.owner !== options.filters.owner) {
        continue;
      }
      if (
        commitmentId !== undefined &&
        raw.topic.length < 3 &&
        item.commitmentId !== commitmentId
      ) {
        continue;
      }

      decoded.push(item);
    }

    const pageIsFull = pageRawCount >= limit;
    const cursorAdvanced = Boolean(nextCursor && nextCursor !== currentCursor);
    hasMore = Boolean(pageIsFull && cursorAdvanced);

    if (!hasMore || decoded.length >= limit || decoded.length >= MAX_EVENTS_IN_MEMORY) {
      break;
    }

    currentCursor = nextCursor;
  }

  // Bound in-memory events to 500
  const boundedEvents = decoded.slice(0, MAX_EVENTS_IN_MEMORY);

  return {
    events: boundedEvents,
    cursor: lastCursor,
    latestLedger,
    rawCount: totalRawCount,
    hasMore,
    olderEventsAvailable: hasMore,
  };
}
