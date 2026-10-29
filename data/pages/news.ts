/**
 * `/news` — the news index's copy.
 *
 * `NewsPage` owns the route's hero (the `h1` and the sentence under it), so it takes
 * the whole `PageCopy`; every other string the index renders is an `item` of the one
 * band it belongs to — `article-list` is the article listing, from the search field
 * below the hero down to the empty state under the grid.
 *
 * Records are not here: the article titles, summaries, dates, covers and category
 * badges come from `data/news-data.ts`, and the tab labels for the taxonomy come from
 * that module's `categories`. Only the words the listing itself renders — the "All"
 * tab above the data-driven tabs, the "Featured" badge, "Read more", the "min read"
 * suffix beside a computed number, and the empty state — are copy.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const newsPageCopy: PageCopy = zPageCopy.parse({
  heading: "Quiz News & Updates",
  subtitle: "Stay updated with the latest quiz trends, updates, and community news",
  sections: [
    {
      id: "article-list",
      heading: "Featured Articles",
      items: [
        { id: "search-placeholder", label: "Search articles..." },
        { id: "tab-all", label: "All" },
        { id: "featured-badge", label: "Featured" },
        { id: "read-more", label: "Read more" },
        { id: "min-read", label: "min read" },
        { id: "empty-heading", label: "No articles found" },
        {
          id: "empty-body",
          label: "Try adjusting your search or filter to find what you're looking for.",
        },
      ],
    },
  ],
});
