import { useState, useEffect, useCallback, useRef } from "react";
import { z } from "zod";

type CommitmentType = "safe" | "balanced" | "aggressive";

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

const DRAFT_STORAGE_KEY = "commitlabs-create-draft";
const DRAFT_MULTI_STORAGE_KEY = "commitlabs-create-drafts";
export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const DraftStateSchema = z.object({
  step: z.number(),
  selectedType: z.enum(["safe", "balanced", "aggressive"]).nullable(),
  commitmentType: z.enum(["safe", "balanced", "aggressive"]),
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
  return Object.fromEntries(
    Object.entries(drafts).filter(([, d]) => now - d.updatedAt < ttlMs)
  );
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
  try {
    const stored = localStorage.getItem(DRAFT_MULTI_STORAGE_KEY);
    if (!stored) {
      const migrated = migrateLegacyDraft();
      if (migrated) return migrated;
      return {};
    }
    const parsed = JSON.parse(stored);
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
      localStorage.setItem(DRAFT_MULTI_STORAGE_KEY, JSON.stringify(loaded));
    }
  }, []);

  const draft = draftId ? (drafts[draftId]?.data ?? null) : null;

  const saveDraft = useCallback(
    (data: DraftState, id?: string) => {
      const targetId = id ?? draftId ?? `draft-${Date.now()}`;
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        setDrafts((prev) => {
          const now = Date.now();
          const existing = prev[targetId];
          const updated: DraftMap = {
            ...prev,
            [targetId]: {
              id: targetId,
              data,
              createdAt: existing?.createdAt ?? now,
              updatedAt: now,
            },
          };
          try {
            localStorage.setItem(DRAFT_MULTI_STORAGE_KEY, JSON.stringify(updated));
          } catch {
            console.warn("Failed to save draft to localStorage");
          }
          return updated;
        });
      }, 500);
    },
    [draftId]
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
          console.warn("Failed to update localStorage after clearing draft");
        }
        return updated;
      });
    },
    [draftId]
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
    [drafts, draftId]
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
