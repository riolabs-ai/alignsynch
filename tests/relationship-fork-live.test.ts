/**
 * The Counterparty's fork against **real Postgres** (#785) — the three claims a stub cannot answer.
 *
 * `tests/relationship-fork.test.ts` proves the transaction's shape: which statements it issues, in
 * which order, that a stranger writes nothing, and that the payload it copies is the version's. What
 * a stub client cannot answer is what the *database* then says, and that is where this card's
 * acceptance actually lives:
 *
 *   two accounts     a real initiator's relationship, a real bound party row for the counterparty,
 *                    and the fork's `record.author_user_id` / `owner_user_id` read back off the row.
 *   the two lists    the copy appears in `listMyTemplates()` (which filters `owner_user_id`, the
 *                    `/dashboard/templates` read) **and** in `listLibraryTemplates()` (which filters
 *                    `author_user_id`, the library read). This is #785's "it appears under
 *                    `?tab=mine`", proved by the two queries those two screens run.
 *   the pin          the relationship is bound to v1 and the copy's working row was then edited to
 *                    v2, so a fork that read the row would fork v2. It forks v1, and the version row
 *                    it writes carries v1's words.
 *   the refusal      a stranger gets `template-not-yours` and the table is unchanged — the guard was
 *                    narrowed to the seat, not deleted.
 *
 * **Skipped unless `DATABASE_URL` is set**, like every other `*-live.test.ts`: the gate has no
 * connection string by design (`docs/operations/gate.md`). Point it at the **demo** branch — production is
 * refused outright rather than trusted to the caller's memory:
 *
 *     DATABASE_URL=<demo url> npx vitest run tests/relationship-fork-live.test.ts
 *
 * Every row is created here under a `probe-fork-…` tag and removed in `afterAll`. No seeded row is
 * read, changed or deleted.
 */
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { Assessment } from "@/content/assessment";
import { listLibraryTemplates } from "@/lib/db/template-library";
import { forkRelationshipTemplate } from "@/lib/flow/templates";
import { readMyRelationship } from "@/lib/member/relationships";
import { listMyTemplates } from "@/lib/member/templates";

const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
const live = databaseUrl === "" ? describe.skip : describe;

/** The live endpoint `ep-winter-block` is production; a probe must never open a connection to it. */
const PRODUCTION_HOST = "ep-winter-block-b4bkk1xc";
const host = databaseUrl === "" ? "(none)" : (databaseUrl.match(/@([^/:]+)/)?.[1] ?? "(unknown)");
const onProduction = host.startsWith(PRODUCTION_HOST);

const pool = new Pool({
  connectionString: databaseUrl,
  max: 2,
  application_name: "relationship-fork",
});

const TAG = `probe-fork-${Date.now().toString(36)}`;
const INITIATOR = `${TAG}-initiator`;
const COUNTERPARTY = `${TAG}-counterparty`;
const STRANGER = `${TAG}-stranger`;

const sourceId = `${TAG}-source`;
const copyId = `${TAG}-copy`;
const sessionId = `${TAG}-session`;
const relationshipId = `${TAG}-rel`;
const v1Id = `${TAG}-copy-v1`;
const v2Id = `${TAG}-copy-v2`;

const PUBLISHED_AT = new Date("2026-11-01T09:00:00.000Z");
const CREATED_AT = new Date("2026-11-02T09:00:00.000Z");

/** The words the pair were invited on — v1. Three Aspects. */
const V1_TITLE = `${TAG} Weekly Reset`;
const V1_PROMPTS = [
  "How often do we check in?",
  "Who plans the weekend?",
  "How is money talked about?",
];

/** The words the author's working copy holds now — v2. Two Aspects, the first one reworded. */
const V2_TITLE = `${TAG} Weekly Reset, revised`;
const V2_PROMPTS = ["How often do we really check in?", "Who plans the weekend?"];

/** A `zAssessment` object, as a version's `payload` — the schema parses it strictly on the way out. */
function templateOf(title: string, prompts: readonly string[]): Assessment {
  return {
    id: copyId,
    slug: copyId,
    type: "assessment",
    status: "published",
    date: PUBLISHED_AT.toISOString(),
    title,
    summary: `${prompts.length} Aspects, as the pair were asked them.`,
    items: prompts.map((prompt, index) => ({
      id: `aspect-${String(index + 1)}`,
      prompt,
      scale: { kind: "score", min: 1, max: 5 },
      leftValue: `Left ${String(index + 1)}`,
      rightValue: `Right ${String(index + 1)}`,
    })),
  };
}

async function insertRecord(row: {
  id: string;
  status: "draft" | "published";
  title: string;
  summary: string;
  author: string | null;
  visibility?: "public" | "private";
}): Promise<void> {
  await pool.query(
    `INSERT INTO record
       (id, slug, record_type, status, date, title, summary, author_user_id, owner_user_id, visibility)
     VALUES ($1, $2, 'assessment', $3, $4, $5, $6, $7, $7, $8)`,
    [
      row.id,
      row.id,
      row.status,
      PUBLISHED_AT,
      row.title,
      row.summary,
      row.author,
      row.visibility ?? "private",
    ],
  );
}

async function insertItems(recordId: string, prompts: readonly string[]): Promise<void> {
  await pool.query(
    `INSERT INTO item (record_id, item_id, position, prompt, scale_kind, left_value, right_value)
     SELECT $1, t.item_id, t.position, t.prompt, 'score', t.left_text, t.right_text
       FROM unnest($2::text[], $3::int[], $4::text[], $5::text[], $6::text[])
            AS t(item_id, position, prompt, left_text, right_text)`,
    [
      recordId,
      prompts.map((_, index) => `aspect-${String(index + 1)}`),
      prompts.map((_, index) => index + 1),
      prompts,
      prompts.map((_, index) => `Left ${String(index + 1)}`),
      prompts.map((_, index) => `Right ${String(index + 1)}`),
    ],
  );
}

beforeAll(async () => {
  if (onProduction) {
    throw new Error(
      `relationship-fork-live: refusing to run against production (${host}) — point DATABASE_URL at the demo branch`,
    );
  }
  if (databaseUrl === "") return;
  console.log(`relationship-fork-live: database host ${host}`);

  // The template the initiator started from — published, private, theirs. It is the row #785's
  // preamble says the library filters out of everybody else's list.
  await insertRecord({
    id: sourceId,
    status: "published",
    title: V2_TITLE,
    summary: "The initiator's own template.",
    author: INITIATOR,
  });
  await insertItems(sourceId, V2_PROMPTS);

  // The relationship's **private copy**, bound to v1 and then edited to v2 — exactly the drift
  // `0026_template_version.sql` exists for. The version rows are the source of truth for a party.
  await insertRecord({
    id: copyId,
    status: "published",
    title: V2_TITLE,
    summary: "The relationship's own configuration, edited after the invitation.",
    author: INITIATOR,
  });
  await insertItems(copyId, V2_PROMPTS);

  await pool.query(
    `INSERT INTO template_version (id, template_record_id, version, payload, published_at, published_by)
     VALUES ($1, $2, 1, $3::jsonb, $4, $5)`,
    [v1Id, copyId, JSON.stringify(templateOf(V1_TITLE, V1_PROMPTS)), PUBLISHED_AT, INITIATOR],
  );
  await pool.query(
    `INSERT INTO template_version (id, template_record_id, version, payload, published_at, published_by)
     VALUES ($1, $2, 2, $3::jsonb, $4, $5)`,
    [v2Id, copyId, JSON.stringify(templateOf(V2_TITLE, V2_PROMPTS)), CREATED_AT, INITIATOR],
  );
  // v1 is superseded — the pin is a fact about the relationship's column, not about which row is
  // newest, and the fork must honour the column.
  await pool.query("UPDATE template_version SET superseded_at = $2 WHERE id = $1", [
    v1Id,
    CREATED_AT,
  ]);

  await pool.query(
    `INSERT INTO relationship
       (id, template_id, template_version_id, initiator_user_id, status, created_at, published_at)
     VALUES ($1, $2, $3, $4, 'active', $5, $6)`,
    [relationshipId, copyId, v1Id, INITIATOR, CREATED_AT, CREATED_AT],
  );

  // A session and both seats: `party.user_id` on the counterparty row is the claim's own write
  // (`lib/flow/store.ts`), and it is the row the fork's seat predicate reads.
  await insertRecord({
    id: sessionId,
    status: "published",
    title: V1_TITLE,
    summary: "The session's own copy.",
    author: INITIATOR,
  });
  await insertItems(sessionId, V1_PROMPTS);
  await pool.query(
    `INSERT INTO session (record_id, template_record_id, relationship_id, name, mode, alignment_setting, round)
     VALUES ($1, $2, $3, $4, 'basic', 'soft', 1)`,
    [sessionId, copyId, relationshipId, V1_TITLE],
  );
  await pool.query(
    `INSERT INTO party (session_record_id, role, name, user_id)
     VALUES ($1, 'initiator', 'Init', $2), ($1, 'counterparty', 'Counter', $3)`,
    [sessionId, INITIATOR, COUNTERPARTY],
  );
});

afterAll(async () => {
  if (databaseUrl === "" || onProduction) return;
  // The orders the foreign keys require: seats, session, relationship, versions, records. The fork's
  // own rows are found by **account**, not by id: the store names a new template `assessment-<uuid>`,
  // so the tag is in the author, never in the primary key.
  const accounts = [INITIATOR, COUNTERPARTY, STRANGER];
  const forked = "(SELECT id FROM record WHERE author_user_id = ANY($1::text[]))";
  await pool.query("DELETE FROM party WHERE session_record_id = $1", [sessionId]);
  await pool.query("DELETE FROM session WHERE relationship_id = $1", [relationshipId]);
  await pool.query("DELETE FROM relationship WHERE id = $1", [relationshipId]);
  await pool.query(
    `DELETE FROM template_version
      WHERE template_record_id = ANY($2::text[])
         OR template_record_id IN ${forked}`,
    [accounts, [sourceId, copyId, sessionId]],
  );
  await pool.query(`DELETE FROM record WHERE id = ANY($2::text[]) OR id IN ${forked}`, [
    accounts,
    [sourceId, copyId, sessionId],
  ]);
  await pool.end();
});

live("a party forks the relationship's template (#785), against Postgres", () => {
  it("writes a record the Counterparty owns, holding the version they were asked on", async () => {
    const result = await forkRelationshipTemplate(relationshipId, COUNTERPARTY);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // The pin, not the working copy: v1's title and v1's three Aspects, although the copy's row
    // and its newest version both say otherwise.
    expect(result.template.title).toBe(`${V1_TITLE} (copy)`);
    expect(result.template.aspectCount).toBe(3);

    const { rows: written } = await pool.query<{
      author_user_id: string;
      owner_user_id: string;
      visibility: string;
      status: string;
    }>("SELECT author_user_id, owner_user_id, visibility, status FROM record WHERE id = $1", [
      result.template.id,
    ]);
    // The claim the card exists for, read back off the row.
    expect(written[0]?.author_user_id).toBe(COUNTERPARTY);
    expect(written[0]?.owner_user_id).toBe(COUNTERPARTY);
    expect(written[0]?.visibility).toBe("private");
    expect(written[0]?.status).toBe("published");

    const { rows: copied } = await pool.query<{ prompt: string }>(
      "SELECT prompt FROM item WHERE record_id = $1 ORDER BY position",
      [result.template.id],
    );
    expect(copied.map((row) => row.prompt)).toEqual(V1_PROMPTS);

    // A published template carries a v1, or nothing could start a relationship from it (#502b).
    const { rows: versions } = await pool.query<{ version: number; payload: Assessment }>(
      "SELECT version, payload FROM template_version WHERE template_record_id = $1",
      [result.template.id],
    );
    expect(versions.map((row) => row.version)).toEqual([1]);
    expect(versions[0]?.payload.title).toBe(`${V1_TITLE} (copy)`);
    expect(versions[0]?.payload.items.map((item) => item.prompt)).toEqual(V1_PROMPTS);

    // #785's "it appears under ?tab=mine": the two reads behind the two screens both list it.
    // `listMyTemplates` filters `owner_user_id`; `listLibraryTemplates` filters `author_user_id`.
    const mine = await listMyTemplates(COUNTERPARTY);
    expect(mine.map((row) => row.title)).toContain(`${V1_TITLE} (copy)`);
    expect(mine.find((row) => row.id === result.template.id)?.aspectCount).toBe(3);

    const library = await listLibraryTemplates(COUNTERPARTY);
    const listed = library.find((row) => row.id === result.template.id);
    expect(listed?.authorship).toBe("mine");
    expect(listed?.aspectCount).toBe(3);

    // The relationship is untouched: same pin, same session count, same seats.
    const { rows: rel } = await pool.query<{ template_version_id: string; template_id: string }>(
      "SELECT template_version_id, template_id FROM relationship WHERE id = $1",
      [relationshipId],
    );
    expect(rel[0]?.template_version_id).toBe(v1Id);
    expect(rel[0]?.template_id).toBe(copyId);
    const { rows: sessions } = await pool.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM session WHERE relationship_id = $1",
      [relationshipId],
    );
    expect(Number(sessions[0]?.n)).toBe(1);
    const { rows: seats } = await pool.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM party WHERE session_record_id = $1",
      [sessionId],
    );
    expect(Number(seats[0]?.n)).toBe(2);
  });

  it("takes it twice without a second row (#785 criterion 5)", async () => {
    const first = await forkRelationshipTemplate(relationshipId, COUNTERPARTY);
    expect(first.ok).toBe(true);

    const second = await forkRelationshipTemplate(relationshipId, COUNTERPARTY);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.reused).toBe(true);
    expect(second.template.id).toBe(first.template.id);

    const { rows } = await pool.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM record WHERE title = $1 AND author_user_id = $2",
      [`${V1_TITLE} (copy)`, COUNTERPARTY],
    );
    expect(Number(rows[0]?.n)).toBe(1);
  });

  it("refuses a stranger and writes nothing", async () => {
    const before = await pool.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM record WHERE author_user_id = $1",
      [STRANGER],
    );

    const result = await forkRelationshipTemplate(relationshipId, STRANGER);
    expect(result).toEqual({ ok: false, code: "template-not-yours" });

    const after = await pool.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM record WHERE author_user_id = $1",
      [STRANGER],
    );
    expect(Number(after.rows[0]?.n)).toBe(Number(before.rows[0]?.n));
  });

  it("draws the action for the Counterparty and not for the initiator", async () => {
    const asCounterparty = await readMyRelationship(COUNTERPARTY, relationshipId);
    const asInitiator = await readMyRelationship(INITIATOR, relationshipId);

    expect(asCounterparty?.canForkTemplate).toBe(true);
    // The initiator owns the copy, so the screen offers them nothing they already have.
    expect(asInitiator?.canForkTemplate).toBe(false);
  });
});
