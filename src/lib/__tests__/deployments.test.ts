import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const deployments = JSON.parse(
  readFileSync(resolve(process.cwd(), 'deployments/testnet.json'), 'utf8')
);
const contractDeployments = JSON.parse(
  readFileSync(resolve(process.cwd(), 'contracts/deployments.testnet.json'), 'utf8')
);
const envExample = readFileSync(resolve(process.cwd(), '.env.example'), 'utf8');
const readme = readFileSync(resolve(process.cwd(), 'README.md'), 'utf8');

const deployment = deployments.contracts['commitlabs-escrow'];
const contractId: string = deployment.id;

describe('Testnet deployment references', () => {
  it('uses a valid escrow contract ID in deployments/testnet.json', () => {
    expect(contractId, 'deployments/testnet.json escrow contract ID').toMatch(/^C[A-Z2-7]{55}$/);
  });

  it('keeps contracts/deployments.testnet.json equal to deployments/testnet.json', () => {
    expect(
      contractDeployments,
      'contracts/deployments.testnet.json must match deployments/testnet.json'
    ).toEqual(deployments);
  });

  it('keeps .env.example NEXT_PUBLIC_ESCROW_CONTRACT_ID in sync', () => {
    const envMatch = envExample.match(/^NEXT_PUBLIC_ESCROW_CONTRACT_ID=(.+)$/m);

    expect(envMatch?.[1], '.env.example NEXT_PUBLIC_ESCROW_CONTRACT_ID').toBe(contractId);
  });

  it('keeps the README deployed-contract row in sync', () => {
    const contractRow = readme
      .split('\n')
      .find((line) => /^\s*\|\s*commitlabs-escrow\s*\|/.test(line));

    expect(contractRow, 'README.md deployed-contract row').toContain(contractId);
  });

  it('has an explorer URL ending with the escrow contract ID', () => {
    expect(
      deployment.explorer.endsWith(contractId),
      'deployments/testnet.json explorer URL must end with the escrow contract ID'
    ).toBe(true);
  });
});
