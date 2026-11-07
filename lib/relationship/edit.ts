/**
 * What may be edited on a relationship after it exists, and **what a change costs** — #623.
 *
 * This module is the decision half of the edit surface: the inventory (column → who may write it
 * → what it costs) and the invalidation arithmetic, both over values. `lib/member/relationship-edit.ts`
 * is the write half, and it re-asks every question here inside its transaction over the rows it has
 * locked. A screenshot, a review and a test all read the same table.
 *
 * **The owner's decision lives here as a rule, not as prose.** #623's comment of 2026-11-07:
 *
 *   > Editing fields the counterparty's answers depend on: allowed, but the invalidation is stated
 *   > before saving.
 *
 * So a change that strands answers is *not* refused for being dangerous — it is returned as a
 * `stated` invalidation, the screen prints it, and the write refuses (`unconfirmed-invalidation`)
 * until the caller confirms. That is the whole reason this file exists: "where did my answer go"
 * is what silence costs, and a lock is what a typo costs.
 *
 * **`blocked` is a third severity, and it is not a policy choice — it is the schema's.** Two edits
 * cannot be made at all once a session exists:
 *
 *   - `mode` and `setting` are columns of `session`, and `scripts/db-verify.mjs` V18 fails any
 *     `UPDATE session` whose SET list is not exactly the operator's void pair or the deletion
 *     sweep's `name` (#503, #278). A scored session is immutable; the mode decided which questions
 *     were asked and the answers were shaped by it, so moving it would rewrite a score by
 *     relabelling it. They are chosen at **publish** instead, where no row exists yet.
 *   - a **new Aspect** on a sheet somebody has already answered leaves the sheet incomplete
 *     (`V6`: every party answers every Aspect, and a complete instance must), so it is refused
 *     with `answers-sealed` — the honest path to a new question is a new round, which is its own
 *     card.
 *
 * **`completed_at` and `expired_at` are not in this file at all, and that is deliberate.** They
 * are outcomes of transitions (`lib/member/payment.ts`, `lib/relationship/enforcement.ts`,
 * `lib/admin/relationship-ops.ts`), never fields. An editor that could set them would let a screen
 * claim a completion nobody paid for. `void_reason` and `lapse_reason` are *recorded facts*: a
 * reason written by the transition that ended the relationship, and the reason a lapse is stored
 * beside its instant. The inventory below names all five so a reader can see there is no sixth
 * answer.
 *
 * Pure: no `pg`, no clock, no React. `tests/relationship-edit.test.ts` drives every branch.
 */
import type { AlignmentSetting, AssessmentMode, PartyRole } from "@/content/assessment";

/* ------------------------------------------------------------------ *\
 * The inventory
 * ------------------------------------------------------------------ */

/** One row of #623's field census: what it writes, who may write it, and what it costs. */
export interface EditableField {
  readonly id: string;
  /** `table.column`, exactly as the schema names it — the census's left-hand side. */
  readonly writes: readonly string[];
  readonly who: "initiator" | "initiator+staff";
  readonly policy: PostCreatePolicy;
  /** Why the policy is what it is. One clause; a reviewer reads this before the diff. */
  readonly why: string;
}

/** The policy, as a value a writer can branch on: it is `blocked`'s reason plus `open`'s. */
export type PostCreatePolicy =
  | { readonly kind: "open" }
  | { readonly kind: "stated-cost" }
  | { readonly kind: "locked"; readonly reason: LockedReason };

export type LockedReason =
  /** `UPDATE session` is refused by `db-verify` V18 once the mode shaped somebody's answers. */
  | "session-immutable"
  /** A new question on an answered sheet leaves it incomplete (V6). */
  | "answers-sealed"
  /** The seat was taken: re-pointing it is an account-level repair, not an edit. */
  | "seat-claimed"
  /** A terminal relationship is not a form. */
  | "closed";

const OPEN: PostCreatePolicy = { kind: "open" };
const STATED: PostCreatePolicy = { kind: "stated-cost" };
const locked = (reason: LockedReason): PostCreatePolicy => ({ kind: "locked", reason });

/**
 * Every field #623 asks about, and nothing invented: the `writes` column is the schema's, read
 * from `0013`, `0026`, `0030`, `0032` and `0034`'s session columns.
 *
 * The five columns the issue measured as writerless are all present, with what actually writes
 * them today — the census's point is that nothing is invisible, not that everything is a form.
 */
export const EDITABLE_FIELDS: readonly EditableField[] = [
  {
    id: "title",
    writes: ["record.title"],
    who: "initiator+staff",
    policy: OPEN,
    why: "a name a person reads; no score is derived from it",
  },
  {
    id: "summary",
    writes: ["record.summary"],
    who: "initiator+staff",
    policy: OPEN,
    why: "a sentence above the Aspects; no score is derived from it",
  },
  {
    id: "aspects",
    writes: ["item.prompt", "item.left_value", "item.right_value", "item.position"],
    who: "initiator+staff",
    policy: STATED,
    why: "the questions the answers live on — turning one off discards the answers to it",
  },
  {
    id: "mode",
    writes: ["session.mode"],
    who: "initiator+staff",
    policy: locked("session-immutable"),
    why: "chosen at publish; a scored session may not be rewritten (V18), and the mode shaped which questions were asked",
  },
  {
    id: "setting",
    writes: ["session.alignment_setting"],
    who: "initiator+staff",
    policy: locked("session-immutable"),
    why: "chosen at publish; rewriting it would reinterpret answers already given (V18)",
  },
  {
    id: "counterparty",
    writes: ["session_invite.counterparty_name", "session_invite.email"],
    who: "initiator+staff",
    policy: STATED,
    why: "correctable while the seat is unclaimed; a claimed seat is an account binding, not a text field",
  },
  {
    id: "invite-window",
    writes: ["session_invite.expires_at"],
    who: "initiator+staff",
    policy: STATED,
    why: "the seven-day window is a fact a person may need to extend, up to the day the seat is taken",
  },
  {
    id: "version-pin",
    writes: ["relationship.template_version_id"],
    who: "initiator+staff",
    policy: STATED,
    why: "the pin is what every party-facing read parses; moving it states the Aspect diff it applies",
  },
  {
    id: "void_reason",
    writes: ["relationship.void_reason"],
    who: "initiator+staff",
    policy: locked("closed"),
    why: "a recorded fact written by the transition that ends it (`relationship.void`), never a field",
  },
  {
    id: "lapse_reason",
    writes: ["relationship.lapse_reason"],
    who: "initiator+staff",
    policy: locked("closed"),
    why: "a recorded fact written with `expired_at` when the membership ends (`lib/relationship/enforcement.ts`)",
  },
  {
    id: "completed_at",
    writes: ["relationship.completed_at"],
    who: "initiator+staff",
    policy: locked("closed"),
    why: "derived by transition — the completion or the void stamps it; never hand-set",
  },
  {
    id: "expired_at",
    writes: ["relationship.expired_at"],
    who: "initiator+staff",
    policy: locked("closed"),
    why: "derived by transition — the lapse handler stamps it with its reason; never hand-set",
  },
  {
    id: "status",
    writes: ["relationship.status"],
    who: "initiator+staff",
    policy: locked("closed"),
    why: "moves only on the edges `lib/relationship/status.ts` names, per actor; this surface has no transition",
  },
];

/** The inventory row for one field, or `undefined` — the writer refuses an id it does not know. */
export function fieldOf(id: string): EditableField | undefined {
  return EDITABLE_FIELDS.find((field) => field.id === id);
}

/* ------------------------------------------------------------------ *\
 * Snapshots and the diff
 * ------------------------------------------------------------------ */

/** One Aspect as the editor holds it. `id` is the `item.item_id` the answers are keyed by. */
export interface EditAspect {
  readonly id: string;
  readonly prompt: string;
  readonly leftValue: string;
  readonly rightValue: string;
}

/** Everything an edit can see, before and after — one shape, so a diff is a diff of like values. */
export interface EditSnapshot {
  readonly title: string;
  readonly summary: string;
  readonly mode: AssessmentMode;
  readonly setting: AlignmentSetting;
  readonly aspects: readonly EditAspect[];
}

/** How many answers one seat holds on one Aspect. A count; never a score (`lib/db/admin-relationship.ts`). */
export interface AnswerTally {
  readonly aspectId: string;
  readonly role: PartyRole;
  readonly name: string;
  readonly answers: number;
}

/** One Aspect's answers, per seat, summed for the sentence the screen prints. */
export interface SeatedAnswers {
  readonly role: PartyRole;
  readonly name: string;
  readonly answers: number;
}

/**
 * One thing a change costs.
 *
 * `severity` decides what happens next and nothing else does: `stated` needs a confirmation,
 * `blocked` needs a different edit. The audit row records the whole list, so "the invalidation was
 * stated" is a fact in the log rather than a claim in a screenshot.
 */
export interface EditInvalidation {
  readonly code: InvalidationCode;
  readonly severity: "stated" | "blocked";
  /** The Aspect the cost is about, when it is about one. */
  readonly aspectId?: string;
  /** The Aspect's words, for a sentence that names what is being dropped. */
  readonly prompt?: string;
  /** Per-seat counts, in the snapshot's party order. Empty for a form-level change. */
  readonly seats: readonly SeatedAnswers[];
  /** Summed answers across seats. Zero for a change that strands no answer. */
  readonly total: number;
  /** `from`/`to` for the two form-level changes (mode, setting). */
  readonly from?: string;
  readonly to?: string;
}

export type InvalidationCode =
  | "discards-answers"
  | "rewrites-question"
  | "adds-question"
  | "changes-mode"
  | "changes-setting";

/** The answer rows for one Aspect, summed per seat, in the order the tallies arrived. */
function seatsOf(answers: readonly AnswerTally[], aspectId: string): SeatedAnswers[] {
  const bySeat = new Map<string, SeatedAnswers>();
  for (const tally of answers) {
    if (tally.aspectId !== aspectId || tally.answers <= 0) continue;
    const key = `${tally.role}:${tally.name}`;
    const seen = bySeat.get(key);
    bySeat.set(key, {
      role: tally.role,
      name: tally.name,
      answers: (seen?.answers ?? 0) + tally.answers,
    });
  }
  return [...bySeat.values()];
}

function totalOf(seats: readonly SeatedAnswers[]): number {
  return seats.reduce((sum, seat) => sum + seat.answers, 0);
}

/**
 * Everything `before → after` would cost, given how many answers each seat holds on each Aspect.
 *
 * The four cases, and why each is a separate code rather than one "changed":
 *
 *   discards-answers   the Aspect is gone; its answers go with it. This is the owner's own
 *                      example — "turning off Aspect 3 discards 2 answers from <name>".
 *   rewrites-question  the Aspect stays and its words move. Nobody loses an answer, but somebody
 *                      answered a sentence that no longer exists, so it is stated too.
 *   adds-question      a new Aspect on an answered sheet. **Blocked**: the sheet would be
 *                      incomplete (`V6`), and the only honest path is a new round.
 *   changes-mode /
 *   changes-setting    **Blocked** whenever a session exists (`V18`), because the mode and the
 *                      Setting are columns of the row a score is read from.
 *
 * Ordering is stable and meaningful: discards first (the most expensive), then rewrites, then the
 * additions, then the form-level changes. A screen prints the list in order.
 */
export function invalidationsOf(input: {
  readonly before: EditSnapshot;
  readonly after: EditSnapshot;
  readonly answers: readonly AnswerTally[];
  /** Does a `session` row exist? Its existence is what makes `mode`/`setting` immutable. */
  readonly sessionExists: boolean;
}): EditInvalidation[] {
  const { before, after, answers, sessionExists } = input;
  const invalidations: EditInvalidation[] = [];

  const beforeById = new Map(before.aspects.map((aspect) => [aspect.id, aspect]));
  const afterById = new Map(after.aspects.map((aspect) => [aspect.id, aspect]));

  for (const aspect of before.aspects) {
    if (afterById.has(aspect.id)) continue;
    const seats = seatsOf(answers, aspect.id);
    const total = totalOf(seats);
    if (total === 0) continue;
    invalidations.push({
      code: "discards-answers",
      severity: "stated",
      aspectId: aspect.id,
      prompt: aspect.prompt,
      seats,
      total,
    });
  }

  for (const aspect of after.aspects) {
    const prior = beforeById.get(aspect.id);
    if (prior === undefined) continue;
    const moved =
      prior.prompt !== aspect.prompt ||
      prior.leftValue !== aspect.leftValue ||
      prior.rightValue !== aspect.rightValue;
    if (!moved) continue;
    const seats = seatsOf(answers, aspect.id);
    const total = totalOf(seats);
    if (total === 0) continue;
    invalidations.push({
      code: "rewrites-question",
      severity: "stated",
      aspectId: aspect.id,
      prompt: aspect.prompt,
      seats,
      total,
    });
  }

  for (const aspect of after.aspects) {
    if (beforeById.has(aspect.id)) continue;
    invalidations.push({
      code: "adds-question",
      severity: sessionExists ? "blocked" : "stated",
      aspectId: aspect.id,
      prompt: aspect.prompt,
      seats: [],
      total: 0,
    });
  }

  if (sessionExists && before.mode !== after.mode) {
    invalidations.push({
      code: "changes-mode",
      severity: "blocked",
      seats: [],
      total: 0,
      from: before.mode,
      to: after.mode,
    });
  }
  if (sessionExists && before.setting !== after.setting) {
    invalidations.push({
      code: "changes-setting",
      severity: "blocked",
      seats: [],
      total: 0,
      from: before.setting,
      to: after.setting,
    });
  }

  return invalidations;
}

/** The edits that cannot be made at all — the writer refuses with the first one's code. */
export function blockedOf(
  invalidations: readonly EditInvalidation[],
): EditInvalidation | undefined {
  return invalidations.find((invalidation) => invalidation.severity === "blocked");
}

/** The edits that need a confirmation — everything `stated`, and nothing `blocked`. */
export function statedOf(invalidations: readonly EditInvalidation[]): EditInvalidation[] {
  return invalidations.filter((invalidation) => invalidation.severity === "stated");
}

/**
 * The refusal code a `blocked` invalidation answers with.
 *
 * One code per *why*, because the screen has one sentence per code: a mode move and a new Aspect
 * are different dead ends and telling a person "cannot edit" for both is the silence this card
 * exists to remove.
 */
export function refusalFor(invalidation: EditInvalidation): "mode-fixed" | "answers-sealed" {
  return invalidation.code === "adds-question" ? "answers-sealed" : "mode-fixed";
}

/* ------------------------------------------------------------------ *\
 * The pin
 * ------------------------------------------------------------------ */

/**
 * The Aspect diff between two template versions, as the pin's own sentence.
 *
 * A pin move is a stated-cost edit even when no answer is stranded: the whole sheet changes under
 * both parties, and `relationship.template_version_id` is what every page parses. So the caller is
 * told which Aspects arrive, which leave, and — through `invalidationsOf` — what that costs.
 */
export function pinDiff(
  from: readonly EditAspect[],
  to: readonly EditAspect[],
): { readonly added: readonly EditAspect[]; readonly removed: readonly EditAspect[] } {
  const fromIds = new Set(from.map((aspect) => aspect.id));
  const toIds = new Set(to.map((aspect) => aspect.id));
  return {
    added: to.filter((aspect) => !fromIds.has(aspect.id)),
    removed: from.filter((aspect) => !toIds.has(aspect.id)),
  };
}

/** Nothing to write? Then nothing was edited, and the writer says so instead of logging a no-op. */
export function isNoChange(before: EditSnapshot, after: EditSnapshot): boolean {
  if (before.title !== after.title || before.summary !== after.summary) return false;
  if (before.mode !== after.mode || before.setting !== after.setting) return false;
  if (before.aspects.length !== after.aspects.length) return false;
  return before.aspects.every((aspect, index) => {
    const other = after.aspects[index];
    return (
      other !== undefined &&
      other.id === aspect.id &&
      other.prompt === aspect.prompt &&
      other.leftValue === aspect.leftValue &&
      other.rightValue === aspect.rightValue
    );
  });
}
