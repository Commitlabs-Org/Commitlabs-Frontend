/**
 * CLI entry-point for seeding mock data.
 * Delegates to the shared seedMockData module so there is a single source of truth.
 *
 * Usage:
 *   SEED_ROUTE_ENABLED=true NODE_ENV=development npx tsx scripts/seed-backend-mock.ts
 */

// Ensure guards pass when running from the CLI
process.env.NODE_ENV = process.env.NODE_ENV ?? "development";
process.env.SEED_ROUTE_ENABLED = process.env.SEED_ROUTE_ENABLED ?? "true";

import { seedMockData } from "../src/lib/backend/seed";

const result = await seedMockData(process.env.SEED_SECRET ?? null);
if (result.seeded) {
  console.log(result.message);
} else {
  console.error(result.message);
  process.exit(1);
}
