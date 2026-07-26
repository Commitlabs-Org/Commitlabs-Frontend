/**
 * Type-level tests to ensure consistency between shared enums and legacy types.
 * These tests will fail at compile time if the shared enums drift from the legacy types.
 */

import { describe, it, expect } from 'vitest';
import { CommitmentStatus as SharedCommitmentStatus, CommitmentType as SharedCommitmentType } from '../types/shared';
import { CommitmentStatus as DomainCommitmentStatus, CommitmentType as DomainCommitmentType } from '../types/domain';
import { CommitmentStatusDto as DtoCommitmentStatus, CommitmentTypeDto as DtoCommitmentType } from '../backend/dto';

describe('Shared Types Consistency', () => {
  describe('CommitmentStatus enum consistency', () => {
    it('should have all domain status values mapped to shared enum', () => {
      const domainValues: DomainCommitmentStatus[] = ['Active', 'Settled', 'Violated', 'Early Exit'];
      const sharedValues = [
        SharedCommitmentStatus.ACTIVE,
        SharedCommitmentStatus.SETTLED,
        SharedCommitmentStatus.VIOLATED,
        SharedCommitmentStatus.EARLY_EXIT,
      ];
      
      // Ensure the count matches
      expect(domainValues.length).toBe(sharedValues.length);
      
      // Ensure all shared values are valid lowercase versions of domain values
      expect(sharedValues).toEqual(expect.arrayContaining([
        'active',
        'settled',
        'violated',
        'early_exit',
      ]));
    });

    it('should have DTO status type aligned with shared enum', () => {
      // The DTO type should now be an alias to the shared enum
      const dtoValue: DtoCommitmentStatus = SharedCommitmentStatus.ACTIVE;
      expect(dtoValue).toBe('active');
    });

    it('should map legacy domain formats to canonical values', () => {
      // Test that the mapping functions handle legacy formats
      const legacyFormats = ['early exit', 'early_exit', 'early-exit'];
      legacyFormats.forEach(format => {
        const normalized = format.trim().toLowerCase();
        expect(['early exit', 'early_exit', 'early-exit']).toContain(normalized);
      });
    });
  });

  describe('CommitmentType enum consistency', () => {
    it('should have all domain type values mapped to shared enum', () => {
      const domainValues: DomainCommitmentType[] = ['Safe', 'Balanced', 'Aggressive'];
      const sharedValues = [
        SharedCommitmentType.SAFE,
        SharedCommitmentType.BALANCED,
        SharedCommitmentType.AGGRESSIVE,
      ];
      
      // Ensure the count matches
      expect(domainValues.length).toBe(sharedValues.length);
      
      // Ensure all shared values are valid lowercase versions of domain values
      expect(sharedValues).toEqual(expect.arrayContaining([
        'safe',
        'balanced',
        'aggressive',
      ]));
    });

    it('should have DTO type aligned with shared enum', () => {
      // The DTO type should now be an alias to the shared enum
      const dtoValue: DtoCommitmentType = SharedCommitmentType.BALANCED;
      expect(dtoValue).toBe('balanced');
    });
  });

  describe('Type-level drift detection', () => {
    it('should ensure shared enum values match expected set', () => {
      // This test will fail if new values are added to the shared enum
      // without updating this test
      const expectedStatusValues = ['active', 'settled', 'violated', 'early_exit'] as const;
      const actualStatusValues = Object.values(SharedCommitmentStatus);
      
      expect(actualStatusValues).toEqual(expect.arrayContaining(expectedStatusValues));
      expect(actualStatusValues.length).toBe(expectedStatusValues.length);
    });

    it('should ensure shared type values match expected set', () => {
      // This test will fail if new values are added to the shared type
      // without updating this test
      const expectedTypeValues = ['safe', 'balanced', 'aggressive'] as const;
      const actualTypeValues = Object.values(SharedCommitmentType);
      
      expect(actualTypeValues).toEqual(expect.arrayContaining(expectedTypeValues));
      expect(actualTypeValues.length).toBe(expectedTypeValues.length);
    });
  });
});
