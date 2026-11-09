/**
 * Versioning and publish (#502b): an immutable version, a binding, and the two audited writes.
 *
 * Three contracts, and each has a case that would fail if it were only a comment:
 *
 *   1. **A publish is a snapshot.** `publishTemplate()` validates the stored working copy with
 *      `zAssessment` (through `validateTemplateRecord`, the validator a save uses), writes
 *      `max(version) + 1`, supersedes the rest, and lets `act()` write the audit row last — one
 *      transaction. A second publish writes v2 and leaves v1 alone; a version is never updated
 *      except for its `superseded_at`.
 *   2. **An invalid draft is refused, with the field named.** The refusal carries `problems`, whose
 *      paths are zod's own (`items.0.rightValue`), and no `INSERT INTO template_version` is sent.
 *   3. **Unpublish is a status write.** It flips `record.status` to `draft` and touches no version,
 *      so the history a relationship reads survives; a row that is not published is refused rather
 *      than silently accepted.
 *
 * No database: `act()` takes its runner as a parameter, so the fake below is a transaction that
 * models Postgres's (pending until `COMMIT`, discarded by `ROLLBACK`) — the same harness
 * `tests/admin-template-draft.test.ts` uses, extended with the statements this card adds.
 */
import { describe, expect, it } from "vitest";

import { ActRefused, type ActTransactionRunner, transactionRunner } from "@/lib/admin/act";
import { publishTemplate, TemplateRefused, unpublishTemplate } from "@/lib/admin/templates";
import { buildTemplateRecord, validateTemplateRecord } from "@/lib/admin/template-draft";
import {
  latestVersionOf,
  templateVersionIdOf,
  type TemplateVersionRow,
} from "@/lib/db/template-versions";

const ACTOR = "auth-operator";
const REASON = "publishing the office template";
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

/** The template's rows as `TEMPLATE_BY_ID_SQL` hands them back, with a `status` the case picks. */
function rowsOf(status: string, overrides: { rightValue?: string | null } = {}) {
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
      right_value: overrides.rightValue === undefined ? item.rightValue : overrides.rightValue,
    })),
    options: [],
  };
}

class FakeDb {
  readonly statements: { readonly text: string; readonly values: readonly unknown[] }[] = [];
  readonly committed: string[] = [];
  pending: string[] = [];
  role = "admin";
  status = "draft";
  /** The highest version already on the template; `null` is "never published". */
  version: number | null = null;
  /** A column the case breaks on the working copy the publish reads. */
  brokenRightValue: string | null | undefined = undefined;

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
    // `TEMPLATE_BY_ID_SQL` — the working copy the publish snapshots.
    if (/^SELECT to_jsonb\(r\) AS record/i.test(head)) {
      const rows = rowsOf(this.status, { rightValue: this.brokenRightValue });
      return {
        rows: [
          {
            record: rows.record,
            items: rows.items,
            options: [],
          },
        ] as unknown as R[],
      };
    }
    if (/^SELECT max\(version\) AS version FROM template_version/i.test(head)) {
      return { rows: [{ version: this.version }] as unknown as R[] };
    }
    if (/^SELECT COALESCE\(max\(version\), 0\) \+ 1 AS next FROM template_version/i.test(head)) {
      return { rows: [{ next: (this.version ?? 0) + 1 }] as unknown as R[] };
    }
    if (/^INSERT INTO template_version/i.test(head)) {
      const version = Number(values[2]);
      this.pending.push(`INSERT template_version:v${version}`);
      this.version = version;
      return { rows: [{ id: String(values[0]) }] as unknown as R[] };
    }
    if (/^UPDATE template_version SET superseded_at/i.test(head)) {
      this.pending.push(`SUPERSEDE below v${Number(values[1])}`);
      return { rows: [{ id: "older" }] as unknown as R[] };
    }
    if (/^UPDATE record SET status = 'published'/i.test(head)) {
      this.pending.push("UPDATE record published");
      this.status = "published";
      return { rows: [] };
    }
    if (/^UPDATE record SET status = 'draft'/i.test(head)) {
      this.pending.push("UPDATE record draft");
      this.status = "draft";
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

/* ------------------------------------------------------------------ *
 * 1. A publish is a snapshot
 * ------------------------------------------------------------------ */

describe("publishing writes an immutable version", () => {
  it("writes v1 for a template that has never been published, then flips the status", async () => {
    const db = new FakeDb();
    const result = await publishTemplate(
      { actorUserId: ACTOR, reason: REASON, templateId: TEMPLATE },
      runnerFor(db),
    );

    expect(result.actionId).toBe("audit-1");
    expect(result.before).toMatchObject({ status: "draft", version: null });
    expect(result.after).toMatchObject({ status: "published", version: 1 });

    // The order is the contract: the version row exists before the status that offers it, and the
    // audit row is last.
    expect(db.committed).toEqual([
      "INSERT template_version:v1",
      "SUPERSEDE below v1",
      "UPDATE record published",
      "admin_action:template.publish",
    ]);
    const inserted = db.statements.find((statement) =>
      /^INSERT INTO template_version/i.test(statement.text),
    );
    expect(inserted?.values[0]).toBe(templateVersionIdOf(TEMPLATE, 1));
    expect(inserted?.values[4]).toBe(ACTOR);
    // The payload is the validated template, not the form's body: `published`, two Aspects.
    const payload = JSON.parse(String(inserted?.values[3])) as {
      status: string;
      items: { id: string }[];
    };
    expect(payload.status).toBe("published");
    expect(payload.items).toHaveLength(2);
  });

  it("publishes v2 after an edit, superseding v1 and leaving its row alone", async () => {
    const db = new FakeDb();
    db.status = "published";
    db.version = 1;

    const result = await publishTemplate(
      { actorUserId: ACTOR, reason: REASON, templateId: TEMPLATE },
      runnerFor(db),
    );

    expect(result.after).toMatchObject({ version: 2 });
    expect(result.before).toMatchObject({ status: "published", version: 1 });
    expect(db.committed).toContain("INSERT template_version:v2");
    expect(db.committed).toContain("SUPERSEDE below v2");
    // Publishing an already-published template is a new version and no status write.
    expect(db.committed).not.toContain("UPDATE record published");
    // No statement rewrites the payload of an existing version: the migration's trigger refuses
    // one, and the write path does not attempt it.
    expect(
      db.statements.some((statement) =>
        /^UPDATE template_version SET payload/i.test(statement.text),
      ),
    ).toBe(false);
  });

  it("refuses an invalid working copy with the field named, and writes nothing", async () => {
    const db = new FakeDb();
    db.brokenRightValue = null;

    const caught = await publishTemplate(
      { actorUserId: ACTOR, reason: REASON, templateId: TEMPLATE },
      runnerFor(db),
    ).catch((error: unknown) => error);

    expect(caught).toBeInstanceOf(TemplateRefused);
    if (!(caught instanceof TemplateRefused)) return;
    expect(caught.reason).toBe("invalid-draft");
    // zod's own path, which is the field an editor points at.
    expect(caught.problems.some((problem) => problem.path === "items.0.rightValue")).toBe(true);
    expect(db.committed).toHaveLength(0);
    expect(
      db.statements.some((statement) => /^INSERT INTO template_version/.test(statement.text)),
    ).toBe(false);
  });

  it("refuses an actor below the action's floor before any statement of ours runs", async () => {
    const db = new FakeDb();
    db.role = "support";
    await expect(
      publishTemplate({ actorUserId: ACTOR, reason: REASON, templateId: TEMPLATE }, runnerFor(db)),
    ).rejects.toBeInstanceOf(ActRefused);
    expect(
      db.statements.some((statement) => /^INSERT INTO template_version/.test(statement.text)),
    ).toBe(false);
    expect(db.committed).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ *
 * 2. Unpublish is a status write
 * ------------------------------------------------------------------ */

describe("unpublishing withdraws the offer and keeps the history", () => {
  it("flips the status to draft and touches no version row", async () => {
    const db = new FakeDb();
    db.status = "published";
    db.version = 2;

    const result = await unpublishTemplate(
      {
        actorUserId: ACTOR,
        reason: "withdrawing it from the catalogue",
        templateId: TEMPLATE,
      },
      runnerFor(db),
    );

    expect(result.before).toMatchObject({ status: "published", version: 2 });
    expect(result.after).toMatchObject({ status: "draft", version: 2 });
    expect(db.committed).toEqual(["UPDATE record draft", "admin_action:template.unpublish"]);
    expect(
      db.statements.some(
        (statement) =>
          /template_version/.test(statement.text) && !/SELECT max/i.test(statement.text),
      ),
    ).toBe(false);
  });

  it("refuses a template that is not published", async () => {
    const db = new FakeDb();
    await expect(
      unpublishTemplate(
        {
          actorUserId: ACTOR,
          reason: "withdrawing it from the catalogue",
          templateId: TEMPLATE,
        },
        runnerFor(db),
      ),
    ).rejects.toMatchObject({ reason: "not-published" });
    expect(db.committed).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ *
 * 3. The pure half
 * ------------------------------------------------------------------ */

describe("the version ordering is a function", () => {
  const row = (version: number, superseded: string | null): TemplateVersionRow => ({
    id: templateVersionIdOf(TEMPLATE, version),
    template_record_id: TEMPLATE,
    version,
    payload: {},
    published_at: "2026-11-03T10:00:00.000Z",
    published_by: null,
    superseded_at: superseded,
  });

  it("takes the highest number, not the row that claims to be live", () => {
    // A version whose `superseded_at` was never written is a data defect; the newest publication
    // must still win, because hiding it would offer an older template than the one published.
    const versions = [row(1, null), row(3, "2026-11-04T00:00:00.000Z"), row(2, null)];
    expect(latestVersionOf(versions)?.version).toBe(3);
    expect(latestVersionOf([])).toBeUndefined();
  });

  it("derives a version id the migration's backfill also writes", () => {
    expect(templateVersionIdOf(TEMPLATE, 1)).toBe(`template-version-${TEMPLATE}-v1`);
  });
});

/* ------------------------------------------------------------------ *
 * 4. A revision never reaches a relationship (#711)
 * ------------------------------------------------------------------ */

describe("publishing version N+1 leaves every bound relationship on the version it was answered under", () => {
  /**
   * The binding, modelled as a row this write could touch — and does not.
   *
   * `relationship.template_version_id` is `NOT NULL` and every party-facing read parses **that**
   * payload (`0026_template_version.sql`), so "a revision does not re-bind anybody" is a claim about
   * two things: this column, and the versions the column can name. The case below states both.
   */
  it("writes no statement naming `relationship`, so the binding is untouched by construction", async () => {
    const db = new FakeDb();
    db.status = "published";
    db.version = 1;
    const bound = templateVersionIdOf(TEMPLATE, 1);

    await publishTemplate(
      { actorUserId: ACTOR, reason: "correcting the second Aspect", templateId: TEMPLATE },
      runnerFor(db),
    );

    // The one way a publish could re-bind is a statement against `relationship`; there is none.
    expect(
      db.statements.filter(
        (statement) =>
          /\brelationship\b/i.test(statement.text) &&
          !/^SELECT role FROM user_profile/i.test(statement.text),
      ),
    ).toEqual([]);
    // And the version it wrote is a new id, so the old binding cannot even accidentally name it.
    expect(templateVersionIdOf(TEMPLATE, 2)).not.toBe(bound);
    expect(db.committed).toContain("INSERT template_version:v2");
  });

  it("leaves the highest version ahead of the bound one, which is what 'answered under v1' means", () => {
    const rows: TemplateVersionRow[] = [1, 2].map((version) => ({
      id: templateVersionIdOf(TEMPLATE, version),
      template_record_id: TEMPLATE,
      version,
      payload: {},
      published_at: "2026-11-03T10:00:00.000Z",
      published_by: null,
      superseded_at: version === 1 ? "2026-11-04T00:00:00.000Z" : null,
    }));
    const bound = rows[0]?.id;

    // v2 is the live template; v1 is what the relationship reads. The two disagreeing is the
    // correct state after a revision, not a defect — that is what the edit panel prints.
    expect(latestVersionOf(rows)?.version).toBe(2);
    expect(bound).toBe(templateVersionIdOf(TEMPLATE, 1));
    expect(rows.filter((row) => row.id === bound)).toHaveLength(1);
  });
});

/** The validated record is still the model's — a guard against a fixture drifting under this suite. */
it("the template this suite publishes is a valid zAssessment record", () => {
  const parsed = validateTemplateRecord(RECORD);
  expect(parsed.ok).toBe(true);
});
