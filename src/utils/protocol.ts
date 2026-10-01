import { z } from 'zod';

import { ProtocolConstantsSchema } from '../lib/schemas/apiContracts';

export interface ProtocolConstants {
  commitmentLimits: {
    minCommitmentAmount: bigint;
    maxCommitmentAmount: bigint;
    earlyExitGracePeriodDays: number;
  };
  fees: {
    protocolFeeBasisPoints: number;
    earlyExitFeeBasisPoints: number;
  };
  supportedAssets: string[];
  version: string;
}

export const ProtocolConstantsSchema = z.object({
  commitmentLimits: z.object({
    minCommitmentAmount: z.coerce.bigint(),
    maxCommitmentAmount: z.coerce.bigint(),
    earlyExitGracePeriodDays: z.number(),
  }),
  fees: z.object({
    protocolFeeBasisPoints: z.number(),
    earlyExitFeeBasisPoints: z.number(),
  }),
  supportedAssets: z.array(z.string()),
  version: z.string(),
});

export type ProtocolConstants = z.infer < typeof ProtocolConstantsSchema >;

export async function fetchProtocolConstants(
  baseUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ProtocolConstants> {
  const response = await fetchImpl(`${baseUrl}/api/protocol/constants`);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch protocol constants: ${response.status} ${response.statusText}`,
    );
  }
  const json = await response.json();
  const result = ProtocolConstantsSchema.safeParse(json);
  if (!result.success) {
    throw new Error(
      `Invalid protocol constants response: ${result.error.message}`,
    );
  }
  return result.data;
}
