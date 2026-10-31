/**
 * `/` — the home route's copy, and the fixture every later copy unit copies.
 *
 * Every visible string the page's own components render lives here (WU-6, issue
 * #53): the hero, the nine band headings, the CTA labels, the tab labels, the
 * inline card microcopy and the empty states. `app/(marketing)/page.tsx` parses
 * this module at import and passes one section down per component, so editing a
 * line here changes `/` with no `.tsx` edit — that is P2's exit proof.
 *
 * Two conventions worth knowing before editing:
 *
 *  - The hero heading spells its hard break as `\n` (`headingLines()` turns it
 *    into `<br />`). The leading space on the second line is copy the original
 *    JSX carried; keep it so the rendered text node is byte-identical.
 *  - `{count}` placeholders are filled by the view from the record it renders
 *    (`fillLabel`). They exist so a number is never spelled into the copy. A
 *    *product quantity* is not copy at all: `bonus-badge` carries
 *    `Earn up to {amount}` and the view fills it from `data/metrics.ts`
 *    (`affiliate.referralBonus`), and `stat-subscribers` carries only its caption
 *    because `home.newsletterSubscribers` is the snapshot the stat renders (WU-4,
 *    E22). A number typed here as well would be a second source of truth that
 *    `data:check` cannot compare against the one the page renders.
 *
 * Records are *not* here: the mock islands inside the home components (players,
 * winners, testimonials, tips) belong to the Player/Testimonial units, and this
 * file carries words, not rows.
 */
import type { Brand } from "../../content/brand";
import { zPageCopy, type PageCopy } from "../../content/pages";

/**
 * The `/` document title — `"<brand> — Play, Share, Earn"`.
 *
 * `app/(marketing)/page.tsx` exports it as `metadata.title.absolute`, because this page
 * names the product itself: the root layout's `%s · <brand>` template would otherwise
 * print the name twice (`"<brand> — Play, Share, Earn · <brand>"`).
 *
 * A function of the brand, not a string, for the same reason the shell is: the title is
 * the product's own name in front of the route's tagline, so a different record must
 * print a different title with no `.tsx` edit. The tagline stays here, where the rest of
 * the route's words live.
 */
export function homeTitle(brand: Pick<Brand, "name">): string {
  return `${brand.name} — Play, Share, Earn`;
}

export const homePageCopy: PageCopy = zPageCopy.parse({
  heading: "Your Quiz Adventure Starts Here: \n Play, Share, Earn!",
  subtitle: "Build engaging quizzes, challenge others, and earn rewards for your knowledge.",
  cta: { label: "Create Quiz", href: "/create/editor" },
  secondaryCta: { label: "Join Contest", href: "/battle" },
  sections: [
    {
      id: "categories",
      heading: "Quiz Categories",
    },
    {
      id: "latest-quizzes",
      heading: "Latest Quizzes",
      cta: { label: "View All Quizzes", href: "/explore" },
      items: [
        { id: "play-now", label: "Play Now" },
        { id: "empty-category", label: "Uncategorised" },
      ],
    },
    {
      id: "featured-quizzes",
      heading: "Featured Quizzes",
      body: "Specially selected quizzes you don't want to miss",
      items: [
        { id: "tab-all", label: "All" },
        { id: "tab-hot", label: "Hot" },
        { id: "tab-trending", label: "Trending" },
        { id: "tab-editors", label: "Editor's" },
        { id: "reward", label: "Reward" },
        { id: "players-joined", label: "players joined" },
        { id: "spots-left-urgent", label: "Only {count} spots left" },
        { id: "spots-available", label: "{count} spots available" },
        { id: "play-now", label: "Play Now" },
        { id: "empty-category", label: "Uncategorised" },
        { id: "unknown-creator", label: "Unknown creator" },
      ],
    },
    {
      id: "top-players",
      heading: "Top Players",
      cta: { label: "View Full Leaderboard", href: "/leaderboard" },
      items: [
        { id: "rank", label: "Rank" },
        { id: "wins", label: "Wins" },
        { id: "earned", label: "Earned" },
        { id: "followers", label: "Followers" },
        { id: "following", label: "Following" },
      ],
    },
    {
      id: "by-difficulty",
      heading: "Quizzes by Difficulty",
      body: "Choose challenges according to your skill level",
      items: [
        { id: "easy", label: "Easy" },
        { id: "medium", label: "Medium" },
        { id: "hard", label: "Hard" },
        { id: "reward", label: "Reward" },
        { id: "minutes", label: "min" },
        { id: "players", label: "players" },
        { id: "start-quiz", label: "Start Quiz" },
        { id: "spots-left-urgent", label: "Only {count} spots left!" },
        { id: "spots-left", label: "Only {count} spots left" },
        { id: "spots-available", label: "{count} spots available" },
        { id: "empty-category", label: "Uncategorised" },
        { id: "unknown-creator", label: "Unknown creator" },
      ],
    },
    {
      id: "live-winners",
      heading: "Live Winners",
      items: [
        { id: "recent-winners", label: "recent winners" },
        { id: "won", label: "Won" },
        { id: "playing", label: "playing" },
      ],
    },
    {
      /*
       * The how-it-works band also renders on `/categories`, and each route owns its own
       * words: E23 attributes a component to every route that renders it and resolves the
       * ids it asks for against *that* route's fixture, so one shared string in one
       * fixture cannot satisfy both. The duplication is deliberate — it is also what lets
       * the two pages say different things later without a gate change.
       */
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
    {
      id: "success-stories",
      heading: "Success Stories",
      body: "Hear from our community of quiz creators and players who are earning rewards and building their audience",
      items: [
        { id: "earnings", label: "Earnings" },
        { id: "quizzes", label: "Quizzes" },
        { id: "followers", label: "Followers" },
      ],
    },
    {
      id: "refer-earn",
      heading: "Refer & Earn",
      body: "Invite friends and earn bonus rewards!",
      items: [
        { id: "bonus-badge", label: "Earn up to {amount}" },
        { id: "invite-friends", label: "Invite Friends" },
      ],
    },
    {
      id: "creator-tips",
      heading: "Quiz Creator Tips",
      body: "Grow faster with expert advice",
      items: [
        { id: "view-all", label: "View All Resources" },
        { id: "read-more", label: "Read more" },
      ],
    },
    {
      id: "newsletter",
      heading: "Get Quiz Insights Weekly",
      body: "Join 10,000+ quiz creators and players receiving our weekly tips, strategies, and exclusive opportunities",
      items: [
        { id: "email-placeholder", label: "Enter your email" },
        { id: "subscribe", label: "Subscribe" },
        { id: "subscribing", label: "Subscribing..." },
        { id: "subscribed", label: "Thank you for subscribing! Check your inbox soon." },
        { id: "perk-insights", label: "Weekly insights" },
        { id: "perk-strategies", label: "Exclusive strategies" },
        { id: "perk-unsubscribe", label: "Unsubscribe anytime" },
        { id: "stat-subscribers", label: "Subscribers" },
        { id: "stat-satisfaction", label: "Satisfaction", value: "4.9/5" },
        { id: "stat-updates", label: "Updates", value: "Weekly" },
      ],
    },
  ],
});
