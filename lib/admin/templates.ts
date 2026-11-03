/**
 * The console's template reads and writes (#502a) — drafted templates, audited through `act()`.
 *
 * A **template** in this tree is a `record` row with `record_type = 'assessment'` and no `session`
 * row (a session is what makes a record an instance). That definition is not restated here: the
 * editor's read is `readAssessmentTemplateRowsById` from `lib/db/assessments.ts`, whose SQL already
 * carries the `NOT EXISTS` half, and every write below keeps it true by never touching `session`.
 *
 * **Scope, and what is deliberately absent.** This half of #502 authors a **draft**: create a
 * template, edit its title, summary and Aspects, preview it as a party sees it. Publishing and
 * versioning are `502b`, and the row's `status` is therefore never taken from the form — a draft
 * is created as `draft`, and a row whose status is not `draft` is **refused as not-editable**.
 * That is not a placeholder: `db:verify` E31 requires every session's copied Aspects to equal its
 * template's (`content/assessment.ts::instanceTemplateProblems`), so editing a published template
 * in place would silently drift every relationship already played on it. Versioning is the
 * mechanism that makes editing a published template safe; until it lands, refusing is the honest
 * answer, and the refusal names it.
 *
 * **Every write is `act()`** — there is no `queryRows` write, no pool and no second transaction in
 * this file. `act()` reads the actor's rung inside the transaction, runs the mutation, writes
 * `admin_action`, and rolls all three back together. `template.create` and `template.update` are
 * the two actions (`lib/admin/roles.ts`), and both target `record` with the template's id.
 *
 * **The audit payload is bounded.** `before`/`after` carry the title, slug, status and the
 * Aspects' ids, prompts and poles — the template's own words, never a session, a party or an
 * opinion. A template is the product's public description, so this is content, not PII.
 */
import { act, type ActResult, type ActSql, type ActTransactionRunner } from "@/lib/admin/act";
import type { AdminAction } from "@/lib/admin/roles";
import type { Assessment } from "@/content/assessment";
import { readAssessmentTemplateRowsById } from "@/lib/db/assessments";
import { assessmentTemplateFromRows } from "@/lib/db/rows";
import { queryRows } from "@/lib/db/client";
import type { DraftProblem } from "@/lib/admin/template-draft";

/** `/admin/templates` — the console's authored-template list. Re-exported from the pure module. */
export { ADMIN_TEMPLATES_PATH, adminTemplatePath } from "@/lib/admin/paths";

/* ------------------------------------------------------------------ *
 * Refusals
 * ------------------------------------------------------------------ */

/**
 * Why a template save was refused — facts about the draft or the row, not about permission.
 * Permissions and the reason's length are `act()`'s (`ActRefused`), decided before the mutation.
 *
 *   no-such-template  the id is not a template record (or it is an instance)
 *   not-editable      the row is published — publishing is #502b's versioned write
 *   slug-taken        another record already answers to this id or slug
 *   invalid-draft     `zAssessment` refused the assembled record; `problems` names every field
 */
export const TEMPLATE_REFUSALS = [
  "no-such-template",
  "not-editable",
  "slug-taken",
  "invalid-draft",
] as const;

export type TemplateRefusal = (typeof TEMPLATE_REFUSALS)[number];

export class TemplateRefused extends Error {
  readonly reason: TemplateRefusal;
  readonly problems: readonly DraftProblem[];

  constructor(reason: TemplateRefusal, message: string, problems: readonly DraftProblem[] = []) {
    super(message);
    this.name = "TemplateRefused";
    this.reason = reason;
    this.problems = problems;
  }
}

/* ------------------------------------------------------------------ *
 * The reads
 * ------------------------------------------------------------------ */

/** One row of the console list. A published template is shown and is not editable. */
export interface AdminTemplateRow {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly status: string;
  /** The record's one instant, UTC — `formatDate` turns it into a label at the edge. */
  readonly date: string;
  readonly aspectCount: number;
  readonly instanceCount: number;
  readonly editable: boolean;
}

interface AdminTemplateQueryRow {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly status: string;
  readonly date: Date | string;
  readonly aspect_count: number;
  readonly instance_count: number;
}

/**
 * Every template, newest first — drafts included.
 *
 * "Drafts are visible only in the console" is a fact about the **member** library's filter
 * (`author_user_id IS NULL OR author_user_id = $1` plus its own status tabs), not about this
 * query: an operator's list is the whole store, which is why it does not filter on the author or
 * on the status at all.
 */
export async function listAdminTemplates(): Promise<AdminTemplateRow[]> {
  const rows = await queryRows<AdminTemplateQueryRow>(`
    SELECT r.id,
           r.slug,
           r.title,
           r.status,
           r.date,
           (SELECT count(*)::int FROM item i WHERE i.record_id = r.id) AS aspect_count,
           (SELECT count(*)::int FROM session s WHERE s.template_record_id = r.id) AS instance_count
      FROM record r
     WHERE r.record_type = 'assessment'
       AND NOT EXISTS (SELECT 1 FROM session own WHERE own.record_id = r.id)
     ORDER BY (r.status = 'draft') DESC, r.date DESC, r.title ASC
  `);
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    status: row.status,
    date: row.date instanceof Date ? row.date.toISOString() : row.date,
    aspectCount: Number(row.aspect_count),
    instanceCount: Number(row.instance_count),
    editable: row.status === "draft",
  }));
}

/** What the editor is handed: the record the model parsed, and whether it may be saved. */
export interface AdminTemplateEditorView {
  readonly template: Assessment;
  readonly editable: boolean;
}

/**
 * One template, through the same mapper the flow's own pages use.
 *
 * `undefined` is "not a template row" and the page turns it into `notFound()`. The parse is
 * `assessmentTemplateFromRows`, so a row that drifted from the model raises the mapper's own
 * sentence instead of rendering a half-empty editor — the console reads what every other surface
 * reads.
 */
export async function readAdminTemplate(
  templateId: string,
): Promise<AdminTemplateEditorView | undefined> {
  const rows = await readAssessmentTemplateRowsById(templateId);
  if (rows === undefined) return undefined;
  return {
    template: assessmentTemplateFromRows(rows),
    editable: rows.record.status === "draft",
  };
}

/* ------------------------------------------------------------------ *
 * The writes
 * ------------------------------------------------------------------ */

/** The actor, the reason and the draft: the whole request, resolved by the server action. */
export interface TemplateWriteRequest {
  readonly actorUserId: string;
  readonly reason: string;
  /**
   * The record, already parsed by `zAssessment` in the caller (`app/(mainlayout)/admin/templates/
   * actions.ts`). A draft that fails the schema never reaches this module: the action answers
   * `invalid-draft` with the schema's own paths and no transaction opens. That keeps one
   * validator — the schema — and this module writing exactly what it accepted.
   */
  readonly record: Assessment;
}

/** The bounded half of a template that the audit row keeps on both sides of a change. */
function auditPayload(record: Assessment) {
  return {
    id: record.id,
    slug: record.slug,
    title: record.title,
    status: record.status,
    aspects: record.items.map((item) => ({
      id: item.id,
      prompt: item.prompt,
      leftValue: item.leftValue,
      rightValue: item.rightValue,
    })),
  };
}

/** What a template save answers with: the audit row's id, and the payload it recorded. */
export type TemplateAuditPayload = ReturnType<typeof auditPayload>;

/** The statements that write one template's Aspects, in the record's own order. */
async function writeItems(sql: ActSql, record: Assessment): Promise<void> {
  for (const [position, item] of record.items.entries()) {
    await sql.query(
      `INSERT INTO item (record_id, item_id, position, prompt, scale_kind, left_value, right_value)
       VALUES ($1, $2, $3, $4, 'score', $5, $6)`,
      [record.id, item.id, position, item.prompt, item.leftValue, item.rightValue],
    );
  }
}

/**
 * Create a **draft** template.
 *
 * The action has already derived the id (`assessment-<slug>`) when the caller left it blank — the
 * same convention `data/assessments.ts` authors the fixture templates with, so a console record
 * and a seeded one are indistinguishable to every reader. `status` is forced to `draft` by the
 * action before the schema sees it: publishing is a versioned write and belongs to `502b`.
 */
export async function createTemplateDraft(
  request: TemplateWriteRequest,
  runner?: ActTransactionRunner,
): Promise<ActResult<TemplateAuditPayload>> {
  const record = request.record;
  const { id } = record;

  return act<TemplateAuditPayload>(
    {
      actorUserId: request.actorUserId,
      action: "template.create" satisfies AdminAction,
      target: { table: "record", id },
      reason: request.reason,
      mutate: async (sql) => {
        const taken = await sql.query<{ id: string }>(
          "SELECT id FROM record WHERE id = $1 OR slug = $2 LIMIT 1",
          [id, record.slug],
        );
        if (taken.rows[0] !== undefined) {
          throw new TemplateRefused(
            "slug-taken",
            `a record already answers to "${record.id}" or slug "${record.slug}"`,
          );
        }

        await sql.query(
          `INSERT INTO record (id, slug, record_type, status, date, title, summary, author_user_id)
           VALUES ($1, $2, 'assessment', 'draft', $3, $4, $5, $6)`,
          [record.id, record.slug, record.date, record.title, record.summary, request.actorUserId],
        );
        await writeItems(sql, record);
        return { before: null, after: auditPayload(record) };
      },
    },
    runner,
  );
}

/**
 * Edit a draft template. A published row is refused — see the module comment.
 *
 * The Aspects are rewritten rather than diffed: a draft has no session to protect, and its items
 * have no row depending on them (`response_option` and every opinion cascade from `item`), so
 * replacing the set is the simplest statement that cannot leave a stale Aspect behind. The ids of
 * the Aspects that survived the edit are carried by the draft, so a reworded prompt keeps the id
 * its sessions would have named.
 */
export async function updateTemplateDraft(
  request: TemplateWriteRequest,
  runner?: ActTransactionRunner,
): Promise<ActResult<TemplateAuditPayload>> {
  const record = request.record;
  const id = record.id;

  return act<TemplateAuditPayload>(
    {
      actorUserId: request.actorUserId,
      action: "template.update" satisfies AdminAction,
      target: { table: "record", id },
      reason: request.reason,
      mutate: async (sql) => {
        const found = await sql.query<{
          id: string;
          slug: string;
          record_type: string;
          status: string;
          title: string;
          summary: string;
        }>(
          `SELECT id, slug, record_type, status, title, summary
             FROM record WHERE id = $1 FOR UPDATE`,
          [id],
        );
        const row = found.rows[0];
        if (row === undefined || row.record_type !== "assessment") {
          throw new TemplateRefused("no-such-template", `no template record holds the id "${id}"`);
        }
        if (row.status !== "draft") {
          throw new TemplateRefused(
            "not-editable",
            `"${row.slug}" is ${row.status}: editing a published template is versioning, and that is #502b`,
          );
        }

        if (record.slug !== row.slug) {
          const clash = await sql.query<{ id: string }>(
            "SELECT id FROM record WHERE slug = $1 AND id <> $2 LIMIT 1",
            [record.slug, id],
          );
          if (clash.rows[0] !== undefined) {
            throw new TemplateRefused(
              "slug-taken",
              `another record already answers to the slug "${record.slug}"`,
            );
          }
        }

        const oldItems = await sql.query<{
          item_id: string;
          prompt: string;
          left_value: string | null;
          right_value: string | null;
        }>(
          `SELECT item_id, prompt, left_value, right_value FROM item
            WHERE record_id = $1 ORDER BY position`,
          [id],
        );

        await sql.query("UPDATE record SET slug = $2, title = $3, summary = $4 WHERE id = $1", [
          id,
          record.slug,
          record.title,
          record.summary,
        ]);
        await sql.query("DELETE FROM item WHERE record_id = $1", [id]);
        await writeItems(sql, record);

        return {
          before: {
            id: row.id,
            slug: row.slug,
            title: row.title,
            status: row.status,
            aspects: oldItems.rows.map((item) => ({
              id: item.item_id,
              prompt: item.prompt,
              leftValue: item.left_value,
              rightValue: item.right_value,
            })),
          },
          after: auditPayload(record),
        };
      },
    },
    runner,
  );
}
