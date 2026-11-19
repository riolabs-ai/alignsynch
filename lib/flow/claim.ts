/**
 * The claim's refusals and its one confirmation (#202).
 *
 * A claim is the only write that binds a browser to a party, so every way it can be
 * refused is named here instead of being inferred from a redirect target. Three of the
 * six are properties of the *token* (`unknown`, `claimed`, `expired`) and three are
 * properties of the *request*:
 *
 *   already-a-party   the browser already answers as a party to this session — the
 *                     Initiator opening their own invitation link is the case QA found,
 *                     where the claim used to spend the token and silently move the
 *                     session into the Counterparty's column
 *   already-bound     the session already has both party rows
 *   unconfirmed       the post did not say out loud which party it is joining
 *
 * The screen shows both halves, because they are different sentences: a spent link and
 * "you are already the Initiator of this session" are not the same news.
 *
 * `confirmationMatches` is the server half of the confirmation. The page renders
 * `You are joining as Rowan, the Counterparty` beside a checkbox whose value is the
 * counterparty's name, so the post states who is being joined; a post that says
 * nothing, or names someone else, is refused and the token stays unspent. Comparing the
 * name rather than trusting a bare `true` is what makes the confirmation a statement
 * about *this* invitation instead of a click a form can replay.
 *
 * Pure: no `pg`, no clock, no React. `tests/flow-claim.test.ts` drives it.
 */

export const CLAIM_REFUSALS = [
  "unknown",
  "claimed",
  "expired",
  /** An operator revoked the link (#503). Terminal until somebody resends it. */
  "revoked",
  /**
   * #533 phase 3 — the membership that paid for this relationship ended (trial at day 14, a failed
   * payment, a cancellation). The link is not out of date and nobody revoked it: the product is not
   * being paid for, so the pair is read-only and the invitation stops claiming. A distinct code
   * because it needs a distinct sentence — "ask for a new link" is wrong advice here.
   */
  "lapsed",
  "already-a-party",
  "already-bound",
  "unconfirmed",
  /**
   * #1115 task 4 — the posted address is not the one the invitation was sent to. Two fields make
   * the address the claim's one new fact, and the seat binds to the account it names, so a claim
   * that names a different address is refused rather than silently binding a seat to a stranger.
   * Its own code because its sentence is its own: nothing is wrong with the link, and the fix is a
   * resend to the right address.
   */
  "email-mismatch",
] as const;

export type ClaimRefusal = (typeof CLAIM_REFUSALS)[number];

/**
 * The refusals the invitation's own state already draws — the four bands `previewInvite()`
 * picks between. A `?claim=` naming one of these adds no second sentence: the page's state
 * band is the same fact, and saying it twice is how a refusal starts contradicting itself.
 *
 * `revoked` is one of them for the same reason `expired` is: the link nobody can wear is a fact
 * the page already knows, not a second complaint about the click (#503).
 */
export const TOKEN_STATE_REFUSALS = ["unknown", "claimed", "expired", "revoked"] as const;

/** A `?claim=` query value → the refusal it names. Anything else is ignored, not rendered. */
export function claimRefusalOf(value: string | undefined): ClaimRefusal | undefined {
  return CLAIM_REFUSALS.find((code) => code === value);
}

/** Whether a `?claim=` code is one the token's own state band already explains. */
export function isTokenStateRefusal(code: ClaimRefusal): boolean {
  return (TOKEN_STATE_REFUSALS as readonly string[]).includes(code);
}

/**
 * The value the confirmation control posts: the party's name, exactly as the invitation
 * spells it. The page uses it as the checkbox's `value`, so the browser sends the name
 * and the store compares the two — one string, authored once, in the invite row.
 */
export function claimConfirmationValue(counterpartyName: string): string {
  return counterpartyName.trim();
}

/**
 * Whether a claim post confirms the party it is joining.
 *
 * `submitted` is what the form posted (the checkbox's value); `counterpartyName` is the
 * invitation's own name for that party. Both are trimmed — a name padded by a mail
 * client's autofill is the same person — and the comparison is otherwise exact: a
 * different name is a different party, which is the whole question the claim is asking.
 */
export function confirmationMatches(
  submitted: string | null | undefined,
  counterpartyName: string,
): boolean {
  if (submitted === null || submitted === undefined) return false;
  const given = submitted.trim();
  if (given === "") return false;
  return given === counterpartyName.trim();
}

/**
 * The address a claim posted, normalised — trimmed and lower-cased, because mail addresses are
 * case-insensitive in practice and a phone keyboard capitalises the first letter (#1115 task 4).
 *
 * `null` when nothing usable was posted. The claim refuses `email-mismatch` on that, rather than
 * treating an empty field as "any address": the seat binds to an account, and an account needs one.
 */
export function claimEmailOf(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed.toLowerCase();
}

/**
 * Whether a claim names the address the invitation was sent to (#1115 task 4).
 *
 * This is the *stronger* half of a two-field claim, and the reason the address is asked at all: the
 * link alone used to be the whole credential, and now the seat binds to an account — so a claim
 * that names a different address is somebody else's, whatever they hold. Case and padding do not
 * matter; the identity does.
 *
 * An invitation that carries **no** address (a seeded row, or a create that never collected one)
 * has no fact to disagree with, so any address is accepted: refusing there would block a seat that
 * nothing else protects, and the claim is only as strict as the row it reads.
 */
export function claimEmailMatches(
  submitted: string | null | undefined,
  invitationEmail: string | null | undefined,
): boolean {
  const given = claimEmailOf(submitted);
  if (given === null) return false;
  const invited = claimEmailOf(invitationEmail);
  if (invited === null) return true;
  return given === invited;
}
