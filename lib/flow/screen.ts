/**
 * Rows + a viewer → what one party's screen may draw (#146).
 *
 * This is the blind rule made into a data shape. The store reads **only** the opinions the
 * viewer is allowed to see (`visibleRoles()`), and this projection never asks for another
 * party's answers to fill in a column: during the review window `aspects[].own` is the
 * viewer's own score and there is no field that could carry anybody else's. The report —
 * the only screen with Gaps on it — exists in this shape only when the status is
 * `complete`, which since #R2 means both parties have answered every Aspect **and both have
 * accepted** the session; it is built from the same `assessmentInstanceFromRows()` every other
 * read uses, so the Gap is `gapOf()` over two rows rather than a number this module made up.
 *
 * Pure: rows in, view model out. `tests/flow-screen.test.ts` drives it with hand-built
 * rows, including the two-answer arithmetic (Feel 2 against Feel 5 is a Gap of 3) and the
 * blind state (no report, no counterparty score, whatever the markup is asked for).
 */
import {
  zAlignmentSetting,
  zAssessmentMode,
  zOpinions,
  type AlignmentSetting,
  type Assessment,
  type AssessmentMode,
  type Opinions,
  type PartyRole,
} from "@/content/assessment";
import type { Score } from "@/content/record";
import { SCORE_MAX, SCORE_MIN } from "@/content/record";
import type { AssessmentReport } from "@/lib/assessment-report";
import { assessmentReport } from "@/lib/assessment-report";
import type { InviteDisplayState } from "@/lib/flow/invite-state";
import type { Membership } from "@/lib/relationship/membership";
import {
  assessmentInstanceFromRows,
  isoInstantOf,
  orderedItems,
  type InstanceRow,
  type ItemRow,
  type OpinionRow,
  type OptionRow,
  type PartyRow,
  type RecordRow,
} from "@/lib/db/rows";
import {
  instanceStatusOf,
  waitingOn,
  type InstanceProgress,
  type InstanceStatus,
} from "@/lib/flow/state";

/** One Aspect as the answer form asks it: the words, the band's ends, the viewer's answer. */
export interface FlowAspect {
  readonly itemId: string;
  readonly prompt: string;
  /** Notch 1 — the Left Value. */
  readonly leftValue: string;
  /** Notch 5 — the Right Value. */
  readonly rightValue: string;
  readonly min: Score;
  readonly max: Score;
  /** The viewer's own answer, or `null` while this Aspect is unanswered by them. */
  readonly own: Opinions | null;
}

/** The invitation, as the Initiator's screen may show it. */
export interface FlowInvite {
  readonly email: string;
  readonly counterpartyName: string;
  /**
   * **When** the invitation stops accepting a claim — the row's `expires_at`, as an ISO instant.
   *
   * A string rather than a `Date` because this is a view model: the screen formats it with the
   * repo's UTC formatter (`formatDate`) and never re-derives a date from it, so the value that
   * crosses into the markup is the one Postgres handed back (#266).
   */
  readonly expiresAt: string;
  /**
   * **Which** of the three states the invitation is in, derived at read time by
   * `inviteStateOf()` — `unclaimed`, `expired` or `claimed` (#266).
   *
   * Not a column and not a boolean: the Initiator's screen has to tell "not claimed yet" from
   * "expired" from "claimed", and a `claimed` flag could only ever answer the third. It lives
   * beside `expiresAt` and not instead of it, because the sentence names the date.
   */
  readonly state: InviteDisplayState;
  /**
   * `resent_at` as an ISO instant, or `null` when the live token is the original (#275).
   *
   * Carried for the panel's "sent N times" sentence and for anything that later wants to draw the
   * cooldown's remaining time. Nothing on this screen decides a refusal from it: the cooldown is
   * enforced inside the store's transaction, where the write would happen.
   */
  readonly resentAt: string | null;
  /**
   * How many lifetime re-invites this invitation has seen (`resent_count`), drawn against
   * `RESEND_LIFETIME_CAP` so the cap is a visible budget rather than a surprise refusal.
   */
  readonly resentCount: number;
  /** The link, once: while the invite is unclaimed, live and the caller holds the raw token. */
  readonly link: string | null;
}

/**
 * One seat as the accept screen draws it (#R2).
 *
 * Three facts and no score: who the seat is, how many Aspects they have answered (**a count**,
 * never the values), and when they accepted. The acceptance instant is an ISO string or `null`
 * for "not yet" — the same absence `FlowInvite.expiresAt` carries, and the page formats it with
 * the repo's UTC formatter rather than re-deriving a date.
 */
export interface FlowSeat {
  readonly role: PartyRole;
  readonly name: string;
  readonly answered: number;
  readonly acceptedAt: string | null;
  /**
   * `party.impersonated_by IS NOT NULL` (#503): an operator recorded this seat's acceptance on the
   * party's behalf, through `instance.force-close`. A **flag**, not the operator's id — the report
   * says the acceptance was not the party's own, and who took it is the audit row's business.
   *
   * Optional so the screen fixtures written before the console could act stay valid; absent is
   * `false`, the same shape `FlowInstanceRows.voided` uses, and the production read always
   * supplies it.
   */
  readonly impersonated?: boolean;
}

export interface FlowScreen {
  readonly instanceRecordId: string;
  readonly slug: string;
  /** The template's words: an instance is a copy, and its title is the template's. */
  readonly title: string;
  readonly summary: string;
  readonly status: InstanceStatus;
  /**
   * The mode this instance was played in — the same value the report carries, so the screen
   * can name it and the answer sheet can ask exactly the kinds it defines. Parsed from the
   * row (`zAssessmentMode.parse`): a value the model rejects is drift, never a default.
   */
  readonly mode: AssessmentMode;
  /**
   * The Setting the instance is read through (#259): `soft` or `full`. Parsed from the row
   * (`zAlignmentSetting.parse`), so a value the model rejects is drift and never a default.
   *
   * Carried on the screen because the accept page names it in its "what you are accepting" band —
   * a party accepts the Setting as well as the Mode, and the report's limits are a function of it.
   */
  readonly setting: AlignmentSetting;
  /**
   * Who is reading. `role` is the seat this request answers as, **or `coach`** — the invited,
   * read-only membership role (`lib/flow/membership.ts`). A coach has no party row, so `name` is
   * the empty string and the view renders the coach's own band instead of a party name.
   */
  readonly viewer: { readonly role: PartyRole | "coach"; readonly name: string };
  readonly aspects: readonly FlowAspect[];
  readonly initiatorName: string;
  readonly counterpartyName: string | null;
  /** Both seats, the Initiator first — the accept screen's two panels, one row each. */
  readonly seats: readonly FlowSeat[];
  /**
   * The viewer's own seat facts (#R2). A coach has answered nothing and accepted nothing, so both
   * are the absence: `false` and `0`, never a guess at a party's row.
   */
  readonly viewerAnswered: number;
  readonly viewerAccepted: boolean;
  /** Who has not finished. Before the claim that is the Counterparty, every time. */
  readonly waiting: readonly PartyRole[];
  readonly invite: FlowInvite | null;
  /**
   * The report, present **only** when both parties have accepted — the acceptance is the
   * completion hinge (#R2), so the submission that fills the last sheet is not enough. Its absence
   * is the blind state: there is no partial report, no greyed-out column, no "hidden" scores in
   * the markup — a screen that cannot be drawn cannot leak.
   */
  readonly report: AssessmentReport | null;
  /**
   * #533 phase 3 — the membership that pays for this relationship, or `null` when the session
   * names no relationship. `lapsed` is the read-only state: both parties keep reading and neither
   * writes, and the sentence says it was the initiator's membership that ended.
   */
  readonly membership?: Membership | null;
}

export interface FlowInstanceRows {
  readonly record: RecordRow;
  readonly items: readonly ItemRow[];
  readonly options: readonly OptionRow[];
  readonly instance: InstanceRow;
  readonly parties: readonly PartyRow[];
  /** Only the roles `visibleRoles()` allowed. Never the other party's, before `complete`. */
  readonly opinions: readonly OpinionRow[];
  /** Row counts per role — arithmetic on the count, never on the scores. */
  readonly answerCounts: Readonly<Record<PartyRole, number>>;
  /**
   * `session.voided_at IS NOT NULL` (#503). Optional so the fixtures written before the console
   * could act stay valid; absent is `false`, and the production read always supplies it.
   */
  readonly voided?: boolean;
}

export interface ProjectInput {
  readonly rows: FlowInstanceRows;
  readonly template: Assessment;
  readonly viewerRole: PartyRole | "coach";
  readonly invite: FlowInvite | null;
  /**
   * #533 phase 3 — whether the membership paying for this relationship is still running, or
   * `null` for a session that names no relationship. Optional so a projection written before the
   * field existed (a test fixture, the `/v1` prototype's own screen) still type-checks: absent is
   * "nothing known", which renders as no band rather than as a lapse.
   */
  readonly membership?: Membership | null;
}

/** The party row for a role, or `undefined` — the caller's "not your instance" branch. */
export function partyIn(
  parties: readonly PartyRow[],
  role: PartyRole | "coach",
): PartyRow | undefined {
  return parties.find((party) => party.role === role);
}

/** The progress counts the status is derived from. */
export function progressOf(rows: FlowInstanceRows): InstanceProgress {
  return {
    aspectCount: rows.items.length,
    hasCounterparty: partyIn(rows.parties, "counterparty") !== undefined,
    initiatorAnswered: rows.answerCounts.initiator,
    counterpartyAnswered: rows.answerCounts.counterparty,
    // The hinge (#R2): a count of the seats whose `accepted_at` is set, read off the same party
    // rows the names come from. `1`/`0` and never a boolean, so `instanceStatusOf()` treats the
    // two shapes the same way.
    initiatorAccepted: acceptedCountIn(rows.parties, "initiator"),
    counterpartyAccepted: acceptedCountIn(rows.parties, "counterparty"),
    // #503 — the one input that is not a count, read from the session row the caller bundled.
    voided: rows.voided === true,
  };
}

/** `1` when the seat's `accepted_at` is set, `0` for a seat that has not accepted (or is absent). */
function acceptedCountIn(parties: readonly PartyRow[], role: PartyRole): number {
  const party = partyIn(parties, role);
  return party?.accepted_at === null || party?.accepted_at === undefined ? 0 : 1;
}

/** `party.accepted_at` as the model's UTC instant, or `null` — the accept screen's one date. */
function acceptedAtOf(party: PartyRow | undefined): string | null {
  if (party?.accepted_at === null || party?.accepted_at === undefined) return null;
  return isoInstantOf(party.accepted_at);
}

/**
 * The viewer's own answer on one Aspect.
 *
 * A row that does not satisfy `zScore` is dropped rather than rendered: the DB CHECK
 * already refuses one, so this is the same "a row the model rejects is drift" rule the
 * read path applies — except that a partial sheet is *normal* here, so "no row" is
 * `null` and not an error.
 */
function ownOpinion(
  rows: FlowInstanceRows,
  role: PartyRole | "coach",
  itemId: string,
): Opinions | null {
  const row = rows.opinions.find((opinion) => opinion.role === role && opinion.item_id === itemId);
  if (row === undefined) return null;
  const parsed = zOpinions.safeParse({
    feel: row.feel,
    wish: row.wish,
    ...(row.think === null ? {} : { think: row.think }),
    ...(row.guess === null ? {} : { guess: row.guess }),
  });
  return parsed.success ? parsed.data : null;
}

/** Project one instance for one viewer. */
export function projectScreen(input: ProjectInput): FlowScreen {
  const { rows, template, viewerRole, invite } = input;
  const viewerRow = partyIn(rows.parties, viewerRole);
  if (viewerRole !== "coach" && viewerRow === undefined) {
    throw new Error(
      `instance "${rows.record.slug}" has no ${viewerRole} party — there is no screen to project`,
    );
  }

  const progress = progressOf(rows);
  const status = instanceStatusOf(progress);

  // The report is built from the same rows the read path always builds from, and only when
  // every party has answered every Aspect — `zAssessmentInstance` would reject a partial
  // sheet, which is the second half of the blind rule: a report of unfinished answers is
  // not a report, it is a leak with extra steps. A coach reaches this the same way a party
  // does: the report exists only once the status is `complete`.
  const report =
    status === "complete"
      ? assessmentReport(
          assessmentInstanceFromRows({
            record: rows.record,
            items: rows.items,
            options: rows.options,
            instance: rows.instance,
            parties: rows.parties,
            opinions: rows.opinions,
          }),
          template,
        )
      : null;

  return {
    instanceRecordId: rows.record.id,
    slug: rows.record.slug,
    title: template.title,
    summary: template.summary,
    status,
    mode: zAssessmentMode.parse(rows.instance.mode),
    setting: zAlignmentSetting.parse(rows.instance.setting),
    // A coach has no party row, so their name is the empty string and the view renders the
    // coach's own band (`viewer` copy id) rather than a party name.
    viewer: { role: viewerRole, name: viewerRole === "coach" ? "" : (viewerRow?.name ?? "") },
    aspects: orderedItems(rows.items).map((item) => ({
      itemId: item.item_id,
      prompt: item.prompt,
      leftValue: item.left_value ?? "",
      rightValue: item.right_value ?? "",
      // The schema's constants, not a column: `zScoreScale` is 1..5 and the table stores no
      // min/max (`lib/db/rows.ts` says the same thing on the read side).
      min: SCORE_MIN,
      max: SCORE_MAX,
      own: ownOpinion(rows, viewerRole, item.item_id),
    })),
    initiatorName: partyIn(rows.parties, "initiator")?.name ?? "",
    counterpartyName: partyIn(rows.parties, "counterparty")?.name ?? null,
    // The two seats as rows, Initiator first (the glossary's order). A missing Counterparty is
    // simply absent — there is no seat panel for a person who has not claimed the invitation.
    seats: (["initiator", "counterparty"] as const)
      .map((role): FlowSeat | undefined => {
        const party = partyIn(rows.parties, role);
        if (party === undefined) return undefined;
        return {
          role,
          name: party.name,
          answered: rows.answerCounts[role],
          acceptedAt: acceptedAtOf(party),
          // #503 — an acceptance an operator wrote on this seat's behalf. The row carries the
          // operator's id; the screen carries only whether the acceptance was the party's own.
          impersonated: party.impersonated_by != null,
        } satisfies FlowSeat;
      })
      .filter((seat): seat is FlowSeat => seat !== undefined),
    viewerAnswered: viewerRole === "coach" ? 0 : (rows.answerCounts[viewerRole] ?? 0),
    viewerAccepted: viewerRole !== "coach" && acceptedCountIn(rows.parties, viewerRole) === 1,
    waiting: waitingOn(progress, partyIn(rows.parties, "initiator") !== undefined),
    invite,
    membership: input.membership ?? null,
    report,
  };
}
