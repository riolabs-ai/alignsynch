/**
 * The one constant-time string comparison in the tree.
 *
 * `timingSafeEqual` throws on buffers of unequal length, and comparing the raw strings would
 * answer "wrong length" faster than "wrong value" — a timing oracle that leaks the length of a
 * secret. Digesting both sides first is what makes the comparison length-independent: two 32-byte
 * digests are always comparable, and the time taken depends on neither value.
 *
 * Two callers, deliberately one implementation: `pinMatches()` (the demo PIN, #183) and the
 * unlock cookie's HMAC check (`.verifyUnlock()` in `lib/auth/demo-unlock.ts`, #218). A second
 * copy is how one of the two quietly loses `timingSafeEqual` in a later refactor.
 */
import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Does `given` equal `expected`, in constant time?
 *
 * Both sides are hashed, so the compared buffers are the same length whatever was passed and
 * whatever the secret is. Neither argument is logged, echoed or returned by this module.
 */
export function constantTimeEqual(given: string, expected: string): boolean {
  const left = createHash("sha256").update(given, "utf8").digest();
  const right = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(left, right);
}
