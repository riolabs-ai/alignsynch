/**
 * The Steps for Improving the Relationship — one Step per Aspect per non-zero Gap kind.
 *
 * The report says where two people stand apart; a **Step** is the sentence that turns one of
 * those distances into something a party can act on and tick off. The owner's mockup names the
 * panel "Steps for Improving the Relationship" and it is the last term in that mockup with no
 * primitive in this repo — so it is a primitive here, in `content/`, beside `gaps.ts` and
 * `stages.ts`, and not a sentence a component composes.
 *
 * ## The rule, stated once
 *
 * **One Step per Aspect per non-zero Gap kind.** For every Aspect an instance holds, each Gap
 * kind that is *present and greater than 0* produces exactly one Step, and a kind whose Gap is
 * 0 (In Synch) produces none — there is no distance to name, and a Step saying "already aligned"
 * would be an action item for work nobody has to do. A kind that is **absent** (a Basic
 * instance's four prediction kinds, or an Aspect either party left unanswered) likewise produces
 * none: `abs(score, nothing)` is not a number, exactly as `content/gaps.ts` says.
 *
 * Deriving is **additive and pure**. It reads the same `gapKindsOf` call the report reads and it
 * writes nothing: no verdict, no Gap value, no per-Aspect row is produced, changed or cached by
 * this module. A caller that derives Steps and then renders the report sees the identical numbers
 * it saw before — `scripts/__tests__/steps.test.ts` asserts exactly that, kind by kind.
 *
 * ## Stored, not recomputed
 *
 * A Step is derived once — when a session completes, i.e. when both parties have accepted and the
 * blind rule lifts — and then **stored on the relationship**. That is the difference between a
 * report and a plan: the report is a function of the current answers and must re-derive on every
 * read, but a Step carries a party's progress (`open` / `done`) and the words that were agreed at
 * the time. Recomputing it from a later session would silently rewrite what two people agreed to
 * do, and would erase the ticks. So the store keeps the rows it derived, and a later completion
 * only *adds* the Steps for kinds it does not already hold (`stepsToAdd`).
 *
 * ## Why this file is pure — and what the real app still owes
 *
 * This module imports the two model files and nothing else: no React, no Next, no `lib/db/**`.
 * That is what lets `pnpm data:check` compile it under `tsconfig.datacheck.json` and run its
 * tests under plain Node with `DATABASE_URL` unset, exactly as `content/gaps.ts` does.
 *
 * **Persisting a Step for real needs a `step` table and a migration, and that migration is
 * deliberately NOT in this batch.** In the v1 prototype the rows live in the in-browser store
 * (`lib/v1/store.tsx`, under `alignsynch.v1.relationships.v1`), keyed on the relationship the
 * same way `aspectComments` is. The real schema would be `step(id, relationship_id, aspect_id,
 * derived_from gap_kind[], text, status, created_at)` — and the same rule that forbids a `gap`
 * column applies to it: `derived_from` records which kinds produced the Step, never their
 * values, because a stored Gap could only drift from the two Opinions it was subtracted from.
 */
import { z } from "zod";
import type { Aspect, Opinions } from "./assessment";
import { GAP_KIND_LABELS, gapKindsIn, gapKindsOf, zGapKind, type GapKind } from "./gaps";

/* ------------------------------------------------------------------ *
 * The shape
 * ------------------------------------------------------------------ */

/** A Step is either something still to do, or something the parties have done. */
export const zStepStatus = z.enum(["open", "done"]);

export type StepStatus = z.infer<typeof zStepStatus>;

export const STEP_STATUSES = zStepStatus.options;

/** The two state words, authored once so a panel and a count cannot spell them differently. */
export const STEP_STATUS_LABELS: Record<StepStatus, string> = {
  open: "Open",
  done: "Done",
};

/**
 * One Step for improving a relationship.
 *
 * `.strict()`, like every other record in the model: an unknown key is a hard error rather than a
 * silently dropped field. `derivedFrom` is an array because the shape outlives this rule — today
 * the derivation emits exactly one kind per Step, and a future compound Step can carry the two
 * kinds it was built from without a schema change.
 */
export const zStep = z
  .object({
    /** Stable per (relationship, Aspect, kind) — see `stepIdOf`, which is the only generator. */
    id: z.string().min(1),
    /** The relationship the Step is stored on. Steps are a party-facing record, not a template's. */
    relationshipId: z.string().min(1),
    /** The Aspect the Step improves. It is the report row's own join key. */
    aspectId: z.string().min(1),
    /** The Gap kind(s) that produced it — always at least one, never the Gap's value. */
    derivedFrom: z.array(zGapKind).min(1),
    /** What to do, in words, derived from the Aspect and the kind. */
    text: z.string().min(1),
    status: zStepStatus,
    /** When the Step was derived — an ISO instant, the tree's one date convention. */
    createdAt: z.string().min(1),
  })
  .strict();

export type Step = z.infer<typeof zStep>;

/* ------------------------------------------------------------------ *
 * The words — one sentence per kind, authored once
 * ------------------------------------------------------------------ */

/**
 * What a party can actually do about one kind of distance.
 *
 * The sentence names the *conversation*, never a score and never advice the product cannot stand
 * behind: a Gap is a difference between two answers, so the only honest action is to put those
 * two answers beside each other and agree words for them. Nothing here diagnoses, prescribes or
 * promises an outcome, and nothing is written per relationship — the same kind reads the same way
 * on every template.
 */
export const STEP_INSTRUCTIONS: Record<GapKind, string> = {
  feel: "Compare how this feels to each of you, and say what the difference is about.",
  wish: "Say what each of you wants instead, in your own words, and agree which part you both want.",
  initiator: "Name what would have to change for the initiator's own wish to be reachable.",
  counterparty: "Name what would have to change for the counterparty's own wish to be reachable.",
  "initiator-think":
    "Check the initiator's reading of how the counterparty feels against what the counterparty actually said.",
  "initiator-guess":
    "Check the initiator's guess at what the counterparty wants against what the counterparty actually asked for.",
  "counterparty-think":
    "Check the counterparty's reading of how the initiator feels against what the initiator actually said.",
  "counterparty-guess":
    "Check the counterparty's guess at what the initiator wants against what the initiator actually asked for.",
};

/* ------------------------------------------------------------------ *
 * Ids
 * ------------------------------------------------------------------ */

/**
 * The Step's id: a function of the three facts that make it unique, so the same Aspect and kind on
 * the same relationship can never be stored twice — a second session's derivation produces the
 * same id and `stepsToAdd` leaves the existing row (and its `done` state) alone.
 *
 * Deterministic on purpose: a fixture can derive its Steps at import and a component cannot
 * invent an id that disagrees with the row it meant to read.
 */
export function stepIdOf(relationshipId: string, aspectId: string, kind: GapKind): string {
  return `step-${relationshipId}-${aspectId}-${kind}`;
}

/* ------------------------------------------------------------------ *
 * The derivation
 * ------------------------------------------------------------------ */

/** What one derivation needs: the Aspects, both parties' answers, and the instant to date it. */
export interface StepDerivationInput {
  readonly relationshipId: string;
  readonly items: readonly Aspect[];
  /** The initiator's answers, keyed by Aspect id — an unanswered Aspect is simply absent. */
  readonly initiatorAnswers: Readonly<Record<string, Opinions>>;
  /** The counterparty's answers, keyed the same way. */
  readonly counterpartyAnswers: Readonly<Record<string, Opinions>>;
  /** The instant the Steps were derived (the session's completion). An ISO string, never a clock. */
  readonly createdAt: string;
}

/** The words one Step carries: the Aspect's own question, the kind, the distance, and the action. */
function stepTextOf(item: Aspect, kind: GapKind, gap: number): string {
  return `${item.prompt} — ${GAP_KIND_LABELS[kind]} of ${gap}. ${STEP_INSTRUCTIONS[kind]}`;
}

/**
 * Every Step one completed session produces, in the Aspects' own order and `GAP_KINDS` order
 * within an Aspect — the order the report draws, so a panel and a report never disagree.
 *
 * A zero Gap and an absent kind both produce nothing (the module header's rule); every step this
 * returns carries one kind in `derivedFrom`.
 */
export function deriveSteps(input: StepDerivationInput): Step[] {
  const steps: Step[] = [];
  for (const item of input.items) {
    const initiator = input.initiatorAnswers[item.id];
    const counterparty = input.counterpartyAnswers[item.id];
    // An Aspect either party has not answered has no Gaps at all — not four zeroes.
    if (initiator === undefined || counterparty === undefined) continue;
    const gaps = gapKindsOf(initiator, counterparty);
    for (const kind of gapKindsIn(gaps)) {
      const gap = gaps[kind];
      if (gap === undefined || gap === 0) continue;
      steps.push({
        id: stepIdOf(input.relationshipId, item.id, kind),
        relationshipId: input.relationshipId,
        aspectId: item.id,
        derivedFrom: [kind],
        text: stepTextOf(item, kind, gap),
        status: "open",
        createdAt: input.createdAt,
      });
    }
  }
  return steps;
}

/**
 * The Steps a later session adds: those it derives that the relationship does not already hold.
 *
 * A Step that exists is **never rewritten** — its words were agreed at the time and its `status`
 * is a party's progress. A kind that has since closed to 0 simply produces no new Step; the old
 * one stays, because what two people agreed to do does not stop having been agreed.
 */
export function stepsToAdd(existing: readonly Step[], derived: readonly Step[]): Step[] {
  const held = new Set(existing.map((step) => step.id));
  return derived.filter((step) => !held.has(step.id));
}

/* ------------------------------------------------------------------ *
 * Marking progress
 * ------------------------------------------------------------------ */

/** The Step with `stepId` moved to `status`, or the same array when the id is not there. */
export function withStepStatus(
  steps: readonly Step[],
  stepId: string,
  status: StepStatus,
): readonly Step[] {
  if (!steps.some((step) => step.id === stepId && step.status !== status)) return steps;
  return steps.map((step) => (step.id === stepId ? { ...step, status } : step));
}

/** How many Steps a relationship holds and how many parties have ticked — a count, never a score. */
export interface StepProgress {
  readonly total: number;
  readonly done: number;
}

export function stepProgressOf(steps: readonly Step[]): StepProgress {
  return { total: steps.length, done: steps.filter((step) => step.status === "done").length };
}

/** One Aspect's Steps, in stored order — the report groups by Aspect, never by kind. */
export function stepsForAspect(steps: readonly Step[], aspectId: string): Step[] {
  return steps.filter((step) => step.aspectId === aspectId);
}
