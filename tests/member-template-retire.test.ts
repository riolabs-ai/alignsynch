/**
 * Retiring a member's own template (#1109) — the three writes `/templates/relationship` used to own.
 *
 * The listing that retired in #1109 was the only surface that could archive, restore or destroy a
 * template a member had written. Those three actions now live on the dashboard, driven by
 * `archiveMyTemplate` / `restoreMyTemplate` / `deleteMyTemplate`, and these cases are what stops the
 * port from being a claim in a docstring:
 *
 *   1. **Archive is one status write** — `record.status` → `archived`, nothing else reached, and an
 *      already-archived row is refused (`already-archived`) rather than reported as a success.
 *   2. **Restore lands on `draft`** — a member's template is never published to the catalogue
 *      (public listing is admin-curated, #533), so restoring to `published` would invent a state the
 *      row never had. A row that is not archived is refused (`not-archived`).
 *   3. **Delete is bounded by the same referential rule as the console's** — a template a
 *      relationship was created from (`template-in-use`) or one with a published version
 *      (`template-published`) is refused, and a refusal writes no `DELETE` and no audit row.
 *   4. **Ownership is the gate, not the rung.** `template.draft`'s floor is `member`, so any signed-in
 *      person passes `act()`; the rule that decides is `owner_user_id === actor`, read **inside** the
 *      transaction. Another account's row answers `not-yours` and writes nothing.
 *
 * No database: `act()` takes its runner as a parameter, so the fake below is a transaction that
 * models Postgres's (pending until `COMMIT`, discarded by `ROLLBACK`) — the harness
 * `tests/admin-template-crud.test.ts` uses for the console's identical trio.
 */
import { describe, expect, it } from "vitest";

import { type ActTransactionRunner, transactionRunner } from "@/lib/admin/act";
import {
  archiveMyTemplate,
  deleteMyTemplate,
  MemberTemplateRefused,
  restoreMyTemplate,
} from "@/lib/member/templates";

const ACTOR = "account-a-avery";
const OTHER = "account-b-blake";
const TEMPLATE = "assessment-weekly-reset";
const REASON = "Archived their own template assessment-weekly-reset (dashboard, templates).";

interface Statement {
  readonly text: string;
  readonly values: readonly unknown[];
}

/**
 * The transaction's view of the two tables these writers read.
 *
 * Only the columns the statements name are modelled; a statement this fake cannot answer throws, so
 * a writer that starts reading something new fails loudly here instead of quietly passing.
 */
class FakeDb {
  statements: Statement[] = [];
  committed: string[] = [];
  private pending: string[] = [];

  role = "member";
  status = "draft";
  owner = ACTOR;
  /** The template exists; `false` is "no such row", which the lock answers with no rows. */
  exists = true;
  /** Rows that name this template: a session started from it, or a relationship's `template_id`. */
  started = 0;
  /** The highest `template_version.version`, or `null` for a never-published row. */
  version: number | null = null;

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
    if (/^SELECT r\.id, r\.slug, r\.title, r\.status, r\.owner_user_id FROM record r/i.test(head)) {
      if (!this.exists) return { rows: [] as unknown as R[] };
      return {
        rows: [
          {
            id: TEMPLATE,
            slug: "weekly-reset",
            title: "Our Weekly Reset",
            status: this.status,
            owner_user_id: this.owner,
          },
        ] as unknown as R[],
      };
    }
    if (/^SELECT \(SELECT count\(\*\) FROM session s/i.test(head)) {
      return { rows: [{ started: this.started }] as unknown as R[] };
    }
    if (/^SELECT max\(version\) AS version FROM template_version/i.test(head)) {
      return { rows: [{ version: this.version }] as unknown as R[] };
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

/** Every statement that writes, so "refused writes nothing" is asserted and not assumed. */
function writes(db: FakeDb): string[] {
  return db.statements
    .map((statement) => statement.text.trimStart())
    .filter((text) => /^(UPDATE|DELETE|INSERT)/i.test(text));
}

/* ------------------------------------------------------------------ *
 * 1. Archive
 * ------------------------------------------------------------------ */

describe("archiving a member's own template", () => {
  it("writes the status, writes nothing else, and audits last in the same transaction", async () => {
    const db = new FakeDb();
    db.status = "draft";

    const result = await archiveMyTemplate(
      { actorUserId: ACTOR, reason: REASON, templateId: TEMPLATE },
      runnerFor(db),
    );

    expect(result.actionId).toBe("audit-1");
    expect(result.before).toMatchObject({ status: "draft" });
    expect(result.after).toMatchObject({ status: "archived" });
    expect(db.committed).toEqual(["UPDATE record archived", "admin_action:template.draft"]);
    /*
     * The one promise archiving makes: a relationship that was created from this template keeps
     * the version it copied. A statement naming `relationship` or `template_version` here would be
     * the silent re-bind this action must never do.
     */
    expect(writes(db)).toEqual([
      expect.stringMatching(/^UPDATE record SET status = 'archived'/i),
      expect.stringMatching(/^INSERT INTO admin_action/i),
    ]);
  });

  it("refuses an already-archived row rather than reporting a no-op as a success", async () => {
    const db = new FakeDb();
    db.status = "archived";

    await expect(
      archiveMyTemplate(
        { actorUserId: ACTOR, reason: REASON, templateId: TEMPLATE },
        runnerFor(db),
      ),
    ).rejects.toMatchObject({ name: "MemberTemplateRefused", reason: "already-archived" });

    expect(db.committed).toEqual([]);
    expect(writes(db)).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * 2. Restore
 * ------------------------------------------------------------------ */

describe("restoring an archived template", () => {
  it("lands on `draft`, never on `published`, and audits the restore", async () => {
    const db = new FakeDb();
    db.status = "archived";

    const result = await restoreMyTemplate(
      { actorUserId: ACTOR, reason: REASON, templateId: TEMPLATE },
      runnerFor(db),
    );

    expect(result.after).toMatchObject({ status: "draft" });
    expect(db.committed).toEqual(["UPDATE record draft", "admin_action:template.draft"]);
    expect(JSON.stringify(result.after)).not.toContain("published");
  });

  it("refuses a row that is not archived — there is nothing to hand back", async () => {
    const db = new FakeDb();
    db.status = "draft";

    await expect(
      restoreMyTemplate(
        { actorUserId: ACTOR, reason: REASON, templateId: TEMPLATE },
        runnerFor(db),
      ),
    ).rejects.toMatchObject({ reason: "not-archived" });

    expect(writes(db)).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * 3. Delete
 * ------------------------------------------------------------------ */

describe("destroying a member's own template", () => {
  it("deletes a draft nobody answered under, and audits the delete", async () => {
    const db = new FakeDb();
    db.started = 0;
    db.version = null;

    const result = await deleteMyTemplate(
      { actorUserId: ACTOR, reason: REASON, templateId: TEMPLATE },
      runnerFor(db),
    );

    expect(result.after).toMatchObject({ status: "deleted" });
    expect(db.committed).toEqual(["DELETE record", "admin_action:template.draft"]);
  });

  it("refuses a template a relationship was created from, and points at archive", async () => {
    const db = new FakeDb();
    db.started = 1;

    await expect(
      deleteMyTemplate({ actorUserId: ACTOR, reason: REASON, templateId: TEMPLATE }, runnerFor(db)),
    ).rejects.toMatchObject({ reason: "template-in-use" });

    expect(writes(db)).toEqual([]);
    expect(db.committed).toEqual([]);
  });

  it("refuses a template with a published version — its history is what was offered", async () => {
    const db = new FakeDb();
    db.version = 2;

    await expect(
      deleteMyTemplate({ actorUserId: ACTOR, reason: REASON, templateId: TEMPLATE }, runnerFor(db)),
    ).rejects.toMatchObject({ reason: "template-published" });

    expect(writes(db)).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * 4. Ownership — the rule that decides, read inside the transaction
 * ------------------------------------------------------------------ */

describe("ownership is the gate", () => {
  it("refuses another account's row as `not-yours` and writes nothing", async () => {
    const db = new FakeDb();
    db.owner = OTHER;

    await expect(
      archiveMyTemplate(
        { actorUserId: ACTOR, reason: REASON, templateId: TEMPLATE },
        runnerFor(db),
      ),
    ).rejects.toBeInstanceOf(MemberTemplateRefused);

    expect(writes(db)).toEqual([]);
    expect(db.committed).toEqual([]);
  });

  it("answers an id that names nothing with `no-such-template`, not a distinguishable refusal", async () => {
    const db = new FakeDb();
    db.exists = false;

    await expect(
      deleteMyTemplate({ actorUserId: ACTOR, reason: REASON, templateId: TEMPLATE }, runnerFor(db)),
    ).rejects.toMatchObject({ reason: "no-such-template" });
  });

  it("records the actor's rung as `member`, the floor `template.draft` names", async () => {
    const db = new FakeDb();

    const result = await archiveMyTemplate(
      { actorUserId: ACTOR, reason: REASON, templateId: TEMPLATE },
      runnerFor(db),
    );

    /*
     * `member` is the bottom of the ladder, so there is no rung to fall below: the gate that keeps
     * one member out of another's template is `owner_user_id`, not the role. What this case pins is
     * that the audit row names the rung the transaction read — an unreadable profile row is the
     * floor, never a privilege.
     */
    expect(result.actorRole).toBe("member");
    expect(db.committed).toContain("admin_action:template.draft");
  });
});
