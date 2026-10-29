/**
 * Quiz core — the content model for the only surface that actually plays a quiz.
 *
 * Replaces both incompatible quiz types (D1):
 *   - `types/quiz.ts::Quiz`        (numeric id, settings required, no category/cover)
 *   - `data/currentQuiz.tsx::Quiz` (string id, seconds `timeLimit`, category, StaticImageData)
 *
 * Design rules encoded here:
 *  1. answer key = `correctOptionId` (option id), never `correctAnswer` (index)   — D4
 *  2. time is seconds, always, and `0` means "none"                              — D1
 *  3. difficulty is a lowercase enum                                             — D5
 *  4. content (`Quiz`) is separate from engagement (`QuizStats`)                  — D11
 *  5. card views are PROJECTIONS (`selectQuizCard`), never authored arrays       — D2
 *  6. ids are kind-prefixed strings; question ids are `quiz-<quiz>-q<n>`         — D3
 */
import { z } from "zod";
import {
  zContentBase,
  zDifficulty,
  zId,
  zImageRef,
  zIsoDateTime,
  zPersonRef,
  zPublishStatus,
  zSlug,
} from "./core";

/* ------------------------------------------------------------------ *
 * Question
 * ------------------------------------------------------------------ */

/** Option-id alphabet, in order. `options[i].id === QUESTION_OPTION_IDS[i]` at migration. */
export const QUESTION_OPTION_IDS = ["a", "b", "c", "d", "e", "f"] as const;

export const zQuestionOption = z
  .object({
    /**
     * Stable option identity, generated from position at migration. The editor must
     * keep it when options are reordered — that is the point of an id answer key:
     * shuffling options can never re-point the answer (D4).
     */
    id: zId,
    text: z.string().min(1),
  })
  .strict();

export const zQuestion = z
  .object({
    id: zId,
    /** Was `text`. */
    prompt: z.string().min(1),
    options: z.array(zQuestionOption).min(2).max(QUESTION_OPTION_IDS.length),
    /** Was `correctAnswer: number` (an index) in 100/100 mock questions. */
    correctOptionId: zId,
    explanation: z.string().optional(),
    /** Was `image: string | StaticImageData` on currentQuiz questions. */
    media: zImageRef.optional(),
  })
  .strict()
  .superRefine((question, ctx) => {
    const ids = question.options.map((option) => option.id);
    if (!ids.includes(question.correctOptionId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["correctOptionId"],
        message: `correctOptionId "${question.correctOptionId}" does not name an option (have: ${ids.join(", ")})`,
      });
    }
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: `duplicate option ids (${ids.join(", ")})`,
      });
    }
  });

/* ------------------------------------------------------------------ *
 * Settings (authoring knobs)
 * ------------------------------------------------------------------ */

export const zQuizSettings = z
  .object({
    /** 0 = no limit. Seconds in BOTH sources: `types/quiz.ts` said minutes (D1). */
    timeLimitSeconds: z.number().int().nonnegative().default(0),
    /** Was `questionTimer`. 0 = no per-question timer. */
    questionTimerSeconds: z.number().int().nonnegative().default(0),
    passingScore: z.number().int().min(0).max(100).default(70),
    /** Was `randomizeQuestions`. */
    shuffleQuestions: z.boolean().default(false),
    showExplanations: z.boolean().default(true),
    allowRetakes: z.boolean().default(true),
    /** Was `visibility: string`. Also the flag the search index filters on. */
    visibility: z.enum(["public", "unlisted", "private"]).default("private"),
  })
  .strict();

/* ------------------------------------------------------------------ *
 * Stats (engagement — NOT content: absent on authoring fixtures, required by cards)
 * ------------------------------------------------------------------ */

export const zQuizBadgeType = z.enum([
  "hot",
  "editors",
  "trending",
  "new",
  /** measured on explore records (the parent enum missed it) */
  "topRated",
  /** measured on explore records (the parent enum missed it) */
  "popular",
]);

export const zQuizBadge = z
  .object({
    type: zQuizBadgeType,
    /** Display copy ships with the badge ("Hot 🔥"); not derivable from `type`. */
    label: z.string().min(1),
  })
  .strict();

/** Seats can never be over-subscribed in a snapshot: `spotsLeft` is derived from this pair. */
function seatsWithinCapacity(
  stats: { readonly plays: number; readonly capacity?: number | undefined },
  ctx: z.RefinementCtx,
): void {
  if (stats.capacity !== undefined && stats.plays > stats.capacity) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["capacity"],
      message: `capacity (${stats.capacity}) < plays (${stats.plays}) — spotsLeft would go negative`,
    });
  }
}

export const zQuizStatsObject = z
  .object({
    /** Card label "2,453 players joined". Was `players` on cards. */
    plays: z.number().int().nonnegative().default(0),
    rating: z.number().min(0).max(5).optional(),
    ratingCount: z.number().int().nonnegative().optional(),
    /** Was `maxPlayers`. Seats offered, not lifetime capacity. */
    capacity: z.number().int().positive().optional(),
    /** Was `reward: "$10.00"` (a formatted string). Render via `formatCurrency`. */
    rewardCents: z.number().int().nonnegative().optional(),
    badge: zQuizBadge.optional(),
    /** Was `expiresIn: 172800` (a seconds-until snapshot). Absolute instant, one source of truth. */
    limitedTimeEndsAt: zIsoDateTime.optional(),
    isTournament: z.boolean().default(false),
    updatedAt: zIsoDateTime.optional(),
    /**
     * Social proof ("Alex J., Sarah W., …" avatars on the home cards). Engagement
     * data that cannot be derived from content. Empty when unknown.
     */
    recentPlayers: z.array(zPersonRef).default([]),
  })
  .strict();

/** Validated stats: the object rule above plus the cross-field seat check. */
export const zQuizStats = zQuizStatsObject.superRefine(seatsWithinCapacity);

/* ------------------------------------------------------------------ *
 * Quiz (content)
 * ------------------------------------------------------------------ */

export const zQuiz = zContentBase
  .extend({
    kind: z.literal("quiz"),
    /** Publication state — not derivable from `publishedAt` (see core.ts). */
    status: zPublishStatus.default("draft"),
    /** Required: every quiz record has one and every playable surface filters on it. */
    difficulty: zDifficulty,
    /**
     * Empty is legal: an authoring draft starts with no questions. `data:check`
     * reports a PUBLISHED quiz with 0 questions (W1) rather than failing here.
     */
    questions: z.array(zQuestion),
    settings: zQuizSettings,
    stats: zQuizStats.default({}),
  })
  .strict()
  .superRefine((quiz, ctx) => {
    const seen = new Set<string>();
    quiz.questions.forEach((question, index) => {
      if (seen.has(question.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["questions", index, "id"],
          message: `duplicate question id "${question.id}" within quiz "${quiz.id}"`,
        });
      }
      seen.add(question.id);
    });
  });

/* ------------------------------------------------------------------ *
 * Derived views — projections, never authored (D2)
 * ------------------------------------------------------------------ */

/** A resolved category label for a card. `name` is absent when the taxonomy has no row. */
export const zCategoryRef = z
  .object({
    id: zId,
    name: z.string().min(1).optional(),
  })
  .strict();

/** `QuizStats` + the derived fields the card components read. */
export const zQuizCardStats = zQuizStatsObject
  .extend({
    /** `capacity - plays`, clamped at 0. */
    spotsLeft: z.number().int().nonnegative().optional(),
    /** Derived so it can never disagree with spotsLeft. */
    almostFull: z.boolean(),
    /** True iff a window is still running; after migration that is the only encoding left. */
    limitedTime: z.boolean(),
  })
  .strict()
  .superRefine(seatsWithinCapacity);

export const zQuizCard = z
  .object({
    id: zId,
    slug: zSlug,
    /** `/quiz/<id>` — the route param is the id today (`app/(mainlayout)/quiz/[id]`). */
    href: z.string().startsWith("/"),
    title: z.string().min(1),
    summary: z.string().min(1),
    cover: zImageRef.optional(),
    categoryIds: z.array(zId).min(1),
    categories: z.array(zCategoryRef),
    difficulty: zDifficulty,
    author: zPersonRef.optional(),
    publishedAt: zIsoDateTime.optional(),
    featured: z.literal(true).optional(),
    /** The card prints the duration ("20 min"); it lives on the record's settings. */
    timeLimitSeconds: z.number().int().nonnegative(),
    stats: zQuizCardStats,
  })
  .strict();

/** Authoring analytics — a sibling of `QuizStats`, sourced from the profile domain. */
export const zQuizAnalytics = z
  .object({
    /** % of started plays that finished. */
    completionRate: z.number().min(0).max(100).optional(),
    /** Was `averageTimeSpent` (seconds). */
    averageTimeSpentSeconds: z.number().int().nonnegative().optional(),
    /** Was `mostMissedQuestion: number` — a positional answer reference (D4). */
    mostMissedQuestionId: zId.nullable().optional(),
    highestScore: z.number().min(0).max(100).optional(),
    lowestScore: z.number().min(0).max(100).optional(),
    /** Was `averageScore` (top-level on CreatedQuiz). */
    averageScore: z.number().min(0).max(100).optional(),
    /**
     * Was `revenue: 1425.0` (dollars) on the my-quizzes cards. Authoring earnings,
     * not the prize offered (`QuizStats.rewardCents`), so it is analytics, not
     * content. Cents, like every other money value in the model.
     */
    revenueCents: z.number().int().nonnegative().optional(),
  })
  .strict();

/** Minimal tournament reference (the tournament domain is not owned by this model). */
export const zTournamentRef = z
  .object({
    id: zId.optional(),
    startsAt: zIsoDateTime,
    endsAt: zIsoDateTime,
    participants: z.number().int().nonnegative(),
    /** Was `prize: "$500 Amazon Gift Card"` — a label, not a number. */
    prizeLabel: z.string().min(1),
    status: z.enum(["upcoming", "active", "completed"]),
  })
  .strict();

/**
 * Dashboard/profile projection: the same view as a card at two densities
 * (`dashboard/recent-quizzes` 5 fields, profile `CreatedQuiz` 24 fields).
 */
export const zQuizAuthoringCard = z
  .object({
    id: zId,
    slug: zSlug,
    title: z.string().min(1),
    summary: z.string().min(1),
    cover: zImageRef.optional(),
    categoryIds: z.array(zId).min(1),
    categories: z.array(zCategoryRef),
    difficulty: zDifficulty,
    status: zPublishStatus,
    createdAt: zIsoDateTime.optional(),
    publishedAt: zIsoDateTime.optional(),
    updatedAt: zIsoDateTime.optional(),
    featured: z.literal(true).optional(),
    plays: z.number().int().nonnegative(),
    rating: z.number().min(0).max(5).optional(),
    questionCount: z.number().int().nonnegative(),
    /** The my-quizzes list prints the duration next to the title. */
    timeLimitSeconds: z.number().int().nonnegative(),
    /** Was `maxPlayers`: the authoring card shows `plays / capacity` and a seat bar. */
    capacity: z.number().int().positive().optional(),
    /** `capacity - plays`, clamped at 0. Same derivation as the public card. */
    spotsLeft: z.number().int().nonnegative().optional(),
    isTournament: z.boolean(),
    tournament: zTournamentRef.optional(),
    analytics: zQuizAnalytics.optional(),
  })
  .strict();

/* ------------------------------------------------------------------ *
 * Types
 * ------------------------------------------------------------------ */

export type QuestionOption = z.infer<typeof zQuestionOption>;
export type Question = z.infer<typeof zQuestion>;
export type QuizSettings = z.infer<typeof zQuizSettings>;
export type QuizStats = z.infer<typeof zQuizStats>;
export type Quiz = z.infer<typeof zQuiz>;
export type QuizCard = z.infer<typeof zQuizCard>;
export type QuizCardStats = z.infer<typeof zQuizCardStats>;
export type QuizAnalytics = z.infer<typeof zQuizAnalytics>;
export type TournamentRef = z.infer<typeof zTournamentRef>;
export type QuizAuthoringCard = z.infer<typeof zQuizAuthoringCard>;
export type QuizStatus = z.infer<typeof zPublishStatus>;
export type QuizBadge = z.infer<typeof zQuizBadge>;
export type QuizBadgeType = z.infer<typeof zQuizBadgeType>;

/** Resolves a category id to its display name. Owned by the taxonomy, injected here. */
export type CategoryNameResolver = (id: string) => string | undefined;

/* ------------------------------------------------------------------ *
 * Selectors
 * ------------------------------------------------------------------ */

/** `spotsLeft = capacity - plays`. Undefined when capacity is unknown. */
export function spotsLeftOf(stats: {
  readonly plays: number;
  readonly capacity?: number;
}): number | undefined {
  return stats.capacity === undefined ? undefined : Math.max(0, stats.capacity - stats.plays);
}

/**
 * Threshold for the "Almost Full" ribbon. Measured against the only 4 authored
 * values: 6.4% (true), 2.3% (true), 18.2% (false), 35.2% (false).
 */
export const ALMOST_FULL_RATIO = 0.1;

export function almostFullOf(stats: {
  readonly plays: number;
  readonly capacity?: number;
}): boolean {
  const left = spotsLeftOf(stats);
  if (left === undefined || stats.capacity === undefined || stats.capacity === 0) return false;
  return left / stats.capacity <= ALMOST_FULL_RATIO;
}

/** True iff a limited-time window is still running. */
export function isLimitedTime(
  stats: { readonly limitedTimeEndsAt?: string },
  now: Date = new Date(),
): boolean {
  return (
    stats.limitedTimeEndsAt !== undefined &&
    new Date(stats.limitedTimeEndsAt).getTime() > now.getTime()
  );
}

function categoriesOf(
  quiz: Pick<Quiz, "categoryIds">,
  resolve?: CategoryNameResolver,
): Array<{ id: string; name?: string }> {
  return quiz.categoryIds.map((id) => {
    const name = resolve?.(id);
    return name ? { id, name } : { id };
  });
}

/**
 * The ONLY way a quiz becomes a list card. Replaces `featuredQuizzes`,
 * `exploreFeatured`, `featured-quizzes-page`'s three tab arrays and the card
 * half of `recentQuizzes` (D2). Pure: no I/O, no clock unless a window is live.
 */
export function selectQuizCard(
  quiz: Quiz,
  resolveCategoryName?: CategoryNameResolver,
  now: Date = new Date(),
): QuizCard {
  const stats = quiz.stats;
  return {
    id: quiz.id,
    slug: quiz.slug,
    href: `/quiz/${quiz.id}`,
    title: quiz.title,
    summary: quiz.summary,
    ...(quiz.cover ? { cover: quiz.cover } : {}),
    categoryIds: quiz.categoryIds,
    categories: categoriesOf(quiz, resolveCategoryName),
    difficulty: quiz.difficulty,
    ...(quiz.author ? { author: quiz.author } : {}),
    ...(quiz.publishedAt ? { publishedAt: quiz.publishedAt } : {}),
    ...(quiz.featured ? { featured: true as const } : {}),
    timeLimitSeconds: quiz.settings.timeLimitSeconds,
    stats: {
      ...stats,
      spotsLeft: spotsLeftOf(stats),
      almostFull: almostFullOf(stats),
      limitedTime: isLimitedTime(stats, now),
    },
  };
}

/** Dashboard/profile projection — the second (and last) card shape this model needs. */
export function selectQuizAuthoringCard(
  quiz: Quiz,
  resolveCategoryName?: CategoryNameResolver,
  analytics?: QuizAnalytics,
  tournament?: TournamentRef,
): QuizAuthoringCard {
  return {
    id: quiz.id,
    slug: quiz.slug,
    title: quiz.title,
    summary: quiz.summary,
    ...(quiz.cover ? { cover: quiz.cover } : {}),
    categoryIds: quiz.categoryIds,
    categories: categoriesOf(quiz, resolveCategoryName),
    difficulty: quiz.difficulty,
    status: quiz.status,
    ...(quiz.createdAt ? { createdAt: quiz.createdAt } : {}),
    ...(quiz.publishedAt ? { publishedAt: quiz.publishedAt } : {}),
    ...(quiz.stats.updatedAt ? { updatedAt: quiz.stats.updatedAt } : {}),
    ...(quiz.featured ? { featured: true as const } : {}),
    plays: quiz.stats.plays,
    ...(quiz.stats.rating !== undefined ? { rating: quiz.stats.rating } : {}),
    questionCount: quiz.questions.length,
    timeLimitSeconds: quiz.settings.timeLimitSeconds,
    ...(quiz.stats.capacity !== undefined ? { capacity: quiz.stats.capacity } : {}),
    spotsLeft: spotsLeftOf(quiz.stats),
    isTournament: quiz.stats.isTournament,
    ...(tournament ? { tournament } : {}),
    ...(analytics ? { analytics } : {}),
  };
}

/**
 * The play surface reads `title`, a category LABEL, `difficulty` and the questions.
 * The label is resolved here rather than stored.
 */
export function selectQuizForPlay(quiz: Quiz, resolveCategoryName?: CategoryNameResolver) {
  const firstCategoryId = quiz.categoryIds[0] ?? "";
  return {
    id: quiz.id,
    title: quiz.title,
    categoryLabel: resolveCategoryName?.(firstCategoryId) ?? firstCategoryId,
    difficulty: quiz.difficulty,
    timeLimitSeconds: quiz.settings.timeLimitSeconds,
    questions: quiz.questions,
  };
}

export type QuizForPlay = ReturnType<typeof selectQuizForPlay>;
