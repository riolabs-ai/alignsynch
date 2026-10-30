/**
 * `/dashboard/user` — the signed-in person's account home (issue #164).
 *
 * What it rendered before: five tabs of fixtures — a $2,431.50 wallet, an earnings chart, an
 * affiliate funnel, six "my quizzes" with play counts, and a settings panel with "Alex Johnson"
 * in it. Every number was authored in a component, and every one of them was about a person who
 * was not the person looking at the page. The epic's requirement for this route is "reads the
 * signed-in user's records", and there are no per-user records yet (quizzes a person creates,
 * attempts, payouts — none of those tables exist), so the honest page is identity plus honest
 * empty states: no invented balance, no invented quiz, and one obvious next action.
 *
 * The empty-state copy is written so it cannot become a lie later: it says "nothing here yet",
 * which stays true until the row it names exists.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";
import { brand } from "../brand";

export const dashboardPageCopy: PageCopy = zPageCopy.parse({
  heading: "Welcome back, {name}",
  subtitle: `Everything tied to your ${brand.name} account`,
  items: [{ id: "error-network", label: "Couldn't reach the server. Try again." }],
  sections: [
    {
      id: "identity",
      heading: "Your account",
      items: [
        { id: "email-label", label: "Email" },
        { id: "handle-label", label: "Profile URL" },
        { id: "no-handle", label: "No profile URL yet" },
        { id: "handle-prefix", label: "/profile/" },
        { id: "set-up-profile", label: "Set up your profile" },
        { id: "view-profile", label: "View public profile" },
        { id: "account-settings", label: "Account settings" },
        { id: "sign-out", label: "Sign out" },
        { id: "signing-out", label: "Signing out…" },
      ],
    },
    {
      id: "quizzes",
      heading: "Your quizzes",
      body: "You haven't created a quiz yet. The editor is where a quiz starts.",
      cta: { label: "Create a quiz", href: "/create/editor" },
      items: [{ id: "empty", label: "Nothing here yet." }],
    },
    {
      id: "wallet",
      heading: "Wallet",
      body: "Earnings appear here after your first paid quiz — there is no balance to show yet.",
      items: [{ id: "empty", label: "No earnings yet." }],
    },
    {
      id: "activity",
      heading: "Recent activity",
      body: "Your attempts, wins and the quizzes you finish will show up here.",
      items: [{ id: "empty", label: "Nothing to show yet." }],
    },
  ],
});
