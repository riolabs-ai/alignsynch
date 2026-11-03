/**
 * The three report operations (#504), driven through `act()` against a fake connection.
 *
 * What this pins is the half of the card that is a contract rather than a screen:
 *
 *   - **regenerating twice is idempotent, and the log says so.** The two audit rows carry the same
 *     `json_sha256`, and the second row's `before` is the first row's digest — the acceptance is
 *     about bytes, and this is the byte-level claim the log can make.
 *   - **a read is recorded exactly once**, with `action: "read_submission"`, and a `member` who
 *     asks for one gets a refusal with **no** `admin_action` row for the attempt.
 *   - **every operation is one audited write**: `BEGIN → SELECT role → (the reads) → INSERT
 *     admin_action → COMMIT`, with nothing written outside the transaction and nothing written at
 *     all when the operation is refused.
 *   - **an incomplete instance has no report to regenerate**, and the refusal leaves no row.
 *
 * The fake is deliberately not a SQL engine: it answers the statements this code sends, keyed by
 * the fragment that identifies each one, and records everything else. That is enough to prove the
 * order, the payloads and the refusals with no database.
 */
import { describe, expect, test } from "vitest";

import { zAssessmentInstance } from "@/content/assessment";
import type { AssessmentInstance } from "@/content/assessment";
import { assessments, assessmentInstances } from "@/data/assessments";
import { ActRefused, type ActSql } from "@/lib/admin/act";
import {
  REPORT_OP_REFUSALS,
  ReportOpRefused,
  exportReport,
  readSubmission,
  regenerateReport,
  sha256Of,
} from "@/lib/admin/report-ops";
import type { ScreenReaders } from "@/lib/db/assessments";
import { REPORT_FORMAT } from "@/lib/report/document";
import type { ScreenQueryRow } from "@/lib/db/assessments";

const INSTANCE = assessmentInstances[0];
if (INSTANCE === undefined) throw new Error("data/assessments.ts carries no instance");
const TEMPLATE = assessments.find((candidate) => candidate.id === INSTANCE.templateId);
if (TEMPLATE === undefined) throw new Error(`no template "${INSTANCE.templateId}"`);

const ACTOR = "auth-operator";
const REASON = "customer asked for the report again";
const VERSION = "9.9.9";
const AUDIT_ID = "action-1";
const RECORDED_AT = new Date("2026-11-03T12:00:00.000Z");

/* ------------------------------------------------------------------ *
 * The fixture rows
 * ------------------------------------------------------------------ */

/** The screen row the loader would hand `screenFromRow()` for the fixture instance. */
function screenRow(instance: AssessmentInstance): ScreenQueryRow {
  const template = assessments.find((candidate) => candidate.id === instance.templateId);
  if (template === undefined) throw new Error(`no template "${instance.templateId}"`);
  return {
    record: {
      id: instance.id,
      slug: instance.slug,
      record_type: instance.type,
      status: instance.status,
      date: instance.date,
      title: instance.title,
      summary: instance.summary,
    },
    template_record_id: instance.templateId,
    mode: instance.mode,
    alignment_setting: instance.setting,
    name: instance.name ?? null,
    relationship_id: `relationship-${instance.id}`,
    items: instance.items.map((item, position) => ({
      record_id: instance.id,
      item_id: item.id,
      position,
      prompt: item.prompt,
      scale_kind: item.scale.kind,
      left_value: item.leftValue,
      right_value: item.rightValue,
    })),
    options: [],
    parties: instance.parties.map((party) => ({
      session_record_id: instance.id,
      role: party.role,
      name: party.name,
      submitted_at: null,
      accepted_at: party.acceptedAt ?? RECORDED_AT,
    })),
    opinions: instance.parties.flatMap((party) =>
      party.opinions.map((answer) => ({
        session_record_id: instance.id,
        role: party.role,
        item_id: answer.itemId,
        feel: answer.opinions.feel,
        wish: answer.opinions.wish,
        think: answer.opinions.think ?? null,
        guess: answer.opinions.guess ?? null,
      })),
    ),
    template_record: {
      id: template.id,
      slug: template.slug,
      record_type: template.type,
      status: template.status,
      date: template.date,
      title: template.title,
      summary: template.summary,
    },
    template_items: template.items.map((item, position) => ({
      record_id: template.id,
      item_id: item.id,
      position,
      prompt: item.prompt,
      scale_kind: item.scale.kind,
      left_value: item.leftValue,
      right_value: item.rightValue,
    })),
    template_options: [],
    voided_at: null,
  };
}

/** One `admin_action` row, as the fake's append-only table keeps it. */
interface AuditEntry {
  readonly action: string;
  readonly target_table: string;
  readonly target_id: string;
  readonly reason: string;
  readonly before: unknown;
  readonly after: unknown;
}

/* ------------------------------------------------------------------ *
 * The fake connection
 * ------------------------------------------------------------------ */

class FakeDb {
  readonly statements: { readonly text: string; readonly values: readonly unknown[] }[] = [];
  /** The audit rows committed, in order — the fake's `admin_action` table. */
  readonly audits: AuditEntry[] = [];
  readonly committed: string[] = [];
  readonly outsideTransaction: string[] = [];
  private inTransaction = false;

  role: string | null = "admin";
  complete = true;
  voided = false;
  seatExists = true;

  get inserts(): { readonly text: string; readonly values: readonly unknown[] }[] {
    return this.statements.filter((entry) => /^INSERT INTO admin_action/i.test(entry.text.trim()));
  }

  async query<R>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<{ readonly rows: readonly R[] }> {
    this.statements.push({ text, values });
    const head = text.trimStart().replace(/\s+/g, " ");

    if (!this.inTransaction && /^(UPDATE|INSERT|DELETE)/i.test(head)) {
      this.outsideTransaction.push(head);
    }

    if (/^BEGIN$/i.test(head)) {
      this.inTransaction = true;
      return { rows: [] };
    }
    if (/^COMMIT$/i.test(head)) {
      this.committed.push(...this.statements.map((entry) => entry.text.trim()));
      this.inTransaction = false;
      return { rows: [] };
    }
    if (/^ROLLBACK$/i.test(head)) {
      this.inTransaction = false;
      return { rows: [] };
    }
    if (/^SELECT role FROM user_profile/i.test(head)) {
      return { rows: (this.role === null ? [] : [{ role: this.role }]) as unknown as R[] };
    }

    // The audit insert. Its column list is `act()`'s, so the payload is read back by name.
    if (/^INSERT INTO admin_action/i.test(head)) {
      if (!this.inTransaction) throw new Error("an audit row outside a transaction is a bug");
      const columns = /INSERT INTO admin_action \(([^)]+)\)/i
        .exec(head)?.[1]
        ?.split(",")
        .map((name) => name.trim());
      if (columns === undefined) throw new Error("the audit insert names no column list");
      const paramOf = (column: string): unknown => values[columns.indexOf(column)];
      this.audits.push({
        action: String(paramOf("action")),
        target_table: String(paramOf("target_table")),
        target_id: String(paramOf("target_id")),
        reason: String(paramOf("reason")),
        before: JSON.parse(String(paramOf("before") ?? "null")),
        after: JSON.parse(String(paramOf("after") ?? "null")),
      });
      return { rows: [{ id: `${AUDIT_ID}-${this.audits.length}` }] as unknown as R[] };
    }

    // The completeness counts.
    if (/AS aspects/i.test(head) && /FROM session ai/i.test(head)) {
      return { rows: [this.statusRow()] as unknown as R[] };
    }

    // The screen row (instance + template).
    if (/ai\.template_record_id/i.test(head) && /AS template_options/i.test(head)) {
      return { rows: [screenRow(INSTANCE)] as unknown as R[] };
    }

    // One seat's submission.
    if (/json_build_object/i.test(head) && /FROM party p/i.test(head)) {
      if (!this.seatExists) return { rows: [] };
      const role = String(values[1]);
      const party = INSTANCE.parties.find((entry) => entry.role === role);
      if (party === undefined) return { rows: [] };
      return {
        rows: [
          {
            name: party.name,
            submitted_at: null,
            accepted_at: null,
            answers: party.opinions.map((answer) => ({
              item_id: answer.itemId,
              prompt:
                INSTANCE.items.find((item) => item.id === answer.itemId)?.prompt ?? answer.itemId,
              left_value: "low",
              right_value: "high",
              feel: answer.opinions.feel,
              wish: answer.opinions.wish,
              think: answer.opinions.think ?? null,
              guess: answer.opinions.guess ?? null,
            })),
          },
        ] as unknown as R[],
      };
    }

    // The previous regeneration's digest — this fake's own log.
    if (/json_sha256/i.test(head) && /FROM admin_action/i.test(head)) {
      const previous = this.audits.filter(
        (entry) => entry.action === "report.regenerate" && entry.target_id === String(values[0]),
      );
      const last = previous[previous.length - 1];
      const digest = (last?.after as { json_sha256?: string } | undefined)?.json_sha256;
      return { rows: (digest === undefined ? [] : [{ json_sha256: digest }]) as unknown as R[] };
    }

    // The instant the banner names.
    if (/^SELECT created_at FROM admin_action/i.test(head)) {
      return { rows: [{ created_at: RECORDED_AT }] as unknown as R[] };
    }

    throw new Error(`FakeDb has no answer for: ${head.slice(0, 120)}`);
  }

  /** The counts `instanceStatusOf()` reads, in the shape `readReportStatus()` maps. */
  private statusRow(): Record<string, unknown> {
    const aspects = INSTANCE.items.length;
    const answered = this.complete ? aspects : Math.max(0, aspects - 1);
    return {
      voided_at: this.voided ? RECORDED_AT : null,
      aspects,
      has_initiator: true,
      has_counterparty: true,
      initiator_answered: aspects,
      counterparty_answered: answered,
      initiator_accepted: 1,
      counterparty_accepted: this.complete ? 1 : 0,
    };
  }

  /** The read seam a caller passes for the post-commit reads (`recordedAtOf`). */
  get readers(): ScreenReaders {
    return {
      rowsOf: <R>(text: string, values: readonly unknown[]) =>
        this.query<R>(text, values).then((result) => result.rows),
    };
  }
}

/** The runner over a fake connection, the way `transactionRunner()` would build it. */
function runnerFor(db: FakeDb) {
  return {
    async transaction<T>(work: (sql: ActSql) => Promise<T>): Promise<T> {
      await db.query("BEGIN");
      try {
        const result = await work(db);
        await db.query("COMMIT");
        return result;
      } catch (error) {
        await db.query("ROLLBACK");
        throw error;
      }
    },
  };
}

const deps = (db: FakeDb) => ({
  runner: runnerFor(db),
  readers: db.readers,
  templateVersion: VERSION,
});

/* ------------------------------------------------------------------ *
 * 1. Regenerate
 * ------------------------------------------------------------------ */

describe("regenerating a report", () => {
  test("twice produces the same digest, and the second row says what it replaced", async () => {
    const db = new FakeDb();

    const first = await regenerateReport(
      { actorUserId: ACTOR, instanceRecordId: INSTANCE.id, reason: REASON },
      deps(db),
    );
    const second = await regenerateReport(
      { actorUserId: ACTOR, instanceRecordId: INSTANCE.id, reason: REASON },
      deps(db),
    );

    expect(second.after.json_sha256).toBe(first.after.json_sha256);
    expect(db.audits).toHaveLength(2);
    expect(db.audits.map((entry) => entry.action)).toEqual([
      "report.regenerate",
      "report.regenerate",
    ]);
    expect(db.audits[0]?.before).toBeNull();
    expect(db.audits[1]?.before).toEqual({ json_sha256: first.after.json_sha256 });
    expect(db.audits[1]?.after).toMatchObject({ json_sha256: first.after.json_sha256 });
  });

  test("the digest is the digest of the document it answers", async () => {
    const db = new FakeDb();

    const result = await regenerateReport(
      { actorUserId: ACTOR, instanceRecordId: INSTANCE.id, reason: REASON },
      deps(db),
    );

    expect(result.after.json_sha256).toBe(
      sha256Of(`${JSON.stringify(result.after.document, null, 2)}\n`),
    );
    expect(zAssessmentInstance.safeParse(result.after.document.record).success).toBe(true);
  });

  test("an incomplete instance is refused, and no audit row is written", async () => {
    const db = new FakeDb();
    db.complete = false;

    await expect(
      regenerateReport(
        { actorUserId: ACTOR, instanceRecordId: INSTANCE.id, reason: REASON },
        deps(db),
      ),
    ).rejects.toBeInstanceOf(ReportOpRefused);

    expect(db.inserts).toHaveLength(0);
    expect(db.audits).toHaveLength(0);
  });

  test("a voided session is refused with its own code", async () => {
    const db = new FakeDb();
    db.voided = true;

    await expect(
      regenerateReport(
        { actorUserId: ACTOR, instanceRecordId: INSTANCE.id, reason: REASON },
        deps(db),
      ),
    ).rejects.toMatchObject({ reason: "voided" });
    expect(db.audits).toHaveLength(0);
  });

  test("a reason under eight characters is refused before anything runs", async () => {
    const db = new FakeDb();

    await expect(
      regenerateReport(
        { actorUserId: ACTOR, instanceRecordId: INSTANCE.id, reason: "short" },
        deps(db),
      ),
    ).rejects.toBeInstanceOf(ActRefused);

    // `act()` refuses before it opens a transaction, so not even a BEGIN was sent.
    expect(db.statements).toHaveLength(0);
  });

  test("a member is refused, and nothing is written for the attempt", async () => {
    const db = new FakeDb();
    db.role = "member";

    await expect(
      regenerateReport(
        { actorUserId: ACTOR, instanceRecordId: INSTANCE.id, reason: REASON },
        deps(db),
      ),
    ).rejects.toMatchObject({ reason: "role-too-low" });

    expect(db.inserts).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ *
 * 2. Read a submission
 * ------------------------------------------------------------------ */

describe("reading a party's submission", () => {
  test("a support session records exactly one read_submission row and gets the answers", async () => {
    const db = new FakeDb();
    db.role = "support";

    const result = await readSubmission(
      { actorUserId: ACTOR, instanceRecordId: INSTANCE.id, reason: "", role: "initiator" },
      deps(db),
    );

    expect(db.inserts).toHaveLength(1);
    expect(db.audits).toHaveLength(1);
    expect(db.audits[0]).toMatchObject({
      action: "read_submission",
      target_table: "party",
      target_id: `${INSTANCE.id}:initiator`,
      before: null,
    });
    // The default reason is the action's own description, and it satisfies the eight-character
    // floor — a read is a click, and it is still recorded with a reason.
    expect(db.audits[0]?.reason.length).toBeGreaterThanOrEqual(8);
    expect(result.submission.answers).toHaveLength(INSTANCE.items.length);
    expect(result.recordedAt).toBe(RECORDED_AT.toISOString());
  });

  test("a member is refused, and no row is written for the attempt", async () => {
    const db = new FakeDb();
    db.role = "member";

    await expect(
      readSubmission(
        { actorUserId: ACTOR, instanceRecordId: INSTANCE.id, reason: "", role: "initiator" },
        deps(db),
      ),
    ).rejects.toMatchObject({ reason: "role-too-low" });

    expect(db.inserts).toHaveLength(0);
    expect(db.audits).toHaveLength(0);
  });

  test("a seat that is not on the relationship is refused, and no row is written", async () => {
    const db = new FakeDb();
    db.role = "support";
    db.seatExists = false;

    await expect(
      readSubmission(
        { actorUserId: ACTOR, instanceRecordId: INSTANCE.id, reason: "", role: "counterparty" },
        deps(db),
      ),
    ).rejects.toMatchObject({ reason: "no-such-party" });

    expect(db.inserts).toHaveLength(0);
  });

  test("every refusal code is one the screen has a sentence for", () => {
    expect(REPORT_OP_REFUSALS).toEqual([
      "no-such-instance",
      "not-complete",
      "voided",
      "template-missing",
      "no-such-party",
    ]);
  });
});

/* ------------------------------------------------------------------ *
 * 3. Export
 * ------------------------------------------------------------------ */

describe("exporting the report", () => {
  test("one request writes one row, and the bytes are the document", async () => {
    const db = new FakeDb();
    db.role = "support";

    const exported = await exportReport(
      {
        actorUserId: ACTOR,
        instanceRecordId: INSTANCE.id,
        reason: "report exported as json from the report screen",
        format: "json",
      },
      deps(db),
    );

    expect(db.inserts).toHaveLength(1);
    expect(db.audits[0]?.action).toBe("read_submission");
    expect(db.audits[0]?.after).toMatchObject({ format: "json", template_version: VERSION });
    expect(exported.jsonSha256).toBe(sha256Of(exported.json));
    expect((JSON.parse(exported.json) as { format: string }).format).toBe(REPORT_FORMAT);
  });

  test("two exports of the same instance are byte-identical", async () => {
    const db = new FakeDb();
    db.role = "support";

    const first = await exportReport(
      { actorUserId: ACTOR, instanceRecordId: INSTANCE.id, reason: "export one", format: "json" },
      deps(db),
    );
    const second = await exportReport(
      { actorUserId: ACTOR, instanceRecordId: INSTANCE.id, reason: "export two", format: "json" },
      deps(db),
    );

    expect(second.jsonSha256).toBe(first.jsonSha256);
    expect(second.json).toBe(first.json);
  });
});

/* ------------------------------------------------------------------ *
 * The shape of every operation
 * ------------------------------------------------------------------ */

describe("every operation is act()'s write", () => {
  test("the audit insert is the last statement before COMMIT", async () => {
    const db = new FakeDb();
    db.role = "support";

    await readSubmission(
      { actorUserId: ACTOR, instanceRecordId: INSTANCE.id, reason: "", role: "initiator" },
      deps(db),
    );

    const sent = db.statements.map((entry) => entry.text.trim());
    expect(sent[0]).toBe("BEGIN");
    const insertAt = sent.findIndex((text) => /^INSERT INTO admin_action/i.test(text));
    const commitAt = sent.indexOf("COMMIT");
    expect(insertAt).toBeGreaterThan(0);
    // The insert is the last statement *inside* the transaction: anything the caller reads after
    // the commit (the banner's instant) is not part of the write.
    expect(insertAt).toBe(commitAt - 1);
    expect(db.outsideTransaction).toHaveLength(0);
  });
});
