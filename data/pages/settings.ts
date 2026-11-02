/**
 * `/settings` — the signed-in person's own profile (issue #164).
 *
 * The page this replaces was a tab shell over eight fixture panels; four of them
 * (appearance, notifications, privacy, quiz preferences) simulated a save with `setTimeout`,
 * the security panel offered a password change the app cannot perform, and the profile panel
 * rendered "Alex Johnson". None of that is a thing a person can do, so the route is now the one
 * thing it can honestly do: read and write the fields `content/identity.ts` holds.
 *
 * The view resolves these ids (`sectionOf` / `itemLabel`); a rename here is a red build, not a
 * blank label.
 *
 * `identity` items that are *messages* rather than labels carry the ids the settings form maps
 * a write outcome onto (`save`, `saving`, `saved`, and one `error-*` per failure kind). That is
 * the same split `lib/auth/errors.ts` makes for the two auth surfaces: the code decides which
 * failure it was, the fixture decides what a person reads, and the view only joins them.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";
import { brand } from "../brand";

export const settingsPageCopy: PageCopy = zPageCopy.parse({
  heading: "Account settings",
  subtitle: `The parts of your ${brand.name} account you can change here`,
  sections: [
    {
      id: "identity",
      heading: "Your profile",
      body: "This is what other people see on your public profile page.",
      items: [
        { id: "display-name", label: "Display name" },
        { id: "display-name-placeholder", label: "Your name" },
        { id: "display-name-hint", label: "Shown on your profile and next to your quizzes." },
        { id: "handle", label: "Profile URL" },
        { id: "handle-prefix", label: "/profile/" },
        { id: "handle-hint", label: "Lowercase letters, digits and hyphens. This is your link." },
        { id: "bio", label: "Bio" },
        { id: "bio-placeholder", label: "A line about you" },
        { id: "bio-hint", label: "Optional. Up to 280 characters." },
        { id: "country", label: "Country" },
        { id: "country-none", label: "Prefer not to say" },
        { id: "country-hint", label: "Optional. Shown with a flag on your profile." },
        { id: "save", label: "Save changes" },
        { id: "saving", label: "Saving…" },
        { id: "saved", label: "Saved" },
        { id: "error-handle-taken", label: "That profile URL is already someone else's." },
        { id: "error-invalid", label: "Check the highlighted fields and try again." },
        { id: "error-network", label: "Couldn't reach the server. Try again." },
        { id: "error-unauthorized", label: "Your session ended. Sign in again." },
        { id: "error-unknown", label: "Something went wrong. Try again." },
        { id: "error-required", label: "A display name and a profile URL are required." },
      ],
    },
    {
      id: "countries",
      heading: "Country",
      body: "A closed list on purpose: a flag needs a known ISO-3166 alpha-2, so a free-text country would be a label nobody can render. Growing it is a copy edit, not a schema change.",
      items: [
        { id: "us", label: "United States" },
        { id: "ca", label: "Canada" },
        { id: "gb", label: "United Kingdom" },
        { id: "au", label: "Australia" },
        { id: "de", label: "Germany" },
        { id: "fr", label: "France" },
        { id: "es", label: "Spain" },
        { id: "it", label: "Italy" },
        { id: "jp", label: "Japan" },
        { id: "br", label: "Brazil" },
      ],
    },
    {
      id: "account",
      heading: "Account",
      body: "Your email belongs to Neon's managed sign-in, so it cannot be changed from this page.",
      items: [
        { id: "email", label: "Email" },
        { id: "email-readonly", label: "Read-only here" },
        { id: "email-hint", label: "Contact support to change the address you sign in with." },
        { id: "signed-in-as", label: "Signed in as {name}" },
        { id: "sign-out", label: "Sign out" },
        { id: "signing-out", label: "Signing out…" },
      ],
    },
    /**
     * The password card (#password-reset).
     *
     * Two states, one mechanism: an account with no password is told what having none means and is
     * offered *setting* one; an account with one is offered *changing* it. The sentences differ and
     * the form does not, because both go through the same grant
     * (`lib/auth/reset-set.ts::setPasswordFromSession`) — the session is the proof either way.
     *
     * `body-none` is the one sentence on this page that is the card's whole reason to exist: a
     * Google-only account has no password and, without this, no way to get one.
     *
     * The `outcome-*` items are the closed set `ResetSetOutcome` can produce
     * (`lib/auth/reset-token.ts`), whose ids the card resolves through `resetSetItemId`.
     */
    {
      id: "password",
      heading: "Password",
      items: [
        {
          id: "body-none",
          label:
            "You sign in with Google, and this account has no password. Set one so you can still get in if Google is unavailable.",
        },
        { id: "body-set", label: "Change the password you sign in with." },
        { id: "password", label: "New password" },
        { id: "password-placeholder", label: "At least {min} characters" },
        { id: "confirm", label: "Confirm new password" },
        { id: "confirm-placeholder", label: "Type it again" },
        { id: "hint", label: "At least {min} characters. Other devices are signed out." },
        { id: "submit-none", label: "Set a password" },
        { id: "submit-set", label: "Change password" },
        { id: "pending", label: "Saving…" },
        { id: "outcome-set", label: "Password saved. Other devices were signed out." },
        { id: "outcome-short", label: "Use at least {min} characters." },
        { id: "outcome-long", label: "Use at most {max} characters." },
        { id: "outcome-mismatch", label: "The two passwords do not match." },
        { id: "outcome-unavailable", label: "We couldn't reach the server. Try again." },
        { id: "outcome-unauthorized", label: "Your session ended. Sign in again." },
      ],
    },
    {
      id: "links",
      heading: "Elsewhere",
      items: [
        { id: "public-profile", label: "View your public profile", value: "/profile/{handle}" },
        { id: "dashboard", label: "Back to your account", value: "/dashboard/user" },
      ],
    },
  ],
});
