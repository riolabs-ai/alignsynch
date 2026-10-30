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
 *
 * THE PRODUCT NAME IS NOT COPY. `heading` is the brand word the sidebar logo and the
 * footer logo render, and `footer-legal/copyright` is the same word in a sentence; both
 * read `brand.name` from `data/brand.ts`, so the projection is a function of the brand
 * record (`shellCopy(brand)`) and the two strings a second brand must change are the
 * ones it actually prints. `shellPageCopy` stays the shipped record's instance, so every
 * caller keeps importing a `PageCopy` and nothing else moved. Every other rendered
 * literal in `app/`, `components/` and `data/` reads the same record, so a skin is a
 * second `Brand` and not a find-and-replace.
 *
 * The two addresses in this fixture are the brand's too: `display-email` (the header's
 * account block) and `footer-contact/email` (the footer) both read
 * `brand.supportEmail`, because the record carries one support address and a demo that
 * printed a second one would be a second source of truth for it.
 */
import type { Brand } from "../../content/brand";
import { zPageCopy, type PageCopy } from "../../content/pages";
import { brand } from "../brand";

/**
 * The shell's copy for one brand. `heading` and the copyright line are the only fields
 * that depend on it, and both are derived rather than written: a projection that spells
 * the product name cannot be re-skinned without a find-and-replace.
 */
export function shellCopy(brand: Brand): PageCopy {
  return zPageCopy.parse({
    /** The brand word: the sidebar logo and the footer logo render it. */
    heading: brand.name,

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
      /**
       * The AlignSynch navigation (issue #156) — the alignment product's own destinations.
       *
       * It is a *second section in the same fixture*, not a second fixture: E23 resolves every
       * `itemLabel()` a component asks for against the one instance this module exports, so a
       * menu that only existed when `BRAND=alignsynch` would fail the gate that runs on the
       * default brand. The view picks the section by brand (`components/layout/nav-menus.tsx`),
       * and the words are here either way.
       *
       * Only destinations that exist today, and each one is honest:
       *
       *   Home         `/`               the alignment front page
       *   Templates    the `#templates` band of `/` — the four records' own heading
       *   How it works the `#questions` band of `/` — how the two questions are asked
       *   Support      `/support`        the shell's existing support route, brand-projected
       *
       * There is no About: no route answers "about this company", and the closest thing
       * (`/welcome`, the marketing page) is a landing page, not an About page. Pointing at
       * either would be the wrong link this issue exists to delete, so the item is omitted
       * rather than aimed somewhere it does not belong.
       *
       * `quiz-tools` is the heading over the quiz product's own menu, which an elevated viewer
       * gets below the alignment menu (see `lib/nav.ts` for the capability and its stub).
       */
      {
        id: "nav-alignsynch",
        items: [
          { id: "home", label: "Home" },
          { id: "templates", label: "Templates" },
          { id: "how-it-works", label: "How it works" },
          { id: "support", label: "Support" },
          { id: "quiz-tools", label: "Quiz tools" },
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
      /**
       * The alignment build's search words (issue #156).
       *
       * The header palette is chrome, so its placeholder is on every AlignSynch page, and it
       * used to promise a search over quizzes on a page that has none. The words now match
       * what the palette actually searches on this brand: the assessment *instances* in
       * `data/assessments.ts` and the three pages an alignment visitor can reach
       * (`lib/nav.ts`'s `ALIGNMENT_ROUTES`). `data/searchdata.ts` builds that index; the
       * placeholder and the group heading below are its description.
       *
       * The ids are the `search` section's ids, so `components/layout/header.tsx` resolves the
       * same ids against whichever section its brand selects and cannot ask for a label that
       * only exists on one brand. The quiz groups are worded for the viewer who can still see
       * them — an elevated viewer gets the quiz rows back under these headings.
       */
      {
        id: "search-alignsynch",
        items: [
          { id: "placeholder", label: "Search assessments and pages..." },
          { id: "hint", label: "Find an assessment by person or template, or a page by name." },
          { id: "empty-title", label: 'No results found for "{query}"' },
          { id: "empty-hint", label: "Try a different name — a template, a person, or a page." },
          { id: "group-quizzes", label: "Quizzes" },
          { id: "group-categories", label: "Categories" },
          { id: "group-creators", label: "Creators" },
          { id: "group-pages", label: "Assessments & pages" },
          { id: "count-quizzes", label: "{count} quizzes" },
          { id: "view-all", label: 'View all results for "{query}"' },
        ],
      },
      /**
       * The `/search` page's tab strip (issue #156 follow-up).
       *
       * The strip is the same four groups the palette shows, filterable, and until now their
       * names were written into `components/search/search-results.tsx` — which put "Quizzes"
       * and "Categories" on the alignment build's page as tabs filtering 0 rows, because the
       * index behind them (`searchIndexFor`) holds no quiz, category or creator there.
       *
       * A second section rather than more items on `search`/`search-alignsynch`: the palette's
       * group headings and this page's tab labels are the same *groups* but not the same job —
       * a palette heading over zero hits is never drawn (the header hides an empty group), a
       * tab with a count is. The alignment build keeps the tab for the one group it has and
       * drops the tabs for the groups it does not (`searchTabIds` in `lib/shell-copy.ts`), so
       * the words below are only ever asked for by a brand that can show them.
       */
      {
        id: "search-tabs",
        items: [
          { id: "all", label: "All Results ({count})" },
          { id: "quizzes", label: "Quizzes ({count})" },
          { id: "categories", label: "Categories ({count})" },
          { id: "creators", label: "Creators ({count})" },
          { id: "pages", label: "Pages ({count})" },
        ],
      },
      /**
       * The alignment build's tab words — the two tabs its index can fill.
       *
       * `all` is the same tab on both brands; `pages` is what `searchIndexFor` really holds on
       * this build (the instances in `data/assessments.ts` and the three `ALIGNMENT_ROUTES`),
       * and `search-alignsynch`'s `group-pages` already words that group the same way. There is
       * no `quizzes`, `categories` or `creators` item: no tab renders them here, and a label
       * for a filter with no rows behind it is the defect this section deletes rather than a
       * word to translate.
       */
      {
        id: "search-tabs-alignsynch",
        items: [
          { id: "all", label: "All Results ({count})" },
          { id: "pages", label: "Assessments & pages ({count})" },
        ],
      },
      {
        id: "account",
        items: [
          { id: "initials", label: "JD" },
          { id: "display-name", label: "Jonathan Doe" },
          { id: "display-handle", label: "@johndoe" },
          { id: "display-email", label: brand.supportEmail },
          { id: "profile", label: "My Profile" },
          { id: "profile-hint", label: "Account settings" },
          { id: "dashboard", label: "Dashboard" },
          { id: "dashboard-hint", label: "Your activity and stats" },
          { id: "quizzes", label: "My Quizes" },
          { id: "quizzes-hint", label: "Your created quizes" },
          { id: "settings", label: "Settings" },
          { id: "settings-hint", label: "Preferences" },
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
        items: [
          { id: "view-all", label: "View All" },
          { id: "empty-title", label: "No messages" },
          { id: "empty-body", label: "Conversations will appear here." },
        ],
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
      /**
       * The AlignSynch footer's link column (issue #156) — the same destinations as the
       * sidebar's `nav-alignsynch`, minus Home (a footer column whose first row is the page
       * you are on is furniture, not navigation). The quiz Quick Links and the quiz subject
       * column replace nothing here: on the alignment brand they are not rendered at all
       * (`components/layout/footer.tsx` switches on the brand), and an elevated viewer gets
       * them back below this column.
       */
      {
        id: "footer-links-alignsynch",
        heading: "Quick Links",
        items: [
          { id: "templates", label: "Templates" },
          { id: "how-it-works", label: "How it works" },
          { id: "support", label: "Support" },
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
          { id: "email", label: brand.supportEmail },
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
          { id: "copyright", label: `${brand.name}. All rights reserved.` },
          { id: "privacy", label: "Privacy Policy" },
          { id: "terms", label: "Terms of Service" },
          { id: "cookies", label: "Cookie Policy" },
        ],
      },
    ],
  });
}

/**
 * The shell as the app renders it today — the shipped record's instance of `shellCopy`.
 *
 * Still a parsed `PageCopy` at module scope, so the layout, the eleven pages that mount
 * the footer, `data/pages/index.ts` and the E23 ratchet need no change: they import a
 * value, and a value is what they get.
 */
export const shellPageCopy: PageCopy = shellCopy(brand);
