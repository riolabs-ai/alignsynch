/**
 * `/categories` — the categories index, its two bands, and the strings the page
 * renders outside a band.
 *
 * The page is three surfaces stacked: the catalogue header (`heading`, `subtitle`,
 * the search field), `CategoriesCTA`, and `CategoriesHowItWorks`. The last two are
 * components in `components/categories/`, and the home route renders the
 * how-it-works band too — with *its own* copy, because E23 resolves the ids a band
 * asks for against the fixture of the route that renders it (see the same section in
 * `home.ts`). Editing one page's band therefore leaves the other alone, which is the
 * point of route-keyed copy.
 *
 * `items` at the page level holds the search placeholder: the field sits between the
 * header and the grid, so no band owns it. `{query}` in the empty state is filled by
 * the view from what the visitor typed (`fillLabel`), never spelled here.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const categoriesPageCopy: PageCopy = zPageCopy.parse({
  heading: "Quiz Categories",
  subtitle: "Browse all quiz categories and find quizzes that match your interests.",
  items: [{ id: "search-placeholder", label: "Search categories..." }],
  sections: [
    {
      id: "empty",
      heading: "No categories found",
      body: 'We couldn\'t find any categories matching "{query}". Try a different search term.',
    },
    {
      id: "cta",
      heading: "Ready to Test Your Knowledge?",
      body: "Choose from thousands of quizzes across all categories or create your own to challenge friends and the community.",
      cta: { label: "Explore Quizzes", href: "/explore" },
      secondaryCta: { label: "Create Your Own Quiz", href: "/create/editor" },
      items: [
        { id: "eyebrow", label: "Discover Your Next Challenge" },
        {
          id: "compete",
          label: "Compete & Win",
          body: "Join tournaments, climb the leaderboards, and earn rewards for your knowledge.",
        },
        {
          id: "learn",
          label: "Learn & Grow",
          body: "Expand your knowledge across 20+ categories with fun, interactive quizzes.",
        },
        {
          id: "share",
          label: "Connect & Share",
          body: "Challenge friends, share results, and join a community of quiz enthusiasts.",
        },
        {
          /* `value` is the bold number; the label is the sentence it leads into. */
          id: "community",
          label: "quiz enthusiasts have joined our community. Will you be next?",
          value: "500,000+",
        },
        { id: "join", label: "Join Now" },
      ],
    },
    {
      id: "how-it-works",
      heading: "How It Works",
      body: "Getting started with our quiz platform is easy. Follow these simple steps to begin your quiz journey.",
      items: [
        { id: "eyebrow", label: "Simple Process" },
        {
          id: "browse",
          label: "Browse Categories",
          body: "Explore our diverse range of quiz categories to find topics interest you.",
        },
        {
          id: "take",
          label: "Take Quizzes",
          body: "Challenge yourself with quizzes of varying difficulty levels and formats.",
        },
        {
          id: "earn",
          label: "Earn Rewards",
          body: "Collect points, badges, and climb the leaderboards as you complete quizzes.",
        },
        {
          id: "outro",
          label:
            "Ready to start your quiz journey? Browse categories, find your interests, and begin challenging yourself today!",
        },
        { id: "users-online", label: "users online now", value: "2,500+" },
      ],
    },
  ],
});
