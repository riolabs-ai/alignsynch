/**
 * The 31 card records the P1 migration projected — a committed snapshot.
 *
 * GENERATED from the migration harness (`migrated/cards.json::log`, 31 rows, all
 * `outcome: "PROJECTED"`, and `migrated/facts.json::fixtureNow`). Those fixtures live
 * outside the app, so B-01's acceptance claim ("31/31 card records reproduce their
 * authored stats") needs them in-repo: without a committed snapshot the test could only
 * compare the selector against itself.
 *
 * Engagement is re-spelled in model terms (`players` -> `plays`, `maxPlayers` ->
 * `capacity`, `reward: "$7.50"` -> `rewardCents: 750`) because the claim is "the model
 * reproduces the card", not "the card is still spelled the old way". `spotsLeft`,
 * `almostFull` and `limitedTime` stay exactly as authored: they are the derived fields
 * the projection must recompute, and this file is where their ground truth lives.
 *
 * `createdBy` is the card's author. Two records name `CosmicMind` while the catalog
 * record says `MarvelFan`: that is the shadow-identity case B-01 exists to prevent, and
 * the overlay is what must NOT fix it.
 *
 * **`FIXTURE_NOW` is the demo epoch (`DEMO_NOW_ISO`), not the 2025 capture date.** The
 * harness captured these cards at `2025-01-01T00:00:00.000Z`; that instant is not in the
 * model any more. Every instant behind these rows — the four `limitedTimeEndsAt` windows,
 * the two campaign `startsAt` values — is anchored at the demo epoch + the authored
 * duration (issue #110), so the projection instant has to be the same epoch for the
 * derived fields (`limitedTime`, the campaign merge) to mean what the snapshot says they
 * mean. `expiresInSeconds` therefore reads as "the authored duration", measured from
 * `FIXTURE_NOW`; the catalog window it implies is `FIXTURE_NOW + expiresInSeconds`.
 */
export const FIXTURE_NOW = "2026-10-29T12:00:00.000Z";

/**
 * One authored card, in the model's terms.
 *
 * `key` is the **migration harness's label** for the card's authored position, not a claim
 * that a shelf renders that position. The two `explore*` groups are the template's two tab
 * blocks, and they are the opposite way round from the pages that render them: the 18
 * `explore-page/*` rows are six per tab and equal `featuredTrending/Popular/New` (the tabs of
 * `featured-quizzes-page.tsx`, mounted on `/explore/featured`), while the nine
 * `explore-featured/*` rows are three per tab and equal `exploreTrending/Popular/New` (the
 * tabs of `explore-featured.tsx`, mounted on `/explore`). So `explore-page/*[3..5]` names no
 * rendered card, and `/explore`'s three-card tabs are a strict prefix of the authored six
 * rather than a shelf that lost three cards. The decision, the measurement behind it and what
 * would have to change to show six are in `docs/p1-migration/MIGRATION.md`; the mapping is
 * pinned by `scripts/__tests__/explore-curation.test.ts`.
 */
export interface CardRecordSnapshot {
  /** The harness's label for the authored position (`explore-page/popular[1]`). */
  key: string;
  quizId: string;
  title: string;
  authored: {
    plays: number;
    capacity?: number;
    rating?: number;
    rewardCents?: number;
    badge?: { type: string; label: string };
    spotsLeft?: number;
    almostFull?: boolean;
  };
  /** False means the authored card shows no countdown. */
  limitedTime: boolean;
  /** The authored `expiresIn`, in seconds from `FIXTURE_NOW`. */
  expiresInSeconds?: number;
  /** The card's author. Content, never an overlay's to set. */
  createdBy?: string;
}

export const CARD_RECORDS: readonly CardRecordSnapshot[] = [
  {
    key: "home[0]",
    quizId: "quiz-science-quiz-space-exploration",
    title: "Science Quiz: Space Exploration",
    authored: {
      plays: 2453,
      capacity: 3000,
      rating: 4.9,
      rewardCents: 1000,
      badge: { type: "hot", label: "Hot 🔥" },
      spotsLeft: 547,
      almostFull: false,
    },
    limitedTime: true,
    expiresInSeconds: 172800,
  },
  {
    key: "home[1]",
    quizId: "quiz-world-geography-challenge-capitals-landmarks",
    title: "World Geography Challenge: Capitals & Landmarks",
    authored: {
      plays: 1872,
      capacity: 2000,
      rating: 4.8,
      rewardCents: 750,
      badge: { type: "editors", label: "Editor's Choice ✨" },
      spotsLeft: 128,
      almostFull: true,
    },
    limitedTime: false,
  },
  {
    key: "home[2]",
    quizId: "quiz-brain-teasers-logic-puzzles",
    title: "Brain Teasers & Logic Puzzles",
    authored: {
      plays: 3241,
      capacity: 5000,
      rating: 4.7,
      rewardCents: 800,
      badge: { type: "trending", label: "Trending 📈" },
      spotsLeft: 1759,
      almostFull: false,
    },
    limitedTime: true,
    expiresInSeconds: 86400,
  },
  {
    key: "home[3]",
    quizId: "quiz-historys-greatest-mysteries",
    title: "History's Greatest Mysteries",
    authored: {
      plays: 1563,
      capacity: 1600,
      rating: 4.9,
      rewardCents: 650,
      badge: { type: "topRated", label: "Top Rated ⭐" },
      spotsLeft: 37,
      almostFull: true,
    },
    limitedTime: false,
  },
  {
    key: "explore-page/trending[0]",
    quizId: "quiz-science-quiz-space-exploration",
    title: "Science Quiz: Space Exploration",
    authored: {
      plays: 2453,
      capacity: 3000,
      rating: 4.9,
      rewardCents: 1000,
      badge: { type: "hot", label: "Hot 🔥" },
      spotsLeft: 547,
    },
    limitedTime: true,
    expiresInSeconds: 172800,
    createdBy: "MarvelFan",
  },
  {
    key: "explore-page/trending[1]",
    quizId: "quiz-world-geography-challenge-capitals-landmarks",
    title: "World Geography Challenge: Capitals & Landmarks",
    authored: {
      plays: 1872,
      capacity: 2000,
      rating: 4.8,
      rewardCents: 750,
      badge: { type: "editors", label: "Editor's Choice ✨" },
      spotsLeft: 128,
    },
    limitedTime: false,
    expiresInSeconds: 172800,
    createdBy: "GeoExplorer",
  },
  {
    key: "explore-page/trending[2]",
    quizId: "quiz-brain-teasers-logic-puzzles",
    title: "Brain Teasers & Logic Puzzles",
    authored: {
      plays: 3241,
      capacity: 5000,
      rating: 4.7,
      rewardCents: 800,
      badge: { type: "trending", label: "Trending 📈" },
      spotsLeft: 1759,
    },
    limitedTime: true,
    expiresInSeconds: 86400,
    createdBy: "PuzzleMaster",
  },
  {
    key: "explore-page/trending[3]",
    quizId: "quiz-ancient-civilizations-egypt-greece-rome",
    title: "Ancient Civilizations: Egypt, Greece & Rome",
    authored: {
      plays: 1987,
      capacity: 2500,
      rating: 4.8,
      rewardCents: 900,
      badge: { type: "hot", label: "Hot 🔥" },
      spotsLeft: 513,
    },
    limitedTime: true,
    expiresInSeconds: 129600,
    createdBy: "HistoryBuff",
  },
  {
    key: "explore-page/trending[4]",
    quizId: "quiz-mathematical-puzzles-brain-teasers",
    title: "Mathematical Puzzles & Brain Teasers",
    authored: {
      plays: 1543,
      capacity: 2000,
      rating: 4.6,
      rewardCents: 650,
      badge: { type: "trending", label: "Trending 📈" },
      spotsLeft: 457,
    },
    limitedTime: false,
    expiresInSeconds: 172800,
    createdBy: "MathWhiz",
  },
  {
    key: "explore-page/trending[5]",
    quizId: "quiz-world-of-fantasy-literature",
    title: "World of Fantasy Literature",
    authored: {
      plays: 1876,
      capacity: 2200,
      rating: 4.7,
      rewardCents: 700,
      badge: { type: "hot", label: "Hot 🔥" },
      spotsLeft: 324,
    },
    limitedTime: true,
    expiresInSeconds: 43200,
    createdBy: "BookWorm",
  },
  {
    key: "explore-page/popular[0]",
    quizId: "quiz-historys-greatest-mysteries",
    title: "History's Greatest Mysteries",
    authored: {
      plays: 1563,
      capacity: 1600,
      rating: 4.9,
      rewardCents: 650,
      badge: { type: "topRated", label: "Top Rated ⭐" },
      spotsLeft: 37,
    },
    limitedTime: false,
    expiresInSeconds: 172800,
    createdBy: "HistoryBuff",
  },
  {
    key: "explore-page/popular[1]",
    quizId: "quiz-science-quiz-space-exploration",
    title: "Science Quiz: Space Exploration",
    authored: {
      plays: 2105,
      capacity: 2500,
      rating: 4.8,
      rewardCents: 750,
      badge: { type: "popular", label: "Popular 👑" },
      spotsLeft: 395,
    },
    limitedTime: false,
    expiresInSeconds: 172800,
    createdBy: "CosmicMind",
  },
  {
    key: "explore-page/popular[2]",
    quizId: "quiz-literature-classic-novels",
    title: "Literature: Classic Novels",
    authored: {
      plays: 1298,
      capacity: 1500,
      rating: 4.9,
      rewardCents: 500,
      badge: { type: "topRated", label: "Top Rated ⭐" },
      spotsLeft: 202,
    },
    limitedTime: false,
    expiresInSeconds: 172800,
    createdBy: "BookWorm",
  },
  {
    key: "explore-page/popular[3]",
    quizId: "quiz-world-cup-football-history",
    title: "World Cup Football History",
    authored: {
      plays: 2341,
      capacity: 3000,
      rating: 4.8,
      rewardCents: 850,
      badge: { type: "popular", label: "Popular 👑" },
      spotsLeft: 659,
    },
    limitedTime: false,
    expiresInSeconds: 172800,
    createdBy: "SportsNut",
  },
  {
    key: "explore-page/popular[4]",
    quizId: "quiz-blockbuster-movies-trivia",
    title: "Blockbuster Movies Trivia",
    authored: {
      plays: 3102,
      capacity: 3500,
      rating: 4.9,
      rewardCents: 950,
      badge: { type: "topRated", label: "Top Rated ⭐" },
      spotsLeft: 398,
    },
    limitedTime: false,
    expiresInSeconds: 172800,
    createdBy: "MovieBuff",
  },
  {
    key: "explore-page/popular[5]",
    quizId: "quiz-wonders-of-the-natural-world",
    title: "Wonders of the Natural World",
    authored: {
      plays: 1876,
      capacity: 2000,
      rating: 4.7,
      rewardCents: 600,
      badge: { type: "popular", label: "Popular 👑" },
      spotsLeft: 124,
    },
    limitedTime: false,
    expiresInSeconds: 172800,
    createdBy: "NatureExplorer",
  },
  {
    key: "explore-page/new[0]",
    quizId: "quiz-music-through-the-decades",
    title: "Music Through the Decades",
    authored: {
      plays: 210,
      capacity: 1000,
      rating: 4.5,
      rewardCents: 550,
      badge: { type: "new", label: "New ✨" },
      spotsLeft: 790,
    },
    limitedTime: false,
    expiresInSeconds: 172800,
    createdBy: "MusicMaestro",
  },
  {
    key: "explore-page/new[1]",
    quizId: "quiz-technology-gadgets",
    title: "Technology & Gadgets",
    authored: {
      plays: 175,
      capacity: 1000,
      rating: 4.6,
      rewardCents: 700,
      badge: { type: "new", label: "New ✨" },
      spotsLeft: 825,
    },
    limitedTime: false,
    expiresInSeconds: 172800,
    createdBy: "TechGuru",
  },
  {
    key: "explore-page/new[2]",
    quizId: "quiz-11",
    title: "Sports Trivia Challenge",
    authored: {
      plays: 124,
      capacity: 1000,
      rating: 4.4,
      rewardCents: 300,
      badge: { type: "new", label: "New ✨" },
      spotsLeft: 876,
    },
    limitedTime: false,
    expiresInSeconds: 172800,
    createdBy: "SportsNut",
  },
  {
    key: "explore-page/new[3]",
    quizId: "quiz-culinary-world-tour",
    title: "Culinary World Tour",
    authored: {
      plays: 98,
      capacity: 1000,
      rating: 4.3,
      rewardCents: 450,
      badge: { type: "new", label: "New ✨" },
      spotsLeft: 902,
    },
    limitedTime: false,
    expiresInSeconds: 172800,
    createdBy: "FoodieChef",
  },
  {
    key: "explore-page/new[4]",
    quizId: "quiz-artistic-masterpieces",
    title: "Artistic Masterpieces",
    authored: {
      plays: 87,
      capacity: 1000,
      rating: 4.2,
      rewardCents: 400,
      badge: { type: "new", label: "New ✨" },
      spotsLeft: 913,
    },
    limitedTime: false,
    expiresInSeconds: 172800,
    createdBy: "ArtLover",
  },
  {
    key: "explore-page/new[5]",
    quizId: "quiz-famous-inventors-discoveries",
    title: "Famous Inventors & Discoveries",
    authored: {
      plays: 112,
      capacity: 1000,
      rating: 4.4,
      rewardCents: 500,
      badge: { type: "new", label: "New ✨" },
      spotsLeft: 888,
    },
    limitedTime: false,
    expiresInSeconds: 172800,
    createdBy: "ScienceGeek",
  },
  {
    key: "explore-featured/trending[0]",
    quizId: "quiz-science-quiz-space-exploration",
    title: "Science Quiz: Space Exploration",
    authored: {
      plays: 2453,
      capacity: 3000,
      rating: 4.9,
      rewardCents: 1000,
      badge: { type: "hot", label: "Hot 🔥" },
      spotsLeft: 547,
    },
    limitedTime: true,
    expiresInSeconds: 172800,
    createdBy: "MarvelFan",
  },
  {
    key: "explore-featured/trending[1]",
    quizId: "quiz-world-geography-challenge-capitals-landmarks",
    title: "World Geography Challenge: Capitals & Landmarks",
    authored: {
      plays: 1872,
      capacity: 2000,
      rating: 4.8,
      rewardCents: 750,
      badge: { type: "editors", label: "Editor's Choice ✨" },
      spotsLeft: 128,
    },
    limitedTime: false,
    expiresInSeconds: 172800,
    createdBy: "GeoExplorer",
  },
  {
    key: "explore-featured/trending[2]",
    quizId: "quiz-brain-teasers-logic-puzzles",
    title: "Brain Teasers & Logic Puzzles",
    authored: {
      plays: 3241,
      capacity: 5000,
      rating: 4.7,
      rewardCents: 800,
      badge: { type: "trending", label: "Trending 📈" },
      spotsLeft: 1759,
    },
    limitedTime: true,
    expiresInSeconds: 86400,
    createdBy: "PuzzleMaster",
  },
  {
    key: "explore-featured/popular[0]",
    quizId: "quiz-historys-greatest-mysteries",
    title: "History's Greatest Mysteries",
    authored: {
      plays: 1563,
      capacity: 1600,
      rating: 4.9,
      rewardCents: 650,
      badge: { type: "topRated", label: "Top Rated ⭐" },
      spotsLeft: 37,
    },
    limitedTime: false,
    expiresInSeconds: 172800,
    createdBy: "HistoryBuff",
  },
  {
    key: "explore-featured/popular[1]",
    quizId: "quiz-science-quiz-space-exploration",
    title: "Science Quiz: Space Exploration",
    authored: {
      plays: 2105,
      capacity: 2500,
      rating: 4.8,
      rewardCents: 750,
      badge: { type: "popular", label: "Popular 👑" },
      spotsLeft: 395,
    },
    limitedTime: false,
    expiresInSeconds: 172800,
    createdBy: "CosmicMind",
  },
  {
    key: "explore-featured/popular[2]",
    quizId: "quiz-literature-classic-novels",
    title: "Literature: Classic Novels",
    authored: {
      plays: 1298,
      capacity: 1500,
      rating: 4.9,
      rewardCents: 500,
      badge: { type: "topRated", label: "Top Rated ⭐" },
      spotsLeft: 202,
    },
    limitedTime: false,
    expiresInSeconds: 172800,
    createdBy: "BookWorm",
  },
  {
    key: "explore-featured/new[0]",
    quizId: "quiz-music-through-the-decades",
    title: "Music Through the Decades",
    authored: {
      plays: 210,
      capacity: 1000,
      rating: 4.5,
      rewardCents: 550,
      badge: { type: "new", label: "New ✨" },
      spotsLeft: 790,
    },
    limitedTime: false,
    expiresInSeconds: 172800,
    createdBy: "MusicMaestro",
  },
  {
    key: "explore-featured/new[1]",
    quizId: "quiz-technology-gadgets",
    title: "Technology & Gadgets",
    authored: {
      plays: 175,
      capacity: 1000,
      rating: 4.6,
      rewardCents: 700,
      badge: { type: "new", label: "New ✨" },
      spotsLeft: 825,
    },
    limitedTime: false,
    expiresInSeconds: 172800,
    createdBy: "TechGuru",
  },
  {
    key: "explore-featured/new[2]",
    quizId: "quiz-11",
    title: "Sports Trivia Challenge",
    authored: {
      plays: 124,
      capacity: 1000,
      rating: 4.4,
      rewardCents: 300,
      badge: { type: "new", label: "New ✨" },
      spotsLeft: 876,
    },
    limitedTime: false,
    expiresInSeconds: 172800,
    createdBy: "SportsNut",
  },
];
