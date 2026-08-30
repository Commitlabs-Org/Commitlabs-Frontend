/**
 * Shared mock database for dev/test data.
 *
 * This module provides the contract expected by routes and services that
 * intentionally read/write a lightweight JSON backing store during local
 * development and tests. The implementation is intentionally simple: it keeps
 * all records in the workspace root as `.mock-db.json` and normalizes empty
 * data to a consistent shape.
 */

import fs from 'fs/promises';
import path from 'path';

export interface MockCommitment {
  id?: string | number;
  type?: string;
  status?: string;
  asset?: string;
  amount?: string | number;
  currentValue?: string | number;
  changePercent?: number;
  durationProgress?: number;
  daysRemaining?: number;
  complianceScore?: number;
  maxLoss?: string;
  currentDrawdown?: string;
  createdDate?: string;
  expiryDate?: string;
  [key: string]: unknown;
}

export interface MockAttestation {
  id: string;
  commitmentId: string;
  kind?: string;
  status?: string;
  verdict?: string;
  observedAt: string;
  timestamp?: string;
  severity?: string;
  txHash?: string;
  details?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface MockListing {
  id: string;
  commitmentId: string;
  price?: string;
  currencyAsset?: string;
  sellerAddress?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface MockData {
  commitments: MockCommitment[];
  attestations: MockAttestation[];
  listings: MockListing[];
}

const mockDbPath = path.join(process.cwd(), '.mock-db.json');

const EMPTY_MOCK_DATA: MockData = {
  commitments: [],
  attestations: [],
  listings: [],
};

let writeQueue: Promise<void> = Promise.resolve();

function normalizeMockData(data: Partial<MockData> | null | undefined): MockData {
  const source = data ?? {};
  return {
    commitments: Array.isArray(source.commitments) ? source.commitments : [],
    attestations: Array.isArray(source.attestations) ? source.attestations : [],
    listings: Array.isArray(source.listings) ? source.listings : [],
  };
}

async function readRawDb(): Promise<MockData> {
  try {
    const raw = await fs.readFile(mockDbPath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<MockData>;
    return normalizeMockData(parsed);
  } catch {
    return { ...EMPTY_MOCK_DATA };
  }
}

async function writeRawDb(data: MockData): Promise<void> {
  await fs.writeFile(mockDbPath, JSON.stringify(data, null, 2), 'utf8');
}

export async function getMockData(): Promise<MockData> {
  return readRawDb();
}

export async function setMockData(data: Partial<MockData>): Promise<void> {
  const normalized = normalizeMockData(data);
  writeQueue = writeQueue.then(async () => {
    await writeRawDb(normalized);
  });
  await writeQueue;
}

export async function resetMockData(): Promise<void> {
  await setMockData(EMPTY_MOCK_DATA);
}
