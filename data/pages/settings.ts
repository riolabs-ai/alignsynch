/**
 * `/settings` — the signed-in person's own profile (issue #164), in the v2 visual system (#1136).
 *
 * The page this replaced was a tab shell over eight fixture panels; four of them
 * (appearance, notifications, privacy, quiz preferences) simulated a save with `setTimeout`,
 * the security panel offered a password change the app cannot perform, and the profile panel
 * rendered "Alex Johnson". None of that is a thing a person can do, so the route is now the one
 * thing it can honestly do: read and write the fields `content/identity.ts` holds.
 *
 * **The words are bundle 11's** (`docs/specs/v2-bundles/11-spec-design-page-account-settings-v2/`,
 * the v2 epic #1119): one H1 "Account Settings" with a purpose line, then Profile, Password,
 * Session and Delete Account as the bundle's own sections. Two of the bundle's statements are not
 * this build's to make, and both are recorded on #1136 rather than absorbed silently:
 *
 *   - **Notifications is not drawn.** The bundle draws three switches and a Save; the app stores no
 *     notification preference anywhere (`user_profile` is handle/display name/bio/country and the
 *     password + deletion paths are separate actions), and #1136's "must not add new settings
 *     fields beyond what upstream supports" is the binding rule. A switch that writes nowhere is
 *     the `setTimeout` save this page was rebuilt to delete, in a new coat.
 *   - **Email is read-only.** The bundle draws it as an input in Profile; the address lives in
 *     Neon's managed auth, which the app never migrates and cannot write (the module docstring of
 *     `content/identity.ts` states the split). It is drawn where the bundle puts it, with the
 *     bundle's hint, and says it cannot be changed here.
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

export const settingsPageCopy: PageCopy = zPageCopy.parse({
  heading: "Account Settings",
  subtitle: "Your name, email and password.",
  sections: [
    /**
     * The name above the H1 (bundle 11 draws it as the page header's eyebrow, with the settings
     * glyph). It is the session's own display name, so the item is the sentence and `{name}` the
     * record — a fixture that carried a person's name would be the #212 defect again.
     */
    {
      id: "eyebrow",
      items: [{ id: "name", label: "{name}" }],
    },
    {
      id: "identity",
      heading: "Profile",
      body: "How you appear to the people you align with.",
      items: [
        { id: "display-name", label: "Display Name" },
        { id: "display-name-placeholder", label: "Your name" },
        { id: "display-name-hint", label: "Shown on your profile and beside your name." },
        { id: "handle", label: "Profile URL" },
        { id: "handle-prefix", label: "/profile/" },
        { id: "handle-hint", label: "Lowercase letters, digits and hyphens. This is your link." },
        { id: "bio", label: "Bio" },
        { id: "bio-placeholder", label: "A line about you" },
        { id: "bio-hint", label: "Optional. Up to 280 characters." },
        { id: "country", label: "Country" },
        { id: "country-none", label: "Prefer not to say" },
        { id: "country-hint", label: "Optional. Shown with a flag on your profile." },
        { id: "save", label: "Save Profile" },
        { id: "saving", label: "Saving…" },
        { id: "saved", label: "Profile saved." },
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
    /**
     * The address, drawn inside Profile where bundle 11 puts it, and **not editable**.
     *
     * The bundle draws an `Email` input; this build cannot write one. `content/identity.ts` splits
     * the authority — Neon's managed auth owns email, password and session, `user_profile` owns
     * what a person says about themselves — so the field is rendered read-only with the bundle's
     * own hint and the existing note about where the address is changed. #1136's "must not add new
     * settings fields beyond what upstream supports" is the same rule seen from the other side.
     */
    {
      id: "account",
      heading: "Email",
      body: "Your email belongs to Neon's managed sign-in, so it cannot be changed from this page.",
      items: [
        { id: "email", label: "Email" },
        { id: "email-hint", label: "We send invites and results here." },
        { id: "email-readonly", label: "Read-only here" },
        { id: "email-contact", label: "Contact support to change the address you sign in with." },
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
     *
     * **No Current Password field.** The bundle draws one; this build's grant takes the session as
     * the proof and never asks for the old secret (asking would mean storing the answer to ask it),
     * so the field the bundle draws would be a control that is read and then discarded.
     */
    {
      id: "password",
      heading: "Password",
      items: [
        { id: "body-set", label: "Use at least 8 characters." },
        {
          id: "body-none",
          label:
            "Use at least 8 characters. You sign in with Google and this account has no password yet — set one so you can still get in if Google is unavailable.",
        },
        { id: "password", label: "New Password" },
        { id: "password-placeholder", label: "At least {min} characters" },
        { id: "confirm", label: "Confirm New Password" },
        { id: "confirm-placeholder", label: "Type it again" },
        { id: "hint", label: "At least {min} characters. Other devices are signed out." },
        { id: "submit-set", label: "Update Password" },
        { id: "submit-none", label: "Set a Password" },
        { id: "pending", label: "Saving…" },
        { id: "outcome-set", label: "Password updated. Other devices were signed out." },
        { id: "outcome-short", label: "Use at least {min} characters." },
        { id: "outcome-long", label: "Use at most {max} characters." },
        { id: "outcome-mismatch", label: "The two passwords do not match." },
        { id: "outcome-unavailable", label: "We couldn't reach the server. Try again." },
        { id: "outcome-unauthorized", label: "Your session ended. Sign in again." },
      ],
    },
    /**
     * Session — the bundle's fifth card, and the second sign-out control on the page (the account
     * menu's row is the first). Both run `endSession()`; the landing and the confirmation are
     * `lib/shell/account-sign-out.ts`'s, so the two doors cannot disagree about where a person
     * ends up.
     */
    {
      id: "session",
      heading: "Session",
      body: "Signed in as {name} on this device.",
      items: [
        { id: "sign-out", label: "Sign Out" },
        { id: "signing-out", label: "Signing out…" },
        /** The failure, said out loud — the same sentence the account menu's row uses. */
        { id: "error", label: "Couldn't sign out. Try again." },
        /** What the confirmation says on the build that shows one (`accountSignOutFor`). */
        { id: "logout-toast", label: "You’re signed out." },
      ],
    },
    /**
     * The delete-account card (#278).
     *
     * The words are §5 of `docs/specs/account-deletion-spec.md` and **nothing stronger**: deletion is
     * immediate and irreversible, the survivor's assessment stays with the seat labelled
     * "Deleted account", the answers stay as part of their completed report and are no longer
     * linked to a name, an address or an account. It does not say "all your data is erased" —
     * §2 and §6 retain the other participant's report, a suppression row and accounting records,
     * and a sentence that overpromised would be the one thing the policy may not do.
     *
     * **Bundle 11's sentence is not used here, deliberately.** It says the account is removed
     * "within 30 days"; the spec's mechanism removes it now and `lib/account/purge.ts` performs it
     * in one transaction, so the bundle's number would be a promise this build breaks. #1136 sends
     * retention to the spec and the *visual* treatment — neutral outline button with an ×, not a
     * red one — to the bundle; the control is named "Delete Account" as the bundle names it.
     *
     * `confirm-phrase` is the string a person types. It is a fixture row rather than a constant in
     * the action so the phrase a person reads and the phrase the server compares cannot be two
     * different strings — `app/(mainlayout)/settings/delete-account-actions.ts` reads this item.
     */
    {
      id: "deletion",
      heading: "Delete Account",
      body: "Deleting your account is immediate and irreversible, and you can do it yourself from Account settings while signed in: there is no grace period, and no way to restore what is deleted. Your profile, your invitations, and the details that identify you in any shared assessment are removed permanently. Assessments you took part in remain for the other participant, with your seat shown as \u201cDeleted account\u201d; your answers stay only as part of their completed report and are no longer linked to your name, email or account. Deletion cannot be undone and there is no grace period.",
      items: [
        { id: "confirm-phrase", label: "delete my account" },
        { id: "confirm-label", label: "Type {phrase} to confirm" },
        { id: "confirm-placeholder", label: "Type the phrase exactly" },
        { id: "submit", label: "Delete Account" },
        { id: "pending", label: "Deleting…" },
        { id: "outcome-deleted", label: "Your account is deleted. You are signed out." },
        { id: "outcome-mismatch", label: "That phrase does not match, so nothing was deleted." },
        { id: "outcome-unauthorized", label: "Your session ended. Sign in again." },
        { id: "outcome-not-found", label: "This account no longer exists." },
        {
          id: "outcome-unavailable",
          label:
            "We couldn\u2019t finish the deletion. If you are still signed in, nothing was deleted and you can try again.",
        },
        {
          id: "retained",
          label:
            "Accounting records and security audit entries are kept without your name or address. We also keep your email address on a marketing opt-out list, and nothing else from it, so that we do not email you again.",
        },
      ],
    },
    {
      id: "links",
      heading: "Elsewhere",
      items: [
        { id: "public-profile", label: "View your public profile", value: "/profile/{handle}" },
        { id: "dashboard", label: "Back to your account", value: "/dashboard" },
      ],
    },
  ],
});
