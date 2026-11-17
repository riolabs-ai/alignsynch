/**
 * The two fields the Counterparty types on **step 2 (Join)**, held until **step 3 (Accept)** posts
 * them (#1125).
 *
 * **Why a carrier exists at all.** The v2 bundle draws the join as three steps — `Invite`, `Join`,
 * `Accept` — with exactly one primary action each, and the two fields belong to step 2. The claim
 * itself, though, is a single write (`lib/flow/store.ts::claimInvite`) that wants the name and the
 * address *in the posting request*: it binds the seat to the account the address names and refuses a
 * post that does not confirm the party. Three steps, one claim, means the values typed on step 2
 * have to survive one navigation — and a GET after a GET cannot carry them:
 *
 *   a query string   puts somebody's email address in the URL bar, the history, the server log and
 *                    the `Referer` of the next request. That is a leak, not a carrier.
 *   a hidden field   works only inside one form. Step 2 and step 3 are two renders of one page.
 *   a cookie         the one thing already carrying this flow's own facts across requests
 *                    (`flow_party_*`, `flow_draft_*`, `flow_plan_intent`).
 *
 * So the values ride a cookie scoped to the invitation, `httpOnly` because only a server read needs
 * them, and short-lived because they are unfinished typing rather than a record.
 *
 * **Nothing here is trusted.** The cookie is not signed, and it does not need to be: the claim
 * re-derives every fact it uses. The address is compared against `session_invite.email`
 * (`claimEmailMatches` — `email-mismatch` refuses any other) and the name against the invitation's
 * own `counterparty_name` (`confirmationMatches` — `unconfirmed` refuses any other). A tampered
 * cookie can therefore only propose values the store itself would have rejected from a form, so
 * signing it would add a key without adding a check.
 *
 * **Keyed by token, like every other flow cookie is keyed by what it belongs to.** A person with
 * two invitations open in two tabs must not have one tab's step 2 fill the other's step 3.
 *
 * Pure: no `next/headers`, no clock, no React — the route that writes it and the page that reads it
 * share this one implementation, and the tests drive it as a function.
 */
import { z } from "zod";

/** The cookie's own name prefix; the invitation's token hash is appended. */
export const JOIN_DETAILS_COOKIE_PREFIX = "flow_join_";

/**
 * Thirty minutes, which is the claim page's own sitting.
 *
 * Long enough for a person to create an account, be bounced through a mail-verification screen and
 * come back; short enough that an abandoned half-typed claim is not still sitting in a browser
 * tomorrow. It is deliberately **not** the draft's day: nothing here is recoverable work, and the
 * invitation itself is the longer-lived thing.
 */
export const JOIN_DETAILS_COOKIE_MAX_AGE = 30 * 60;

/**
 * The name and the address, exactly as typed — trimmed, and the address lower-cased.
 *
 * The lower-casing is `claimEmailOf()`'s rule, applied once here so the value that comes back out of
 * the cookie is the value the claim would have normalised anyway: a phone keyboard that capitalises
 * the first letter of an address is not a different person.
 */
export interface JoinDetails {
  readonly name: string;
  readonly email: string;
}

const zJoinDetails = z
  .object({
    name: z.string().min(1),
    email: z.string().min(1),
  })
  .strict();

/**
 * The cookie's name for one invitation.
 *
 * The token is hashed rather than embedded: a cookie name is visible to script on the page, and the
 * raw token is the claim's credential. `hash` is the caller's own hasher (`hashToken` in
 * `lib/flow/store.ts`) so this module stays free of `node:crypto` — a page that reads the jar is a
 * server module either way, but a unit test should not need a crypto stub to name a cookie.
 */
export function joinDetailsCookieName(tokenHash: string): string {
  return `${JOIN_DETAILS_COOKIE_PREFIX}${tokenHash}`;
}

/** `base64url` JSON — the encoding `lib/flow/plan-intent.ts` and the draft already use. */
export function encodeJoinDetails(details: JoinDetails): string {
  return Buffer.from(JSON.stringify(details), "utf8").toString("base64url");
}

/**
 * The details a cookie value carries, or `null` when it carries none this module would trust.
 *
 * `null` for anything that is not the documented shape — an absent cookie, a value a previous
 * version of this module wrote, a hand-edited string. A step 3 that gets `null` sends the reader back
 * to step 2 rather than rendering a form whose submit the store is certain to refuse.
 */
export function decodeJoinDetails(value: string | undefined): JoinDetails | null {
  if (value === undefined || value === "") return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  const details = zJoinDetails.safeParse(parsed);
  if (!details.success) return null;
  const name = details.data.name.trim();
  const email = details.data.email.trim().toLowerCase();
  return name === "" || email === "" ? null : { name, email };
}

/** Why a step-2 submit was not carried: nothing typed, or an address that is not one. */
export const JOIN_DETAIL_PROBLEMS = ["incomplete", "email"] as const;

export type JoinDetailProblem = (typeof JOIN_DETAIL_PROBLEMS)[number];

/**
 * What a step-2 submit is missing, or `null` when it has both fields.
 *
 * Two problems and not one, because they are two sentences: an empty pair is "you have not told us
 * who you are", and a filled pair with a malformed address is "that address will not reach you".
 *
 * The shape check is deliberately **not** a full RFC 5322 grammar — no form on the internet has one,
 * and a stricter pattern rejects real addresses. It asks for the one thing the claim needs: an `@`
 * with something on both sides and a dot in the domain, which is what makes `name@example` a typo
 * worth catching before the store refuses it as somebody else's invitation.
 */
export function joinDetailProblem(rawName: unknown, rawEmail: unknown): JoinDetailProblem | null {
  const name = typeof rawName === "string" ? rawName.trim() : "";
  const email = typeof rawEmail === "string" ? rawEmail.trim() : "";
  if (name === "" || email === "") return "incomplete";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? null : "email";
}

/** A `?join=` value → the problem it names. Anything else is ignored, not rendered. */
export function joinDetailProblemOf(value: string | undefined): JoinDetailProblem | undefined {
  return JOIN_DETAIL_PROBLEMS.find((code) => code === value);
}
