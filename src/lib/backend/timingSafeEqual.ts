import { timingSafeEqual } from 'crypto';

/**
 * Compare two secrets without leaking their contents through response timing.
 *
 * A plain `a === b` short-circuits on the first differing byte, so the time it
 * takes to reject a guess is proportional to how many leading bytes the guess
 * got right. An attacker who can time the endpoint can therefore recover a
 * secret one byte at a time. `crypto.timingSafeEqual` compares every byte
 * regardless of where the first difference is.
 *
 * `timingSafeEqual` throws a `RangeError` when the two buffers differ in
 * length, and that throw is itself a length oracle — so the length is checked
 * first and a mismatch is rejected outright. Length is not treated as secret.
 *
 * @param a  the supplied value (untrusted)
 * @param b  the expected value (secret)
 * @returns  `true` only when both values are byte-identical
 */
export function safeEqualToken(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
