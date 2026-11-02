/**
 * The forgot-password surfaces — three routes, one vocabulary.
 *
 *   /forgot-password    ask for a link (`request` band), and what the answer means
 *   /reset/[token]      spend a link (`form` band), and the three states a spent or stale one draws
 *   /reset/complete     the confirmation, at an address that carries no token
 *
 * One module for all three, like `data/pages/legal.ts`: the same person reads them in sequence, so
 * "Ask for a new link" has to mean the same thing on the refusal band and in the mail, and two
 * fixtures would let the two drift. `data/pages/index.ts` keys each route to the instance it
 * renders, so E23 still attributes each surface separately.
 *
 * ## The sentence that must not depend on the answer
 *
 * `outcome-sent` is one sentence for an address with an account and one without: "If that address
 * has an account…". It is the whole answer to the request, and it is deliberately the only place
 * the app says anything about whether a link went out. `outcome-throttled` and `outcome-invalid`
 * are properties of the *request*, so they are the same answer for both addresses too — a limiter
 * that only counted real accounts would answer "does this exist" by refusing differently.
 *
 * ## `outcome-unset`, and the one place the truth is uncomfortable
 *
 * A deployment with no `RESEND_*` cannot send, so it says so and shows the link
 * (`outcome-unset` + `link`), exactly as `lib/flow/email.ts` does for an invitation. On such a
 * deployment the *presence* of that link means the address has an account — the card requires both
 * "never reveal whether an address has an account" and "if `RESEND_*` is unset, show the link", and
 * they cannot both hold in that one state. The answer sentence is still identical; only the
 * no-mailer block differs, and it is the deployment's state showing through rather than a branch
 * on the address. On a deployment with a mailer nothing is shown and the bodies are byte-identical.
 *
 * ## The email band
 *
 * `lib/flow/email.ts` fills it (`{brand}`, `{minutes}`, `{link}`) the way it fills the invitation
 * band. It carries exactly one link and no name, no account id and no hint about the account's
 * other sign-in methods: a mail that says "your Google account" would be a fact about the person in
 * a mailbox that may not be theirs.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

/** `/forgot-password` — the ask, its five answers, and the message that leaves the building. */
export const resetRequestPageCopy: PageCopy = zPageCopy.parse({
  heading: "Forgot your password?",
  subtitle: "We'll email you a link. It works once, and it expires in {minutes} minutes.",
  sections: [
    {
      id: "request",
      heading: "Send a reset link",
      items: [
        { id: "email", label: "Email" },
        { id: "email-placeholder", label: "you@example.com" },
        { id: "submit", label: "Send reset link" },
        { id: "pending", label: "Sending…" },
        /**
         * The one answer to "did a link go out", and the same words for every address that was
         * asked about. `{minutes}` is the token's lifetime, filled from
         * `lib/auth/reset-token.ts` — never typed, so the sentence cannot outlive the constant.
         */
        {
          id: "outcome-sent",
          label:
            "If that address has an account, a reset link is on its way. It works once and expires in {minutes} minutes.",
        },
        /**
         * A deployment with no mail sender. It says what happened — nothing was sent — and offers
         * the link instead of pretending. `link` is the anchor's text.
         */
        {
          id: "outcome-unset",
          label:
            "This deployment has no mail sender, so no email was sent. If that address has an account, its link is right here.",
        },
        { id: "link", label: "Open the reset link" },
        /**
         * A send that was attempted and refused. No cause is guessed: a rate limit, an unverified
         * domain and a bad recipient look the same from here, and only the log line can tell them
         * apart (`lib/flow/email.ts`).
         */
        {
          id: "outcome-failed",
          label:
            "The reset email could not be sent. Nothing was delivered — try again in a moment.",
        },
        {
          id: "outcome-throttled",
          label: "Too many reset requests from here. Try again in an hour.",
        },
        { id: "outcome-invalid", label: "Enter an email address." },
        { id: "back", label: "Back to sign in" },
      ],
    },
    /**
     * The message. Subject and body are the fixture's, the values are the sender's: one link, the
     * brand's name and the lifetime in minutes. Nothing here names a provider or an account id.
     */
    {
      id: "email",
      items: [
        { id: "subject", label: "Set a new {brand} password" },
        {
          id: "body",
          label:
            "Someone asked to set a new password for the {brand} account with this address. If that was you, open this link within {minutes} minutes: {link}\n\nThe link works once. If it was not you, ignore this message — nothing has changed, and the link will expire on its own.",
        },
      ],
    },
  ],
});

/** `/reset/[token]` — the form, and every refusal a link can earn. */
export const resetFormPageCopy: PageCopy = zPageCopy.parse({
  heading: "Set a new password",
  subtitle: "You'll be signed out on every other device.",
  sections: [
    {
      id: "form",
      heading: "Choose a password",
      items: [
        { id: "password", label: "New password" },
        { id: "password-placeholder", label: "At least {min} characters" },
        { id: "confirm", label: "Confirm new password" },
        { id: "confirm-placeholder", label: "Type it again" },
        { id: "hint", label: "At least {min} characters. Up to {max}." },
        { id: "submit", label: "Set new password" },
        { id: "pending", label: "Saving…" },
        /**
         * The success sentence, drawn on the way to `/reset/complete` — and it says the thing the
         * card asks for out loud: a password change signs the other sessions out. It is a fact
         * (the store deleted those rows and reports the count), not a promise about the future.
         */
        {
          id: "outcome-set",
          label: "Your password is set. Every other device has been signed out.",
        },
        { id: "outcome-unknown", label: "This link is not one we issued. Ask for a new one." },
        { id: "outcome-expired", label: "This link has expired. Ask for a new one." },
        { id: "outcome-used", label: "This link has already been used. Ask for a new one." },
        { id: "outcome-short", label: "Use at least {min} characters." },
        { id: "outcome-long", label: "Use at most {max} characters." },
        { id: "outcome-mismatch", label: "The two passwords do not match." },
        { id: "outcome-unavailable", label: "We couldn't reach the server. Try again." },
        { id: "outcome-unauthorized", label: "Your session ended. Sign in again." },
        /** The bands drawn *instead of* the form when the link itself is no good. */
        { id: "state-unknown", label: "This link is not one we issued. Ask for a new one." },
        { id: "state-expired", label: "This link has expired. Ask for a new one." },
        { id: "state-used", label: "This link has already been used. Ask for a new one." },
        {
          id: "state-unavailable",
          label: "We couldn't check this link just now. Try again in a moment.",
        },
        { id: "request-new", label: "Ask for a new link" },
        { id: "back", label: "Back to sign in" },
      ],
    },
  ],
});

/** `/reset/complete` — the token-free address the form redirects to on success. */
export const resetCompletePageCopy: PageCopy = zPageCopy.parse({
  heading: "Password set",
  subtitle: "Use it the next time you sign in.",
  sections: [
    {
      id: "complete",
      heading: "You're done",
      items: [
        { id: "signed-out", label: "Every other device has been signed out." },
        { id: "sign-in", label: "Sign in" },
      ],
    },
  ],
});
