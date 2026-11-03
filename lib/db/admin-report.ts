/**
 * The report screen's reads (#504) — the console's half of the deliverable a customer pays for.
 *
 * Three reads, and each exists because a different question is being asked:
 *
 *   `readReportSource()`     is there a report for this instance, and if so what does it say?
 *   `readPartySubmission()`  what did one seat actually answer? — the PII read behind the gate
 *   `statusOfRow()`          the completeness answer on its own, so `act()` can refuse a
 *                            regeneration of an instance that has nothing to regenerate
 *
 * **Why the status is read before the model.** `lib/db/rows.ts` parses a whole instance through
 * `zAssessmentInstance`, and that schema requires **both** parties to answer **every** Aspect —
 * which is exactly right for a report and exactly wrong for a screen that has to say "there is no
 * report yet". A session with one seat still answering would throw through the parse, so the
 * status is decided from counts in SQL first, and the model is built only for an instance that is
 * `complete`. That is the same order `lib/flow/state.ts` states: completeness is derived from the
 * rows, and nothing is drawn from a partial one.
 *
 * **The report's numbers are the projection's, never this module's.** `assessmentReport()` is
 * the one function that turns two records into a report, and the party's own screen
 * (`/assessment/[slug]`) calls it too — so an operator's export and a party's screen can never
 * disagree about a Gap. This module adds no arithmetic, and in particular no total, no score and
 * no average: `docs/specs/ux-report.md` bans a composite, and `lib/admin/gap-aggregates.ts`
 * states the same ban for the population screen.
 *
 * **The instant is the fixture clock, not a wall clock** (`content/core.ts::DEMO_NOW_ISO`), for
 * the reason `lib/report/document.ts` records: a report that named `new Date()` would be a clock
 * read in a render path and could not be byte-identical twice.
 *
 * Reads through `queryRows` (`lib/db/client.ts`) for the pool, and through a replaceable
 * `ScreenReaders` seam when `act()` needs the same read inside its transaction — so the report a
 * regeneration hashes is the report the transaction read, not a second read afterwards.
 */
import type { Assessment, AssessmentInstance, PartyRole } from "@/content/assessment";
import { instanceStatusOf, type InstanceProgress, type InstanceStatus } from "@/lib/flow/state";
import type { AssessmentReport } from "@/lib/assessment-report";
import { assessmentReport } from "@/lib/assessment-report";
import {
  POOL_SCREEN_READERS,
  readAssessmentScreenByRecordId,
  type ScreenReaders,
} from "@/lib/db/assessments";

/**
 * Why an instance has no report to draw.
 *
 *   not-complete      a seat is still answering, or an acceptance is missing (#R2)
 *   voided            an operator ended the session; the rows are intact, the deliverable is not
 *   template-missing  the copy's `template_record_id` no longer resolves — `db:verify` drift
 */
export type ReportUnavailableReason = "not-complete" | "voided" | "template-missing";

/** Everything the report screen, the export and the regeneration need, in one read. */
export interface ReportSource {
  readonly instanceRecordId: string;
  readonly status: InstanceStatus;
  /** Aspects in the instance's copy — 0 is a broken instance and never `complete`. */
  readonly aspects: number;
  readonly voidedAt: string | null;
  /** The records and their projection, or `null` when the instance is not reportable. */
  readonly document: {
    readonly instance: AssessmentInstance;
    readonly template: Assessment;
    readonly report: AssessmentReport;
  } | null;
  readonly unavailable: ReportUnavailableReason | null;
}

/** One Aspect of one seat's raw submission: the question, its ends, and what that seat answered. */
export interface SubmissionAnswer {
  readonly item_id: string;
  readonly prompt: string;
  readonly left_value: string;
  readonly right_value: string;
  readonly feel: number;
  readonly wish: number;
  readonly think: number | null;
  readonly guess: number | null;
}

/**
 * One seat's submission, as the PII read answers it.
 *
 * This is the shape the epic's second invariant is about: a name, an instant and four scores per
 * Aspect. It is read only by a caller that has already recorded the read (`lib/admin/report-ops.ts`
 * writes the `read_submission` row in the same transaction), and no other screen in this tree
 * selects it.
 */
export interface PartySubmission {
  readonly instanceRecordId: string;
  readonly role: PartyRole;
  readonly name: string;
  readonly submittedAt: string | null;
  readonly acceptedAt: string | null;
  readonly answers: readonly SubmissionAnswer[];
}

/**
 * The completeness answer, from counts — one statement, no model parse.
 *
 * `aspects` is counted off `item`, the two answered counts off `opinion`, and the two acceptances
 * off `party.accepted_at`; `instanceStatusOf()` then decides, which is the same function every
 * other surface asks (`lib/flow/state.ts`). A `session` row that does not exist answers no rows
 * and the caller reports "no such instance".
 */
const STATUS_SQL = `
  SELECT
    ai.voided_at,
    (SELECT count(*) FROM item i WHERE i.record_id = ai.record_id)::int AS aspects,
    EXISTS (SELECT 1 FROM party p
             WHERE p.session_record_id = ai.record_id AND p.role = 'initiator') AS has_initiator,
    EXISTS (SELECT 1 FROM party p
             WHERE p.session_record_id = ai.record_id AND p.role = 'counterparty') AS has_counterparty,
    COALESCE((SELECT count(*) FROM opinion o
               WHERE o.session_record_id = ai.record_id AND o.role = 'initiator'), 0)::int
      AS initiator_answered,
    COALESCE((SELECT count(*) FROM opinion o
               WHERE o.session_record_id = ai.record_id AND o.role = 'counterparty'), 0)::int
      AS counterparty_answered,
    COALESCE((SELECT count(*) FROM party p
               WHERE p.session_record_id = ai.record_id AND p.role = 'initiator'
                 AND p.accepted_at IS NOT NULL), 0)::int AS initiator_accepted,
    COALESCE((SELECT count(*) FROM party p
               WHERE p.session_record_id = ai.record_id AND p.role = 'counterparty'
                 AND p.accepted_at IS NOT NULL), 0)::int AS counterparty_accepted
  FROM session ai
  WHERE ai.record_id = $1
`;

/** One seat's answers on every Aspect, in the copy's own order. */
const SUBMISSION_SQL = `
  SELECT
    p.name                          AS name,
    p.submitted_at                  AS submitted_at,
    p.accepted_at                   AS accepted_at,
    COALESCE(json_agg(json_build_object(
      'item_id', i.item_id,
      'prompt', i.prompt,
      'left_value', i.left_value,
      'right_value', i.right_value,
      'feel', o.feel,
      'wish', o.wish,
      'think', o.think,
      'guess', o.guess
    ) ORDER BY i.position) FILTER (WHERE i.item_id IS NOT NULL), '[]'::json) AS answers
  FROM party p
  LEFT JOIN item i ON i.record_id = p.session_record_id
  LEFT JOIN opinion o ON o.session_record_id = p.session_record_id
                     AND o.role = p.role AND o.item_id = i.item_id
  WHERE p.session_record_id = $1 AND p.role = $2
  GROUP BY p.name, p.submitted_at, p.accepted_at
`;

interface StatusRow {
  readonly voided_at: string | Date | null;
  readonly aspects: number;
  readonly has_initiator: boolean;
  readonly has_counterparty: boolean;
  readonly initiator_answered: number;
  readonly counterparty_answered: number;
  readonly initiator_accepted: number;
  readonly counterparty_accepted: number;
}

interface SubmissionRow {
  readonly name: string;
  readonly submitted_at: string | Date | null;
  readonly accepted_at: string | Date | null;
  readonly answers: readonly {
    readonly item_id: string;
    readonly prompt: string;
    readonly left_value: string | null;
    readonly right_value: string | null;
    readonly feel: number | null;
    readonly wish: number | null;
    readonly think: number | null;
    readonly guess: number | null;
  }[];
}

/** ISO or null — the report's own instants are ISO strings, never a live `Date`. */
function isoOf(value: string | Date | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

/**
 * The status and the counts, on their own.
 *
 * `act()`'s regeneration asks this inside its transaction so a refusal costs no audit row: an
 * instance that is not complete has nothing to regenerate, and recording "regenerated" over it
 * would be the log inventing work.
 */
export async function readReportStatus(
  instanceRecordId: string,
  readers: ScreenReaders = POOL_SCREEN_READERS,
): Promise<
  | {
      readonly status: InstanceStatus;
      readonly progress: InstanceProgress;
      readonly voidedAt: string | null;
    }
  | undefined
> {
  const [row] = await readers.rowsOf<StatusRow>(STATUS_SQL, [instanceRecordId]);
  if (row === undefined) return undefined;

  const progress: InstanceProgress = {
    aspectCount: Number(row.aspects),
    hasCounterparty: row.has_counterparty === true,
    initiatorAnswered: Number(row.initiator_answered),
    counterpartyAnswered: Number(row.counterparty_answered),
    initiatorAccepted: Number(row.initiator_accepted),
    counterpartyAccepted: Number(row.counterparty_accepted),
    voided: row.voided_at !== null,
  };

  return {
    status: instanceStatusOf(progress),
    progress,
    voidedAt: isoOf(row.voided_at),
  };
}

/**
 * Everything the report screen needs, or `undefined` when the id names no session.
 *
 * Two statements for a complete instance (the status, then the records); one for an incomplete
 * one, because there is nothing else to read. Both go through the same `readers`, so a caller
 * inside a transaction reads one snapshot.
 */
export async function readReportSource(
  instanceRecordId: string,
  readers: ScreenReaders = POOL_SCREEN_READERS,
): Promise<ReportSource | undefined> {
  const status = await readReportStatus(instanceRecordId, readers);
  if (status === undefined) return undefined;

  const base = {
    instanceRecordId,
    status: status.status,
    aspects: status.progress.aspectCount,
    voidedAt: status.voidedAt,
  };

  if (status.status === "voided") {
    return { ...base, document: null, unavailable: "voided" };
  }
  if (status.status !== "complete") {
    return { ...base, document: null, unavailable: "not-complete" };
  }

  const screen = await readAssessmentScreenByRecordId(instanceRecordId, readers);
  if (screen === undefined) {
    // The copy is complete but names a template that no longer resolves: `db:verify` drift, and
    // there is no title to draw a report under.
    return { ...base, document: null, unavailable: "template-missing" };
  }

  return {
    ...base,
    document: {
      instance: screen.instance,
      template: screen.template,
      report: assessmentReport(screen.instance, screen.template),
    },
    unavailable: null,
  };
}

/**
 * One seat's raw submission — the PII read.
 *
 * **Called only from inside an audit write.** `lib/admin/report-ops.ts` is the one caller: it
 * opens `act()`, records `read_submission` and hands this function the transaction's own
 * readers, so the read cannot happen without the row and the row cannot describe a read that did
 * not. Nothing else in the tree selects these columns — the row has a name in it, which is why
 * `lib/db/admin-relationship.ts` reads counts and never opinions.
 *
 * `undefined` means the seat is not on the relationship; `answers` is per Aspect and can be
 * empty on a seat that has not started (an `opinion` row per Aspect is written as each is
 * answered, so an unstarted seat has none).
 */
export async function readPartySubmission(
  instanceRecordId: string,
  role: PartyRole,
  readers: ScreenReaders = POOL_SCREEN_READERS,
): Promise<PartySubmission | undefined> {
  const [row] = await readers.rowsOf<SubmissionRow>(SUBMISSION_SQL, [instanceRecordId, role]);
  if (row === undefined) return undefined;

  return {
    instanceRecordId,
    role,
    name: row.name,
    submittedAt: isoOf(row.submitted_at),
    acceptedAt: isoOf(row.accepted_at),
    answers: row.answers
      // An Aspect nobody answered contributes `null` scores and is left out: a score of 0 would
      // be a fact nobody wrote, and the seat's own screen shows the unanswered Aspect instead.
      .filter((answer) => answer.feel !== null && answer.wish !== null)
      .map((answer) => ({
        item_id: answer.item_id,
        prompt: answer.prompt,
        left_value: answer.left_value ?? "",
        right_value: answer.right_value ?? "",
        feel: Number(answer.feel),
        wish: Number(answer.wish),
        think: answer.think === null ? null : Number(answer.think),
        guess: answer.guess === null ? null : Number(answer.guess),
      })),
  };
}
