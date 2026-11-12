/**
 * The shared form guard, as rules — one copy, three callers (#615).
 *
 * The card's constraint is that the news signup and the auth proxy *reuse* the contact form's
 * rules rather than growing a second copy (two copies of a rule is how this repo grew two search
 * catalogues, `data:check` E21). That makes the interesting claims properties of this module:
 *
 *   - the contact form's behaviour did not move when its rules moved here (honeypot, missing
 *     timestamp, too fast, future timestamp — all the same answers);
 *   - the window answers the same for both buckets, and one bucket over budget is enough;
 *   - a signed instant can only be believed when this tree signed it, and a forged one is
 *     *refused rather than clamped* — no `Math.max` that quietly turns a lie into a slow human;
 *   - the auth proxy's allowlist is the credential paths and nothing else, because throttling
 *     `get-session` signs people out under load — the regression this rule exists to prevent.
 *
 * The HTTP half (a real sixth sign-in getting `429 RATE_LIMITED` while `get-session` in the same
 * window still answers 200) is proved against a running server in the card's evidence, because a
 * unit test cannot show that the proxy passes a session read through.
 */
import { describe, expect, it } from "vitest";

import {
  AUTH_RATE_MAX,
  CONTACT_MIN_FILL_MS,
  CONTACT_RATE_MAX,
  honeypotFilled,
  looksLikeSpam,
  looksTooFast,
  rateExceeded,
  windowExceeded,
} from "@/lib/forms/guard";
import { authPathOf, isCredentialAuthPath } from "@/lib/forms/auth-paths";
import { mintFillToken, readFillInstant } from "@/lib/forms/token";

const STARTED_AT = 1_700_000_000_000;
const SECRET = "a-test-secret";

describe("the contact form's rules, now shared", () => {
  it("treats a filled honeypot as a bot", () => {
    expect(honeypotFilled("https://spam.example")).toBe(true);
    expect(honeypotFilled("   ")).toBe(false);
    expect(honeypotFilled(undefined)).toBe(false);
  });

  it("calls a missing, unparsable or future instant a bot's", () => {
    expect(looksLikeSpam({ honeypot: "", startedAt: undefined, now: STARTED_AT })).toBe(true);
    expect(looksLikeSpam({ honeypot: "", startedAt: "not-a-number", now: STARTED_AT })).toBe(true);
    expect(looksLikeSpam({ honeypot: "", startedAt: 0, now: STARTED_AT })).toBe(true);
    // A start instant after "now" cannot be a person who filled the form.
    expect(looksLikeSpam({ honeypot: "", startedAt: STARTED_AT + 60_000, now: STARTED_AT })).toBe(
      true,
    );
  });

  it("lets a person through after the minimum fill time, and nobody sooner", () => {
    expect(looksTooFast({ startedAt: STARTED_AT, now: STARTED_AT })).toBe(true);
    expect(looksTooFast({ startedAt: STARTED_AT, now: STARTED_AT + CONTACT_MIN_FILL_MS - 1 })).toBe(
      true,
    );
    expect(looksTooFast({ startedAt: STARTED_AT, now: STARTED_AT + CONTACT_MIN_FILL_MS })).toBe(
      false,
    );
  });

  it("refuses a bucket at the budget and admits one below it", () => {
    expect(rateExceeded(CONTACT_RATE_MAX - 1)).toBe(false);
    expect(rateExceeded(CONTACT_RATE_MAX)).toBe(true);
    // Either bucket over budget refuses the submission — that is the mail-bombing case.
    expect(windowExceeded({ client: 0, address: CONTACT_RATE_MAX })).toBe(true);
    expect(windowExceeded({ client: CONTACT_RATE_MAX, address: 0 })).toBe(true);
    expect(windowExceeded({ client: 1, address: 1 })).toBe(false);
  });
});

describe("the signed start instant", () => {
  it("verifies a token it minted, and answers the instant it carries", () => {
    const token = mintFillToken(STARTED_AT, SECRET);
    expect(token).toBeDefined();
    expect(readFillInstant(token, SECRET)).toBe(STARTED_AT);
  });

  it("refuses every shape a forgery takes", () => {
    const token = mintFillToken(STARTED_AT, SECRET) ?? "";
    const [stamp, mac] = token.split(".");

    // No token at all, and a token that is not the shape this module mints.
    expect(readFillInstant(undefined, SECRET)).toBeUndefined();
    expect(readFillInstant("", SECRET)).toBeUndefined();
    expect(readFillInstant("1700000000000", SECRET)).toBeUndefined();
    expect(readFillInstant("1700000000000.deadbeef.extra", SECRET)).toBeUndefined();

    // A different MAC, a submitted instant the MAC does not cover, and a foreign secret.
    expect(readFillInstant(`${stamp}.${"0".repeat(64)}`, SECRET)).toBeUndefined();
    expect(readFillInstant(`1600000000000.${mac}`, SECRET)).toBeUndefined();
    expect(readFillInstant(token, "some-other-secret")).toBeUndefined();

    // With no secret configured nothing can be signed, so nothing can be believed.
    expect(readFillInstant(token, undefined)).toBeUndefined();
  });

  it("macs different instants differently, so one token cannot stand for another", () => {
    const first = mintFillToken(STARTED_AT, SECRET) ?? "";
    const second = mintFillToken(STARTED_AT + 1, SECRET) ?? "";
    expect(first).not.toBe(second);
  });
});

describe("the auth proxy's throttle scope", () => {
  it("strips the proxy's prefix before classifying", () => {
    expect(authPathOf("/api/auth/sign-in/email")).toBe("sign-in/email");
    expect(authPathOf("/api/auth/get-session")).toBe("get-session");
    expect(authPathOf("/api/auth/")).toBe("");
  });

  it("throttles the credential paths", () => {
    for (const path of [
      "/api/auth/sign-in/email",
      "/api/auth/sign-in/social",
      "/api/auth/sign-up/email",
      "/api/auth/forget-password",
      "/api/auth/reset-password",
      "/api/auth/request-password-reset",
      "/api/auth/send-verification-email",
      "sign-in/email",
    ]) {
      expect(isCredentialAuthPath(path), path).toBe(true);
    }
  });

  it("never throttles a session read, a token read, or a sign-out", () => {
    for (const path of [
      "/api/auth/get-session",
      "/api/auth/token",
      "/api/auth/session",
      "/api/auth/sign-out",
      "/api/auth/list-sessions",
      "/api/auth/ok",
      "/api/auth/",
      "",
      // A prefix that merely *starts* the same way is not the credential path.
      "/api/auth/sign-inx/email",
      "/api/auth/profile/sign-in",
    ]) {
      expect(isCredentialAuthPath(path), path).toBe(false);
    }
  });

  it("keeps the auth window at five attempts a minute", () => {
    expect(AUTH_RATE_MAX).toBe(5);
  });
});
