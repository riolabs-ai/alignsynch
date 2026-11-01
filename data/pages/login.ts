/**
 * `/login` — the sign-in page's copy (WU-7, issue #54; brand-selected by issue #225).
 *
 * The route's surface is `app/(auth)/login/page.tsx` (a server module that parses this
 * fixture) plus `components/auth/login-view.tsx`, which is the client component that
 * renders it. The split exists because this file carries zod and the view does not.
 *
 * `sign-in` is the card; the root `heading`/`subtitle` are the illustration panel beside
 * it. The trailing space after `signup-prompt` is the view's (`{" "}`), not this
 * fixture's: a label with an invisible trailing space is a fixture nobody can review.
 *
 * `demo-entry` and `demo` are the two demo surfaces this route may draw (#218), and they are
 * mutually exclusive (see their sections below).
 *
 * ## Two brands, one card (issue #225)
 *
 * The card is shared — its field labels, its error states and its two buttons are the
 * product's, not a skin's — so only the sentences that *are* the brand get a second
 * section. `hero-alignsynch` and `sign-in-alignsynch` carry the alignment build's words
 * and `lib/auth-copy.ts::loginCopyFor` merges each into the shared section, so the view
 * resolves one set of ids either way. The quiz build's fields stay page-level and are
 * byte for byte what shipped.
 *
 * ## The two tiles hold statements, not statistics
 *
 * The quiz build's tiles are a count (`platform.activePlayers`, which the view formats
 * from `data/metrics.ts`) and the category total. The alignment build's two tiles are
 * **sentences**: two people, one set of questions, the distance between the answers is
 * the Gap. There is no number to put there and nothing on this page may invent one — a
 * smaller count, a `0` or a dash would each be a fabricated claim about a product whose
 * demo has three accounts. So `stats-alignsynch` carries no `{count}` placeholder, and
 * the view fills one only where a fixture asks for it.
 */
import type { Brand } from "../../content/brand";
import { zPageCopy, type PageCopy } from "../../content/pages";
import { brand } from "../brand";

export function loginCopy(record: Pick<Brand, "name">): PageCopy {
  return zPageCopy.parse({
    heading: `Welcome to ${record.name}`,
    subtitle: "Challenge your mind with thousands of engaging quizzes across multiple categories",
    sections: [
      /**
       * The illustration panel's sentence, for the alignment build only: the heading above
       * is `Welcome to <brand>` and is true of both. `loginCopyFor` puts this where
       * `subtitle` sits, so the panel has one paragraph either way.
       */
      {
        id: "hero-alignsynch",
        body: "The same questions for both of you. Where your answers part is the Gap.",
      },
      {
        id: "sign-in",
        heading: "Welcome Back",
        body: "Sign in to continue your quiz journey",
        items: [
          { id: "email", label: "Email" },
          { id: "email-placeholder", label: "Enter your email" },
          { id: "password", label: "Password" },
          { id: "password-placeholder", label: "Enter your password" },
          { id: "remember", label: "Remember me" },
          { id: "submit", label: "Sign In" },
          { id: "pending", label: "Signing in…" },
          /**
           * The rejected-password sentence — and, one item below, the refusal Better Auth
           * cannot express (issue #281).
           *
           * `signInEmail` answers `INVALID_EMAIL_OR_PASSWORD` (401) for a wrong password, for an
           * address with no user, for a user with **no credential account at all** (the
           * Google-only case) and for a credential row with no password — the same code,
           * deliberately, so the endpoint is not an account-existence oracle
           * (`better-auth`'s sign-in route — `api/routes/sign-in.mjs` in the package — where the
           * four `throw APIError.from` branches after `findUserByEmail` all name it). So this
           * sentence claims exactly what the server said: the pair did not match. A password
           * account with a bad password reads it, and nothing else.
           */
          { id: "error-invalid-credentials", label: "Invalid email or password." },
          /**
           * The Google-only refusal (#281, part 2), and the one string here whose cause the app
           * determines rather than the auth server.
           *
           * The server's answer is the same 401 the sentence above describes, so
           * `components/auth/login-view.tsx` asks `providerHint` after a credentials refusal and
           * renders *this* id only when the server says the account has no password to check:
           * `neon_auth.account` has rows, every one of them `google`
           * (`lib/auth/provider-link.ts::isGoogleOnlyAccount`). A lookup that fails, a
           * deployment with no database and an address with no account all keep the sentence
           * above — this one is never a guess.
           *
           * It does not say the password is wrong, because there is no password to be wrong, and
           * it points at the Google button above by name. That phrase is the `google` section's
           * `label` written out a second time, on purpose: a sentence cannot be assembled from
           * two fixture items without a placeholder, and a placeholder here would render as
           * literal braces anywhere this id is drawn without its values. Keep the two in step.
           */
          {
            id: "error-google-account",
            label: "This account uses Google sign-in. Use Continue with Google above.",
          },
          /**
           * The one sentence a failed Google *finish* shows (#351 follow-up). The exchange fails
           * closed: every refusal redirects to `/login` signed out, which is byte-for-byte the page
           * a person who never tried sees. The finish route appends `?google=failed` so this sentence
           * is drawn only for a real attempt that came back empty — never for a cold visit — and it
           * is one sentence for both brands, exactly the words the card specifies.
           */
          { id: "error-google-failed", label: "We couldn't finish signing you in. Try again." },
          { id: "error-network", label: "Couldn't reach the server. Check your connection." },
          {
            id: "error-origin",
            label:
              "This site's address isn't authorised to sign in. Open the app at the address it was set up for.",
          },
          { id: "error-unknown", label: "Something went wrong. Sign in again." },
          { id: "error-required", label: "Enter your email and password." },
          { id: "signup-prompt", label: "Don't have an account?" },
          { id: "signup-action", label: "Sign up here" },
        ],
      },
      /**
       * The Google button beside the card (issue #281).
       *
       * One button, no provider picker: the form is the other option, and a chooser between
       * two options is a step whose only job is to be dismissed. `divider` is the word
       * between them — in the fixture like every other string on this surface, because
       * `/login`'s copy budget is 0 (`data/pages/budget.ts`) and the view may not type one.
       *
       * `label` is the button's whole accessible name, which is why the mark beside it is
       * decorative and carries no text of its own.
       */
      {
        id: "google",
        items: [
          { id: "label", label: "Continue with Google" },
          { id: "pending", label: "Opening Google…" },
          { id: "divider", label: "or" },
        ],
      },
      /**
       * The same card's one line of description, for the alignment build. `loginCopyFor`
       * merges it into `sign-in` rather than the fixture declaring a second card: a
       * section pair would duplicate fifteen field labels, and two copies of a label is
       * two places a typo can hide.
       */
      {
        id: "sign-in-alignsynch",
        body: "Sign in to see your assessments.",
      },
      /**
       * The demo surfaces this route may draw (#218), and they are mutually exclusive: the page
       * renders `demo-entry` only when demo mode is on and this request has no valid unlock, and
       * `demo` only when one verifies, so the same reader never sees both. What `/demo` itself
       * renders is **not** here: that gate is a development surface with no fixture (it writes
       * its few words itself).
       *
       *   demo-entry   `link` is the anchor's text — its whole accessible name, which is why the
       *                note is a separate item and not inside the anchor
       *   demo         `heading`/`body` are the card above the buttons, and each `*-note` is the
       *                line under one button's label
       */
      {
        id: "demo-entry",
        items: [
          { id: "link", label: "Demo sign-in" },
          { id: "note", label: "Needs the demo PIN. Four digits." },
        ],
      },
      {
        id: "demo",
        heading: "Demo accounts",
        body: "Demo mode — not a real login. Pick one and the server signs in with credentials the browser never receives.",
        items: [
          { id: "initiator-note", label: "Avery — the party who asked" },
          { id: "counterparty-note", label: "Rowan — the party who answers" },
          { id: "admin-note", label: "The administrator, with no party to answer as" },
        ],
      },
      {
        id: "stats",
        items: [
          /**
           * `{count}` is the view's (`fillLabel`): the number is
           * `data/metrics.ts::platform.activePlayers` and `content/metrics.ts` decides its
           * shape, so it is never typed here. The `+` is the fixture's — punctuation on
           * the claim, not part of the measurement.
           */
          { id: "players", label: "Active Players", value: "{count}+" },
          /** Carried verbatim from the view this fixture replaced (WU-7). */
          { id: "categories", label: "Quiz Categories", value: "500+" },
        ],
      },
      /**
       * The alignment build's two tiles: statements, in the slots the quiz build fills
       * with a count. No placeholder, no number, no dash — both parties answer the same
       * questions, and the Gap is the distance between their answers.
       */
      {
        id: "stats-alignsynch",
        items: [
          { id: "sides", label: "One set of questions", value: "Two answers" },
          { id: "gap", label: "The distance between them", value: "The Gap" },
        ],
      },
      /**
       * The version badge (issue #269) — the line under the credentials card. The same three
       * ids as the shell's section (`data/pages/shell.ts`), because `AppVersion` is one
       * component resolving one set of ids; the words are per surface because a fixture owns
       * its own copy, and `{version}` is filled from the build, never typed.
       */
      {
        id: "version",
        items: [
          { id: "label", label: "Version {version}" },
          { id: "compact", label: "v{version}" },
          { id: "title", label: "Open the v{version} release notes on GitHub" },
        ],
      },
      /**
       * The legal row under the card (issue #270): the two routes that now exist, so `/login`
       * carries the same links the footer does, before a person agrees to anything. The labels
       * are the fixture's and the destinations are the view's — `components/auth/login-view.tsx`
       * reads `terms` and `privacy` by id, so a rename here is a red build (E23).
       */
      {
        id: "legal",
        items: [
          { id: "terms", label: "Terms of Service" },
          { id: "privacy", label: "Privacy Policy" },
        ],
      },
    ],
  });
}

/** The instance the build ships: this fixture, for the brand `BRAND` selected. */
export const loginPageCopy: PageCopy = loginCopy(brand);
