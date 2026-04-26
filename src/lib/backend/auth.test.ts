import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  consumeNonce,
  createSessionToken,
  generateChallengeMessage,
  getNonceRecord,
  storeNonce,
  verifySessionToken,
} from './auth';

describe('auth storage helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stores and consumes nonces through the shared storage adapter', async () => {
    const nonce = 'abc123';
    const record = await storeNonce('GADDRESS', nonce);

    expect(generateChallengeMessage(nonce)).toBe(
      'Sign in to CommitLabs: abc123',
    );
    expect(record.nonce).toBe(nonce);
    expect((await getNonceRecord(nonce))?.address).toBe('GADDRESS');

    expect(await consumeNonce(nonce)).toBe(true);
    expect(await getNonceRecord(nonce)).toBeUndefined();
  });

  it('expires nonces after their TTL window', async () => {
    const nonce = 'expireme';
    await storeNonce('GADDRESS', nonce);

    vi.advanceTimersByTime(5 * 60 * 1000 + 1);

    expect(await getNonceRecord(nonce)).toBeUndefined();
  });

  it('creates verifiable session tokens backed by storage', async () => {
    const token = await createSessionToken('GSESSION');

    expect(token).toMatch(/^session_GSESSION_/);
    await expect(verifySessionToken(token)).resolves.toEqual({
      valid: true,
      address: 'GSESSION',
    });

    vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 1);

    await expect(verifySessionToken(token)).resolves.toEqual({
      valid: false,
    });
  });
});
