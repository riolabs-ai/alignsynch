/**
 * `/support/articles/[slug]` — one knowledge-base article's copy.
 *
 * The reader's hero is the record (`article.title`, its summary, its body). The route
 * resolves the slug against the record store and calls `notFound()` when nothing is
 * published under it (issue #165), so this fixture no longer has a not-found state to
 * word: `heading` and `subtitle` are the route's title band like every other surface's.
 * Everything else is `article-detail`'s: the breadcrumb trail, the read-time suffix, the
 * feedback banner, the share/save/print controls and the "Read article" affordance the
 * related cards render (it reads its labels from the same band because both render from
 * one component).
 *
 * The link destinations stay in JSX: `content/routes.ts` resolves every fixture `href` at
 * build time, and these point at `/help` (the public help centre that lists the articles),
 * `/help` again for the breadcrumb, and `/support` for "Contact support" — the account page
 * inside the app, which redirects a signed-out reader to `/help`. Leaving them where they are
 * keeps E10 reading their literal `href`s, which is where that check looks.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const supportArticlePageCopy: PageCopy = zPageCopy.parse({
  heading: "Article Not Found",
  subtitle: "The article you're looking for doesn't exist or has been moved.",
  sections: [
    {
      id: "article-detail",
      heading: "Was this article helpful?",
      items: [
        { id: "back-to-support", label: "Return to the Help centre" },
        { id: "breadcrumb-support", label: "Help" },
        { id: "breadcrumb-knowledge-base", label: "Knowledge Base" },
        { id: "min-read", label: "min read" },
        { id: "helpful-yes", label: "Yes, it helped" },
        { id: "helpful-no", label: "No, I need more help" },
        {
          id: "helpful-follow-up",
          label: "We're sorry this article didn't help. Would you like to:",
        },
        { id: "browse-articles", label: "Browse other articles" },
        { id: "contact-support", label: "Contact support" },
        { id: "share", label: "Share" },
        { id: "save", label: "Save" },
        { id: "print", label: "Print" },
      ],
    },
    {
      id: "related-articles",
      heading: "Related Articles",
      items: [{ id: "read-article", label: "Read article" }],
    },
  ],
});
