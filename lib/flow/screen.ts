/**
 * Rows + a viewer → what one party's screen may draw (#146).
 *
 * This is the blind rule made into a data shape. The store reads **only** the opinions the
 * viewer is allowed to see (`visibleRoles()`), and this projection never asks for another
 * party's answers to fill in a column: before both parties submit, `aspects[].own` is the
 * viewer's own score and there is no field that could carry anybody else's. The report —
 * the only screen with Gaps on it — exists in this shape only when the status is
 * `complete`, and it is built from the same `assessmentInstanceFromRows()` every other read
 * uses, so the Gap is `gapOf()` over two rows rather than a number this module made up.
 *
 * Pure: rows in, view model out. `tests/flow-screen.test.ts` drives it with hand-built
 * rows, including the two-answer arithmetic (Feel 2 against Feel 5 is a Gap of 3) and the
 * blind state (no report, no counterparty score, whatever the markup is asked for).
 */
import { zOpinions, type Assessment, type Opinions, type PartyRole } from "@/content/assessment";
import type { Score } from "@/content/record";
import { SCORE_MAX, SCORE_MIN } from "@/content/record";
import type { AssessmentReport } from "@/lib/assessment-report";
import { assessmentReport } from "@/lib/assessment-report";
import {
  assessmentInstanceFromRows,
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
  readonly claimed: boolean;
  /** The link, once: while the invite is unclaimed and the caller holds the raw token. */
  readonly link: string | null;
}

export interface FlowScreen {
  readonly instanceRecordId: string;
  readonly slug: string;
  /** The template's words: an instance is a copy, and its title is the template's. */
  readonly title: string;
  readonly summary: string;
  readonly status: InstanceStatus;
  readonly viewer: { readonly role: PartyRole; readonly name: string };
  readonly aspects: readonly FlowAspect[];
  readonly initiatorName: string;
  readonly counterpartyName: string | null;
  /** Who has not finished. Before the claim that is the Counterparty, every time. */
  readonly waiting: readonly PartyRole[];
  readonly invite: FlowInvite | null;
  /**
   * The report, present **only** when both parties have submitted. Its absence is the
   * blind state: there is no partial report, no greyed-out column, no "hidden" scores in
   * the markup — a screen that cannot be drawn cannot leak.
   */
  readonly report: AssessmentReport | null;
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
}

export interface ProjectInput {
  readonly rows: FlowInstanceRows;
  readonly template: Assessment;
  readonly viewerRole: PartyRole;
  readonly invite: FlowInvite | null;
}

/** The party row for a role, or `undefined` — the caller's "not your instance" branch. */
export function partyIn(parties: readonly PartyRow[], role: PartyRole): PartyRow | undefined {
  return parties.find((party) => party.role === role);
}

/** The progress counts the status is derived from. */
export function progressOf(rows: FlowInstanceRows): InstanceProgress {
  return {
    aspectCount: rows.items.length,
    hasCounterparty: partyIn(rows.parties, "counterparty") !== undefined,
    initiatorAnswered: rows.answerCounts.initiator,
    counterpartyAnswered: rows.answerCounts.counterparty,
  };
}

/**
 * The viewer's own answer on one Aspect.
 *
 * A row that does not satisfy `zScore` is dropped rather than rendered: the DB CHECK
 * already refuses one, so this is the same "a row the model rejects is drift" rule the
 * read path applies — except that a partial sheet is *normal* here, so "no row" is
 * `null` and not an error.
 */
function ownOpinion(rows: FlowInstanceRows, role: PartyRole, itemId: string): Opinions | null {
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
  if (viewerRow === undefined) {
    throw new Error(
      `instance "${rows.record.slug}" has no ${viewerRole} party — there is no screen to project`,
    );
  }

  const progress = progressOf(rows);
  const status = instanceStatusOf(progress);

  // The report is built from the same rows the read path always builds from, and only when
  // every party has answered every Aspect — `zAssessmentInstance` would reject a partial
  // sheet, which is the second half of the blind rule: a report of unfinished answers is
  // not a report, it is a leak with extra steps.
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
    viewer: { role: viewerRole, name: viewerRow.name },
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
    waiting: waitingOn(progress, partyIn(rows.parties, "initiator") !== undefined),
    invite,
    report,
  };
}
