/**
 * The one refusal the auth server cannot name (issue #281, part 2 of 2).
 *
 * A person who created their account with Google has no password. Better Auth answers a
 * password sign-in with `INVALID_EMAIL_OR_PASSWORD` (401) for them exactly as it does for a
 * wrong password, for an address with no user and for a credential row with no hash — one code,
 * deliberately, so the endpoint cannot be used to discover accounts. The acceptance this file
 * pins is therefore about *two different sentences*:
 *
 *   1. a password account with a bad password still reads the ordinary rejection, which claims
 *      nothing about providers;
 *   2. an account that exists only through Google reads the cause-specific sentence, and it must
 *      not say the password is wrong — there is no password to be wrong.
 *
 * The decision is `lib/auth/provider-link.ts`, a pure derivation over the `neon_auth.account`
 * rows the server read (`lib/db/account-providers.ts`), so the rule that picks the sentence is
 * tested here without a database. The rows' SQL is not: that half is measured against the demo
 * branch and reported with the card.
 */
import { describe, expect, it } from "vitest";

import type { Brand } from "@/content/brand";
import { quizHubBrand } from "@/data/brand";
import { alignSynchBrand } from "@/data/brands/alignsynch";
import { loginCopy } from "@/data/pages/login";
import { loginCopyFor } from "@/lib/auth-copy";
import { AUTH_FAILURES, authFailureItemId } from "@/lib/auth/errors";
import {
  type AccountProviderRow,
  GOOGLE_PROVIDER_ID,
  isGoogleOnlyAccount,
  signInRefusalItemId,
} from "@/lib/auth/provider-link";
import { itemLabel, sectionOf } from "@/lib/page-copy";

/** A `neon_auth.account` row, as the read in `lib/db/account-providers.ts` reduces it. */
function row(providerId: string, hasPassword: boolean): AccountProviderRow {
  return { providerId, hasPassword };
}

const GOOGLE_ONLY = [row(GOOGLE_PROVIDER_ID, false)];
const PASSWORD = [row("credential", true)];

const quizHub = quizHubBrand as Brand;
const alignSynch = alignSynchBrand as Brand;

describe("isGoogleOnlyAccount", () => {
  it("names the Google-only account: every provider row is Google, none has a password", () => {
    expect(isGoogleOnlyAccount(GOOGLE_ONLY)).toBe(true);
    // Two Google rows (two linked Google identities) is still one Google-only account.
    expect(
      isGoogleOnlyAccount([row(GOOGLE_PROVIDER_ID, false), row(GOOGLE_PROVIDER_ID, false)]),
    ).toBe(true);
  });

  it("keeps the ordinary refusal for an account that has a password", () => {
    expect(isGoogleOnlyAccount(PASSWORD)).toBe(false);
    // A credential row with no hash is *not* a Google account: it exists, and it cannot sign in
    // with a password, but the app has no evidence anyone was ever told to use Google.
    expect(isGoogleOnlyAccount([row("credential", false)])).toBe(false);
    // Google *and* a password: the password is what did not match, so "use the Google button"
    // would be advice about a different door.
    expect(isGoogleOnlyAccount([...GOOGLE_ONLY, ...PASSWORD])).toBe(false);
  });

  it("never calls an absent account a Google account", () => {
    // No rows is no user (or no readable linkage): the auth server's own answer stands.
    expect(isGoogleOnlyAccount([])).toBe(false);
    // A third provider is not the Google case either, even with no password to check.
    expect(isGoogleOnlyAccount([row("github", false)])).toBe(false);
  });
});

describe("signInRefusalItemId", () => {
  it("gives the Google refusal its own item, and leaves the SDK's kinds alone", () => {
    expect(signInRefusalItemId("google-account")).toBe("error-google-account");
    for (const failure of AUTH_FAILURES) {
      expect(signInRefusalItemId(failure)).toBe(authFailureItemId(failure));
    }
    // The two rejections a password form can show must not collapse into one sentence: that
    // collapse is the defect the card exists to fix.
    expect(signInRefusalItemId("google-account")).not.toBe(
      signInRefusalItemId("invalid-credentials"),
    );
  });
});

describe("the two sentences on /login", () => {
  const card = (id: "quizhub" | "alignsynch", record: Brand) =>
    sectionOf(loginCopyFor(loginCopy(record), id), "sign-in");

  const brands = [
    ["quizhub", quizHub],
    ["alignsynch", alignSynch],
  ] as const;

  it("tells a Google-only account what the cause is, and points at the button", () => {
    for (const [id, record] of brands) {
      const sentence = itemLabel(card(id, record), signInRefusalItemId("google-account"));
      expect(sentence).toContain("This account uses Google sign-in");
      // The card's other half: the person is told which control to use instead.
      expect(sentence).toContain("Continue with Google");
      // And the sentence must not accuse the password — nobody can know it was wrong.
      expect(sentence).not.toMatch(/invalid|wrong|incorrect|password/i);
    }
  });

  it("keeps the ordinary rejection for a password account with a bad password", () => {
    for (const [id, record] of brands) {
      const sentence = itemLabel(card(id, record), signInRefusalItemId("invalid-credentials"));
      expect(sentence).toBe("Invalid email or password.");
      expect(sentence).not.toMatch(/google/i);
    }
  });

  it("has an item for every refusal the form can render", () => {
    // `unknown`, `network` and `origin` come from `authFailureOf`; `invalid-credentials` is the
    // one that triggers the provider lookup; `google-account` is its answer. `email-taken`,
    // `invalid-email` and `weak-password` belong to `/register` and are deliberately absent.
    const reachable = [
      "invalid-credentials",
      "origin",
      "network",
      "unknown",
      "google-account",
    ] as const;
    for (const [id, record] of brands) {
      const items = card(id, record).items ?? [];
      for (const refusal of reachable) {
        const wanted = signInRefusalItemId(refusal);
        expect(
          items.some((item) => item.id === wanted),
          `${wanted} on ${id}`,
        ).toBe(true);
        expect(itemLabel(card(id, record), wanted).length).toBeGreaterThan(0);
      }
    }
  });

  it("is the card's copy, not a skin's: both brands say the same thing", () => {
    expect(card("alignsynch", alignSynch).items).toEqual(card("quizhub", quizHub).items);
  });
});
