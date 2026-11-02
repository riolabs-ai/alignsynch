/**
 * The five outcomes a news submit can have — the vocabulary the route, the form and the fixture
 * share.
 *
 * A module of its own, with **no imports at all**, because it is the one piece of this feature
 * both sides of the boundary need: the route decides a state, the footer renders one, and the
 * footer's form is a `"use client"` module — `lib/news/signup.ts` cannot be imported there
 * because it reaches `lib/flow/resend.ts` → `lib/flow/tokens.ts` (node `crypto`), and a client
 * module that does that is E34's failure mode. So the list lives here, where a value import is
 * free, and `lib/news/signup.ts` re-exports it so the server half still reads as one module.
 *
 * Each state is a *state*, not an error, and each one has a sentence in
 * `data/pages/shell.ts`'s `footer-news` band:
 *
 *   subscribed          the row was written and the provider accepted the confirmation
 *   duplicate           the row was already there: nothing written, nothing sent, no error page
 *   stored-send-failed  the row **was** written; the confirmation was not sent, and the person
 *                       is still subscribed — reporting a failure here would be a lie that
 *                       invites a second submit for a subscription that already exists
 *   invalid             the address is not deliverable-shaped; nothing was attempted
 *   storage-failed      the write did not happen; nothing is claimed
 */
export const NEWS_SIGNUP_STATES = [
  "subscribed",
  "duplicate",
  "stored-send-failed",
  "invalid",
  "storage-failed",
] as const;

export type NewsSignupState = (typeof NEWS_SIGNUP_STATES)[number];

/** Anything that is not one of the five is `storage-failed`: the safe answer is "no claim". */
export function newsSignupStateOf(value: unknown): NewsSignupState {
  return NEWS_SIGNUP_STATES.find((state) => state === value) ?? "storage-failed";
}
