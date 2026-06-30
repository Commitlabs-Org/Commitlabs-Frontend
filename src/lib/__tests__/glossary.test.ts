// src/lib/__tests__/glossary.test.ts
import { describe, expect, it } from 'vitest';
import { glossary, GlossaryDefinition } from '@/lib/glossary';

describe('glossary', () => {
  it('contains all defined terms with non-empty definitions', () => {
    const terms = Object.keys(glossary);
    expect(terms.length).toBeGreaterThan(0);

    for (const key of terms) {
      const entry: GlossaryDefinition = glossary[key];
      expect(entry.term).toBeTruthy();
      expect(entry.definition).toBeTruthy();
      expect(entry.term.trim().length).toBeGreaterThan(0);
      expect(entry.definition.trim().length).toBeGreaterThan(0);
    }
  });

  it('resolves known terms by their exact lowercase key', () => {
    expect(glossary['penalty bps']).toBeDefined();
    expect(glossary['penalty bps'].term).toBe('Penalty Bps');
    expect(glossary['penalty bps'].definition).toContain('basis point');

    expect(glossary['compliance score']).toBeDefined();
    expect(glossary['compliance score'].definition).toContain('metric');

    expect(glossary['drawdown']).toBeDefined();
    expect(glossary['attestation']).toBeDefined();
    expect(glossary['early exit']).toBeDefined();
  });

  it('returns undefined for unknown terms (missing-term branch)', () => {
    const unknownTerm = glossary['not-a-real-term'];
    expect(unknownTerm).toBeUndefined();

    const emptyLookup = glossary[''];
    expect(emptyLookup).toBeUndefined();
  });

  it('does not support case-insensitive lookup without normalization', () => {
    // Glossary keys are stored as lowercase; uppercase variant should be undefined
    const upperKey = glossary['PENALTY BPS'];
    expect(upperKey).toBeUndefined();

    // Normalized (toLowerCase) lookup matches correctly
    const normalizedKey = 'Penalty Bps'.toLowerCase();
    expect(glossary[normalizedKey]).toBeDefined();
    expect(glossary[normalizedKey].term).toBe('Penalty Bps');
  });

  it('has no duplicate keys (each term is unique)', () => {
    const keys = Object.keys(glossary);
    const uniqueKeys = new Set(keys);
    expect(keys.length).toBe(uniqueKeys.size);
  });
});
