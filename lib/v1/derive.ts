/**
 * lib/v1/derive.ts — the /v1 prototype's derivations, all pure.
 *
 * The one thing the prototype must not re-implement is the arithmetic: a Gap is
 * `content/gaps.ts::gapKindsOf`, a verdict is `instanceAlignment`, a stage is
 * `content/stages.ts::stageOf`. This module only wraps them around the prototype's own
 * relationship shape (`V1Relationship`), which the real `zAssessmentInstance` cannot hold while a
 * relationship is mid-flight. No React, no Next, no clock, no `lib/db/**` — the client store
 * imports it, and it stays out of the server graph for the same reason.
 *
 * The corrected model (#340) changed one hinge: a session is **complete when both parties
 * accept it**, not when the second party submits. Submission is necessary but not sufficient —
 * after both submit, each party reviews and accepts, and only then does the blind rule lift and
 * the report unlock. Every "complete" derivation below reads that hinge, so a submission cannot
 * leak a value.
 */
import type { AspectGaps, AlignmentVerdict, FlagCounts, GapKinds } from "@/content/gaps";
import { flagCountsOf, gapKindsIn, gapKindsOf, instanceAlignment } from "@/content/gaps";
import { stageOf, type RelationshipStage } from "@/content/stages";
import type { V1Relationship, V1Session } from "@/data/v1/fixtures";

/** The counts one relationship contributes to its own status. */
export interface RelationshipProgress {
  readonly aspectCount: number;
  readonly hasCounterparty: boolean;
  readonly initiatorAnswered: number;
  readonly counterpartyAnswered: number;
}

export function progressOf(rel: V1Relationship): RelationshipProgress {
  const aspectCount = rel.items.length;
  const hasCounterparty = rel.counterpartyName !== null;
  const answered = (map: Readonly<Record<string, unknown>>) =>
    rel.items.filter((item) => map[item.id] !== undefined).length;
  return {
    aspectCount,
    hasCounterparty,
    initiatorAnswered: answered(rel.initiatorAnswers),
    counterpartyAnswered: answered(rel.counterpartyAnswers),
  };
}

/** Both parties have answered every Aspect — necessary for completion, but not sufficient. */
export function bothSubmittedOf(rel: V1Relationship): boolean {
  if (rel.counterpartyName === null) return false;
  if (rel.items.length === 0) return false;
  return rel.items.every(
    (item) =>
      rel.initiatorAnswers[item.id] !== undefined && rel.counterpartyAnswers[item.id] !== undefined,
  );
}

/** Both parties have accepted — the closing event of a session. */
export function bothAcceptedOf(rel: V1Relationship): boolean {
  return rel.initiatorAccepted && rel.counterpartyAccepted;
}

/**
 * A session is complete when both parties have submitted **and** both have accepted. Submission
 * alone leaves the blind rule in force; acceptance is the event that lifts it.
 */
export function sessionCompleteOf(rel: V1Relationship): boolean {
  return bothSubmittedOf(rel) && bothAcceptedOf(rel);
}

/** The moment the report unlocks: the later of the two acceptance instants, or null. */
export function unlockedAtOf(rel: V1Relationship): string | null {
  if (rel.initiatorAcceptedAt === null || rel.counterpartyAcceptedAt === null) return null;
  // ISO-8601 UTC instants compare lexicographically in chronological order, so the later of the
  // two acceptance instants is simply the greater string.
  const instants = [rel.initiatorAcceptedAt, rel.counterpartyAcceptedAt].sort();
  return instants[instants.length - 1];
}

/** Whether the relationship's subscription is in good standing (new sessions allowed). */
export function subscriptionGoodStandingOf(rel: V1Relationship): boolean {
  return rel.subscription !== null && rel.subscription.status === "active";
}

/** The Gaps of one Aspect, absent when either side has not answered it. */
export function aspectGapsOf(rel: V1Relationship, itemId: string): GapKinds {
  const initiator = rel.initiatorAnswers[itemId];
  const counterparty = rel.counterpartyAnswers[itemId];
  if (initiator === undefined || counterparty === undefined) return {};
  return gapKindsOf(initiator, counterparty);
}

/** Every Aspect's Gaps, in the instance's own order, for `instanceAlignment`. */
export function allAspectGaps(rel: V1Relationship): AspectGaps[] {
  return rel.items.map((item) => ({ itemId: item.id, gaps: aspectGapsOf(rel, item.id) }));
}

/** The verdict under the relationship's Setting — null until the session is complete (accepted). */
export function verdictOf(rel: V1Relationship): AlignmentVerdict | null {
  if (!sessionCompleteOf(rel)) return null;
  return instanceAlignment(allAspectGaps(rel), rel.setting);
}

/**
 * The flag counts per severity (yellow / orange / pink / red), derived from the Gaps — never
 * stored, never authored. `null` until the session is complete (both submitted **and**
 * accepted): an unscored relationship has no verdict, so it reports no counts, and never four
 * zeroes. The arithmetic is `content/gaps.ts::flagCountsOf`; this is only the relationship
 * gate that decides whether a sheet has been scored.
 */
export function flagCountsOfRelationship(rel: V1Relationship): FlagCounts | null {
  if (!sessionCompleteOf(rel)) return null;
  return flagCountsOf(allAspectGaps(rel));
}

/**
 * The stage, derived exactly as `content/stages.ts` derives it, with the corrected hinge: the
 * sheet is "complete" only when both parties have accepted. Unclaimed → invited; claimed and not
 * accepted → connected; accepted and unmet → sharing; accepted and within the Setting → aligned.
 */
export function stageOfRelationship(rel: V1Relationship): RelationshipStage {
  if (rel.counterpartyName === null) return "invited";
  if (!sessionCompleteOf(rel)) return "connected";
  const aspects = allAspectGaps(rel);
  if (aspects.length === 0) return "sharing";
  return stageOf({
    counterpartyClaimed: true,
    bothSubmitted: true,
    setting: rel.setting,
    aspects,
  });
}

/** The numbers a screen prints about a relationship: stage, gap totals and the verdict. */
export interface GapSummary {
  readonly stage: RelationshipStage;
  readonly totalGaps: number;
  readonly unmetGaps: number;
  readonly aligned: boolean;
  readonly verdict: AlignmentVerdict | null;
}

export function gapSummary(rel: V1Relationship): GapSummary {
  const stage = stageOfRelationship(rel);
  const verdict = verdictOf(rel);
  const totalGaps = rel.items.reduce(
    (sum, item) => sum + gapKindsIn(aspectGapsOf(rel, item.id)).length,
    0,
  );
  return {
    stage,
    totalGaps,
    unmetGaps: verdict?.unmet.length ?? 0,
    aligned: verdict?.aligned ?? false,
    verdict,
  };
}

/** The relationship's display name: its own, else the template's title. */
export function relationshipNameOf(rel: V1Relationship, templateTitle: string): string {
  return rel.name ?? templateTitle;
}

/**
 * The mean Gap across the completed report — the "average alignment" figure the Manage
 * dashboard shows the Initiator (and Admin), never the Counterparty. Null until the session is
 * complete, or when nothing is measurable. Lower is more aligned.
 */
export function meanGapOf(rel: V1Relationship): number | null {
  if (!sessionCompleteOf(rel)) return null;
  let sum = 0;
  let count = 0;
  for (const item of rel.items) {
    const gaps = aspectGapsOf(rel, item.id);
    for (const kind of gapKindsIn(gaps)) {
      const gap = gaps[kind];
      if (gap !== undefined) {
        sum += gap;
        count += 1;
      }
    }
  }
  return count === 0 ? null : sum / count;
}

/* ------------------------------------------------------------------ *
 * The session timeline's derivations
 * ------------------------------------------------------------------ */

/** The gap facts of one completed session — everything a timeline row and the trend read. */
export interface SessionSummary {
  readonly completedAt: string;
  readonly verdict: AlignmentVerdict;
  readonly aligned: boolean;
  readonly unmetCount: number;
  /** The single widest Gap across every Aspect, or null when nothing is measurable. */
  readonly widestGap: number | null;
  /** The mean Gap across every kind the session measured, or null when nothing is. */
  readonly meanGap: number | null;
}

/**
 * One completed session, read through the same arithmetic the report reads: the verdict is
 * `instanceAlignment` over the session's own answers, the widest and mean Gaps are computed
 * from those answers. Nothing here is stored — a timeline row that quoted a stored number
 * would be the Gap-as-column defect one level up.
 */
export function sessionSummaryOf(rel: V1Relationship, session: V1Session): SessionSummary {
  const aspects: AspectGaps[] = [];
  for (const item of rel.items) {
    const initiator = session.initiatorAnswers[item.id];
    const counterparty = session.counterpartyAnswers[item.id];
    if (initiator === undefined || counterparty === undefined) continue;
    aspects.push({ itemId: item.id, gaps: gapKindsOf(initiator, counterparty) });
  }
  const verdict = instanceAlignment(aspects, rel.setting);
  let widest: number | null = null;
  let sum = 0;
  let count = 0;
  for (const aspect of aspects) {
    for (const kind of gapKindsIn(aspect.gaps)) {
      const gap = aspect.gaps[kind];
      if (gap === undefined) continue;
      if (widest === null || gap > widest) widest = gap;
      sum += gap;
      count += 1;
    }
  }
  return {
    completedAt: session.completedAt,
    verdict,
    aligned: verdict.aligned,
    unmetCount: verdict.unmet.length,
    widestGap: widest,
    meanGap: count === 0 ? null : sum / count,
  };
}

/**
 * The one trend sentence, computed from the completed sessions' mean Gaps — never a stored
 * percent, never a `+23% better`. `pending` is the honest state for a relationship with one
 * session (there is nothing to compare against yet); `closed` / `widened` / `held` compare
 * the oldest session's mean Gap with the newest's. The `points` array (oldest → newest mean
 * Gap) is what the sparkline plots, so the line and the sentence cannot disagree.
 */
export type GapTrendKind = "none" | "pending" | "closed" | "widened" | "held";

export interface GapTrend {
  readonly kind: GapTrendKind;
  readonly sentence: string | null;
  readonly points: readonly number[];
}

const fmtGap = (value: number): string => value.toFixed(1);

export function trendOf(summaries: readonly SessionSummary[]): GapTrend {
  const ordered = [...summaries].sort((a, b) => a.completedAt.localeCompare(b.completedAt));
  const means = ordered.map((summary) => summary.meanGap);
  if (means.some((mean) => mean === null)) {
    return { kind: "none", sentence: null, points: [] };
  }
  const points = means as number[];
  if (points.length === 0) return { kind: "none", sentence: null, points };
  if (points.length === 1) {
    return { kind: "pending", sentence: "First comparison available after this session.", points };
  }
  const first = points[0];
  const last = points[points.length - 1];
  const count = points.length;
  if (last < first) {
    return {
      kind: "closed",
      sentence: `Gap closed from ${fmtGap(first)} to ${fmtGap(last)} across ${count} sessions.`,
      points,
    };
  }
  if (last > first) {
    return {
      kind: "widened",
      sentence: `Gap widened from ${fmtGap(first)} to ${fmtGap(last)} across ${count} sessions.`,
      points,
    };
  }
  return {
    kind: "held",
    sentence: `Gap held at ${fmtGap(first)} across ${count} sessions.`,
    points,
  };
}
