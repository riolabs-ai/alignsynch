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
 * Promotions (engagement overlay, keyed by slot — B-01)
 * ------------------------------------------------------------------ */

/**
 * A campaign snapshot for ONE merchandising slot (`explore-page/popular[1]`).
 *
 * It is the third record next to content (`Quiz`) and catalog stats
 * (`QuizStats`) and it is deliberately **engagement-only**: `strict()` turns a
 * content key (`title`, `slug`, `summary`, `categoryIds`, `questions`, `cover`,
 * `author`) into a validation error, so a slot can never fork identity — that
 * is the shadow-record failure E10/W5 exist to prevent. There is no
 * `labelOverride` either: a label that differs from the record's title is a
 * presentation problem, not a second title (see B-01 §A4).
 *
 * `startsAt` is required and `endsAt` optional: the window is half-open,
 * `startsAt <= now < endsAt`, and an absent `endsAt` is bounded by the catalog
 * window rather than meaning "forever". Outside the window the slot renders the
 * catalog projection — never an error state, never a half-applied merge.
 */
export const zQuizPromotionObject = z
  .object({
    id: z.string().regex(/^promo-[a-z0-9-]+$/, "promotion ids are `promo-<kebab-case>`"),
    /** Must resolve to a `Quiz` (E11). It is the join key, never a copy of content. */
    quizId: zId,
    slot: z.string().min(1),
    startsAt: zIsoDateTime,
    endsAt: zIsoDateTime.optional(),
    /* engagement only — content keys are unrepresentable */
    plays: z.number().int().nonnegative().optional(),
    capacity: z.number().int().positive().optional(),
    rating: z.number().min(0).max(5).optional(),
    /** A3: > 0, because "no prize" is the absence of the key. Boundedness is E12. */
    rewardCents: z.number().int().positive().optional(),
    badge: zQuizBadge.optional(),
    /** `null` = this slot shows no countdown, even while the catalog record does. */
    limitedTimeEndsAt: zIsoDateTime.nullable().optional(),
  })
  .strict();

export const zQuizPromotion = zQuizPromotionObject.superRefine((promotion, ctx) => {
  if (
    promotion.endsAt !== undefined &&
    new Date(promotion.endsAt).getTime() <= new Date(promotion.startsAt).getTime()
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["endsAt"],
      message: `endsAt (${promotion.endsAt}) must be after startsAt (${promotion.startsAt}) — the window is [startsAt, endsAt)`,
    });
  }
  // The same seat rule as `zQuizStats`, applied to the override itself; the
  // cross-record case (overlay against catalog) is re-checked after the merge.
  if (
    promotion.capacity !== undefined &&
    promotion.plays !== undefined &&
    promotion.plays > promotion.capacity
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["capacity"],
      message: `capacity (${promotion.capacity}) < plays (${promotion.plays}) — spotsLeft would go negative`,
    });
  }
});

/**
 * The collection rules a single overlay cannot see: ids are unique and
 * `(quizId, slot)` is unique, i.e. at most one live campaign per slot. A second
 * campaign on a slot is an edit of the record, not a second record.
 */
export const zQuizPromotionCollection = z.array(zQuizPromotion).superRefine((promotions, ctx) => {
  const ids = new Set<string>();
  const slots = new Set<string>();
  promotions.forEach((promotion, index) => {
    if (ids.has(promotion.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [index, "id"],
        message: `duplicate promotion id "${promotion.id}"`,
      });
    }
    ids.add(promotion.id);
    const key = `${promotion.quizId}::${promotion.slot}`;
    if (slots.has(key)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [index, "slot"],
        message: `(quizId, slot) "${key}" is carried by two promotions — a second campaign on a slot is an edit`,
      });
    }
    slots.add(key);
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
export type QuizPromotion = z.infer<typeof zQuizPromotion>;
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

/**
 * The instant a campaign stops applying (A2): the earliest of its own `endsAt`,
 * the catalog window, and a concrete overlay countdown. A slot window
 * **intersects** the catalog window — a slot may shorten an offer but never
 * extend it — so an absent `endsAt` means "until something bounds it", not
 * "forever". `limitedTimeEndsAt: null` is deliberately excluded: it cancels the
 * countdown *display*, not the campaign bound.
 */
export function effectivePromotionEndsAt(
  promotion: Pick<QuizPromotion, "endsAt" | "limitedTimeEndsAt">,
  stats: Pick<QuizStats, "limitedTimeEndsAt">,
): string | undefined {
  return earliestInstant(
    promotion.endsAt,
    stats.limitedTimeEndsAt,
    promotion.limitedTimeEndsAt ?? undefined,
  );
}

/**
 * True iff a campaign applies to `quiz` at `now` (A2):
 * `startsAt <= now < effective end` **and** the quiz is published **and** it is
 * past `publishedAt` (a campaign cannot outrun the content it merchandises).
 */
export function isPromotionActive(
  promotion: Pick<QuizPromotion, "startsAt" | "endsAt" | "limitedTimeEndsAt">,
  quiz: Pick<Quiz, "status" | "publishedAt" | "stats">,
  now: Date = new Date(),
): boolean {
  if (quiz.status !== "published") return false;
  const at = now.getTime();
  if (quiz.publishedAt !== undefined && at < new Date(quiz.publishedAt).getTime()) return false;
  if (at < new Date(promotion.startsAt).getTime()) return false;
  const endsAt = effectivePromotionEndsAt(promotion, quiz.stats);
  if (endsAt !== undefined && at >= new Date(endsAt).getTime()) return false;
  return true;
}

/** The earliest of the given instants, ignoring the ones that are absent. */
function earliestInstant(...instants: Array<string | undefined>): string | undefined {
  let best: string | undefined;
  for (const instant of instants) {
    if (instant === undefined) continue;
    if (best === undefined || new Date(instant).getTime() < new Date(best).getTime())
      best = instant;
  }
  return best;
}

/**
 * Field-wise merge of a campaign into catalog stats (B-01 §3).
 *
 * The window is **not** consulted here — this is the pure merge. Callers that
 * render must go through `selectQuizCard`, which merges only while
 * `isPromotionActive` holds, so an expired campaign can never leak into a card.
 *
 * - `undefined` inherits the catalog value, `null` cancels;
 * - the countdown is `min(overlay, catalog, endsAt)` — a slot may shorten an
 *   offer but never extend it, so `limitedTimeEndsAt: null` removes the
 *   countdown *display* while `endsAt`/the catalog window still bound the
 *   campaign (they are different things and both are kept);
 * - `spotsLeft` / `almostFull` / `limitedTime` are recomputed by the caller from
 *   the merged record, never merged;
 * - the seat rule is re-checked on the merged pair and violated data throws: a
 *   card must never render "Only -547 spots left".
 */
export function mergePromotionIntoStats(stats: QuizStats, promotion: QuizPromotion): QuizStats {
  const merged: QuizStats = {
    ...stats,
    ...(promotion.plays !== undefined ? { plays: promotion.plays } : {}),
    ...(promotion.capacity !== undefined ? { capacity: promotion.capacity } : {}),
    ...(promotion.rating !== undefined ? { rating: promotion.rating } : {}),
    ...(promotion.rewardCents !== undefined ? { rewardCents: promotion.rewardCents } : {}),
    ...(promotion.badge !== undefined ? { badge: promotion.badge } : {}),
  };
  if (merged.capacity !== undefined && merged.plays > merged.capacity) {
    throw new Error(
      `promotion "${promotion.id}" (${promotion.quizId} @ ${promotion.slot}): merged plays ` +
        `(${merged.plays}) exceed capacity (${merged.capacity}) — spotsLeft would go negative`,
    );
  }
  const countdown =
    promotion.limitedTimeEndsAt === null
      ? undefined
      : earliestInstant(
          promotion.limitedTimeEndsAt ?? stats.limitedTimeEndsAt,
          stats.limitedTimeEndsAt,
          promotion.endsAt,
        );
  if (countdown === undefined) delete merged.limitedTimeEndsAt;
  else merged.limitedTimeEndsAt = countdown;
  return merged;
}

/**
 * The one live campaign for a quiz (A3, bound 4: one prize per quiz at a time).
 * Every surface that renders a quiz's reward resolves it here, so two live
 * slots of one quiz can never advertise two different prizes. Collection rule
 * E13 fails the build when concurrent overlays disagree; this function then
 * stays deterministic (first in collection order) rather than ambient.
 */
export function activePromotionFor(
  quiz: Quiz,
  promotions: readonly QuizPromotion[],
  now: Date = new Date(),
): QuizPromotion | undefined {
  return promotions.find(
    (promotion) => promotion.quizId === quiz.id && isPromotionActive(promotion, quiz, now),
  );
}

/**
 * Bind the collections once, so a surface that only has a `quizId` (the quiz
 * detail page, an earnings row) asks the same question the card asks:
 * `resolve(quizId, now)`. The quiz is needed because a campaign never applies to
 * unpublished content.
 */
export function createPromotionResolver(
  quizzes: readonly Quiz[],
  promotions: readonly QuizPromotion[],
): (quizId: string, now?: Date) => QuizPromotion | undefined {
  const byId = new Map(quizzes.map((quiz) => [quiz.id, quiz]));
  return (quizId, now = new Date()) => {
    const quiz = byId.get(quizId);
    return quiz === undefined ? undefined : activePromotionFor(quiz, promotions, now);
  };
}

/**
 * The one campaign for **one slot** of a quiz (B-01). The slot-keyed sibling of
 * `activePromotionFor`, and the one a shelf uses: an overlay authored for
 * `explore-page/popular[1]` must not leak into `explore-featured/popular[1]`, and a
 * quiz merchandised twice cannot be told apart without the slot.
 *
 * This is safe against A3 (one prize per quiz at a time) because E16 fails the build
 * when two concurrent overlays of one quiz disagree on any engagement key, so
 * whichever slot answers, the numbers agree.
 */
export function activePromotionForSlot(
  quiz: Quiz,
  promotions: readonly QuizPromotion[],
  slot: string,
  now: Date = new Date(),
): QuizPromotion | undefined {
  return promotions.find(
    (promotion) =>
      promotion.quizId === quiz.id &&
      promotion.slot === slot &&
      isPromotionActive(promotion, quiz, now),
  );
}

/**
 * Bind the collections once for a slot surface — a shelf, a merchandised grid —
 * so every card at position *i* asks the same question with the same index:
 * `resolve(quizId, slot, now)`. `now` stays a parameter (D9): the resolver carries
 * no clock of its own.
 *
 * Indexed by `(quizId, slot)` so a 60-card page costs one lookup per card. A
 * duplicate pair cannot shadow another here: E14 fails the build first, and E17
 * rejects a pair whose slot no shelf renders.
 */
export function createSlotPromotionResolver(
  quizzes: readonly Quiz[],
  promotions: readonly QuizPromotion[],
): (quizId: string, slot: string, now?: Date) => QuizPromotion | undefined {
  const quizById = new Map(quizzes.map((quiz) => [quiz.id, quiz]));
  const bySlot = new Map<string, QuizPromotion>();
  for (const promotion of promotions) {
    bySlot.set(`${promotion.quizId}\u0000${promotion.slot}`, promotion);
  }
  return (quizId, slot, now = new Date()) => {
    const quiz = quizById.get(quizId);
    const promotion = bySlot.get(`${quizId}\u0000${slot}`);
    if (quiz === undefined || promotion === undefined) return undefined;
    return isPromotionActive(promotion, quiz, now) ? promotion : undefined;
  };
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

/** What `selectQuizCard` needs beyond the record. Every field is optional. */
export interface SelectQuizCardOptions {
  resolveCategoryName?: CategoryNameResolver;
  /** The clock a limited-time window is evaluated against. Defaults to now. */
  now?: Date;
  /**
   * The campaign for THIS slot. It is applied **iff** it is active at `now`
   * (`startsAt <= now < endsAt`, quiz published); otherwise the card is the
   * catalog projection, field for field.
   */
  promotion?: QuizPromotion;
}

/**
 * The ONLY way a quiz becomes a list card. Replaces `featuredQuizzes`,
 * `exploreFeatured`, `featured-quizzes-page`'s three tab arrays and the card
 * half of `recentQuizzes` (D2). Pure: no I/O, no clock unless a window is live.
 *
 * The catalog stats are the base; an active campaign for the slot is merged
 * field-wise into them (B-01), and only then are `spotsLeft` / `almostFull` /
 * `limitedTime` recomputed — so a merchandised record can never disagree with
 * its own numbers, and content (`title`, `slug`, `author`, `summary`, …) can
 * never come from a campaign.
 */
export function selectQuizCard(quiz: Quiz, options?: SelectQuizCardOptions): QuizCard;
export function selectQuizCard(
  quiz: Quiz,
  resolveCategoryName?: CategoryNameResolver,
  now?: Date,
): QuizCard;
export function selectQuizCard(
  quiz: Quiz,
  optionsOrResolver?: SelectQuizCardOptions | CategoryNameResolver,
  legacyNow?: Date,
): QuizCard {
  const { resolveCategoryName, now, promotion } =
    optionsOrResolver === undefined || typeof optionsOrResolver === "function"
      ? { resolveCategoryName: optionsOrResolver, now: legacyNow, promotion: undefined }
      : optionsOrResolver;
  const clock = now ?? new Date();
  const stats =
    promotion !== undefined && isPromotionActive(promotion, quiz, clock)
      ? mergePromotionIntoStats(quiz.stats, promotion)
      : quiz.stats;
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
      limitedTime: isLimitedTime(stats, clock),
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
    /**
     * The pass mark travels with the projection: the results screen's "Scored over 70%" badge
     * is the quiz's own threshold, not a literal. `data:check` E22 fails on the literal.
     */
    passingScore: quiz.settings.passingScore,
    questions: quiz.questions,
  };
}

export type QuizForPlay = ReturnType<typeof selectQuizForPlay>;
