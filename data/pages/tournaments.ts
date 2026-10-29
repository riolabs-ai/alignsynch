/**
 * `/tournaments` — the tournament index route's copy (WU-11, issue #58).
 *
 * Written against the decision the card records: **`PageCopy` only, no tournament
 * domain.** The band is the same static catalogue the page has always rendered, so
 * this fixture carries the words of the route, not a tournament: there is no
 * `Tournament` entity in `content/`, no bracket, no standings. The six cards the
 * list renders are the mock rows already inside `tournament-list.tsx` and they stay
 * there — moving them into a fixture would be the domain, and the domain is a P4
 * question (`docs/DATA-MODEL.md` keeps tournaments out of scope; W9 in
 * `docs/P2-INVENTORY.md`).
 *
 * Two conventions this route adds to the WU-6 shape, both forced by bytes:
 *
 *  - **A heading split by inline markup is two strings.** The call-to-action's
 *    `<h2>` is `Join the ultimate <span>quiz competition!</span>`; the section
 *    `heading` is the leading words and the highlighted phrase is an `item`, so the
 *    `<span>` and its class survive. Flattening them into one label would delete the
 *    accent, which is a rendering change, not a data move.
 *  - **The filter chips are this route's words, not `quizCategories`.** They look
 *    like the category schema and are not: the chip is `Art & Culture` where
 *    `quizCategories` says `Art`, and `Entertainment` has no quiz slug at all. WU-5's
 *    `quizCategoryLabel()` would rewrite five of the ten chips, so the labels stay
 *    authored here; the *values* they filter on (`science`, `history`, …) stay in the
 *    view as the `CHIPS` const, the way `TABS` does on `/`.
 *
 * The call-to-action's two destinations are **not** `cta`/`secondaryCta` here: they
 * point at `/tournaments/register` and `/tournaments/create`, which only match the
 * `/tournaments/[id]` pattern with a name that is not a record id — E23's link rule
 * rejects exactly that, and it is right to. They stay literal `href` attributes in
 * the view, which is where E10 checks them; the labels are items. A link that must
 * lie about being a record is a P4 domain question, not something to paper over with
 * a fixture field.
 */
import { zPageCopy, type PageCopy } from "../../content/pages";

export const tournamentsPageCopy: PageCopy = zPageCopy.parse({
  heading: "Quiz Tournaments",
  subtitle: "Compete against other quiz enthusiasts and win amazing prizes",
  sections: [
    {
      id: "featured",
      heading: "Global Knowledge Championship",
      body: "Test your knowledge against the best quiz enthusiasts from around the world in this premier tournament with multiple rounds of challenging questions.",
      items: [
        { id: "badge", label: "FEATURED" },
        { id: "dates", label: "May 15 - June 10, 2023" },
        { id: "participants", label: "{count} participants" },
        { id: "prize-pool", label: "{amount} prize pool" },
        { id: "join", label: "Join Tournament" },
        { id: "closes-in", label: "Registration closes in" },
        { id: "days-left", label: "3 days" },
        { id: "rounds", label: "Rounds" },
        { id: "categories", label: "Categories" },
        { id: "questions", label: "Questions" },
        { id: "advance", label: "Top {count} participants advance to the final round" },
      ],
    },
    {
      id: "all-tournaments",
      heading: "All Tournaments",
      items: [
        { id: "filter-placeholder", label: "Filter tournaments" },
        { id: "filter-all", label: "All Tournaments" },
        { id: "filter-registration", label: "Registration Open" },
        { id: "filter-upcoming", label: "Upcoming" },
        { id: "filter-ongoing", label: "Ongoing" },
        { id: "filter-completed", label: "Completed" },
        { id: "chip-all", label: "All Categories" },
        { id: "chip-general", label: "General Knowledge" },
        { id: "chip-science", label: "Science" },
        { id: "chip-history", label: "History" },
        { id: "chip-geography", label: "Geography" },
        { id: "chip-entertainment", label: "Entertainment" },
        { id: "chip-sports", label: "Sports" },
        { id: "chip-literature", label: "Literature" },
        { id: "chip-technology", label: "Technology" },
        { id: "chip-art", label: "Art & Culture" },
        { id: "empty-heading", label: "No tournaments found" },
        { id: "empty-body", label: "Try changing your category or filter selection" },
        { id: "list-participants", label: "{count} participants" },
        { id: "list-prize", label: "{prize} prize" },
        { id: "list-closes-in", label: "Closes in {days}" },
        { id: "view-details", label: "View Details" },
        { id: "view-results", label: "View Results" },
      ],
    },
    {
      id: "call-to-action",
      heading: "Join the ultimate",
      body: "Compete with players from around the world, showcase your knowledge, and win amazing prizes in our tournaments.",
      items: [
        { id: "badge", label: "Ready for the challenge?" },
        { id: "heading-accent", label: "quiz competition!" },
        { id: "perk-prizes", label: "Win exclusive prizes and climb the global leaderboard" },
        { id: "perk-community", label: "Connect with a community of quiz enthusiasts" },
        { id: "perk-badges", label: "Earn special badges and achievements" },
        { id: "register-now", label: "Register Now" },
        { id: "host-tournament", label: "Host a Tournament" },
      ],
    },
    {
      id: "how-it-works",
      heading: "How Tournaments Work",
      body: "Our quiz tournaments offer a fun and competitive way to test your knowledge and win prizes.",
      items: [
        { id: "step-register-title", label: "Register" },
        {
          id: "step-register-body",
          label:
            "Browse upcoming tournaments and register for those that match your interests and skill level.",
        },
        { id: "step-prepare-title", label: "Prepare" },
        {
          id: "step-prepare-body",
          label: "Study the tournament topic, practice with similar quizzes, and review the rules.",
        },
        { id: "step-compete-title", label: "Compete" },
        {
          id: "step-compete-body",
          label:
            "Participate in multiple rounds of challenging quizzes against players from around the world.",
        },
        { id: "step-win-title", label: "Win" },
        {
          id: "step-win-body",
          label: "Top performers win prizes, badges, and recognition on the global leaderboard.",
        },
        { id: "ready", label: "Ready to test your knowledge?" },
        { id: "join-today", label: "Join a Tournament Today" },
      ],
    },
    {
      id: "testimonials",
      heading: "What Tournament Players Say",
      body: "Hear from our community of quiz enthusiasts who have participated in our tournaments",
      items: [
        { id: "tournament-prefix", label: "Tournament:" },
        { id: "join-count", label: "Join over 50,000 quiz enthusiasts in our tournaments" },
        { id: "view-upcoming", label: "View Upcoming Tournaments" },
      ],
    },
  ],
});
