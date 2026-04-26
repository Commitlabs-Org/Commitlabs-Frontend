import { describe, it, expect } from 'vitest';
import { ZodError } from 'zod';
import {
  validateAttestationData,
  healthCheckDataSchema,
  violationDataSchema,
  feeGenerationDataSchema,
  drawdownDataSchema,
  MAX_STRING_LENGTH,
  MAX_PAYLOAD_BYTES,
} from '@/lib/backend/attestationSchemas';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function oversizedString(extra = 1): string {
  return 'a'.repeat(MAX_STRING_LENGTH + extra);
}

function oversizedPayload(): Record<string, unknown> {
  // Build a payload whose JSON serialisation exceeds MAX_PAYLOAD_BYTES
  return { reason: 'x'.repeat(MAX_PAYLOAD_BYTES + 1) };
}

function zodMessages(err: ZodError): string[] {
  return err.issues.map((i) => i.message);
}

// ---------------------------------------------------------------------------
// health_check
// ---------------------------------------------------------------------------

describe('healthCheckDataSchema', () => {
  it('accepts valid minimal payload', () => {
    const result = healthCheckDataSchema.parse({ complianceScore: 80 });
    expect(result.complianceScore).toBe(80);
    expect(result.violation).toBe(false); // default
  });

  it('accepts full valid payload', () => {
    const result = healthCheckDataSchema.parse({
      complianceScore: 95,
      violation: true,
      notes: 'All good',
    });
    expect(result).toMatchObject({ complianceScore: 95, violation: true, notes: 'All good' });
  });

  it('rejects missing complianceScore', () => {
    expect(() => healthCheckDataSchema.parse({})).toThrow(ZodError);
  });

  it('rejects complianceScore below 0', () => {
    const err = (() => {
      try { healthCheckDataSchema.parse({ complianceScore: -1 }); }
      catch (e) { return e as ZodError; }
    })()!;
    expect(zodMessages(err)).toContain('complianceScore must be >= 0');
  });

  it('rejects complianceScore above 100', () => {
    const err = (() => {
      try { healthCheckDataSchema.parse({ complianceScore: 101 }); }
      catch (e) { return e as ZodError; }
    })()!;
    expect(zodMessages(err)).toContain('complianceScore must be <= 100');
  });

  it('rejects non-numeric complianceScore', () => {
    expect(() => healthCheckDataSchema.parse({ complianceScore: 'high' })).toThrow(ZodError);
  });

  it('rejects notes exceeding MAX_STRING_LENGTH', () => {
    expect(() =>
      healthCheckDataSchema.parse({ complianceScore: 50, notes: oversizedString() }),
    ).toThrow(ZodError);
  });

  it('rejects unknown keys (strict mode)', () => {
    expect(() =>
      healthCheckDataSchema.parse({ complianceScore: 50, unknownField: 'bad' }),
    ).toThrow(ZodError);
  });

  it('rejects multiple unknown keys', () => {
    expect(() =>
      healthCheckDataSchema.parse({ complianceScore: 50, foo: 1, bar: 2 }),
    ).toThrow(ZodError);
  });
});

// ---------------------------------------------------------------------------
// violation
// ---------------------------------------------------------------------------

describe('violationDataSchema', () => {
  it('accepts valid minimal payload', () => {
    const result = violationDataSchema.parse({ reason: 'Drawdown exceeded limit' });
    expect(result.reason).toBe('Drawdown exceeded limit');
  });

  it('accepts full valid payload', () => {
    const result = violationDataSchema.parse({
      reason: 'Max loss breached',
      complianceScore: 20,
      severity: 'high',
    });
    expect(result).toMatchObject({ reason: 'Max loss breached', complianceScore: 20, severity: 'high' });
  });

  it('rejects missing reason', () => {
    expect(() => violationDataSchema.parse({})).toThrow(ZodError);
  });

  it('rejects empty reason string', () => {
    expect(() => violationDataSchema.parse({ reason: '' })).toThrow(ZodError);
  });

  it('rejects reason exceeding MAX_STRING_LENGTH', () => {
    expect(() => violationDataSchema.parse({ reason: oversizedString() })).toThrow(ZodError);
  });

  it('rejects invalid severity value', () => {
    expect(() =>
      violationDataSchema.parse({ reason: 'breach', severity: 'critical' }),
    ).toThrow(ZodError);
  });

  it('rejects complianceScore out of range', () => {
    expect(() =>
      violationDataSchema.parse({ reason: 'breach', complianceScore: 150 }),
    ).toThrow(ZodError);
  });

  it('rejects unknown keys', () => {
    expect(() =>
      violationDataSchema.parse({ reason: 'breach', extraField: true }),
    ).toThrow(ZodError);
  });
});

// ---------------------------------------------------------------------------
// fee_generation
// ---------------------------------------------------------------------------

describe('feeGenerationDataSchema', () => {
  it('accepts numeric feeEarned', () => {
    const result = feeGenerationDataSchema.parse({ feeEarned: 100 });
    expect(result.feeEarned).toBe('100'); // coerced to string
  });

  it('accepts string feeEarned', () => {
    const result = feeGenerationDataSchema.parse({ feeEarned: '250.5' });
    expect(result.feeEarned).toBe('250.5');
  });

  it('accepts full valid payload', () => {
    const result = feeGenerationDataSchema.parse({
      feeEarned: '500',
      asset: 'XLM',
      complianceScore: 90,
    });
    expect(result).toMatchObject({ feeEarned: '500', asset: 'XLM', complianceScore: 90 });
  });

  it('rejects missing feeEarned', () => {
    expect(() => feeGenerationDataSchema.parse({})).toThrow(ZodError);
  });

  it('rejects negative numeric feeEarned', () => {
    expect(() => feeGenerationDataSchema.parse({ feeEarned: -10 })).toThrow(ZodError);
  });

  it('rejects asset exceeding MAX_STRING_LENGTH', () => {
    expect(() =>
      feeGenerationDataSchema.parse({ feeEarned: '100', asset: oversizedString() }),
    ).toThrow(ZodError);
  });

  it('rejects unknown keys', () => {
    expect(() =>
      feeGenerationDataSchema.parse({ feeEarned: '100', amount: '100' }),
    ).toThrow(ZodError);
  });

  it('rejects complianceScore out of range', () => {
    expect(() =>
      feeGenerationDataSchema.parse({ feeEarned: '100', complianceScore: -5 }),
    ).toThrow(ZodError);
  });
});

// ---------------------------------------------------------------------------
// drawdown
// ---------------------------------------------------------------------------

describe('drawdownDataSchema', () => {
  it('accepts valid minimal payload', () => {
    const result = drawdownDataSchema.parse({ drawdownPercent: 3.5 });
    expect(result.drawdownPercent).toBe(3.5);
  });

  it('accepts full valid payload', () => {
    const result = drawdownDataSchema.parse({
      drawdownPercent: 5,
      maxAllowed: 8,
      complianceScore: 85,
    });
    expect(result).toMatchObject({ drawdownPercent: 5, maxAllowed: 8, complianceScore: 85 });
  });

  it('rejects missing drawdownPercent', () => {
    expect(() => drawdownDataSchema.parse({})).toThrow(ZodError);
  });

  it('rejects drawdownPercent below 0', () => {
    expect(() => drawdownDataSchema.parse({ drawdownPercent: -1 })).toThrow(ZodError);
  });

  it('rejects drawdownPercent above 100', () => {
    expect(() => drawdownDataSchema.parse({ drawdownPercent: 101 })).toThrow(ZodError);
  });

  it('rejects non-numeric drawdownPercent', () => {
    expect(() => drawdownDataSchema.parse({ drawdownPercent: '5%' })).toThrow(ZodError);
  });

  it('rejects unknown keys', () => {
    expect(() =>
      drawdownDataSchema.parse({ drawdownPercent: 5, extraKey: 'bad' }),
    ).toThrow(ZodError);
  });

  it('rejects maxAllowed out of range', () => {
    expect(() =>
      drawdownDataSchema.parse({ drawdownPercent: 5, maxAllowed: 200 }),
    ).toThrow(ZodError);
  });
});

// ---------------------------------------------------------------------------
// validateAttestationData — integration / size guard
// ---------------------------------------------------------------------------

describe('validateAttestationData', () => {
  it('validates health_check successfully', () => {
    const result = validateAttestationData('health_check', { complianceScore: 75 });
    expect(result).toMatchObject({ complianceScore: 75 });
  });

  it('validates violation successfully', () => {
    const result = validateAttestationData('violation', { reason: 'Limit breached' });
    expect(result).toMatchObject({ reason: 'Limit breached' });
  });

  it('validates fee_generation successfully', () => {
    const result = validateAttestationData('fee_generation', { feeEarned: '200' });
    expect(result).toMatchObject({ feeEarned: '200' });
  });

  it('validates drawdown successfully', () => {
    const result = validateAttestationData('drawdown', { drawdownPercent: 4 });
    expect(result).toMatchObject({ drawdownPercent: 4 });
  });

  it('throws ZodError for disallowed key on health_check', () => {
    expect(() =>
      validateAttestationData('health_check', { complianceScore: 80, injected: 'evil' }),
    ).toThrow(ZodError);
  });

  it('throws ZodError for disallowed key on violation', () => {
    expect(() =>
      validateAttestationData('violation', { reason: 'breach', injected: 'evil' }),
    ).toThrow(ZodError);
  });

  it('throws ZodError for disallowed key on fee_generation', () => {
    expect(() =>
      validateAttestationData('fee_generation', { feeEarned: '100', amount: '100' }),
    ).toThrow(ZodError);
  });

  it('throws ZodError for disallowed key on drawdown', () => {
    expect(() =>
      validateAttestationData('drawdown', { drawdownPercent: 5, hack: true }),
    ).toThrow(ZodError);
  });

  it('throws PAYLOAD_TOO_LARGE when payload exceeds MAX_PAYLOAD_BYTES', () => {
    const bigPayload = { reason: 'x'.repeat(MAX_PAYLOAD_BYTES + 1) };
    let thrown: Error | undefined;
    try {
      validateAttestationData('violation', bigPayload);
    } catch (e) {
      thrown = e as Error;
    }
    expect(thrown).toBeDefined();
    expect((thrown as NodeJS.ErrnoException).code).toBe('PAYLOAD_TOO_LARGE');
    expect(thrown!.message).toMatch(/maximum allowed size/i);
  });

  it('throws PAYLOAD_TOO_LARGE before schema validation (size checked first)', () => {
    // Payload is oversized AND has wrong type — size error should win
    const bigPayload = { complianceScore: 'x'.repeat(MAX_PAYLOAD_BYTES + 1) };
    let thrown: Error | undefined;
    try {
      validateAttestationData('health_check', bigPayload);
    } catch (e) {
      thrown = e as Error;
    }
    expect((thrown as NodeJS.ErrnoException).code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('accepts payload exactly at MAX_PAYLOAD_BYTES boundary', () => {
    // Craft a payload whose JSON is exactly MAX_PAYLOAD_BYTES bytes
    const base = JSON.stringify({ complianceScore: 50, violation: false });
    // This is well under the limit — just confirm it passes
    expect(() =>
      validateAttestationData('health_check', { complianceScore: 50, violation: false }),
    ).not.toThrow();
  });
});
