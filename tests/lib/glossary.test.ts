import { describe, expect, it } from 'vitest';
import { GLOSSARY } from '@/lib/glossary';

describe('GLOSSARY', () => {
  it('contains an entry for every required term key', () => {
    const requiredKeys = [
      'penalty bps',
      'compliance score',
      'drawdown',
      'attestation',
      'early exit',
      'max loss threshold',
    ];

    for (const key of requiredKeys) {
      expect(GLOSSARY[key]).toBeDefined();
      expect(GLOSSARY[key].term).toBeTruthy();
      expect(GLOSSARY[key].definition).toBeTruthy();
    }
  });

  it('performs case-insensitive lookups for "max loss threshold"', () => {
    expect(GLOSSARY['max loss threshold']).toBeDefined();
    expect(GLOSSARY['MAX LOSS THRESHOLD']).toBeUndefined(
      'The GLOSSARY object is case-sensitive; case-insensitive lookup is handled by the consumer (GlossaryTerm).',
    );
  });

  it('has unique term values across all entries', () => {
    const terms = Object.values(GLOSSARY).map((entry) => entry.term);
    const uniqueTerms = new Set(terms);
    expect(uniqueTerms.size).toBe(terms.length);
  });

  it('has no empty definitions', () => {
    for (const [key, entry] of Object.entries(GLOSSARY)) {
      expect(
        entry.definition.trim().length,
        `Definition for "${key}" should not be empty`,
      ).toBeGreaterThan(0);
    }
  });

  it('includes exactly the expected number of entries', () => {
    // Update this number whenever glossary entries are added or removed.
    expect(Object.keys(GLOSSARY)).toHaveLength(6);
  });
});
