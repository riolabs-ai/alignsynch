/**
 * The admin record registry as a value: one row's derivation, and the four filters that earn
 * their place (console-ia §3.5, card 3/5).
 *
 * This module is pure — no `pg`, no React, no clock of its own (`now` is an argument) — for the
 * reason `lib/flow/state.ts` and `content/stages.ts` are: every question the screen can be asked
 * is answerable without a request. `tests/admin-instance-registry.test.ts` drives the seat
 * vocabulary, the stage derivation and each filter over made-up rows, and the page hands the same
 * function the rows it read.
 *
 * **What a row may carry, and what it may not.** An operator sees *that* a seat was claimed, the
 * mode, the Setting and the derived stage. A stage is the one measure derived from opinions —
 * `stageOf()` reads the Gaps of a **complete** instance to tell `sharing` from `aligned` — and
 * that is exactly as far as a value from the opinion table may travel: `AdminInstanceRow` has a
 * `stage`, and no field on it can hold a score, a Gap, a count of answers or a per-Aspect row.
 * The read (`lib/db/admin-instances.ts`) computes the stage and drops the scores, so this shape
 * is the whole of what crosses to the browser. An "operator needs the answers" screen is a
 * different card with its own argument; this type is where that argument would have to start.
 *
 * **No party name the seat does not carry.** A seat's name comes from its `party` row, which is
 * the seat. An invitation names somebody who has not registered yet, and that name is not shown:
 * the row says `invited` / `expired` and nothing else about them.
 *
 * **The stage ladder is `content/stages.ts`'s, not a second one.** `stageOf()` takes the union
 * that makes Setting-and-Gaps unrepresentable before both parties submit, so this screen cannot
 * draw `aligned` on an unfinished relationship even by mistake — the caller passes the pieces and
 * the type decides.
 */
import {
  type AlignmentSetting,
  type AssessmentMode,
  instanceNameOf,
  MODE_LABELS,
  type Opinions,
  SETTING_LABELS,
} from "@/content/assessment";
import { gapKindsOf, type AspectGaps } from "@/content/gaps";
import { STAGE_LABELS, stageOf, type RelationshipStage } from "@/content/stages";
import { inviteStateOf, type InviteDisplayState, type InviteFacts } from "@/lib/flow/invite-state";
import { instanceStatusOf, type InstanceStatus } from "@/lib/flow/state";

/** The route. One spelling, read by the page, the gate's `next` and the nav row. */
export const ADMIN_INSTANCES_PATH = "/admin/instances";

/**
 * What a seat is, from an operator's side.
 *
 *   claimed   a party row bound to an account — this person can open the instance
 *   seat      a party row with no account: the seeded demo rows, and nothing a flow creates
 *   invited   no party row; the invitation is live and unclaimed
 *   expired   no party row; the invitation's window closed unclaimed
 *   none      no party row and no invitation — a row that should not exist, said plainly
 *
 * `seat` is not a defect an operator acts on; it is the honest name for "the fixture owns this
 * seat, not a person". Collapsing it into `claimed` would make the demo dataset look signed up.
 */
export const SEAT_STATES = ["claimed", "seat", "invited", "expired", "none"] as const;

export type SeatState = (typeof SEAT_STATES)[number];

/** One seat, as the table draws it. `name` is the party row's own name and `null` otherwise. */
export interface SeatRow {
  readonly state: SeatState;
  readonly name: string | null;
}

/** The `party` columns a seat is decided from — no token, no address, no role. */
export interface SeatFacts {
  readonly name: string;
  /** `party.user_id IS NOT NULL`: an account holds the seat. */
  readonly hasAccount: boolean;
}

/**
 * A seat's state. `invite` is only consulted when there is no party row: a claimed invitation
 * always has a party row beside it (`0002_two_party_flow.sql`), so the order of these branches
 * cannot disagree with the rows.
 */
export function seatStateOf(
  seat: SeatFacts | null,
  invite: InviteFacts | null,
  now: Date,
): SeatRow {
  if (seat !== null) {
    return { state: seat.hasAccount ? "claimed" : "seat", name: seat.name };
  }
  if (invite === null) return { state: "none", name: null };
  const state = inviteStateOf(invite, now);
  return { state: state === "expired" ? "expired" : "invited", name: null };
}

/**
 * One relationship, as the registry renders it.
 *
 * Every field is a fact the row already holds or a derivation of one. `stalled` is not a fourth
 * state: it is the Counterparty's seat reading `expired`, which is the definition the card asks
 * for ("unclaimed past its invite expiry") written once instead of in the filter and in the
 * badge.
 */
export interface AdminInstanceRow {
  readonly instanceRecordId: string;
  readonly slug: string;
  /** The relationship's own name when it has one, the template's title when it does not. */
  readonly name: string;
  readonly templateTitle: string;
  readonly mode: AssessmentMode;
  readonly setting: AlignmentSetting;
  readonly status: InstanceStatus;
  readonly stage: RelationshipStage;
  readonly invite: InviteDisplayState | null;
  readonly stalled: boolean;
  readonly initiator: SeatRow;
  readonly counterparty: SeatRow;
  /** ISO instants: the row crosses to a client component, so no `Date` objects. */
  readonly created: string;
  readonly lastActivity: string;
}

/** Everything the derivation needs, in the shape the read hands over. */
export interface RegistryFacts {
  readonly instanceRecordId: string;
  readonly slug: string;
  readonly name: string | null;
  readonly templateTitle: string;
  readonly mode: AssessmentMode;
  readonly setting: AlignmentSetting;
  readonly aspectCount: number;
  readonly initiatorAnswered: number;
  readonly counterpartyAnswered: number;
  readonly initiator: SeatFacts | null;
  readonly counterparty: SeatFacts | null;
  readonly invite: InviteFacts | null;
  readonly created: Date;
  readonly lastActivity: Date;
}

/**
 * One row: status, seats, stage — each from the one function that owns it.
 *
 * `aspects` is the Gaps of a complete instance and is ignored on an unfinished one, which is
 * what `stageOf`'s union enforces at the call site instead of trusting the caller: the
 * `bothSubmitted: false` branch is constructed first, so no Setting can reach a pre-submit stage.
 */
export function registryRowOf(
  facts: RegistryFacts,
  aspects: readonly AspectGaps[],
  now: Date,
): AdminInstanceRow {
  const status = instanceStatusOf({
    aspectCount: facts.aspectCount,
    hasCounterparty: facts.counterparty !== null,
    initiatorAnswered: facts.initiatorAnswered,
    counterpartyAnswered: facts.counterpartyAnswered,
  });

  const stage =
    status === "complete"
      ? stageOf({
          counterpartyClaimed: true,
          bothSubmitted: true,
          setting: facts.setting,
          aspects,
        })
      : stageOf({ counterpartyClaimed: facts.counterparty !== null, bothSubmitted: false });

  const counterparty = seatStateOf(facts.counterparty, facts.invite, now);
  const initiator = seatStateOf(facts.initiator, null, now);

  return {
    instanceRecordId: facts.instanceRecordId,
    slug: facts.slug,
    name: instanceNameOf(
      { ...(facts.name === null ? {} : { name: facts.name }) },
      facts.templateTitle,
    ),
    templateTitle: facts.templateTitle,
    mode: facts.mode,
    setting: facts.setting,
    status,
    stage,
    invite: facts.invite === null ? null : inviteStateOf(facts.invite, now),
    stalled: counterparty.state === "expired",
    initiator,
    counterparty,
    created: facts.created.toISOString(),
    lastActivity: facts.lastActivity.toISOString(),
  };
}

/* ------------------------------------------------------------------ *
 * The filters — four, and each one is a question an operator asks
 * ------------------------------------------------------------------ */

/** `all` is the absence of a filter, per axis. */
export interface RegistryFilter {
  readonly stage: RelationshipStage | "all";
  readonly mode: AssessmentMode | "all";
  readonly setting: AlignmentSetting | "all";
  /** "stalled only" — unclaimed past its invite expiry. */
  readonly stalled: boolean;
}

/** Nothing filtered: every row the reader can see. */
export const NO_FILTER: RegistryFilter = {
  stage: "all",
  mode: "all",
  setting: "all",
  stalled: false,
};

/**
 * Does one row pass? One predicate, so the count line and the table cannot disagree about what
 * "filtered" means — the failure a second `.filter(...)` in the view would introduce.
 */
export function registryRowPasses(row: AdminInstanceRow, filter: RegistryFilter): boolean {
  if (filter.stalled && !row.stalled) return false;
  if (filter.stage !== "all" && row.stage !== filter.stage) return false;
  if (filter.mode !== "all" && row.mode !== filter.mode) return false;
  if (filter.setting !== "all" && row.setting !== filter.setting) return false;
  return true;
}

/** The rows the table draws, in the order the read returned them (newest first). */
export function filterRegistry(
  rows: readonly AdminInstanceRow[],
  filter: RegistryFilter,
): readonly AdminInstanceRow[] {
  return rows.filter((row) => registryRowPasses(row, filter));
}

/** The two label tables a row prints, so the view and the filter options cannot drift. */
export const REGISTRY_LABELS = {
  mode: MODE_LABELS,
  setting: SETTING_LABELS,
  stage: STAGE_LABELS,
} as const;

/** The stage tabs, in ladder order, with `all` first. */
export const STAGE_TABS = ["all", "invited", "connected", "sharing", "aligned"] as const;

export type StageTab = (typeof STAGE_TABS)[number];

/** The two modes and the two settings, for the two selects. */
export const MODE_OPTIONS = ["basic", "advanced"] as const;
export const SETTING_OPTIONS = ["soft", "full"] as const;

/** The opinions of one Aspect, per party — the input `gapKindsOf` wants, keyed by Aspect. */
export interface AspectOpinions {
  readonly itemId: string;
  readonly initiator: Opinions;
  readonly counterparty: Opinions;
}

/**
 * The Gaps of one instance, from the opinions of its two parties.
 *
 * An Aspect either party did not answer is **absent**, not zero: a complete instance has every
 * pair, so absence here means the rows are not what `complete` claimed, and a Gap invented for
 * it would be the "aligned about a question nobody asked" defect `gapKindsOf` avoids.
 */
export function aspectGapsOf(pairs: readonly AspectOpinions[]): readonly AspectGaps[] {
  return pairs.map((pair) => ({
    itemId: pair.itemId,
    gaps: gapKindsOf(pair.initiator, pair.counterparty),
  }));
}
