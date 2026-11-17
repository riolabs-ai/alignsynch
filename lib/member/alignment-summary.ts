/**
 * One relationship's alignment, as a member's own screens read it (#1129).
 *
 * **The Gap is a function, and this is the second caller.** `content/gaps.ts` owns the
 * arithmetic (`gapKindsOf`), the Setting's tolerance (`gapMeetsSetting`) and the verdict word
 * (`alignmentStatusOf`); this module adds nothing to any of the three. It answers the two
 * questions a card asks — *how many Aspects are Aligned* and *what is the Next Step* — over the
 * per-Aspect Gaps the model already produced, so the Start page's headline and the list's summary
 * bar cannot disagree with the report screen about the same numbers.
 *
 * **The Next Step is the widest Gap, and the tie-break is the owner's (§9).** In order:
 *
 *   1. the widest Gap — the largest number of steps between the two answers;
 *   2. **Wish beats Feel** — where two kinds are equally wide, the one about what each person
 *      *wants* is the conversation to have, not the one about how they feel today;
 *   3. **Aspect order** — the authored order of the Aspects, so the same data always names the
 *      same step and a re-render never shuffles the dashboard's first row.
 *
 * Only a Gap the Setting does not tolerate is a candidate: under Soft a one-step Small Gap is
 * aligned, and telling somebody to go and talk about it would be the dashboard contradicting the
 * Align screen they just read.
 *
 * **An Aspect's word is its worst Gap.** `StatusMiniBar` draws one mark per Aspect, and an Aspect
 * with one Gap and three In Synch is a Gap Aspect — averaging, or taking the first kind in
 * glossary order, would print a calmer word than the numbers support.
 *
 * Pure: no `pg`, no React, no clock — `content/` only, so a node test drives every edge without a
 * database (`tests/alignment-summary.test.ts`).
 */
import type { AlignmentSetting, Opinions } from "@/content/assessment";
import {
  type AlignmentStatus,
  GAP_KINDS,
  type GapKinds,
  gapKindsIn,
  gapKindsOf,
  gapMeetsSetting,
  alignmentStatusOf,
} from "@/content/gaps";

/** Both parties' answers to one Aspect, as the database layer hands them over. */
export interface AspectAnswers {
  readonly itemId: string;
  /** The Aspect's authored order — the third tie-break, and the bar's own order. */
  readonly position: number;
  readonly prompt: string;
  readonly initiator: Opinions;
  readonly counterparty: Opinions;
}

/** One Aspect's Gaps and the one word its mark carries. */
export interface AspectAlignment {
  readonly itemId: string;
  readonly position: number;
  readonly prompt: string;
  readonly gaps: GapKinds;
  readonly status: AlignmentStatus;
}

/** How many Aspects sit in each of the three marks the bar draws. */
export interface AlignmentTally {
  readonly inSynch: number;
  readonly smallGap: number;
  readonly gap: number;
}

/** The one conversation to have next: the widest Gap, and the Aspect it sits on. */
export interface NextStep {
  readonly itemId: string;
  readonly prompt: string;
  readonly kind: string;
  readonly gap: number;
}

/** One relationship, summarised for a card. */
export interface AlignmentSummary {
  readonly aspects: readonly AspectAlignment[];
  readonly tally: AlignmentTally;
  /** Aspects whose every Gap meets the Setting — the "N of M Aspects Aligned" figure. */
  readonly aligned: number;
  readonly total: number;
  /** `null` when nothing is left to talk about, which is a finished Align, not an error. */
  readonly nextStep: NextStep | null;
}

/** The severity order the marks are read against: a Gap outranks a Small Gap. */
const STATUS_RANK: Record<AlignmentStatus, 0 | 1 | 2> = {
  "in-synch": 0,
  "small-gap-ok": 1,
  "small-gap-tight": 1,
  gap: 2,
};

/** Wish before Feel on a tie, everything else after them (§9's second clause). */
function kindPriority(kind: string): number {
  if (kind === "wish") return 2;
  if (kind === "feel") return 1;
  return 0;
}

/** An Aspect's word: its worst Gap, and In Synch when it has none that counts. */
function worstStatusOf(gaps: GapKinds, setting: AlignmentSetting): AlignmentStatus {
  let worst: AlignmentStatus = "in-synch";
  for (const kind of gapKindsIn(gaps)) {
    const gap = gaps[kind];
    if (gap === undefined) continue;
    const status = alignmentStatusOf(gap, setting);
    if (STATUS_RANK[status] > STATUS_RANK[worst]) worst = status;
  }
  return worst;
}

/**
 * The summary of one relationship's answers under the Setting its own row carries.
 *
 * The Setting is an argument rather than a stored verdict for the reason #1122 settled: the
 * tolerance is a lens, and the same answers under Full are a longer list of unmet Gaps. Nothing
 * here writes the verdict back.
 */
export function alignmentSummaryOf(
  setting: AlignmentSetting,
  answers: readonly AspectAnswers[],
): AlignmentSummary {
  const aspects: AspectAlignment[] = answers.map((aspect) => {
    const gaps = gapKindsOf(aspect.initiator, aspect.counterparty);
    return {
      itemId: aspect.itemId,
      position: aspect.position,
      prompt: aspect.prompt,
      gaps,
      status: worstStatusOf(gaps, setting),
    };
  });

  const tally: AlignmentTally = {
    inSynch: aspects.filter((aspect) => STATUS_RANK[aspect.status] === 0).length,
    smallGap: aspects.filter((aspect) => STATUS_RANK[aspect.status] === 1).length,
    gap: aspects.filter((aspect) => STATUS_RANK[aspect.status] === 2).length,
  };

  /*
   * The candidates, in one pass: every Gap the Setting does not tolerate, keyed with the three
   * tie-breaks so the sort reads as the rule it is. `GAP_KINDS.indexOf` is the last one — two
   * equal-width Feel Gaps on two Aspects at the same position cannot happen (positions are
   * distinct), but a stable last key is cheaper than relying on that.
   */
  const candidates = aspects.flatMap((aspect) =>
    gapKindsIn(aspect.gaps).flatMap((kind) => {
      const gap = aspect.gaps[kind];
      if (gap === undefined || gapMeetsSetting(gap, setting)) return [];
      return [
        {
          itemId: aspect.itemId,
          prompt: aspect.prompt,
          kind: String(kind),
          gap,
          priority: kindPriority(kind),
          position: aspect.position,
          glossary: GAP_KINDS.indexOf(kind),
        },
      ];
    }),
  );

  candidates.sort(
    (left, right) =>
      right.gap - left.gap ||
      right.priority - left.priority ||
      left.position - right.position ||
      left.glossary - right.glossary,
  );

  const winner = candidates[0];
  return {
    aspects,
    tally,
    aligned: tally.inSynch,
    total: aspects.length,
    nextStep:
      winner === undefined
        ? null
        : { itemId: winner.itemId, prompt: winner.prompt, kind: winner.kind, gap: winner.gap },
  };
}
