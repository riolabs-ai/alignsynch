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
import { readTemplateRowsWithin } from "@/lib/db/assessments";
import { assessmentTemplateFromPayload, assessmentTemplateFromRows } from "@/lib/db/rows";
import { snapshotTemplateVersion } from "@/lib/db/template-versions";
import { authorshipOf, canUseTemplate } from "@/lib/flow/template-library";
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
 * Write v1 of a template this module just created, in the caller's transaction (#502b).
 *
 * A template is created here already **published** — that has been this module's rule since #255,
 * because `listPublishedTemplates()` filters on the status and `createInstanceFromTemplate()`
 * refuses anything else. Since #502b "published" also means "a version exists": a relationship is
 * created *from* a version and is bound to it, so a published template with no version would be a
 * template nothing could copy.
 *
 * The payload is read back from the rows the transaction just wrote (`readTemplateRowsWithin`) and
 * parsed with `assessmentTemplateFromRows` — one derivation of "what a version holds", and it means
 * the row this writes is exactly what a reader will parse.
 */
async function writeFirstVersion(
  client: {
    query<R = Record<string, unknown>>(
      text: string,
      values?: readonly unknown[],
    ): Promise<{ readonly rows: readonly R[] }>;
  },
  recordId: string,
  publishedBy: string | null,
): Promise<void> {
  const rows = await readTemplateRowsWithin(client, recordId);
  if (rows === undefined) {
    throw new Error(
      `template "${recordId}" was just written and does not read back as a template — the insert and the read disagree`,
    );
  }
  const published = await snapshotTemplateVersion(client, {
    template: assessmentTemplateFromRows(rows),
    publishedBy,
  });
  if (published === undefined) {
    throw new Error(`template "${recordId}" could not be published as its first version`);
  }
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

    // #502b — the published template's first version, in the same transaction as the rows it
    // snapshots. `authorUserId` is who published it, which for a member's own template is the
    // account that signed the save.
    await writeFirstVersion(client, id, authorUserId === "" ? null : authorUserId);

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
    // #502b — "published" means a version exists: a relationship is created from one and bound to
    // it. A row archived before publishing recorded versions (so never a relationship's template)
    // has none, and unarchiving it would otherwise publish a template nothing could copy.
    if (status === "published") {
      const existing = await client.query<{ version: number | null }>(
        "SELECT max(version) AS version FROM template_version WHERE template_record_id = $1",
        [recordId],
      );
      if (existing.rows[0]?.version === null || existing.rows[0]?.version === undefined) {
        await writeFirstVersion(client, recordId, viewerUserId);
      }
    }
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

    // #502b — a duplicate is published, so it carries a v1 like any other published template; the
    // row it copies from contributes its rows, and the version is this new record's own.
    await writeFirstVersion(client, newId, viewerUserId);

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

/**
 * #785 — **a party forks the relationship's own template into one of their own.**
 *
 * `duplicateTemplate` above copies a built-in and your own work, and refuses anything else —
 * `canUseTemplate` is the public library's guard and it must keep refusing strangers. That leaves
 * one case uncovered, and it is the one #785 is about: a relationship's template is a **private
 * copy** its initiator wrote (`createRelationship`), the library filters private copies out of
 * everybody's list, so the counterparty has no door to the words they were asked to answer.
 *
 * **The guard is the seat, not the authorship.** The caller must be a party to *this* relationship —
 * `relationship.initiator_user_id` or a `party` row bound to their account, spelled once in
 * `RELATIONSHIP_SEAT` exactly as `VIEWER_IS_PARTY` spells it for the member reads. The authorship
 * rule is untouched: a stranger still gets `template-not-yours`, and so does an id that names no
 * relationship at all — telling a stranger which ids exist is the one thing this code must not do,
 * and the two cases are one refusal on purpose.
 *
 * **The fork reads the pinned version, never the live template.** `relationship.template_version_id`
 * names the immutable `template_version` row the pair was invited on (#502b), and its `payload` is
 * that version's whole template. What a party agreed to is *that*, so a later edit to the author's
 * template cannot change what the counterparty forks. An unbound relationship — impossible since
 * `0026_template_version.sql`, and what `db:verify` V23 reports as drift — answers
 * `unknown-template` and writes nothing, rather than falling back to the working copy.
 *
 * **The copy is the caller's own row, in both libraries.** It is written published, with
 * `author_user_id` and `owner_user_id` both the caller's and `visibility = 'private'`, so it appears
 * under the template library's "Mine" (`author_user_id`) *and* under `/dashboard/templates`
 * (`owner_user_id`) — the two reads that decide "my templates" in this app. It carries the same
 * `(copy)` title convention and its own ids, and `writeFirstVersion` gives it a v1, so it is a
 * template a relationship can be started from immediately. The relationship it came from is not
 * touched: no session, no party row, no `template_version_id`.
 *
 * **Taking it twice points at the same row (#785 criterion 5).** A caller who already authored a
 * template with the copy's title gets that row back (`reused: true`) instead of a second one: two
 * rows with one title are two things to manage for no gain, and "name it or point at the existing
 * one" is the rule the issue asks for. The check is not a permission — it only ever matches the
 * caller's own rows.
 */
export type ForkResult =
  | {
      readonly ok: true;
      readonly template: CreatedTemplate;
      /** `true` when the caller already had a template with the copy's title — nothing was written. */
      readonly reused: boolean;
    }
  | { readonly ok: false; readonly code: TemplateWriteRefusal };

/**
 * Who may fork a relationship's template: a seat on it. `$1` is the relationship, `$2` the viewer.
 *
 * The same predicate `VIEWER_IS_PARTY` states for the member reads (`lib/member/relationships.ts`):
 * the initiator, **or** any account bound to a party seat — `party.user_id`, reached through
 * `session.relationship_id`. It is deliberately not `initiator_user_id` alone: the initiator already
 * owns the template, and the counterparty is the person #785 is about.
 */
const RELATIONSHIP_SEAT = `(
    rel.initiator_user_id = $2
    OR EXISTS (
      SELECT 1
        FROM session vs
        JOIN party p ON p.session_record_id = vs.record_id
       WHERE vs.relationship_id = rel.id AND p.user_id = $2
    )
  )`;

export async function forkRelationshipTemplate(
  relationshipId: string,
  viewerUserId: string,
  options: { readonly now?: Date } = {},
): Promise<ForkResult> {
  const now = options.now ?? new Date();
  const newId = templateRecordId();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    // The seat and the version, in one read: a caller who is not a party gets no row, so "does
    // this relationship exist" is not a question this code answers separately.
    const found = await client.query<{ payload: unknown }>(
      `SELECT tv.payload
         FROM relationship rel
         LEFT JOIN template_version tv ON tv.id = rel.template_version_id
        WHERE rel.id = $1
          AND ${RELATIONSHIP_SEAT}
        FOR SHARE OF rel`,
      [relationshipId, viewerUserId],
    );
    const bound = found.rows[0];
    if (bound === undefined) {
      await client.query("ROLLBACK");
      return { ok: false, code: "template-not-yours" };
    }
    if (bound.payload === null || bound.payload === undefined) {
      await client.query("ROLLBACK");
      return { ok: false, code: "unknown-template" };
    }
    const offered = assessmentTemplateFromPayload(
      bound.payload,
      `the template version relationship "${relationshipId}" is bound to`,
    );
    const copyTitle = `${offered.title} (copy)`;

    // #785 criterion 5 — one row per title. The caller's own rows only; this is a lookup, not a
    // permission, and it writes nothing, so the answer is the same on a second click.
    const already = await client.query<{ id: string; slug: string; aspects: number }>(
      `SELECT r.id, r.slug,
              (SELECT count(*)::int FROM item i WHERE i.record_id = r.id) AS aspects
         FROM record r
        WHERE r.record_type = 'assessment'
          AND r.author_user_id = $1
          AND r.title = $2
          AND NOT EXISTS (SELECT 1 FROM session ai WHERE ai.record_id = r.id)
        ORDER BY r.date DESC
        LIMIT 1`,
      [viewerUserId, copyTitle],
    );
    const existing = already.rows[0];
    if (existing !== undefined) {
      await client.query("ROLLBACK");
      return {
        ok: true,
        reused: true,
        template: {
          id: existing.id,
          slug: existing.slug,
          title: copyTitle,
          aspectCount: Number(existing.aspects),
        },
      };
    }

    const base = slugFor(copyTitle);
    let slug: string | null = null;
    for (let attempt = 1; attempt <= 50 && slug === null; attempt += 1) {
      const candidate = attempt === 1 ? base : `${base}-${attempt}`;
      // Both ownership columns are the caller's, so the row is theirs on either library read;
      // `private` because a fork is one member's copy and the catalogue is admin-curated (#533).
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO record
           (id, slug, record_type, status, date, title, summary,
            author_user_id, owner_user_id, visibility)
         VALUES ($1, $2, 'assessment', 'published', $3, $4, $5, $6, $6, 'private')
         ON CONFLICT (slug) DO NOTHING
         RETURNING id`,
        [newId, candidate, now.toISOString(), copyTitle, offered.summary, viewerUserId],
      );
      if (inserted.rowCount === 1) slug = candidate;
    }
    if (slug === null) {
      throw new Error(`could not find a free slug for a copy of "${offered.title}"`);
    }

    // The Aspects come from the **payload**, in its own order — the rows the party was asked to
    // answer, not whatever the author's working copy holds today.
    await client.query(
      `INSERT INTO item (record_id, item_id, position, prompt, scale_kind, left_value, right_value)
       SELECT $1, t.item_id, t.position, t.prompt, 'score', t.left_value, t.right_value
         FROM unnest($2::text[], $3::int[], $4::text[], $5::text[], $6::text[])
              AS t(item_id, position, prompt, left_value, right_value)`,
      [
        newId,
        offered.items.map((item) => item.id),
        offered.items.map((_, index) => index + 1),
        offered.items.map((item) => item.prompt),
        offered.items.map((item) => item.leftValue),
        offered.items.map((item) => item.rightValue),
      ],
    );

    // #502b — a fork is published, so it carries a v1 like any other published template: without
    // one, `createRelationship` could not start a relationship from it.
    await writeFirstVersion(client, newId, viewerUserId);

    await client.query("COMMIT");
    return {
      ok: true,
      reused: false,
      template: { id: newId, slug, title: copyTitle, aspectCount: offered.items.length },
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Why a delete was refused, by name, so the screen has a sentence for each.
 *
 * `template-not-yours` is the author rule (`authorshipOf`); `template-has-relationships` and
 * `template-has-versions` are the two foreign keys that would otherwise answer `23503` — which
 * reaches a member as a 500, the one outcome worse than a refusal.
 */
export type TemplateDeleteRefusal =
  | "unknown-template"
  | "template-not-yours"
  | "template-has-relationships"
  | "template-has-versions";

/** What a delete answers with: enough to report, and nothing that no longer exists. */
export type DeleteResult =
  | { readonly ok: true; readonly template: { readonly id: string; readonly title: string } }
  | { readonly ok: false; readonly code: TemplateDeleteRefusal };

/**
 * Delete a template this account wrote, in one transaction — the half of #743 that archiving
 * cannot do.
 *
 * **Only a template with no history is deletable, and that is the whole rule.** Three rows can
 * point at a template, and two of them are refusals rather than cascades:
 *
 *   `session.template_record_id`   a relationship was started from it (`0001`, no `ON DELETE`).
 *                                  Archiving is the answer: the parties' own answers live in the
 *                                  copy, and the row that names what they started from is that
 *                                  copy's provenance. Refused `template-has-relationships`.
 *   `relationship.template_id`     the legacy shape `0026` backfilled, before relationships were
 *                                  pointed at their own copy. Same refusal — it is the same fact.
 *   `template_version`             it was published, and the version history is what the catalogue
 *                                  offered. Refused `template-has-versions`: the console's own
 *                                  delete made that call too (`lib/admin/templates.ts`,
 *                                  `template-published`), and a draft differs from a published
 *                                  template in exactly this way — a promise was made in one and
 *                                  not the other.
 *
 * What is left is the row a member actually wants gone: the draft `createPrivateTemplate` wrote
 * to `/dashboard/templates`, which is published nowhere, has no version, and that no relationship
 * could have been started from (a template with no version cannot be copied). For the other two
 * the refusal copy says "archive it instead", which is the action already beside delete.
 *
 * **One statement deletes it, and the cascade is the second half.** `item` and
 * `response_option` cascade from `record` (`0001_content_model.sql:45,68`), so an explicit
 * `DELETE FROM item` would do the same work twice — the console's delete is one statement for the
 * same reason. The one record this must never reach is a relationship's private copy: that is a
 * **different** `record`, named only by `relationship.template_id`, and no statement here
 * touches it.
 *
 * The permission is read and the delete written under one `FOR UPDATE` of the same row, so "was
 * I allowed" and "what did I write" are the same snapshot — the shape `setTemplateStatus` already
 * uses. Nothing in this module writes an audit row, because archive does not either; the console's
 * `template.delete` is the audited path, and a member's own draft is not a console operation.
 */
export async function deleteTemplate(
  recordId: string,
  viewerUserId: string,
): Promise<DeleteResult> {
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

    // The author column is the permission, read through the module's one rule rather than
    // compared here. `authorshipOf` answers `mine` only for `author_user_id === viewer`, so a
    // built-in (`NULL`) falls through the same branch — `canUseTemplate` would let it past, and
    // *using* a template is not *owning* it.
    if (authorshipOf(row.author_user_id, viewerUserId) !== "mine") {
      await client.query("ROLLBACK");
      return { ok: false, code: "template-not-yours" };
    }

    // Both ways a relationship can name this template, in one read. Asked before the version row
    // on purpose: when a legacy row answers both, "a relationship was started from it" is the
    // truer sentence than "it was published".
    const started = await client.query<{ started: number }>(
      `SELECT (SELECT count(*) FROM session s WHERE s.template_record_id = $1)
            + (SELECT count(*) FROM relationship rel WHERE rel.template_id = $1) AS started`,
      [recordId],
    );
    if (Number(started.rows[0]?.started ?? 0) > 0) {
      await client.query("ROLLBACK");
      return { ok: false, code: "template-has-relationships" };
    }

    const versions = await client.query<{ version: number | null }>(
      "SELECT max(version) AS version FROM template_version WHERE template_record_id = $1",
      [recordId],
    );
    const publishedVersion = versions.rows[0]?.version ?? null;
    if (publishedVersion !== null) {
      await client.query("ROLLBACK");
      return { ok: false, code: "template-has-versions" };
    }

    // The template's own Aspect rows go with it through the cascade; nothing else is named.
    await client.query("DELETE FROM record WHERE id = $1", [recordId]);

    await client.query("COMMIT");
    return { ok: true, template: { id: row.id, title: row.title } };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
