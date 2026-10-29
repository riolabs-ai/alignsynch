/**
 * The per-route copy budget (E23) — the ratchet the later copy units turn.
 *
 * For each route with a `PageCopy` fixture this records the surface the copy owns
 * and the number of leaf literals still allowed inside it:
 *
 *   page      the route module the attribution walks from (the `page.tsx` Next renders)
 *   dirs      the directories whose *reachable* files are attributed to the route.
 *             Reachability matters: a component nobody imports is not this route's
 *             copy, and counting it would make two cards fight over one number.
 *             WU-12 deleted the fourteen unimported components, which is exactly
 *             why attribution asks the import graph instead of listing a directory.
 *   fixture   must be reachable from `page`; that is the proof the copy is wired in
 *   budget    leaf literals still tolerated. **Measured, then recorded.** A unit
 *             lowers it; raising it is a reviewable diff (the check compares the
 *             tree against this number, it never re-baselines itself).
 *
 * `"/"` measured 87 literals before WU-6 and 0 after — every string the page's own
 * components rendered now lives in `data/pages/home.ts`. The budget stays 0: the
 * next literal added to `components/home/**` that a page renders is a red build.
 *
 * WU-9 (#56) recorded the same 0 for the five marketing surfaces it moved: 184
 * literal strings across 30 components became 8 fixtures, and the two news routes
 * and the two support routes that share one component directory each measured 0 on
 * their own import closure. A row here is per *route*, so a shared band is counted
 * once per route that reaches it — that is the number that has to stay at 0 when
 * the next band is added to either page.
 */
import { zPageCopyBudget, type PageCopyBudget } from "../../content/pages";

export const pageCopyBudget: PageCopyBudget = zPageCopyBudget.parse({
  "/": {
    page: "app/(mainlayout)/page.tsx",
    dirs: ["components/home"],
    fixture: "data/pages/home",
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
  "/support/articles/[id]": {
    page: "app/(mainlayout)/support/articles/[id]/page.tsx",
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
});
