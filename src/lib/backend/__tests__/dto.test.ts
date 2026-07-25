import { describe, it, expect } from 'vitest';
import {
    mapCommitmentFromChain,
    mapAttestationFromChain,
    type ChainCommitmentModel,
    type ChainAttestationModel,
} from '../dto';

describe('mapCommitmentFromChain', () => {
    it('maps a full chain model to a CommitmentDto correctly', () => {
        const model: ChainCommitmentModel = {
            id: 42,
            ownerAddress: 'GADDRESS123',
            amount: '1000',
            assetCode: 'USDC',
            assetIssuer: 'GISSUER456',
            durationDays: '30',
            maxLossPercent: '10',
            commitmentType: 'safe',
            status: 'active',
            nftTokenId: 7,
        };

        const dto = mapCommitmentFromChain(model);

        expect(dto.commitmentId).toBe('42');
        expect(dto.ownerAddress).toBe('GADDRESS123');
        expect(dto.amount).toBe('1000');
        expect(dto.assetCode).toBe('USDC');
        expect(dto.assetIssuer).toBe('GISSUER456');
        expect(dto.durationDays).toBe(30);
        expect(dto.maxLossPercent).toBe(10);
        expect(dto.commitmentType).toBe('safe');
        expect(dto.status).toBe('active');
        expect(dto.nftTokenId).toBe('7');
    });

    it('defaults assetCode to XLM and sets assetIssuer to null when assetCode is missing', () => {
        const model: ChainCommitmentModel = {
            id: '1',
            ownerAddress: 'GOWNER',
            amount: 500,
            durationDays: 7,
            maxLossPercent: 5,
            commitmentType: 'balanced',
        };

        const dto = mapCommitmentFromChain(model);

        expect(dto.assetCode).toBe('XLM');
        expect(dto.assetIssuer).toBeNull();
    });

    it('defaults assetIssuer to null when assetCode is XLM even if assetIssuer is provided', () => {
        const model: ChainCommitmentModel = {
            id: '2',
            ownerAddress: 'GOWNER',
            amount: '200',
            assetCode: 'XLM',
            assetIssuer: 'GISSUER_SHOULD_BE_IGNORED',
            durationDays: 14,
            maxLossPercent: 20,
            commitmentType: 'aggressive',
            status: 'settled',
            nftTokenId: null,
        };

        const dto = mapCommitmentFromChain(model);

        expect(dto.assetIssuer).toBeNull();
        expect(dto.nftTokenId).toBeNull();
    });

    it('defaults commitmentType to balanced for unknown values', () => {
        const model: ChainCommitmentModel = {
            id: 'abc',
            ownerAddress: 'GOWNER',
            amount: '0',
            durationDays: 1,
            maxLossPercent: 0,
            commitmentType: 'UNKNOWN_TYPE',
        };

        const dto = mapCommitmentFromChain(model);

        expect(dto.commitmentType).toBe('balanced');
    });

    it('defaults status to active for unknown or missing status', () => {
        const model: ChainCommitmentModel = {
            id: '99',
            ownerAddress: 'GOWNER',
            amount: '999999',
            durationDays: 365,
            maxLossPercent: 100,
            commitmentType: 'safe',
            status: 'unknown_status',
        };

        const dto = mapCommitmentFromChain(model);

        expect(dto.status).toBe('active');
    });

    it('maps early_exit status variants correctly', () => {
        const variants = ['early exit', 'early_exit', 'early-exit'];

        for (const statusVariant of variants) {
            const model: ChainCommitmentModel = {
                id: '10',
                ownerAddress: 'GOWNER',
                amount: '100',
                durationDays: 30,
                maxLossPercent: 10,
                commitmentType: 'balanced',
                status: statusVariant,
            };

            const dto = mapCommitmentFromChain(model);
            expect(dto.status).toBe('early_exit');
        }
    });

    it('converts numeric id and numeric durationDays/maxLossPercent to correct types', () => {
        const model: ChainCommitmentModel = {
            id: 999,
            ownerAddress: 'GOWNER',
            amount: '0',
            durationDays: '90',
            maxLossPercent: '15',
            commitmentType: 'aggressive',
        };

        const dto = mapCommitmentFromChain(model);

        expect(dto.commitmentId).toBe('999');
        expect(typeof dto.durationDays).toBe('number');
        expect(dto.durationDays).toBe(90);
        expect(typeof dto.maxLossPercent).toBe('number');
        expect(dto.maxLossPercent).toBe(15);
    });
});

describe('mapAttestationFromChain', () => {
    it('maps a full chain attestation model to an AttestationDto correctly', () => {
        const model: ChainAttestationModel = {
            id: 1,
            commitmentId: 42,
            ownerAddress: 'GOWNER',
            kind: 'portfolio_check',
            verdict: 'pass',
            observedAt: '2024-01-15T10:00:00.000Z',
            details: { score: 95 },
        };

        const dto = mapAttestationFromChain(model);

        expect(dto.attestationId).toBe('1');
        expect(dto.commitmentId).toBe('42');
        expect(dto.ownerAddress).toBe('GOWNER');
        expect(dto.kind).toBe('portfolio_check');
        expect(dto.verdict).toBe('pass');
        expect(dto.observedAt).toBe('2024-01-15T10:00:00.000Z');
        expect(dto.details).toEqual({ score: 95 });
    });

    it('defaults verdict to unknown for missing or unrecognized verdict values', () => {
        const model: ChainAttestationModel = {
            id: '2',
            commitmentId: '10',
            ownerAddress: 'GOWNER',
            kind: 'loss_check',
            verdict: 'inconclusive',
        };

        const dto = mapAttestationFromChain(model);

        expect(dto.verdict).toBe('unknown');
    });

    it('omits details field when not provided in the chain model', () => {
        const model: ChainAttestationModel = {
            id: '3',
            commitmentId: '20',
            ownerAddress: 'GOWNER',
            kind: 'portfolio_check',
            verdict: 'fail',
            observedAt: new Date('2024-06-01T00:00:00.000Z'),
        };

        const dto = mapAttestationFromChain(model);

        expect(dto.verdict).toBe('fail');
        expect(dto.observedAt).toBe('2024-06-01T00:00:00.000Z');
        expect('details' in dto).toBe(false);
    });

    it('falls back to a valid ISO date when observedAt is undefined or invalid', () => {
        const modelWithoutObservedAt: ChainAttestationModel = {
            id: '4',
            commitmentId: '30',
            ownerAddress: 'GOWNER',
            kind: 'portfolio_check',
        };

        const dto = mapAttestationFromChain(modelWithoutObservedAt);

        expect(() => new Date(dto.observedAt)).not.toThrow();
        expect(new Date(dto.observedAt).toISOString()).toBe(dto.observedAt);
    });

    it('handles numeric timestamp in observedAt', () => {
        const timestamp = new Date('2024-03-20T12:00:00.000Z').getTime();
        const model: ChainAttestationModel = {
            id: '5',
            commitmentId: '40',
            ownerAddress: 'GOWNER',
            kind: 'portfolio_check',
            observedAt: timestamp,
        };

        const dto = mapAttestationFromChain(model);

        expect(dto.observedAt).toBe('2024-03-20T12:00:00.000Z');
    });
});
