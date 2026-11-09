/**
 * Retire, restore, destroy (#711): three audited writes, and the referential rule that decides
 * which of them a template may have.
 *
 * Four contracts, each with a case that fails if it were only a comment:
 *
 *   1. **Archiving is a status write.** `record.status` → `archived`, no version row touched and no
 *      relationship written, so every relationship bound to one of its versions keeps drawing it.
 *      `already-archived` is refused rather than silently accepted.
 *   2. **Restoring lands on `draft`, never on `published`.** A retired template comes back as a
 *      working copy the operator has to publish, so it can never silently reappear in the
 *      catalogue. `not-archived` is refused.
 *   3. **A template a relationship was created from is archived, never destroyed.** The delete
 *      refuses with `template-in-use` and names the count; it also refuses a row with a published
 *      version (`template-published`), because a version is what the catalogue offered. Neither
 *      refusal sends a `DELETE`, and neither writes an audit row.
 *   4. **Every write goes through `act()`**, so the audit row is the last statement in the same
 *      transaction — `admin_action:template.archive`, `…:template.restore`, `…:template.delete` —
 *      and a refused write leaves the transaction with no statements committed at all.
 *
 * No database: `act()` takes its runner as a parameter, so the fake below is a transaction that
 * models Postgres's (pending until `COMMIT`, discarded by `ROLLBACK`). The harness is the one
 * `tests/admin-template-publish.test.ts` uses, extended with the relationship counts this card
 * asks about.
 */
import { describe, expect, it } from "vitest";

import { ActRefused, type ActTransactionRunner, transactionRunner } from "@/lib/admin/act";
import {
  archiveTemplate,
  deleteTemplate,
  restoreTemplate,
  TemplateRefused,
} from "@/lib/admin/templates";
import { buildTemplateRecord } from "@/lib/admin/template-draft";

const ACTOR = "auth-operator";
const REASON = "retiring the office template";
const TEMPLATE = "assessment-office-checkin";

const RECORD = buildTemplateRecord({
  id: TEMPLATE,
  slug: "office-checkin",
  title: "Office Check-In",
  summary: "How the working week actually goes.",
  status: "draft",
  date: "2026-11-03T10:00:00.000Z",
  aspects: [
    { prompt: "How are priorities agreed?", leftValue: "Unclear", rightValue: "Agreed" },
    { prompt: "How is feedback given?", leftValue: "Rarely", rightValue: "Weekly" },
  ],
});

/** The template's rows as `TEMPLATE_BY_ID_SQL` hands them back. */
function rowsOf(status: string) {
  const items = RECORD.items as {
    id: string;
    prompt: string;
    scale: { kind: string; min: number; max: number };
    leftValue: string;
    rightValue: string;
  }[];
  return {
    record: {
      id: TEMPLATE,
      slug: "office-checkin",
      record_type: "assessment",
      status,
      date: new Date("2026-11-03T10:00:00.000Z"),
      title: "Office Check-In",
      summary: "How the working week actually goes.",
      author_user_id: null,
    },
    items: items.map((item, position) => ({
      record_id: TEMPLATE,
      item_id: item.id,
      position,
      prompt: item.prompt,
      scale_kind: "score",
      left_value: item.leftValue,
      right_value: item.rightValue,
    })),
    options: [],
  };
}

class FakeDb {
  readonly statements: { readonly text: string; readonly values: readonly unknown[] }[] = [];
  readonly committed: string[] = [];
  private pending: string[] = [];
  role = "admin";
  status = "draft";
  /** The highest version on the template; `null` is "never published". */
  version: number | null = null;
  /** Relationships naming this template — the referential rule's whole input. */
  relationships: string[] = [];

  async query<R>(text: string, values: readonly unknown[] = []): Promise<{ readonly rows: R[] }> {
    const head = text.trimStart().replace(/\s+/g, " ");
    this.statements.push({ text, values });
    if (/^BEGIN$/i.test(head)) {
      this.pending = [];
      return { rows: [] };
    }
    if (/^COMMIT$/i.test(head)) {
      this.committed.push(...this.pending);
      this.pending = [];
      return { rows: [] };
    }
    if (/^ROLLBACK$/i.test(head)) {
      this.pending = [];
      return { rows: [] };
    }
    if (/^SELECT role FROM user_profile/i.test(head)) {
      return { rows: [{ role: this.role }] as unknown as R[] };
    }
    if (/^SELECT id, slug, record_type, status FROM record WHERE id = \$1 FOR UPDATE/i.test(head)) {
      return {
        rows: [
          { id: TEMPLATE, slug: "office-checkin", record_type: "assessment", status: this.status },
        ] as unknown as R[],
      };
    }
    if (/^SELECT to_jsonb\(r\) AS record/i.test(head)) {
      const rows = rowsOf(this.status);
      return {
        rows: [{ record: rows.record, items: rows.items, options: [] }] as unknown as R[],
      };
    }
    if (/^SELECT max\(version\) AS version FROM template_version/i.test(head)) {
      return { rows: [{ version: this.version }] as unknown as R[] };
    }
    if (/^SELECT id FROM relationship WHERE template_id = \$1/i.test(head)) {
      return { rows: this.relationships.map((id) => ({ id })) as unknown as R[] };
    }
    if (/^SELECT count\(\*\)::int AS count FROM relationship/i.test(head)) {
      return { rows: [{ count: this.relationships.length }] as unknown as R[] };
    }
    if (/^UPDATE record SET status = 'archived'/i.test(head)) {
      this.pending.push("UPDATE record archived");
      this.status = "archived";
      return { rows: [] };
    }
    if (/^UPDATE record SET status = 'draft'/i.test(head)) {
      this.pending.push("UPDATE record draft");
      this.status = "draft";
      return { rows: [] };
    }
    if (/^DELETE FROM record WHERE id = \$1/i.test(head)) {
      this.pending.push("DELETE record");
      return { rows: [] };
    }
    if (/^INSERT INTO admin_action/i.test(head)) {
      this.pending.push(`admin_action:${String(values[2])}`);
      return { rows: [{ id: "audit-1" }] as unknown as R[] };
    }
    throw new Error(`the fake does not answer: ${head}`);
  }
}

function runnerFor(db: FakeDb): ActTransactionRunner {
  return transactionRunner(async () => ({
    query: <R>(text: string, values: readonly unknown[] = []) => db.query<R>(text, values),
    release: () => undefined,
  }));
}

/** The statement texts that name a table, so "no write reached it" is asserted, not assumed. */
function statementsAgainst(db: FakeDb, table: string): string[] {
  return db.statements
    .filter((statement) => new RegExp(`\\b${table}\\b`, "i").test(statement.text))
    .map((statement) => statement.text);
}

/* ------------------------------------------------------------------ *
 * 1. Archive is a status write
 * ------------------------------------------------------------------ */

describe("archiving a template keeps everything and offers nothing", () => {
  it("writes the status, touches no version and no relationship, and audits last", async () => {
    const db = new FakeDb();
    db.status = "published";
    db.version = 2;
    db.relationships = ["relationship-avery"];

    const result = await archiveTemplate(
      { actorUserId: ACTOR, reason: REASON, templateId: TEMPLATE },
      runnerFor(db),
    );

    expect(result.actionId).toBe("audit-1");
    expect(result.before).toMatchObject({ status: "published", version: 2 });
    expect(result.after).toMatchObject({ status: "archived", version: 2 });
    expect(db.committed).toEqual(["UPDATE record archived", "admin_action:template.archive"]);
    // The rule the revision flow rests on: retiring a template reaches nothing that was answered
    // under it. A statement mentioning `relationship` here would be the silent re-bind.
    expect(statementsAgainst(db, "relationship")).toEqual([]);
    expect(
      db.statements.some((statement) =>
        /^(UPDATE|DELETE FROM) template_version/i.test(statement.text),
      ),
    ).toBe(false);
  });

  it("refuses an already-archived row rather than reporting a no-op as a success", async () => {
    const db = new FakeDb();
    db.status = "archived";

    await expect(
      archiveTemplate({ actorUserId: ACTOR, templateId: TEMPLATE }, runnerFor(db)),
    ).rejects.toBeInstanceOf(TemplateRefused);

    expect(db.committed).toEqual([]);
    expect(db.statements.some((statement) => /^UPDATE record/i.test(statement.text))).toBe(false);
  });

  it("refuses an id that is not a template", async () => {
    const db = new FakeDb();
    // The lock answers a non-assessment, which is what an instance row looks like here.
    const original = db.query.bind(db);
    db.query = async <R>(text: string, values: readonly unknown[] = []) => {
      if (
        /^SELECT id, slug, record_type, status FROM record WHERE id = \$1 FOR UPDATE/i.test(text)
      ) {
        return {
          rows: [
            { id: TEMPLATE, slug: "office-checkin", record_type: "quiz", status: "draft" },
          ] as unknown as R[],
        };
      }
      return original<R>(text, values);
    };

    await expect(
      archiveTemplate({ actorUserId: ACTOR, templateId: TEMPLATE }, runnerFor(db)),
    ).rejects.toBeInstanceOf(TemplateRefused);
  });
});

/* ------------------------------------------------------------------ *
 * 2. Restore lands on draft
 * ------------------------------------------------------------------ */

describe("restoring a template hands back a working copy", () => {
  it("moves archived → draft and leaves the versions where they were", async () => {
    const db = new FakeDb();
    db.status = "archived";
    db.version = 3;

    const result = await restoreTemplate(
      { actorUserId: ACTOR, templateId: TEMPLATE },
      runnerFor(db),
    );

    expect(result.before).toMatchObject({ status: "archived", version: 3 });
    expect(result.after).toMatchObject({ status: "draft", version: 3 });
    expect(db.committed).toEqual(["UPDATE record draft", "admin_action:template.restore"]);
    // Never `published`: bringing a template back does not re-offer words nobody re-read.
    expect(
      db.statements.some((statement) => /SET status = 'published'/i.test(statement.text)),
    ).toBe(false);
  });

  it("refuses a row that is not archived", async () => {
    const db = new FakeDb();
    db.status = "draft";

    await expect(
      restoreTemplate({ actorUserId: ACTOR, templateId: TEMPLATE }, runnerFor(db)),
    ).rejects.toBeInstanceOf(TemplateRefused);
    expect(db.committed).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * 3. The referential rule
 * ------------------------------------------------------------------ */

describe("a template somebody answered under is never destroyed", () => {
  it("refuses with `template-in-use` and names the relationship, writing nothing", async () => {
    const db = new FakeDb();
    db.relationships = ["relationship-avery", "relationship-rowan"];

    const failure = await deleteTemplate(
      { actorUserId: ACTOR, reason: REASON, templateId: TEMPLATE },
      runnerFor(db),
    ).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(TemplateRefused);
    expect((failure as TemplateRefused).reason).toBe("template-in-use");
    // The message answers the operator's next question: how many, and which ones.
    expect((failure as TemplateRefused).message).toContain("2 relationship(s)");
    expect((failure as TemplateRefused).message).toContain("relationship-avery");

    expect(db.committed).toEqual([]);
    expect(db.statements.some((statement) => /^DELETE FROM record/i.test(statement.text))).toBe(
      false,
    );
  });

  it("refuses a published template with `template-published` even when nobody used it", async () => {
    const db = new FakeDb();
    db.version = 4;

    const failure = await deleteTemplate(
      { actorUserId: ACTOR, templateId: TEMPLATE },
      runnerFor(db),
    ).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(TemplateRefused);
    expect((failure as TemplateRefused).reason).toBe("template-published");
    expect(db.committed).toEqual([]);
  });

  it("is asked for something it can delete, the record goes and the audit row is last", async () => {
    const db = new FakeDb();

    const result = await deleteTemplate(
      { actorUserId: ACTOR, templateId: TEMPLATE },
      runnerFor(db),
    );

    expect(result.after).toMatchObject({ status: "deleted", version: 0 });
    expect(db.committed).toEqual(["DELETE record", "admin_action:template.delete"]);
    // The audit `before` is the last copy of the template that exists once this commits: the whole
    // bounded record, Aspects included, never a stub.
    expect(result.before).toMatchObject({
      id: TEMPLATE,
      slug: "office-checkin",
      title: "Office Check-In",
    });
    const before = result.before as { aspects: { id: string }[] };
    expect(before.aspects).toHaveLength(2);
  });
});

/* ------------------------------------------------------------------ *
 * 4. The rung, and the reason
 * ------------------------------------------------------------------ */

describe("the rung is read inside the transaction, like every other audited write", () => {
  it("refuses `support` on all three writes", async () => {
    const db = new FakeDb();
    db.role = "support";
    const runner = runnerFor(db);

    for (const write of [archiveTemplate, restoreTemplate, deleteTemplate]) {
      await expect(
        write({ actorUserId: ACTOR, templateId: TEMPLATE }, runner),
      ).rejects.toBeInstanceOf(ActRefused);
    }
    expect(db.committed).toEqual([]);
  });

  it("records the reason when one is given, and NULL when none is", async () => {
    const stated = new FakeDb();
    await archiveTemplate(
      { actorUserId: ACTOR, reason: REASON, templateId: TEMPLATE },
      runnerFor(stated),
    );

    // `AUDIT_INSERT_SQL` is a template literal, so its text starts with a newline: the match is
    // unanchored on purpose.
    const audit = stated.statements.find((statement) =>
      /INSERT INTO admin_action/i.test(statement.text),
    );

    expect(audit?.values[5]).toBe(REASON);

    const silent = new FakeDb();
    await archiveTemplate({ actorUserId: ACTOR, templateId: TEMPLATE }, runnerFor(silent));

    const bare = silent.statements.find((statement) =>
      /INSERT INTO admin_action/i.test(statement.text),
    );

    // `NULL`, never an empty string: a reader of the log could not tell the two apart.
    expect(bare?.values[5]).toBeNull();
  });
});
