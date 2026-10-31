/**
 * The relationship Stages — four of them, derived, zero columns (#261).
 *
 * **Two ladders, and only one of them is a relationship ladder.** The two authoritative
 * documents split the same word differently, and the split is the whole reason this module
 * models four stages and not eight:
 *
 *   glossary (v2-01-01h)   one ladder of "Stage — Qty 6 … (1-6)", whose only rows are
 *                          1 Invited, 2 Connected, 3 Sharing and **7** Aligned. Rows 4, 5 and
 *                          6 are never defined.
 *   website spec (V2-01-01g)  "Now 8 Stages: **A–D (stage of User) + 1–4 (stage of
 *                          Relationship)**" — drawn as one bar on p57, two ladders labelled.
 *
 * The specification resolves the glossary's gap: the rows numbered 4–6 were not deleted, they
 * were **never relationship stages**. They are slotted under A–D — the *stage of the User*:
 * A Play (unregistered), B Registered (free trial week), C Parties Locked (Account Bank at
 * zero), D Subscribed. Those are **billing and account states**, and they are out of scope
 * (`docs/SPEC-DRIFT.md` §4.2, §4.3). So the relationship ladder is the specification's **1–4**,
 * and it is exactly the four stages the glossary names:
 *
 *   number  short name   definition, verbatim
 *   1       Invited      Initiator has Invited Counterparty, but they have not Registered.
 *                        Aspects, Values, and Opinions are locked.
 *   2       Connected    Counterparty Registered, found the Relationship, and is free to
 *                        Propose Changes to Aspects or Values, and mark Opinions.
 *   3       Sharing      Counterparty Shared Opinions, Relationship and Opinions now fully
 *                        open to all Users.
 *   4       Aligned      Parties are Aligned - In Synch – Same Page.
 *
 * **Nothing here is undefined, and nothing is invented.** An earlier reading of the glossary
 * alone concluded that stages 4–6 were missing from the source and recorded them as undefined;
 * the specification shows that gap is a different ladder's numbering, not silence. There is no
 * fifth relationship stage to add, no stage to renumber, and the A–D billing ladder is not
 * modelled at all — a stage of the *User* is a fact about a billing product this build does not
 * have. `docs/STAGES.md` records both ladders for a reader who has the documents open.
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
 * The four stages in the order the relationship passes through them — the specification's
 * relationship ladder, which is also the order the glossary lists its rows in.
 */
export const RELATIONSHIP_STAGES = ["invited", "connected", "sharing", "aligned"] as const;

export type RelationshipStage = (typeof RELATIONSHIP_STAGES)[number];

/**
 * The relationship ladder's numbers: 1, 2, 3 and 4 — the specification's "1–4 (stage of
 * Relationship)". Contiguous on purpose: there is no fifth relationship stage, so no number
 * is skipped.
 */
export type StageNumber = 1 | 2 | 3 | 4;

/**
 * The numbers, so a Stage Bar can print "3 · Sharing" and nothing has to restate them.
 *
 * The glossary's own table numbers Aligned **7**, not 4: it counts a single six-stage ladder
 * and never defines the rows in between. The specification (p57) draws the two ladders this
 * module tells apart — "A–D (stage of User) + 1–4 (stage of Relationship)" — so on the
 * relationship ladder Aligned is 4. The build numbers the ladder it models, and models no
 * ladder of the User.
 */
export const STAGE_NUMBERS: Record<RelationshipStage, StageNumber> = {
  invited: 1,
  connected: 2,
  sharing: 3,
  aligned: 4,
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
