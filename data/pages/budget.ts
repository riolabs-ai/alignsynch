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
    page: "app/(mainlayout)/page.tsx",
    dirs: ["components/home", "components/categories"],
    fixture: "data/pages/home",
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
    page: "app/(mainlayout)/pricing/page.tsx",
    dirs: ["components/pricing"],
    fixture: "data/pages/pricing",
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
    page: "app/(mainlayout)/support/page.tsx",
    dirs: ["components/support"],
    fixture: "data/pages/support",
    budget: 0,
  },
  "/support/articles/[slug]": {
    page: "app/(mainlayout)/support/articles/[slug]/page.tsx",
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
  shell: {
    page: "app/(mainlayout)/layout.tsx",
    mounts: ["components/layout/footer.tsx"],
    dirs: ["components/layout", "components/header"],
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
});
