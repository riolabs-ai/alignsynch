/**
 * The answer sheet's gate: who may see a sheet on `/answer`, and in which shape (#427, R2-2).
 *
 * The route had no viewer before this card — R1-E shipped the screen as in-progress UI that drew
 * both seats and disabled every control. The sheet is a **write surface** now, so the page needs
 * three answers before it can draw anything, and this module is where they are decided:
 *
 *   coach      the viewer holds a `coach` membership and no `party` row. A coach reads the
 *              relationship; they have no answers to give, so there is no form at all — not a
 *              disabled one. The page draws the badge and the reason instead.
 *   lapsed     the membership behind this relationship ended (#533 phase 3, reachable since
 *              #1223). The screen names the pause before anything else it could say, and the
 *              sheet underneath stays exactly what it would have been: #848's rule is that a
 *              lapse closes the **Gap**, not the pairing, so `action` is still the answers
 *              endpoint for a viewer `maySubmit()` allows and `null` for one it does not.
 *   readonly   the session is `complete`, so `maySubmit()` is false and the sheet is the record
 *              of what was said. The viewer's own scores are still drawn (they are theirs), but
 *              without a form: a control that can only fail is the silent-success bug arriving
 *              from the other side.
 *   sheet      the viewer's seat, prefilled with their own answers, `action` pointing at
 *              `/assessment/instances/[instanceId]/answers`.
 *
 * **What this module deliberately cannot do.** It is handed a projected `FlowScreen`, never rows,
 * so there is no parameter through which another party's answers could arrive: `aspects[].own` is
 * the viewer's own score, and pre-completion the only opinion query in the app is filtered by
 * `visibleRoles()` (`lib/flow/state.ts`) inside `readFlowScreen()`. The gate decides *shape*, not
 * *visibility* — visibility was decided before this module was called, in the one place that reads
 * opinions.
 *
 * **The form never names its seat.** Nothing here produces a field like `role`: the seat is
 * resolved inside `submitAnswers()`' transaction from the party cookie's token hash, and the store
 * reads a posted `role` as an *assertion* it refuses when it contradicts the cookie (`#202`). A
 * viewer whose seven-day cookie expired but who is signed in is resolved by `party.user_id` on the
 * read path (`relationshipRoleOf()`), which is why the sheet draws for them rather than 404ing.
 *
 * Pure: no `pg`, no React, no clock, no `process.env`. `tests/flow-answer-gate.test.ts` drives
 * every branch, and the route calls it with what Postgres projected.
 */
import type { PartyRole } from "@/content/assessment";
import { answersPath } from "@/lib/flow/paths";
import { maySubmit, type SessionStatus } from "@/lib/flow/state";
import type { FlowAspect } from "@/lib/flow/screen";
import type { Membership } from "@/lib/relationship/membership";

/** The four surfaces one answer URL can draw. */
export const ANSWER_SHEET_STATES = ["sheet", "readonly", "lapsed", "coach"] as const;

export type AnswerSheetState = (typeof ANSWER_SHEET_STATES)[number];

/** What the page may draw, and where its form posts (or why it has none). */
export interface AnswerGate {
  readonly state: AnswerSheetState;
  /**
   * The seat this request answers as, or `null` for a coach — a coach has no `party` row, so
   * there is no seat to name and no column to write.
   */
  readonly role: PartyRole | null;
  /**
   * The submit endpoint, for the states that may write. `null` when there is no form: a form whose
   * action is absent is a form the markup cannot accidentally submit.
   *
   * `lapsed` is the one state whose action is decided by `maySubmit()` rather than by its name —
   * a lapsed trial no longer takes the form away (#848), and an accepted seat still has none.
   */
  readonly action: string | null;
  /** How many Aspects the viewer has already answered — the resubmit label, and nothing else. */
  readonly answered: number;
  /** Aspects in the session's own copy. */
  readonly aspects: number;
}

export interface AnswerGateInput {
  readonly sessionRecordId: string;
  /** The seat the read resolved, from Postgres — never from the URL or a form field. */
  readonly viewerRole: PartyRole | "coach";
  readonly status: SessionStatus;
  /**
   * Whether the **viewer's own** seat has accepted (#R2). The freeze is per party now, so the
   * status alone cannot answer "may this viewer still edit": a session in `answering` where the
   * viewer has already accepted is locked for them and open for the other seat.
   */
  readonly viewerAccepted: boolean;
  /** The projected Aspects. Only `own` is read, and it is the viewer's own. */
  readonly aspects: readonly Pick<FlowAspect, "own">[];
  /**
   * #533 phase 3 — the membership paying for this relationship. `lapsed` outranks every other
   * state except `coach`: a coach has no seat to lose, and a party whose membership ended reads
   * the pause on their sheet. It does **not** take the form away (#848/#1223): the sheet stays
   * writable and only `screen.report` stays shut.
   */
  readonly membership?: Membership | null;
}

/**
 * The gate for one viewer.
 *
 * The freeze is `maySubmit(status, viewerAccepted)` — imported, never re-typed here, so the day the
 * hinge moves (Card 3: the sheet locks on the party's own acceptance) this page follows the one
 * derivation instead of carrying a second copy of the rule.
 */
export function answerGateOf(input: AnswerGateInput): AnswerGate {
  const answered = input.aspects.filter((aspect) => aspect.own !== null).length;
  const counts = { answered, aspects: input.aspects.length };

  if (input.viewerRole === "coach") {
    return { ...counts, state: "coach", role: null, action: null };
  }
  // #1223 — the state `ANSWER_SHEET_STATES` has named since #533 phase 3 and no branch ever
  // returned, so the paused screen could not render. It outranks `readonly` (a lapsed viewer who
  // has also accepted reads the pause first) and never outranks `coach` — a coach has no seat to
  // lose. What it deliberately does **not** do is take the form away: #848's rule is that a lapse
  // closes the Gap, not the pairing, so the action is the same `maySubmit()` the sheet branch
  // asks, and the only thing the state changes is which surface the page draws.
  if (input.membership?.state === "lapsed") {
    return {
      ...counts,
      state: "lapsed",
      role: input.viewerRole,
      action: maySubmit(input.status, input.viewerAccepted)
        ? answersPath(input.sessionRecordId)
        : null,
    };
  }
  // #848 — a lapsed trial closes the **Gap**, not the pairing. This used to take the form away, so
  // the counterparty who opened the link on day eight could not answer at all and two people were
  // stranded mid-session. The sheet stays writable; `screen.report` is what stays shut, because a
  // report is built only for a `complete` session.
  if (!maySubmit(input.status, input.viewerAccepted)) {
    return { ...counts, state: "readonly", role: input.viewerRole, action: null };
  }
  return {
    ...counts,
    state: "sheet",
    role: input.viewerRole,
    action: answersPath(input.sessionRecordId),
  };
}

/**
 * The viewer's own score for one Opinion kind, or `undefined` while they have not answered it.
 *
 * A thin read of `aspect.own` so the view has one function to call per radio group instead of a
 * chain of optional accesses, and so "prefilled" means exactly one thing: the row this viewer
 * wrote. `own` is `null` until they answer, and a Basic session carries no Think/Guess at all —
 * both come back `undefined` here, and neither is ever a default score.
 */
export function ownScoreOf(
  aspect: Pick<FlowAspect, "own">,
  kind: keyof NonNullable<FlowAspect["own"]>,
): number | undefined {
  return aspect.own?.[kind];
}
