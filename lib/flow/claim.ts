/**
 * The claim's refusals and its one confirmation (#202).
 *
 * A claim is the only write that binds a browser to a party, so every way it can be
 * refused is named here instead of being inferred from a redirect target. Three of the
 * six are properties of the *token* (`unknown`, `claimed`, `expired`) and three are
 * properties of the *request*:
 *
 *   already-a-party   the browser already answers as a party to this instance — the
 *                     Initiator opening their own invitation link is the case QA found,
 *                     where the claim used to spend the token and silently move the
 *                     session into the Counterparty's column
 *   already-bound     the instance already has both party rows
 *   unconfirmed       the post did not say out loud which party it is joining
 *
 * The screen shows both halves, because they are different sentences: a spent link and
 * "you are already the Initiator of this instance" are not the same news.
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
  "already-a-party",
  "already-bound",
  "unconfirmed",
] as const;

export type ClaimRefusal = (typeof CLAIM_REFUSALS)[number];

/**
 * The refusals the invitation's own state already draws — the four bands `previewInvite()`
 * picks between. A `?claim=` naming one of these adds no second sentence: the page's state
 * band is the same fact, and saying it twice is how a refusal starts contradicting itself.
 */
export const TOKEN_STATE_REFUSALS = ["unknown", "claimed", "expired"] as const;

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
