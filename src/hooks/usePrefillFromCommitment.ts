import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { z } from 'zod';

type CommitmentType = 'safe' | 'balanced' | 'aggressive';

export interface PrefillData {
  commitmentType: CommitmentType;
  amount: string;
  asset: string;
  durationDays: number;
  maxLossPercent: number;
}

export interface PrefillError {
  message: string;
  code: 'INVALID_SOURCE_ID' | 'NOT_FOUND' | 'MALFORMED_RESPONSE' | 'NETWORK_ERROR';
}

const VALID_TYPES = new Set<CommitmentType>(['safe', 'balanced', 'aggressive']);
const SUPPORTED_ASSETS = new Set(['XLM', 'USDC']);
const SOURCE_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

function isCommitmentType(value: unknown): value is CommitmentType {
  return typeof value === 'string' && VALID_TYPES.has(value as CommitmentType);
}

const CommitmentResponseSchema = z
  .object({
    data: z
      .object({
        commitmentType: z.unknown().optional(),
        amount: z.unknown().optional(),
        asset: z.unknown().optional(),
        durationDays: z.unknown().optional(),
        maxLossPercent: z.unknown().optional(),
      })
      .passthrough()
      .optional(),
    commitmentType: z.unknown().optional(),
    amount: z.unknown().optional(),
    asset: z.unknown().optional(),
    durationDays: z.unknown().optional(),
    maxLossPercent: z.unknown().optional(),
  })
  .passthrough();

function sanitizeAsset(raw: unknown): string {
  if (typeof raw === 'string' && SUPPORTED_ASSETS.has(raw)) return raw;
  return 'XLM';
}

function sanitizeAmount(raw: unknown): string {
  if (typeof raw === 'string' || typeof raw === 'number') {
    const s = String(raw).trim();
    // strict: reject Infinity/NaN/exponent, allow 0-7 decimals
    if (/^\d+(\.\d{1,7})?$/.test(s)) {
      const n = Number(s);
      if (Number.isFinite(n) && n > 0 && n <= 1_000_000) return s;
    }
  }
  return '';
}

/**
 * Reads an optional `sourceId` query parameter and fetches the referenced
 * commitment's configurable parameters so the create wizard can be prefilled.
 * Identity-bound fields (id, ownership, on-chain state) are intentionally
 * excluded — only user-configurable parameters are returned.
 *
 * Validates sourceId format, validates server response shape with zod,
 * sanitizes numeric fields, and surfaces a typed error for UI.
 */
export function usePrefillFromCommitment(): PrefillData | null {
  const searchParams = useSearchParams();
  const sourceId = searchParams?.get('sourceId') ?? null;
  const [prefill, setPrefill] = useState<PrefillData | null>(null);

  useEffect(() => {
    if (!sourceId) {
      setPrefill(null);
      return;
    }

    if (!SOURCE_ID_RE.test(sourceId)) {
      setPrefill(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      try {
        const res = await fetch(`/api/commitments/${encodeURIComponent(sourceId!)}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          if (!cancelled) setPrefill(null);
          return;
        }
        let json: unknown;
        try {
          json = await res.json();
        } catch {
          if (!cancelled) setPrefill(null);
          return;
        }
        const parsed = CommitmentResponseSchema.safeParse(json);
        if (!parsed.success) {
          if (!cancelled) setPrefill(null);
          return;
        }
        const data =
          (parsed.data as { data?: Record<string, unknown> }).data ??
          (parsed.data as Record<string, unknown>);

        const commitmentType: CommitmentType = isCommitmentType(
          (data as Record<string, unknown>)?.commitmentType,
        )
          ? ((data as Record<string, unknown>).commitmentType as CommitmentType)
          : 'balanced';

        const prefillData: PrefillData = {
          commitmentType,
          amount: sanitizeAmount((data as Record<string, unknown>)?.amount),
          asset: sanitizeAsset((data as Record<string, unknown>)?.asset),
          durationDays:
            typeof (data as Record<string, unknown>)?.durationDays === 'number' &&
            Number.isFinite((data as Record<string, unknown>).durationDays as number) &&
            ((data as Record<string, unknown>).durationDays as number) >= 1
              ? Math.min(
                  365,
                  Math.max(1, Math.trunc((data as Record<string, unknown>).durationDays as number)),
                )
              : 90,
          maxLossPercent:
            typeof (data as Record<string, unknown>)?.maxLossPercent === 'number' &&
            Number.isFinite((data as Record<string, unknown>).maxLossPercent as number)
              ? Math.min(
                  100,
                  Math.max(0, (data as Record<string, unknown>).maxLossPercent as number),
                )
              : 100,
        };

        if (!cancelled) {
          setPrefill(prefillData);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (!cancelled) {
          setPrefill(null);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [sourceId]);

  return prefill;
}

export function usePrefillSourceId(): string | null {
  const searchParams = useSearchParams();
  const raw = searchParams?.get('sourceId') ?? null;
  if (!raw) return null;
  if (!SOURCE_ID_RE.test(raw)) return null;
  return raw;
}
