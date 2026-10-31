/**
 * The Gap across a population — the arithmetic behind `/admin/gaps` (#289 follow-up).
 *
 * This module is the **measure plugin** the console spec names: the surface is generic
 * response analytics ("how did answers land across a population"), and the only AlignSynch
 * part is what it measures — `gapOf`, eight kinds, judged under the instance's Setting. So the
 * measure lives in one pure module and the surface takes it as data, which is what lets the
 * quiz expression reuse the shell with a different plugin.
 *
 * **The population is complete instances, and nothing else.** A partial relationship has no
 * Gap: one party's answers against nobody's is not a difference between two people, and a
 * number computed there would be a number about nothing. The read (`lib/db/gap-rows.ts`)
 * filters in SQL; this module never widens what it was handed, and it carries the excluded
 * count so the screen can say how many rows it left out rather than silently narrowing.
 *
 * **The statistic is the ordinal median and the range, never a mean.**
 *
 *   - A Gap is an **ordinal** value 0..4 — In Synch, then the glossary's small and big Gaps.
 *     The steps are named categories, not a metric: nothing says the distance from 1 to 2 is
 *     the distance from 3 to 4, so summing or dividing them is arithmetic on labels.
 *   - The median is therefore the **first value at which the cumulative count reaches half**
 *     (`medianOf`), which is always one of the five values on the scale. The arithmetic middle
 *     of the two central rows can land on 1.5, a value the model does not contain — printing it
 *     would invent a sixth Gap.
 *   - The range (smallest to widest) is the spread stated in the model's own units. It is what
 *     the mean is reached for, and it does not pretend to a centre.
 *   - A mean of per-instance means is refused twice over: `gapOf` is ordinal, and averaging
 *     averages gives a family with four Aspects the same weight as one with five.
 *
 * **Never across Settings.** Soft tolerates a Gap of 1 and Full does not, so the same eight
 * numbers read differently under the two lenses; a population figure that mixed them would be
 * a number about no honest comparison. Every distribution here is computed inside one Setting.
 *
 * **No composite.** There is no "score", no "health", no ranking: the model has eight Gaps and
 * this module returns eight readings plus an aligned/unmet count per Setting. A total would be
 * a ninth number nobody authored (`docs/specs/ux-report.md` bans it, and `tests/report-groups.ts`
 * enforces the same ban on the report).
 *
 * **Nameless, structurally.** `GapInstanceRow` has an id and no party name, no e-mail and no
 * user id — not because a view promises not to print them, but because they never arrive.
 * Pure: no React, no Next, no `lib/db/**`, so a node test drives every branch.
 */
import { type AlignmentSetting, SETTING_GAP_LIMITS } from "@/content/assessment";
import {
  ADVANCED_GAP_KINDS,
  GAP_KINDS,
  GAP_KIND_LABELS,
  gapKindsIn,
  gapKindsOf,
  instanceAlignment,
  type AspectGaps,
  type GapKind,
} from "@/content/gaps";
import type { Gap, Score } from "@/content/record";

/**
 * How many complete instances a Setting needs before its distribution is shown.
 *
 * Three, and the number is a floor rather than a target. At one instance the "distribution" is
 * that instance's rows; at two, the median is the midpoint of a pair and the range is the pair —
 * both restatements of what a reader could count, dressed as an aggregate. Three is the first
 * count at which a median and a range say something the rows do not. Below it the screen says
 * how many there are and shows no number at all — the `#164` rule that a dashboard of two rows
 * is worse than an honest empty state.
 */
export const MIN_COMPLETE_INSTANCES = 3;

/** One party's four answers about one Aspect — the input to `gapOf`, as read from `opinion`. */
export interface GapOpinions {
  readonly feel: Score;
  readonly wish: Score;
  /** Present only on an Advanced instance; a Basic one answered no prediction. */
  readonly think?: Score;
  readonly guess?: Score;
}

/** One Aspect of one complete instance: the same item, answered by both parties. */
export interface GapAspect {
  readonly itemId: string;
  readonly initiator: GapOpinions;
  readonly counterparty: GapOpinions;
}

/**
 * One complete instance, as this module needs it.
 *
 * `instanceId` exists to count and to key — never to print (the screen is a population view;
 * the per-relationship list is `/admin/instances`). There is deliberately no party field.
 */
export interface GapInstance {
  readonly instanceId: string;
  readonly setting: AlignmentSetting;
  readonly aspects: readonly GapAspect[];
}

/** What the read returned: the complete population, and what it excluded. */
export interface GapPopulation {
  readonly instances: readonly GapInstance[];
  /** Instances that are not complete, and are therefore in no number on the screen. */
  readonly excluded: number;
  /** Every instance row the read saw, complete or not — the denominator of `excluded`. */
  readonly total: number;
}

/**
 * Why a kind has no reading in a Setting.
 *
 *   withheld     the Setting has fewer than `MIN_COMPLETE_INSTANCES`; every kind is withheld,
 *                whether or not it has values — the sentence names the count and the floor
 *   no-advanced  no Advanced instance in this Setting, so no Think/Guess pair was ever asked
 *   no-answer    the pair existed and nobody answered it (a structural gap, not an absence of
 *                question) — kept so the union is total rather than an unhandled default
 */
export type AbsenceReason = "withheld" | "no-advanced" | "no-answer";

/** One kind's reading inside one Setting: the distribution, or the reason there is none. */
export type KindReading =
  | {
      readonly state: "measured";
      /** Instances that contributed at least one Gap of this kind. */
      readonly instances: number;
      /** Gaps measured — instances × Aspects that have both answers. */
      readonly count: number;
      /** The ordinal median: one of 0..4, always on the scale. */
      readonly median: Gap;
      readonly min: Gap;
      readonly max: Gap;
      /** Counts at Gap 0, 1, 2, 3, 4 — index is the Gap. */
      readonly histogram: readonly number[];
    }
  | { readonly state: "unmeasured"; readonly reason: AbsenceReason };

/** One row of the kind table: the glossary's kind, its name, and what the population says. */
export interface KindRow {
  readonly kind: GapKind;
  /** The glossary's own name, from `content/gaps.ts` — never retyped by a component. */
  readonly label: string;
  readonly reading: KindReading;
}

/** One Setting's half of the screen. Both Settings are always present once they have a row. */
export interface SettingReading {
  readonly setting: AlignmentSetting;
  /** The widest Gap this Setting tolerates (`content/assessment.ts::SETTING_GAP_LIMITS`). */
  readonly limit: Gap;
  /** Complete instances completed under this Setting. */
  readonly instances: number;
  /** `instances >= MIN_COMPLETE_INSTANCES` — the one condition `kinds` was measured under. */
  readonly chartable: boolean;
  /** Instances whose every Gap met the Setting. Withheld with the rest below the floor. */
  readonly aligned: number | null;
  /** Instances with at least one Gap wider than `limit`. `aligned + unmet = instances`. */
  readonly unmet: number | null;
  /** Every Gap measured in this Setting, across kinds. */
  readonly gaps: number;
  /** Always eight rows, in the glossary's order — absent kinds are rows, not omissions. */
  readonly kinds: readonly KindRow[];
}

/** The whole screen's numbers. */
export interface GapAggregate {
  /** Complete instances the screen is computed over. */
  readonly complete: number;
  /** Instances left out because they are not complete. */
  readonly excluded: number;
  readonly total: number;
  readonly floor: number;
  /** Soft then Full; a Setting with no complete instance is present with zero and no reading. */
  readonly settings: readonly SettingReading[];
}

/** The four answers one party gave about one Aspect, from its two model fields and its pair. */
function opinionsOf(opinions: GapOpinions): {
  feel: Score;
  wish: Score;
  think?: Score;
  guess?: Score;
} {
  return {
    feel: opinions.feel,
    wish: opinions.wish,
    think: opinions.think,
    guess: opinions.guess,
  };
}

/**
 * The first value at which the cumulative count reaches half — the **ordinal median**.
 *
 * Sorted ascending, that is `values[ceil(n / 2) - 1]`: for `[0, 1, 2, 4]` it is 1 (two of four
 * values are ≤ 1), and it is never the 1.5 an averaging median would produce. Defined on a
 * non-empty array only; the caller has already established that.
 */
export function ordinalMedian(values: readonly Gap[]): Gap {
  if (values.length === 0) throw new Error("ordinalMedian: no values — a median of nothing");
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.ceil(sorted.length / 2) - 1;
  const value = sorted[index];
  if (value === undefined) throw new Error("ordinalMedian: index outside the array");
  return value;
}

/** Counts at each Gap 0..4, so a histogram is one array and the table and chart read alike. */
export function histogramOf(values: readonly Gap[]): number[] {
  const counts = [0, 0, 0, 0, 0];
  for (const value of values) counts[value] += 1;
  return counts;
}

/** The `AspectGaps` `instanceAlignment` reads, derived here so both callers agree. */
function aspectGapsOf(instance: GapInstance): AspectGaps[] {
  return instance.aspects.map((aspect) => ({
    itemId: aspect.itemId,
    gaps: gapKindsOf(opinionsOf(aspect.initiator), opinionsOf(aspect.counterparty)),
  }));
}

/** Does any Aspect of this instance carry a prediction kind? — the Advanced test, from the data. */
function hasAdvancedKind(instance: GapInstance): boolean {
  return aspectGapsOf(instance).some((aspect) =>
    ADVANCED_GAP_KINDS.some((kind) => aspect.gaps[kind] !== undefined),
  );
}

/** One Setting's reading, over the complete instances that were completed under it. */
function readingOf(setting: AlignmentSetting, instances: readonly GapInstance[]): SettingReading {
  const chartable = instances.length >= MIN_COMPLETE_INSTANCES;
  const limit = SETTING_GAP_LIMITS[setting];

  // Every Gap of every kind, grouped by kind. Instances whose Aspects have no answers are
  // impossible here (complete means both parties answered every Aspect) but the loops do not
  // assume it: a kind simply collects nothing and is reported absent.
  const byKind = new Map<GapKind, Gap[]>();
  const instancesByKind = new Map<GapKind, number>();
  for (const instance of instances) {
    const counted = new Set<GapKind>();
    for (const aspect of aspectGapsOf(instance)) {
      for (const kind of gapKindsIn(aspect.gaps)) {
        const gap = aspect.gaps[kind];
        if (gap === undefined) continue;
        const values = byKind.get(kind) ?? [];
        values.push(gap);
        byKind.set(kind, values);
        counted.add(kind);
      }
    }
    for (const kind of counted) instancesByKind.set(kind, (instancesByKind.get(kind) ?? 0) + 1);
  }

  const advanced = instances.some((instance) => hasAdvancedKind(instance));
  const gaps = [...byKind.values()].reduce((sum, values) => sum + values.length, 0);

  const kinds: KindRow[] = GAP_KINDS.map((kind) => {
    const values = byKind.get(kind) ?? [];
    if (!chartable) {
      return {
        kind,
        label: GAP_KIND_LABELS[kind],
        reading: { state: "unmeasured", reason: "withheld" },
      };
    }
    if (values.length === 0) {
      const reason: AbsenceReason =
        (ADVANCED_GAP_KINDS as readonly GapKind[]).includes(kind) && !advanced
          ? "no-advanced"
          : "no-answer";
      return { kind, label: GAP_KIND_LABELS[kind], reading: { state: "unmeasured", reason } };
    }
    const sorted = [...values].sort((left, right) => left - right);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    if (min === undefined || max === undefined) throw new Error("gap reading: empty range");
    return {
      kind,
      label: GAP_KIND_LABELS[kind],
      reading: {
        state: "measured",
        instances: instancesByKind.get(kind) ?? 0,
        count: values.length,
        median: ordinalMedian(values),
        min,
        max,
        histogram: histogramOf(values),
      },
    };
  });

  const verdicts = instances.map((instance) =>
    instanceAlignment(aspectGapsOf(instance), instance.setting),
  );

  return {
    setting,
    limit,
    instances: instances.length,
    chartable,
    aligned: chartable ? verdicts.filter((verdict) => verdict.aligned).length : null,
    unmet: chartable ? verdicts.filter((verdict) => !verdict.aligned).length : null,
    gaps,
    kinds,
  };
}

/**
 * The screen's numbers, from the rows.
 *
 * The Settings are emitted in the model's order (Soft, then Full) and a Setting with no complete
 * instance is still present, with zero instances and eight withheld rows: "nobody has completed
 * one under Full" is a fact this screen exists to state, and dropping the section would hide it.
 */
export function aggregateGapPopulation(population: GapPopulation): GapAggregate {
  const settings: AlignmentSetting[] = ["soft", "full"];
  return {
    complete: population.instances.length,
    excluded: population.excluded,
    total: population.total,
    floor: MIN_COMPLETE_INSTANCES,
    settings: settings.map((setting) =>
      readingOf(
        setting,
        population.instances.filter((instance) => instance.setting === setting),
      ),
    ),
  };
}
