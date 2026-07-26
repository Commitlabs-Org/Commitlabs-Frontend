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

const DRAFT_SCHEMA_VERSION = 1;
const DRAFT_STORAGE_KEY = "commitlabs-create-draft";

const DraftSchema = z.object({
  version: z.literal(DRAFT_SCHEMA_VERSION),
  data: z.object({
    step: z.number(),
    selectedType: z.enum(["safe", "balanced", "aggressive"]).nullable(),
    commitmentType: z.enum(["safe", "balanced", "aggressive"]),
    amount: z.string(),
    asset: z.string(),
    durationDays: z.number(),
    maxLossPercent: z.number(),
  }),
});

export function useDraftPersistence() {
  const [draft, setDraft] = useState<DraftState | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadDraft();
  }, []);

  const loadDraft = useCallback(() => {
    try {
      const stored = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!stored) {
        setDraft(null);
        return;
      }

      const parsed = JSON.parse(stored);
      const result = DraftSchema.safeParse(parsed);
      if (!result.success) {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        setDraft(null);
        return;
      }

      setDraft(result.data.data);
    } catch {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
      setDraft(null);
    }
  }, []);

  const saveDraft = useCallback((data: DraftState) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      try {
        const toStore = {
          version: DRAFT_SCHEMA_VERSION,
          data,
        };
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(toStore));
      } catch {
        console.warn("Failed to save draft to localStorage");
      }
    }, 500);
  }, []);

  const clearDraft = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    setDraft(null);
  }, []);

  const resumeDraft = useCallback(() => {
    return draft;
  }, [draft]);

  return {
    draft,
    saveDraft,
    clearDraft,
    resumeDraft,
  };
}
