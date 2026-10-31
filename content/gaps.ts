/**
 * The eight Gaps — the glossary's gap types, one `gapOf` call each (#219).
 *
 * `content/record.ts` defines the Gap itself: one subtraction, `gapOf(left, right)`,
 * a whole number 0..4, 0 being In Synch. What the glossary adds is the **pair**, and it
 * names eight of them — not one. Four compare like with like: two parties' answers of
 * the same kind, or one party's Feel against their own Wish. The other four compare a
 * **prediction** against an **actual**: what one party *thought* the other felt, or
 * *guessed* the other wished, measured against what the other party actually answered.
 *
 *   kind                glossary definition                                    pair
 *   feel                Parties Feel Different                                 I.feel vs C.feel
 *   wish                Parties' Wishes Differ                                 I.wish vs C.wish
 *   initiator           Initiator Feels & Initiator Wishes Differ              I.feel vs I.wish
 *   counterparty        Counterparty Feels & Counterparty Wishes Differ        C.feel vs C.wish
 *   initiator-think     Initiator Thought Counterparty Felt Different          I.think vs C.feel
 *   initiator-guess     Initiator Guessed Counterparty Wished Different        I.guess vs C.wish
 *   counterparty-think  Counterparty Thought Initiator Felt Different          C.think vs I.feel
 *   counterparty-guess  Counterparty Guessed Initiator Wished Different        C.guess vs I.wish
 *
 * (`I` is the Initiator, `C` the Counterparty.) The subtraction is symmetric, the *pair*
 * is not: a Think Gap is never `I.think` against `C.think`. That difference — `|I.think −
 * C.think|` — is not a quantity the glossary defines anywhere, and computing it would
 * describe two people's guesses about each other as if it were one person's accuracy.
 *
 * The glossary's other Gap rows are groupings of these eight ("Feelings and Wishes
 * Differ", "Desires To Change", "Prediction Gaps & Analysis"), never additional kinds.
 * Surprise and Doubt are the same four prediction kinds read at different times ("upon
 * first showing" vs "after and beyond"); they need an opinion history and are not
 * modelled here. The Soft/Full setting and the Gap Flag colours are display settings
 * over these numbers, not arithmetic.
 *
 * The four Advanced kinds exist only where the prediction does: Basic Mode asks Feel and
 * Wish, so an Aspect of a Basic instance has four Gaps and no prediction to measure.
 * A kind whose two Opinions are not both present is **absent**, never 0 — `abs(score,
 * nothing)` is not a number, and a 0 there would print the glossary's In Synch about a
 * question nobody asked.
 *
 * Pure, and deliberately narrow: this module imports the two model files and nothing else
 * — no React, no Next, no `lib/db/**` — so `pnpm data:check` compiles and runs it under
 * plain Node with `DATABASE_URL` unset. A Gap is a function here and never a column:
 * `db:migrate` and `db:verify` both fail on a `public` column named like one.
 */
import { z } from "zod";
import type { OpinionKind, Opinions, PartyRole } from "./assessment";
import { gapOf, type Gap, type Score } from "./record";

/* ------------------------------------------------------------------ *
 * The vocabulary — eight kinds, four of them Basic
 * ------------------------------------------------------------------ */

/**
 * The eight gap kinds, in the glossary's order: the four Basic kinds, then the four the
 * Advanced pair adds, one Think and one Guess per party (the issue's own table order).
 */
export const zGapKind = z.enum([
  "feel",
  "wish",
  "initiator",
  "counterparty",
  "initiator-think",
  "initiator-guess",
  "counterparty-think",
  "counterparty-guess",
]);

export type GapKind = z.infer<typeof zGapKind>;

export const GAP_KINDS = zGapKind.options;

/**
 * The four kinds an instance has whatever its mode: the cross-party Feel and Wish gaps,
 * and each party's own Feel-against-Wish gap. Basic Mode is the floor — every instance
 * that was ever played answered Feel and Wish on every Aspect.
 */
export const BASIC_GAP_KINDS = [
  "feel",
  "wish",
  "initiator",
  "counterparty",
] as const satisfies readonly GapKind[];

/**
 * The four kinds only an Advanced instance has: no Think/Guess pair, no prediction to
 * measure. They are the glossary's "present surprise or doubt" and "future desire
 * surprise or doubt", read as the two parties' predictions of each other.
 */
export const ADVANCED_GAP_KINDS = [
  "initiator-think",
  "initiator-guess",
  "counterparty-think",
  "counterparty-guess",
] as const satisfies readonly GapKind[];

/** The glossary's own names for the kinds, authored once in the model. */
export const GAP_KIND_LABELS: Record<GapKind, string> = {
  feel: "Feel Gap",
  wish: "Wish Gap",
  initiator: "Initiator Gap",
  counterparty: "Counterparty Gap",
  "initiator-think": "Initiator Think Gap",
  "initiator-guess": "Initiator Guess Gap",
  "counterparty-think": "Counterparty Think Gap",
  "counterparty-guess": "Counterparty Guess Gap",
};

/* ------------------------------------------------------------------ *
 * The pairs — one table, so the arithmetic and the screen cannot disagree
 * ------------------------------------------------------------------ */

/** One Opinion, named by the party who gave it and the kind of answer it is. */
export interface GapSourceSide {
  readonly party: PartyRole;
  readonly opinion: OpinionKind;
}

/** One gap kind and the two Opinions it subtracts, in `gapOf(left, right)` order. */
export interface GapSource {
  readonly kind: GapKind;
  readonly left: GapSourceSide;
  readonly right: GapSourceSide;
}

/**
 * The eight pairs, in `GAP_KINDS` order.
 *
 * The table is the single statement of which Opinions each kind compares: `gapKindsOf`
 * reads its arithmetic from here, and the report names the two scores on screen from
 * here, so a row can never label one pair and compute another.
 */
export const GAP_KIND_SOURCES: readonly GapSource[] = [
  {
    kind: "feel",
    left: { party: "initiator", opinion: "feel" },
    right: { party: "counterparty", opinion: "feel" },
  },
  {
    kind: "wish",
    left: { party: "initiator", opinion: "wish" },
    right: { party: "counterparty", opinion: "wish" },
  },
  {
    kind: "initiator",
    left: { party: "initiator", opinion: "feel" },
    right: { party: "initiator", opinion: "wish" },
  },
  {
    kind: "counterparty",
    left: { party: "counterparty", opinion: "feel" },
    right: { party: "counterparty", opinion: "wish" },
  },
  {
    kind: "initiator-think",
    left: { party: "initiator", opinion: "think" },
    right: { party: "counterparty", opinion: "feel" },
  },
  {
    kind: "initiator-guess",
    left: { party: "initiator", opinion: "guess" },
    right: { party: "counterparty", opinion: "wish" },
  },
  {
    kind: "counterparty-think",
    left: { party: "counterparty", opinion: "think" },
    right: { party: "initiator", opinion: "feel" },
  },
  {
    kind: "counterparty-guess",
    left: { party: "counterparty", opinion: "guess" },
    right: { party: "initiator", opinion: "wish" },
  },
];

/* ------------------------------------------------------------------ *
 * The computation
 * ------------------------------------------------------------------ */

/**
 * The Gaps of one Aspect, keyed by kind.
 *
 * A kind is **absent** from the record when either Opinion it compares is: Basic Mode's
 * four are always there (Feel and Wish are required on both sides), and the four
 * prediction kinds are there exactly when the predicting party answered Think and Guess.
 */
export type GapKinds = Readonly<Partial<Record<GapKind, Gap>>>;

/**
 * All eight Gaps for one Aspect, from the two parties' Opinions of it.
 *
 * Eight `gapOf` calls over the eight pairs in `GAP_KIND_SOURCES` — the same subtraction
 * eight times, never eight functions. Total: every input combination returns, and the
 * kinds it cannot measure are absent rather than thrown.
 */
export function gapKindsOf(initiator: Opinions, counterparty: Opinions): GapKinds {
  const parties: Record<PartyRole, Opinions> = { initiator, counterparty };
  const gaps: Partial<Record<GapKind, Gap>> = {};
  for (const source of GAP_KIND_SOURCES) {
    const left: Score | undefined = parties[source.left.party][source.left.opinion];
    const right: Score | undefined = parties[source.right.party][source.right.opinion];
    if (left === undefined || right === undefined) continue;
    gaps[source.kind] = gapOf(left, right);
  }
  return gaps;
}

/** The kinds one Aspect actually has, in glossary order — four, or eight in Advanced Mode. */
export function gapKindsIn(gaps: GapKinds): GapKind[] {
  return GAP_KINDS.filter((kind) => gaps[kind] !== undefined);
}
