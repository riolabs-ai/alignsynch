/**
 * #936 against **real Postgres** — the relationship the flow created shows the Aspect the creator
 * added, on the screen that is supposed to show it.
 *
 * The owner's report was a display defect, and the trace it came with is one sentence long: view a
 * relationship whose Aspect was added at stage 3 → the Aspect is not in the list. The write was
 * never in question. `createInstanceFromTemplate()` writes the creator's list onto the **instance
 * record** (`session.record_id`) and keeps `relationship.template_id` naming the template it copied
 * (V23 pins the version to that template, so the column cannot move); every reader on the
 * relationship screen read `template_id`, i.e. the catalogue's own Aspects. Saved, and never drawn.
 *
 * So this file drives the customer's own path and then asks the read:
 *
 *   create   `createInstanceFromTemplate()` with three template Aspects and a fourth the creator
 *            typed at stage 3 — the flow's list, ids and all, as the browser posts it.
 *   the rows the instance copy holds four; the **template** still holds three. That is the proof
 *            the write path was correct and the read was not.
 *   the read `readMyRelationship()` hands the detail screen the creator's four, the fourth by
 *            name, and `aspectCount` counts them rather than the template's.
 *
 * **Skipped unless `DATABASE_URL` is set**, like every other `*-live.test.ts` — the gate has no
 * connection string by design. Point it at the **demo** branch; production is refused outright:
 *
 *     DATABASE_URL=<demo unpooled url> npx vitest run tests/relationship-aspects-view-live.test.ts
 *
 * Every row is created here under a `probe-view-…` tag and removed in `afterAll`.
 */
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Assessment } from "@/content/assessment";
import { createInstanceFromTemplate } from "@/lib/flow/store";
import { readMyRelationship, saveAspects } from "@/lib/member/relationships";

const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";

/** The live endpoint `ep-winter-block` is production; a probe must never open a connection to it. */
const PRODUCTION_HOST = "ep-winter-block-b4bkk1xc";
const host = databaseUrl === "" ? "(none)" : (databaseUrl.match(/@([^/:]+)/)?.[1] ?? "(unknown)");
const onProduction = host.startsWith(PRODUCTION_HOST);

/** No connection string, or the production host: the file reads as skipped, never as passing. */
const live = databaseUrl === "" || onProduction ? describe.skip : describe;

const pool = new Pool({
  connectionString: databaseUrl,
  max: 2,
  application_name: "relationship-aspects-view",
});

const TAG = `probe-view-${Date.now().toString(36)}`;
const INITIATOR = `${TAG}-initiator`;
const SOURCE = `${TAG}-template`;
const VERSION = `${TAG}-v1`;

const NOW = new Date("2026-11-12T09:00:00.000Z");

/** The template's own three, in the order its version holds them. */
const TEMPLATE_PROMPTS = [
  "How often do we check in?",
  "Who plans the weekend?",
  "How is money talked about?",
];

/** The fourth — what the owner typed into `Add an Aspect` at stage 3. */
const ADDED_PROMPT = "Do we say thank you?";

function templateOf(): Assessment {
  return {
    id: SOURCE,
    slug: SOURCE,
    type: "assessment",
    status: "published",
    date: NOW.toISOString(),
    title: `${TAG} Weekly Reset`,
    summary: "Three Aspects, as the template was published.",
    items: TEMPLATE_PROMPTS.map((prompt, index) => ({
      id: `aspect-${String(index + 1)}`,
      prompt,
      scale: { kind: "score", min: 1, max: 5 },
      leftValue: `Left ${String(index + 1)}`,
      rightValue: `Right ${String(index + 1)}`,
    })),
  };
}

/** Every row this file creates, so `afterAll` can remove exactly them. */
let instanceRecordId: string | undefined;
let relationshipId: string | undefined;

beforeAll(async () => {
  if (onProduction) return;
  await pool.query(
    `INSERT INTO record
       (id, slug, record_type, status, date, title, summary, author_user_id, owner_user_id, visibility)
     VALUES ($1, $1, 'assessment', 'published', $2, $3, $4, NULL, NULL, 'public')`,
    [SOURCE, NOW, `${TAG} Weekly Reset`, "Three Aspects, as the template was published."],
  );
  for (const [position, item] of templateOf().items.entries()) {
    await pool.query(
      `INSERT INTO item (record_id, item_id, position, prompt, scale_kind, left_value, right_value)
       VALUES ($1, $2, $3, $4, 'score', $5, $6)`,
      [SOURCE, item.id, position, item.prompt, item.leftValue, item.rightValue],
    );
  }
  await pool.query(
    `INSERT INTO template_version
       (id, template_record_id, version, payload, published_at, published_by)
     VALUES ($1, $2, 1, $3, $4, $5)`,
    [VERSION, SOURCE, JSON.stringify(templateOf()), NOW, INITIATOR],
  );

  const created = await createInstanceFromTemplate({
    templateRecordId: SOURCE,
    initiatorName: "Avery",
    counterpartyName: "Rowan",
    email: "rowan@example.test",
    mode: "basic",
    alignmentSetting: "soft",
    title: `${TAG} Weekly Reset, ours`,
    draft: true,
    viewerUserId: INITIATOR,
    viewerEmail: "avery@example.test",
    now: NOW,
    /*
     * The browser's own payload: the three version Aspects by id, plus the row the person added.
     * `new-1` is the list's placeholder for a row no server has seen — `aspectsToWrite()` mints the
     * real id, exactly as it does on the live screen.
     */
    aspects: [
      ...templateOf().items.map((item) => ({
        id: item.id,
        prompt: item.prompt,
        leftValue: item.leftValue,
        rightValue: item.rightValue,
      })),
      { id: "new-1", prompt: ADDED_PROMPT, leftValue: "Never", rightValue: "Daily" },
    ],
  });
  instanceRecordId = created.instanceRecordId;
  const bound = await pool.query<{ relationship_id: string }>(
    "SELECT relationship_id FROM session WHERE record_id = $1",
    [created.instanceRecordId],
  );
  relationshipId = bound.rows[0]?.relationship_id;
});

afterAll(async () => {
  if (onProduction) return;
  if (relationshipId !== undefined) {
    await pool.query(
      "DELETE FROM session_invite WHERE session_record_id IN (SELECT record_id FROM session WHERE relationship_id = $1)",
      [relationshipId],
    );
    await pool.query(
      "DELETE FROM party WHERE session_record_id IN (SELECT record_id FROM session WHERE relationship_id = $1)",
      [relationshipId],
    );
    await pool.query("DELETE FROM relationship_payment WHERE relationship_id = $1", [
      relationshipId,
    ]);
    await pool.query("DELETE FROM relationship_member WHERE relationship_id = $1", [
      relationshipId,
    ]);
    await pool.query("DELETE FROM session WHERE relationship_id = $1", [relationshipId]);
    await pool.query("DELETE FROM relationship WHERE id = $1", [relationshipId]);
  }
  // The version is pinned by the relationship and owned by the record, so it goes between them.
  await pool.query("DELETE FROM template_version WHERE template_record_id = $1", [SOURCE]);
  for (const recordId of [instanceRecordId, SOURCE]) {
    if (recordId === undefined) continue;
    await pool.query("DELETE FROM opinion WHERE session_record_id = $1", [recordId]);
    await pool.query("DELETE FROM item WHERE record_id = $1", [recordId]);
    await pool.query("DELETE FROM response_option WHERE record_id = $1", [recordId]);
    await pool.query("DELETE FROM record WHERE id = $1", [recordId]);
  }
  await pool.end();
});

live("#936 · a relationship shows the Aspect its creator added", () => {
  it("writes the added Aspect onto the relationship's own copy, not onto the template", async () => {
    const copy = await pool.query<{ item_id: string; prompt: string }>(
      "SELECT item_id, prompt FROM item WHERE record_id = $1 ORDER BY position",
      [instanceRecordId],
    );
    expect(copy.rows.map((row) => row.prompt)).toEqual([...TEMPLATE_PROMPTS, ADDED_PROMPT]);
    // The placeholder never becomes an id: every row in `item` is a real handle (#699).
    expect(copy.rows.every((row) => row.item_id.startsWith("aspect-"))).toBe(true);

    const onTemplate = await pool.query<{ prompt: string }>(
      "SELECT prompt FROM item WHERE record_id = $1 ORDER BY position",
      [SOURCE],
    );
    expect(onTemplate.rows.map((row) => row.prompt)).toEqual(TEMPLATE_PROMPTS);
  });

  it("hands the detail screen the creator's four, with the added one by name", async () => {
    expect(relationshipId).toBeDefined();
    const view = await readMyRelationship(INITIATOR, relationshipId as string, NOW);
    if (view === undefined)
      throw new Error("the relationship the create just wrote cannot be read");
    expect(view.template.items.map((item) => item.prompt)).toEqual([
      ...TEMPLATE_PROMPTS,
      ADDED_PROMPT,
    ]);
    // The count the card prints is the same list's length, not the template's (#936).
    expect(view.aspectCount).toBe(4);
    // The list names the record it came from: the copy, which is what the page's writers send back.
    expect(view.templateId).toBe(instanceRecordId);
  });

  it("round-trips a save through the same copy, and leaves the template alone", async () => {
    const view = await readMyRelationship(INITIATOR, relationshipId as string, NOW);
    if (view === undefined) throw new Error("the relationship cannot be read");
    const saved = await saveAspects({
      actorUserId: INITIATOR,
      reason: "probe: save the list the screen drew",
      relationshipId: relationshipId as string,
      record: {
        ...view.template,
        // The editor's own write: the same rows, with the added one reworded.
        items: view.template.items.map((item) =>
          item.prompt === ADDED_PROMPT ? { ...item, prompt: `${ADDED_PROMPT} (reworded)` } : item,
        ),
      },
      saveAs: "draft",
      now: NOW,
    });
    expect(saved.after.aspectIds).toHaveLength(4);

    const reread = await readMyRelationship(INITIATOR, relationshipId as string, NOW);
    expect(reread?.template.items.map((item) => item.prompt)).toEqual([
      ...TEMPLATE_PROMPTS,
      `${ADDED_PROMPT} (reworded)`,
    ]);
    // The template the relationship was copied from is untouched by a member's save.
    const onTemplate = await pool.query<{ prompt: string }>(
      "SELECT prompt FROM item WHERE record_id = $1 ORDER BY position",
      [SOURCE],
    );
    expect(onTemplate.rows.map((row) => row.prompt)).toEqual(TEMPLATE_PROMPTS);
  }, 30_000);
});
