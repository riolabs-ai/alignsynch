/**
 * Template #9 — the signup confirmation (#548, band v0.9). **The one marketing mail of the ten.**
 *
 * **Why its class matters more than its words.** This is the only template in this pass that
 * answers a form somebody filled in to hear from the product, so it is the only one a person may
 * leave — and the band's class rule is what makes that structural: a `marketing` render *must*
 * carry an unsubscribe URL and refuses to render without one, while a `transactional` render
 * refuses to carry one at all (`lib/email/band.ts`). A template whose class is wrong is therefore
 * a throw at render time, not a footer nobody notices.
 *
 * **The address is the row's, and it is the only one.** `lib/news/signup.ts` lower-cases and
 * shape-checks the address before anything is written (`0019_news_signup.sql` pins the column to
 * lower case), so the string this body prints is the string the row holds, normalised by the same
 * function the mailer addresses. Nothing here re-derives it.
 *
 * **No link of its own.** The confirmation asks for nothing: the list writes to the person, and
 * the only address in the mail is the unsubscribe line the band appends below the footer. That is
 * asserted, not assumed — `tests/email-templates.test.ts` requires an empty content-link list for
 * this template and the unsubscribe line beside it.
 *
 * **Nothing is invented.** No frequency promise, no send date, no "exclusive" claim and no
 * preview of what the list will say: the facts are the address that was written down and the way
 * out that every message from this list carries. Marketing, so the band's footer carries the
 * unsubscribe line — and its absence would be a defect, which is why the band throws. The opening
 * line is this template's section in `content/email-bodies.md`, which carries a `TODO(owner)`:
 * nothing in the tree says what this list sends or how often.
 */
import type { EmailDocument } from "@/lib/email/band";
import { bodyBlocks, type EmailBodySpec } from "@/lib/email/body";

/** This template's section in `content/email-bodies.md`, and the facts it may say. */
export const SIGNUP_CONFIRMATION_BODY = {
  id: "signup-confirmation",
  placeholders: ["address"],
} as const satisfies EmailBodySpec;

/** The spec's subject, as a constant: it confirms the form, not a campaign. */
export const SIGNUP_CONFIRMATION_SUBJECT = "You're on the list";

export interface SignupConfirmationFacts {
  /** The address `news_signup` stores — already normalised by `lib/news/signup.ts`. */
  readonly address: string;
}

export function signupConfirmationDocument(facts: SignupConfirmationFacts): EmailDocument {
  return {
    subject: SIGNUP_CONFIRMATION_SUBJECT,
    preheader: `The list holds ${facts.address}.`,
    blocks: [
      ...bodyBlocks(SIGNUP_CONFIRMATION_BODY, { address: facts.address }),
      { kind: "paragraph", text: `The address on the list is ${facts.address}.` },
      {
        kind: "paragraph",
        text: "Every message from this list carries the way out at the bottom, and this one is no different.",
      },
    ],
  };
}
