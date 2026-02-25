import { ConflictError, ValidationError } from './errors';
import { BackendConfig } from './config';
import { ChainCommitmentModel } from './dto';
import { CreateCommitmentInput, EarlyExitInput } from './validation';

export interface CreateCommitmentOnChainResult {
    commitment: ChainCommitmentModel;
    commitmentId: string;
    nftTokenId: string;
    txHash?: string;
    reference?: string;
}

export interface EarlyExitOnChainResult {
    penaltyAmount: string;
    returnedAmount: string;
    txHash?: string;
    reference?: string;
}

function buildMockReference(action: string): string {
    return `TODO_CHAIN_CALL_${action.toUpperCase()}`;
}

export async function createCommitmentOnChain(
    config: BackendConfig,
    input: CreateCommitmentInput
): Promise<CreateCommitmentOnChainResult> {
    const commitmentId = `cm_${Date.now()}`;
    const nftTokenId = `nft_${Date.now()}`;

    const commitment: ChainCommitmentModel = {
        id: commitmentId,
        ownerAddress: input.ownerAddress,
        amount: input.amount,
        assetCode: input.assetCode,
        assetIssuer: input.assetIssuer,
        durationDays: input.durationDays,
        maxLossPercent: input.maxLossPercent,
        commitmentType: input.commitmentType,
        status: 'active',
        nftTokenId,
    };

    if (!config.chainWritesEnabled) {
        return {
            commitment,
            commitmentId,
            nftTokenId,
            reference: buildMockReference('create_commitment'),
        };
    }

    if (!config.commitmentCoreContract || !config.commitmentNftContract) {
        throw new ValidationError(
            'Missing COMMITMENT_CORE_CONTRACT or COMMITMENT_NFT_CONTRACT for on-chain create.'
        );
    }

    // TODO: Replace with real Soroban transaction submission once backend signing flow is available.
    return {
        commitment,
        commitmentId,
        nftTokenId,
        reference: buildMockReference('create_commitment'),
    };
}

export async function earlyExitCommitmentOnChain(
    config: BackendConfig,
    commitmentId: string,
    input: EarlyExitInput
): Promise<EarlyExitOnChainResult> {
    if (!commitmentId.trim()) {
        throw new ValidationError('Commitment id is required.');
    }
    if (input.currentStatus !== undefined && input.currentStatus !== 'active') {
        throw new ConflictError('Commitment cannot be early-exited from its current state.');
    }

    if (!config.chainWritesEnabled) {
        return {
            penaltyAmount: '0',
            returnedAmount: '0',
            reference: buildMockReference('early_exit'),
        };
    }

    if (!config.commitmentCoreContract) {
        throw new ValidationError('Missing COMMITMENT_CORE_CONTRACT for on-chain early exit.');
    }

    // TODO: Replace with real Soroban transaction submission once backend signing flow is available.
    return {
        penaltyAmount: '0',
        returnedAmount: '0',
        reference: buildMockReference('early_exit'),
    };
}
