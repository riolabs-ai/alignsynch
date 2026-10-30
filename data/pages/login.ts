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
      id: "stats",
      items: [
        { id: "players", label: "Active Players" },
        { id: "categories", label: "Quiz Categories" },
      ],
    },
  ],
});
