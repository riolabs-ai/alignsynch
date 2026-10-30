/**
 * `/login` — the sign-in page's copy (WU-7, issue #54).
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
 * mutually exclusive: the page renders the first only when demo mode is on and this request has
 * no valid unlock, and the second only when the unlock verifies, so the same reader never sees
 * both. What `/demo` itself renders is **not** here: that gate is a development surface with no
 * fixture (it writes its few words itself), and its words are not this route's or this table's.
 *
 *   demo-entry   the anchor to the PIN gate: `link` is the anchor's text — its whole accessible
 *                name, which is why the note is a separate item and not inside the anchor
 *   demo         the role block: `heading`/`body` are the card above the buttons, and each
 *                `*-note` is the line under one button's label
 */
import { brand } from "../brand";
import { zPageCopy, type PageCopy } from "../../content/pages";

export const loginPageCopy: PageCopy = zPageCopy.parse({
  heading: `Welcome to ${brand.name}`,
  subtitle: "Challenge your mind with thousands of engaging quizzes across multiple categories",
  sections: [
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
        { id: "forgot", label: "Forgot password?" },
        { id: "submit", label: "Sign In" },
        { id: "pending", label: "Signing in…" },
        { id: "error-invalid-credentials", label: "Invalid email or password" },
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
        { id: "players", label: "Active Players" },
        { id: "categories", label: "Quiz Categories" },
      ],
    },
  ],
});
