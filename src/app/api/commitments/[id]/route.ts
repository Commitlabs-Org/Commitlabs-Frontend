import { NextRequest } from 'next/server';
import { ok } from '@/lib/backend/apiResponse';
import { NotFoundError } from '@/lib/backend/errors';
import { withApiHandler } from '@/lib/backend/withApiHandler';
import { contractAddresses } from '@/utils/soroban';

interface CommitmentRules {
    maxLossPercent?: number;
    [key: string]: unknown;
}

interface ChainCommitment {
    commitmentId: string;
    owner: string;
    rules: CommitmentRules;
    amount: string;
    asset: string;
    createdAt: string;
    expiresAt: string;
    currentValue: string;
    status: string;
    drawdownPercent?: number;
    tokenId?: string;
}

const MOCK_CHAIN_COMMITMENTS: Record<string, ChainCommitment> = {
    '1': {
        commitmentId: '1',
        owner: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        rules: {
            strategy: 'balanced',
            maxLossPercent: 8,
            earlyExitPenaltyPercent: 3,
        },
        amount: '100000',
        asset: 'USDC',
        createdAt: '2026-01-10T00:00:00.000Z',
        expiresAt: '2026-03-11T00:00:00.000Z',
        currentValue: '112500',
        status: 'Active',
        drawdownPercent: 3.2,
        tokenId: '123456789',
    },
    '2': {
        commitmentId: '2',
        owner: '0xA3d5D8e7b1eAa2f9B26D109fE3bD7cA6f0D9d987',
        rules: {
            strategy: 'safe',
            maxLossPercent: 2,
            earlyExitPenaltyPercent: 2,
        },
        amount: '50000',
        asset: 'XLM',
        createdAt: '2026-02-01T00:00:00.000Z',
        expiresAt: '2026-03-03T00:00:00.000Z',
        currentValue: '52600',
        status: 'Active',
        tokenId: '987654321',
    },
};

async function getCommitmentFromChain(commitmentId: string): Promise<ChainCommitment | null> {
    // TODO: Replace this with real contract reads from commitmentCore + commitmentNFT.
    return MOCK_CHAIN_COMMITMENTS[commitmentId] ?? null;
}

function getNftMetadataLink(tokenId?: string): string | undefined {
    if (!tokenId || !contractAddresses.commitmentNFT) {
        return undefined;
    }

    return `${contractAddresses.commitmentNFT}/metadata/${tokenId}`;
}

function getDaysRemaining(expiresAt: string): number {
    const expiresAtMs = new Date(expiresAt).getTime();
    const nowMs = Date.now();
    const msPerDay = 24 * 60 * 60 * 1000;

    return Math.max(0, Math.ceil((expiresAtMs - nowMs) / msPerDay));
}

export const GET = withApiHandler(async (
    _req: NextRequest,
    context: { params: { id: string } }
) => {
    const commitmentId = context.params.id;
    const commitment = await getCommitmentFromChain(commitmentId);

    if (!commitment) {
        throw new NotFoundError('Commitment', { commitmentId });
    }

    const response = {
        commitmentId: commitment.commitmentId,
        owner: commitment.owner,
        rules: commitment.rules,
        amount: commitment.amount,
        asset: commitment.asset,
        createdAt: commitment.createdAt,
        expiresAt: commitment.expiresAt,
        currentValue: commitment.currentValue,
        status: commitment.status,
        daysRemaining: getDaysRemaining(commitment.expiresAt),
        drawdownPercent: commitment.drawdownPercent,
        maxLossPercent:
            typeof commitment.rules.maxLossPercent === 'number'
                ? commitment.rules.maxLossPercent
                : null,
        tokenId: commitment.tokenId,
        nftMetadataLink: getNftMetadataLink(commitment.tokenId),
    };

    return ok(response);
});
