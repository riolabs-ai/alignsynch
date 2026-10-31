import { ExploreQuizzesPage } from "@/components/explore/explore-quizzes-page";
import { explorePageCopy } from "@/data/pages/explore";
import { requireQuizProduct } from "@/lib/brand-boundary";
import type { Metadata } from "next";

/** The route's title is its own heading (`data/pages/explore.ts`). */
export const metadata: Metadata = {
  title: "Explore Quizzes",
};

/**
 * Request-time, not static (P3b).
 *
 * `explore-page/popular[1]` is one of the two slots a campaign addresses, and the
 * page's merchandised section (`ExploreFeatured`) projects `explorePopular` at the
 * render instant. A static prerender would evaluate that instant at **build** time:
 * the served HTML would carry the catalog snapshot for the whole campaign window, and
 * a build made *inside* the window would freeze the campaign numbers into the page for
 * good. `/explore/featured` is request-time for the same reason; this is its sibling
 * slot, so it takes the same clock.
 *
 * The cost is one prerendered page: `/explore` was static before this change, and is
 * the only route whose static-ness this card gives up (see AGENTS.md's route table and
 * MIGRATION.md).
 */
export const dynamic = "force-dynamic";

export default function ExplorePage() {
  // Quiz-only (#300): the catalogue is the quiz product's front door.
  requireQuizProduct();
  // One instant for the whole page: server render and hydration project the same
  // campaigns at the same clock (see `ExploreQuizzesPage`'s `now`).
  return <ExploreQuizzesPage now={new Date().toISOString()} copy={explorePageCopy} />;
}
