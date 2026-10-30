/**
 * `/register` — the three-step sign-up flow's copy (WU-7, issue #54).
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
 */
import { brand } from "../brand";
import { zPageCopy, type PageCopy } from "../../content/pages";

export const registerPageCopy: PageCopy = zPageCopy.parse({
  heading: "Join the Quiz Revolution",
  subtitle: "Discover your potential, challenge your friends, and become a quiz champion",
  sections: [
    {
      id: "mobile",
      heading: `Join ${brand.name}`,
      body: "Create your account and start your quiz adventure",
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
