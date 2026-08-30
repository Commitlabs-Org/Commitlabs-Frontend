import { useState, useEffect, useCallback, useRef } from 'react';
import { z } from 'zod';
import { trackApiCall, startLatencyTimer } from '@/lib/telemetry';

type CommitmentType = 'safe' | 'balanced' | 'aggressive';

export interface DraftState {
  step: number;
  selectedType: CommitmentType | null;
  commitmentType: CommitmentType;
  amount: string;
  asset: string;
  durationDays: number;
  maxLossPercent: number;
}

export interface NamedDraft {
  id: string;
  data: DraftState;
  createdAt: number;
  updatedAt: number;
}

export type DraftMap = Record<string, NamedDraft>;

const DRAFT_STORAGE_KEY = 'commitlabs-create-draft';
const DRAFT_MULTI_STORAGE_KEY = 'commitlabs-create-drafts';
export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
/** Hard cap on concurrent saved drafts. Oldest-by-updatedAt are evicted when exceeded. */
export const MAX_DRAFTS = 5;

const DraftStateSchema = z.object({
  step: z.number(),
  selectedType: z.enum(['safe', 'balanced', 'aggressive']).nullable(),
  commitmentType: z.enum(['safe', 'balanced', 'aggressive']),
  amount: z.string(),
  asset: z.string(),
  durationDays: z.number(),
  maxLossPercent: z.number(),
});

const NamedDraftSchema = z.object({
  id: z.string(),
  data: DraftStateSchema,
  createdAt: z.number(),
  updatedAt: z.number(),
});

const DraftMapSchema = z.record(NamedDraftSchema);

const LegacyDraftSchema = z.object({
  version: z.literal(1),
  data: DraftStateSchema,
});

export function pruneExpiredDrafts(drafts: DraftMap, ttlMs: number): DraftMap {
  const now = Date.now();
  return Object.fromEntries(Object.entries(drafts).filter(([, d]) => now - d.updatedAt < ttlMs));
}

/**
 * Enforce the MAX_DRAFTS cap by evicting the oldest drafts (by updatedAt) when
 * the map exceeds the limit. The draft being saved (targetId) is always kept.
 */
export function enforceDraftCap(drafts: DraftMap, targetId: string, cap: number = MAX_DRAFTS): DraftMap {
  const entries = Object.entries(drafts);
  if (entries.length <= cap) return drafts;
  // Sort ascending by updatedAt; oldest first. Always retain targetId.
  const sorted = entries.sort(([, a], [, b]) => a.updatedAt - b.updatedAt);
  const evicted = sorted.slice(0, entries.length - cap).filter(([id]) => id !== targetId);
  if (evicted.length === 0) return drafts;
  const result = { ...drafts };
  for (const [id] of evicted) {
    delete result[id];
  }
  return result;
}
export function migrateLegacyDraft(): DraftMap | null {
  try {
    const stored = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    const result = LegacyDraftSchema.safeParse(parsed);
    if (!result.success) {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      return null;
    }
    const now = Date.now();
    const id = `migrated-${now}`;
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    return { [id]: { id, data: result.data.data, createdAt: now, updatedAt: now } };
  } catch {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    return null;
  }
}

export function loadDraftsFromStorage(): DraftMap {
  const stop = startLatencyTimer();
  try {
    const stored = localStorage.getItem(DRAFT_MULTI_STORAGE_KEY);
    if (!stored) {
      const migrated = migrateLegacyDraft();
      if (migrated) {
        trackApiCall({ path: 'draft/load', method: 'READ', latencyMs: stop(), ok: true, code: 'MIGRATED' });
        return migrated;
      }
      trackApiCall({ path: 'draft/load', method: 'READ', latencyMs: stop(), ok: true, code: 'EMPTY' });
      return {};
    }
    const parsed = JSON.parse(stored);
    const result = DraftMapSchema.safeParse(parsed);
    if (!result.success) {
      localStorage.removeItem(DRAFT_MULTI_STORAGE_KEY);
      trackApiCall({ path: 'draft/load', method: 'READ', latencyMs: stop(), ok: false, code: 'INVALID_SCHEMA' });
      return {};
    }
    const pruned = pruneExpiredDrafts(result.data, DRAFT_TTL_MS);
    trackApiCall({ path: 'draft/load', method: 'READ', latencyMs: stop(), ok: true });
    return pruned;
  } catch {
    localStorage.removeItem(DRAFT_MULTI_STORAGE_KEY);
    trackApiCall({ path: 'draft/load', method: 'READ', latencyMs: stop(), ok: false, code: 'PARSE_ERROR' });
    return {};
  }
}

export function useDraftPersistence(draftId?: string) {
  const [drafts, setDrafts] = useState<DraftMap>({});
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const loaded = loadDraftsFromStorage();
    setDrafts(loaded);
    if (Object.keys(loaded).length > 0) {
      localStorage.setItem(DRAFT_MULTI_STORAGE_KEY, JSON.stringify(loaded));
    }
  }, []);

  const draft = draftId ? (drafts[draftId]?.data ?? null) : null;

  const saveDraft = useCallback(
    (data: DraftState, id?: string) => {
      const targetId = id ?? draftId ?? `draft-${Date.now()}`;
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        const stop = startLatencyTimer();
        setDrafts((prev) => {
          const now = Date.now();
          const existing = prev[targetId];
          const withNew: DraftMap = {
            ...prev,
            [targetId]: {
              id: targetId,
              data,
              createdAt: existing?.createdAt ?? now,
              updatedAt: now,
            },
          };
          const updated = enforceDraftCap(withNew, targetId);
          try {
            localStorage.setItem(DRAFT_MULTI_STORAGE_KEY, JSON.stringify(updated));
            trackApiCall({ path: 'draft/save', method: 'WRITE', latencyMs: stop(), ok: true });
          } catch {
            trackApiCall({ path: 'draft/save', method: 'WRITE', latencyMs: stop(), ok: false, code: 'STORAGE_FULL' });
            console.warn('Failed to save draft to localStorage');
          }
          return updated;
        });
      }, 500);
    },
    [draftId],
  );

  const clearDraft = useCallback(
    (id?: string) => {
      const targetId = id ?? draftId;
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      setDrafts((prev) => {
        if (!targetId) return prev;
        const updated = { ...prev };
        delete updated[targetId];
        try {
          localStorage.setItem(DRAFT_MULTI_STORAGE_KEY, JSON.stringify(updated));
        } catch {
          console.warn('Failed to update localStorage after clearing draft');
        }
        return updated;
      });
    },
    [draftId],
  );

  const clearAllDrafts = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    localStorage.removeItem(DRAFT_MULTI_STORAGE_KEY);
    setDrafts({});
  }, []);

  const resumeDraft = useCallback(
    (id?: string) => {
      const targetId = id ?? draftId;
      if (!targetId) return null;
      return drafts[targetId]?.data ?? null;
    },
    [drafts, draftId],
  );

  const allDrafts = Object.values(drafts).sort((a, b) => b.updatedAt - a.updatedAt);

  return {
    draft,
    drafts,
    allDrafts,
    saveDraft,
    clearDraft,
    clearAllDrafts,
    resumeDraft,
  };
}
