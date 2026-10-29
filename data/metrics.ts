/**
 * The metric fixture — every number a surface asserts, in one place.
 *
 * Cross-checked against the 69 rendered quantities WU-4 found in `components/**` and
 * `app/**` (issue #49). Each entry below is a number that used to be typed into JSX; the
 * component now reads the snapshot and calls a formatter from `content/metrics.ts`, so the
 * rendered string is a function of this file.
 *
 * Three rules the fixture obeys, enforced by E25 in `scripts/data-check.ts`:
 *
 *   1. **a key is `owner.name`** — the owner is the surface or programme, the name is what it
 *      measures. A key nothing renders is an error: an unused snapshot is data that drifts
 *      free of the page it describes.
 *   2. **a delta has two values** — `previous` is the comparable period, and `delta` says how
 *      the change reads. `+4 from last month` is `deltaOf(metrics["dashboard.quizzes"])`,
 *      never a string.
 *   3. **money is integer cents** — the same convention as `QuizStats.rewardCents` and
 *      `QuizAnalytics.revenueCents`, so one formatter renders every amount.
 *
 * Money that a *domain* already owns stays out: a quiz's revenue is `data/quiz-analytics.ts`.
 * A monthly price is here (`plans.pro.monthly`) because no plan entity exists yet — WU-9 owns
 * the plan cards, and when that fixture lands the price moves to the plan record.
 *
 * ## The declared disagreement
 *
 * `/pricing` advertises `Save 20%` for annual billing and `/settings` advertises
 * `Annual (Save 16%)`. Two surfaces, one concept, two numbers. Rendering a single value would
 * silently change one of the two pages, so both are carried (`pricing.annualDiscount`,
 * `settings.annualDiscount`) and the decision — which number is true — is a follow-up card,
 * not a build. A fixture that quietly picked one would hide a pricing bug behind a green gate.
 */
import type { MetricSnapshot } from "../content/metrics";

/**
 * Every rendered quantity, keyed `owner.name`.
 *
 * `satisfies` rather than a widened annotation: a typo in a unit or a period is a compile
 * error here, and the *keys* stay literal types so the tables below can point at them.
 */
export const metrics = {
  /* --- /dashboard/user — the four stat cards and the two side cards --------------- */

  /** Header wallet pill and the "Total Balance" card render the same balance. */
  "dashboard.balance": {
    unit: "currency",
    value: 12_450,
    previous: 11_116,
    period: "month",
    delta: "percent",
  },
  "dashboard.quizzes": { unit: "count", value: 24, previous: 20, period: "month" },
  "dashboard.players": { unit: "count", value: 573, previous: 455, period: "month" },
  "dashboard.completionRate": { unit: "percent", value: 78.3, previous: 76.2, period: "month" },
  /** "You earned $2.50 from quiz plays" in Recent Activity. */
  "dashboard.lastEarning": { unit: "currency", value: 250, period: "allTime" },
  "dashboard.affiliate.referrals": { unit: "count", value: 42, period: "allTime" },
  "dashboard.affiliate.commissionEarned": { unit: "currency", value: 7_825, period: "allTime" },
  "dashboard.affiliate.conversionRate": { unit: "percent", value: 24.8, period: "allTime" },
  "dashboard.quizTotalViews": { unit: "count", value: 2_845, period: "allTime" },
  /** "Avg. Completion Time" — 252 s renders `4m 12s`. */
  "dashboard.quizAverageSeconds": { unit: "seconds", value: 252, period: "allTime" },

  /* --- /dashboard/user?tab=wallet ------------------------------------------------ */

  "wallet.thisMonth": {
    unit: "currency",
    value: 4_250,
    previous: 3_795,
    period: "month",
    delta: "percent",
  },
  "wallet.minimumWithdrawal": { unit: "currency", value: 1_000, period: "allTime" },
  /**
   * The breakdown rows below must sum to the balance (`dashboard.balance`), which is the
   * total the page implies; there is no separate authored total to drift from it (E25).
   */
  "wallet.quizPlays": { unit: "currency", value: 7_825, period: "allTime" },
  "wallet.affiliateCommissions": { unit: "currency", value: 3_250, period: "allTime" },
  "wallet.premiumContent": { unit: "currency", value: 1_375, period: "allTime" },

  /* --- /affiliate — the hero, the calculator and the comparison table ------------- */

  "affiliate.maxCommission": { unit: "percent", value: 30, period: "allTime" },
  "affiliate.affiliates": { unit: "count", value: 10_000, period: "allTime" },
  /** `$1M+` paid out, in cents. */
  "affiliate.paidOut": { unit: "currency", value: 100_000_000, period: "allTime" },
  /** The hero's "This Month" panel: `$1,240.50` and `+12.5%`. */
  "affiliate.thisMonth": {
    unit: "currency",
    value: 124_050,
    previous: 110_267,
    period: "month",
    delta: "percent",
  },
  /** The goal the panel's progress bar and `75% of monthly goal` are computed against. */
  "affiliate.monthGoal": { unit: "currency", value: 165_400, period: "allTime" },
  /** The "other programs" column of the comparison table: `10-20%`. */
  "affiliate.comparison.commissionMin": { unit: "percent", value: 10, period: "allTime" },
  "affiliate.comparison.commissionMax": { unit: "percent", value: 20, period: "allTime" },
  "affiliate.cookieDays": { unit: "days", value: 90, period: "allTime" },
  "affiliate.comparison.cookieDays": { unit: "days", value: 30, period: "allTime" },
  "affiliate.minimumPayout": { unit: "currency", value: 5_000, period: "allTime" },
  "affiliate.comparison.minimumPayout": { unit: "currency", value: 10_000, period: "allTime" },
  "affiliate.pendingCommissions": { unit: "currency", value: 1_825, period: "allTime" },
  /** `/` referral card: `Earn up to $10`. */
  "affiliate.referralBonus": { unit: "currency", value: 1_000, period: "allTime" },
  "affiliate.tier.basic": { unit: "percent", value: 20, period: "allTime" },
  "affiliate.tier.silver": { unit: "percent", value: 25, period: "allTime" },
  "affiliate.tier.gold": { unit: "percent", value: 30, period: "allTime" },
  "affiliate.tier.platinum": { unit: "percent", value: 35, period: "allTime" },

  /* --- /daily-challenge ----------------------------------------------------------- */

  "daily.challenge.topPrize": { unit: "coins", value: 500, period: "day" },
  "daily.challenge.streak.days": { unit: "days", value: 4, period: "day" },
  /** The next badge threshold: the bar renders `badgeGoalDays` steps, `streakDays` filled. */
  "daily.challenge.streak.badgeGoalDays": { unit: "days", value: 7, period: "day" },
  "daily.challenge.streak.participantPercent": { unit: "percent", value: 65, period: "day" },
  /** The percentile bucket a top-10 finish earns, and the one everyone else earns. */
  "daily.challenge.rank.top10Percent": { unit: "percent", value: 10, period: "day" },
  "daily.challenge.rank.top30Percent": { unit: "percent", value: 30, period: "day" },
  /** The "+125 XP" badge on the results header. */
  "daily.challenge.earnedXp": { unit: "xp", value: 125, period: "day" },
  "daily.challenge.totalCoins": { unit: "coins", value: 75, period: "day" },
  "daily.challenge.totalXp": { unit: "xp", value: 125, period: "day" },
  "daily.challenge.reward.participantCoins": { unit: "coins", value: 50, period: "day" },
  "daily.challenge.reward.streakBonusCoins": { unit: "coins", value: 25, period: "day" },
  "daily.challenge.reward.topRankXp": { unit: "xp", value: 50, period: "day" },
  /** The score bonus is `score × this`, not a second authored number. */
  "daily.challenge.reward.xpPerScorePoint": { unit: "xp", value: 1, period: "day" },

  /* --- /battle -------------------------------------------------------------------- */

  /*
   * The group battle's 3-10 roster left this file for `data/battle-modes.ts`, where the
   * `group` mode owns it: a roster bound is a domain fact the mode record needs to render
   * its card, not a quantity the page renders. E25's range check reads the record now.
   */

  /* --- /leaderboard --------------------------------------------------------------- */

  "leaderboard.season.points": { unit: "count", value: 3_250, period: "allTime" },
  "leaderboard.season.target": { unit: "count", value: 4_000, period: "allTime" },

  /* --- /news/[slug] --------------------------------------------------------------- */

  /** The quoted engagement lift in the popular-comments block. */
  "news.testimonialEngagementLift": { unit: "percent", value: 45, period: "allTime" },

  /* --- /pricing and /settings ----------------------------------------------------- */

  "plans.pro.monthly": { unit: "currency", value: 999, period: "month" },
  "plans.pro.yearly": { unit: "currency", value: 9_999, period: "year" },
  "plans.premium.monthly": { unit: "currency", value: 1_999, period: "month" },
  "plans.premium.yearly": { unit: "currency", value: 19_999, period: "year" },
  "plans.free.quizLimit": { unit: "count", value: 5, period: "allTime" },
  /** Declared disagreement — see the header. */
  "pricing.annualDiscount": { unit: "percent", value: 20, period: "allTime" },
  "settings.annualDiscount": { unit: "percent", value: 16, period: "allTime" },

  /* --- the marketing shell -------------------------------------------------------- */

  "platform.activePlayers": { unit: "count", value: 10_000, period: "allTime" },
  "home.newsletterSubscribers": { unit: "count", value: 10_000, period: "allTime" },

  /* --- /tournaments — the domain is a ref (W-9); its numbers still live here ------- */

  "tournament.featured.participants": { unit: "count", value: 1_248, period: "allTime" },
  "tournament.featured.prizePool": { unit: "currency", value: 500_000, period: "allTime" },
  "tournament.featured.advanceCount": { unit: "count", value: 100, period: "allTime" },
  "tournament.you.percentile": { unit: "percent", value: 15, period: "allTime" },
  "tournament.you.accuracy": { unit: "percent", value: 82, period: "allTime" },
  "tournament.prizes.perfectRoundAccuracy": { unit: "percent", value: 100, period: "allTime" },
  "tournament.rules.correctPoints": { unit: "count", value: 10, period: "allTime" },
  "tournament.rules.speedBonusPoints": { unit: "count", value: 5, period: "allTime" },
  "tournament.rules.incorrectPoints": { unit: "count", value: 0, period: "allTime" },
  "tournament.rules.unansweredPoints": { unit: "count", value: 0, period: "allTime" },
  "tournament.rules.streakBonusPerAnswer": { unit: "count", value: 2, period: "allTime" },
  "tournament.rules.streakBonusMax": { unit: "count", value: 10, period: "allTime" },
} as const satisfies Record<string, MetricSnapshot>;

/** A key of the fixture. The type is the fixture, so a typo is a compile error at the call site. */
export type MetricKey = keyof typeof metrics;

/** The whole table as one shape, for the checks in `scripts/data-check.ts`. */
export const metricTable: Readonly<Record<string, MetricSnapshot>> = metrics;

/** One snapshot by key. The components read through this, never through a literal number. */
export function metric(key: MetricKey): MetricSnapshot {
  return metrics[key];
}

/* ------------------------------------------------------------------ *
 * Tables of numbers
 *
 * A commission tier, a streak reward and a breakdown row are not new domains: they are rows
 * whose fields are numbers, so they live with the numbers. Each points at a snapshot key
 * instead of holding a literal, so a table cannot drift from the value it renders.
 * ------------------------------------------------------------------ */

/** A commission tier. `to` is absent on the open-ended top tier, which renders `100+`. */
export interface AffiliateTier {
  id: "basic" | "silver" | "gold" | "platinum";
  label: string;
  /** The tier's rate, as a snapshot key. */
  rate: MetricKey;
  from: number;
  to?: number;
}

export const affiliateTiers: readonly AffiliateTier[] = [
  { id: "basic", label: "Basic Tier", rate: "affiliate.tier.basic", from: 0, to: 24 },
  { id: "silver", label: "Silver Tier", rate: "affiliate.tier.silver", from: 25, to: 49 },
  { id: "gold", label: "Gold Tier", rate: "affiliate.tier.gold", from: 50, to: 99 },
  { id: "platinum", label: "Platinum Tier", rate: "affiliate.tier.platinum", from: 100 },
];

/** The tier the prototype user is on — what the dashboard's "Commission Rate" card shows. */
export const currentAffiliateTier: AffiliateTier = affiliateTiers[0];

/** One row of the wallet's earnings breakdown: the amount, plus the share it claims to be. */
export interface EarningSource {
  label: string;
  amount: MetricKey;
  /** The share the bar and the label render. Checked against `amount / earningsTotal` (E25). */
  sharePct: number;
}

export const earningSources: readonly EarningSource[] = [
  { label: "Quiz Plays", amount: "wallet.quizPlays", sharePct: 62.8 },
  { label: "Affiliate Commissions", amount: "wallet.affiliateCommissions", sharePct: 26.1 },
  { label: "Premium Content", amount: "wallet.premiumContent", sharePct: 11.1 },
];

/** A streak reward band: `3 Days` pays `+50 Coins`; the badge bands carry a label instead. */
export interface StreakReward {
  days: number;
  coins?: number;
  label?: string;
}

export const streakRewards: readonly StreakReward[] = [
  { days: 3, coins: 50 },
  { days: 5, coins: 100 },
  { days: 7, label: "Special Badge" },
  { days: 14, label: "Premium Theme" },
];
