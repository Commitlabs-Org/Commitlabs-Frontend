import fs from "fs/promises";
import path from "path";
import type {
  Commitment,
  Attestation,
  MarketplaceListing,
} from "@/lib/types/domain";

const mockDbPath = path.join(process.cwd(), ".mock-db.json");

export interface MockData {
  commitments: Commitment[];
  attestations: Attestation[];
  listings: MarketplaceListing[];
}

export async function getMockData(): Promise<MockData> {
  try {
    const data = await fs.readFile(mockDbPath, "utf8");
    return JSON.parse(data) as MockData;
  } catch {
    return {
      commitments: [],
      attestations: [],
      listings: [],
    };
  }
}

export async function setMockData(data: MockData): Promise<void> {
  await fs.writeFile(mockDbPath, JSON.stringify(data, null, 2), "utf8");
}
