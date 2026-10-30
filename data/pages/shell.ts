/**
 * `shell` — the words the `(mainlayout)` chrome renders (WU-7, issue #54).
 *
 * The shell is copy without a route: the header, the sidebar, the footer, the two
 * drawers and the theme toggle are mounted on every page, so none of the route
 * budgets can own them. `data/pages/budget.ts` keys them here by the declared surface
 * name `shell`, with two entry modules — `app/(mainlayout)/layout.tsx` for the header
 * and sidebar, `components/layout/footer.tsx` for the footer, which the pages render
 * themselves.
 *
 * The fixtures are read in the two places Next mounts them and passed down as props,
 * because every one of those components is a client component and `content/pages.ts`
 * carries zod: importing this module from a component would put the schema in the
 * browser bundle, which is exactly why `lib/page-copy.ts` exists without it.
 *
 * Two conventions the shape inherits from `data/pages/home.ts`:
 *
 *  - a `{placeholder}` is filled by the view (`fillLabel`), never spelled here — the
 *    search palette's query and the nav counts are the view's, not the copy's;
 *  - `items` is ordered and the *view* decides which ids it renders, so the nav list
 *    below matches `NAV` in `components/layout/sidebar.tsx` id-for-id. A renamed id
 *    is a red build (E23) rather than a blank link.
 *
 * The account block is a demo identity, not a `Player` row: WU-1 owns real people and
 * this header avatar is chrome that predates it. Keep it here until the record the
 * header renders exists — a copy fixture is the wrong place to invent one.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const shellPageCopy: PageCopy = zPageCopy.parse({
  /** The brand word: the sidebar logo and the footer logo render it. */
  heading: "QuizHub",
  /** The footer's brand sentence. */
  subtitle:
    "Create engaging quizzes, challenge others, and earn rewards for your knowledge. Join our community of quiz creators and players today.",
  sections: [
    {
      id: "nav",
      items: [
        { id: "home", label: "Home" },
        { id: "daily-challenge", label: "Today's Challenge" },
        { id: "categories", label: "Categories" },
        { id: "battle", label: "Quiz Battle" },
        { id: "news", label: "News & Updates" },
        { id: "explore", label: "Explore Quizzes" },
        { id: "tournaments", label: "Quiz Tournament" },
        { id: "leaderboard", label: "Leaderboard" },
        { id: "creator-tips", label: "Quiz Creator Tips" },
        { id: "quiz-discussions", label: "Quiz Discussions" },
        { id: "create-editor", label: "Create Quiz" },
        { id: "create-generator", label: "Ai Quiz Generator" },
        { id: "affiliate", label: "Affiliate Page" },
        { id: "pricing", label: "Pricing Plan" },
        { id: "support", label: "Support" },
        { id: "logout", label: "Logout" },
      ],
    },
    {
      id: "search",
      items: [
        { id: "placeholder", label: "Search quizzes, categories, creators..." },
        { id: "hint", label: "Type to search for quizzes, categories, creators, and more..." },
        { id: "empty-title", label: 'No results found for "{query}"' },
        { id: "empty-hint", label: "Try different keywords or check spelling" },
        { id: "group-quizzes", label: "Quizzes" },
        { id: "group-categories", label: "Categories" },
        { id: "group-creators", label: "Creators" },
        { id: "group-pages", label: "Pages" },
        { id: "count-quizzes", label: "{count} quizzes" },
        { id: "view-all", label: 'View all results for "{query}"' },
      ],
    },
    {
      id: "account",
      items: [
        { id: "initials", label: "JD" },
        { id: "display-name", label: "Jonathan Doe" },
        { id: "display-handle", label: "@johndoe" },
        { id: "display-email", label: "info@quizhub.com" },
        { id: "profile", label: "My Profile" },
        { id: "profile-hint", label: "Account settings" },
        { id: "dashboard", label: "Dashboard" },
        { id: "dashboard-hint", label: "Your activity and stats" },
        { id: "quizzes", label: "My Quizes" },
        { id: "quizzes-hint", label: "Your created quizes" },
        { id: "settings", label: "Settings" },
        { id: "settings-hint", label: "Preferences" },
        { id: "dark-mode", label: "Dark Mode" },
        { id: "dark-mode-hint", label: "Toggle theme" },
        { id: "logout", label: "Log out" },
      ],
    },
    {
      id: "notifications",
      heading: "Notifications",
      items: [
        { id: "mark-all", label: "Mark all read" },
        { id: "empty-title", label: "No notifications" },
        {
          id: "empty-body",
          label: "You're all caught up! We'll notify you when something new happens.",
        },
        { id: "new", label: "New" },
        { id: "earlier", label: "Earlier" },
      ],
    },
    {
      id: "messages",
      heading: "Recent Messages",
      items: [{ id: "view-all", label: "View All" }],
    },
    {
      id: "theme",
      items: [{ id: "toggle", label: "Toggle theme" }],
    },
    {
      id: "footer-links",
      heading: "Quick Links",
      items: [
        { id: "dashboard", label: "Dashboard" },
        { id: "create-quiz", label: "Create Quiz" },
        { id: "leaderboard", label: "Leaderboard" },
        { id: "affiliate", label: "Affiliate Program" },
        { id: "pricing", label: "Pricing" },
      ],
    },
    {
      id: "footer-categories",
      heading: "Categories",
    },
    {
      id: "footer-contact",
      heading: "Contact",
      items: [
        { id: "address", label: "123 Quiz Street, Knowledge City, QZ 12345" },
        { id: "phone", label: "+1 (555) 123-4567" },
        { id: "email", label: "support@quizhub.com" },
        { id: "cta", label: "Contact Support" },
      ],
    },
    {
      id: "footer-newsletter",
      heading: "Subscribe to our newsletter",
      body: "Get the latest news, updates and quiz tips delivered directly to your inbox.",
      items: [
        { id: "placeholder", label: "Enter your email" },
        { id: "subscribe", label: "Subscribe" },
      ],
    },
    {
      id: "footer-legal",
      items: [
        { id: "copyright", label: "QuizHub. All rights reserved." },
        { id: "privacy", label: "Privacy Policy" },
        { id: "terms", label: "Terms of Service" },
        { id: "cookies", label: "Cookie Policy" },
      ],
    },
  ],
});
