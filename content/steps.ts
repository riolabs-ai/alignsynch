/**
 * The Steps for Improving the Relationship — **one Step per Aspect**, from that Aspect's widest Gap.
 *
 * The report says where two people stand apart; a **Step** is the sentence that turns one of those
 * distances into something a party can act on and tick off. The owner's mockup names the panel
 * "Steps for Improving the Relationship" and it is the last term in that mockup with no primitive
 * in this repo — so it is a primitive here, in `content/`, beside `gaps.ts` and `stages.ts`, and
 * not a sentence a component composes.
 *
 * ## The rule, stated once (three decisions the owner settled on PR #406)
 *
 * **1. One Step per Aspect.** For every Aspect an instance holds, the derivation emits exactly one
 * Step, sourced from the **widest** Gap kind on that Aspect — the distance that matters most there,
 * not every distance at once. A six-Aspect Advanced relationship therefore holds at most six Steps;
 * the earlier rule (one per non-zero kind) emitted up to forty-eight, which read as a task list
 * nobody would ever finish.
 *
 *   - **Ties are resolved by the gap-kind ordering, deliberately.** Two kinds can carry the same
 *     width; the first in `GAP_KINDS` order wins (`widestGapOf`, below, compares with `>` and not
 *     `>=`). That is a stated rule, not an accident of iteration: the same two answers must produce
 *     the same Step on every read, in every browser, before and after a reload.
 *   - A Gap of **0** (In Synch) produces no Step: there is no distance to name, and a Step saying
 *     "already aligned" would be an action item for work nobody has to do.
 *   - A kind that is **absent** (a Basic instance's four prediction kinds, or an Aspect either party
 *     left unanswered) cannot be the widest: `abs(score, nothing)` is not a number, exactly as
 *     `content/gaps.ts` says.
 *
 * **2. The canned sentence is a default, not the text.** `STEP_INSTRUCTIONS` is the suggestion a
 * Step starts from; a Step keeps it in `suggestedText` **and** carries `text`, the words the party
 * is working to. Deriving sets `text` to the suggestion, and from there a party may edit it or add a
 * Step of their own. Keeping both is what makes a Step explainable after the fact — a reader can
 * always see which sentence the product proposed, even once somebody reworded it.
 *
 *   - An **authored** Step (a party wrote it from nothing) has an empty `derivedFrom` and no
 *     `suggestedText`. That is the one case `derivedFrom` may be empty, and `zStep` says so out loud
 *     in its `superRefine` rather than quietly dropping `.min(1)` from the array: a Step derived from
 *     a Gap must name the kind, and must keep the suggestion that explains it.
 *
 * **3. Three states: `open`, `done`, `closed`.** `closed` is not a fourth kind of work — it is
 * history. A stored Step whose source Gap has since fallen to 0 is closed: badged, kept, never
 * deleted, never counted as outstanding. A later derivation must not resurrect it as `open`, because
 * the tick and the words are a record of what was agreed, and a re-derivation is not a new
 * agreement. `stepsToAdd` dedupes by the stable id, so a closed row stays closed by construction;
 * `closeSteps` is the one write that moves a row into `closed`.
 *
 * Deriving is **additive and pure**. It reads the same `gapKindsOf` call the report reads and it
 * writes nothing: no verdict, no Gap value, no per-Aspect row is produced, changed or cached by this
 * module. A caller that derives Steps and then renders the report sees the identical numbers it saw
 * before — `scripts/__tests__/steps.test.ts` asserts exactly that, kind by kind.
 *
 * ## Stored, not recomputed
 *
 * A Step is derived once — when a session completes, i.e. when both parties have accepted and the
 * blind rule lifts — and then **stored on the relationship**. That is the difference between a report
 * and a plan: the report is a function of the current answers and must re-derive on every read, but a
 * Step carries a party's progress and the words that were agreed at the time. Recomputing it from a
 * later session would silently rewrite what two people agreed to do, and would erase the ticks. So
 * the store keeps the rows it derived, a later completion only *adds* Steps for Aspects it does not
 * already hold (`stepsToAdd`), and the only rows it ever rewrites are the ones it closes
 * (`closeSteps`).
 *
 * ## Why this file is pure — and what the real app still owes
 *
 * This module imports the two model files and nothing else: no React, no Next, no `lib/db/**`. That
 * is what lets `pnpm data:check` compile it under `tsconfig.datacheck.json` and run its tests under
 * plain Node with `DATABASE_URL` unset, exactly as `content/gaps.ts` does.
 *
 * **Persisting a Step for real needs a `step` table and a migration, and that migration is
 * deliberately NOT in this batch.** In the v1 prototype the rows live in the in-browser store
 * (`lib/v1/store.tsx`, under `alignsynch.v1.relationships.v1`), keyed on the relationship the same
 * way `aspectComments` is. The real schema would be `step(id, relationship_id, aspect_id,
 * derived_from gap_kind[], suggested_text, text, status, created_at)` — and the same rule that
 * forbids a `gap` column applies to it: `derived_from` records which kinds produced the Step, never
 * their values, because a stored Gap could only drift from the two Opinions it was subtracted from.
 */
import { z } from "zod";
import type { Aspect, Opinions } from "./assessment";
import {
  GAP_KIND_LABELS,
  gapKindsIn,
  gapKindsOf,
  zGapKind,
  type GapKind,
  type GapKinds,
} from "./gaps";

/* ------------------------------------------------------------------ *
 * The shape
 * ------------------------------------------------------------------ */

/**
 * A Step's state. `closed` is history, not work: its Gap has fallen to 0 since the Step was agreed,
 * so nothing is outstanding and nothing is deleted.
 */
export const zStepStatus = z.enum(["open", "done", "closed"]);

export type StepStatus = z.infer<typeof zStepStatus>;

export const STEP_STATUSES = zStepStatus.options;

/** The three state words, authored once so a panel and a count cannot spell them differently. */
export const STEP_STATUS_LABELS: Record<StepStatus, string> = {
  open: "Open",
  done: "Done",
  closed: "Closed",
};

/**
 * How a Step that came from no Gap names its provenance.
 *
 * A derived Step prints the Gap kind it was built from; an authored one has no kind to print, and
 * "Your own Step" is the honest label rather than an empty space where a provenance should be.
 */
export const AUTHORED_STEP_LABEL = "Your own Step";

/**
 * One Step for improving a relationship.
 *
 * `.strict()`, like every other record in the model: an unknown key is a hard error rather than a
 * silently dropped field.
 *
 * The `superRefine` is the explicit statement of two invariants that a plain object schema cannot
 * express, and it is deliberately narrow:
 *
 *   - `derivedFrom` may be empty **only** for a Step a party authored — there is no Gap behind it, so
 *     there is no kind to name. A Step the derivation produced always names at least one kind.
 *   - a Step that names a kind keeps its `suggestedText`: the sentence the product proposed is part
 *     of what makes the Step explainable after the fact, so dropping it is a defect rather than a
 *     stylistic omission.
 */
export const zStep = z
  .object({
    /** Stable per (relationship, Aspect) — see `stepIdOf`, which is the only generator. */
    id: z.string().min(1),
    /** The relationship the Step is stored on. Steps are a party-facing record, not a template's. */
    relationshipId: z.string().min(1),
    /** The Aspect the Step improves. It is the report row's own join key, and one Step per Aspect. */
    aspectId: z.string().min(1),
    /**
     * The Gap kind(s) that produced it — never the Gap's value. Empty **only** on an authored Step,
     * which came from no Gap at all.
     */
    derivedFrom: z.array(zGapKind),
    /** The sentence the product proposed (and `text` started as). Absent on an authored Step. */
    suggestedText: z.string().min(1).optional(),
    /** What the parties are working to, in their own words — the suggestion until somebody edits it. */
    text: z.string().min(1),
    status: zStepStatus,
    /** When the Step was derived or authored — an ISO instant, the tree's one date convention. */
    createdAt: z.string().min(1),
  })
  .strict()
  .superRefine((step, ctx) => {
    // The biconditional, stated in one place: a Step names a Gap kind **if and only if** it keeps
    // the suggestion that explains it. A derived Step without a kind is a row nobody can explain,
    // and an authored Step with one claims a provenance it does not have.
    if (step.derivedFrom.length > 0 && step.suggestedText === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["suggestedText"],
        message:
          "A Step derived from a Gap keeps the suggestion that explains it (suggestedText); only an authored Step, with an empty derivedFrom, may omit it.",
      });
    }
    if (step.derivedFrom.length === 0 && step.suggestedText !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["suggestedText"],
        message:
          "An authored Step came from no Gap and has no suggestion: an empty derivedFrom and a suggestedText cannot both be true.",
      });
    }
  });

export type Step = z.infer<typeof zStep>;

/* ------------------------------------------------------------------ *
 * The words — one sentence per kind, authored once
 * ------------------------------------------------------------------ */

/**
 * What a party can actually do about one kind of distance — the **default** a derived Step starts
 * from, kept in `suggestedText` once the party rewords it.
 *
 * The sentence names the *conversation*, never a score and never advice the product cannot stand
 * behind: a Gap is a difference between two answers, so the only honest action is to put those two
 * answers beside each other and agree words for them. Nothing here diagnoses, prescribes or promises
 * an outcome, and nothing is written per relationship — the same kind reads the same way on every
 * template.
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
 * The derived Step's id: a function of the relationship and the Aspect, because there is **exactly
 * one** derived Step per Aspect.
 *
 * The kind is deliberately not part of the id. When the widest kind moves — a later session answers
 * the prediction kinds, say — the Step for that Aspect must not become a second row: the first one
 * is what was agreed, and a plan that grows a row every time its widest Gap changes is a plan nobody
 * can finish.
 *
 * Deterministic on purpose: a fixture can derive its Steps at import and a component cannot invent
 * an id that disagrees with the row it meant to read.
 */
export function stepIdOf(relationshipId: string, aspectId: string): string {
  return `step-${relationshipId}-${aspectId}`;
}

/**
 * The id for a Step a party authored on an Aspect — numbered past the ones already there, so two
 * Steps on the same Aspect never collide and a reload reads both back.
 */
export function authoredStepIdOf(
  relationshipId: string,
  aspectId: string,
  existing: readonly Step[],
): string {
  const prefix = `${stepIdOf(relationshipId, aspectId)}-own-`;
  const taken = new Set(existing.map((step) => step.id));
  let index = 1;
  while (taken.has(`${prefix}${index}`)) index += 1;
  return `${prefix}${index}`;
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

/** The suggestion one Step carries: the Aspect's own question, the kind, the distance, the action. */
function stepSuggestionOf(item: Aspect, kind: GapKind, gap: number): string {
  return `${item.prompt} — ${GAP_KIND_LABELS[kind]} of ${gap}. ${STEP_INSTRUCTIONS[kind]}`;
}

/**
 * The widest Gap on one Aspect, and the kind it belongs to — `null` when every Gap is 0 or absent.
 *
 * **The tie rule lives here.** `gapKindsIn` walks the kinds in `GAP_KINDS` order, and the comparison
 * is strict (`>`), so when two kinds are equally wide the earlier one wins. That is deliberate: the
 * same two answer sets must produce the same Step on every read, so the choice cannot depend on
 * object key order, a sort, or the order a party happened to answer in.
 */
export function widestGapOf(gaps: GapKinds): { kind: GapKind; gap: number } | null {
  let widest: { kind: GapKind; gap: number } | null = null;
  for (const kind of gapKindsIn(gaps)) {
    const gap = gaps[kind];
    if (gap === undefined || gap === 0) continue;
    if (widest === null || gap > widest.gap) widest = { kind, gap };
  }
  return widest;
}

/**
 * Every Step one completed session produces: **one per Aspect, in the Aspects' own order**, sourced
 * from that Aspect's widest Gap kind (`widestGapOf`).
 *
 * A zero Gap and an absent kind both produce nothing (the module header's rules). Each Step carries
 * the suggestion in `suggestedText` and starts with `text` equal to it, so a party can reword the
 * Step without losing what the product proposed.
 */
export function deriveSteps(input: StepDerivationInput): Step[] {
  const steps: Step[] = [];
  for (const item of input.items) {
    const initiator = input.initiatorAnswers[item.id];
    const counterparty = input.counterpartyAnswers[item.id];
    // An Aspect either party has not answered has no Gaps at all — not four zeroes.
    if (initiator === undefined || counterparty === undefined) continue;
    const widest = widestGapOf(gapKindsOf(initiator, counterparty));
    if (widest === null) continue;
    const suggestion = stepSuggestionOf(item, widest.kind, widest.gap);
    steps.push({
      id: stepIdOf(input.relationshipId, item.id),
      relationshipId: input.relationshipId,
      aspectId: item.id,
      derivedFrom: [widest.kind],
      suggestedText: suggestion,
      // The default *is* the text until a party edits it — the canned sentence is a placeholder with
      // a value, not an empty field behind a hint.
      text: suggestion,
      status: "open",
      createdAt: input.createdAt,
    });
  }
  return steps;
}

/**
 * A Step a party wrote from nothing, on one Aspect.
 *
 * It names no kind and carries no suggestion, which is exactly what the card's second decision
 * allows: "add your own Step" is a real action, and a Step that came from no Gap has nothing to
 * derive from. It is `open` — an authored Step is a thing to do, not a tick already earned.
 */
export function authoredStepOf(args: {
  readonly relationshipId: string;
  readonly aspectId: string;
  readonly text: string;
  readonly existing: readonly Step[];
  readonly createdAt: string;
}): Step {
  return {
    id: authoredStepIdOf(args.relationshipId, args.aspectId, args.existing),
    relationshipId: args.relationshipId,
    aspectId: args.aspectId,
    derivedFrom: [],
    text: args.text.trim(),
    status: "open",
    createdAt: args.createdAt,
  };
}

/* ------------------------------------------------------------------ *
 * The merge — add what is new, close what the Gap has closed
 * ------------------------------------------------------------------ */

/**
 * The Steps a later session adds: those it derives that the relationship does not already hold.
 *
 * A Step that exists is **never rewritten** here — its words were agreed at the time and its status
 * is a party's progress or its history. Because the derived id is per Aspect, a Step that was closed
 * (or ticked, or reworded) is found by this dedupe and left exactly as it is: derivation cannot
 * resurrect a closed Step as open.
 */
export function stepsToAdd(existing: readonly Step[], derived: readonly Step[]): Step[] {
  const held = new Set(existing.map((step) => step.id));
  return derived.filter((step) => !held.has(step.id));
}

/**
 * The stored Steps whose source Gap has since fallen to 0, moved to `closed` — history, kept, never
 * deleted and never blocking.
 *
 * Three things are deliberately *not* closed here:
 *
 *   - a Step that is not `open` — a `done` Step keeps its tick, because it records work that was
 *     finished, and closing it would turn "1 of 2 done" into "0 of 1 done" for a party who did the
 *     work; an already `closed` Step has nothing left to do;
 *   - an **authored** Step (it never had a source Gap, so no Gap falling to 0 can close it);
 *   - a Step on an Aspect that is no longer part of the instance (soft-deleted), or that nobody
 *     answered this session: its Gap is absent rather than 0, and a removed question must not read
 *     as "done with it".
 *
 * Returns the **same array** when nothing closed, so a completion that closes nothing is not a write.
 */
export function closeSteps(existing: readonly Step[], input: StepDerivationInput): readonly Step[] {
  const held = new Set(input.items.map((item) => item.id));
  let changed = false;
  const next = existing.map((step) => {
    if (step.status !== "open" || step.derivedFrom.length === 0) return step;
    if (!held.has(step.aspectId)) return step;
    const initiator = input.initiatorAnswers[step.aspectId];
    const counterparty = input.counterpartyAnswers[step.aspectId];
    const gaps =
      initiator === undefined || counterparty === undefined
        ? undefined
        : gapKindsOf(initiator, counterparty);
    const live = step.derivedFrom.some((kind) => {
      const gap = gaps?.[kind];
      return gap !== undefined && gap > 0;
    });
    if (live) return step;
    changed = true;
    return { ...step, status: "closed" as const };
  });
  return changed ? next : existing;
}

/* ------------------------------------------------------------------ *
 * Marking progress and reworded text
 * ------------------------------------------------------------------ */

/**
 * The Step with `stepId` moved to `status`, or the same array when the id is not there.
 *
 * A `closed` Step is terminal for a party: it is history, so a tick cannot reopen it and the array
 * comes back by identity. Closing is the derivation's write (`closeSteps`), never a party's.
 */
export function withStepStatus(
  steps: readonly Step[],
  stepId: string,
  status: StepStatus,
): readonly Step[] {
  const target = steps.find((step) => step.id === stepId);
  if (target === undefined || target.status === status || target.status === "closed") return steps;
  return steps.map((step) => (step.id === stepId ? { ...step, status } : step));
}

/**
 * The Step with `stepId` reworded to `text` — the party's own words, in place of (or beside) the
 * suggestion, which stays in `suggestedText`.
 *
 * An empty or whitespace-only value is not a write: a Step with no words is not a Step, and the
 * schema says so (`.min(1)`). A `closed` Step is history and is not reworded either — its words are
 * a record of what was agreed, not a plan. Either case returns the same array, so "Last modified"
 * does not move.
 */
export function withStepText(
  steps: readonly Step[],
  stepId: string,
  text: string,
): readonly Step[] {
  const trimmed = text.trim();
  if (trimmed.length === 0) return steps;
  const target = steps.find((step) => step.id === stepId);
  if (target === undefined || target.status === "closed" || target.text === trimmed) return steps;
  return steps.map((step) => (step.id === stepId ? { ...step, text: trimmed } : step));
}

/** How many Steps a relationship holds, how many are done, and how many have closed. A count, never a score. */
export interface StepProgress {
  /** Every row stored — done, open, and closed history alike. */
  readonly total: number;
  /** Rows the parties have ticked. */
  readonly done: number;
  /** Rows whose Gap has since fallen to 0: kept as history, never outstanding. */
  readonly closed: number;
  /** The rows that are still work: `total - closed`. What a progress line should divide by. */
  readonly active: number;
}

export function stepProgressOf(steps: readonly Step[]): StepProgress {
  const done = steps.filter((step) => step.status === "done").length;
  const closed = steps.filter((step) => step.status === "closed").length;
  return { total: steps.length, done, closed, active: steps.length - closed };
}

/** One Aspect's Steps, in stored order — the report groups by Aspect, never by kind. */
export function stepsForAspect(steps: readonly Step[], aspectId: string): Step[] {
  return steps.filter((step) => step.aspectId === aspectId);
}
