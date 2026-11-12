/**
 * Deleting an authored template against **real Postgres** (#743) — the four claims a stub client
 * cannot answer, because three of them are foreign keys and one is a list's SQL predicate.
 *
 * `tests/template-delete.test.ts` proves the transaction's shape: which statements it issues, in
 * which order, and that a refusal writes nothing. This file proves what the database then says:
 *
 *   the draft      a template with no version and no relationship is really gone — the `record`
 *                  row and its `item` rows, through the cascade, in one statement.
 *   the promise    a template that was published or that a relationship was started from is
 *                  refused, and the refusal left every row exactly as it was: the relationship
 *                  still reads through `readMyRelationship()` — its title and its Aspects.
 *   the copy       the relationship's own private record is a **different** `record`, and it is
 *                  not a row this library lists. That is the one thing this card must never do,
 *                  and it is also what keeps the delete control off a live relationship's copy.
 *
 * **Skipped unless `DATABASE_URL` is set**, like every other `*-live.test.ts`: the gate has no
 * connection string by design (`docs/GATE.md`), so this costs CI nothing and runs when somebody
 * points it at a branch. Point it at the **demo** branch — the production host is refused outright
 * rather than trusted to the caller's memory:
 *
 *     DATABASE_URL=<demo unpooled url> npx vitest run tests/template-delete-live.test.ts
 *
 * Every row is created here under a `probe-del-…` tag and removed in `afterAll`. No seeded row is
 * read, changed or deleted.
 */
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { listLibraryTemplates } from "@/lib/db/template-library";
import { deleteTemplate } from "@/lib/flow/templates";
import { readMyRelationship } from "@/lib/member/relationships";

const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
const live = databaseUrl === "" ? describe.skip : describe;

/** The live endpoint `ep-winter-block` is production; a probe must never open a connection to it. */
const PRODUCTION_HOST = "ep-winter-block-b4bkk1xc";
const host = databaseUrl === "" ? "(none)" : (databaseUrl.match(/@([^/:]+)/)?.[1] ?? "(unknown)");
const onProduction = host.startsWith(PRODUCTION_HOST);

const pool = new Pool({
  connectionString: databaseUrl,
  max: 2,
  application_name: "template-delete",
});

const TAG = `probe-del-${Date.now().toString(36)}`;
const OWNER = `${TAG}-owner`;
const OTHER = `${TAG}-other`;

/** The five rows this file judges. */
const draftId = `${TAG}-draft`;
const publishedId = `${TAG}-published`;
const usedId = `${TAG}-used`;
const someoneElsesId = `${TAG}-theirs`;
/** The relationship started from `used`, and the private copy it owns. */
const relationshipId = `${TAG}-rel`;
const legacyRelationshipId = `${TAG}-legacy-rel`;
const copyId = `${TAG}-rel-copy`;

const ASPECTS = [
  { id: "aspect-1", prompt: "How we talk", left: "Closed", right: "Open" },
  { id: "aspect-2", prompt: "Who carries the load", left: "Mine", right: "Shared" },
];

/** A record row. `author` NULL is the platform's; `private` is what a relationship's copy is. */
async function insertRecord(row: {
  id: string;
  status: "draft" | "published";
  title: string;
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
      new Date("2026-11-01T09:00:00.000Z"),
      row.title,
      `${row.title}, written by the probe.`,
      row.author,
      row.visibility ?? "public",
    ],
  );
}

async function insertItems(recordId: string): Promise<void> {
  await pool.query(
    `INSERT INTO item (record_id, item_id, position, prompt, scale_kind, left_value, right_value)
     SELECT $1, t.item_id, t.position, t.prompt, 'score', t.left_text, t.right_text
       FROM unnest($2::text[], $3::int[], $4::text[], $5::text[], $6::text[])
            AS t(item_id, position, prompt, left_text, right_text)`,
    [
      recordId,
      ASPECTS.map((aspect) => aspect.id),
      ASPECTS.map((_, index) => index + 1),
      ASPECTS.map((aspect) => aspect.prompt),
      ASPECTS.map((aspect) => aspect.left),
      ASPECTS.map((aspect) => aspect.right),
    ],
  );
}

async function insertVersion(recordId: string, title: string): Promise<string> {
  const id = `${recordId}-v1`;
  await pool.query(
    `INSERT INTO template_version (id, template_record_id, version, payload, published_at)
     VALUES ($1, $2, 1, $3::jsonb, $4)`,
    [id, recordId, JSON.stringify({ title, items: [] }), new Date("2026-11-01T09:00:00.000Z")],
  );
  return id;
}

async function rowCount(table: "record" | "item", id: string, key: string): Promise<number> {
  const result = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM ${table} WHERE ${key} = $1`,
    [id],
  );
  return Number(result.rows[0]?.n ?? 0);
}

beforeAll(async () => {
  if (onProduction) {
    throw new Error(
      `template-delete-live: refusing to run against production (${host}) — point DATABASE_URL at the demo branch`,
    );
  }
  if (databaseUrl === "") return;
  console.log(`template-delete-live: database host ${host}`);

  // A draft this account wrote: no version, no relationship — the one row delete exists for.
  await insertRecord({ id: draftId, status: "draft", title: "Probe Draft", author: OWNER });
  await insertItems(draftId);

  // Published, never used: refused on its version row.
  await insertRecord({
    id: publishedId,
    status: "published",
    title: "Probe Published",
    author: OWNER,
  });
  await insertItems(publishedId);
  await insertVersion(publishedId, "Probe Published");

  // A relationship was started from it. Two rows, because the app's own create path binds the
  // relationship to its **own copy** (`relationship.template_id` is the copy, never the source),
  // and the legacy shape `0026` backfilled is the one that names the template itself. The second
  // row is what makes delete refuse; the first is what has to keep resolving afterwards.
  await insertRecord({ id: usedId, status: "published", title: "Probe Used", author: OWNER });
  await insertItems(usedId);
  const usedVersionId = await insertVersion(usedId, "Probe Used");

  await insertRecord({
    id: copyId,
    status: "draft",
    title: "Probe Used",
    author: OWNER,
    visibility: "private",
  });
  await insertItems(copyId);
  const copyVersionId = await insertVersion(copyId, "Probe Used");
  await pool.query(
    `INSERT INTO relationship (id, template_id, template_version_id, initiator_user_id, status)
     VALUES ($1, $2, $3, $4, 'draft')`,
    [relationshipId, copyId, copyVersionId, OWNER],
  );
  await pool.query(
    `INSERT INTO relationship (id, template_id, template_version_id, initiator_user_id, status)
     VALUES ($1, $2, $3, $4, 'draft')`,
    [legacyRelationshipId, usedId, usedVersionId, OTHER],
  );

  // Another account's template: refused by the author rule.
  await insertRecord({
    id: someoneElsesId,
    status: "draft",
    title: "Probe Theirs",
    author: OTHER,
  });
  await insertItems(someoneElsesId);
});

afterAll(async () => {
  if (databaseUrl === "" || onProduction) return;
  // Children first, then the records: every one of these is a foreign key with no `ON DELETE`.
  await pool.query("DELETE FROM relationship WHERE id = ANY($1::text[])", [
    [relationshipId, legacyRelationshipId],
  ]);
  await pool.query("DELETE FROM template_version WHERE template_record_id = ANY($1::text[])", [
    [draftId, publishedId, usedId, copyId, someoneElsesId],
  ]);
  await pool.query("DELETE FROM record WHERE id = ANY($1::text[])", [
    [draftId, publishedId, usedId, copyId, someoneElsesId],
  ]);
  await pool.end();
});

live("deleting a template", () => {
  it("removes the draft's record and its Aspect rows, in one statement", async () => {
    expect(await rowCount("item", draftId, "record_id")).toBe(ASPECTS.length);

    const result = await deleteTemplate(draftId, OWNER);

    expect(result).toEqual({ ok: true, template: { id: draftId, title: "Probe Draft" } });
    expect(await rowCount("record", draftId, "id")).toBe(0);
    // The cascade did the second half: no explicit `DELETE FROM item` was issued.
    expect(await rowCount("item", draftId, "record_id")).toBe(0);
  });

  it("refuses a published template on its version row, and leaves the row alone", async () => {
    const result = await deleteTemplate(publishedId, OWNER);

    expect(result).toEqual({ ok: false, code: "template-has-versions" });
    expect(await rowCount("record", publishedId, "id")).toBe(1);
    expect(await rowCount("item", publishedId, "record_id")).toBe(ASPECTS.length);
  });

  it("refuses a template a relationship was started from, and the relationship still resolves", async () => {
    const result = await deleteTemplate(usedId, OWNER);

    expect(result).toEqual({ ok: false, code: "template-has-relationships" });
    expect(await rowCount("record", usedId, "id")).toBe(1);

    // The promise the refusal makes: the pair's relationship reads exactly as it did. Its title
    // and its Aspects come from its own copy, which this card must never reach.
    const view = await readMyRelationship(OWNER, relationshipId);
    expect(view).toBeDefined();
    expect(view?.template.title).toBe("Probe Used");
    expect(view?.template.items.map((item) => item.prompt)).toEqual(
      ASPECTS.map((aspect) => aspect.prompt),
    );
  });

  it("refuses another account's template", async () => {
    const result = await deleteTemplate(someoneElsesId, OWNER);

    expect(result).toEqual({ ok: false, code: "template-not-yours" });
    expect(await rowCount("record", someoneElsesId, "id")).toBe(1);
  });

  it("never lists a relationship's private copy as one of this account's templates", async () => {
    // The copy is a `record` authored by this account, in `draft`, with no session of its own —
    // so every clause of the library's read accepts it unless the read excludes it by name. If it
    // were listed, the row would carry the archive and delete controls this card just gave a
    // draft, over a live relationship's own record.
    const listed = await listLibraryTemplates(OWNER);

    expect(listed.map((template) => template.id)).not.toContain(copyId);
    // The relationship's copy is still there, though: not listed is not deleted.
    expect(await rowCount("record", copyId, "id")).toBe(1);
    expect(await rowCount("item", copyId, "record_id")).toBe(ASPECTS.length);
  });

  it("deleted only the one record — every other probe row is still standing", async () => {
    for (const id of [publishedId, usedId, someoneElsesId, copyId]) {
      expect(await rowCount("record", id, "id")).toBe(1);
    }
    const relationship = await pool.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM relationship WHERE id = ANY($1::text[])",
      [[relationshipId, legacyRelationshipId]],
    );
    expect(Number(relationship.rows[0]?.n ?? 0)).toBe(2);
  });
});
