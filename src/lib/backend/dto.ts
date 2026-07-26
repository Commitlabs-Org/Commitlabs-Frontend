import { CommitmentStatus, CommitmentType } from '../types/shared';

/**
 * Legacy DTO types - maintained for backward compatibility.
 * New code should use the shared enums from '../types/shared'.
 * @deprecated Use CommitmentStatus enum from '../types/shared' instead.
 */
export type CommitmentStatusDto = CommitmentStatus;

/**
 * Legacy DTO types - maintained for backward compatibility.
 * New code should use the shared enums from '../types/shared'.
 * @deprecated Use CommitmentType enum from '../types/shared' instead.
 */
export type CommitmentTypeDto = CommitmentType;

export type AttestationVerdictDto = 'pass' | 'fail' | 'unknown';

export interface ChainCommitmentModel {
    id: string | number;
    ownerAddress: string;
    amount: string | number;
    assetCode?: string | null;
    assetIssuer?: string | null;
    durationDays: number | string;
    maxLossPercent: number | string;
    commitmentType: string;
    status?: string;
    nftTokenId?: string | number | null;
}

export interface CommitmentDto {
    commitmentId: string;
    ownerAddress: string;
    amount: string;
    assetCode: string;
    assetIssuer: string | null;
    durationDays: number;
    maxLossPercent: number;
    commitmentType: CommitmentTypeDto;
    status: CommitmentStatusDto;
    nftTokenId: string | null;
}

export interface ChainAttestationModel {
    id: string | number;
    commitmentId: string | number;
    ownerAddress: string;
    kind: string;
    verdict?: string;
    observedAt?: string | number | Date;
    details?: unknown;
}

export interface AttestationDto {
    attestationId: string;
    commitmentId: string;
    ownerAddress: string;
    kind: string;
    verdict: AttestationVerdictDto;
    observedAt: string;
    details?: unknown;
}

function toCommitmentType(value: string): CommitmentType {
    const normalized = value.trim().toLowerCase();
    if (normalized === CommitmentType.SAFE || normalized === CommitmentType.BALANCED || normalized === CommitmentType.AGGRESSIVE) {
        return normalized as CommitmentType;
    }
    return CommitmentType.BALANCED;
}

function toCommitmentStatus(value?: string): CommitmentStatus {
    const normalized = value?.trim().toLowerCase();
    if (normalized === CommitmentStatus.ACTIVE || normalized === CommitmentStatus.SETTLED || normalized === CommitmentStatus.VIOLATED) {
        return normalized as CommitmentStatus;
    }
    // Handle legacy formats for early_exit (space, dash, underscore)
    if (normalized === 'early exit' || normalized === 'early_exit' || normalized === 'early-exit') {
        return CommitmentStatus.EARLY_EXIT;
    }
    return CommitmentStatus.ACTIVE;
}

function toAttestationVerdict(value?: string): AttestationVerdictDto {
    const normalized = value?.trim().toLowerCase();
    if (normalized === 'pass' || normalized === 'fail') {
        return normalized;
    }
    return 'unknown';
}

function toIsoDate(value?: string | number | Date): string {
    if (value === undefined) {
        return new Date().toISOString();
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return new Date().toISOString();
    }
    return date.toISOString();
}

export function mapCommitmentFromChain(model: ChainCommitmentModel): CommitmentDto {
    const assetCode = model.assetCode ?? 'XLM';
    return {
        commitmentId: String(model.id),
        ownerAddress: model.ownerAddress,
        amount: String(model.amount),
        assetCode,
        assetIssuer: assetCode === 'XLM' ? null : (model.assetIssuer ?? null),
        durationDays: Number(model.durationDays),
        maxLossPercent: Number(model.maxLossPercent),
        commitmentType: toCommitmentType(model.commitmentType),
        status: toCommitmentStatus(model.status),
        nftTokenId: model.nftTokenId === undefined || model.nftTokenId === null ? null : String(model.nftTokenId),
    };
}

export function mapAttestationFromChain(model: ChainAttestationModel): AttestationDto {
    return {
        attestationId: String(model.id),
        commitmentId: String(model.commitmentId),
        ownerAddress: model.ownerAddress,
        kind: model.kind,
        verdict: toAttestationVerdict(model.verdict),
        observedAt: toIsoDate(model.observedAt),
        ...(model.details !== undefined ? { details: model.details } : {}),
    };
}
