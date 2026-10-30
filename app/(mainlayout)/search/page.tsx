import { SearchResults } from "@/components/search/search-results";
import { brand, brandIdOf } from "@/data/brand";
import { shellPageCopy } from "@/data/pages/shell";
import { searchIndexFor } from "@/data/searchdata";
import { navViewer } from "@/lib/nav";
import { searchBodyFor, searchSectionFor, searchTabsFor } from "@/lib/shell-copy";

/**
 * `/search` — the page the palette's "view all" opens.
 *
 * It renders the *brand's* index and the *brand's* words (issue #156 and its follow-up), both
 * resolved here on the server: `data/searchdata.ts` builds the catalog for this brand and viewer,
 * and `lib/shell-copy.ts` picks the sections of `data/pages/shell.ts` the page is worded from.
 * The page used to spell "Search quizzes, categories, creators..." in its own field and advertise
 * the same in its document description, on a build that has no quizzes.
 *
 * Three sections arrive as props, each chosen by brand on the server:
 *
 *   `groups`  the palette's own search words — the field's placeholder and the four result-group
 *             headings. The page resolves the same ids the header does, so the group over the
 *             alignment build's rows says "Assessments & pages", the same as its tab.
 *   `tabs`    the tab strip's labels; which tabs render is `searchTabIds(index)`, the groups the
 *             index can actually fill.
 *   `copy`    the body's own words — title, result count, empty states, no-query state.
 *
 * The document description is deliberately not overridden: the root layout prints
 * `brand.description`, which is already the brand's own sentence, and a second one here would be
 * a second source of truth for what the product is.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const brandId = brandIdOf(brand);

  // The index is built here (server) and handed to the client component as data: the page
  // never imports the fixtures into the browser bundle, and the component owns no catalog.
  return (
    <SearchResults
      query={q ?? ""}
      index={searchIndexFor(brandId, navViewer())}
      copy={searchBodyFor(shellPageCopy, brandId)}
      groups={searchSectionFor(shellPageCopy, brandId)}
      tabs={searchTabsFor(shellPageCopy, brandId)}
    />
  );
}
