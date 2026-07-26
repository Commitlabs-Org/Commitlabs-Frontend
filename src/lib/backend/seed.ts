/**
 * Seed module for mock database.
 *
 * Exports a callable `seedMockData` function so the seed route and CLI script
 * can share the same logic without spawning a child process.
 *
 * Guard rules (enforced at call-time):
 *  1. NODE_ENV must be "development" or "test".
 *  2. SEED_ROUTE_ENABLED must be "true".
 *
 * An optional SEED_SECRET env var can be set; when present, callers must
 * supply the matching value via the `x-seed-secret` request header.
 */

import { setMockData } from "./mockDb";
import type { MockData } from "./mockDb";

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

const SAMPLE_DATA: MockData = {
  commitments: [
    {
      id: "CMT-ABC123",
      type: "Safe",
      status: "Active",
      asset: "XLM",
      amount: "50,000",
      currentValue: "52,600",
      changePercent: 5.2,
      durationProgress: 75,
      daysRemaining: 15,
      complianceScore: 95,
      maxLoss: "2%",
      currentDrawdown: "0.8%",
      createdDate: "Jan 10, 2026",
      expiryDate: "Feb 9, 2026",
    },
    {
      id: "CMT-XYZ789",
      type: "Balanced",
      status: "Active",
      asset: "USDC",
      amount: "100,000",
      currentValue: "112,500",
      changePercent: 12.5,
      durationProgress: 30,
      daysRemaining: 42,
      complianceScore: 88,
      maxLoss: "8%",
      currentDrawdown: "3.2%",
      createdDate: "Dec 15, 2025",
      expiryDate: "Feb 13, 2026",
    },
  ],
  attestations: [
    {
      id: "ATTR-001",
      commitmentId: "CMT-ABC123",
      provider: "Provider A",
      status: "Valid",
      timestamp: "2026-01-11T12:00:00Z",
    },
  ],
  listings: [
    {
      id: "001",
      type: "Safe",
      score: 95,
      amount: "$50,000",
      duration: "25 days",
      yield: "5.2%",
      maxLoss: "2%",
      owner: "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX1",
      price: "$52,000",
      forSale: true,
    },
    {
      id: "002",
      type: "Balanced",
      score: 88,
      amount: "$100,000",
      duration: "45 days",
      yield: "12.5%",
      maxLoss: "8%",
      owner: "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX2",
      price: "$105,000",
      forSale: true,
    },
  ],
};

// ---------------------------------------------------------------------------
// Guard helpers (exported for testing)
// ---------------------------------------------------------------------------

/** Returns true only when the runtime environment permits seeding. */
export function isSeedAllowed(): boolean {
  const env = process.env.NODE_ENV;
  if (env !== "development" && env !== "test") return false;
  return process.env.SEED_ROUTE_ENABLED === "true";
}

/**
 * Validates an optional shared secret.
 * Returns true when no secret is configured (open) or when the supplied
 * value matches SEED_SECRET exactly.
 */
export function isSeedSecretValid(suppliedSecret: string | null): boolean {
  const expected = process.env.SEED_SECRET;
  if (!expected) return true; // no secret configured → always valid
  return suppliedSecret === expected;
}

// ---------------------------------------------------------------------------
// Core seed function
// ---------------------------------------------------------------------------

export interface SeedResult {
  seeded: boolean;
  message: string;
}

/**
 * Seeds the mock database with sample data.
 *
 * @param suppliedSecret - Value from the `x-seed-secret` header (or null).
 * @returns SeedResult describing the outcome.
 * @throws Never – errors are captured and returned as a failed SeedResult.
 */
export async function seedMockData(
  suppliedSecret: string | null = null
): Promise<SeedResult> {
  if (!isSeedAllowed()) {
    return {
      seeded: false,
      message: "Seed is disabled. Set SEED_ROUTE_ENABLED=true in development.",
    };
  }

  if (!isSeedSecretValid(suppliedSecret)) {
    return { seeded: false, message: "Invalid seed secret." };
  }

  try {
    await setMockData(SAMPLE_DATA);
    return { seeded: true, message: "Mock data seeded successfully." };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { seeded: false, message: `Failed to seed mock data: ${msg}` };
  }
}
