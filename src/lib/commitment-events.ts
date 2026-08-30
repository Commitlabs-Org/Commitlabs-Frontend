/**
 * Commitment event timeline pagination helpers.
 *
 * This module centralizes }
 }
 throw new CommitmentEventsError('Event sequence must be a finite number', ERROR_CODES.INVALID_EVENT, value);
  }

 return {
   id,
   type,
   commitmentId,
   actorId: typeof actorId === 'string' && actorId.length > 0 ? actorId : undefined,
   createdAt,
   blockTimestamp: blockTimestamp as string | undefined,
   sequence: sequence as number | undefined,
   data: data && typeof data === 'object' ? (data as Record<string, unknown>) : undefined,
  };
}

/**
 * Compare two timeline events for descending order.
 * Newer events (based on blockTimestamp or createdAt) come first.
 * Ties are broken by sequence then id (both descending).
 */
export function compareCommitmentEvents(a: CommitmentEvent, b: CommitmentEvent): number {
  const aTime = a.blockTimestamp || a.createdAt;
  const bTime = b.blockTimestamp || b.createdAt;
  if (aTime !== bTime) return aTime < bTime ? 1 : -1;
  const aSeq = a.sequence ?? -1;
  const bSeq = b.sequence ?? -1;
  if (aSeq !== bSeq) return aSeq < bSeq ? 1 : -1;
  if (a.id !== b.id) return a.id < b.id ? 1 : -1;
  return 0;
}

/**
 * Sort events descending in place, returning a new array.
 */
export function sortCommitmentEvents(events: CommitmentEvent[]): CommitmentEvent[] {
  if (!Array.isArray(events)) {
    throw new CommitmentEventsError('Timeline events must be an array', ERROR_CODES.INVALID_EVENT, events);
  }
  for (const event of events) {
    if (!event || typeof event.id !== 'string' || event.id.length === 0) {
      throw new CommitmentEventsError('Timeline event id must be a non-empty string', ERROR_CODES.INVALID_EVENT, event);
    }
    const timestamp = event.blockTimestamp || event.createdAt;
    if (typeof timestamp !== 'string' || timestamp.length === 0) {
      throw new CommitmentEventsError('Timeline event timestamp must be a non-empty string', ERROR_CODES.INVALID_EVENT, event);
    }
    if (event.sequence !== undefined && (typeof event.sequence !== 'number' || !Number.isFinite(event.sequence))) {
      throw new CommitmentEventsError('Timeline event sequence must be a finite number', ERROR_CODES.INVALID_EVENT, event);
    }
  }
  return [...events].sort(compareCommitmentEvents);
}

/**
 * Deduplicate commitment events by their id, preserving the first occurrence after sorting.
 * @param events Should usually be sorted before deduplication.
 */
export function dedupeCommitmentEvents(events: CommitmentEvent[]): CommitmentEvent[] {
  if (!Array.isArray(events)) {
    throw new CommitmentEventsError('Timeline events must be an array', ERROR_CODES.INVALID_EVENT, events);
  }
  const seen = new Set<string>();
  const result: CommitmentEvent[] = [];
  for (const ev of events) {
    if (!ev || typeof ev.id !== 'string' || ev.id.length === 0) {
      throw new CommitmentEventsError('Timeline event id must be a non-empty string', ERROR_CODES.INVALID_EVENT, ev);
    }
    if (!seen.has(ev.id)) {
      seen.add(ev.id);
      result.push(ev);
    }
  }
  return result;
}

// --- Cursor utilities ---

function encodeBase64Url(input: string): string {
  if (typeof btoa === 'function' && typeof TextEncoder !== 'undefined') {
    const bytes = new TextEncoder().encode(input);
    let binary = '';
    for (const byte of bytes) { binary += String.fromCharCode(byte); }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
  }
  // Node fallback (Core modules or test environment)
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(input, 'utf8').toString('base64url');
  }
  throw new CommitmentEventsError('No base64 encoding available', ERROR_CODES.INVALID_CURSOR, input);
}

function decodeBase64Url(input: string): string {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');

  if (typeof atob === 'function' && typeof TextDecoder !== 'undefined') {
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(base64, 'base64').toString('utf8');
  }
  throw new CommitmentEventsError('No base64 decoding available', ERROR_CODES.INVALID_CURSOR);
}

/**
 * Encode a cursor from the last enumerated event.
 */
export function encodeCommitmentCursor(event: CommitmentEvent): string {
  if (!event || typeof event.id !== 'string' || event.id.length === 0) {
    throw new CommitmentEventsError('Timeline event id must be a non-empty string', ERROR_CODES.INVALID_EVENT, event);
  }
  const timestamp = event.blockTimestamp || event.createdAt;
  if (typeof timestamp !== 'string' || timestamp.length === 0) {
    throw new CommitmentEventsError('Timeline event timestamp must be a non-empty string', ERROR_CODES.INVALID_EVENT, event);
  }
  if (event.sequence !== undefined && (typeof event.sequence !== 'number' || !Number.isFinite(event.sequence))) {
    throw new CommitmentEventsError('Timeline event sequence must be a finite number', ERROR_CODES.INVALID_EVENT, event);
  }
  const raw = JSON.stringify({ id: event.id, ts: timestamp, seq: event.sequence ?? null });
  return encodeBase64Url(raw);
}

/**
 * Decode an opaque cursor created by `encodeCommitmentCursor`.
 */
export function decodeCommitmentCursor(cursor: string): CommitmentCursor {
  if (typeof cursor !== 'string' || cursor.length === 0) {
    throw new CommitmentEventsError('Cursor must be a non-empty string', ERROR_CODES.INVALID_CURSOR, cursor);
  }
  let raw: string;
  try {
    raw = decodeBase64Url(cursor);
  } catch (error) {
    throw new CommitmentEventsError('Cursor is not valid base64url', ERROR_CODES.INVALID_CURSOR, error);
  }
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new CommitmentEventsError('Cursor is not a valid JSON object', ERROR_CODES.INVALID_CURSOR, error);
  }
  if (
    !parsed ||
    typeof parsed.id !== 'string' ||
    parsed.id.length === 0 ||
    typeof parsed.ts !== 'string' ||
    parsed.ts.length === 0 ||
    (parsed.seq !== null && (typeof parsed.seq !== 'number' || !Number.isFinite(parsed.seq)))
  ) {
    throw new CommitmentEventsError('Cursor payload is malformed', ERROR_CODES.INVALID_CURSOR, parsed);
  }
  return {
    id: parsed.id,
    timestamp: parsed.ts,
    sequence: parsed.seq ?? undefined,
  };
}

export interface CommitmentCursor {
  id: string;
  timestamp: string;
  sequence?: number;
}

// --- Pagination logic ---

function isEventAfterCursor(event: CommitmentEvent, cursor: CommitmentCursor): boolean {
  const time = event.blockTimestamp || event.createdAt;
  if (time !== cursor.timestamp) return time < cursor.timestamp;
  const eventSeq = event.sequence ?? -1;
  const cursorSeq = cursor.sequence ?? -1;
  if (eventSeq !== cursorSeq) return eventSeq < cursorSeq;
  return event.id < cursor.id;
}

/**
 * Parse and validate a page size parameter.
 */
export function parsePageSize(limit: unknown): number {
  let num: number;
  if (limit === undefined || limit === null) {
    num = DEFAULT_PAGE_SIZE;
  } else if (typeof limit === 'string' && limit.trim() !== '') {
    num = Number(limit);
  } else if (typeof limit === 'number') {
    num = limit;
  } else {
    throw new CommitmentEventsError('Page size must be a number or numeric string', ERROR_CODES.INVALID_LIMIT, limit);
  }
  if (!Number.isInteger(num) || num < MIN_PAGE_SIZE) {
    throw new CommitmentEventsError('Page size must be an integer greater than or equal to 1', ERROR_CODES.INVALID_LIMIT, limit);
  }
  return Math.min(num, MAX_PAGE_SIZE);
}

/**
 * Paginate a sorted list of events based on an optional cursor.
 * 
 * The input events may contain duplicates and unordered entries.
 * This function normalizes the list and enforces consistent descending
 * order.
 */
export function paginateCommitmentEvents(
  events: CommitmentEvent[],
  cursor?: string | null,
  limit?: number
): CommitmentEventsPage {
  const safeLimit = parsePageSize(limit);
  const sorted = sortCommitmentEvents(events);
  const deduped = dedupeCommitmentEvents(sorted);

  let startIndex = 0;
  if (cursor) {
    const decoded = decodeCommitmentCursor(cursor);
    const cursorIndex = deduped.findIndex(ev => ev.id === decoded.id);
    if (cursorIndex !== -1) {
      startIndex = cursorIndex + 1;
    } else {
      const olderIndex = deduped.findIndex(ev => isEventAfterCursor(ev, decoded));
      startIndex = olderIndex === -1 ? deduped.length : olderIndex;
    }
  }

  const page = deduped.slice(startIndex, startIndex + safeLimit);
  const hasMore = startIndex + safeLimit < deduped.length;
  const nextCursor = hasMore && page.length > 0 ? encodeCommitmentCursor(page[page.length - 1]) : null;

  return { events: page, nextCursor: nextCursor, hasMore };
}

// --- Fetch layer ---

/**
 * Fetch a page of commitment events from the API.
 * 
 * @param params.commitmentId The commitment ID.
 * @param params.cursor Pagination cursor from a previous response.
 * @param params.limit Requested page size (max 100).
 * @param params.signal Abort signal.
 * @param params.fetchImp Injectable fetch function for testing.
 */
export async function fetchCommitmentEvents({
  commitmentId,
  cursor,
  limit,
  signal,
  fetchImp,
  baseUrl = '',
}: FetchCommitmentEventsParams): Promise<CommitmentEventsPage> {
  if (!commitmentId) {
    throw new CommitmentEventsError('commitmentId is required', ERROR_CODES.INVALID_EVENT, commitmentId);
  }

  const path = `/api/commitments/${encodeURIComponent(commitmentId)}/events`;
  const params = new URLSearchParams();
  params.set('limit', String(parsePageSize(limit)));
  if (cursor) params.set('cursor', cursor);
  const query = params.toString();
  const url = `${baseUrl ? baseUrl.replace(/\/+$/, '') : ''}${path}${query ? `?${query}` : ''}`;

  const doFetch = fetchImp ?? (typeof fetch !== 'undefined' ? fetch : undefined);
  if (!doFetch) {
    throw new CommitmentEventsError('No fetch implementation available', ERROR_CODES.NETWORK_ERROR);
  }

  try {
    const res = await doFetch(url.toString(), {
      signal,
      headers: { 'Accept': 'application/json' },
    });

    if (res.status === 401 || res.status === 403) {
      throw new CommitmentEventsError('Not authorized to access commitment events', ERROR_CODES.UNAUTHORIZED, res.status);
    }
    if (!res.ok) {
      throw new CommitmentEventsError( `HTTP error ${res.status}`, ERROR_CODES.HTTP_ERROR, res.status );
    }

    const body = await res.json();
    return normalizeCommitmentEventsPage(body);
  } catch (error) {
    if (error instanceof CommitmentEventsError) throw error;
    if (typeof error === 'object' && error !== null && (error as { name?: string }).name === 'AbortError') {
      throw new CommitmentEventsError('Request was aborted', ERROR_CODES.ABORTED, error);
    }
    throw new CommitmentEventsError('Failed to fetch commitment events', ERROR_CODES.NETWORK_ERROR, error);
  }
}

function normalizeCommitmentEventsPage(value: unknown): CommitmentEventsPage {
  if (typeof value !== 'object' || value === null) {
    throw new CommitmentEventsError('Response must be an object', ERROR_CODES.INVALID_EVENT, value);
  }
  const v = value as Record<string, unknown>;
  if (!Array.isArray(v.events)) {
    throw new CommitmentEventsError('Events page must contain an array of events', ERROR_CODES.INVALID_EVENT, value);
  }
  const events = dedupeCommitmentEvents(sortCommitmentEvents(v.events.map(event => normalizeCommitmentEvent(event))));
  const nextCursor = typeof v.nextCursor === 'string' ? v.nextCursor : null;
  const hasMore = Boolean(v.hasMore);
  const total = typeof v.total === 'number' && Number.isFinite(v.total) && v.total >= 0 ? v.total : undefined;
  return { events, nextCursor, hasMore, total };
}

// --- Merge pages ---

/**
 * Merge two commitment event pages (e.g., previous page merged with next page).
 * Preserves sort order and deduplicates by event id.
 */
export function mergeCommitmentEventPages(
  previous?: CommitmentEventsPage | null,
  next?: CommitmentEventsPage | null
): CommitmentEventsPage {
  if (!previous) {
    if (!next) return { events: [], nextCursor: null, hasMore: false };
    return { ...next, events: dedupeCommitmentEvents(sortCommitmentEvents(next.events)) };
  }
  if (!next) {
    return { ...previous, events: dedupeCommitmentEvents(sortCommitmentEvents(previous.events)) };
  }
  const merged = sortCommitmentEvents([...previous.events, ...next.events]);
  const events = dedupeCommitmentEvents(merged);
  return {
    events,
    nextCursor: next.nextCursor,
    hasMore: next.hasMore,
    total: next.total ?? previous.total,
  };
}
