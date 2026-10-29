/**
 * `/categories/[slug]` — one category's quiz wall: its header, the sort/difficulty
 * controls, and the card microcopy every card repeats.
 *
 * The page has one band (the wall) and no second heading, so the controls and the card
 * strings are `items` on the route rather than a section: a section needs a heading the
 * view renders, and inventing one to hold "Sort" would put a word in the DOM that the
 * page never showed. The empty state is the one thing with a heading of its own.
 *
 * Difficulty labels are *not* here. `content/core.ts` owns them (`difficultyLabel`,
 * WU-5), and a second authored copy in a fixture is exactly the duplicate E20 exists to
 * stop. The category name is projected from the record for the same reason.
 *
 * `{query}` / `{count}` are filled by the view (`fillLabel`), never spelled.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const categoryDetailPageCopy: PageCopy = zPageCopy.parse({
  heading: "Quizzes",
  subtitle: "Browse quizzes in this category.",
  items: [
    { id: "back", label: "Back to Categories" },
    { id: "create-quiz", label: "Create Quiz" },
    { id: "search-placeholder", label: "Search quizzes..." },
    { id: "sort", label: "Sort" },
    { id: "sort-popular", label: "Most Popular" },
    { id: "sort-rating", label: "Highest Rated" },
    { id: "sort-newest", label: "Newest" },
    { id: "sort-reward", label: "Highest Reward" },
    { id: "difficulty", label: "Difficulty" },
    { id: "difficulty-all", label: "All Difficulties" },
    { id: "minutes", label: "min" },
    { id: "players", label: "players" },
    { id: "spots-left", label: "{count} spots left" },
    { id: "spots-left-urgent", label: "Almost full! Only {count} spots left" },
    { id: "play-now", label: "Play Now" },
    { id: "unknown-creator", label: "Unknown creator" },
    { id: "uncategorised", label: "Uncategorised" },
    { id: "creator-avatar", label: "creator" },
    { id: "reset-filters", label: "Reset Filters" },
  ],
  sections: [
    {
      id: "empty",
      heading: "No quizzes found",
      items: [
        {
          id: "empty-search",
          label: 'No quizzes match your search "{query}". Try a different search term or filter.',
        },
        {
          id: "empty-filters",
          label: "No quizzes found with the selected filters. Try adjusting your filters.",
        },
      ],
    },
  ],
});
