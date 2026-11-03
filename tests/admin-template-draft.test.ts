/**
 * Template authoring (#502a): the draft the model must accept, and the write `act()` owns.
 *
 * Two halves, because the card has two contracts:
 *
 *   1. **Validation is `zAssessment` itself.** `lib/admin/template-draft.ts` builds the record the
 *      form is editing and hands it to the schema the fixtures are held to, so a console-authored
 *      template cannot be something a fixture could not. The cases below drive a body a console
 *      can be handed — an `opinionKind` a template does not have, a wrong scale kind, a missing
 *      pole, a duplicate Aspect id — and assert the **path** and the field's name, never a
 *      sentence.
 *   2. **A save is one audited write.** `createTemplateDraft` / `updateTemplateDraft` are driven
 *      against a fake connection that models a transaction the way Postgres does (pending until
 *      `COMMIT`, discarded by `ROLLBACK`): the statements must be
 *      `BEGIN → SELECT role → … → INSERT admin_action → COMMIT`, a refusal must leave no row, and
 *      a published template must be edited **without writing a version** (that is a publish, and
 *      `#502b`'s), an archived one must be refused as `not-editable` **before** any `UPDATE` is
 *      sent, and a refusal must roll back the whole transaction.
 *
 * No database: `act()` takes its runner as a parameter, which is exactly why this is a unit test.
 */
import { describe, expect, it } from "vitest";

import { ActRefused, type ActTransactionRunner, transactionRunner } from "@/lib/admin/act";
import { createTemplateDraft, updateTemplateDraft } from "@/lib/admin/templates";
import {
  aspectIdOf,
  buildTemplateRecord,
  slugify,
  type TemplateDraftInput,
  validateTemplateDraft,
  validateTemplateRecord,
} from "@/lib/admin/template-draft";

const ACTOR = "auth-operator";
const REASON = "authoring the office template";

const DRAFT: TemplateDraftInput = {
  id: "assessment-office-checkin",
  slug: "office-checkin",
  title: "Office Check-In",
  summary: "How the working week actually goes.",
  status: "draft",
  date: "2026-11-03T10:00:00.000Z",
  aspects: [
    { prompt: "How are priorities agreed?", leftValue: "Unclear", rightValue: "Agreed" },
    { prompt: "How is feedback given?", leftValue: "Rarely", rightValue: "Weekly" },
  ],
};

/** The record the editor's fields produce, so a case can break one field at a time. */
function bodyOf(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...buildTemplateRecord(DRAFT), ...overrides };
}

function outcomeOf(body: unknown) {
  return validateTemplateRecord(body);
}

/* ------------------------------------------------------------------ *
 * 1. The draft is the model's
 * ------------------------------------------------------------------ */

describe("a template draft is validated by content/assessment.ts", () => {
  it("assembles the record the schema expects: a score scale and two named poles", () => {
    const result = validateTemplateDraft(DRAFT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.record.type).toBe("assessment");
    expect(result.record.items).toHaveLength(2);
    expect(result.record.items[0]?.scale).toEqual({ kind: "score", min: 1, max: 5 });
    expect(result.record.items[0]?.leftValue).toBe("Unclear");
    expect(result.record.items[0]?.id).toBe("aspect-how-are-priorities-agreed");
  });

  it("refuses an OpinionKind on a template, naming the key it does not have", () => {
    // A template has no opinions: `zOpinionKind` belongs to an instance's answer sheet
    // (`content/assessment.ts::zOpinions`). `strict()` is what makes a body that carries one a
    // refusal with the key named, instead of a record that silently dropped it.
    const result = outcomeOf(bodyOf({ opinionKind: "love" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const unknown = result.problems.find((problem) => problem.message.includes("opinionKind"));
    expect(unknown?.message).toContain("Unrecognized key");
  });

  it("refuses an unknown extra key on an Aspect, naming the field it sits on", () => {
    const record = bodyOf();
    const items = record.items as Record<string, unknown>[];
    const result = outcomeOf({
      ...record,
      items: [{ ...items[0], correctOptionId: "a" }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems.some((problem) => problem.path === "items.0")).toBe(true);
    expect(result.problems.some((problem) => problem.message.includes("correctOptionId"))).toBe(
      true,
    );
  });

  it("refuses a wrong scale kind, naming the item's scale path", () => {
    const record = bodyOf();
    const items = record.items as Record<string, unknown>[];
    const result = outcomeOf({
      ...record,
      items: [{ ...items[0], scale: { kind: "opinion", min: 1, max: 5 } }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problems.some((problem) => problem.path.startsWith("items.0.scale"))).toBe(true);
  });

  it("refuses a missing pole and a duplicate Aspect id", () => {
    const missing = validateTemplateDraft({
      ...DRAFT,
      aspects: [{ prompt: "One", leftValue: "Low", rightValue: "  " }],
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.problems.some((problem) => problem.path === "items.0.rightValue")).toBe(true);
    }

    const duplicate = validateTemplateDraft({
      ...DRAFT,
      aspects: [
        { id: "aspect-time", prompt: "One", leftValue: "Low", rightValue: "High" },
        { id: "aspect-time", prompt: "Two", leftValue: "Low", rightValue: "High" },
      ],
    });
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) {
      expect(duplicate.problems.some((problem) => problem.path === "items.1.id")).toBe(true);
    }
  });

  it("drops a row nobody typed into, and derives a unique id per prompt", () => {
    const result = validateTemplateDraft({
      ...DRAFT,
      aspects: [
        { prompt: "  ", leftValue: "", rightValue: "" },
        { prompt: "Same prompt", leftValue: "A", rightValue: "B" },
        { prompt: "Same prompt", leftValue: "A", rightValue: "B" },
      ],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.record.items.map((item) => item.id)).toEqual([
      "aspect-same-prompt",
      "aspect-same-prompt-2",
    ]);
  });

  it("slugifies a title into the id the model requires, and never collides", () => {
    expect(slugify("Office Check-In!")).toBe("office-check-in");
    expect(aspectIdOf("Money & decisions", new Set())).toBe("aspect-money-decisions");
    expect(aspectIdOf("Money & decisions", new Set(["aspect-money-decisions"]))).toBe(
      "aspect-money-decisions-2",
    );
  });
});

/* ------------------------------------------------------------------ *
 * 2. The write is act()'s
 * ------------------------------------------------------------------ */

class FakeDb {
  readonly statements: { readonly text: string; readonly values: readonly unknown[] }[] = [];
  readonly committed: string[] = [];
  pending: string[] = [];
  role = "admin";
  row: Record<string, unknown> | null = null;
  collision = false;

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
    if (/^INSERT INTO admin_action/i.test(head)) {
      this.pending.push(`admin_action:${String(values[2])}`);
      return { rows: [{ id: "audit-1" }] as unknown as R[] };
    }
    if (/^SELECT id FROM record WHERE id = \$1 OR slug/i.test(head)) {
      return { rows: (this.collision ? [{ id: "other" }] : []) as unknown as R[] };
    }
    if (/^SELECT id FROM record WHERE slug/i.test(head)) {
      return { rows: [] as unknown as R[] };
    }
    if (/^INSERT INTO record/i.test(head)) {
      this.pending.push("INSERT record");
      return { rows: [] };
    }
    if (/^INSERT INTO item/i.test(head)) {
      this.pending.push(`INSERT item:${String(values[1])}`);
      return { rows: [] };
    }
    if (/^SELECT id, slug, record_type, status, title, summary/i.test(head)) {
      return { rows: (this.row === null ? [] : [this.row]) as unknown as R[] };
    }
    if (/^SELECT item_id, prompt, left_value, right_value/i.test(head)) {
      return {
        rows: [
          { item_id: "aspect-old", prompt: "Old", left_value: "A", right_value: "B" },
        ] as unknown as R[],
      };
    }
    if (/^UPDATE record SET slug/i.test(head)) {
      this.pending.push("UPDATE record");
      return { rows: [] };
    }
    if (/^DELETE FROM item/i.test(head)) {
      this.pending.push("DELETE item");
      return { rows: [] };
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

/** The record the write functions accept — the same object the action hands them. */
function recordFor(): ReturnType<typeof buildTemplateRecord> & {
  id: string;
  slug: string;
  title: string;
  status: string;
} {
  return bodyOf() as ReturnType<typeof buildTemplateRecord> & {
    id: string;
    slug: string;
    title: string;
    status: string;
  };
}

describe("a template save is act()'s write", () => {
  it("creates a draft: record, its items, and one audited action in the same transaction", async () => {
    const db = new FakeDb();
    const parsed = validateTemplateRecord(bodyOf());
    if (!parsed.ok) throw new Error("the base record stopped validating");

    const result = await createTemplateDraft(
      { actorUserId: ACTOR, reason: REASON, record: parsed.record },
      runnerFor(db),
    );
    expect(result.actionId).toBe("audit-1");
    expect(db.committed).toContain("INSERT record");
    expect(db.committed.filter((entry) => entry.startsWith("INSERT item:"))).toHaveLength(2);
    expect(db.committed).toContain("admin_action:template.create");

    const inserted = db.statements.find((statement) => /^INSERT INTO record/.test(statement.text));
    // `status` is a literal in the statement (`'draft'`), not a parameter: the create path cannot
    // be talked into another status by a body, because the value is not read from one.
    expect(inserted?.text).toContain("'draft'");
    expect(inserted?.values).toContain(ACTOR);
  });

  it("refuses a short reason before a statement of the caller's runs", async () => {
    const db = new FakeDb();
    const parsed = validateTemplateRecord(bodyOf());
    if (!parsed.ok) throw new Error("the base record stopped validating");
    await expect(
      createTemplateDraft(
        { actorUserId: ACTOR, reason: "short", record: parsed.record },
        runnerFor(db),
      ),
    ).rejects.toBeInstanceOf(ActRefused);
    expect(db.statements.some((statement) => /^INSERT INTO record/.test(statement.text))).toBe(
      false,
    );
  });

  it("refuses an id or slug another record already names", async () => {
    const db = new FakeDb();
    db.collision = true;
    const parsed = validateTemplateRecord(bodyOf());
    if (!parsed.ok) throw new Error("the base record stopped validating");
    await expect(
      createTemplateDraft(
        { actorUserId: ACTOR, reason: REASON, record: parsed.record },
        runnerFor(db),
      ),
    ).rejects.toMatchObject({ reason: "slug-taken" });
    expect(db.committed).toHaveLength(0);
  });

  it("refuses an archived template as not-editable, and writes nothing", async () => {
    const db = new FakeDb();
    db.row = { ...recordFor(), record_type: "assessment", status: "archived" };
    const parsed = validateTemplateRecord(bodyOf());
    if (!parsed.ok) throw new Error("the base record stopped validating");
    await expect(
      updateTemplateDraft(
        { actorUserId: ACTOR, reason: REASON, record: parsed.record },
        runnerFor(db),
      ),
    ).rejects.toMatchObject({ reason: "not-editable" });
    expect(db.statements.some((statement) => /^UPDATE record/.test(statement.text))).toBe(false);
    expect(db.committed).toHaveLength(0);
  });

  it("edits a published template without writing a version — that is a publish, not a save", async () => {
    const db = new FakeDb();
    db.row = { ...recordFor(), record_type: "assessment", status: "published" };
    const parsed = validateTemplateRecord(bodyOf());
    if (!parsed.ok) throw new Error("the base record stopped validating");

    await updateTemplateDraft(
      { actorUserId: ACTOR, reason: REASON, record: parsed.record },
      runnerFor(db),
    );
    expect(db.committed).toContain("admin_action:template.update");
    expect(db.committed).toContain("UPDATE record");
    // #502b — the working copy moves; every relationship keeps reading the version it was
    // created from, so a save must not write one.
    expect(db.statements.some((statement) => /template_version/.test(statement.text))).toBe(false);
  });

  it("edits a draft: replaces its items and records both sides of the change", async () => {
    const db = new FakeDb();
    db.row = { ...recordFor(), record_type: "assessment", status: "draft", title: "Old title" };
    const parsed = validateTemplateRecord(bodyOf());
    if (!parsed.ok) throw new Error("the base record stopped validating");

    const result = await updateTemplateDraft(
      { actorUserId: ACTOR, reason: REASON, record: parsed.record },
      runnerFor(db),
    );
    expect(result.before).toMatchObject({ title: "Old title" });
    expect(result.after).toMatchObject({ title: DRAFT.title });
    expect(db.committed).toContain("admin_action:template.update");
    expect(db.committed).toContain("DELETE item");
    // The old Aspect is on the `before` side; the new set is what was written.
    expect((result.before as { aspects: { id: string }[] }).aspects[0]?.id).toBe("aspect-old");
  });
});
