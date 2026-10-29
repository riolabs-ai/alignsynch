/**
 * `/explore` — the catalogue: the header, the filter rail, the three curated shelves,
 * and the quiz wall below them.
 *
 * Three bands have a heading the view renders, so they are `sections`. Everything the
 * wall itself repeats (the "Showing 6-10 of 42 quizzes" counter, the card microcopy, the
 * empty state) is `items` on the route: the wall has no heading, and a section invented
 * to hold it would render a word the page never showed.
 *
 * The shelves are the curation card's layout — three tabs, one shelf each — so the tab
 * labels here are Trending/Popular/New, not the home page's four. Copy follows the
 * layout that shipped, not the one the inventory measured.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const explorePageCopy: PageCopy = zPageCopy.parse({
  heading: "Explore Quizzes",
  items: [
    { id: "empty-heading", label: "No quizzes found" },
    {
      id: "empty-search",
      label: 'No quizzes match your search "{query}". Try a different search term or filter.',
    },
    {
      id: "empty-filters",
      label: "No quizzes found with the selected filters. Try adjusting your filters.",
    },
    { id: "reset-filters", label: "Reset Filters" },
    { id: "showing", label: "Showing {start}-{end} of {total} quizzes" },
    { id: "minutes", label: "min" },
    { id: "players", label: "players" },
    { id: "spots-left", label: "{count} spots left" },
    { id: "spots-left-urgent", label: "Almost full! Only {count} spots left" },
    { id: "play-now", label: "Play Now" },
    { id: "unknown-creator", label: "Unknown creator" },
    { id: "uncategorised", label: "Uncategorised" },
    { id: "creator-avatar", label: "creator" },
    { id: "by", label: "by" },
    { id: "previous", label: "Previous" },
    { id: "next", label: "Next" },
  ],
  sections: [
    {
      id: "header",
      heading: "Explore Quizzes",
      body: "Discover and play quizzes from our community",
      items: [
        { id: "search-placeholder", label: "Search quizzes by title, category, or creator..." },
        { id: "grid-view", label: "Grid view" },
        { id: "list-view", label: "List view" },
      ],
    },
    {
      id: "filters",
      heading: "Filters",
      items: [
        { id: "reset", label: "Reset" },
        { id: "difficulty", label: "Difficulty" },
        { id: "difficulty-all", label: "All Levels" },
        { id: "sort", label: "Sort By" },
        { id: "sort-popular", label: "Most Popular" },
        { id: "sort-newest", label: "Newest" },
        { id: "sort-rating", label: "Highest Rated" },
        { id: "sort-reward", label: "Highest Reward" },
        { id: "reward", label: "Reward" },
        { id: "time-limit", label: "Time Limit" },
        { id: "minutes", label: "min" },
        { id: "minutes-plus", label: "+ min" },
        { id: "availability", label: "Availability" },
        { id: "spots-available", label: "Spots Available" },
        { id: "almost-full", label: "Almost Full" },
        { id: "limited-time", label: "Limited Time" },
        { id: "time-range", label: "Time Range" },
        { id: "time-all", label: "All Time" },
        { id: "time-today", label: "Today" },
        { id: "time-week", label: "This Week" },
        { id: "time-month", label: "This Month" },
        { id: "apply", label: "Apply Filters" },
      ],
    },
    {
      id: "featured",
      heading: "Featured Quizzes",
      body: "Specially selected quizzes you don't want to miss",
      items: [
        { id: "tab-trending", label: "Trending" },
        { id: "tab-popular", label: "Popular" },
        { id: "tab-new", label: "New" },
        { id: "view-all", label: "View All Featured Quizzes" },
        { id: "uncategorised", label: "Uncategorised" },
        { id: "unknown-creator", label: "Unknown creator" },
        { id: "creator-avatar", label: "creator" },
        { id: "seats-unannounced", label: "Seats not announced" },
        { id: "spots-left", label: "{count} spots left" },
        { id: "players", label: "players" },
        { id: "play-now", label: "Play Now" },
      ],
    },
  ],
});
