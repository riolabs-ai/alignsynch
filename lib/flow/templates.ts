/**
 * Writing a template — the one operation that makes a record with Aspects and no parties (#255).
 *
 * Everything else in `lib/flow/` assumes a template exists: `createInstanceFromTemplate` copies
 * one, the answer screen reads a copy, the report draws a copy. This module is where the template
 * itself comes from, and it writes exactly what the model already describes
 * (`content/assessment.ts::zAssessment`): a `record` row of type `assessment`, `published`, and its
 * `item` rows — **no `assessment_instance` row, no `party` row, no `response_option` row**. That
 * absence is not a missing feature: a template with parties is an instance by definition, which is
 * `strict()` in the schema and a foreign key in SQL.
 *
 * No new table, no new column, and **no author column** — the model has no field for who wrote a
 * template, and inventing one here would put a fact in the database the content model cannot
 * validate. The card asks for that to be reported rather than added.
 *
 * The Aspect ids are `aspect-1`…`aspect-n` in authored order, and `position` is that order. Order
 * is part of what a party answers, and the copy carries both (`INSERT … SELECT` in `store.ts`), so
 * an instance made from this template asks the questions in the order they were typed.
 */
import { getPool } from "@/lib/db/client";
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
  options: { readonly now?: Date } = {},
): Promise<CreatedTemplate> {
  const now = options.now ?? new Date();
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
        `INSERT INTO record (id, slug, record_type, status, date, title, summary)
         VALUES ($1, $2, 'assessment', 'published', $3, $4, $5)
         ON CONFLICT (slug) DO NOTHING
         RETURNING id`,
        [id, candidate, now.toISOString(), draft.title, summary],
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
