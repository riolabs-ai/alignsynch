/**
 * The per-route copy budget (E23) — the ratchet the later copy units turn.
 *
 * For each route with a `PageCopy` fixture this records the surface the copy owns
 * and the number of leaf literals still allowed inside it:
 *
 *   page      the route module the attribution walks from (the `page.tsx` Next renders)
 *   dirs      the directories whose *reachable* files are attributed to the route.
 *             Reachability matters: `components/home/` still holds five components
 *             no page imports (WU-12 deletes them), and their literals are not this
 *             route's — the import closure excludes them, so the two cards never
 *             fight over the same number.
 *   fixture   must be reachable from `page`; that is the proof the copy is wired in
 *   budget    leaf literals still tolerated. **Measured, then recorded.** A unit
 *             lowers it; raising it is a reviewable diff (the check compares the
 *             tree against this number, it never re-baselines itself).
 *
 * `"//"` measured 87 literals before WU-6 and 0 after — every string the page's own
 * components rendered now lives in `data/pages/home.ts`. The budget stays 0: the
 * next literal added to `components/home/**` that a page renders is a red build.
 */
import { zPageCopyBudget, type PageCopyBudget } from "../../content/pages";

export const pageCopyBudget: PageCopyBudget = zPageCopyBudget.parse({
  "/": {
    page: "app/(mainlayout)/page.tsx",
    dirs: ["components/home"],
    fixture: "data/pages/home",
    budget: 0,
  },
});
