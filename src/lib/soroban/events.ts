import { rpc, scValToNative, xdr } from '@stellar/stellar-sdk';
import { SOROBAN_RPC_URL, ESCROW_CONTRACT_ID } from '../config';

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

export function toScVal(val: unknown): xdr.ScVal {
  if (val instanceof xdr.ScVal) {
    return val as unknown as xdr.ScVal;
  }
  if (
    val &&
    typeof val === 'object' &&
    ('switch' in val || 'arm' in val || 'type' in val || typeof (val as any).toXDR === 'function')
  ) {
    return val as xdr.ScVal;
  }
  if (typeof val === 'string') {
    return xdr.ScVal.fromXDR(val, 'base64');
  }
  if (val && typeof val === 'object' && 'xdr' in val && typeof (val as any).xdr === 'string') {
    return xdr.ScVal.fromXDR((val as any).xdr, 'base64');
  }
  throw new Error('Unsupported ScVal representation');
}

export function decodeEscrowEvent(event: {
  id?: string;
  ledger: number;
  ledgerClosedAt?: string;
  topic: (xdr.ScVal | string)[];
  value: xdr.ScVal | string | { xdr: string };
  txHash?: string;
}): DecodedEscrowEvent {
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

    let decodedValue: any = null;
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
      } else if (decodedValue && typeof decodedValue === 'object') {
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
      } else if (decodedValue && typeof decodedValue === 'object') {
        if ('id' in decodedValue) commitmentId = String(decodedValue.id);
        if ('amount' in decodedValue) amount = String(decodedValue.amount);
        if ('reason' in decodedValue) description = String(decodedValue.reason).slice(0, 100);
      } else if (typeof decodedValue === 'bigint' || typeof decodedValue === 'number') {
        amount = String(decodedValue);
      }
    }
    // Shape C: (name)
    else {
      if (typeof decodedValue === 'object' && decodedValue !== null) {
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

export interface FetchEventsOptions {
  startLedger?: number;
  cursor?: string;
  limit?: number;
  contractId?: string;
  filters?: {
    kind?: string;
    owner?: string;
  };
}

export interface FetchEventsResult {
  events: DecodedEscrowEvent[];
  cursor?: string;
  latestLedger: number;
  olderEventsAvailable: boolean;
}

export async function fetchEscrowEvents(
  options: FetchEventsOptions = {},
  customServer?: rpc.Server
): Promise<FetchEventsResult> {
  const contractId =
    options.contractId || ESCROW_CONTRACT_ID || (customServer ? 'CCONTRACTFORTESTS' : '');
  if (!contractId) {
    return {
      events: [],
      latestLedger: 0,
      olderEventsAvailable: false,
    };
  }

  const server = customServer || new rpc.Server(SOROBAN_RPC_URL);
  const latestLedgerRes = await server.getLatestLedger();
  const latestLedger = latestLedgerRes.sequence;

  // Testnet retention window
  const RETENTION_WINDOW = 2000;
  const startLedger = options.startLedger ?? Math.max(1, latestLedger - RETENTION_WINDOW);

  const getEventsParams: any = {
    filters: [
      {
        type: 'contract',
        contractIds: [contractId],
      },
    ],
    limit: options.limit ?? 50,
  };

  if (options.cursor) {
    getEventsParams.cursor = options.cursor;
  } else {
    getEventsParams.startLedger = startLedger;
  }

  const response = await server.getEvents(getEventsParams);
  const seenIds = new Set<string>();
  const decoded: DecodedEscrowEvent[] = [];

  for (const raw of response.events || []) {
    if (seenIds.has(raw.id)) continue;
    seenIds.add(raw.id);

    const item = decodeEscrowEvent(raw as any);

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

    decoded.push(item);
  }

  // Bound in-memory events to 500
  const boundedEvents = decoded.slice(0, 500);

  return {
    events: boundedEvents,
    cursor: response.cursor,
    latestLedger,
    olderEventsAvailable: Boolean(
      response.cursor && response.events?.length === (options.limit ?? 50)
    ),
  };
}
