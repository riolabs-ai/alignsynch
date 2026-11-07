/**
 * #623 — the edit writer against **real Postgres**, and the round-trip the card asks for.
 *
 * `tests/relationship-edit.test.ts` proves the cost arithmetic over values. This file proves the
 * SQL: that an edit writes the copy, a new immutable version and the pin in one transaction; that
 * the answers belonging to a turned-off Aspect are the ones it deletes and no others; and that the
 * edited session still parses through `lib/db/rows.ts` — the read boundary every party-facing page
 * uses. A fake SQL surface cannot answer any of those, which is exactly why #619's payment card
 * found four defects only a real branch exposed.
 *
 * **Skipped unless `DATABASE_URL` is set**, like the other `*-live.test.ts` files: the gate has no
 * connection string by design, so this costs CI nothing and runs when somebody points it at a
 * branch. It creates every row under a `probe-edit-…` id and deletes them in `afterAll`.
 *
 *     DATABASE_URL=<branch url> npx vitest run tests/relationship-edit-live.test.ts
 */
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { assessmentInstanceFromRows, type OptionRow } from "@/lib/db/rows";
import { editRelationship, readRelationshipEditState } from "@/lib/member/relationship-edit";

const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
const live = databaseUrl === "" ? describe.skip : describe;
const TAG = `probe-edit-${Date.now().toString(36)}`;
const DAY = 86_400_000;
const START = new Date("2026-03-01T12:00:00.000Z");
const day = (n: number) => new Date(START.getTime() + n * DAY);

const pool = new Pool({ connectionString: databaseUrl, max: 2 });

const relationshipId = `${TAG}-rel`;
const templateId = `${TAG}-template`;
const versionId = `${TAG}-version-v1`;
const sessionId = `${TAG}-session`;
const actor = `${TAG}-initiator-user`;

const ASPECTS = [
  {
    id: "a1",
    prompt: "How we talk",
    scale: { kind: "score", min: 1, max: 5 },
    leftValue: "Closed",
    rightValue: "Open",
  },
  {
    id: "a2",
    prompt: "Chores",
    scale: { kind: "score", min: 1, max: 5 },
    leftValue: "Mine",
    rightValue: "Shared",
  },
];

/** The version payload — a `zAssessment` the reader parses, which is what V4 compares a copy to. */
function payload(title: string) {
  return JSON.stringify({
    id: templateId,
    slug: "edit-probe",
    type: "assessment",
    status: "draft",
    date: START.toISOString(),
    title,
    summary: "Two sheets",
    items: ASPECTS,
  });
}

async function insertRecord(id: string, title: string): Promise<void> {
  await pool.query(
    `INSERT INTO record (id, slug, record_type, status, date, title, summary, author_user_id, owner_user_id, visibility)
     VALUES ($1, $1, 'assessment', 'draft', now(), $2, 'Two sheets', NULL, NULL, 'private')`,
    [id, title],
  );
}

async function insertItems(recordId: string): Promise<void> {
  for (const [position, aspect] of ASPECTS.entries()) {
    await pool.query(
      `INSERT INTO item (record_id, item_id, position, prompt, scale_kind, left_value, right_value)
       VALUES ($1, $2, $3, $4, 'score', $5, $6)`,
      [recordId, aspect.id, position, aspect.prompt, aspect.leftValue, aspect.rightValue],
    );
  }
}

beforeAll(async () => {
  if (databaseUrl === "") return;

  await insertRecord(templateId, "Avery & Rowan");
  await insertItems(templateId);
  await pool.query(
    `INSERT INTO template_version (id, template_record_id, version, payload, published_at, published_by)
     VALUES ($1, $2, 1, $3::jsonb, $4, NULL)`,
    [versionId, templateId, payload("Avery & Rowan"), day(-30).toISOString()],
  );
  await pool.query(
    `INSERT INTO relationship
       (id, template_id, template_version_id, initiator_user_id, status, created_at, published_at)
     VALUES ($1, $2, $3, $4, 'active', $5, $6)`,
    [relationshipId, templateId, versionId, actor, day(-30), day(-29)],
  );

  await insertRecord(sessionId, "Avery & Rowan");
  await insertItems(sessionId);
  await pool.query(
    `INSERT INTO session (record_id, template_record_id, relationship_id, name, mode, alignment_setting, round)
     VALUES ($1, $2, $3, 'Avery & Rowan', 'basic', 'soft', 1)`,
    [sessionId, templateId, relationshipId],
  );
  await pool.query(
    `INSERT INTO party (session_record_id, role, name, user_id, accepted_at)
     VALUES ($1, 'initiator', 'Avery', $2, $3), ($1, 'counterparty', 'Rowan', NULL, $3)`,
    [sessionId, actor, day(-28).toISOString()],
  );
  // Both seats answered both Aspects — the sheet is full, which is the state the owner's decision
  // is about: a removal here has a real cost to state.
  await pool.query(
    `INSERT INTO opinion (session_record_id, role, item_id, feel, wish)
     VALUES ($1, 'initiator', 'a1', 3, 4), ($1, 'initiator', 'a2', 2, 5),
            ($1, 'counterparty', 'a1', 4, 4), ($1, 'counterparty', 'a2', 1, 5)`,
    [sessionId],
  );
});

afterAll(async () => {
  if (databaseUrl === "") {
    await pool.end();
    return;
  }
  await pool.query("DELETE FROM admin_action WHERE target_id = $1", [relationshipId]);
  await pool.query("DELETE FROM opinion WHERE session_record_id = $1", [sessionId]);
  await pool.query("DELETE FROM party WHERE session_record_id = $1", [sessionId]);
  await pool.query("DELETE FROM session WHERE record_id = $1", [sessionId]);
  await pool.query("DELETE FROM item WHERE record_id = ANY($1::text[])", [[sessionId, templateId]]);
  await pool.query("DELETE FROM relationship WHERE id = $1", [relationshipId]);
  await pool.query("DELETE FROM template_version WHERE template_record_id = $1", [templateId]);
  await pool.query("DELETE FROM record WHERE id = ANY($1::text[])", [[sessionId, templateId]]);
  await pool.end();
});

live("the edit writer", () => {
  it("reads the state a surface draws: every field, the pin's versions, the per-seat counts", async () => {
    const state = await readRelationshipEditState({ actorUserId: actor, relationshipId });
    expect(state).toBeDefined();
    expect(state?.aspects.map((aspect) => aspect.id)).toEqual(["a1", "a2"]);
    expect(state?.versions).toHaveLength(1);
    expect(state?.versions[0]?.current).toBe(true);
    expect(state?.sessionExists).toBe(true);
    expect(state?.answers).toEqual([
      { aspectId: "a1", role: "counterparty", name: "Rowan", answers: 1 },
      { aspectId: "a1", role: "initiator", name: "Avery", answers: 1 },
      { aspectId: "a2", role: "counterparty", name: "Rowan", answers: 1 },
      { aspectId: "a2", role: "initiator", name: "Avery", answers: 1 },
    ]);
  }, 30_000);

  it("refuses the removal until the cost is confirmed", async () => {
    const state = await readRelationshipEditState({ actorUserId: actor, relationshipId });
    const record = { ...state!.record, items: [state!.record.items[0]!] };
    await expect(
      editRelationship({
        actorUserId: actor,
        relationshipId,
        reason: "probe: remove an answered Aspect without confirming",
        draft: { record },
      }),
    ).rejects.toThrow(/invalidation has to be confirmed/);
  }, 30_000);

  it("edits title and Aspects, discards exactly the removed Aspect's answers, and re-reads clean", async () => {
    const state = await readRelationshipEditState({ actorUserId: actor, relationshipId });
    const kept = state!.record.items[0]!;
    const result = await editRelationship({
      actorUserId: actor,
      relationshipId,
      reason: "probe: retitle and turn off the second Aspect",
      draft: { record: { ...state!.record, title: "Avery & Rowan, second pass", items: [kept] } },
      confirmInvalidation: true,
    });

    expect(result.after.discardedAnswers).toBe(2);
    expect(result.after.version).toBe(2);
    expect(result.after.title).toBe("Avery & Rowan, second pass");

    // The copy, the session copy and the pin all moved together — which is what V4 compares.
    const { rows: bound } = await pool.query<{ template_version_id: string }>(
      "SELECT template_version_id FROM relationship WHERE id = $1",
      [relationshipId],
    );
    const { rows: version } = await pool.query<{
      id: string;
      payload: { items: { id: string }[] };
    }>("SELECT id, payload FROM template_version WHERE id = $1", [bound[0]!.template_version_id]);
    expect(version[0]?.payload.items.map((item) => item.id)).toEqual(["a1"]);

    const { rows: opinions } = await pool.query<{ role: string; item_id: string }>(
      "SELECT role, item_id FROM opinion WHERE session_record_id = $1 ORDER BY role, item_id",
      [sessionId],
    );
    expect(opinions).toEqual([
      { role: "counterparty", item_id: "a1" },
      { role: "initiator", item_id: "a1" },
    ]);

    // The round-trip the card asks for: the edited session still parses through the read boundary.
    const { rows: records } = await pool.query("SELECT * FROM record WHERE id = $1", [sessionId]);
    const { rows: items } = await pool.query(
      "SELECT record_id, item_id, position, prompt, scale_kind, left_value, right_value FROM item WHERE record_id = $1 ORDER BY position",
      [sessionId],
    );
    const { rows: parties } = await pool.query(
      "SELECT session_record_id, role, name, submitted_at, accepted_at, impersonated_by FROM party WHERE session_record_id = $1",
      [sessionId],
    );
    const { rows: session } = await pool.query(
      "SELECT record_id, template_record_id, relationship_id, mode, alignment_setting AS setting, name FROM session WHERE record_id = $1",
      [sessionId],
    );
    const { rows: opinionRows } = await pool.query(
      "SELECT session_record_id, role, item_id, feel, wish, think, guess FROM opinion WHERE session_record_id = $1 ORDER BY role, item_id",
      [sessionId],
    );
    const instance = assessmentInstanceFromRows({
      record: records[0],
      items,
      options: [] as OptionRow[],
      instance: session[0],
      parties,
      opinions: opinionRows,
    });
    expect(instance.items.map((item) => item.id)).toEqual(["a1"]);
    expect(instance.title).toBe("Avery & Rowan, second pass");
    expect(instance.parties.map((party) => party.opinions.length)).toEqual([1, 1]);

    // And an edited row leaves one audit entry that names what it discarded.
    const { rows: audit } = await pool.query<{
      action: string;
      after: { discardedAnswers: number };
    }>("SELECT action, after FROM admin_action WHERE target_id = $1", [relationshipId]);
    expect(audit.at(-1)?.action).toBe("relationship.edit");
    expect(audit.at(-1)?.after.discardedAnswers).toBe(2);
  }, 60_000);
});
