/**
 * `/explore/featured` — the full featured shelf, one page per tab.
 *
 * One band, one heading, and a wall of cards below it, so the route's strings are
 * `heading` plus `items`: the sort control, the three tab labels, and the card
 * microcopy. The card sentences repeat `/explore`'s shelf; that is the route-keyed
 * model doing its job (each route owns the words it renders), not a second fixture —
 * `data:check` E23 has one route per key and edits one fixture at a time.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const exploreFeaturedPageCopy: PageCopy = zPageCopy.parse({
  heading: "Featured Quizzes",
  items: [
    { id: "sort-label", label: "Sort by:" },
    { id: "sort-placeholder", label: "Sort by" },
    { id: "sort-popular", label: "Most Popular" },
    { id: "sort-newest", label: "Newest First" },
    { id: "sort-reward", label: "Highest Reward" },
    { id: "sort-rating", label: "Top Rated" },
    { id: "tab-trending", label: "Trending" },
    { id: "tab-popular", label: "Popular" },
    { id: "tab-new", label: "New" },
    { id: "uncategorised", label: "Uncategorised" },
    { id: "unknown-creator", label: "Unknown creator" },
    { id: "creator-avatar", label: "creator" },
    { id: "seats-unannounced", label: "Seats not announced" },
    { id: "spots-left", label: "{count} spots left" },
    { id: "players", label: "players" },
    { id: "play-now", label: "Play Now" },
  ],
});
