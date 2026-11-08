/**
 * The console's template reads and writes (#502a, #502b) — drafted templates and published
 * versions, audited through `act()`.
 *
 * A **template** in this tree is a `record` row with `record_type = 'assessment'` and no `session`
 * row (a session is what makes a record an instance). That definition is not restated here: the
 * editor's read is `readAssessmentTemplateRowsById` from `lib/db/assessments.ts`, whose SQL already
 * carries the `NOT EXISTS` half, and every write below keeps it true by never touching `session`.
 *
 * **Two writes, two meanings.** The `record` and its `item` rows are the **working copy** — what the
 * editor is editing. `template_version` rows are **published snapshots** and never change
 * (`0026_template_version.sql` installs the trigger that refuses it). Publishing writes the working
 * copy as version N+1 and supersedes the rest; editing a published template writes the working copy
 * and touches no version at all, so every relationship that was created on N keeps drawing N. That
 * is why `updateTemplateDraft` no longer refuses a published row: an in-place edit is safe the
 * moment the read path goes through a binding, and this card made it go through one.
 *
 * **Why the version is the read for everyone else.** `db:verify` V4 compares a session's copied
 * Aspects to the **version its relationship is bound to** rather than to the working copy, which is
 * the same rule `/assessment/[slug]` reads by. A single rule, three surfaces.
 *
 * **Every write is `act()`** — there is no `queryRows` write, no pool and no second transaction in
 * this file. `act()` reads the actor's rung inside the transaction, runs the mutation, writes
 * `admin_action`, and rolls all three back together. `template.create`, `template.update`,
 * `template.publish` and `template.unpublish` are the four actions (`lib/admin/roles.ts`), and each
 * targets `record` with the template's id.
 *
 * **The audit payload is bounded.** `before`/`after` carry the title, slug, status and the
 * Aspects' ids, prompts and poles — the template's own words, never a session, a party or an
 * opinion. A template is the product's public description, so this is content, not PII.
 */
import { act, type ActResult, type ActSql, type ActTransactionRunner } from "@/lib/admin/act";
import type { AdminAction } from "@/lib/admin/roles";
import type { Assessment } from "@/content/assessment";
import type { PublishStatus } from "@/content/core";
import { zPublishStatus } from "@/content/core";
import { readAssessmentTemplateRowsById, readTemplateRowsWithin } from "@/lib/db/assessments";
import { assessmentTemplateFromRows, templateCandidateOf } from "@/lib/db/rows";
import { queryRows } from "@/lib/db/client";
import {
  listTemplateVersions,
  snapshotTemplateVersion,
  type TemplateVersionSummary,
} from "@/lib/db/template-versions";
import { validateTemplateRecord, type DraftProblem } from "@/lib/admin/template-draft";

/** `/admin/templates` — the console's authored-template list. Re-exported from the pure module. */
export { ADMIN_TEMPLATES_PATH, adminTemplatePath } from "@/lib/admin/paths";

/* ------------------------------------------------------------------ *
 * Refusals
 * ------------------------------------------------------------------ */

/**
 * Why a template save was refused — facts about the draft or the row, not about permission.
 * Permissions are `act()`'s (`ActRefused`), decided before the mutation.
 *
 *   no-such-template  the id is not a template record (or it is an instance)
 *   not-editable      the row is archived — unarchive it before editing
 *   not-published     unpublish asked for a row that offers nothing
 *   slug-taken        another record already answers to this id or slug
 *   invalid-draft     `zAssessment` refused the assembled record; `problems` names every field
 *   version-conflict  another publish took the next number; nothing was written
 */
export const TEMPLATE_REFUSALS = [
  "no-such-template",
  "not-editable",
  "not-published",
  "slug-taken",
  "invalid-draft",
  "version-conflict",
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

/** What the editor is handed: the record the model parsed, and what may be done with it. */
export interface AdminTemplateEditorView {
  readonly template: Assessment;
  /**
   * May this row be edited? A draft and a published row may; an **archived** one may not.
   *
   * A published row is editable because editing it writes the working copy only — every
   * relationship reads the version it was created from, so the edit is not visible to anybody until
   * it is published as N+1 (`#502b`).
   */
  readonly editable: boolean;
  /** `record.status` — the live state, which is what the publish band reports. */
  readonly status: PublishStatus;
  /** Every published version, newest first. Empty is "never published". */
  readonly versions: readonly TemplateVersionSummary[];
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
    editable: rows.record.status !== "archived",
    // The vocabulary is `zPublishStatus`'s: a row outside it is drift, and the parse says so with
    // the value rather than letting the editor draw a status the model has no word for.
    status: zPublishStatus.parse(rows.record.status),
    versions: await listTemplateVersions(templateId),
  };
}

/* ------------------------------------------------------------------ *
 * The writes
 * ------------------------------------------------------------------ */

/** The actor, the reason and the draft: the whole request, resolved by the server action. */
export interface TemplateWriteRequest {
  readonly actorUserId: string;
  /**
   * Why, when the caller has one. Optional since #732: no action form asks for it, and `act()`
   * records `NULL` when nobody states one.
   */
  readonly reason?: string;
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
        if (row.status === "archived") {
          throw new TemplateRefused(
            "not-editable",
            `"${row.slug}" is archived: unarchive it before editing. A published template is editable — the edit lands in the working copy and no relationship reads it until it is published as the next version`,
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

/* ------------------------------------------------------------------ *
 * Publish and unpublish (#502b)
 * ------------------------------------------------------------------ */

/** What a publish or an unpublish is asked for: who, why, and which template. */
export interface TemplateVersionRequest {
  readonly actorUserId: string;
  /** Why, when the caller has one — optional since #732, like every other action. */
  readonly reason?: string;
  readonly templateId: string;
}

/** What an audited publish/unpublish records on both sides of the change. */
export interface TemplateVersionAudit {
  readonly id: string;
  readonly slug: string;
  /** `record.status` before, then after. */
  readonly status: string;
  /** The highest version number at this instant — `null` is "never published". */
  readonly version: number | null;
}

/** The row both writes lock, or a refusal naming why the id is not a template. */
async function lockTemplate(sql: ActSql, templateId: string): Promise<TemplateVersionAudit> {
  const found = await sql.query<{
    id: string;
    slug: string;
    record_type: string;
    status: string;
  }>("SELECT id, slug, record_type, status FROM record WHERE id = $1 FOR UPDATE", [templateId]);
  const row = found.rows[0];
  if (row === undefined || row.record_type !== "assessment") {
    throw new TemplateRefused(
      "no-such-template",
      `no template record holds the id "${templateId}"`,
    );
  }
  return { id: row.id, slug: row.slug, status: row.status, version: null };
}

/** The highest version number a template has, or `null` — the audit's "before" fact. */
async function latestVersionNumber(sql: ActSql, templateId: string): Promise<number | null> {
  const rows = await sql.query<{ version: number | null }>(
    "SELECT max(version) AS version FROM template_version WHERE template_record_id = $1",
    [templateId],
  );
  const version = rows.rows[0]?.version;
  return version === null || version === undefined ? null : Number(version);
}

/**
 * Publish the working copy as the next immutable version.
 *
 * The order inside the transaction is the card's promise, statement by statement:
 *
 *   1. lock the record, and refuse anything that is not a template row;
 *   2. read the working copy **and validate it** with `validateTemplateRecord()` — the same
 *      `zAssessment` call `502a`'s save uses, so a refusal names the field, and an invalid draft
 *      never reaches the insert;
 *   3. write the version (`max + 1`) and mark every earlier one superseded;
 *   4. flip `record.status` to `published` **only if it was not already**, so publishing an
 *      unchanged published template is a no-op on the record and still a new version — that is what
 *      "publish v2" means;
 *   5. let `act()` write the `admin_action` row last, in the same transaction.
 *
 * A refusal at any step rolls all of it back: no version row, no status change, no audit entry.
 *
 * **The payload says `published`.** The working copy's own status may still be `draft` when the
 * snapshot is taken; the version is the template *as published*, so that one field is projected to
 * the state the write is establishing. Every other field is the working copy's, unchanged.
 */
export async function publishTemplate(
  request: TemplateVersionRequest,
  runner?: ActTransactionRunner,
): Promise<ActResult<TemplateVersionAudit>> {
  return act<TemplateVersionAudit>(
    {
      actorUserId: request.actorUserId,
      action: "template.publish" satisfies AdminAction,
      target: { table: "record", id: request.templateId },
      reason: request.reason,
      mutate: async (sql) => {
        const before = await lockTemplate(sql, request.templateId);

        // `NOT EXISTS (session)` is the template definition, so an instance id is refused here
        // rather than published as a template of its own.
        const rows = await readTemplateRowsWithin(sql, request.templateId);
        if (rows === undefined) {
          throw new TemplateRefused(
            "no-such-template",
            `"${before.id}" is not a template record (it is an instance, or a non-assessment)`,
          );
        }

        const validation = validateTemplateRecord(templateCandidateOf(rows));
        if (!validation.ok) {
          throw new TemplateRefused(
            "invalid-draft",
            `"${before.slug}" cannot be published: zAssessment refused ${validation.problems.length} field(s)`,
            validation.problems,
          );
        }

        const previousVersion = await latestVersionNumber(sql, before.id);
        const published = await snapshotTemplateVersion(sql, {
          template: { ...validation.record, status: "published" },
          publishedBy: request.actorUserId,
        });
        if (published === undefined) {
          throw new TemplateRefused(
            "version-conflict",
            `another publish took version ${Number(previousVersion ?? 0) + 1} of "${before.slug}" — nothing was written`,
          );
        }

        if (before.status !== "published") {
          await sql.query("UPDATE record SET status = 'published' WHERE id = $1", [before.id]);
        }

        return {
          before: { ...before, version: previousVersion },
          after: { ...before, status: "published", version: published.version },
        };
      },
    },
    runner,
  );
}

/**
 * Withdraw a published template from the catalogue.
 *
 * **A status write and nothing else.** No version row is touched, so every relationship bound to
 * v1 or v2 keeps reading what it was created from and the whole publishing history stays
 * queryable; `record.status = 'draft'` is what stops `/assessment/templates` offering it (the
 * library's read filters drafts out, for its author as much as for anybody else). Publishing again
 * writes N+1.
 *
 * `not-published` is a refusal rather than a no-op: an operator who asked to withdraw something and
 * got "nothing happened" has no way to tell a mistake from a success.
 */
export async function unpublishTemplate(
  request: TemplateVersionRequest,
  runner?: ActTransactionRunner,
): Promise<ActResult<TemplateVersionAudit>> {
  return act<TemplateVersionAudit>(
    {
      actorUserId: request.actorUserId,
      action: "template.unpublish" satisfies AdminAction,
      target: { table: "record", id: request.templateId },
      reason: request.reason,
      mutate: async (sql) => {
        const before = await lockTemplate(sql, request.templateId);
        const rows = await readTemplateRowsWithin(sql, request.templateId);
        if (rows === undefined) {
          throw new TemplateRefused(
            "no-such-template",
            `"${before.id}" is not a template record (it is an instance, or a non-assessment)`,
          );
        }
        if (before.status !== "published") {
          throw new TemplateRefused(
            "not-published",
            `"${before.slug}" is ${before.status}: there is no offer to withdraw`,
          );
        }

        await sql.query("UPDATE record SET status = 'draft' WHERE id = $1", [before.id]);

        const version = await latestVersionNumber(sql, before.id);
        return {
          before: { ...before, version },
          after: { ...before, status: "draft", version },
        };
      },
    },
    runner,
  );
}
