/**
 * The per-surface copy budget (E23) — the ratchet the later copy units turn.
 *
 * For each surface with a `PageCopy` fixture this records the files the copy owns and
 * the number of leaf literals still allowed inside them:
 *
 *   page      the module Next mounts the surface from — a page, a layout, or a special
 *             file (`app/not-found.tsx`)
 *   mounts    further modules that mount the same copy. Only the shell has them: its
 *             header and sidebar hang off `app/(mainlayout)/layout.tsx`, but its footer
 *             is rendered by the pages, so `components/layout/footer.tsx` is a second
 *             mount of the one `data/pages/shell.ts`. Without it the footer's strings
 *             would be attributed to nobody.
 *   dirs      the directories whose *reachable* files are attributed to the surface.
 *             Reachability matters: a component nobody imports is not this surface's
 *             copy, and counting it would make two cards fight over one number. WU-12
 *             deleted the fourteen unimported components, which is exactly why
 *             attribution asks the import graph instead of listing a directory. Every
 *             surface here declares one: even the 404 renders `components/not-found/*`,
 *             and an empty `dirs` whose module imports a component is a red build.
 *   fixture   must be reachable from `page` or a mount; that is the proof the copy is
 *             wired in
 *   budget    leaf literals still tolerated. **Measured, then recorded.** A unit lowers
 *             it; raising it is a reviewable diff (the check compares the tree against
 *             this number, it never re-baselines itself).
 *
 * `"/"` measured 87 literals before WU-6 and 0 after — every string the page's own
 * components rendered now lives in `data/pages/home.ts`. The budget stays 0: the next
 * literal added to `components/home/**` that a page renders is a red build.
 *
 * `/` also attributes `components/categories`, because the home page renders the
 * how-it-works band that lives there (WU-8). Attribution is reachability, so only
 * `categories-how-it-works.tsx` joins the count; the rest of the directory belongs to
 * `/categories` and `/categories/[slug]`, which name the same directory and pick up
 * only what their own page modules import.
 *
 * WU-7 took the shell, `/login`, `/register` and the 404 to 0 the same way, so every
 * surface in this table is at 0 and the next literal added to any of them is a red
 * build. `shell` and `not-found` are the two declared non-route surfaces
 * (`NON_ROUTE_COPY_SURFACES` in `content/pages.ts`).
 *
 * WU-9 recorded the same 0 for the five marketing surfaces it moved: 184 literal strings
 * across 30 components became 8 fixtures, and the two news routes and the two support
 * routes that share one component directory each measured 0 on their own import closure.
 * A row here is per *surface*, so a shared band is counted once per surface that reaches
 * it — that is the number that has to stay at 0 when the next band is added to either page.
 */
import { zPageCopyBudget, type PageCopyBudget } from "../../content/pages";

export const pageCopyBudget: PageCopyBudget = zPageCopyBudget.parse({
  "/": {
    page: "app/(marketing)/page.tsx",
    dirs: ["components/home", "components/categories"],
    fixture: "data/pages/home",
    budget: 0,
  },
  "/admin/gaps": {
    page: "app/(mainlayout)/admin/gaps/page.tsx",
    dirs: ["components/console"],
    fixture: "data/pages/admin-gaps",
    budget: 0,
  },
  // Card 3/5 of the console: the operator's relationship registry. Budget 0 from the first
  // commit, like the flow surfaces — the heading, the nine column labels, the five seat states,
  // the five stage tabs, the two selects' options, the count sentence and the three
  // empty/failure states are all `data/pages/admin-instances.ts`, so the next literal written in
  // the table is a red build.
  "/admin/instances": {
    page: "app/(mainlayout)/admin/instances/page.tsx",
    dirs: ["components/admin"],
    fixture: "data/pages/admin-instances",
    budget: 0,
  },
  "/battle": {
    page: "app/(mainlayout)/battle/page.tsx",
    dirs: ["components/battle"],
    fixture: "data/pages/battle",
    budget: 0,
  },
  "/categories": {
    page: "app/(mainlayout)/categories/page.tsx",
    dirs: ["components/categories"],
    fixture: "data/pages/categories",
    budget: 0,
  },
  "/categories/[slug]": {
    page: "app/(mainlayout)/categories/[slug]/page.tsx",
    dirs: ["components/categories"],
    fixture: "data/pages/category-detail",
    budget: 0,
  },
  "/daily-challenge": {
    page: "app/(mainlayout)/daily-challenge/page.tsx",
    dirs: ["components/daily-challenge"],
    fixture: "data/pages/daily-challenge",
    budget: 0,
  },
  "/dashboard/user": {
    page: "app/(mainlayout)/dashboard/user/page.tsx",
    dirs: ["components/identity"],
    fixture: "data/pages/dashboard",
    budget: 0,
  },
  /**
   * `/dashboard` — the console's Overview (Console 2/5), and the first surface whose four figures
   * are counts rather than authored metrics. Budget 0 from the first commit: the card labels, the
   * three one-line explanations, the empty band and the failure panel are all
   * `data/pages/overview.ts`, so the next sentence written in `components/console/**` is a red
   * build. `dirs` is only the new domain — `/dashboard/user`'s `components/identity` stays
   * attributed to that surface, and the two consoles cannot lend each other words.
   */
  "/dashboard": {
    page: "app/(mainlayout)/dashboard/page.tsx",
    dirs: ["components/console"],
    fixture: "data/pages/overview",
    budget: 0,
  },
  "/explore": {
    page: "app/(mainlayout)/explore/page.tsx",
    dirs: ["components/explore"],
    fixture: "data/pages/explore",
    budget: 0,
  },
  "/explore/featured": {
    page: "app/(mainlayout)/explore/featured/page.tsx",
    dirs: ["components/explore"],
    fixture: "data/pages/explore-featured",
    budget: 0,
  },
  "/login": {
    page: "app/(auth)/login/page.tsx",
    dirs: ["components/auth"],
    fixture: "data/pages/login",
    budget: 0,
  },
  "/register": {
    page: "app/(auth)/register/page.tsx",
    dirs: ["components/auth"],
    fixture: "data/pages/register",
    budget: 0,
  },
  "/affiliate": {
    page: "app/(mainlayout)/affiliate/page.tsx",
    dirs: ["components/affiliate"],
    fixture: "data/pages/affiliate",
    budget: 0,
  },
  "/pricing": {
    page: "app/(marketing)/pricing/page.tsx",
    dirs: ["components/pricing"],
    fixture: "data/pages/pricing",
    budget: 0,
  },
  "/profile/[username]": {
    page: "app/(mainlayout)/profile/[username]/page.tsx",
    // Only the identity components this card added. The demo branch still renders the fixture
    // profile view (`components/profile/**`), which holds 132 unreviewed literals and several
    // sentences — attributing that directory here would fail the length rule in this card
    // instead of leaving it where it is: pre-existing copy debt with its own unit. The ratchet
    // still applies to everything new, which is what "budget 0" means for this surface.
    dirs: ["components/identity"],
    fixture: "data/pages/profile",
    budget: 0,
  },
  "/settings": {
    page: "app/(mainlayout)/settings/page.tsx",
    dirs: ["components/identity"],
    fixture: "data/pages/settings",
    budget: 0,
  },
  "/news": {
    page: "app/(mainlayout)/news/page.tsx",
    dirs: ["components/news"],
    fixture: "data/pages/news",
    budget: 0,
  },
  "/news/[slug]": {
    page: "app/(mainlayout)/news/[slug]/page.tsx",
    dirs: ["components/news"],
    fixture: "data/pages/news-article",
    budget: 0,
  },
  "/support": {
    page: "app/(marketing)/support/page.tsx",
    dirs: ["components/support"],
    fixture: "data/pages/support",
    budget: 0,
  },
  "/support/articles/[slug]": {
    page: "app/(marketing)/support/articles/[slug]/page.tsx",
    dirs: ["components/support"],
    fixture: "data/pages/support-article",
    budget: 0,
  },
  "/creator-tips": {
    page: "app/(mainlayout)/creator-tips/page.tsx",
    dirs: ["components/creator-tips"],
    fixture: "data/pages/creator-tips",
    budget: 0,
  },
  "/creator-tips/[slug]": {
    page: "app/(mainlayout)/creator-tips/[slug]/page.tsx",
    dirs: ["components/creator-tips"],
    fixture: "data/pages/creator-tips-detail",
    budget: 0,
  },
  /**
   * The two legal pages (issue #270). One component directory serves both routes, because they
   * are one document in two shapes: the draft banner, the heading, the section stack and the
   * paragraph/list vocabulary are shared, and only the fixture differs. `fixture` is the module
   * the page imports, which is also where the brand record is read — so `BRAND=quizhub` and
   * `BRAND=alignsynch` validate different words against the same budget.
   */
  "/privacy": {
    page: "app/(marketing)/privacy/page.tsx",
    dirs: ["components/legal"],
    fixture: "data/pages/legal",
    budget: 0,
  },
  "/terms": {
    page: "app/(marketing)/terms/page.tsx",
    dirs: ["components/legal"],
    fixture: "data/pages/legal",
    budget: 0,
  },
  shell: {
    page: "app/(mainlayout)/layout.tsx",
    mounts: ["components/layout/footer.tsx"],
    dirs: ["components/layout", "components/header"],
    fixture: "data/pages/shell",
    budget: 0,
  },
  /**
   * `/search` — the one route whose copy lives in the shell's fixture (issue #156 follow-up).
   *
   * The search field, the four result-group headings and the page's own empty states are one
   * vocabulary: the palette and the route word the same groups, and two fixtures would let
   * "Pages" and "Assessments & pages" describe the same rows. So the surface names
   * `data/pages/shell` as its fixture, exactly as the two `search` / `search-alignsynch` sections
   * are shared today, and E23 attributes this route's own component directory
   * (`components/search/**`) to it. `data/pages/index.ts` maps `"/search"` to the same instance
   * for the same reason — a budget with no copy entry is a stale slot, and the copy it points at
   * is the instance the page renders.
   *
   * Budget 0, measured: the body's title, result count, empty states, no-query state and the
   * difficulty filter's options were all literals in `components/search/search-results.tsx`
   * before this card, and the tabs had already moved out one card earlier. The two quiz-only
   * count labels (`{n} quiz` / `{n} quizzes`) inside the category and creator cards are
   * string literals in an *expression*, which E23's leaf rule does not read; they are on the
   * list for the card that gives an alignment build a category or a creator.
   */
  "/search": {
    page: "app/(mainlayout)/search/page.tsx",
    dirs: ["components/search"],
    fixture: "data/pages/shell",
    budget: 0,
  },
  "not-found": {
    page: "app/not-found.tsx",
    dirs: ["components/not-found"],
    fixture: "data/pages/not-found",
    budget: 0,
  },
  "/tournaments": {
    page: "app/(mainlayout)/tournaments/page.tsx",
    dirs: ["components/tournaments"],
    fixture: "data/pages/tournaments",
    budget: 0,
  },
  "/tournaments/[id]": {
    page: "app/(mainlayout)/tournaments/[id]/page.tsx",
    dirs: ["components/tournaments"],
    fixture: "data/pages/tournament-detail",
    budget: 0,
  },
  // #146 moved the two-party flow's words out as they were written: the three new
  // surfaces measure 0, and the ratchet starts there rather than at a number a later unit
  // would have to lower.
  "/assessment": {
    page: "app/(mainlayout)/assessment/page.tsx",
    dirs: ["components/assessment-flow"],
    fixture: "data/pages/assessment",
    budget: 0,
  },
  "/assessment/instances": {
    page: "app/(mainlayout)/assessment/instances/page.tsx",
    dirs: ["components/assessment-flow"],
    fixture: "data/pages/assessment-instances",
    budget: 0,
  },
  "/assessment/instances/[instanceId]": {
    page: "app/(mainlayout)/assessment/instances/[instanceId]/page.tsx",
    dirs: ["components/assessment-flow"],
    fixture: "data/pages/assessment-instance",
    budget: 0,
  },
  // #255 — the template authoring form. Budget 0 from the first commit, for the reason the
  // three flow surfaces above are: every word is in `data/pages/assessment-template-new.ts`,
  // including the six refusals, so the next literal written in the form is a red build.
  // #console 5/5 — the template library and one template. Two surfaces, one read each, budget 0
  // from the first commit: every word is in `data/pages/assessment-templates.ts` and
  // `data/pages/assessment-template-detail.ts`, so the next literal written in either component
  // is a red build.
  "/assessment/templates": {
    page: "app/(mainlayout)/assessment/templates/page.tsx",
    dirs: ["components/assessment-flow"],
    fixture: "data/pages/assessment-templates",
    budget: 0,
  },
  "/assessment/templates/[templateId]": {
    page: "app/(mainlayout)/assessment/templates/[templateId]/page.tsx",
    dirs: ["components/assessment-flow"],
    fixture: "data/pages/assessment-template-detail",
    budget: 0,
  },
  "/assessment/templates/new": {
    page: "app/(mainlayout)/assessment/templates/new/page.tsx",
    dirs: ["components/assessment-flow"],
    fixture: "data/pages/assessment-template-new",
    budget: 0,
  },
  "/invite/[token]": {
    page: "app/(mainlayout)/invite/[token]/page.tsx",
    dirs: ["components/assessment-flow"],
    fixture: "data/pages/invite",
    budget: 0,
  },
  /**
   * The marketing landing page (#159) — the first surface in this table that is not a product
   * route, and the reason `mounts` exists for a second caller.
   *
   * Its chrome hangs off `app/(marketing)/layout.tsx`, which is not the page Next renders, so the
   * layout is a mount: without it the header's CTA label and the footer's two strings would be
   * attributed to nobody. The one directory it owns is `components/marketing/**`, which the layout
   * and the page both import.
   *
   * Budget 0, measured not assumed: the seven bands' words are `data/pages/marketing.ts`, the brand
   * name is `brand.name`, the two limits are fixture items, and the only other strings the built
   * HTML carries are the address (`brand.supportEmail`) and Tailwind class names.
   */
  "/welcome": {
    page: "app/(marketing)/welcome/page.tsx",
    mounts: ["app/(marketing)/layout.tsx"],
    dirs: ["components/marketing"],
    fixture: "data/pages/marketing",
    budget: 0,
  },
});
