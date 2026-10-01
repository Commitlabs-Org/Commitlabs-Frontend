import { useState, useEffect, useRef, useCallback } from 'react';

const PAGE_SIZE = 20;

export function useCommitmentEvents(id) {
  const [events, setEvents] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState('idle'); // 'idle' | 'loading' | 'success' | 'error'
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);

  const load = useCallback(async (requestedPage) => {
    if (!id) return;

    // Abort any in-flight request to avoid race conditions
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setStatus('loading');
    setError(null);

    try {
      const response = await fetch(
        `/api/commitments/${id}/events?page=${requestedPage}&limit=${PAGE_SIZE}`,
        { signal: controller.signal }
      );

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }

      const data = await response.json();

      // Normalize and deduplicate events, preserving chronological order
      const newEvents = Array.isArray(data.data) ? data.data : [];
      setEvents((prevEvents) => {
        const combined = requestedPage === 1 ? newEvents : [...prevEvents, ...newEvents];
        const deduped = Array.from(new Map(combined.map((event) => [event.id, event])).values());
        // Sort by createdAt descending (newest first) — tie-break by id for full determinism
        return deduped.sort((a, b) => {
          const timeDiff = new Date(b.createdAt) - new Date(a.createdAt);
          if (timeDiff !== 0) return timeDiff;
          return String(b.id).localeCompare(String(a.id));
        });
      });

      setPage(requestedPage);
      setHasMore(requestedPage < (data.pagination?.totalPages ?? 1));
      setStatus('success');
    } catch (err) {
      // AbortError is expected when a newer request supersedes this one
      if (err.name !== 'AbortError') {
        setError(err);
        setStatus('error');
      }
    } finally {
      // Only clear the ref if this controller is still the current one
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }, [id]);

  // Initial load whenever id changes
  useEffect(() => {
    if (id) {
      load(1);
    } else {
      // Reset state when id becomes undefined
      setEvents([]);
      setPage(1);
      setHasMore(false);
      setStatus('idle');
      setError(null);
    }
  }, [id, load]);

  const fetchNextPage = useCallback(() => {
    if (hasMore && status !== 'loading') {
      load(page + 1);
    }
  }, [hasMore, status, load, page]);

  const retry = useCallback(() => {
    if (id) {
      load(page);
    }
  }, [id, load, page]);

  const refresh = useCallback(() => {
    if (id) {
      load(1);
    }
  }, [id, load]);

  return {
    events,
    status,
    error,
    hasMore,
    page,
    fetchNextPage,
    retry,
    refresh,
    // Convenience flags for consumers
    isLoading: status === 'loading',
    isError: status === 'error',
    isEmpty: status === 'success' && events.length === 0,
  };
}