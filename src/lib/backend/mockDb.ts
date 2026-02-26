import fs from 'fs/promises';
import path from 'path';

const mockDbPath = path.join(process.cwd(), '.mock-db.json');

export interface MockData {
    commitments: unknown[];
    attestations: unknown[];
    listings: unknown[];
}

export async function getMockData(): Promise<MockData> {
    try {
        const data = await fs.readFile(mockDbPath, 'utf8');
        return JSON.parse(data);
    } catch {
        // Return empty state if file doesn't exist
        return {
            commitments: [],
            attestations: [],
            listings: [],
        };
    }
}

export async function setMockData(data: MockData): Promise<void> {
    await fs.writeFile(mockDbPath, JSON.stringify(data, null, 2), 'utf8');
}
