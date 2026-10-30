import { SearchResults } from "@/components/search/search-results";
import { brand, brandIdOf } from "@/data/brand";
import { shellPageCopy } from "@/data/pages/shell";
import { searchIndexFor } from "@/data/searchdata";
import { navViewer } from "@/lib/nav";
import { itemLabel } from "@/lib/page-copy";
import { searchSectionFor, searchTabsFor } from "@/lib/shell-copy";

/**
 * `/search` — the page the palette's "view all" opens.
 *
 * It renders the *brand's* index and the *brand's* words (issue #156), both resolved here on
 * the server: `data/searchdata.ts` builds the catalog for this brand and viewer, and
 * `lib/shell-copy.ts` picks the section of `data/pages/shell.ts` the field is labelled from.
 * The page used to spell "Search quizzes, categories, creators..." in its own field and
 * advertise the same in its document description, on a build that has no quizzes.
 *
 * The tab strip follows the same two rules (issue #156 follow-up): `searchTabsFor` hands it the
 * brand's labels, and the strip itself lists the groups this brand's index can fill — the
 * alignment build has an "Assessments & pages" tab and no "Quizzes" tab, because there is no
 * quiz row behind one.
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
  const searchCopy = searchSectionFor(shellPageCopy, brandId);

  // The index is built here (server) and handed to the client component as data: the page
  // never imports the fixtures into the browser bundle, and the component owns no catalog.
  return (
    <SearchResults
      query={q ?? ""}
      index={searchIndexFor(brandId, navViewer())}
      placeholder={itemLabel(searchCopy, "placeholder")}
      tabs={searchTabsFor(shellPageCopy, brandId)}
    />
  );
}
