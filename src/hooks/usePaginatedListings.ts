import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MarketplaceCardProps } from '@/components/MarketplaceCard';

export type ListingsFetchState =
  | 'IDLE'
  | 'LOADING_INITIAL'
  | 'LOADING_MORE'
  | 'REFRESHING'
  | 'SUCCESS'
  | 'ERROR_STALE'
  | 'ERROR_EMPTY'
  | 'EXHAUSTED';

export interface ListingsFetchError {
  code: string;
  message: string;
  retryable: boolean;
  retryAfterSeconds?: number;
  correlationId?: string;
}

export interface UsePaginatedListingsResult {
  listings: MarketplaceCardProps[];
  rawListings: Array<Record<string, unknown>>;
  isLoading: boolean;
  isLoadingInitial: boolean;
  isLoadingMore: boolean;
  isRefreshing: boolean;
  state: ListingsFetchState;
  hasMore: boolean;
  page: number;
  pageSize: number;
  total: number | null;
  error: ListingsFetchError | null;
  retryCount: number;
  generation: number;
  loadMore: () => Promise<void>;
  refresh: (hardReset?: boolean) => Promise<void>;
  reset: () => void;
}

interface PendingRequest {
  generation: number;
  page: number;
  pageSize: number;
  startedAt: number;
  abortController: AbortController;
  queryHash: string;
}

function stableQueryHash(queryParams: Record<string, unknown>): string {
  const entries = Object.entries(queryParams)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(entries);
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    if (!item?.id) continue;
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    result.push(item);
  }
  return result;
}

function classifyApiError(
  res: Response | null,
  body: unknown,
): { retryable: boolean; code: string; message: string; retryAfterSeconds?: number } {
  const status = res?.status ?? 0;
  const errBody =
    body && typeof body === 'object' && 'error' in body
      ? (body as { error?: Record<string, unknown> }).error
      : null;

  const code: string =
    (errBody && typeof errBody.code === 'string' && errBody.code) ||
    (status === 429 ? 'TOO_MANY_REQUESTS' :
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
    `Request failed (HTTP ${status}).`;

  const retryable =
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

  return { code, message, retryable, retryAfterSeconds };
}

function buildQueryString(
  queryParams: Record<string, unknown>,
  page: number,
  pageSize: number,
): string {
  const params = new URLSearchParams();
  Object.entries(queryParams).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    params.append(k, String(v));
  });
  params.append('page', String(page));
  params.append('pageSize', String(pageSize));
  return params.toString();
}

const CLIENT_MAX_RETRIES = 3;
const CLIENT_RETRY_BASE_MS = 400;

export function usePaginatedListings(
  queryParams: Record<string, any> = {},
  pageSize: number = 9,
  disabled: boolean = false,
): UsePaginatedListingsResult {
  const [listings, setListings] = useState<MarketplaceCardProps[]>([]);
  const [rawListings, setRawListings] = useState<Array<Record<string, unknown>>>([]);
  const [state, setState] = useState<ListingsFetchState>('IDLE');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState<ListingsFetchError | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [generation, setGeneration] = useState(0);

  const generationRef = useRef(0);
  const pendingRef = useRef<PendingRequest | null>(null);
  const stableQueryRef = useRef(stableQueryHash(queryParams));
  const pageRef = useRef(1);
  const persistedStaleItemsRef = useRef<MarketplaceCardProps[]>([]);

  const queryChangedThisRender = stableQueryHash(queryParams) !== stableQueryRef.current;

  if (queryChangedThisRender) {
    stableQueryRef.current = stableQueryHash(queryParams);
    generationRef.current += 1;
    pageRef.current = 1;
  }

  useEffect(() => {
    if (queryChangedThisRender) {
      setListings([]);
      setRawListings([]);
      setPage(1);
      setTotal(null);
      setError(null);
      setRetryCount(0);
      setState('IDLE');
      setGeneration(generationRef.current);
      pendingRef.current?.abortController.abort();
      pendingRef.current = null;
    }
  }, [queryChangedThisRender]);

  useEffect(() => {
    return () => {
      pendingRef.current?.abortController.abort();
      pendingRef.current = null;
    };
  }, []);

  const performFetch = useCallback(
    async (
      targetPage: number,
      mode: 'initial' | 'more' | 'refresh',
      hardReset: boolean = false,
    ): Promise<void> => {
      if (disabled) return;

      if (pendingRef.current) {
        const p = pendingRef.current;
        if (mode === 'initial' || mode === 'refresh') {
          p.abortController.abort();
          pendingRef.current = null;
        } else {
          return;
        }
      }

      const myGeneration = generationRef.current;
      const myQueryHash = stableQueryRef.current;
      const abort = new AbortController();
      pendingRef.current = {
        generation: myGeneration,
        page: targetPage,
        pageSize,
        startedAt: Date.now(),
        abortController: abort,
        queryHash: myQueryHash,
      };

      if (mode === 'initial') setState('LOADING_INITIAL');
      else if (mode === 'more') setState('LOADING_MORE');
      else setState('REFRESHING');

      setError(null);

      let attempt = 0;
      let lastError: ListingsFetchError | null = null;

      while (attempt <= CLIENT_MAX_RETRIES) {
        if (abort.signal.aborted) break;
        if (myGeneration !== generationRef.current) break;
        if (myQueryHash !== stableQueryRef.current) break;

        attempt += 1;

        try {
          const qs = buildQueryString(queryParams, targetPage, pageSize);
          const res = await fetch(`/api/marketplace/listings?${qs}`, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            signal: abort.signal,
            credentials: 'same-origin',
          });

          if (res.status === 304) {
            if (abort.signal.aborted || myGeneration !== generationRef.current) break;
            pendingRef.current = null;
            setState((s) =>
              s === 'LOADING_INITIAL' || s === 'REFRESHING' ? 'SUCCESS' : s,
            );
            return;
          }

          let body: unknown = null;
          try {
            body = await res.json();
          } catch {
            body = null;
          }

          if (!res.ok) {
            const classified = classifyApiError(res, body);
            lastError = {
              code: classified.code,
              message: classified.message,
              retryable: classified.retryable,
              retryAfterSeconds: classified.retryAfterSeconds,
              correlationId:
                body && typeof body === 'object' && 'error' in body
                  ? ((body as { error?: { correlationId?: unknown } }).error?.correlationId as string | undefined)
                  : undefined,
            };
            if (!classified.retryable || attempt > CLIENT_MAX_RETRIES) {
              break;
            }
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
              ? (body as { data?: unknown })
              : null;

          const data = okBody?.data;
          const itemsRaw =
            data && typeof data === 'object' && 'items' in data
              ? ((data as { items: unknown }).items)
              : Array.isArray(data)
                ? data
                : [];

          const itemsArr = Array.isArray(itemsRaw) ? (itemsRaw as Array<Record<string, unknown>>) : [];

          const cards: MarketplaceCardProps[] = itemsArr.map((it) => ({
            id: typeof it.id === 'string' ? it.id : String(it.listingId ?? it.id ?? Math.random().toString(36).slice(2)),
            type: (it.type as MarketplaceCardProps['type']) ?? 'Safe',
            score: typeof it.complianceScore === 'number' ? it.complianceScore : (typeof it.score === 'number' ? it.score : 0),
            amount: typeof it.amount === 'string' ? it.amount : (typeof it.amount === 'number' ? `$${it.amount.toLocaleString()}` : '$0'),
            duration:
              typeof it.duration === 'string' ? it.duration :
                typeof it.remainingDays === 'number' ? `${it.remainingDays} days` : '--',
            yield:
              typeof it.yield === 'string' ? it.yield :
                typeof it.currentYield === 'number' ? `${it.currentYield}%` : '0%',
            maxLoss:
              typeof it.maxLoss === 'string' ? it.maxLoss :
                typeof it.maxLoss === 'number' ? `${it.maxLoss}%` : '0%',
            price:
              typeof it.price === 'string' ? it.price :
                typeof it.price === 'number' ? `$${it.price.toLocaleString()}` : '$0',
          }));

          const pageTotalRaw =
            data && typeof data === 'object' && 'total' in data
              ? (data as { total?: unknown }).total
              : undefined;
          const pageTotal: number | null =
            typeof pageTotalRaw === 'number' && Number.isFinite(pageTotalRaw) ? pageTotalRaw : null;

          if (abort.signal.aborted) break;
          if (myGeneration !== generationRef.current) break;
          if (myQueryHash !== stableQueryRef.current) break;
          if (pendingRef.current?.abortController !== abort) break;

          pendingRef.current = null;

          setRetryCount(attempt - 1);

          setListings((prev) => {
            const combined =
              mode === 'more' ? [...prev, ...cards] : hardReset || mode === 'refresh' ? cards : cards;
            const deduped = dedupeById(combined);
            if (deduped.length > 0) {
              persistedStaleItemsRef.current = deduped;
            }
            return deduped;
          });
          setRawListings((prev) => {
            const combined =
              mode === 'more' ? [...prev, ...itemsArr] : hardReset || mode === 'refresh' ? itemsArr : itemsArr;
            return combined.filter((x) => x && typeof x === 'object');
          });

          if (pageTotal !== null) {
            setTotal(pageTotal);
          }

          pageRef.current = targetPage;
          setPage(targetPage);

          const receivedFewer = cards.length < pageSize;
          if (receivedFewer) {
            setState('EXHAUSTED');
          } else {
            setState('SUCCESS');
          }
          setError(null);
          return;
        } catch (fetchErr: unknown) {
          if (abort.signal.aborted) break;
          const isNetwork =
            fetchErr instanceof DOMException && fetchErr.name === 'AbortError' ? false : true;
          const msg =
            fetchErr instanceof Error ? fetchErr.message : 'Unknown fetch error';
          lastError = {
            code: isNetwork ? 'NETWORK_ERROR' : 'ABORTED',
            message: msg,
            retryable: isNetwork && attempt <= CLIENT_MAX_RETRIES,
          };
          if (!isNetwork || attempt > CLIENT_MAX_RETRIES) break;
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
      setError(lastError);

      if (persistedStaleItemsRef.current.length > 0) {
        setState('ERROR_STALE');
      } else {
        setState('ERROR_EMPTY');
      }
    },
    [disabled, pageSize, queryParams],
  );

  useEffect(() => {
    if (disabled) return;
    if (state === 'IDLE' && listings.length === 0) {
      performFetch(1, 'initial').catch(() => {});
    }
  }, [disabled, state, listings.length, performFetch]);

  const loadMore = useCallback(async (): Promise<void> => {
    if (disabled) return;
    if (state === 'LOADING_MORE' || state === 'LOADING_INITIAL' || state === 'REFRESHING') return;
    if (state === 'EXHAUSTED') return;
    if (pendingRef.current) return;
    const nextPage = pageRef.current + 1;
    await performFetch(nextPage, 'more');
  }, [disabled, state, performFetch]);

  const refresh = useCallback(
    async (hardReset: boolean = true): Promise<void> => {
      if (disabled) return;
      if (pendingRef.current) {
        pendingRef.current.abortController.abort();
        pendingRef.current = null;
      }
      generationRef.current += 1;
      setGeneration(generationRef.current);
      pageRef.current = 1;
      setPage(1);
      setRetryCount(0);
      await performFetch(1, 'refresh', hardReset);
    },
    [disabled, performFetch],
  );

  const reset = useCallback((): void => {
    if (pendingRef.current) {
      pendingRef.current.abortController.abort();
      pendingRef.current = null;
    }
    generationRef.current += 1;
    setGeneration(generationRef.current);
    pageRef.current = 1;
    stableQueryRef.current = stableQueryHash(queryParams);
    setListings([]);
    setRawListings([]);
    setPage(1);
    setTotal(null);
    setError(null);
    setRetryCount(0);
    setState('IDLE');
    persistedStaleItemsRef.current = [];
  }, [queryParams]);

  const isLoadingInitial = state === 'LOADING_INITIAL';
  const isLoadingMore = state === 'LOADING_MORE';
  const isRefreshing = state === 'REFRESHING';
  const isLoading = isLoadingInitial || isLoadingMore || isRefreshing;

  const hasMore = state !== 'EXHAUSTED' && state !== 'ERROR_EMPTY' && state !== 'LOADING_INITIAL';

  return useMemo(
    () => ({
      listings,
      rawListings,
      isLoading,
      isLoadingInitial,
      isLoadingMore,
      isRefreshing,
      state,
      hasMore,
      page,
      pageSize,
      total,
      error,
      retryCount,
      generation,
      loadMore,
      refresh,
      reset,
    }),
    [
      listings,
      rawListings,
      isLoading,
      isLoadingInitial,
      isLoadingMore,
      isRefreshing,
      state,
      hasMore,
      page,
      pageSize,
      total,
      error,
      retryCount,
      generation,
      loadMore,
      refresh,
      reset,
    ],
  );
}
