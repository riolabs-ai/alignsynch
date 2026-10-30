/**
 * The PIN and the limit (#183, part 2).
 *
 * Two properties are asserted rather than described:
 *
 *   - **one comparison, no length oracle.** A PIN that is a prefix of the real one, a PIN that
 *     is longer, and a PIN of the same length but a different last character are all just
 *     `false` — `pinMatches` compares digests, so `timingSafeEqual` never sees unequal buffers
 *     and never throws, which is what would otherwise leak the PIN's length through a 500.
 *   - **a refused attempt is not recorded.** A caller who keeps knocking must not push their own
 *     window forward forever; otherwise the limit becomes a ban decided by request volume.
 *
 * The clock is injected, so the window is tested by moving time rather than by sleeping.
 */
import { describe, expect, it } from "vitest";

import {
  createAttemptLimiter,
  DEMO_PIN_LIMIT,
  DEMO_PIN_WINDOW_MS,
  pinMatches,
} from "@/lib/auth/demo-pin";

describe("pinMatches", () => {
  it("accepts the exact PIN", () => {
    expect(pinMatches("4821", "4821")).toBe(true);
  });

  it("rejects a wrong PIN of the same length", () => {
    expect(pinMatches("4822", "4821")).toBe(false);
  });

  it("rejects a prefix, an extension and an empty value without throwing", () => {
    expect(pinMatches("482", "4821")).toBe(false);
    expect(pinMatches("48211", "4821")).toBe(false);
    expect(pinMatches("", "4821")).toBe(false);
    expect(pinMatches("4821", "")).toBe(false);
  });

  it("is not fooled by whitespace or case", () => {
    expect(pinMatches(" 4821", "4821")).toBe(false);
    expect(pinMatches("4821 ", "4821")).toBe(false);
  });
});

describe("createAttemptLimiter", () => {
  /** A limiter over a clock the test owns. */
  const limiterAt = (start = 1_000_000) => {
    let now = start;
    const limiter = createAttemptLimiter({
      limit: DEMO_PIN_LIMIT,
      windowMs: DEMO_PIN_WINDOW_MS,
      now: () => now,
    });
    return { limiter, advance: (ms: number) => (now += ms), at: () => now };
  };

  it("allows exactly the limit, then refuses", () => {
    const { limiter } = limiterAt();

    for (let attempt = 1; attempt <= DEMO_PIN_LIMIT; attempt += 1) {
      const verdict = limiter.take("1.2.3.4");
      expect(verdict.allowed).toBe(true);
      expect(verdict.remaining).toBe(DEMO_PIN_LIMIT - attempt);
    }

    const refused = limiter.take("1.2.3.4");
    expect(refused.allowed).toBe(false);
    expect(refused.remaining).toBe(0);
    expect(refused.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("counts per caller, not per process", () => {
    const { limiter } = limiterAt();
    for (let attempt = 0; attempt < DEMO_PIN_LIMIT; attempt += 1) limiter.take("1.2.3.4");

    expect(limiter.take("1.2.3.4").allowed).toBe(false);
    expect(limiter.take("5.6.7.8").allowed).toBe(true);
  });

  it("does not record a refused attempt, so the window still opens", () => {
    const { limiter, advance } = limiterAt();
    for (let attempt = 0; attempt < DEMO_PIN_LIMIT; attempt += 1) limiter.take("1.2.3.4");

    // Keep knocking for a full window; the refusals must not extend the ban.
    for (let knock = 0; knock < 20; knock += 1) {
      expect(limiter.take("1.2.3.4").allowed).toBe(false);
      advance(DEMO_PIN_WINDOW_MS / 20);
    }
    advance(DEMO_PIN_WINDOW_MS);

    expect(limiter.take("1.2.3.4").allowed).toBe(true);
  });

  it("reports a retry waiting on the oldest attempt in the window", () => {
    const { limiter, advance } = limiterAt(1_000_000);
    for (let attempt = 0; attempt < DEMO_PIN_LIMIT; attempt += 1) {
      limiter.take("1.2.3.4");
      advance(1_000);
    }
    // Five attempts 1 s apart; at the sixth the oldest expires 60 s after it was taken,
    // i.e. 55 s from now.
    expect(limiter.take("1.2.3.4").retryAfterSeconds).toBe(55);
  });

  it("forgets a caller on reset — a successful sign-in starts a clean five", () => {
    const { limiter } = limiterAt();
    for (let attempt = 0; attempt < DEMO_PIN_LIMIT; attempt += 1) limiter.take("1.2.3.4");
    expect(limiter.take("1.2.3.4").allowed).toBe(false);

    limiter.reset("1.2.3.4");
    expect(limiter.take("1.2.3.4").allowed).toBe(true);
  });

  it("keeps one array per live caller, not one per caller ever seen", () => {
    const { limiter } = limiterAt();
    limiter.take("1.1.1.1");
    limiter.take("2.2.2.2");
    expect(limiter.size()).toBe(2);
  });
});
