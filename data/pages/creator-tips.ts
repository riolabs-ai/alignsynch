/**
 * `/creator-tips` — the creator-tips index's copy (WU-9).
 *
 * `CreatorTipsPage` is a client component that composes five bands (hero,
 * category filter, featured strip, grid, closing banner). The page module
 * resolves one section per band and passes them all down, and `CreatorTipsPage`
 * only forwards them — it never picks a fixture itself.
 *
 * Numbers stay computed: `{count} articles` and `{count} min read` are filled by
 * the view from the category/tip record it renders. The grid's two headings that
 * embed a search term carry `{query}` / `{category}` and are filled the same way.
 *
 * `TipCard` is shared with `/creator-tips/[slug]`, so the `read-minutes` label it
 * renders (short form, no "read") lives here in the grid section; the detail
 * route's fixture carries its own copy of that id with its own wording.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const creatorTipsPageCopy: PageCopy = zPageCopy.parse({
  heading: "Quiz Creator Tips & Best Practices",
  subtitle:
    "Discover strategies, techniques, and insights to create more engaging and effective quizzes",
  sections: [
    {
      id: "hero",
      heading: "Quiz Creator Tips & Best Practices",
      body: "Discover strategies, techniques, and insights to create more engaging and effective quizzes",
      items: [{ id: "search-placeholder", label: "Search for tips..." }],
    },
    {
      id: "categories",
      heading: "Browse by Category",
      items: [
        { id: "article-count", label: "{count} articles" },
        { id: "clear-filter", label: "Clear filter" },
      ],
    },
    {
      id: "featured",
      heading: "Featured Tips",
      items: [
        { id: "read-minutes", label: "{count} min read" },
        { id: "read-more", label: "Read more" },
      ],
    },
    {
      id: "tips-grid",
      heading: "All Tips",
      items: [
        { id: "read-minutes", label: "{count} min" },
        { id: "empty-state", label: "No tips found" },
        { id: "empty-search", label: 'No results for "{query}". Try a different search term.' },
        { id: "empty-category", label: "No tips in this category yet. Check back soon!" },
        { id: "empty-none", label: "No tips available at the moment. Check back soon!" },
        { id: "search-heading", label: 'Search Results for "{query}"' },
        { id: "category-heading", label: "{category} Tips" },
      ],
    },
    {
      id: "cta",
      heading: "Create your own engaging quiz",
      body: "Put these tips into practice and start creating quizzes that engage your audience and showcase your expertise.",
      cta: { label: "Create a Quiz", href: "/create/editor" },
      secondaryCta: { label: "Explore Examples", href: "/explore" },
      items: [
        { id: "eyebrow", label: "Ready to apply what you've learned?" },
        { id: "today", label: "today!" },
        {
          id: "perk-question-types",
          label: "Create interactive quizzes with multiple question types",
        },
        { id: "perk-audience", label: "Reach your target audience and grow your community" },
        { id: "perk-monetize", label: "Monetize your knowledge and earn rewards" },
      ],
    },
  ],
});
