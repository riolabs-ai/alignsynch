import { FeaturedQuizzesPage } from "@/components/explore/featured-quizzes-page";
import { exploreFeaturedPageCopy } from "@/data/pages/explore-featured";
import { requireQuizProduct } from "@/lib/brand-boundary";
import type { Metadata } from "next";

/** The route's title is its own heading (`data/pages/explore-featured.ts`). */
export const metadata: Metadata = {
  title: "Featured Quizzes",
};

/**
 * Request-time, not static (P3).
 *
 * `featuredPopular[1]` is one of the two slots a campaign addresses, and
 * `FeaturedQuizzesPage` projects its cards at the render instant (`shelfCards()` with
 * no pinned clock). A static prerender would evaluate that instant at **build** time:
 * the served HTML would carry the catalog snapshot for the whole campaign window, and
 * a build made *inside* the window would freeze the campaign numbers into the page for
 * good. Request-time rendering makes the HTML a crawler or the first paint receives
 * agree with what the browser hydrates — still two clocks (server request, client
 * hydrate), but no longer a build-time one.
 */
export const dynamic = "force-dynamic";

export default function FeaturedPage() {
  // Quiz-only (#300), gated before the clock is read: the alignment build answers 404 and
  // never projects a campaign it does not sell.
  requireQuizProduct();
  // One instant for the whole page: server render and hydration project the same
  // campaigns at the same clock (see `FeaturedQuizzesPage`'s `now`).
  return <FeaturedQuizzesPage now={new Date().toISOString()} copy={exploreFeaturedPageCopy} />;
}
