/**
 * `/creator-tips/[slug]` — one creator tip's copy (WU-9).
 *
 * The article itself is a record (`publishedArticle("tip", slug)` in
 * `lib/article-records.ts`): title, summary, author, date
 * and body all come from `data/creator-tips-data.ts` and are not copy. What a
 * component still spelled out is the chrome around it, and that is what this
 * fixture carries: the back link, the reading-time caption, the save/bookmark
 * control's two labels, the share control, and the related-tips band.
 *
 * The back link renders `article.heading`; its `href` is the article's own chrome
 * link and stays in the JSX beside the arrow, where E10 reads it.
 *
 * `RelatedTips` and `TipCard` are shared with `/creator-tips`, so both routes
 * carry a `read-minutes` item — the page decides which fixture's section each
 * component receives, the component never does.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const creatorTipsDetailPageCopy: PageCopy = zPageCopy.parse({
  heading: "Quiz Creator Tips",
  sections: [
    {
      id: "article",
      heading: "Back to all tips",
      items: [
        { id: "read-minutes", label: "{count} min read" },
        { id: "save", label: "Save" },
        { id: "saved", label: "Saved" },
        { id: "share", label: "Share" },
      ],
    },
    {
      id: "related",
      heading: "Related Tips",
      items: [{ id: "read-minutes", label: "{count} min" }],
    },
  ],
});
