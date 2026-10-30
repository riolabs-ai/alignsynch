/**
 * The shell's brand-selected copy (issue #156).
 *
 * The shell fixture (`data/pages/shell.ts`) carries one *section* per brand where the words
 * differ, and the modules that render them are shared. The choice has to live in one place or
 * the header palette and the `/search` page drift: they are the same search field, one in the
 * chrome and one on a route, and a page that said "Search assessments" while its header said
 * "Search quizzes" would be the bug this module exists to prevent.
 *
 * Only type imports cross into `content/` or `data/` here — a value import of `data/brand`
 * would put zod in the browser bundle, which is why the brand id arrives as an argument.
 */
import type { PageCopy, PageCopySection } from "@/content/pages";
import type { BrandId } from "@/data/brand";
import { sectionOf } from "./page-copy";

/**
 * The search words this brand's palette and `/search` page render.
 *
 * The two sections declare the same item ids, so the components resolve one set of ids and
 * only the words move. `data/searchdata.ts` builds the matching index; the placeholder and the
 * group heading are the promise it has to keep.
 */
export function searchSectionFor(copy: PageCopy, brandId: BrandId): PageCopySection {
  switch (brandId) {
    case "quizhub":
      return sectionOf(copy, "search");
    case "alignsynch":
      return sectionOf(copy, "search-alignsynch");
    default: {
      // A brand added to `data/brand.ts` without palette words lands here and fails `tsc`.
      const unhandled: never = brandId;
      throw new Error(`no search copy for brand ${String(unhandled)}`);
    }
  }
}
