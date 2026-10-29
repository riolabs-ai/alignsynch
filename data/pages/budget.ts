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
 * `/` also attributes `components/categories`, because the home page renders the
 * how-it-works band that lives there (WU-8). Attribution is reachability, so only
 * `categories-how-it-works.tsx` joins the count; the rest of the directory belongs to
 * `/categories` and `/categories/[slug]`, which name the same directory and pick up
 * only what their own page modules import.
 */
import { zPageCopyBudget, type PageCopyBudget } from "../../content/pages";

export const pageCopyBudget: PageCopyBudget = zPageCopyBudget.parse({
  "/": {
    page: "app/(mainlayout)/page.tsx",
    dirs: ["components/home", "components/categories"],
    fixture: "data/pages/home",
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
});
