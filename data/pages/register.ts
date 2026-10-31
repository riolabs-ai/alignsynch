/**
 * `/register` — the three-step sign-up flow's copy (WU-7, issue #54; brand-selected by
 * issue #225).
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
 *    view fills them. The step count is `STEPS.length`, never a `3` typed here: a
 *    fourth step must not need a copy edit.
 *
 * The interest options are the form's own six interests (`INTERESTS` in the view owns
 * the ids and icons, this file owns the words) — they are *not* `quizCategories`: these
 * are coarse onboarding buckets, and rendering the 25-subject taxonomy here would be a
 * different product decision.
 *
 * ## What a brand changes here, and what it may not (issue #225)
 *
 * The page's hero (`heading`/`subtitle`) and the mobile header's line are the brand's,
 * so the alignment build reads `hero-alignsynch` and `mobile-alignsynch` and
 * `lib/auth-copy.ts::registerCopyFor` swaps them in. The *wizard* is not copy: its three
 * steps, its six interests, its skill level, its date of birth and its phone number are
 * one product's onboarding, not words a skin can pick. They are still here, unchanged,
 * so the quiz build renders byte for byte what it shipped; the alignment build renders
 * them too, and replacing them is a product decision with its own card, not a fixture
 * edit made in passing. `docs`-visible inventory: the strings still carrying the quiz
 * vocabulary are `steps/step-1`, `interests/heading`, `skill/heading`, `skill/expert`
 * and `account/newsletter`.
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
          { id: "step-1", label: "Quiz Interests", value: "Tell us what you love" },
          { id: "step-2", label: "Personal Details", value: "Your basic information" },
          { id: "step-3", label: "Account Setup", value: "Secure your account" },
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
        id: "interests",
        heading: "What types of quizzes interest you? *",
        items: [
          { id: "general", label: "General Knowledge" },
          { id: "science", label: "Science & Technology" },
          { id: "history", label: "History & Geography" },
          { id: "sports", label: "Sports & Entertainment" },
          { id: "gaming", label: "Gaming & Pop Culture" },
          { id: "social", label: "Social & Current Events" },
        ],
      },
      {
        id: "skill",
        heading: "What's your quiz skill level? *",
        items: [
          { id: "placeholder", label: "Select your skill level" },
          { id: "beginner", label: "Beginner - Just getting started" },
          { id: "intermediate", label: "Intermediate - I know my way around" },
          { id: "advanced", label: "Advanced - Bring on the challenge!" },
          { id: "expert", label: "Expert - Quiz master level" },
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
          { id: "newsletter", label: "Subscribe to our newsletter for quiz updates and tips" },
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
