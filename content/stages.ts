/**
 * The relationship Stages — four of them, derived, zero columns (#261).
 *
 * The glossary (v2-01-01h) gives Stage a Qty of 6 — "The progress of the Relationship
 * functions" — and points its Example List at "(1-6)". The document then defines only
 * **four** stage rows, numbered 1, 2, 3 and **7**:
 *
 *   number  short name   definition, verbatim
 *   1       Invited      Initiator has Invited Counterparty, but they have not Registered.
 *                        Aspects, Values, and Opinions are locked.
 *   2       Connected    Counterparty Registered, found the Relationship, and is free to
 *                        Propose Changes to Aspects or Values, and mark Opinions.
 *   3       Sharing      Counterparty Shared Opinions, Relationship and Opinions now fully
 *                        open to all Users.
 *   7       Aligned      Parties are Aligned - In Synch – Same Page.
 *
 * **Rows 4, 5 and 6 do not exist anywhere in the source.** A full-text extraction of the
 * PDF finds no row numbered 4, 5 or 6 — the count in the table above ("6") and the range in
 * the Example List ("1-6") are both contradicted by the document's own stage rows, which
 * jump from 3 to 7. So this module models the four that are defined, invents none, and keeps
 * the numbers the document gives them: **Aligned is stage 7**, and there is no stage 4 here
 * for the same reason there is no definition of one. `docs/STAGES.md` records the finding for
 * a reader who has the document open.
 *
 * **Derived, never stored.** A stage is a function of facts the rows already carry — whether
 * the Counterparty's seat exists (the invite has been claimed), whether both parties have
 * submitted, and whether the Gaps meet the instance's Setting:
 *
 *   invited    the invite is unclaimed — the Counterparty is not a party yet
 *   connected  both seats exist; the sheet is not complete (blind answering)
 *   sharing    complete, and at least one Gap the instance has exceeds its Setting
 *   aligned    complete, and every Gap the instance has meets its Setting
 *
 * There is no `stage` column, exactly as there is no `status` column (#145, #146) and no
 * `gap` column (#219): a stored stage would be a second authored copy of facts the opinion
 * rows already carry, and nothing in SQL could compare the two. No migration ships with this
 * module, and `db:verify` keeps its `%gap%` column rule unchanged.
 *
 * **A stage never carries an answer.** `invited` and `connected` are facts about *seats*;
 * `sharing` and `aligned` are facts about a *finished* sheet, and they are reachable only
 * when both parties have submitted — the same instant the blind rule lifts
 * (`lib/flow/state.ts::visibleRoles`). A party who has not submitted is shown `invited` or
 * `connected` and nothing else: no score, no answered count, no Gap value, not even a hint
 * that the other party is part-way through. `StageFacts` makes that structural instead of a
 * rule the caller is trusted to keep — the Setting and the Gaps are **not representable** on
 * an instance that is not yet complete, so there is no argument through which either could
 * reach a pre-submit stage.
 *
 * Pure, like `content/gaps.ts` beside it: no React, no Next, no `lib/**` import, no clock.
 * `pnpm data:check` compiles it with `tsconfig.datacheck.json` and runs
 * `scripts/__tests__/stages.test.ts` over it under plain Node with `DATABASE_URL` unset.
 */
import type { AlignmentSetting } from "./assessment";
import { instanceAlignment, type AspectGaps } from "./gaps";

/* ------------------------------------------------------------------ *
 * The vocabulary — four stages, the numbers the source gives them
 * ------------------------------------------------------------------ */

/**
 * The four stages in the order the relationship passes through them. Glossary order, never
 * the numeric order: "Aligned" is number 7, so sorting by number and sorting by progress
 * disagree — this tuple is the progress order.
 */
export const RELATIONSHIP_STAGES = ["invited", "connected", "sharing", "aligned"] as const;

export type RelationshipStage = (typeof RELATIONSHIP_STAGES)[number];

/**
 * The stage numbers the glossary assigns: 1, 2, 3 and 7. There is no 4, 5 or 6 — not
 * "unassigned yet", but absent from the authoritative document — so none is representable.
 */
export type StageNumber = 1 | 2 | 3 | 7;

/** The glossary's own numbers, so a Stage Bar can print "3 · Sharing" and never renumber. */
export const STAGE_NUMBERS: Record<RelationshipStage, StageNumber> = {
  invited: 1,
  connected: 2,
  sharing: 3,
  aligned: 7,
};

/** The glossary's short names — "Invited", "Connected", "Sharing", "Aligned". */
export const STAGE_LABELS: Record<RelationshipStage, string> = {
  invited: "Invited",
  connected: "Connected",
  sharing: "Sharing",
  aligned: "Aligned",
};

/**
 * Each stage's definition, copied from the source rather than paraphrased, so a reader is
 * owed the document's own sentence beside the word. The en dash in "Aligned - In Synch – Same
 * Page" is the document's (hyphen, then en dash), quoted as it prints.
 */
export const STAGE_DEFINITIONS: Record<RelationshipStage, string> = {
  invited:
    "Initiator has Invited Counterparty, but they have not Registered. Aspects, Values, and Opinions are locked.",
  connected:
    "Counterparty Registered, found the Relationship, and is free to Propose Changes to Aspects or Values, and mark Opinions.",
  sharing: "Counterparty Shared Opinions, Relationship and Opinions now fully open to all Users.",
  aligned: "Parties are Aligned - In Synch – Same Page.",
};

/**
 * The stages a viewer can ever be shown before both parties have submitted. The bound is
 * exported so the test can assert it rather than restate it: everything past `connected`
 * describes a completed sheet, and showing it earlier would tell one party something about
 * the other's answers.
 */
export const STAGES_BEFORE_COMPLETE = [
  "invited",
  "connected",
] as const satisfies readonly RelationshipStage[];

/* ------------------------------------------------------------------ *
 * The derivation
 * ------------------------------------------------------------------ */

/**
 * The facts a stage is derived from — and nothing else is passed, so nothing else can leak.
 *
 * A union rather than a bag of booleans: `setting` and `aspects` exist **only** in the
 * `bothSubmitted: true` branch, so "work out aligned before the sheet is complete" is a type
 * error, not a caller's discipline. A caller maps the flow's derived status onto it
 * (`lib/flow/state.ts::instanceStatusOf`): `awaiting_counterparty` → the invite is unclaimed,
 * `answering` → both seats and not complete, `complete` → `bothSubmitted`.
 */
export type StageFacts =
  | { readonly counterpartyClaimed: false; readonly bothSubmitted: false }
  | { readonly counterpartyClaimed: true; readonly bothSubmitted: false }
  | {
      readonly counterpartyClaimed: true;
      readonly bothSubmitted: true;
      /** The instance's Setting, read from its row — never a default, never guessed. */
      readonly setting: AlignmentSetting;
      /** Every Aspect's Gaps, in `instanceAlignment`'s shape. */
      readonly aspects: readonly AspectGaps[];
    };

/**
 * The stage, derived. One call, four answers, no state:
 *
 *   counterparty not claimed                        → invited
 *   claimed, not complete                           → connected
 *   complete, a Gap wider than the Setting allows   → sharing
 *   complete, every Gap within the Setting          → aligned
 *
 * `aligned` is the only branch that reads the Setting, and it reads it through
 * `instanceAlignment` — the one comparison in the codebase (`gapMeetsSetting`), so a stage
 * cannot disagree with the report about the same instance. Soft tolerates a Gap of 1 and Full
 * does not, which is exactly why the Setting is a required member here: the same five Aspects
 * under `soft` and under `full` are two different stages.
 *
 * A copy with **no Aspects** is never `complete` (`instanceStatusOf`), so the last branch
 * cannot be reached from the flow; it returns `sharing` rather than `aligned` if it ever is,
 * because "In Synch about a question nobody asked" is the defect `gapKindsOf` refuses when it
 * omits an absent kind.
 */
export function stageOf(facts: StageFacts): RelationshipStage {
  if (!facts.counterpartyClaimed) return "invited";
  if (!facts.bothSubmitted) return "connected";
  if (facts.aspects.length === 0) return "sharing";
  return instanceAlignment(facts.aspects, facts.setting).aligned ? "aligned" : "sharing";
}
