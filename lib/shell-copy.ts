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
import type { SearchIndex } from "@/content/search";
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

/**
 * The `/search` page's tabs, in the order the page renders them (issue #156 follow-up).
 *
 * `all` is first and always present; a group tab is listed only when the index the page was
 * handed holds at least one record of that group. The brand does not decide this — the *data*
 * does, which is what keeps the strip honest for a third brand without an edit here: a build
 * whose index carries no quiz cannot grow a "Quizzes" tab that filters nothing, and the quiz
 * build keeps every tab it shipped. The page maps these ids over
 * `searchTabsFor(...)` for the words and over `querySearchIndex(...)` for the counts.
 */
export const SEARCH_TAB_IDS = ["all", "quizzes", "categories", "creators", "pages"] as const;

export type SearchTabId = (typeof SEARCH_TAB_IDS)[number];

/** Does this index hold any record of that group? `all` always does. */
const TAB_HAS_RECORDS: Record<SearchTabId, (index: SearchIndex) => boolean> = {
  all: () => true,
  quizzes: (index) => index.quizzes.length > 0,
  categories: (index) => index.categories.length > 0,
  creators: (index) => index.creators.length > 0,
  pages: (index) => index.pages.length > 0,
};

/** The tab ids one index can fill, in the strip's own order. */
export function searchTabIds(index: SearchIndex): SearchTabId[] {
  return SEARCH_TAB_IDS.filter((id) => TAB_HAS_RECORDS[id](index));
}

/**
 * The tab labels this brand's `/search` page renders — the section that words them.
 *
 * The alignment section declares `all` and `pages` only, because those are the tabs
 * `searchTabIds` can select on that build's index; asking it for a quiz word would be asking
 * for a tab that never renders. `searchTabsFor` still returns one section per brand and the
 * page resolves the ids `searchTabIds` produced, so the two sides meet on an id and a label
 * the brand chose rather than on a literal in the component (E23).
 */
export function searchTabsFor(copy: PageCopy, brandId: BrandId): PageCopySection {
  switch (brandId) {
    case "quizhub":
      return sectionOf(copy, "search-tabs");
    case "alignsynch":
      return sectionOf(copy, "search-tabs-alignsynch");
    default: {
      const unhandled: never = brandId;
      throw new Error(`no search tab copy for brand ${String(unhandled)}`);
    }
  }
}
