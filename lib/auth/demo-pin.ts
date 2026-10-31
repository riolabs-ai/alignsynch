/**
 * The PIN, and how many times a stranger may guess it (#183, part 2 of 2).
 *
 * Two properties, both measured rather than asserted:
 *
 * **One comparison, constant time.** `pinMatches()` is the demo's only PIN comparison, and it
 * delegates to `constantTimeEqual()` (`lib/auth/constant-time.ts`): both sides are hashed with
 * SHA-256 and the digests compared with `timingSafeEqual`. Digesting first is what makes the
 * comparison length-independent: `timingSafeEqual` throws on unequal buffer lengths, so comparing
 * the raw strings would answer "wrong length" faster than "wrong value" — a timing oracle that
 * leaks the PIN's length. Two 32-byte digests are always comparable, and the time taken depends on
 * neither the PIN nor how much of it was guessed. The unlock cookie's signature check (#218) uses
 * the same function, so there is one constant-time compare in the tree rather than two.
 *
 * **One sentence per cause, and one shared.** `PIN_REJECTION` is what a wrong PIN gets, and it is
 * also what a button value that is not one of the three gets — the same sentence for both, so a
 * response cannot be used to learn whether an account exists behind a button. The refusals that
 * happen *after* the PIN matched have their own sentences in `lib/auth/demo-failure.ts` (#216): a
 * missing `demo_account` row and a sign-in the auth server refused are different problems with
 * different fixes, and answering "that PIN is not correct" for either sends the reader to the one
 * thing that was right. The one exception here is `RATE_LIMITED`, which says "too many attempts"
 * and nothing about the PIN: a rate limit describes the caller's history, not the secret.
 *
 * The limiter is in-memory and per process. That is the honest shape for a demo panel behind
 * one server: a shared store would be a dependency and a schema, and the failure mode of a
 * per-process limit (a restarted server forgets) is a slower demo, not a weaker login — the
 * PIN is still the gate.
 */
import { constantTimeEqual } from "@/lib/auth/constant-time";

/** The sentence a wrong PIN and an unknown button value both answer. */
export const PIN_REJECTION = "That PIN is not correct.";

/** The sentence a caller gets once the window's attempts are spent. Says nothing about the PIN. */
export const RATE_LIMITED = "Too many attempts. Wait a minute and try again.";

/**
 * Does `given` equal `expected`, in constant time?
 *
 * Both sides are hashed, so the compared buffers are the same length whatever was typed and
 * whatever the PIN is. `expected` comes from the environment and is never logged by this module.
 */
export function pinMatches(given: string, expected: string): boolean {
  return constantTimeEqual(given, expected);
}

/* ------------------------------------------------------------------ *\
 * The rate limit
 * ------------------------------------------------------------------ */

/** How many attempts one caller gets, and over what window. Five a minute is a demo, not a door. */
export const DEMO_PIN_LIMIT = 5;
export const DEMO_PIN_WINDOW_MS = 60_000;

export interface RateLimitVerdict {
  readonly allowed: boolean;
  /** Attempts left in the current window, after this one. */
  readonly remaining: number;
  /** Only meaningful when `allowed` is false: whole seconds until the oldest attempt expires. */
  readonly retryAfterSeconds: number;
}

export interface AttemptLimiter {
  /**
   * Record one attempt for `key` and answer whether it may proceed.
   *
   * A refused attempt is **not** recorded: otherwise a caller who keeps knocking would keep
   * pushing the window forward and could never recover, which turns a rate limit into a
   * permanent ban decided by request volume.
   */
  take(key: string): RateLimitVerdict;
  /** Forget a caller's history — used once a sign-in succeeds, so five attempts is per person. */
  reset(key: string): void;
  /** Live keys, so a long-running process can be inspected without a debugger. */
  size(): number;
}

/**
 * A fixed-window-to-sliding-prune limiter: timestamps in, verdict out.
 *
 * `now` is injected so the test can move the clock instead of sleeping, and it defaults to
 * `Date.now`. The map holds one array per caller; entries older than the window are dropped on
 * every call, so memory follows *recent* callers rather than every caller ever seen.
 */
export function createAttemptLimiter(options: {
  readonly limit: number;
  readonly windowMs: number;
  readonly now?: () => number;
}): AttemptLimiter {
  const now = options.now ?? Date.now;
  const attempts = new Map<string, number[]>();

  return {
    take(key: string): RateLimitVerdict {
      const at = now();
      const cutoff = at - options.windowMs;
      const recent = (attempts.get(key) ?? []).filter((stamp) => stamp > cutoff);

      if (recent.length >= options.limit) {
        const oldest = recent[0] ?? at;
        const waitMs = Math.max(0, oldest + options.windowMs - at);
        attempts.set(key, recent);
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: Math.max(1, Math.ceil(waitMs / 1000)),
        };
      }

      recent.push(at);
      attempts.set(key, recent);
      return {
        allowed: true,
        remaining: Math.max(0, options.limit - recent.length),
        retryAfterSeconds: 0,
      };
    },
    reset(key: string): void {
      attempts.delete(key);
    },
    size(): number {
      return attempts.size;
    },
  };
}

/**
 * The process's limiter. Module scope, because a fresh one per request would limit nothing.
 *
 * `tests/demo-pin.test.ts` builds its own with an injected clock; this instance is only ever
 * touched by the server action.
 */
export const demoPinLimiter: AttemptLimiter = createAttemptLimiter({
  limit: DEMO_PIN_LIMIT,
  windowMs: DEMO_PIN_WINDOW_MS,
});
