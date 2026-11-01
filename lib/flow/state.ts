/**
 * The two-party flow's state — derived from rows, never stored (#146).
 *
 * The instance's status is three values, and every one of them is a function of the rows
 * that already exist:
 *
 *   awaiting_counterparty   the Initiator exists, the Counterparty has not claimed yet
 *   answering               both parties exist, and at least one Aspect is unanswered
 *   complete                both parties exist and both answered every Aspect
 *
 * There is no `status` column anywhere (#145's `session` has two columns, and
 * `0002_two_party_flow.sql` adds none). A stored status would be a second authored copy of
 * a fact the opinion rows already carry, and nothing in SQL could compare the two — the
 * same reason the Gap is `gapOf()` and not a column.
 *
 * **The blind rule lives here too**, because it is the same question as the status: a
 * party may read the other party's Opinions only once the status is `complete`. Every
 * screen asks `visibleRoles()` before it reads a score, so "neither sees the other's
 * answers before both submit" is decided in one place, by the rows, and not by which
 * props a component happened to be handed.
 *
 * Pure: no `pg`, no `process.env`, no clock. `tests/flow-state.test.ts` drives every
 * branch without a database, and the DB port (`lib/flow/store.ts`) supplies the counts.
 */
import {
  zOpinions,
  type AssessmentMode,
  type Opinions,
  type PartyRole,
} from "@/content/assessment";

/* ------------------------------------------------------------------ *\
 * Status
 * ------------------------------------------------------------------ */

export const INSTANCE_STATUSES = ["awaiting_counterparty", "answering", "complete"] as const;

export type InstanceStatus = (typeof INSTANCE_STATUSES)[number];

/** The counts one instance contributes to its own status. */
export interface InstanceProgress {
  /** Aspects in the instance's copy. `0` is a broken instance, and never `complete`. */
  readonly aspectCount: number;
  /** The Counterparty claims the invite before they exist as a party at all. */
  readonly hasCounterparty: boolean;
  readonly initiatorAnswered: number;
  readonly counterpartyAnswered: number;
}

/**
 * The status, from the counts.
 *
 * `complete` requires **both** sides to have answered **every** Aspect — the join the
 * screen depends on. A copy with 0 Aspects is never complete: there is nothing to answer,
 * so "both submitted" would unlock a report with no rows.
 */
export function instanceStatusOf(progress: InstanceProgress): InstanceStatus {
  if (!progress.hasCounterparty) return "awaiting_counterparty";
  if (progress.aspectCount <= 0) return "answering";
  const everyoneAnswered =
    progress.initiatorAnswered >= progress.aspectCount &&
    progress.counterpartyAnswered >= progress.aspectCount;
  return everyoneAnswered ? "complete" : "answering";
}

/** How many Aspects each party still owes. `complete` owes none. */
export function answersRemaining(progress: InstanceProgress): Record<PartyRole, number> {
  const owed = (answered: number) => Math.max(0, progress.aspectCount - answered);
  return {
    initiator: owed(progress.initiatorAnswered),
    counterparty: owed(progress.counterpartyAnswered),
  };
}

/**
 * The parties whose Opinions a viewer may read.
 *
 * `complete` unlocks both; before that a viewer reads their own and nothing else. A
 * component cannot widen this by asking for it: the roles are the return value, and the
 * read path (`lib/flow/store.ts`) only queries the opinions these roles name.
 */
export function visibleRoles(viewer: PartyRole, status: InstanceStatus): PartyRole[] {
  if (status === "complete") return ["initiator", "counterparty"];
  return [viewer];
}

/**
 * Whether a submit may be written at all.
 *
 * Answers freeze at the instant both parties have submitted: after that the rows are the
 * record of what was said, and an edit would rewrite it for the other party without their
 * knowing. `false` is a rejection the caller must surface — never a silent no-op.
 */
export function maySubmit(status: InstanceStatus): boolean {
  return status !== "complete";
}

/* ------------------------------------------------------------------ *\
 * Submission
 * ------------------------------------------------------------------ */

/** Why a submission was refused. The screen maps each code to its own copy id (E23). */
export type SubmissionRejection = "frozen" | "incomplete" | "not-a-party" | "no-such-instance";

export interface ParsedAnswers {
  readonly itemId: string;
  readonly opinions: Opinions;
}

export type SubmissionParse =
  | { readonly ok: true; readonly answers: ParsedAnswers[] }
  | { readonly ok: false; readonly problems: string[] };

/** One raw value per (Aspect, kind), as a form post supplies them: text, always. */
export type RawAnswer = {
  readonly feel?: string;
  readonly wish?: string;
  readonly think?: string;
  readonly guess?: string;
};

/**
 * Form text → `zOpinions`, through the schema the model has always used.
 *
 * `zOpinions` is imported rather than re-implemented: a score is an integer in 1..5
 * because `content/assessment.ts` says so, and the DB layer learns the rule from the same
 * place the fixtures do. Every Aspect the instance holds must arrive exactly once —
 * a submit is the party's whole sheet, not a patch, so a missing Aspect is a refusal and
 * not a partial write.
 *
 * **The mode is an argument, never a form field.** `submitAnswers` passes the value it read
 * from the locked `session` row, so the sheet a post is parsed against cannot be
 * chosen by the post. Basic refuses a Think/Guess value outright (a field nobody reads is the
 * silent success the freeze rule exists to prevent); Advanced requires the pair on every
 * Aspect, because that is the sheet its mode asks.
 */
export function parseSubmission(
  aspectIds: readonly string[],
  raw: ReadonlyMap<string, RawAnswer>,
  mode: AssessmentMode,
): SubmissionParse {
  const problems: string[] = [];
  const answers: ParsedAnswers[] = [];
  const advanced = mode === "advanced";

  for (const itemId of aspectIds) {
    const entry = raw.get(itemId);
    if (entry === undefined) {
      problems.push(`${itemId}: no answer — a submit carries every Aspect`);
      continue;
    }
    if (!advanced && (entry.think !== undefined || entry.guess !== undefined)) {
      const kind = entry.think !== undefined ? "think" : "guess";
      problems.push(`${itemId}.${kind}: "${kind}" is not a Basic Mode opinion kind`);
      continue;
    }
    if (advanced && (entry.think === undefined || entry.guess === undefined)) {
      problems.push(
        `${itemId}.think: Think and Guess come together: Advanced Mode adds the pair, so one of them alone is not a mode`,
      );
      continue;
    }

    const feel = toScore(entry.feel);
    const wish = toScore(entry.wish);
    const parsed = zOpinions.safeParse(
      advanced
        ? { feel, wish, think: toScore(entry.think), guess: toScore(entry.guess) }
        : { feel, wish },
    );
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        problems.push(`${itemId}.${issue.path.join(".") || "opinions"}: ${issue.message}`);
      }
      continue;
    }
    answers.push({ itemId, opinions: parsed.data });
  }

  if (problems.length > 0) return { ok: false, problems };
  return { ok: true, answers };
}

/**
 * A score from form text.
 *
 * `Number("")` is 0 and `Number("  ")` is 0, both of which fail `zScore`'s minimum, and
 * `Number("two")` is `NaN`, which fails `z.number()`. An empty pair is therefore a
 * refusal with the schema's message instead of a silent 0 — the "silent success" this
 * issue exists to rule out.
 */
function toScore(value: string | undefined): number {
  if (value === undefined || value.trim() === "") return Number.NaN;
  return Number(value);
}

/**
 * The order the screen names who is still to answer: the viewer's opposite first, because
 * it is the other person the reader is waiting for, then the viewer themselves.
 */
export function waitingOn(progress: InstanceProgress, hasInitiator: boolean): PartyRole[] {
  const owed = answersRemaining(progress);
  const waiting: PartyRole[] = [];
  // An unclaimed invite means the Counterparty has not even been named a party yet, and
  // that is a reason to wait for them — the same list, without a second state machine.
  if (!hasInitiator || owed.initiator > 0) waiting.push("initiator");
  if (!progress.hasCounterparty || owed.counterparty > 0) waiting.push("counterparty");
  return waiting;
}

/* ------------------------------------------------------------------ *\
 * One row of "my instances" (#213)
 * ------------------------------------------------------------------ */

/**
 * What one row of the list may say — three values, and the third one is the only one that
 * mentions anything the viewer has not seen themselves.
 *
 *   yours-to-answer   the viewer still owes an Aspect. Their own sheet, their own arithmetic.
 *   awaiting-other    the viewer has answered everything and the instance is not complete, so
 *                     the other party has not. The row says *awaiting* and nothing else.
 *   complete          both answered every Aspect: the Gap is open to both of them.
 *
 * **The blind rule holds in the list too.** `awaiting-other` is derived from a count the viewer
 * cannot see the substance of, and it is deliberately the *whole* sentence: no score, no
 * "3 of 5 answered", no partial Gap. There is no fourth state for "the other party has answered
 * but you have not", because that is `yours-to-answer` — a row may tell the reader what they owe
 * and never how far along somebody else is.
 *
 * The values are the copy item ids (`data/pages/assessment-instances.ts`), kebab-case like every
 * other id in the content model, so the view joins on them with `itemLabel(state, state)` the way
 * the instance screen joins a `?problem=` code.
 *
 * Pure, like the rest of this module: both counts come from rows the caller already read, and
 * `instanceStatusOf` is reused so the list and the screen can never disagree about `complete`.
 */
export const MY_INSTANCE_STATES = ["yours-to-answer", "awaiting-other", "complete"] as const;

export type MyInstanceState = (typeof MY_INSTANCE_STATES)[number];

/** The counts one row contributes, plus which side of it the viewer is. */
export interface MyInstanceProgress extends InstanceProgress {
  readonly viewerRole: PartyRole;
}

/** The viewer's own answered count. Never the other party's — see the comment above. */
export function viewerAnsweredCount(progress: MyInstanceProgress): number {
  return progress.viewerRole === "initiator"
    ? progress.initiatorAnswered
    : progress.counterpartyAnswered;
}

/**
 * The row's state.
 *
 * A copy with no Aspects is never `complete` (`instanceStatusOf`), and it is not
 * `yours_to_answer` either — there is nothing to answer, so the honest row is `awaiting_other`
 * rather than an invitation to fill in a form that does not exist.
 */
export function myInstanceStateOf(progress: MyInstanceProgress): MyInstanceState {
  if (instanceStatusOf(progress) === "complete") return "complete";
  const answered = viewerAnsweredCount(progress);
  if (progress.aspectCount > 0 && answered < progress.aspectCount) return "yours-to-answer";
  return "awaiting-other";
}

/* ------------------------------------------------------------------ *\
 * The unlock mark (#252)
 * ------------------------------------------------------------------ */

/**
 * Whether a row's `complete` is news to the viewer.
 *
 *   unseen   the instance is complete and this party has not opened it since — the marker
 *   seen     everything else, including every row that is not complete
 *
 * The two values are the decision, so the view cannot invent a third and the pure suite can
 * drive both without a database.
 *
 * **Why a NULL timestamp is the whole fact.** `complete` is terminal — `maySubmit()` freezes the
 * answers the moment both parties have answered — so there is no "complete, but from before"
 * case for a timestamp comparison to distinguish. `party.unlock_seen_at` is therefore a mark,
 * not a clock: `NULL` is "this party has never opened a complete instance", and the moment they
 * do, the page writes one and the marker is gone for them (`markUnlockSeen()` in
 * `lib/flow/store.ts` writes it, and only for the party who opened it).
 *
 * **The blind rule is untouched.** The mark is arithmetic over a count and a column: it says
 * *that* the instance is complete, which the row already said, and nothing about what is in it —
 * no score, no count, no Gap value. `unseen` is only ever derivable from `complete`, so a row
 * cannot use it to tell a reader that somebody else is partway through.
 *
 * Pure, like the rest of this module: the caller passes the timestamp it read from the party row.
 */
export const UNLOCK_MARKS = ["unseen", "seen"] as const;

export type UnlockMark = (typeof UNLOCK_MARKS)[number];

export function unlockMarkOf(state: MyInstanceState, unlockSeenAt: Date | null): UnlockMark {
  return state === "complete" && unlockSeenAt === null ? "unseen" : "seen";
}
