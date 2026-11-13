/**
 * #943 — **a reorder and a panel save are not two writers for one fact.**
 *
 * The relationship's detail screen draws its Aspects through `AspectList`, which owns the drag and
 * its own save. The edit dialog beside it draws no Aspect control at all (#935) — so what it posts
 * must say *nothing* about the list. Before this card it did: `payload()` rebuilt the record with
 * `aspects: state.aspects`, the rows the page read, and the writer applied them. Reorder a row,
 * open the dialog, save a title, and the pre-reorder array was written back over the drag — silently,
 * because a reorder moves no answer and therefore produces no stated cost to notice.
 *
 * The cases here are the writer's, driven through `editRelationship` with a scripted `ActSql` (the
 * path `admin-relationship-ops.test.ts` and `admin-template-crud.test.ts` already take: `act()`'s
 * runner is a parameter precisely so a transaction can be answered without a database).
 *
 *   the race        an edit that names no item list leaves the stored rows and the pin exactly as
 *                   they are — so a drag made in the same page session survives the save.
 *   the guard       an edit that *does* supply a list still applies it. That is the half a fix
 *                   could quietly break, and it is also the shape the old panel posted: the
 *                   second case is the bug, kept so the first case means something.
 *   the boundary    `validateEditedRecord` accepts an absent list, refuses an empty one, and holds
 *                   a supplied one to the model's rules.
 */
import { describe, expect, it } from "vitest";

import { buildTemplateRecord, validateEditedRecord } from "@/lib/admin/template-draft";
import type { ActSql, ActTransactionRunner } from "@/lib/admin/act";
import { editRelationship } from "@/lib/member/relationship-edit";

/* ------------------------------------------------------------------ *
 * The rows a relationship edit reads and writes
 * ------------------------------------------------------------------ */

const ACTOR = "user-initiator";
const RELATIONSHIP = "relationship-1";
const TEMPLATE = "record-template-1";
const VERSION_1 = "template-version-1-v1";
const VERSION_2 = "template-version-1-v2";

interface StoredAspect {
  readonly id: string;
  readonly prompt: string;
  readonly leftValue: string;
  readonly rightValue: string;
}

const ASPECT_A: StoredAspect = {
  id: "aspect-a",
  prompt: "How blunt",
  leftValue: "Gentle",
  rightValue: "Direct",
};
const ASPECT_B: StoredAspect = {
  id: "aspect-b",
  prompt: "How planned",
  leftValue: "Loose",
  rightValue: "Scripted",
};

/** The version payload the writer reads its "before" list from — a real `zAssessment`. */
function payloadOf(aspects: readonly StoredAspect[], title: string): unknown {
  return buildTemplateRecord({
    id: TEMPLATE,
    slug: "relationship-basics",
    title,
    summary: "the probe's copy",
    status: "published",
    date: "2026-10-01T00:00:00.000Z",
    aspects: aspects.map((aspect) => ({
      id: aspect.id,
      prompt: aspect.prompt,
      leftValue: aspect.leftValue,
      rightValue: aspect.rightValue,
    })),
  });
}

/**
 * One relationship, as the writer sees it: a published row on its second version, with two
 * answered Aspects, and — the scene of the race — **the stored order is `[B, A]`** because a drag
 * already happened. The panel's `state` was read before that drag, so the snapshot it used to post
 * is `[A, B]`.
 */
class RaceDb {
  readonly statements: string[] = [];
  /** The `item` rows of the template — what the next page load reads. */
  items: StoredAspect[] = [ASPECT_B, ASPECT_A];
  /** Every version, newest last. The pin is a row's id, not an index. */
  readonly versions = [
    { id: VERSION_1, version: 1, payload: payloadOf([ASPECT_A, ASPECT_B], "Avery & Rowan") },
    { id: VERSION_2, version: 2, payload: payloadOf([ASPECT_B, ASPECT_A], "Avery & Rowan") },
  ];
  pin = VERSION_2;
  copyTitle = "Avery & Rowan";
  copySummary = "the probe's copy";

  /** Did this transaction touch the list at all? The claim of the first case, in one place. */
  get wroteItems(): boolean {
    return this.statements.some(
      (sql) => sql.startsWith("DELETE FROM item") || sql.startsWith("INSERT INTO item"),
    );
  }

  get wroteVersion(): boolean {
    return this.statements.some(
      (sql) =>
        sql.startsWith("INSERT INTO template_version") ||
        sql.startsWith("UPDATE relationship SET template_version_id"),
    );
  }

  readonly sql: ActSql = {
    query: async <R>(text: string, values: readonly unknown[] = []): Promise<{ rows: R[] }> => {
      const sql = text.replace(/\s+/g, " ").trim();
      this.statements.push(sql);
      const rows = this.answer(sql, values) as R[];
      return { rows };
    },
  };

  private answer(sql: string, values: readonly unknown[]): unknown[] {
    // act(): the actor's rung, then the audit row.
    if (sql.startsWith("SELECT role FROM user_profile")) return [{ role: "member" }];
    if (sql.startsWith("INSERT INTO admin_action")) return [{ id: "admin-action-1" }];

    // The relationship under lock.
    if (sql.startsWith("SELECT id, status, template_id")) {
      return [
        {
          id: RELATIONSHIP,
          status: "published",
          template_id: TEMPLATE,
          template_version_id: this.pin,
          initiator_user_id: ACTOR,
        },
      ];
    }
    // The copy's title and summary.
    if (sql.startsWith("SELECT id, title, summary FROM record")) {
      return [{ id: TEMPLATE, title: this.copyTitle, summary: this.copySummary }];
    }
    // No session rows: a published relationship whose sheet lives on the template, so the diff of
    // the rounds is empty and `mode`/`setting` cannot block (the simplest honest scene).
    if (sql.startsWith("SELECT record_id, mode, alignment_setting FROM session")) return [];
    // The bound version's payload — the writer's "before" list.
    if (sql.startsWith("SELECT payload, template_record_id FROM template_version")) {
      const version = this.versions.find((row) => row.id === values[0]);
      return version === undefined
        ? []
        : [{ payload: version.payload, template_record_id: TEMPLATE }];
    }
    // Every Aspect has one answer per seat: enough that a wrongly-computed removal would be loud.
    if (sql.startsWith("SELECT o.item_id")) {
      return this.items.flatMap((item) => [
        { item_id: item.id, role: "initiator", name: "Avery", answers: 1 },
        { item_id: item.id, role: "counterparty", name: "Rowan", answers: 1 },
      ]);
    }
    if (sql.startsWith("UPDATE record SET title")) {
      this.copyTitle = String(values[1]);
      this.copySummary = String(values[2]);
      return [];
    }
    // ---- the list writes, which only a supplied list may reach ----
    if (sql.startsWith("DELETE FROM item WHERE record_id = $1")) {
      if (!sql.includes("AND item_id = $2")) this.items = [];
      else this.items = this.items.filter((item) => item.id !== values[1]);
      return [];
    }
    if (sql.startsWith("INSERT INTO item")) {
      this.items.push({
        id: String(values[1]),
        prompt: String(values[3]),
        leftValue: String(values[4] ?? ""),
        rightValue: String(values[5] ?? ""),
      });
      return [];
    }
    if (sql.startsWith("UPDATE item SET position")) {
      const index = this.items.findIndex((item) => item.id === values[1]);
      const row = this.items[index];
      if (row !== undefined) this.items[index] = { ...row, prompt: String(values[3]) };
      return [];
    }
    if (sql.startsWith("DELETE FROM opinion")) return [];
    // ---- the version writes ----
    if (sql.startsWith("SELECT max(version) AS version FROM template_version")) {
      return [{ version: Math.max(...this.versions.map((row) => row.version)) }];
    }
    if (sql.startsWith("INSERT INTO template_version")) {
      this.versions.push({
        id: String(values[0]),
        version: Number(values[2]),
        payload: JSON.parse(String(values[3])),
      });
      return [];
    }
    if (sql.startsWith("UPDATE template_version SET superseded_at")) return [];
    if (sql.startsWith("UPDATE relationship SET template_version_id")) {
      this.pin = String(values[1]);
      return [];
    }
    throw new Error(`RaceDb: no answer scripted for "${sql}"`);
  }

  readonly runner: ActTransactionRunner = {
    transaction: async <T>(work: (sql: ActSql) => Promise<T>): Promise<T> => work(this.sql),
  };
}

/** The panel's payload as it is built now: the record's own fields, and no item list. */
function panelRecord(overrides: { readonly title?: string } = {}): Record<string, unknown> {
  return {
    id: TEMPLATE,
    slug: "relationship-basics",
    type: "assessment",
    status: "published",
    date: "2026-10-01T00:00:00.000Z",
    title: overrides.title ?? "Avery & Rowan, renamed",
    summary: "the probe's copy",
  };
}

function request(record: Record<string, unknown>) {
  return {
    actorUserId: ACTOR,
    relationshipId: RELATIONSHIP,
    reason: "probe: rename the relationship from its own dialog",
    draft: { record: record as never },
  };
}

/* ------------------------------------------------------------------ *
 * The race
 * ------------------------------------------------------------------ */

describe("a reorder and the edit dialog do not fight over one fact (#943)", () => {
  it("keeps the order a drag just wrote when the panel saves without a reload", async () => {
    const db = new RaceDb();
    // The drag already happened: the stored order is [B, A] and that is what the version names.
    expect(db.items.map((item) => item.id)).toEqual(["aspect-b", "aspect-a"]);

    const result = await editRelationship(request(panelRecord()), db.runner);

    // The edit wrote what it holds…
    expect(result.after.title).toBe("Avery & Rowan, renamed");
    expect(db.copyTitle).toBe("Avery & Rowan, renamed");

    // …and said nothing about the list, so the list is exactly as the drag left it — in the rows a
    // reload reads, in the version the pin names, and in what the write reports back.
    expect(db.items.map((item) => item.id)).toEqual(["aspect-b", "aspect-a"]);
    expect(db.pin).toBe(VERSION_2);
    expect(result.after.version).toBeNull();
    expect(result.after.aspects).toEqual(["aspect-b", "aspect-a"]);
    expect(result.after.discardedAnswers).toBe(0);

    // The mechanism, stated as the absence it is: no item statement and no version statement ran.
    expect(db.wroteItems).toBe(false);
    expect(db.wroteVersion).toBe(false);
  });
});

/* ------------------------------------------------------------------ *
 * The half that must keep working
 * ------------------------------------------------------------------ */

describe("a supplied item list is still applied", () => {
  it("writes the list a caller means to send — the shape that used to undo the drag", async () => {
    const db = new RaceDb();
    // The pre-#943 panel payload: `state.aspects` as the page read it, before the drag.
    const stale = buildTemplateRecord({
      id: TEMPLATE,
      slug: "relationship-basics",
      title: "Avery & Rowan, renamed",
      summary: "the probe's copy",
      status: "published",
      date: "2026-10-01T00:00:00.000Z",
      aspects: [ASPECT_A, ASPECT_B],
    });

    const result = await editRelationship(request(stale), db.runner);

    // A present list is authoritative: the writer replaces the rows and moves the pin to a version
    // that holds them. This is why the panel had to stop sending one — the same code path that
    // makes a reorder possible makes it reversible by a stale snapshot.
    expect(db.wroteItems).toBe(true);
    expect(db.items.map((item) => item.id)).toEqual(["aspect-a", "aspect-b"]);
    expect(db.pin).not.toBe(VERSION_2);
    expect(result.after.version).toBe(3);
    expect(result.after.aspects).toEqual(["aspect-a", "aspect-b"]);
  });

  it("still refuses a list that removes an answered Aspect until the cost is confirmed", async () => {
    const db = new RaceDb();
    const oneAspect = buildTemplateRecord({
      id: TEMPLATE,
      slug: "relationship-basics",
      title: "Avery & Rowan, renamed",
      summary: "the probe's copy",
      status: "published",
      date: "2026-10-01T00:00:00.000Z",
      aspects: [ASPECT_B],
    });

    await expect(editRelationship(request(oneAspect), db.runner)).rejects.toThrow(
      /invalidation has to be confirmed/,
    );
    // Nothing was written: the refusal is inside the transaction, before the item statements.
    expect(db.wroteItems).toBe(false);
    expect(db.items.map((item) => item.id)).toEqual(["aspect-b", "aspect-a"]);
  });
});

/* ------------------------------------------------------------------ *
 * The boundary: what a body may say about the list
 * ------------------------------------------------------------------ */

describe("validateEditedRecord", () => {
  it("accepts a body that names no item list — the panel's payload", () => {
    const parsed = validateEditedRecord(panelRecord());
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.record.items).toBeUndefined();
  });

  it("accepts a body that names one, and keeps the model's rules for it", () => {
    const full = buildTemplateRecord({
      id: TEMPLATE,
      slug: "relationship-basics",
      title: "Avery & Rowan",
      summary: "the probe's copy",
      status: "draft",
      date: "2026-10-01T00:00:00.000Z",
      aspects: [ASPECT_A],
    });
    const parsed = validateEditedRecord(full);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.record.items?.map((item) => item.id)).toEqual(["aspect-a"]);

    // An empty list is not "unchanged" — `zAssessment`'s `.min(1)` still refuses it, which is what
    // makes the absent list the only way to say it.
    const empty = validateEditedRecord({ ...panelRecord(), items: [] });
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.problems.map((problem) => problem.path)).toContain("items");

    // And a supplied row is held to the same schema the fixtures are.
    const broken = validateEditedRecord({
      ...panelRecord(),
      items: [{ id: "aspect-a", prompt: "How blunt" }],
    });
    expect(broken.ok).toBe(false);
  });
});
