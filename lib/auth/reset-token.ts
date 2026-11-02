/**
 * The forgot-password flow's policy — the half that is a pure function.
 *
 * Five decisions live here, and none of them needs a database, a clock or a mail provider, so
 * each is a case in `tests/password-reset.test.ts` rather than something a screenshot has to
 * demonstrate:
 *
 *   the token       32 bytes of base64url (43 characters) minted by `lib/flow/tokens.ts`, and the
 *                   shape check that lets a malformed path segment be refused before it costs a
 *                   query. A token is a bearer credential: single use, one hour.
 *   the expiry      an hour. Long enough to find the mail on a phone, short enough that a link
 *                   in a mailbox somebody no longer controls is not a permanent second key.
 *   the limiter     three per address and ten per requester per hour. Both are counted from the
 *                   same table that records the requests, which is why an unknown address is
 *                   still written down — a counter that only counted real accounts would answer
 *                   "does this address exist" by behaving differently for it.
 *   the password    eight characters minimum, which is the auth server's own floor
 *                   (`assertPasswordNotTooShort` in better-auth's reset route) and not a
 *                   number invented here; 128 is its ceiling. A form that allowed less would
 *                   collect a password the server refuses.
 *   the words       every outcome maps to one copy id, so a sentence cannot be typed into a
 *                   component (E23's rule) and a new outcome cannot ship without a fixture row.
 *
 * **This module is imported by client components**, so it holds nothing runtime-specific: no
 * `node:crypto`, no `pg`, no `next/headers`. The token is *minted* and *hashed* on the server by
 * the store and the provider; this file only knows what a token looks like.
 */

/** How long a reset link stays usable. The provider's own grant is minted per use and shorter. */
export const RESET_TTL_MINUTES = 60;

/** The same hour, in the unit every comparison here uses. */
export const RESET_TTL_MS = RESET_TTL_MINUTES * 60 * 1000;

/** The window both limiters count over. */
export const RESET_WINDOW_MS = 60 * 60 * 1000;

/**
 * Requests one address may make in the window.
 *
 * Three, because the honest reasons to ask again are "it did not arrive", "it expired" and "I
 * asked for the wrong address the first time" — and a fourth ask is either a person who needs a
 * different route in (support) or a script. The number is per *address string*, whether or not an
 * account has it, so it cannot be used to tell the two apart.
 */
export const RESET_ADDRESS_LIMIT = 3;

/**
 * Requests one client may make in the window, across every address.
 *
 * Ten: a shared office or a phone on a carrier NAT is one requester for many people, so this is
 * deliberately looser than the per-address cap — it exists to bound a script, not to police a
 * household. `requester_hash` is the key; the address itself is never stored.
 */
export const RESET_IP_LIMIT = 10;

/** `mintToken()` in `lib/flow/tokens.ts` always produces exactly this many base64url characters. */
export const RESET_TOKEN_LENGTH = 43;

/**
 * Better Auth's floor for a new password, read from its own reset route
 * (`assertPasswordNotTooShort` — `api/routes/password.mjs` in `better-auth@1.7.6`, which the
 * hosted server runs). Below this the provider answers `PASSWORD_TOO_SHORT`, so the form refuses
 * it first and says why.
 */
export const PASSWORD_MIN_LENGTH = 8;

/** The provider's ceiling (`assertPasswordNotTooLong`). */
export const PASSWORD_MAX_LENGTH = 128;

/**
 * Whether a path segment could be a token at all.
 *
 * A path is attacker-controlled and the store's lookup is an equality on the hash, so a
 * three-character slug is refused here and never becomes a query. The pattern is the shape
 * `mintToken()` produces: base64url, 43 characters, no padding.
 */
export function resetTokenIsWellFormed(token: string): boolean {
  return new RegExp(`^[A-Za-z0-9_-]{${RESET_TOKEN_LENGTH}}$`).test(token);
}

/** The instant a token minted at `now` stops being usable. */
export function resetExpiry(now: Date): Date {
  return new Date(now.getTime() + RESET_TTL_MS);
}

/** The oldest request the limiters still count, for a request arriving at `now`. */
export function resetWindowStart(now: Date): Date {
  return new Date(now.getTime() - RESET_WINDOW_MS);
}

/**
 * What is wrong with the password the form posted, or `null` when nothing is.
 *
 * `mismatch` is checked last so the two length sentences win: a nine-character password typed
 * twice differently and a four-character one typed twice identically are different mistakes, and
 * the second one would still be refused after the confirmation was fixed.
 *
 * The comparison is exact — no trimming. A password is a sequence of characters, and a form that
 * silently ate a trailing space would set a password the person cannot type again.
 */
export type PasswordProblem = "short" | "long" | "mismatch";

export function passwordProblem(password: string, confirmation: string): PasswordProblem | null {
  if (password.length < PASSWORD_MIN_LENGTH) return "short";
  if (password.length > PASSWORD_MAX_LENGTH) return "long";
  if (password !== confirmation) return "mismatch";
  return null;
}

/**
 * Whether one more request may be made, and which cap stopped it.
 *
 * `address` is checked first: it is the narrower cap and the one a person can act on ("try again
 * later"), while `ip` is the one that stops a script walking a list of addresses.
 */
export type RateRefusal = "address" | "ip";

export function rateRefusal(counts: {
  readonly byAddress: number;
  readonly byRequester: number;
}): RateRefusal | null {
  if (counts.byAddress >= RESET_ADDRESS_LIMIT) return "address";
  if (counts.byRequester >= RESET_IP_LIMIT) return "ip";
  return null;
}

/**
 * What a `/forgot-password` post did.
 *
 * `sent` and `unset` are separate outcomes for the reason `lib/flow/email.ts` gives about the
 * invitation: one is a message on its way, the other is a deployment with no mail sender, and
 * collapsing them is how a page starts claiming an email that never left. `unset` therefore
 * carries the link, which the page shows — the honest alternative to a lie.
 *
 * `throttled` and `invalid-address` are properties of the *request*, so they are the same answer
 * for an address with an account and one without: nothing about the outcome depends on which it
 * was, except `unset`'s link, which is the deployment's state showing through.
 */
export type ResetRequestOutcome =
  | { readonly kind: "sent" }
  | { readonly kind: "unset"; readonly link: string }
  | { readonly kind: "failed" }
  | { readonly kind: "throttled" }
  | { readonly kind: "invalid-address" };

/** What a `/reset/[token]` post did. The three token refusals are separate sentences. */
export type ResetSetOutcome =
  | {
      readonly kind: "set";
      /**
       * How many sessions were signed out. Rendered as a number rather than promised as "all", so
       * the success screen states a fact the store measured.
       */
      readonly revoked?: number;
    }
  | { readonly kind: "unknown" }
  | { readonly kind: "expired" }
  | { readonly kind: "used" }
  | { readonly kind: "short" }
  | { readonly kind: "long" }
  | { readonly kind: "mismatch" }
  | { readonly kind: "unavailable" }
  /**
   * The signed-in card's own refusal: the session ended between rendering the form and posting it.
   * Never produced by the token path (there is no session there to lose), and it is a distinct
   * kind because "sign in again" is different advice from "try again".
   */
  | { readonly kind: "unauthorized" };

/** What a reset link looked like when the page was opened, before anything was posted. */
export type ResetTokenState = "valid" | "unknown" | "expired" | "used" | "unavailable";

/**
 * The copy item each request outcome renders.
 *
 * One id per outcome, resolved by `itemLabel(sectionOf(copy, "request"), …)` in the view — so the
 * sentence is the fixture's and a new outcome is a red build (E23 resolves the id) rather than a
 * blank band.
 */
export function resetRequestItemId(kind: ResetRequestOutcome["kind"]): string {
  switch (kind) {
    case "sent":
      return "outcome-sent";
    case "unset":
      return "outcome-unset";
    case "failed":
      return "outcome-failed";
    case "throttled":
      return "outcome-throttled";
    case "invalid-address":
      return "outcome-invalid";
  }
}

/** The copy item a set-password refusal renders (`data/pages/password-reset.ts`'s `form` band). */
export function resetSetItemId(kind: Exclude<ResetSetOutcome["kind"], "set">): string {
  switch (kind) {
    case "unknown":
      return "outcome-unknown";
    case "expired":
      return "outcome-expired";
    case "used":
      return "outcome-used";
    case "short":
      return "outcome-short";
    case "long":
      return "outcome-long";
    case "mismatch":
      return "outcome-mismatch";
    case "unavailable":
      return "outcome-unavailable";
    case "unauthorized":
      return "outcome-unauthorized";
  }
}

/**
 * The copy item a link's own state renders when the page is opened.
 *
 * `valid` is the form itself, which needs no sentence of its own; the other three are bands the
 * page draws instead of the form.
 */
export function resetTokenStateItemId(state: Exclude<ResetTokenState, "valid">): string {
  switch (state) {
    case "unknown":
      return "state-unknown";
    case "expired":
      return "state-expired";
    case "used":
      return "state-used";
    case "unavailable":
      return "state-unavailable";
  }
}
