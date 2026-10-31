/**
 * `/register` — the two-step sign-up flow's copy (WU-7, issue #54; brand-selected by
 * issue #225; the quiz step removed by issue #291).
 *
 * Same split as `/login`: `app/(auth)/register/page.tsx` parses this fixture and
 * `components/auth/register-view.tsx` is the client component that renders it, so the
 * schema stays out of the browser bundle.
 *
 * Two shapes worth knowing:
 *
 *  - a **step** is one item with its title as `label` and its one-line description as
 *    `value` — the same value-over-caption pair a stat uses, because the progress rail
 *    and the card header both render the two together;
 *  - `progress` spells the counter as placeholders (`Step {step} of {total}`) and the
 *    view fills them. The step count is `STEPS.length`, never a `2` typed here: a
 *    third step must not need a copy edit.
 *
 * ## What a brand changes here, and what it may not (issue #225)
 *
 * The page's hero (`heading`/`subtitle`) and the mobile header's line are the brand's,
 * so the alignment build reads `hero-alignsynch` and `mobile-alignsynch` and
 * `lib/auth-copy.ts::registerCopyFor` swaps them in. The *form* is not copy a skin
 * picks: its two steps, its fields and its error states are one product's sign-up, not
 * words a skin can choose. They are shared, so both brands submit the same form.
 *
 * ## Two steps, not three (issue #291)
 *
 * The flow used to open on a first step — six quiz-topic buckets to tick, plus a select for
 * self-rated quiz ability — that both brands rendered. `register-view.tsx` kept those values
 * in local state and sends only the name, email and password to Neon Auth, so the step asked
 * every visitor for work nothing reads, and on the alignment build it asked about a product
 * they had not come to use. The step is removed, and with it the newsletter opt-in line, for
 * a newsletter that has never existed. What is left is the form the app actually submits:
 * personal details, then the account.
 *
 * The phone number and date of birth in `details` are still collected and still unread.
 * That is a separate defect (the form's own validation, not the quiz vocabulary this card
 * removed), so this table describes the form as it stands rather than claiming every
 * field is used.
 */
import type { Brand } from "../../content/brand";
import { zPageCopy, type PageCopy } from "../../content/pages";
import { brand } from "../brand";

export function registerCopy(record: Pick<Brand, "name">): PageCopy {
  return zPageCopy.parse({
    heading: "Join the Quiz Revolution",
    subtitle: "Discover your potential, challenge your friends, and become a quiz champion",
    sections: [
      /**
       * The alignment build's hero: the heading and the sentence under it, together,
       * because a hero is one thought. `registerCopyFor` puts them where the page-level
       * `heading`/`subtitle` sit, so the illustration panel is one shape on both brands.
       */
      {
        id: "hero-alignsynch",
        heading: "The same questions, answered by both of you",
        body: "Create an account, then invite the person you want to align with. You both answer the same questions, and the distance between your answers is the Gap.",
      },
      {
        id: "mobile",
        heading: `Join ${record.name}`,
        body: "Create your account and start your quiz adventure",
      },
      /** The mobile header's line for the alignment build (`registerCopyFor` merges it). */
      {
        id: "mobile-alignsynch",
        body: "Create your account, then invite the person you want to align with.",
      },
      {
        id: "steps",
        items: [
          { id: "step-1", label: "Personal Details", value: "Your basic information" },
          { id: "step-2", label: "Account Setup", value: "Secure your account" },
        ],
      },
      {
        id: "progress",
        items: [{ id: "label", label: "Step {step} of {total}" }],
      },
      {
        id: "status",
        items: [
          { id: "pending", label: "Creating your account…" },
          {
            id: "error-email-taken",
            label: "An account already uses this email. Sign in instead.",
          },
          { id: "error-invalid-email", label: "That email address doesn't look right." },
          { id: "error-weak-password", label: "Choose a password with at least 8 characters." },
          { id: "error-network", label: "Couldn't reach the server. Check your connection." },
          {
            id: "error-origin",
            label:
              "This site's address isn't authorised to sign in. Open the app at the address it was set up for.",
          },
          { id: "error-unknown", label: "Something went wrong. Try again." },
          { id: "error-required", label: "Fill in the required fields." },
        ],
      },
      {
        id: "details",
        items: [
          { id: "first-name", label: "First Name *" },
          { id: "first-name-placeholder", label: "John" },
          { id: "last-name", label: "Last Name *" },
          { id: "last-name-placeholder", label: "Smith" },
          { id: "email", label: "Email *" },
          { id: "email-placeholder", label: "john@example.com" },
          { id: "phone", label: "Phone Number *" },
          { id: "phone-placeholder", label: "+1 (555) 123-4567" },
          { id: "date-of-birth", label: "Date of Birth" },
          { id: "country", label: "Country" },
          { id: "country-placeholder", label: "Select country" },
          { id: "country-us", label: "United States" },
          { id: "country-uk", label: "United Kingdom" },
          { id: "country-ca", label: "Canada" },
          { id: "country-au", label: "Australia" },
          { id: "country-de", label: "Germany" },
          { id: "country-fr", label: "France" },
          { id: "country-other", label: "Other" },
        ],
      },
      {
        id: "account",
        items: [
          { id: "password", label: "Password *" },
          { id: "password-placeholder", label: "Create a strong password" },
          { id: "password-hint", label: "Password must be at least 8 characters long" },
          { id: "confirm-password", label: "Confirm Password *" },
          { id: "confirm-placeholder", label: "Confirm your password" },
          { id: "mismatch", label: "Passwords do not match" },
          { id: "agree-prefix", label: "I agree to the" },
          { id: "agree-terms", label: "Terms of Service" },
          { id: "agree-and", label: "and" },
          { id: "agree-privacy", label: "Privacy Policy" },
        ],
      },
      {
        id: "navigation",
        items: [
          { id: "back-to-login", label: "Back to Login" },
          { id: "back", label: "Back" },
          { id: "next", label: "Next" },
          { id: "create-account", label: "Create Account" },
        ],
      },
    ],
  });
}

/** The instance the build ships: this fixture, for the brand `BRAND` selected. */
export const registerPageCopy: PageCopy = registerCopy(brand);
