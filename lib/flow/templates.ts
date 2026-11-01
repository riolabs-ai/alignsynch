/**
 * Writing a template — the one operation that makes a record with Aspects and no parties (#255).
 *
 * Everything else in `lib/flow/` assumes a template exists: `createInstanceFromTemplate` copies
 * one, the answer screen reads a copy, the report draws a copy. This module is where the template
 * itself comes from, and it writes exactly what the model already describes
 * (`content/assessment.ts::zAssessment`): a `record` row of type `assessment`, `published`, and its
 * `item` rows — **no `session` row, no `party` row, no `response_option` row**. That
 * absence is not a missing feature: a template with parties is an instance by definition, which is
 * `strict()` in the schema and a foreign key in SQL.
 *
 * No new table, no new column beyond the author: `record.author_user_id` exists since
 * `0011_console_columns.sql` and this module is its **first writer** — the id is the session's
 * (`currentUser().userId`, resolved by the route from the request's own cookies), never a form
 * field. Before this, four seeded templates and one a person wrote were the same kind of row;
 * now the author is the one fact that tells them apart, and "My Templates" is that filter.
 * A template written by a caller with no session keeps `NULL` and therefore reads as a
 * built-in, which is the honest answer: nobody signed for it.
 *
 * The Aspect ids are `aspect-1`…`aspect-n` in authored order, and `position` is that order. Order
 * is part of what a party answers, and the copy carries both (`INSERT … SELECT` in `store.ts`), so
 * an instance made from this template asks the questions in the order they were typed.
 */
import { getPool } from "@/lib/db/client";
import { canUseTemplate } from "@/lib/flow/template-library";
import type { TemplateDraft } from "@/lib/flow/template-draft";

/** What a save answers with: enough for a redirect and a notice, nothing that is not stored. */
export interface CreatedTemplate {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly aspectCount: number;
}

/**
 * A kebab-case slug from a title: lower case, accents folded, runs of anything else to one hyphen.
 *
 * `zSlug` is `zId`, so the result has to be legal as one (no leading, trailing or doubled hyphen)
 * or the fixture model and the database would disagree about the same row. A title with no letters
 * or digits at all ("!!!") still needs a slug, so it falls back to the template's own word.
 */
function slugFor(title: string): string {
  const folded = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return folded === "" ? "assessment-template" : folded;
}

/** `assessment-<uuid>` — a kebab-case id that cannot collide with an authored fixture id. */
function templateRecordId(): string {
  return `assessment-${globalThis.crypto.randomUUID()}`;
}

/**
 * Save a draft as a published template, in one transaction, and answer with its record.
 *
 * `published` and not `draft`: `listPublishedTemplates()` filters on it and
 * `createInstanceFromTemplate()` refuses a draft, so a template saved as a draft would exist and be
 * unusable — a worse answer than the form refusing the save. Nothing in this version edits or
 * unpublishes a template (there is no edit surface at all), so "published" is the only state a
 * saved template can be in.
 *
 * The slug is derived from the title and must be unique (`record.slug` is UNIQUE), so the insert
 * asks the database rather than guessing: `ON CONFLICT (slug) DO NOTHING RETURNING id` returns a row
 * only when this transaction won, and the loop tries `-2`, `-3` … until one does. Two people saving
 * the same title at the same instant therefore get two templates instead of one failing.
 */
export async function createAssessmentTemplate(
  draft: TemplateDraft,
  options: { readonly authorUserId?: string | null; readonly now?: Date } = {},
): Promise<CreatedTemplate> {
  const now = options.now ?? new Date();
  const authorUserId = options.authorUserId?.trim() ?? "";
  const id = templateRecordId();
  const base = slugFor(draft.title);
  const aspectCount = draft.aspects.length;
  const summary = `Written in the app: ${aspectCount} Aspect${aspectCount === 1 ? "" : "s"}, each with a Left and a Right Value.`;

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    let slug: string | null = null;
    for (let attempt = 1; attempt <= 50 && slug === null; attempt += 1) {
      const candidate = attempt === 1 ? base : `${base}-${attempt}`;
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO record (id, slug, record_type, status, date, title, summary, author_user_id)
         VALUES ($1, $2, 'assessment', 'published', $3, $4, $5, $6)
         ON CONFLICT (slug) DO NOTHING
         RETURNING id`,
        [
          id,
          candidate,
          now.toISOString(),
          draft.title,
          summary,
          authorUserId === "" ? null : authorUserId,
        ],
      );
      if (inserted.rowCount === 1) slug = candidate;
    }
    if (slug === null) {
      throw new Error(`could not find a free slug for a template titled "${draft.title}"`);
    }

    // One statement for every Aspect, so an item cannot land without its siblings: the arrays are
    // the authored order, and `position` carries it into every copy made from this template.
    await client.query(
      `INSERT INTO item (record_id, item_id, position, prompt, scale_kind, left_value, right_value)
       SELECT $1, t.item_id, t.position, t.prompt, 'score', t.left_value, t.right_value
         FROM unnest($2::text[], $3::int[], $4::text[], $5::text[], $6::text[])
              AS t(item_id, position, prompt, left_value, right_value)`,
      [
        id,
        draft.aspects.map((_, index) => `aspect-${index + 1}`),
        draft.aspects.map((_, index) => index + 1),
        draft.aspects.map((aspect) => aspect.prompt),
        draft.aspects.map((aspect) => aspect.leftValue),
        draft.aspects.map((aspect) => aspect.rightValue),
      ],
    );

    await client.query("COMMIT");
    return { id, slug, title: draft.title, aspectCount };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/* ------------------------------------------------------------------ *\
 * Archive, unarchive, duplicate — the library's row actions
 * ------------------------------------------------------------------ */

/**
 * Why a write on a template was refused. Two codes, because the screen has two different
 * things to say and a third ("that record is an instance") is answered as "no such template":
 * an id that names an instance is not a template the caller asked about, and telling a stranger
 * which ids exist is the one thing a 404 is for.
 */
export type TemplateWriteRefusal = "unknown-template" | "template-not-yours";

/** The template a write landed on — its title is what the redirect's notice names. */
export interface ChangedTemplate {
  readonly id: string;
  readonly title: string;
  readonly status: "published" | "archived";
}

export type TemplateWriteResult =
  | { readonly ok: true; readonly template: ChangedTemplate }
  | { readonly ok: false; readonly code: TemplateWriteRefusal };

export type DuplicateResult =
  | { readonly ok: true; readonly template: CreatedTemplate }
  | { readonly ok: false; readonly code: TemplateWriteRefusal };

/** The row a write begins from: who wrote it, what it is called, and what state it is in. */
interface WritableTemplateRow {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly status: string;
  readonly author_user_id: string | null;
}

/**
 * Archive or unarchive a template — the only write this screen performs on an existing one.
 *
 * **Archiving is not deletion, and it cannot break an instance.** An instance copies its Aspects
 * into its own `item` rows when it is created (`INSERT … SELECT` in `store.ts`), and
 * `/assessment/[slug]` renders from those copies; nothing joins back to the template to draw an
 * answered instance. The template row keeps existing, so `session.template_record_id`
 * still resolves and the report still opens. What changes is two reads that ask for `published`:
 * the catalogue at `/assessment` stops listing it, and `createInstanceFromTemplate` refuses it —
 * so archiving hides it from pickers and blocks new instances, while leaving every existing one
 * exactly as it was. `tests/template-library.test.ts` pins the rule and the live probe in the
 * PR's acceptance creates an instance, archives the template, and opens the instance again.
 *
 * **Only the author may archive.** The `WHERE` names `author_user_id = $2`, so a built-in
 * (author NULL) and another account's template are both refused by the query itself rather than
 * by the route forgetting to check. The row is read `FOR UPDATE` first in the same transaction,
 * because "was I allowed to touch this" and "what did I write" have to be the same snapshot: two
 * archives racing would otherwise both read `published`, and only one could be the author anyway.
 */
export async function setTemplateStatus(
  recordId: string,
  viewerUserId: string,
  status: "published" | "archived",
): Promise<TemplateWriteResult> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const found = await client.query<WritableTemplateRow>(
      `SELECT r.id, r.slug, r.title, r.summary, r.status, r.author_user_id
         FROM record r
        WHERE r.id = $1
          AND r.record_type = 'assessment'
          AND NOT EXISTS (SELECT 1 FROM session ai WHERE ai.record_id = r.id)
          FOR UPDATE OF r`,
      [recordId],
    );
    const row = found.rows[0];
    if (row === undefined) {
      await client.query("ROLLBACK");
      return { ok: false, code: "unknown-template" };
    }
    // The author column is the permission, not a second check beside one: a built-in is `NULL`
    // and another account's id is not this one, so both fail the same comparison.
    if (row.author_user_id !== viewerUserId) {
      await client.query("ROLLBACK");
      return { ok: false, code: "template-not-yours" };
    }

    await client.query("UPDATE record SET status = $2 WHERE id = $1", [recordId, status]);
    await client.query("COMMIT");
    return { ok: true, template: { id: row.id, title: row.title, status } };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Copy a template — built-in or your own — into a new template this account owns.
 *
 * **A duplicate is a new record with copied items, never a pointer.** The copy carries the
 * source's title with " (copy)" appended, its summary, and its Aspects with their order; the
 * copy's ids are its own (`assessment-<uuid>`, `aspect-1…n`), so editing or archiving either one
 * later cannot reach the other, and an instance already made from the source is untouched. This
 * is the same "instances are copies" rule the flow has always used, one level up.
 *
 * **The copy is published and authored by the caller**, whichever state the source is in: the
 * point of duplicating an archived template is to get a usable one back, and unarchiving is the
 * action for wanting the original again (and only its author has that action).
 *
 * Copying a built-in is allowed — that is how a person takes the platform's starting point and
 * makes it theirs — and copying somebody else's template is refused exactly as opening it is.
 */
export async function duplicateTemplate(
  recordId: string,
  viewerUserId: string,
  options: { readonly now?: Date } = {},
): Promise<DuplicateResult> {
  const now = options.now ?? new Date();
  const newId = templateRecordId();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const found = await client.query<WritableTemplateRow>(
      `SELECT r.id, r.slug, r.title, r.summary, r.status, r.author_user_id
         FROM record r
        WHERE r.id = $1
          AND r.record_type = 'assessment'
          AND NOT EXISTS (SELECT 1 FROM session ai WHERE ai.record_id = r.id)
          FOR SHARE OF r`,
      [recordId],
    );
    const source = found.rows[0];
    if (source === undefined) {
      await client.query("ROLLBACK");
      return { ok: false, code: "unknown-template" };
    }
    if (!canUseTemplate(source.author_user_id, viewerUserId)) {
      await client.query("ROLLBACK");
      return { ok: false, code: "template-not-yours" };
    }

    const copyTitle = `${source.title} (copy)`;
    const base = slugFor(copyTitle);
    let slug: string | null = null;
    for (let attempt = 1; attempt <= 50 && slug === null; attempt += 1) {
      const candidate = attempt === 1 ? base : `${base}-${attempt}`;
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO record (id, slug, record_type, status, date, title, summary, author_user_id)
         VALUES ($1, $2, 'assessment', 'published', $3, $4, $5, $6)
         ON CONFLICT (slug) DO NOTHING
         RETURNING id`,
        [newId, candidate, now.toISOString(), copyTitle, source.summary, viewerUserId],
      );
      if (inserted.rowCount === 1) slug = candidate;
    }
    if (slug === null) {
      throw new Error(`could not find a free slug for a copy of "${source.title}"`);
    }

    await client.query(
      `INSERT INTO item (record_id, item_id, position, prompt, scale_kind, left_value, right_value)
       SELECT $1, item_id, position, prompt, scale_kind, left_value, right_value
         FROM item
        WHERE record_id = $2`,
      [newId, recordId],
    );
    const count = await client.query<{ aspects: number }>(
      `SELECT count(*)::int AS aspects FROM item WHERE record_id = $1`,
      [newId],
    );

    await client.query("COMMIT");
    return {
      ok: true,
      template: {
        id: newId,
        slug,
        title: copyTitle,
        aspectCount: count.rows[0]?.aspects ?? 0,
      },
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
