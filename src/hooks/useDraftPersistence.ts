import { useState, useEffect, useCallback, useRef } from 'react';
import { z } from 'zod';

type CommitmentType = 'safe' | 'balanced' | 'aggressive';

export interface DraftState {
  step: number;
  selectedType: CommitmentType | null;
  commitmentType: CommitmentType;
  amount: string;
  asset: string;
  durationDays: number;
  maxLossPercent: number;
  // Optional binding for wallet-scoped recovery & integrity (added, backward compatible)
  walletAddress?: string;
  networkPassphrase?: string | null;
  version?: number;
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

export const SUPPORTED_ASSETS = ['XLM', 'USDC'] as const;

const DraftStateSchema = z.object({
  step: z.number().int().min(1).max(3),
  selectedType: z.enum(['safe', 'balanced', 'aggressive']).nullable(),
  commitmentType: z.enum(['safe', 'balanced', 'aggressive']),
  amount: z.string().max(64),
  asset: z.string().min(1).max(16),
  durationDays: z.number().int().min(1).max(365),
  maxLossPercent: z.number().min(0).max(100),
  walletAddress: z.string().optional(),
  networkPassphrase: z.string().nullable().optional(),
  version: z.number().int().optional(),
});

const NamedDraftSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9_-]+$/),
  data: DraftStateSchema,
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
});

const DraftMapSchema = z.record(NamedDraftSchema);

const LegacyDraftSchema = z.object({
  version: z.literal(1),
  data: DraftStateSchema,
});

export function isValidDraftId(id: string): boolean {
  return /^[A-Za-z0-9_-]{1,64}$/.test(id);
}

export function isDraftExpired(updatedAt: number, ttlMs: number = DRAFT_TTL_MS): boolean {
  return Date.now() - updatedAt >= ttlMs;
}

export function pruneExpiredDrafts(drafts: DraftMap, ttlMs: number): DraftMap {
  const now = Date.now();
  return Object.fromEntries(Object.entries(drafts).filter(([, d]) => now - d.updatedAt < ttlMs));
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

export function validateDraftData(data: unknown): data is DraftState {
  return DraftStateSchema.safeParse(data).success;
}

export function loadDraftsFromStorage(): DraftMap {
  try {
    const stored = localStorage.getItem(DRAFT_MULTI_STORAGE_KEY);
    if (!stored) {
      const migrated = migrateLegacyDraft();
      if (migrated) {
        const pruned = pruneExpiredDrafts(migrated, DRAFT_TTL_MS);
        // Re-validate each migrated draft strictly
        const filtered: DraftMap = {};
        for (const [k, v] of Object.entries(pruned)) {
          if (NamedDraftSchema.safeParse(v).success) filtered[k] = v;
        }
        return filtered;
      }
      return {};
    }
    const parsed = JSON.parse(stored);
    // Guard against prototype pollution / non-object
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      localStorage.removeItem(DRAFT_MULTI_STORAGE_KEY);
      return {};
    }
    const result = DraftMapSchema.safeParse(parsed);
    if (!result.success) {
      localStorage.removeItem(DRAFT_MULTI_STORAGE_KEY);
      return {};
    }
    return pruneExpiredDrafts(result.data, DRAFT_TTL_MS);
  } catch {
    localStorage.removeItem(DRAFT_MULTI_STORAGE_KEY);
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
      try {
        localStorage.setItem(DRAFT_MULTI_STORAGE_KEY, JSON.stringify(loaded));
      } catch {
        // quota exceeded — keep in-memory only
      }
    }
  }, []);

  const draft = draftId ? (drafts[draftId]?.data ?? null) : null;

  const persist = useCallback((next: DraftMap) => {
    try {
      localStorage.setItem(DRAFT_MULTI_STORAGE_KEY, JSON.stringify(next));
    } catch {
      console.warn('Failed to save draft to localStorage');
    }
  }, []);

  const saveDraft = useCallback(
    (data: DraftState, id?: string) => {
      // Validate before scheduling write — discard tampered/invalid drafts
      if (!DraftStateSchema.safeParse(data).success) {
        console.warn('Refusing to save invalid draft', data);
        return;
      }
      const rawId = id ?? draftId ?? `draft-${Date.now()}`;
      const targetId = isValidDraftId(rawId) ? rawId : `draft-${Date.now()}`;
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        setDrafts((prev) => {
          const now = Date.now();
          const existing = prev[targetId];
          // Prune expired entries on write to bound growth
          const pruned = pruneExpiredDrafts(prev, DRAFT_TTL_MS);
          const updated: DraftMap = {
            ...pruned,
            [targetId]: {
              id: targetId,
              data,
              createdAt: existing?.createdAt ?? now,
              updatedAt: now,
            },
          };
          persist(updated);
          return updated;
        });
      }, 500);
    },
    [draftId, persist],
  );

  // Flush any pending debounced save synchronously (call before submit/navigation)
  const flushDraft = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
  }, []);

  const clearDraft = useCallback(
    (id?: string) => {
      const targetId = id ?? draftId;
      if (!targetId) return;
      if (!isValidDraftId(targetId)) return;
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      setDrafts((prev) => {
        if (!(targetId in prev)) return prev;
        const updated = { ...prev };
        delete updated[targetId];
        persist(updated);
        return updated;
      });
    },
    [draftId, persist],
  );

  const clearAllDrafts = useCallback(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    localStorage.removeItem(DRAFT_MULTI_STORAGE_KEY);
    setDrafts({});
  }, []);

  const resumeDraft = useCallback(
    (id?: string) => {
      const targetId = id ?? draftId;
      if (!targetId || !isValidDraftId(targetId)) return null;
      const found = drafts[targetId];
      if (!found) return null;
      if (isDraftExpired(found.updatedAt)) return null;
      if (!DraftStateSchema.safeParse(found.data).success) return null;
      return found.data;
    },
    [drafts, draftId],
  );

  const allDrafts = Object.values(drafts).sort((a, b) => b.updatedAt - a.updatedAt);

  return {
    draft,
    drafts,
    allDrafts,
    saveDraft,
    flushDraft,
    clearDraft,
    clearAllDrafts,
    resumeDraft,
  };
}
