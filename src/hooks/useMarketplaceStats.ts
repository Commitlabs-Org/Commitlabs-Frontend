import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type StatsClientState =
  | 'IDLE'
  | 'FETCHING'
  | 'REVALIDATING'
  | 'FRESH'
  | 'STALE'
  | 'STALE_IF_ERROR'
  | 'EMPTY'
  | 'ERROR';

export interface MarketplaceStatsData {
  activeListings: number;
  averageYield: number;
  medianPrice: number;
  typeBreakdown: Record<'Safe' | 'Balanced' | 'Aggressive', number>;
}

export interface StatsClientMeta {
  freshness: 'FRESH' | 'STALE_WHILE_REVALIDATE' | 'STALE_IF_ERROR' | 'EMPTY' | 'REVALIDATING_LOCK' | 'UNKNOWN';
  ageSeconds: number;
  generation: number;
  lastValidGeneration: number;
  cacheHit: boolean;
  state: string;
  fetchedAtIso?: string;
  expiresAtIso?: string;
  sourceCorrelationId?: string;
  requestedGeneration?: number;
  servedGeneration?: number;
  serverCorrelationId?: string;
  etag?: string;
  note?: string;
}

export interface StatsClientError {
  code: string;
  message: string;
  retryable: boolean;
  retryAfterSeconds?: number;
  correlationId?: string;
  httpStatus?: number;
}

export interface UseMarketplaceStatsResult {
  stats: MarketplaceStatsData;
  meta: StatsClientMeta | null;
  state: StatsClientState;
  error: StatsClientError | null;
  isFetching: boolean;
  isRevalidating: boolean;
  isStale: boolean;
  generation: number;
  retryCount: number;
  lastAttemptedAt: number | null;
  lastSuccessAt: number | null;
  fetch: (force?: boolean) => Promise<void>;
  revalidate: () => Promise<void>;
  reset: () => void;
}

const DEFAULT_STATS: MarketplaceStatsData = Object.freeze({
  activeListings: 0,
  averageYield: 0,
  medianPrice: 0,
  typeBreakdown: { Safe: 0, Balanced: 0, Aggressive: 0 },
});

const DEFAULT_META: StatsClientMeta = {
  freshness: 'UNKNOWN',
  ageSeconds: 0,
  generation: 0,
  lastValidGeneration: 0,
  cacheHit: false,
  state: 'EMPTY',
};

const CLIENT_CACHE_TTL_MS = 15_000;
const CLIENT_STALE_GRACE_MS = 120_000;
const CLIENT_MAX_RETRIES = 3;
const CLIENT_RETRY_BASE_MS = 350;
const AUTO_REVALIDATE_INTERVAL_MS = 30_000;

interface PendingStatsRequest {
  generation: number;
  startedAt: number;
  abortController: AbortController;
  isRevalidation: boolean;
}

function classifyStatsClientState(
  prevState: StatsClientState,
  dataAgeMs: number | null,
  hasError: boolean,
  hasStats: boolean,
  freshnessFlag?: string,
): StatsClientState {
  if (hasError) {
    if (hasStats) return 'STALE_IF_ERROR';
    return 'ERROR';
  }
  if (freshnessFlag === 'FRESH') return 'FRESH';
  if (freshnessFlag === 'EMPTY') return 'EMPTY';
  if (freshnessFlag === 'STALE_IF_ERROR') return hasStats ? 'STALE_IF_ERROR' : 'ERROR';
  if (freshnessFlag === 'STALE_WHILE_REVALIDATE') return 'STALE';
  if (freshnessFlag === 'REVALIDATING_LOCK') return 'STALE';
  if (dataAgeMs === null) return prevState === 'IDLE' ? 'IDLE' : hasStats ? 'STALE' : 'EMPTY';
  if (dataAgeMs <= CLIENT_CACHE_TTL_MS) return 'FRESH';
  if (dataAgeMs <= CLIENT_STALE_GRACE_MS) return 'STALE';
  return hasStats ? 'STALE' : 'EMPTY';
}

function classifyClientError(
  res: Response | null,
  body: unknown,
): StatsClientError {
  const status = res?.status ?? 0;
  const errBody =
    body && typeof body === 'object' && 'error' in body
      ? (body as { error?: Record<string, unknown> }).error
      : null;

  const code: string =
    (errBody && typeof errBody.code === 'string' && errBody.code) ||
    (status === 404 ? 'MARKETPLACE_DISABLED' :
      status === 429 ? 'TOO_MANY_REQUESTS' :
        status === 408 ? 'TIMEOUT' :
          status === 500 ? 'INTERNAL_ERROR' :
            status === 502 ? 'BAD_GATEWAY' :
              status === 503 ? 'SERVICE_UNAVAILABLE' :
                status === 504 ? 'GATEWAY_TIMEOUT' :
                  status === 400 ? 'BAD_REQUEST' :
                    status === 401 ? 'UNAUTHORIZED' :
                      status === 403 ? 'FORBIDDEN' :
                        status >= 400 ? `HTTP_${status}` : 'NETWORK_ERROR');

  const message: string =
    (errBody && typeof errBody.message === 'string' && errBody.message) ||
    status === 0 ? 'Network request failed. Check your connection and try again.' :
      `Stats request failed (HTTP ${status}).`;

  const retryable =
    code === 'MARKETPLACE_DISABLED' ? false :
      (status === 0) ||
      status === 408 ||
      status === 429 ||
      status === 500 ||
      status === 502 ||
      status === 503 ||
      status === 504 ||
      (errBody && (errBody as { retryable?: unknown }).retryable === true);

  const retryAfterSeconds =
    typeof (errBody as { retryAfterSeconds?: unknown } | undefined)?.retryAfterSeconds === 'number'
      ? ((errBody as { retryAfterSeconds: number }).retryAfterSeconds)
      : status === 429 || status === 503
        ? 30
        : undefined;

  const correlationId =
    typeof (errBody as { correlationId?: unknown } | undefined)?.correlationId === 'string'
      ? (errBody as { correlationId: string }).correlationId
      : undefined;

  return { code, message, retryable, retryAfterSeconds, correlationId, httpStatus: status || undefined };
}

export function useMarketplaceStats(options: { disabled?: boolean; autoRevalidate?: boolean } = {}): UseMarketplaceStatsResult {
  const { disabled = false, autoRevalidate = true } = options;

  const [stats, setStats] = useState<MarketplaceStatsData>(DEFAULT_STATS);
  const [meta, setMeta] = useState<StatsClientMeta | null>(null);
  const [state, setState] = useState<StatsClientState>('IDLE');
  const [error, setError] = useState<StatsClientError | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [generation, setGeneration] = useState(0);
  const [lastAttemptedAt, setLastAttemptedAt] = useState<number | null>(null);
  const [lastSuccessAt, setLastSuccessAt] = useState<number | null>(null);

  const generationRef = useRef(0);
  const pendingRef = useRef<PendingStatsRequest | null>(null);
  const etagRef = useRef<string | null>(null);
  const lastFetchedAtRef = useRef<number | null>(null);
  const lastValidPayloadRef = useRef<{ stats: MarketplaceStatsData; meta: StatsClientMeta } | null>(null);
  const autoRevalidateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelPending = useCallback((): void => {
    pendingRef.current?.abortController.abort();
    pendingRef.current = null;
  }, []);

  const bumpGeneration = useCallback((): number => {
    generationRef.current += 1;
    setGeneration(generationRef.current);
    return generationRef.current;
  }, []);

  const reset = useCallback((): void => {
    cancelPending();
    etagRef.current = null;
    lastFetchedAtRef.current = null;
    lastValidPayloadRef.current = null;
    if (autoRevalidateTimerRef.current) {
      clearTimeout(autoRevalidateTimerRef.current);
      autoRevalidateTimerRef.current = null;
    }
    setStats(DEFAULT_STATS);
    setMeta(null);
    setState('IDLE');
    setError(null);
    setRetryCount(0);
    setLastAttemptedAt(null);
    setLastSuccessAt(null);
    bumpGeneration();
  }, [cancelPending, bumpGeneration]);

  const doFetch = useCallback(
    async (force: boolean = false, isRevalidation: boolean = false): Promise<void> => {
      if (disabled) return;

      if (!force) {
        if (pendingRef.current) return;
        const ageMs =
          lastFetchedAtRef.current !== null ? Date.now() - lastFetchedAtRef.current : null;
        if (ageMs !== null && ageMs < CLIENT_CACHE_TTL_MS && !isRevalidation) {
          return;
        }
      }

      cancelPending();

      const myGeneration = bumpGeneration();
      const abort = new AbortController();
      pendingRef.current = {
        generation: myGeneration,
        startedAt: Date.now(),
        abortController: abort,
        isRevalidation,
      };
      setLastAttemptedAt(Date.now());
      setState((prev) => {
        if (prev === 'IDLE' || prev === 'EMPTY' || prev === 'ERROR') return 'FETCHING';
        return 'REVALIDATING';
      });
      setError(null);

      let attempt = 0;
      let lastErr: StatsClientError | null = null;
      const staleSnapshot = lastValidPayloadRef.current;

      while (attempt <= CLIENT_MAX_RETRIES) {
        if (abort.signal.aborted) break;
        if (myGeneration !== generationRef.current) break;
        attempt += 1;

        try {
          const headers: Record<string, string> = { Accept: 'application/json' };
          if (etagRef.current && !force) {
            headers['If-None-Match'] = etagRef.current;
          }

          const res = await fetch('/api/marketplace/stats', {
            method: 'GET',
            headers,
            signal: abort.signal,
            credentials: 'same-origin',
          });

          if (res.status === 304) {
            if (abort.signal.aborted || myGeneration !== generationRef.current) break;
            pendingRef.current = null;
            const now = Date.now();
            lastFetchedAtRef.current = now;
            setLastSuccessAt(now);
            setRetryCount(attempt - 1);
            setError(null);
            setState((s) => (s === 'FETCHING' ? staleSnapshot ? 'FRESH' : 'FRESH' : s === 'REVALIDATING' ? 'FRESH' : s));
            return;
          }

          let body: unknown = null;
          try {
            body = await res.json();
          } catch {
            body = null;
          }

          const serverCorrelationId =
            res.headers.get('x-correlation-id') || res.headers.get('x-request-id') || undefined;
          const resEtag = res.headers.get('ETag') || undefined;

          if (!res.ok) {
            const classified = classifyClientError(res, body);
            if (serverCorrelationId && !classified.correlationId) {
              classified.correlationId = serverCorrelationId;
            }
            lastErr = classified;

            if (!classified.retryable || attempt > CLIENT_MAX_RETRIES) break;

            const delayMs =
              classified.retryAfterSeconds
                ? classified.retryAfterSeconds * 1000
                : CLIENT_RETRY_BASE_MS * Math.pow(2, attempt - 1);

            await new Promise<void>((r) => {
              const t = setTimeout(r, delayMs);
              abort.signal.addEventListener('abort', () => {
                clearTimeout(t);
                r();
              });
            });
            continue;
          }

          const okBody =
            body && typeof body === 'object' && (body as { success?: unknown }).success === true
              ? (body as { data?: unknown; meta?: unknown })
              : null;

          const rawData = okBody?.data;
          const rawMeta = okBody?.meta;

          if (
            !rawData ||
            typeof rawData !== 'object' ||
            typeof (rawData as { activeListings?: unknown }).activeListings !== 'number'
          ) {
            lastErr = {
              code: 'MALFORMED_RESPONSE',
              message: 'Stats response failed structural validation.',
              retryable: false,
              httpStatus: 200,
            };
            break;
          }

          const data = rawData as MarketplaceStatsData;
          const metaObj: StatsClientMeta =
            rawMeta && typeof rawMeta === 'object'
              ? {
                  ...DEFAULT_META,
                  freshness:
                    typeof (rawMeta as { freshness?: unknown }).freshness === 'string'
                      ? ((rawMeta as { freshness: StatsClientMeta['freshness'] }).freshness)
                      : 'UNKNOWN',
                  ageSeconds:
                    typeof (rawMeta as { ageSeconds?: unknown }).ageSeconds === 'number'
                      ? (rawMeta as { ageSeconds: number }).ageSeconds
                      : 0,
                  generation:
                    typeof (rawMeta as { generation?: unknown }).generation === 'number'
                      ? (rawMeta as { generation: number }).generation
                      : 0,
                  lastValidGeneration:
                    typeof (rawMeta as { lastValidGeneration?: unknown }).lastValidGeneration === 'number'
                      ? (rawMeta as { lastValidGeneration: number }).lastValidGeneration
                      : 0,
                  cacheHit:
                    (rawMeta as { cacheHit?: unknown }).cacheHit === true,
                  state:
                    typeof (rawMeta as { state?: unknown }).state === 'string'
                      ? (rawMeta as { state: string }).state
                      : 'UNKNOWN',
                  fetchedAtIso:
                    typeof (rawMeta as { fetchedAtIso?: unknown }).fetchedAtIso === 'string'
                      ? (rawMeta as { fetchedAtIso: string }).fetchedAtIso
                      : undefined,
                  expiresAtIso:
                    typeof (rawMeta as { expiresAtIso?: unknown }).expiresAtIso === 'string'
                      ? (rawMeta as { expiresAtIso: string }).expiresAtIso
                      : undefined,
                  sourceCorrelationId:
                    typeof (rawMeta as { sourceCorrelationId?: unknown }).sourceCorrelationId === 'string'
                      ? (rawMeta as { sourceCorrelationId: string }).sourceCorrelationId
                      : undefined,
                  requestedGeneration:
                    typeof (rawMeta as { requestedGeneration?: unknown }).requestedGeneration === 'number'
                      ? (rawMeta as { requestedGeneration: number }).requestedGeneration
                      : undefined,
                  servedGeneration:
                    typeof (rawMeta as { servedGeneration?: unknown }).servedGeneration === 'number'
                      ? (rawMeta as { servedGeneration: number }).servedGeneration
                      : undefined,
                  serverCorrelationId,
                  etag: resEtag,
                  note:
                    typeof (rawMeta as { note?: unknown }).note === 'string'
                      ? (rawMeta as { note: string }).note
                      : undefined,
                }
              : { ...DEFAULT_META, serverCorrelationId, etag: resEtag };

          if (abort.signal.aborted) break;
          if (myGeneration !== generationRef.current) break;
          if (pendingRef.current?.abortController !== abort) break;

          pendingRef.current = null;
          if (resEtag) etagRef.current = resEtag;

          const now = Date.now();
          lastFetchedAtRef.current = now;
          lastValidPayloadRef.current = { stats: { ...data }, meta: metaObj };
          setStats(data);
          setMeta(metaObj);
          setLastSuccessAt(now);
          setRetryCount(attempt - 1);
          setError(null);

          const freshnessStr = metaObj.freshness;
          const nextState = classifyStatsClientState(
            state,
            metaObj.ageSeconds * 1000,
            false,
            data.activeListings > 0 || data.typeBreakdown.Safe + data.typeBreakdown.Balanced + data.typeBreakdown.Aggressive > 0 || true,
            freshnessStr,
          );
          setState(nextState);
          return;
        } catch (fetchErr: unknown) {
          if (abort.signal.aborted) break;
          const msg = fetchErr instanceof Error ? fetchErr.message : 'Unknown fetch error';
          lastErr = {
            code: 'NETWORK_ERROR',
            message: msg,
            retryable: attempt <= CLIENT_MAX_RETRIES,
          };
          if (attempt > CLIENT_MAX_RETRIES) break;
          const delayMs = CLIENT_RETRY_BASE_MS * Math.pow(2, attempt - 1);
          await new Promise<void>((r) => {
            const t = setTimeout(r, delayMs);
            abort.signal.addEventListener('abort', () => {
              clearTimeout(t);
              r();
            });
          });
        }
      }

      if (pendingRef.current?.abortController === abort) {
        pendingRef.current = null;
      }
      if (abort.signal.aborted || myGeneration !== generationRef.current) return;

      setRetryCount(Math.max(0, attempt - 1));
      setError(lastErr);

      if (staleSnapshot) {
        setStats(staleSnapshot.stats);
        setMeta(staleSnapshot.meta);
        setState('STALE_IF_ERROR');
      } else {
        setState('ERROR');
      }
    },
    [disabled, cancelPending, bumpGeneration, state],
  );

  const fetch = useCallback(
    async (force: boolean = false): Promise<void> => {
      await doFetch(force, false);
    },
    [doFetch],
  );

  const revalidate = useCallback(async (): Promise<void> => {
    await doFetch(true, true);
  }, [doFetch]);

  useEffect(() => {
    if (disabled) return;
    if (state === 'IDLE') {
      doFetch(false, false).catch(() => {});
    }
  }, [disabled, state, doFetch]);

  useEffect(() => {
    if (disabled || !autoRevalidate) return;
    if (autoRevalidateTimerRef.current) {
      clearTimeout(autoRevalidateTimerRef.current);
    }
    autoRevalidateTimerRef.current = setTimeout(() => {
      if (pendingRef.current) return;
      doFetch(true, true).catch(() => {});
    }, AUTO_REVALIDATE_INTERVAL_MS);
    return () => {
      if (autoRevalidateTimerRef.current) {
        clearTimeout(autoRevalidateTimerRef.current);
        autoRevalidateTimerRef.current = null;
      }
    };
  }, [disabled, autoRevalidate, doFetch, lastSuccessAt]);

  useEffect(() => {
    return () => {
      cancelPending();
      if (autoRevalidateTimerRef.current) {
        clearTimeout(autoRevalidateTimerRef.current);
        autoRevalidateTimerRef.current = null;
      }
    };
  }, [cancelPending]);

  const isFetching = state === 'FETCHING';
  const isRevalidating = state === 'REVALIDATING';
  const isStale = state === 'STALE' || state === 'STALE_IF_ERROR';

  return useMemo(
    () => ({
      stats,
      meta,
      state,
      error,
      isFetching,
      isRevalidating,
      isStale,
      generation,
      retryCount,
      lastAttemptedAt,
      lastSuccessAt,
      fetch,
      revalidate,
      reset,
    }),
    [
      stats,
      meta,
      state,
      error,
      isFetching,
      isRevalidating,
      isStale,
      generation,
      retryCount,
      lastAttemptedAt,
      lastSuccessAt,
      fetch,
      revalidate,
      reset,
    ],
  );
}
