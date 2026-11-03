/**
 * The three report operations an operator may take, each one audited (#504, epic #500).
 *
 *   regenerateReport()  re-derive a complete instance's report and record why it was reissued
 *   readSubmission()    read one seat's raw answers behind the PII gate, recording the read
 *   exportReport()      the same read as a whole report, also recorded, answering the document
 *
 * **Every one of them goes through `act()`**, for the reason `lib/admin/relationship-ops.ts`
 * gives: one transaction, the actor's rung read inside it `FOR SHARE`, the audit row written last.
 * There is no `query()` in this file and no second write path, so a refusal leaves neither a row
 * nor an audit entry and a failure cannot be half-recorded.
 *
 * **`read_submission` is the action name the epic fixes** (`lib/admin/roles.ts` records why it is
 * the one name in the catalogue that is not `<subject>.<verb>`): the log is filterable on
 * `action`, and an operator asking "did anybody look at this pair's answers" is asking for that
 * string. A read is `support`'s; a regeneration is `admin`'s.
 *
 * **The read and the row are one transaction.** `act()` hands the mutation a connection, and the
 * mutation builds a `ScreenReaders` over it (`readersOn`) — so the rows the report is derived
 * from, the bytes that are hashed, and the audit row that describes them are one snapshot. The
 * alternative (read here, hash there) would let an export describe a report nobody read.
 *
 * **What the audits may not carry.** A regeneration's before/after are digests, the template
 * version, the instant and counts — never the report itself: `admin_action` is a table that only
 * grows and is read by `/admin/audit`, and a whole report in it would be the PII the gate exists
 * to keep out of a list. A submission read's `after` is the seat, the Aspect count and the
 * template version, for the same reason: the log says *that* it happened, and the data lives at
 * the screen that asked for it.
 *
 * **`generated_at` is the fixture clock** (`content/core.ts::DEMO_NOW_ISO`), never `new Date()`.
 * That is what makes two regenerations byte-identical (the card's `sha256sum` acceptance) and it
 * is why this module can hash the JSON with no clock in the path at all.
 */
import { createHash } from "node:crypto";

import type { PartyRole } from "@/content/assessment";
import { DEMO_NOW_ISO } from "@/content/core";
import { act, type ActResult, type ActSql, type ActTransactionRunner } from "@/lib/admin/act";
import type { AdminAction } from "@/lib/admin/roles";
import {
  readPartySubmission,
  readReportSource,
  type PartySubmission,
  type ReportSource,
} from "@/lib/db/admin-report";
import { POOL_SCREEN_READERS, type ScreenReaders } from "@/lib/db/assessments";
import { reportDocument, reportJson, type ReportDocument } from "@/lib/report/document";

/* ------------------------------------------------------------------ *
 * Refusals
 * ------------------------------------------------------------------ */

/**
 * Why a report operation was refused — every value is a fact about the rows, not a permission.
 *
 * Permissions are `act()`'s (`ActRefused`), and a bad reason is `act()`'s too. These are the
 * cases where the operator asked for something the row cannot do: a session that does not exist,
 * one that is not complete (so there is no report), one an operator ended, or a copy whose
 * template no longer resolves.
 */
export const REPORT_OP_REFUSALS = [
  "no-such-instance",
  "not-complete",
  "voided",
  "template-missing",
  "no-such-party",
] as const;

export type ReportOpRefusal = (typeof REPORT_OP_REFUSALS)[number];

/** A refused operation: nothing ran, nothing was written, no audit row exists. */
export class ReportOpRefused extends Error {
  readonly reason: ReportOpRefusal;

  constructor(reason: ReportOpRefusal, message: string) {
    super(message);
    this.name = "ReportOpRefused";
    this.reason = reason;
  }
}

/** Why an instance has no report, as the refusal code a screen has a sentence for. */
function refusalFor(source: ReportSource): ReportOpRefusal {
  switch (source.unavailable) {
    case "voided":
      return "voided";
    case "template-missing":
      return "template-missing";
    default:
      return "not-complete";
  }
}

/* ------------------------------------------------------------------ *
 * The request and the seams
 * ------------------------------------------------------------------ */

/** What an operator is doing, and why. `actorUserId` comes from the session, never from a body. */
export interface ReportOpRequest {
  readonly actorUserId: string;
  readonly instanceRecordId: string;
  readonly reason: string;
}

/**
 * What a test replaces.
 *
 * `runner` is `act()`'s transaction seam — a fake connection proves the statement order and the
 * rollback with no database. `readers` is the read seam for the reads *after* the commit (the
 * instant the banner prints); inside `act()` the transaction's own readers are used, so a test
 * that only drives the operation needs neither.
 */
export interface ReportOpDeps {
  readonly runner?: ActTransactionRunner;
  readonly readers?: ScreenReaders;
  /** `package.json`'s version, as `next.config.mjs` inlines it. A test passes its own. */
  readonly templateVersion?: string;
}

/** `act()`'s connection as the read seam — the same statement, on the transaction's snapshot. */
function readersOn(sql: ActSql): ScreenReaders {
  return {
    rowsOf: async <R>(text: string, values: readonly unknown[]) => {
      const result = await sql.query<R>(text, values);
      return result.rows;
    },
  };
}

/** The version the document names. `process.env.APP_VERSION` is inlined by `next.config.mjs`. */
function templateVersionOf(deps: ReportOpDeps): string {
  return deps.templateVersion ?? process.env.APP_VERSION ?? "unknown";
}

/** The digest the audit row carries — of the exact bytes the export writes. */
export function sha256Of(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/**
 * The previous regeneration's digest for this instance, or `null`.
 *
 * Read inside the transaction so the audit row can say what this reissue replaced. It is a read
 * of `admin_action` — the one table this epic is allowed to grow — and it is what makes "the same
 * instance regenerated twice hashes the same" visible in the log rather than only in a test.
 */
const LAST_REGENERATION_SQL = `
  SELECT after->>'json_sha256' AS json_sha256
    FROM admin_action
   WHERE action = 'report.regenerate'
     AND target_table = 'session'
     AND target_id = $1
   ORDER BY created_at DESC
   LIMIT 1
`;

/** The audit row's own payload for a regeneration — digests and counts, never the report itself. */
interface RegenerationAudit {
  readonly json_sha256: string;
  readonly template_version: string;
  readonly generated_at: string;
  readonly aspects: number;
  readonly gaps: number;
}

/** One instance's report, regenerated. */
export interface RegeneratedReport extends RegenerationAudit {
  /** The document, so a caller that also wants to show it does not rebuild it. */
  readonly document: ReportDocument;
}

/* ------------------------------------------------------------------ *
 * 1. Regenerate
 * ------------------------------------------------------------------ */

/**
 * Re-derive a complete instance's report and record the reissue.
 *
 * **Idempotent, and the audit row is the only thing that differs.** Regenerating twice produces
 * the same bytes (`sha256` equal) because the report is a pure function of the opinion rows and
 * the instant is the fixture clock; what the second call adds is a second `report.regenerate` row
 * whose `before` is the first row's digest and whose `after` is the same digest again. That pair
 * is the log's own proof of idempotency, and it is why `before` is worth reading at all.
 *
 * **An incomplete instance is refused, not rendered.** `not-complete` (or `voided`, or
 * `template-missing`) comes from `readReportSource()` inside the transaction, so a report is
 * never "regenerated" into a state nobody can draw — and the refusal leaves no audit row.
 */
export async function regenerateReport(
  request: ReportOpRequest,
  deps: ReportOpDeps = {},
): Promise<ActResult<RegeneratedReport>> {
  const templateVersion = templateVersionOf(deps);
  // Captured inside the transaction so the caller gets the exact document that was hashed, never
  // a second build of "the same" report. A box rather than a bare `let`: TypeScript cannot see an
  // assignment made inside the callback, and a `T | null` narrowed to `never` after the await is
  // the wrong kind of confident.
  const captured: { document: ReportDocument | null } = { document: null };

  const result = await act<RegenerationAudit>(
    {
      actorUserId: request.actorUserId,
      action: "report.regenerate",
      target: { table: "session", id: request.instanceRecordId },
      reason: request.reason,
      mutate: async (sql) => {
        const source = await readReportSource(request.instanceRecordId, readersOn(sql));
        if (source === undefined) {
          throw new ReportOpRefused("no-such-instance", "no session has that id");
        }
        if (source.document === null) {
          throw new ReportOpRefused(
            refusalFor(source),
            `that instance has no report to regenerate (${source.unavailable ?? "unknown"})`,
          );
        }

        const document = reportDocument(
          source.document.instance,
          source.document.report,
          templateVersion,
        );
        const jsonSha256 = sha256Of(reportJson(document));
        captured.document = document;

        const previous = await sql.query<{ json_sha256: string | null }>(LAST_REGENERATION_SQL, [
          request.instanceRecordId,
        ]);
        const before = previous.rows[0]?.json_sha256 ?? null;

        return {
          // `null` on the first regeneration is the honest before: there was no earlier digest
          // to replace, where `{}` would claim one.
          before: before === null ? null : { json_sha256: before },
          after: {
            json_sha256: jsonSha256,
            template_version: templateVersion,
            generated_at: document.generated_at,
            aspects: document.report.aspects.length,
            gaps: document.report.gap_count,
          },
        };
      },
    },
    deps.runner,
  );

  if (captured.document === null) {
    // Unreachable: `act()` answers only after the mutation resolved, and the mutation sets this
    // before it returns. Stated rather than cast so a future refactor cannot hand back a report
    // nobody built.
    throw new Error("regenerateReport: the transaction committed without a document");
  }

  return { ...result, after: { ...result.after, document: captured.document } };
}

/* ------------------------------------------------------------------ *
 * 2. Read a party's submission — the PII gate
 * ------------------------------------------------------------------ */

/** One audited submission read: the rows, the audit row, and when it was written. */
export interface ReadSubmissionResult {
  readonly submission: PartySubmission;
  readonly actionId: string;
  /** `admin_action.created_at`, read back after the commit — the instant the banner names. */
  readonly recordedAt: string;
  readonly templateVersion: string;
}

/**
 * The reason a read carries when the caller supplies none.
 *
 * A regeneration has an operator's own words; a read is a click, and the epic requires the read
 * to be recorded rather than to be justified. This sentence is the action's own description, so
 * the row reads as what happened instead of as a blank — and a caller that *does* have something
 * to say (the export route names the format) passes its own.
 */
export const DEFAULT_READ_REASON = "operator opened a party submission from the report screen";

/**
 * Read one seat's raw answers, recording the read in the same transaction.
 *
 * **The gate is `act()`'s.** The action's floor is `support`, read from `user_profile` inside the
 * transaction, so a `member` is refused before a single row is selected — and because the audit
 * insert is the last statement, a refused read writes nothing. That is the acceptance the card
 * states as "a member who guesses the URL gets 404 and nothing is logged for the attempt": the
 * 404 is the caller's (`lib/auth/require-role.ts`), and the *absence of the row* is this.
 */
export async function readSubmission(
  request: ReportOpRequest & { readonly role: PartyRole },
  deps: ReportOpDeps = {},
): Promise<ReadSubmissionResult> {
  const templateVersion = templateVersionOf(deps);
  const captured: { submission: PartySubmission | null } = { submission: null };

  const result = await act<{ role: PartyRole; aspects: number; template_version: string }>(
    {
      actorUserId: request.actorUserId,
      action: "read_submission",
      target: { table: "party", id: `${request.instanceRecordId}:${request.role}` },
      reason: request.reason.trim() === "" ? DEFAULT_READ_REASON : request.reason,
      mutate: async (sql) => {
        const submission = await readPartySubmission(
          request.instanceRecordId,
          request.role,
          readersOn(sql),
        );
        if (submission === undefined) {
          throw new ReportOpRefused(
            "no-such-party",
            `no ${request.role} holds a seat on that instance`,
          );
        }
        captured.submission = submission;

        return {
          // Nothing was here before: a read changes no row, and `null` says so rather than
          // claiming an empty one.
          before: null,
          after: {
            role: request.role,
            aspects: submission.answers.length,
            template_version: templateVersion,
          },
        };
      },
    },
    deps.runner,
  );

  if (captured.submission === null) {
    throw new Error("readSubmission: the transaction committed without a submission");
  }

  return {
    submission: captured.submission,
    actionId: result.actionId,
    recordedAt: await recordedAtOf(result.actionId, deps.readers ?? POOL_SCREEN_READERS),
    templateVersion,
  };
}

/* ------------------------------------------------------------------ *
 * 3. Export — the same read, as a document
 * ------------------------------------------------------------------ */

/** One audited export: the document, its bytes, and the audit row. */
export interface ExportedReport {
  readonly document: ReportDocument;
  /** The bytes as JSON — the PDF is rendered from `document` by the server-only caller. */
  readonly json: string;
  readonly jsonSha256: string;
  readonly actionId: string;
  readonly recordedAt: string;
}

/**
 * Export a report, recording the read of both parties' submissions.
 *
 * `read_submission` is the right action even though this reads *two* seats: the epic's gate is
 * about the party's answers, and a report export carries every one of them. The row's `after`
 * names the format instead of a seat, so the log says which file left the building.
 */
export async function exportReport(
  request: ReportOpRequest & { readonly format: "json" | "pdf" },
  deps: ReportOpDeps = {},
): Promise<ExportedReport> {
  const templateVersion = templateVersionOf(deps);
  const captured: { document: ReportDocument | null; json: string | null } = {
    document: null,
    json: null,
  };

  const result = await act<{ format: string; aspects: number; template_version: string }>(
    {
      actorUserId: request.actorUserId,
      action: "read_submission",
      target: { table: "session", id: request.instanceRecordId },
      reason: request.reason,
      mutate: async (sql) => {
        const source = await readReportSource(request.instanceRecordId, readersOn(sql));
        if (source === undefined) {
          throw new ReportOpRefused("no-such-instance", "no session has that id");
        }
        if (source.document === null) {
          throw new ReportOpRefused(
            refusalFor(source),
            `that instance has no report to export (${source.unavailable ?? "unknown"})`,
          );
        }
        const document = reportDocument(
          source.document.instance,
          source.document.report,
          templateVersion,
        );
        captured.document = document;
        captured.json = reportJson(document);

        return {
          before: null,
          after: {
            format: request.format,
            aspects: document.report.aspects.length,
            template_version: templateVersion,
          },
        };
      },
    },
    deps.runner,
  );

  if (captured.document === null || captured.json === null) {
    throw new Error("exportReport: the transaction committed without a document");
  }

  return {
    document: captured.document,
    json: captured.json,
    jsonSha256: sha256Of(captured.json),
    actionId: result.actionId,
    recordedAt: await recordedAtOf(result.actionId, deps.readers ?? POOL_SCREEN_READERS),
  };
}

/**
 * When the audit row was written, read back from the table it lives in.
 *
 * `act()` answers the row's id and not its `created_at`, and the banner on the screen is owed a
 * real instant. The read is after the commit, so the row is visible; a read that somehow finds
 * nothing answers the fixture clock, because the banner must not print "undefined" — and the
 * fixture clock is the only instant this report names anywhere else.
 */
async function recordedAtOf(actionId: string, readers: ScreenReaders): Promise<string> {
  const [row] = await readers.rowsOf<{ created_at: string | Date }>(
    "SELECT created_at FROM admin_action WHERE id = $1",
    [actionId],
  );
  if (row === undefined) return DEMO_NOW_ISO;
  return row.created_at instanceof Date
    ? row.created_at.toISOString()
    : new Date(row.created_at).toISOString();
}

/** The action names this module writes, exported so a test asserts them by value. */
export const REPORT_ACTIONS: Readonly<Record<"regenerate" | "read", AdminAction>> = {
  regenerate: "report.regenerate",
  read: "read_submission",
};
