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
 * The account block holds **no person** (issue #212). It carried a placeholder identity — the
 * monogram `JD`, a made-up name and handle, and the brand's support mailbox — that the header
 * painted onto every page behind the shell, so a
 * signed-in demo admin's own board announced a stranger. A person is session data, not copy:
 * `lib/auth/shell-account.ts` resolves the signed-in name, handle and address from the request,
 * and `components/layout/header.tsx` draws `GeneratedAvatar` from them. What stays here is the
 * one word the slot needs when nobody is signed in ("Sign in") and the menu's destinations.
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
 * The footer's mailbox is the brand's: `footer-contact/email` reads `brand.supportEmail`,
 * because the record carries one support address and a demo that printed a second one would be
 * a second source of truth for it. The header's account block no longer prints an address at all
 * (#212) — it prints the signed-in person's own, which is session data and not this fixture's.
 *
 * THE FOOTER'S BRAND SENTENCES ARE THE BRAND'S VOCABULARY, NOT THE TEMPLATE'S (issue
 * #188, stage S3). `Brand` carries a name, a mailbox and a domain; it does not carry a
 * *product category*, and on `BRAND=alignsynch` this file printed "quizzes" and "quiz
 * creators" in the chrome of every page — the words a reskin cannot reach because they are
 * fixtures, not routes. The blurb and the contact block are therefore one *section pair*
 * each, with the same ids on both sides, exactly like `nav`/`nav-alignsynch`:
 *
 *   footer-brand              / footer-brand-alignsynch             the sentence under the wordmark
 *   footer-contact            / footer-contact-alignsynch          mailbox, CTA
 *
 * `footerCopyFor` in `lib/shell-copy.ts` is the switch, and it is exhaustive over
 * `BrandId`, so a third brand fails `tsc` until its two sections exist. The alignment
 * sections are written out rather than derived from the quiz ones: a paragraph and the words
 * beside a mailbox are copy an editor writes, and a placeholder swapped into the quiz
 * sentence ("…and alignment tips") would be the same string with a different noun, which is
 * what a re-skin must stop being.
 *
 * Two of the rows those sections once carried are gone (#272), and the third section with
 * them: the street line and the telephone number were invented, and the mailing-list band had
 * no sender behind it. What is left is what a reader can check out.
 *
 * What stays shared is everything the two products genuinely share — the column
 * headings, "Contact", the support button, the legal line, the drawer
 * empty states. Those are shell furniture, not product vocabulary, and duplicating them
 * would make the next brand a six-section copy of a five-word heading.
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
    /**
     * The brand word: the sidebar logo and the footer logo render it.
     *
     * There is no `subtitle` here: the sentence under the wordmark is the footer's, it is
     * product vocabulary, and it is brand-selected below (`footer-brand` /
     * `footer-brand-alignsynch`). `PageCopy.subtitle` is the *route* hero's field.
     */
    heading: brand.name,

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
          { id: "create-generator", label: "Quiz Generator" },
          { id: "affiliate", label: "Affiliate Page" },
          { id: "pricing", label: "Pricing Plan" },
          { id: "support", label: "Support" },
          /**
           * The public menu's help row (Help/Support split). One id per surface, because the two
           * rows now lead to two different pages: `support` is the in-app account page the rail
           * opens, and `help` is the public FAQ and knowledge base the marketing header opens. A
           * shared id would force one word onto both, which is exactly the confusion the split
           * removes.
           */
          { id: "help", label: "Help" },
          { id: "logout", label: "Logout" },
          /**
           * The sign-out row's two other states (issue #272). The row is a control now, not a
           * `href="#"` link, so it needs the words a control needs: the moment between the click
           * and the session ending, and the failure that has to be said out loud rather than
           * swallowed. Both live here because the row's label lives here.
           */
          { id: "logout-pending", label: "Signing out…" },
          { id: "logout-error", label: "Couldn't sign out. Try again." },
        ],
      },
      /**
       * The rail's mobile chrome — the hamburger, the panel it opens, and the panel's own close
       * control.
       *
       * Below 768px the shell's navigation is an overlay drawer (`components/layout/sidebar.tsx`),
       * so three words that did not exist while the rail was a column at every width now do. They
       * live here rather than in the components because they are rendered copy like any other: a
       * literal in `header.tsx` or `sidebar.tsx` is an E23 failure on a surface whose budget is 0.
       *
       * One section, both brands: the drawer is the same drawer on either brand, and its trigger
       * says what it opens, not what the product is. `label` names the panel itself — the words a
       * screen reader hears after `role="dialog"` takes over the `<aside>` — and `close` is both
       * the panel's X and the trigger's own name while the panel is open.
       */
      {
        id: "rail",
        items: [
          { id: "open", label: "Open navigation" },
          { id: "close", label: "Close navigation" },
          { id: "label", label: "Main navigation" },
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
       *   Home           `/`                      the marketing header's front-page row
       *   Dashboard      `/dashboard`             the signed-in console's front page (console 2/5)
       *   How it works   `/how-it-works`          the in-app onboarding page: the order a member
       *                                           does the work in, step by step
       *   My Relationships `/assessment/instances` — the relationship list R1 ships, read from
       *                                             Postgres; not the browser-local `/v1/` prototype
       *   Library        `/assessment/templates`  the template catalogue: built-ins plus this
       *                                             account's
       *   Templates      the `#templates` band of `/` — the four records' own heading
       *   Pricing        `/pricing`               the public price page (the marketing header's
       *                                             fourth row)
       *   Support        `/support`               the shell's existing support route,
       *                                             brand-projected
       *
       * **The rail opens on Dashboard, and there is one row for `/dashboard`.** "Home" and the
       * separate "Overview" row used to name two different things and pointed at one product
       * whose front page is the console — so the owner's review merged them: the rail's first row
       * is Dashboard at `/dashboard`, and no second row aims at the same route. `home` survives
       * below because the *marketing header* still draws a front-page row at `/` out of this
       * section (`AlignSynchPublicNav`); it is the public chrome's word, not a sidebar row.
       *
       * **Library sits directly under My Relationships**, because they are the console's two
       * lists — what you own and what you build from — and reading them apart is what made "Your
       * templates" look like a settings page. Templates then follows, one row above Support,
       * which is the order the review asked for: the marketing bands end the menu rather than
       * interrupting the console.
       *
       * **How it works is a page now, not the marketing band.** The row used to be `/#questions`
       * — a signed-in member was sent out to the public site to be told how the product works —
       * and the owner's review asked for the opposite: a wizard/onboarding page inside the
       * console (`app/(mainlayout)/how-it-works/page.tsx`, words in `data/pages/how-it-works.ts`).
       * The label is unchanged, and it is still the second row: the order the review set is
       * Dashboard, How it works, My Relationships, Library, Templates, Support, operator rows.
       *
       * **Templates and Library are two rows with two jobs, never one renamed to the other.**
       * Templates is the catalogue a member starts from (`Use Template` → a new My Relationship);
       * Library is that member's own templates, built from their own relationships and Aspects.
       * Both rows resolve to the catalogue today — a second catalogue page is not this card — so
       * neither word may stand in for the other: "Templates" is what you use, "Library" is what
       * is yours.
       *
       * Every console row here is a route this build serves to every viewer: a signed-out request
       * is answered with the route's own redirect to `/login?next=…`, never a 404, so a member's
       * row is a row that works. None of them renders on the quiz brand — whose rail is its own
       * menu (`components/layout/nav-menus.tsx`'s `QuizHubMenu`), so an AlignSynch destination
       * cannot reach a quiz build.
       *
       * There is no About: no route answers "about this company", and the closest thing
       * (`/welcome`, the marketing page) is a landing page, not an About page. Pointing at
       * either would be the wrong link this issue exists to delete, so the item is omitted
       * rather than aimed somewhere it does not belong.
       *
       * `quiz-tools` is the heading over the quiz product's own menu, which an elevated viewer
       * gets below the alignment menu (see `lib/nav.ts` for the capability and its stub).
       *
       * `console-gaps` and `admin-instances` are the operator's rows (`/admin/gaps` console 4/5,
       * `/admin/instances` console 3/5). Each is drawn only for a viewer carrying `admin-console`,
       * because a row that leads to a 404 for a member advertises a surface the member must not
       * learn exists — a 404 is the whole refusal. A six-row menu for everybody else is the
       * alignment menu plus the console's own three destinations.
       */
      {
        id: "nav-alignsynch",
        items: [
          /**
           * The marketing header's front-page row, kept apart from the rail's first row: `home`
           * is `/` and the public chrome draws it, while the sidebar opens on `dashboard` and
           * never asks for this id. One destination per row — a rail row labelled Home that went
           * to `/dashboard` is how the word stopped matching the page.
           */
          { id: "home", label: "Home" },
          { id: "dashboard", label: "Dashboard" },
          { id: "how-it-works", label: "How It Works" },
          { id: "my-relationships", label: "My Relationships" },
          { id: "template-library", label: "Library" },
          { id: "templates", label: "Templates" },
          /**
           * The public menu's fourth row. The sidebar does not ask for this id — it reads
           * Dashboard, How it works, My Relationships, Library, Templates, Support and then the
           * console's operator rows — and the word is shared deliberately: the marketing header
           * and the quiz brand's nav both say "Pricing", and a second spelling for one
           * destination is the drift a fixture avoids.
           */
          { id: "pricing", label: "Pricing" },
          { id: "support", label: "Support" },
          /**
           * The marketing header's help row (Help/Support split), and the same division the quiz
           * section above spells: `support` is the account page the rail opens, `help` is the
           * public FAQ and knowledge base. The rail never asks for this id, so a member's menu is
           * unchanged.
           */
          { id: "help", label: "Help" },
          { id: "console-gaps", label: "Gap Analysis" },
          { id: "admin-instances", label: "Relationships" },
          // #503 — the log the five repairs commit into. An operator's row, beside the registry
          // it audits, drawn only for `admin-console`.
          { id: "admin-audit", label: "Audit log" },
          // #505 — billing control: the plan each relationship carries, and the owner's comp.
          { id: "admin-billing", label: "Billing" },
          // #507 — the broadcast: a one-off notice to the news list.
          { id: "admin-broadcast", label: "Broadcast" },
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
      /**
       * The `/search` page's own body (issue #156 follow-up).
       *
       * The tab strip became brand-aware one card ago; the page under it still said "Search for
       * quizzes, categories, and more", promised "quizzes, categories, creators, and pages" in its
       * first sentence, and headed its result groups `Quizzes`, `Categories`, `Creators`, `Pages` —
       * the tab defect again, one band lower, plus a `Pages` heading that disagreed with the
       * `Assessments & pages` tab directly above it.
       *
       * Two sections under one id set, like `search` / `search-alignsynch`: the *view* asks for
       * `empty-pages-title` and each brand words it. The result-group headings are deliberately
       * **not** here — `components/search/search-results.tsx` resolves `group-quizzes` … `group-pages`
       * out of the selected `search` section, so a heading the palette prints and a heading the page
       * prints for the same group are one string. This section owns only the words the page says that
       * the palette does not: its title, its result count, its empty states and its no-query state.
       *
       * The alignment section carries no `difficulty*` items: the filter narrows the quiz rows of the
       * index (`querySearchIndex` applies it to quizzes only), the alignment index has none, and the
       * page does not draw a control that can only ever return the rows it already had. It carries no
       * `empty-quizzes-title`-style pairs either, because the strip above it has no such tab
       * (`search-tabs-alignsynch`) — the ids below are exactly the states this build can reach.
       */
      {
        id: "search-body",
        items: [
          { id: "title", label: "Search Results" },
          { id: "submit", label: "Search" },
          { id: "difficulty", label: "Difficulty" },
          { id: "difficulty-all", label: "All Difficulties" },
          { id: "difficulty-easy", label: "Easy" },
          { id: "difficulty-medium", label: "Medium" },
          { id: "difficulty-hard", label: "Hard" },
          { id: "results-count", label: '{count} results for "{query}"' },
          { id: "view-all", label: "View all ({count})" },
          { id: "popular-heading", label: "Popular searches" },
          { id: "no-query-title", label: "Search for quizzes, categories, and more" },
          /**
           * `across${brand.name}` — no space — is the sentence the quiz build has always
           * rendered: the JSX this section replaced put `{brand.name}` on its own line and JSX
           * trims a text node's trailing newline, so the page says "acrossQuizHub.". Kept
           * verbatim because this card's bar is a byte-identical QuizHub page; the missing space
           * is the quiz brand's copy to fix, not this card's to smuggle in.
           */
          {
            id: "no-query-body",
            label: `Enter a search term above to find quizzes, categories, creators, and pages across${brand.name}.`,
          },
          { id: "no-results-title", label: "No results found" },
          {
            id: "no-results-body",
            label:
              'We couldn\'t find anything matching "{query}". Try different keywords or check your spelling.',
          },
          { id: "empty-quizzes-title", label: "No quizzes found" },
          {
            id: "empty-quizzes-body",
            label: 'We couldn\'t find any quizzes matching "{query}".',
          },
          { id: "empty-categories-title", label: "No categories found" },
          {
            id: "empty-categories-body",
            label: 'We couldn\'t find any categories matching "{query}".',
          },
          { id: "empty-creators-title", label: "No creators found" },
          {
            id: "empty-creators-body",
            label: 'We couldn\'t find any creators matching "{query}".',
          },
          { id: "empty-pages-title", label: "No pages found" },
          {
            id: "empty-pages-body",
            label: 'We couldn\'t find any pages matching "{query}".',
          },
        ],
      },
      /**
       * The alignment build's `/search` body.
       *
       * `no-results-body` and `empty-pages-body` keep the second sentence the palette's own
       * `empty-hint` prints ("Try a different name — a template, a person, or a page."), so the
       * palette and the page do not explain the same empty state two different ways.
       */
      {
        id: "search-body-alignsynch",
        items: [
          { id: "title", label: "Search Results" },
          { id: "submit", label: "Search" },
          { id: "results-count", label: '{count} results for "{query}"' },
          { id: "view-all", label: "View all ({count})" },
          { id: "popular-heading", label: "Popular searches" },
          { id: "no-query-title", label: "Search assessments and pages" },
          {
            id: "no-query-body",
            label:
              "Enter a search term above to find an assessment by person or template, or a page by name.",
          },
          { id: "no-results-title", label: "No results found" },
          {
            id: "no-results-body",
            label:
              'Nothing here matches "{query}". Try a different name — a template, a person, or a page.',
          },
          { id: "empty-pages-title", label: "No assessments or pages found" },
          {
            id: "empty-pages-body",
            label:
              'Nothing here matches "{query}". Try a different name — a template, a person, or a page.',
          },
        ],
      },
      {
        id: "account",
        items: [
          /**
           * The account slot's *signed-out* state (#212). It is the only word the slot still
           * needs here: the signed-in person's name, handle and address come from that
           * request's session (`lib/auth/shell-account.ts`), because a copy fixture is the
           * wrong place to store a person — the four items this replaced (`initials`,
           * `display-name`, `display-handle`, `display-email`) painted a stranger over every page
           * behind the shell, including a demo admin's own board.
           *
           * `sign-up` is the second action the public header draws beside it: a visitor who is
           * not signed in gets one way back in and one way to start, both from the fixture. It
           * is not a second `signed-out` — the two links are different destinations, and a slot
           * that derived one from the other would have to spell an href in a component.
           */
          { id: "signed-out", label: "Sign In" },
          { id: "sign-up", label: "Sign Up" },
          { id: "profile", label: "My Profile" },
          { id: "profile-hint", label: "Account settings" },
          { id: "dashboard", label: "Dashboard" },
          { id: "dashboard-hint", label: "Your activity and stats" },
          /**
           * "My Quizzes" / "Your created quizzes". Both said "Quizes" until #188 — a
           * misspelling that shipped to every brand, because a typo is not a brand decision
           * and the fix is the same word on both. The rows are the quiz product's and only
           * render for a viewer who may see it, so the *word* stays quiz; it is its spelling
           * that moved.
           */
          { id: "quizzes", label: "My Quizzes" },
          { id: "quizzes-hint", label: "Your created quizzes" },
          { id: "settings", label: "Settings" },
          { id: "settings-hint", label: "Preferences" },
          { id: "logout", label: "Log out" },
          /**
           * The account menu's sign-out states. The menu's "Log out" is the same action the rail's
           * row performs, so it needs the same two words beside `logout` — the moment between the
           * click and the session ending, and the failure said out loud rather than swallowed
           * (issue #272's rule, on the header's control rather than the rail's).
           */
          { id: "logout-pending", label: "Signing out…" },
          { id: "logout-error", label: "Couldn't sign out. Try again." },
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
      /**
       * The sentence under the wordmark — the footer's own line, and the brand's.
       *
       * It reads as the product's promise, so it names the product's subject: quizzes and
       * quiz creators here, the two people and the Gap on the alignment brand. This is the
       * string issue #188 was filed on: it was the fixture's top-level `subtitle`, which the
       * projection could not select, so `BRAND=alignsynch` printed the quiz pitch in the
       * footer of every page.
       */
      {
        id: "footer-brand",
        body: "Create engaging quizzes, challenge others, and earn rewards for your knowledge. Join our community of quiz creators and players today.",
      },
      {
        id: "footer-brand-alignsynch",
        body: "The same five Aspects, answered by both of you: how it is now, and how you each wish it to be. Where the answers part is the Gap.",
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
          { id: "how-it-works", label: "How It Works" },
          /**
           * The footer's help row (Help/Support split). The footer is mounted by the public pages
           * *and* by four product pages, so this column carries the public destination — `help` —
           * and the rail's `support` row stays the account page. A marketing footer pointing at
           * the account page is the same mistake as a console row pointing at the marketing site.
           *
           * One row, not two: "Support" and "Help" beside each other in a four-row column is the
           * same question asked twice, and the split exists so that one URL is not two pages.
           */
          { id: "help", label: "Help" },
        ],
      },
      {
        id: "footer-categories",
        heading: "Categories",
      },
      {
        id: "footer-contact",
        heading: "Contact",
        /**
         * **A form, not a mailbox** (owner, 2026-11-02). This block printed the brand record's
         * address as a dead row — a string on every page of both builds, and on the AlignSynch
         * side one a visitor could not write to without a mail client. The contact path is one
         * link to the contact form, and the fixture names no address at all: an address no
         * fixture carries cannot be printed by accident.
         *
         * The street line and the telephone number left in #272 for the same reason: neither was
         * a fact. `cta.href` is checked against the route manifest by E23, so the row cannot
         * outlive the page it points at.
         */
        body: "Send us a message from the contact form and we will reply to the address you leave.",
        cta: { label: "Contact us", href: "/help" },
      },
      /**
       * The alignment brand's contact block — the same shape, because the footer resolves one
       * section either way.
       *
       * It differs in nothing but the words the brands do not share. Neither section names a
       * mailbox: `supportEmail` is the contact form's *recipient*, read on the server by
       * `app/api/contact/route.ts`, and a rendering rule that kept it out of one brand's footer
       * and not the other's would be the same defect with a brand check in front of it.
       */
      {
        id: "footer-contact-alignsynch",
        heading: "Contact",
        body: "Send us a message from the contact form and we will reply to the address you leave.",
        cta: { label: "Contact us", href: "/help" },
      },
      /**
       * The footer's news band — the second life of the box #272 removed.
       *
       * #272 deleted it because it took an address and the button had no handler: a promise of
       * delivery with no sender behind it. The band is back because the sender is real now —
       * `app/api/news/subscribe/route.ts` writes the row and `lib/news/message.ts` sends through
       * the one transport in `lib/flow/email.ts` — and it lives in the *footer* rather than on a
       * band of `/`, so it appears on every marketing page and on the three product pages that
       * mount the same footer.
       *
       * Six of these items are the six states the route can answer with, and the mapping is
       * one-to-one (`components/layout/news-signup.tsx`): a person is never told their address
       * was kept when it was not, and never told it was lost when it was kept. `duplicate` is a
       * sentence about nothing having changed, because a second submit sending a second
       * confirmation would be a spam loop with a friendly face.
       *
       * **The body claims no cadence.** "No schedule" is the phrase, because nobody has
       * committed to one and a fixture is not the place to invent one. The two `confirm-*` items
       * are the email itself: what the person asked for, that this note confirms it, and how to
       * stop — the only two facts a subscription note owes a reader.
       */
      {
        id: "footer-news",
        heading: "Product news",
        body: "A note when we ship something that changes how the product works. No schedule, and every message says how to stop.",
        items: [
          { id: "field-label", label: "Email address" },
          /**
           * No address-shaped placeholder (owner, 2026-11-02): the sweep in
           * `tests/public-contact.test.tsx` reads every string in this fixture for an
           * address, and `you@example.com` is one — a placeholder a visitor can copy is the
           * same harvestable string as a real one, and it is not an address this product owns.
           */
          { id: "placeholder", label: "Where should we send it?" },
          { id: "submit", label: "Sign Up" },
          { id: "pending", label: "Signing up…" },
          { id: "back", label: "Back to the page" },
          {
            id: "subscribed",
            label: "You're on the list. A confirmation is on its way to that address.",
          },
          {
            id: "duplicate",
            label:
              "That address was already on the list — nothing changed, and nothing was sent again.",
          },
          {
            id: "send-failed",
            label:
              "You're on the list. We couldn't send the confirmation, so there may be nothing in your inbox.",
          },
          { id: "invalid", label: "That doesn't look like an email address. Nothing was saved." },
          {
            id: "storage-failed",
            label: "We couldn't save that just now. Nothing was stored — try again in a moment.",
          },
          { id: "confirm-subject", label: "You're on the {brand} product news list" },
          {
            id: "confirm-body",
            label:
              "You asked for product news from {brand}, so the address {email} is on the list.\n\nWe send a note when something in the product changes, and nothing on a schedule. To stop receiving them, reply to this message or write to {support} and the address is removed.\n\nThis is the only message you will get until we ship something.",
          },
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
      /**
       * The version badge (issue #269) — the words the sidebar and the footer print under the
       * build's version number.
       *
       * One section for both mounts because both read this one instance: a sidebar that said
       * "Version" and a footer that said "Build" would be two names for one fact. It is not
       * brand-selected — a version is the same fact on both builds, and the tag it links to is
       * one tag.
       *
       * `{version}` is filled by `AppVersion` from `next.config.mjs`'s `APP_VERSION` (itself
       * `package.json`'s `version`) and is never typed here: a version spelled in a fixture is
       * a second source, which is the defect the card forbids. `compact` is the collapsed
       * rail's short form — 70 px of sidebar cannot hold the long one, and clipping a label is
       * not a style — and `title` is the accessible name of the link, so a screen reader hears
       * where it goes as well as which build it is.
       */
      {
        id: "version",
        items: [
          { id: "label", label: "Version {version}" },
          { id: "compact", label: "v{version}" },
          { id: "title", label: "Open the v{version} release notes on GitHub" },
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
