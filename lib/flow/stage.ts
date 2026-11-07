/**
 * The instance screen's **one** stage sentence — derived from the flow's status, never stored,
 * and never a bar (#274, `docs/specs/ux-stages.md`).
 *
 * The relationship ladder has four names (`content/stages.ts`): Invited, Connected, Sharing,
 * Aligned. This module maps a screen's status onto the first three and deliberately **cannot
 * return `aligned`**:
 *
 *   awaiting_counterparty  → invited     the Counterparty has no seat yet
 *   answering              → connected   both seats exist, the sheet is not finished
 *   complete               → sharing     both submitted; the report is open to both
 *
 * **Aligned is a verdict, not a step.** It is `instanceAlignment()` over the finished Gap —
 * Setting-relative arithmetic that flips when a Settings choice changes — so it belongs on the
 * report (whose verdict band draws it from the same function), not in a progress display. That
 * is also why the type here excludes it: the report is the only caller that could ever know the
 * Setting and the Gaps, and it is not this module's caller.
 *
 * **Why no stepper.** Three of the four transitions are driven by the other party or by nobody
 * at all: Invited→Connected is the Counterparty's click, Sharing is both submissions, and
 * Aligned is arithmetic. A stage bar for actions the viewer cannot take (USWDS's own "when to
 * consider something else") reads as broken when it does not move, and an invitation that
 * expires is a step backwards no stepper can draw. The full argument, with the sources, is
 * `docs/specs/ux-stages.md`.
 *
 * **Derived, and blind-rule-safe.** A stage is a function of the status, which is a function of
 * counts the read path already exposes; nothing here can name how far along the other party is,
 * because no count is an input. `stageCopyId()` picks which sentence the screen draws — the
 * expired-invite branch is chosen from the invitation's own derived state (`#266`), not from a
 * second clock.
 *
 * Pure: no React, no clock, no database. The copy itself is
 * `data/pages/assessment-instance.ts` (E23); this module only decides which row of it to draw.
 */
import type { RelationshipStage } from "@/content/stages";
import type { InviteDisplayState } from "@/lib/flow/invite-state";
import type { InstanceStatus } from "@/lib/flow/state";

/**
 * The three stages a screen can name. `aligned` is the fourth name on the ladder and is
 * excluded on purpose — see the module comment; the type makes "draw Aligned as a step" a
 * compile error rather than a rule someone has to remember.
 */
export const FLOW_STAGES = [
  "invited",
  "connected",
  "sharing",
] as const satisfies readonly RelationshipStage[];

export type FlowStage = (typeof FLOW_STAGES)[number];

/**
 * The status → stage table. `voided` has **no** stage (#503): a session an operator ended is off
 * the ladder, so `null` is the honest answer and the instance screen draws its own notice instead
 * of a badge. Typing the value as `FlowStage | null` rather than adding a fourth stage name makes
 * "draw the ladder for a void" a compile error at the call site.
 */
const STAGE_OF_STATUS: Record<InstanceStatus, FlowStage | null> = {
  awaiting_counterparty: "invited",
  answering: "connected",
  /**
   * #619 — both sheets are sealed and the fee is not settled. The ladder position is `sharing`
   * (both parties have done their part), and the **sentence** is what differs: `sharing` says the
   * report is open, which is exactly what `awaiting_payment` is not.
   */
  awaiting_payment: "sharing",
  complete: "sharing",
  voided: null,
};

/** The stage this instance's screen is at — `null` when the session was voided. */
export function relationshipStage(status: InstanceStatus): FlowStage | null {
  return STAGE_OF_STATUS[status];
}

/**
 * Which sentence of the `stage` copy section the screen draws.
 *
 * `invited` has two, because "nobody has claimed it yet" and "the invitation died last
 * Tuesday" are different facts a reader has to be able to tell apart — the expiry is already
 * derived at read time (`lib/flow/invite-state.ts`), so the honest sentence costs one branch
 * and no new state. `connected` has a second, counts-free sentence for the degenerate copy
 * with no names to list (a screen that cannot name who owes says only that the sheet is not
 * finished).
 */
export type StageCopyId =
  | "invited"
  | "invited-expired"
  | "connected"
  | "connected-unknown"
  | "sharing"
  /**
   * #619 — addressed from the **status**, not from the stage: `sharing` is both "the Gap is open"
   * and "the sheets are sealed and the fee is not settled", and only the status tells them apart.
   */
  | "awaiting-payment";

export function stageCopyId(
  stage: FlowStage,
  invite: InviteDisplayState | null,
  status?: InstanceStatus,
): StageCopyId {
  if (status === "awaiting_payment") return "awaiting-payment";
  if (stage === "invited" && invite === "expired") return "invited-expired";
  return stage;
}
