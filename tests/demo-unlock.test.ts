/**
 * The unlock cookie's arithmetic (#218) — what it authorises, and for how long.
 *
 * The claim this file is accepted on is the one the card writes down: the cookie is an
 * authorisation to *pick a demo role*, signed with a server secret, with its **expiry inside the
 * signed payload** so a client cannot extend it. Each assertion below is one half of that:
 *
 *   shape       `v1.<expiresAt base36>.<hmac>` and nothing else — no PIN, no address, no role,
 *               no padding that a cookie or URL would have to escape
 *   verdicts    absent / malformed / signature / expired / no-secret, each reached on purpose
 *   authority   the signature is what makes an expiry trustworthy: editing the number invalidates
 *               the value, and a value signed with another secret never verifies
 *   attributes  httpOnly, `sameSite=lax`, `secure` only in a production deployment, and a maxAge
 *               that matches the payload's fifteen minutes
 *
 * The clock is injected everywhere (`now`), so the expiry branch is proven rather than waited for.
 */
import { describe, expect, it } from "vitest";

import {
  DEMO_UNLOCK_COOKIE,
  DEMO_UNLOCK_TTL_MS,
  signUnlock,
  unlockCookieAttributes,
  verifyUnlock,
} from "@/lib/auth/demo-unlock";

const SECRET = "a-test-secret-that-is-not-any-deployment's";
const OTHER_SECRET = "a-different-test-secret";
const NOW = 1_793_400_000_000; // 2026-10-30, the fixture clock's neighbourhood

/** A value for an unlock that lasts `ms` from `NOW`. */
function unlockFor(ms: number, secret = SECRET): string {
  return signUnlock({ expiresAt: NOW + ms, secret });
}

describe("the unlock cookie's shape", () => {
  it("is version, expiry and a signature — and carries nothing else", () => {
    const value = unlockFor(DEMO_UNLOCK_TTL_MS);
    const parts = value.split(".");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe("v1");
    // The expiry is the payload's own number, in base 36, and the signature is a 32-byte
    // base64url digest (43 chars, no padding).
    expect(parts[1]).toBe((NOW + DEMO_UNLOCK_TTL_MS).toString(36));
    expect(parts[2]).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("is safe in a cookie and in a URL, with no escaping needed", () => {
    const value = unlockFor(DEMO_UNLOCK_TTL_MS);
    expect(value).toMatch(/^[A-Za-z0-9._-]+$/);
    expect(encodeURIComponent(value)).toBe(value);
  });

  it("names itself a demo unlock, not a session", () => {
    expect(DEMO_UNLOCK_COOKIE).toBe("demo_unlock");
    expect(DEMO_UNLOCK_COOKIE.startsWith("neon-auth")).toBe(false);
  });

  it("is fifteen minutes", () => {
    expect(DEMO_UNLOCK_TTL_MS).toBe(15 * 60 * 1000);
    expect(DEMO_UNLOCK_TTL_MS / 1000).toBe(900);
  });
});

describe("verifying an unlock", () => {
  it("accepts a fresh value and reports the expiry it stated", () => {
    const expiresAt = NOW + DEMO_UNLOCK_TTL_MS;
    expect(
      verifyUnlock({ value: unlockFor(DEMO_UNLOCK_TTL_MS), secret: SECRET, now: NOW }),
    ).toEqual({ ok: true, expiresAt });
  });

  it("accepts a value one millisecond before its expiry, and refuses it at the expiry", () => {
    const value = unlockFor(DEMO_UNLOCK_TTL_MS);
    const expiresAt = NOW + DEMO_UNLOCK_TTL_MS;
    expect(verifyUnlock({ value, secret: SECRET, now: expiresAt - 1 }).ok).toBe(true);
    expect(verifyUnlock({ value, secret: SECRET, now: expiresAt })).toEqual({
      ok: false,
      reason: "expired",
    });
    expect(verifyUnlock({ value, secret: SECRET, now: expiresAt + 60_000 })).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it("refuses a value whose expiry was edited — the expiry is inside the signature", () => {
    const [version, expiry, signature] = unlockFor(DEMO_UNLOCK_TTL_MS).split(".");
    const extended = (Number.parseInt(expiry ?? "0", 36) + 24 * 60 * 60 * 1000).toString(36);
    const forged = `${version}.${extended}.${signature}`;
    expect(verifyUnlock({ value: forged, secret: SECRET, now: NOW })).toEqual({
      ok: false,
      reason: "signature",
    });
  });

  it("refuses a value whose signature was edited, however plausible it looks", () => {
    const [version, expiry, signature] = unlockFor(DEMO_UNLOCK_TTL_MS).split(".");
    const flipped = `${(signature ?? "").slice(0, -1)}${(signature ?? "").endsWith("A") ? "B" : "A"}`;
    expect(
      verifyUnlock({ value: `${version}.${expiry}.${flipped}`, secret: SECRET, now: NOW }),
    ).toEqual({ ok: false, reason: "signature" });
  });

  it("refuses a value signed with another secret", () => {
    expect(
      verifyUnlock({
        value: unlockFor(DEMO_UNLOCK_TTL_MS, OTHER_SECRET),
        secret: SECRET,
        now: NOW,
      }),
    ).toEqual({ ok: false, reason: "signature" });
  });

  it("answers `absent` for a request that carried no cookie — the fresh browser", () => {
    for (const value of [undefined, ""]) {
      expect(verifyUnlock({ value, secret: SECRET, now: NOW })).toEqual({
        ok: false,
        reason: "absent",
      });
    }
  });

  it("answers `no-secret` when the deployment cannot sign, whatever the value is", () => {
    for (const secret of [undefined, ""]) {
      expect(verifyUnlock({ value: unlockFor(DEMO_UNLOCK_TTL_MS), secret, now: NOW })).toEqual({
        ok: false,
        reason: "no-secret",
      });
    }
  });

  it("calls every other shape malformed rather than guessing", () => {
    const good = unlockFor(DEMO_UNLOCK_TTL_MS);
    const [version, expiry, signature] = good.split(".");
    const malformed = [
      "v1",
      "v1.",
      `v1.${expiry}`,
      `${good}.extra`,
      `v2.${expiry}.${signature}`,
      `v1.${expiry}.`,
      `v1.${expiry.toUpperCase()}.${signature}`,
      "not-a-cookie",
      "..",
    ];
    for (const value of malformed) {
      expect(verifyUnlock({ value, secret: SECRET, now: NOW })).toEqual({
        ok: false,
        reason: "malformed",
      });
    }
    expect(version).toBe("v1");
  });

  it("refuses a value with junk around the signature, whatever the reason is called", () => {
    const [version, expiry, signature] = unlockFor(DEMO_UNLOCK_TTL_MS).split(".");
    for (const junk of [`${signature} padded`, `${signature};semicolon`, `x${signature}`]) {
      const verdict = verifyUnlock({
        value: `${version}.${expiry}.${junk}`,
        secret: SECRET,
        now: NOW,
      });
      expect(verdict.ok).toBe(false);
    }
  });

  it("never carries a PIN, an address or a role", () => {
    const value = unlockFor(DEMO_UNLOCK_TTL_MS);
    for (const secret of ["1234", "initiator@demo.alignsynch.test", "admin"]) {
      expect(value.includes(secret)).toBe(false);
    }
  });
});

describe("the cookie's attributes", () => {
  it("is httpOnly, sameSite=lax, path=/ and expires with the payload", () => {
    expect(unlockCookieAttributes({ production: false })).toEqual({
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 900,
    });
  });

  it("is `secure` in a production deployment and only there", () => {
    expect(unlockCookieAttributes({ production: true }).secure).toBe(true);
    expect(unlockCookieAttributes({ production: false }).secure).toBe(false);
  });

  it("tracks a shortened ttl in maxAge, which is a courtesy and not the authority", () => {
    expect(unlockCookieAttributes({ production: false, ttlMs: 2000 }).maxAge).toBe(2);
    // The payload is what the server reads: a cookie the browser kept for an hour still fails.
    const short = signUnlock({ expiresAt: NOW + 2000, secret: SECRET });
    expect(verifyUnlock({ value: short, secret: SECRET, now: NOW + 2001 })).toEqual({
      ok: false,
      reason: "expired",
    });
  });
});
