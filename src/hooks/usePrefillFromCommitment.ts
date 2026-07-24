import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type CommitmentType = "safe" | "balanced" | "aggressive";

export interface PrefillData {
  commitmentType: CommitmentType;
  amount: string;
  asset: string;
  durationDays: number;
  maxLossPercent: number;
}

const VALID_TYPES = new Set<CommitmentType>(["safe", "balanced", "aggressive"]);

function isCommitmentType(value: unknown): value is CommitmentType {
  return typeof value === "string" && VALID_TYPES.has(value as CommitmentType);
}

/**
 * Reads an optional `sourceId` query parameter and fetches the referenced
 * commitment's configurable parameters so the create wizard can be prefilled.
 * Identity-bound fields (id, ownership, on-chain state) are intentionally
 * excluded — only user-configurable parameters are returned.
 *
 * Returns `null` while loading or when no sourceId is present.
 * Silently falls back to `null` if the source commitment cannot be found.
 */
export function usePrefillFromCommitment(): PrefillData | null {
  const searchParams = useSearchParams();
  const sourceId = searchParams?.get("sourceId") ?? null;
  const [prefill, setPrefill] = useState<PrefillData | null>(null);

  useEffect(() => {
    if (!sourceId) {
      setPrefill(null);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/commitments/${encodeURIComponent(sourceId!)}`);
        if (!res.ok) {
          setPrefill(null);
          return;
        }
        const json = await res.json();
        const data = json?.data ?? json;

        const commitmentType: CommitmentType = isCommitmentType(data?.commitmentType)
          ? data.commitmentType
          : "balanced";

        const prefillData: PrefillData = {
          commitmentType,
          amount: String(data?.amount ?? ""),
          asset: typeof data?.asset === "string" ? data.asset : "XLM",
          durationDays:
            typeof data?.durationDays === "number" && data.durationDays >= 1
              ? Math.min(365, data.durationDays)
              : 90,
          maxLossPercent:
            typeof data?.maxLossPercent === "number"
              ? Math.min(100, Math.max(0, data.maxLossPercent))
              : 100,
        };

        if (!cancelled) {
          setPrefill(prefillData);
        }
      } catch {
        if (!cancelled) {
          setPrefill(null);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [sourceId]);

  return prefill;
}
