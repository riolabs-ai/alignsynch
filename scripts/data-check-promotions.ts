/**
 * The promotion collection invariants — the half of `data:check` that a single
 * overlay record cannot see (B-01, issue #27).
 *
 * Kept as pure functions rather than inline blocks in `scripts/data-check.ts` for
 * one reason: an invariant nobody can violate in a test is a comment. Every rule
 * below has a negative case in `scripts/__tests__/promotion-invariants.test.ts`,
 * and the authored pair has a clean one — a rule that only ever passes proves
 * nothing.
 *
 * Numbering: issue #27 called these **E11 / E12 / E13**, but those codes are already
 * taken on `main` (E11 card shelves, E12 one record per subject, E13 analytics keys),
 * so the promotion rules continue the set:
 *
 *   E14 — the join and the identity: every `quizId` resolves to a quiz, `id` and
 *         `(quizId, slot)` are unique, and a content key is rejected at parse time.
 *   E15 — the window and the prize: `endsAt > startsAt` when present, a slot window
 *         never extends the catalog window, a prize that differs from the catalog is
 *         bounded, and the derived bound is the earliest declared one.
 *   E16 — one quiz advertises one set of numbers: overlays that are live at the same
 *         time agree on every engagement key they both set.
 *   W6  — a campaign staged outside the quiz's published life warns; staging against
 *         a draft is legitimate, so it must not fail the build.
 *
 * Diagnostics are returned, never thrown: `data:check` prints every finding of a run
 * so one pass reports every problem.
 */
import {
  effectivePromotionEndsAt,
  zQuizPromotion,
  type Quiz,
  type QuizPromotion,
  type QuizStats,
} from "../content/quiz";

export type PromotionRule = "E14" | "E15" | "E16" | "W6";

export interface PromotionFinding {
  rule: PromotionRule;
  severity: "error" | "warn";
  message: string;
}

/** The engagement keys a campaign may set. `badge` is compared whole. */
const ENGAGEMENT_KEYS = [
  "plays",
  "capacity",
  "rating",
  "rewardCents",
  "badge",
  "limitedTimeEndsAt",
] as const;

type EngagementKey = (typeof ENGAGEMENT_KEYS)[number];

/** `promo-x @ slot` when the record is readable, `promotion[n]` when it is not. */
function labelOf(raw: unknown, index: number): string {
  const record = raw as { id?: unknown; slot?: unknown } | null;
  const id = typeof record?.id === "string" ? record.id : undefined;
  const slot = typeof record?.slot === "string" ? record.slot : undefined;
  if (id === undefined) return `promotion[${index}]`;
  return slot === undefined ? id : `${id} @ ${slot}`;
}

/** The earliest of the declared instants, ignoring the ones that are absent. */
function earliest(...instants: Array<string | undefined>): string | undefined {
  let best: string | undefined;
  for (const instant of instants) {
    if (instant === undefined) continue;
    if (best === undefined || Date.parse(instant) < Date.parse(best)) best = instant;
  }
  return best;
}

/** The instant a campaign stops applying, or `Infinity` when nothing bounds it. */
function effectiveEnd(promotion: QuizPromotion, stats: QuizStats): number {
  const end = effectivePromotionEndsAt(promotion, stats);
  return end === undefined ? Number.POSITIVE_INFINITY : Date.parse(end);
}

/** Half-open `[startsAt, effective end)` windows that share an instant are concurrent. */
function concurrent(first: QuizPromotion, second: QuizPromotion, stats: QuizStats): boolean {
  const firstStart = Date.parse(first.startsAt);
  const secondStart = Date.parse(second.startsAt);
  return firstStart < effectiveEnd(second, stats) && secondStart < effectiveEnd(first, stats);
}

/**
 * A rejected record, classified by the rule it belongs to: an unknown key is an
 * identity error (E14), a window or prize problem is E15, and anything else is the
 * record not being a promotion at all.
 */
function rejectionFindings(raw: unknown, index: number): PromotionFinding[] {
  const result = zQuizPromotion.safeParse(raw);
  if (result.success) return [];
  const label = labelOf(raw, index);
  return result.error.issues.map((issue) => {
    const key = String(issue.path[issue.path.length - 1] ?? "");
    if (issue.code === "unrecognized_keys") {
      const keys = (issue as { keys?: string[] }).keys ?? [];
      return {
        rule: "E14" as const,
        severity: "error" as const,
        message: `${label}: unknown key(s) ${keys.map((name) => `\`${name}\``).join(", ")} — a promotion record is engagement-only (strict); content cannot be carried by an overlay`,
      };
    }
    if (key === "endsAt") {
      return {
        rule: "E15" as const,
        severity: "error" as const,
        message: `${label}: endsAt must be after startsAt — the window is [startsAt, endsAt) (${issue.message})`,
      };
    }
    if (key === "rewardCents") {
      return {
        rule: "E15" as const,
        severity: "error" as const,
        message: `${label}: rewardCents must be > 0 — a free prize is the absence of the key, not a zero (${issue.message})`,
      };
    }
    return {
      rule: "E14" as const,
      severity: "error" as const,
      message: `${label}: ${issue.path.join(".") || "(root)"} — ${issue.message}`,
    };
  });
}

/**
 * Every promotion invariant, in rule order. `records` is deliberately `unknown[]`:
 * the caller passes the fixture as authored, so a malformed record is a finding
 * rather than a type error that hides the other records.
 */
export function promotionFindings(
  records: readonly unknown[],
  quizzes: readonly Quiz[],
): PromotionFinding[] {
  const findings: PromotionFinding[] = [];
  const error = (rule: PromotionRule, message: string) =>
    findings.push({ rule, severity: "error", message });
  const warn = (rule: PromotionRule, message: string) =>
    findings.push({ rule, severity: "warn", message });

  const byId = new Map(quizzes.map((quiz) => [quiz.id, quiz]));
  const parsed: QuizPromotion[] = [];

  records.forEach((raw, index) => {
    const rejected = rejectionFindings(raw, index);
    if (rejected.length > 0) {
      findings.push(...rejected);
      return;
    }
    parsed.push(zQuizPromotion.parse(raw));
  });

  /* ---------------------------------------------------------------- *
   * E14 — the join, the identity, engagement-only
   * ---------------------------------------------------------------- */

  const slotOwners = new Map<string, string>();
  const idOwners = new Map<string, string>();
  for (const [index, promotion] of parsed.entries()) {
    const label = labelOf(promotion, index);
    if (!byId.has(promotion.quizId)) {
      error(
        "E14",
        `${label}: quizId "${promotion.quizId}" is not a record in data/quizzes.ts — an overlay that joins to nothing is a snapshot of a quiz nobody has`,
      );
    }
    const slotKey = `${promotion.quizId}::${promotion.slot}`;
    const slotOwner = slotOwners.get(slotKey);
    if (slotOwner !== undefined) {
      error(
        "E14",
        `${label}: (quizId, slot) "${promotion.quizId} @ ${promotion.slot}" is already carried by "${slotOwner}" — a second campaign on a slot is an edit, not a second record`,
      );
    } else slotOwners.set(slotKey, promotion.id);
    const idOwner = idOwners.get(promotion.id);
    if (idOwner !== undefined) {
      error("E14", `${label}: duplicate promotion id (also used by "${idOwner}")`);
    } else idOwners.set(promotion.id, promotion.id);
  }

  /* ---------------------------------------------------------------- *
   * E15 — the window is valid and the prize is bounded
   * ---------------------------------------------------------------- */

  for (const [index, promotion] of parsed.entries()) {
    const label = labelOf(promotion, index);
    const quiz = byId.get(promotion.quizId);
    if (quiz === undefined) continue; // E14 already reported the broken join
    const stats = quiz.stats;

    if (promotion.endsAt !== undefined) {
      const start = Date.parse(promotion.startsAt);
      const end = Date.parse(promotion.endsAt);
      // The schema rejects this too; the check stays so the rule survives a schema change.
      if (!(end > start)) {
        error(
          "E15",
          `${label}: endsAt (${promotion.endsAt}) must be after startsAt (${promotion.startsAt}) — the window is [startsAt, endsAt)`,
        );
      }
      if (stats.limitedTimeEndsAt !== undefined && end > Date.parse(stats.limitedTimeEndsAt)) {
        error(
          "E15",
          `${label}: endsAt (${promotion.endsAt}) is after the catalog window (${stats.limitedTimeEndsAt}) — a slot may shorten an offer, never extend it`,
        );
      }
    }

    if (promotion.rewardCents !== undefined) {
      if (promotion.rewardCents <= 0) {
        error(
          "E15",
          `${label}: rewardCents ${promotion.rewardCents} — a free prize is the absence of the key, not a zero`,
        );
      }
      const catalogReward = stats.rewardCents;
      if (catalogReward !== promotion.rewardCents && promotion.endsAt === undefined) {
        if (stats.limitedTimeEndsAt === undefined) {
          error(
            "E15",
            `${label}: rewardCents ${promotion.rewardCents} overrides the catalog's ${catalogReward ?? "none"} with no bound — give the campaign an endsAt or give the catalog record a window`,
          );
        }
      }
    }

    // The bound the model derives must be the earliest thing that is declared. This is
    // re-derived here rather than trusted, so a change to the helper cannot silently
    // move a campaign's end.
    const expected = earliest(
      promotion.endsAt,
      stats.limitedTimeEndsAt,
      promotion.limitedTimeEndsAt ?? undefined,
    );
    const actual = effectivePromotionEndsAt(promotion, stats);
    if (actual !== expected) {
      error(
        "E15",
        `${label}: effectivePromotionEndsAt() is ${actual ?? "unbounded"} but the earliest declared bound is ${expected ?? "none"}`,
      );
    }
  }

  /* ---------------------------------------------------------------- *
   * E16 — one quiz advertises one set of numbers
   * ---------------------------------------------------------------- */

  const byQuiz = new Map<string, QuizPromotion[]>();
  for (const promotion of parsed) {
    const group = byQuiz.get(promotion.quizId);
    if (group === undefined) byQuiz.set(promotion.quizId, [promotion]);
    else group.push(promotion);
  }

  for (const [quizId, group] of byQuiz) {
    const quiz = byId.get(quizId);
    if (quiz === undefined) continue;
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const first = group[i];
        const second = group[j];
        if (first === undefined || second === undefined) continue;
        if (!concurrent(first, second, quiz.stats)) continue;
        for (const key of ENGAGEMENT_KEYS) {
          const disagreeing = disagreeOn(first, second, key);
          if (disagreeing !== undefined) {
            error(
              "E16",
              `${quizId}: concurrent campaigns "${first.id} @ ${first.slot}" and "${second.id} @ ${second.slot}" disagree on ${key} (${disagreeing[0]} vs ${disagreeing[1]}) — one quiz cannot advertise two numbers`,
            );
          }
        }
      }
    }
  }

  /* ---------------------------------------------------------------- *
   * W6 — staging a campaign outside the quiz's published life
   * ---------------------------------------------------------------- */

  for (const [index, promotion] of parsed.entries()) {
    const quiz = byId.get(promotion.quizId);
    if (quiz === undefined) continue;
    const label = labelOf(promotion, index);
    if (quiz.status !== "published") {
      warn(
        "W6",
        `${label}: campaigns "${quiz.id}", which is ${quiz.status} — staged ahead of publication, and it can never apply until the quiz publishes`,
      );
      continue;
    }
    if (
      quiz.publishedAt !== undefined &&
      Date.parse(promotion.startsAt) < Date.parse(quiz.publishedAt)
    ) {
      warn(
        "W6",
        `${label}: startsAt (${promotion.startsAt}) is before the quiz's publishedAt (${quiz.publishedAt}) — the campaign cannot outrun the content it merchandises`,
      );
    }
  }

  return findings;
}

/** The two values when both records set `key` and they differ. */
function disagreeOn(
  first: QuizPromotion,
  second: QuizPromotion,
  key: EngagementKey,
): [string, string] | undefined {
  const left = first[key as keyof QuizPromotion];
  const right = second[key as keyof QuizPromotion];
  if (left === undefined || right === undefined) return undefined;
  if (JSON.stringify(left) === JSON.stringify(right)) return undefined;
  return [JSON.stringify(left), JSON.stringify(right)];
}
