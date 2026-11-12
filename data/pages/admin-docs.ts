/**
 * `/admin/docs` — the documentation hub's words (#892).
 *
 * The screen is a *renderer* of `docs/docs.json`: the section titles, the blurbs and every document's
 * title and question are the manifest's, because `scripts/docs-check.mjs` already holds that file to
 * the tree. What belongs here is what the manifest cannot say — the filter's placeholder, the
 * sentence an empty filter gets, the two singular/plural counts, and the panel a reader sees when the
 * graph itself cannot be built.
 *
 * `{placeholders}` are filled by the view with what it counted (`lib/page-copy.ts::fillLabel`); no
 * sentence here bakes in a number, so 117 documents today and 130 tomorrow need no fixture edit.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const adminDocsPageCopy: PageCopy = zPageCopy.parse({
  heading: "Documentation",
  subtitle:
    "Every page under docs/, grouped by the question it answers. The tree is the gate's own: this screen renders the manifest, it never keeps a second copy of the navigation.",
  sections: [
    {
      id: "hub",
      heading: "By section",
      body: "Nine sections, read live from docs/docs.json. A page added to the tree and the manifest appears here on the next request — a page added to only one of them fails pnpm docs:check.",
      items: [
        { id: "search-placeholder", label: "Filter by title or question" },
        { id: "search-clear", label: "Clear filter" },
        { id: "doc-count", label: "{count} documents" },
        { id: "doc-count-one", label: "{count} document" },
        { id: "result-count", label: "{count} matching pages" },
        { id: "result-count-one", label: "{count} matching page" },
        {
          id: "empty-search",
          label: "No page matches “{query}”. Clearing the filter shows all {count} documents.",
        },
        { id: "section-count", label: "{count} pages" },
        { id: "section-count-one", label: "{count} page" },
        { id: "open", label: "Read" },
        {
          id: "unreadable",
          label:
            "The documentation manifest could not be built: {reason}. Nothing is listed, because an empty list would claim the tree is empty.",
        },
      ],
    },
  ],
});
