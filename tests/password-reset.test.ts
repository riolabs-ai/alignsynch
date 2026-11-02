/**
 * The forgot-password flow's policy, proved without a database, a clock or a mail provider.
 *
 * Everything here is a pure function in `lib/auth/reset-token.ts` (plus the message builder in
 * `lib/flow/email.ts` and the rate-limit key in `lib/auth/reset-request.ts`), which is deliberate:
 * the four claims this card is graded on — a token is single-use, expiring and well-formed; the
 * limiter is per address *and* per requester and counts before it looks; the password floor is the
 * auth server's own; and every outcome has a sentence in the fixture — are all decidable without a
 * live deployment.
 *
 * The one test that reads the fixture (`every mapped copy id exists`) is the join between this
 * module and `data/pages/password-reset.ts`: the views resolve those ids through these functions at
 * *runtime*, where a typo is a thrown error and a blank band, and E23 cannot see an id that comes
 * out of a function. So the mapping is walked here instead.
 */
import { describe, expect, it } from "vitest";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  RESET_ADDRESS_LIMIT,
  RESET_IP_LIMIT,
  RESET_TTL_MS,
  RESET_TOKEN_LENGTH,
  type ResetRequestOutcome,
  type ResetSetOutcome,
  type ResetTokenState,
  passwordProblem,
  rateRefusal,
  resetExpiry,
  resetRequestItemId,
  resetSetItemId,
  resetTokenIsWellFormed,
  resetTokenStateItemId,
  resetWindowStart,
} from "@/lib/auth/reset-token";
import { requesterHashOf } from "@/lib/auth/reset-request";
import { resetLink, resetMessage } from "@/lib/flow/email";
import {
  resetCompletePageCopy,
  resetFormPageCopy,
  resetRequestPageCopy,
} from "@/data/pages/password-reset";
import { brand } from "@/data/brand";
import type { PageCopy } from "@/content/pages";

/** A token of the shape `mintToken()` produces: 32 bytes of base64url. */
const TOKEN = `${"A".repeat(RESET_TOKEN_LENGTH - 4)}a-_9`;

/** Every section's item ids, so a mapped id can be checked against the fixture it renders from. */
function itemIds(copy: PageCopy): Set<string> {
  const ids = new Set<string>();
  for (const section of copy.sections ?? []) {
    for (const item of section.items ?? []) ids.add(item.id);
  }
  return ids;
}

describe("the token", () => {
  it("accepts the shape mintToken produces and refuses everything else", () => {
    expect(resetTokenIsWellFormed(TOKEN)).toBe(true);
    // A short slug never costs a query.
    expect(resetTokenIsWellFormed("abc")).toBe(false);
    expect(resetTokenIsWellFormed("")).toBe(false);
    // One character short, one too many.
    expect(resetTokenIsWellFormed(TOKEN.slice(1))).toBe(false);
    expect(resetTokenIsWellFormed(`${TOKEN}x`)).toBe(false);
    // Base64url's alphabet, and only it: no padding, no plus, no slash, no whitespace.
    expect(resetTokenIsWellFormed(`${TOKEN.slice(0, -1)}=`)).toBe(false);
    expect(resetTokenIsWellFormed(`${TOKEN.slice(0, -1)}+`)).toBe(false);
    expect(resetTokenIsWellFormed(`${TOKEN.slice(0, -1)}/`)).toBe(false);
    expect(resetTokenIsWellFormed(`${TOKEN.slice(0, -1)} `)).toBe(false);
  });

  it("expires an hour after it was minted, and the window is an hour wide", () => {
    const now = new Date("2026-11-01T12:00:00.000Z");
    expect(resetExpiry(now).toISOString()).toBe("2026-11-01T13:00:00.000Z");
    expect(resetExpiry(now).getTime() - now.getTime()).toBe(RESET_TTL_MS);
    // The limiter's window is the same hour, counted backwards.
    expect(resetWindowStart(now).toISOString()).toBe("2026-11-01T11:00:00.000Z");
  });
});

describe("the password floor", () => {
  it("is the auth server's own: eight characters, and 128 at the top", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8);
    expect(PASSWORD_MAX_LENGTH).toBe(128);
    expect(passwordProblem("1234567", "1234567")).toBe("short");
    expect(passwordProblem("12345678", "12345678")).toBeNull();
    expect(
      passwordProblem("x".repeat(PASSWORD_MAX_LENGTH), "x".repeat(PASSWORD_MAX_LENGTH)),
    ).toBeNull();
    expect(
      passwordProblem("x".repeat(PASSWORD_MAX_LENGTH + 1), "x".repeat(PASSWORD_MAX_LENGTH + 1)),
    ).toBe("long");
  });

  it("reports a length problem before a mismatch, and compares exactly", () => {
    // Both wrong: the length sentence is the one that still applies after the confirmation is fixed.
    expect(passwordProblem("abc", "abd")).toBe("short");
    expect(passwordProblem("abcdefgh", "abcdefgi")).toBe("mismatch");
    // No trimming: a password with a trailing space is a password with a trailing space.
    expect(passwordProblem("abcdefgh ", "abcdefgh")).toBe("mismatch");
  });
});

describe("the limiter", () => {
  it("counts per address first, then per requester", () => {
    expect(rateRefusal({ byAddress: 0, byRequester: 0 })).toBeNull();
    expect(rateRefusal({ byAddress: RESET_ADDRESS_LIMIT - 1, byRequester: 0 })).toBeNull();
    expect(rateRefusal({ byAddress: RESET_ADDRESS_LIMIT, byRequester: 0 })).toBe("address");
    expect(rateRefusal({ byAddress: 0, byRequester: RESET_IP_LIMIT - 1 })).toBeNull();
    expect(rateRefusal({ byAddress: 0, byRequester: RESET_IP_LIMIT })).toBe("ip");
    // Both spent: the narrower cap is the one a person is told about, because it is the one that
    // will clear first for an ordinary reader.
    expect(rateRefusal({ byAddress: RESET_ADDRESS_LIMIT, byRequester: RESET_IP_LIMIT })).toBe(
      "address",
    );
  });

  it("keys a requester by a digest that is not the address", () => {
    const hash = requesterHashOf("203.0.113.7");
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain("203.0.113.7");
    // Stable for the same input, different for a different one.
    expect(requesterHashOf("203.0.113.7")).toBe(hash);
    expect(requesterHashOf("203.0.113.8")).not.toBe(hash);
  });
});

describe("the outcomes have sentences", () => {
  it("maps every request outcome to an id the fixture carries", () => {
    const ids = itemIds(resetRequestPageCopy);
    const kinds: ResetRequestOutcome["kind"][] = [
      "sent",
      "unset",
      "failed",
      "throttled",
      "invalid-address",
    ];
    for (const kind of kinds) expect(ids.has(resetRequestItemId(kind))).toBe(true);
    // One id per outcome: two outcomes sharing a sentence is how a refusal starts lying.
    expect(new Set(kinds.map(resetRequestItemId)).size).toBe(kinds.length);
  });

  it("maps every set-password refusal to an id the form fixture carries", () => {
    const ids = itemIds(resetFormPageCopy);
    const kinds: Exclude<ResetSetOutcome["kind"], "set">[] = [
      "unknown",
      "expired",
      "used",
      "short",
      "long",
      "mismatch",
      "unavailable",
      "unauthorized",
    ];
    for (const kind of kinds) expect(ids.has(resetSetItemId(kind))).toBe(true);
    expect(new Set(kinds.map(resetSetItemId)).size).toBe(kinds.length);
  });

  it("maps every link state to an id the form fixture carries", () => {
    const ids = itemIds(resetFormPageCopy);
    const states: Exclude<ResetTokenState, "valid">[] = [
      "unknown",
      "expired",
      "used",
      "unavailable",
    ];
    for (const state of states) expect(ids.has(resetTokenStateItemId(state))).toBe(true);
    expect(new Set(states.map(resetTokenStateItemId)).size).toBe(states.length);
  });

  it("keeps the success band's two facts in the complete fixture", () => {
    const ids = itemIds(resetCompletePageCopy);
    expect(ids.has("signed-out")).toBe(true);
    expect(ids.has("sign-in")).toBe(true);
    // The card's fifth requirement, stated in the words a person reads.
    const signedOut = resetCompletePageCopy.sections
      ?.flatMap((section) => section.items ?? [])
      .find((item) => item.id === "signed-out");
    expect(signedOut?.label.toLowerCase()).toContain("signed out");
  });
});

describe("the message", () => {
  it("carries the link once, the brand and the lifetime — and says nothing about the account", () => {
    const message = resetMessage({
      to: "avery@example.com",
      token: TOKEN,
      base: "https://app.test",
    });
    const link = `https://app.test/reset/${TOKEN}`;

    expect(message.link).toBe(link);
    expect(resetLink(TOKEN, "https://app.test")).toBe(link);
    // A trailing slash on the base must not become a double slash in the path.
    expect(resetLink(TOKEN, "https://app.test/")).toBe(link);

    expect(message.subject).toContain(brand.name);
    expect(message.text).toContain(link);
    expect(message.text).toContain("60");
    // Exactly one occurrence: a second copy of a bearer credential in one message is a second
    // place it can be forwarded from.
    expect(message.text.split(link)).toHaveLength(2);

    // Never a fact about how the account signs in otherwise, and never a name or an id.
    const body = `${message.subject} ${message.text}`.toLowerCase();
    expect(body).not.toContain("google");
    expect(body).not.toContain("avery");
    expect(body).not.toContain("password set for");
  });

  it("puts the token in the path, never in a query string", () => {
    const link = resetLink(TOKEN, "https://app.test");
    expect(link).not.toContain("?");
    expect(new URL(link).pathname).toBe(`/reset/${TOKEN}`);
    expect(new URL(link).search).toBe("");
  });
});
