import { FeaturedQuizzesPage } from "@/components/explore/featured-quizzes-page";

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
  return <FeaturedQuizzesPage />;
}
