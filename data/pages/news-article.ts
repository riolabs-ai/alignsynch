/**
 * `/news/[slug]` — the news article reader's copy.
 *
 * The page's hero is the record (`article.title`, its author, its date), so the
 * fixture's `heading` carries the reader's own state line — the `Loading article...`
 * paragraph the view renders before the record resolves — and the bands around the
 * body are sections:
 *
 *  - `article-actions` — the back control, the share/save/like/comment controls and
 *    the "min read" suffix beside the computed read time. `heading` is the two share
 *    buttons' label, because that band's own heading is the record's title.
 *  - `comments` — the discussion band: its heading (`Comments (12)`), the two sort
 *    tabs, the composer, and the illustrative thread the view maps over `[1, 2, 3]`.
 *    The thread is record-shaped with no `DiscussionComment` schema in P2, so its
 *    rows stay in the component and only their words move here: `{index}` is filled
 *    from the mapped row, and `popular-body`'s `{percent}` from the metric the view
 *    already computes. "Share" and "Link copied!" are single ids read at both
 *    popovers, since the same words render twice in the same component.
 *  - `author`, `related-articles`, `newsletter` — the three sidebar cards.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const newsArticlePageCopy: PageCopy = zPageCopy.parse({
  heading: "Loading article...",
  sections: [
    {
      id: "article-actions",
      heading: "Share",
      items: [
        { id: "back-to-news", label: "Back to News" },
        { id: "link-copied", label: "Link copied!" },
        { id: "save", label: "Save" },
        { id: "like", label: "Like" },
        { id: "comment", label: "Comment" },
        { id: "min-read", label: "min read" },
      ],
    },
    {
      id: "comments",
      heading: "Comments (12)",
      items: [
        { id: "tab-newest", label: "Newest" },
        { id: "tab-popular", label: "Popular" },
        { id: "comment-placeholder", label: "Add a comment..." },
        { id: "post-comment", label: "Post Comment" },
        { id: "avatar-fallback", label: "U{index}" },
        { id: "comment-author", label: "User Name {index}" },
        { id: "comment-time", label: "2 days ago" },
        {
          id: "comment-body",
          label: "This is a great article! I learned a lot about quiz creation strategies.",
        },
        { id: "reply", label: "Reply" },
        { id: "popular-summary", label: "Showing most popular comments first." },
        { id: "popular-author", label: "Popular User {index}" },
        { id: "popular-time", label: "3 days ago" },
        {
          id: "popular-body",
          label:
            "I've been using these strategies and my quiz engagement has increased by {percent}!",
        },
      ],
    },
    {
      id: "author",
      heading: "About the Author",
      items: [{ id: "view-profile", label: "View Profile" }],
    },
    {
      id: "related-articles",
      heading: "Related Articles",
      items: [{ id: "min-read", label: "min read" }],
    },
    {
      id: "newsletter",
      heading: "Subscribe to Our Newsletter",
      body: "Get the latest quiz news, tips, and updates delivered to your inbox.",
      items: [
        { id: "email-placeholder", label: "Your email address" },
        { id: "subscribe", label: "Subscribe" },
      ],
    },
  ],
});
