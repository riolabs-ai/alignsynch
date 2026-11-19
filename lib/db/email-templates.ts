/**
 * Admin overrides of transactional mail, as SQL (#1138) — the read the send path makes, and the
 * three writes `/admin/email-templates` performs.
 *
 * **Not a sibling of `lib/admin/templates.ts`.** That module is the *assessment* template store:
 * a template there is a `record` row that a relationship copies. An email template is not a row
 * at all — it is an entry in `lib/email/templates/index.ts`, i.e. code — and what this table holds
 * is an override of one of them. The two share a shape (immutable versions, one live row) because
 * `0026_template_version.sql` settled the shape for anything an admin publishes, not because they
 * are the same object.
 *
 * **The read the send path makes is one statement and it may fail.** `readPublishedOverride()`
 * answers `undefined` for "no override", for "the table is not there" and for "the pool has no
 * connection string" alike, and it logs the second and third. #1138 is explicit about why: "a
 * missing override table falls back to the default" and "Render remains server-side and must not
 * fail a user-facing write if the override cannot be read: log, fall back to the default, and still
 * attempt the send". A throw here would turn an admin's edit into a failed invitation — the one
 * failure mode a mail override must never cause.
 *
 * **The three writes are inside `act()`'s transaction** (`lib/admin/email-templates.ts`), which is
 * why they take an `EmailTemplateSql` instead of reaching for the pool: the actor's role is read
 * and the audit row written in the same transaction as the version, and a rolled-back publish
 * leaves neither.
 *
 * **`retire` is the only UPDATE.** `0042_email_template_version.sql` installs a trigger that
 * refuses every other change, so the state machine cannot be widened here by accident: a save
 * retires the draft and inserts a new one, a publish retires the draft and any live published row
 * and inserts a new published one, a reset retires both and inserts nothing — and "no published
 * row" is the default.
 */
import { queryRows } from "@/lib/db/client";
import type { EmailOverride } from "@/lib/email/override";
import { overrideOf } from "@/lib/email/override";

/** The one statement surface these reads and writes need: a client, a pool, or a test's fake. */
export interface EmailTemplateSql {
  query<R = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ readonly rows: readonly R[] }>;
}

/** Every column of a version row, in one place so a read and a statement cannot disagree. */
export const EMAIL_TEMPLATE_VERSION_COLUMNS =
  "id, template_id, version, status, subject, preheader, body, editor_user_id, created_at, retired_at";

/** The three states a row can hold. `retired` is terminal (`0042`). */
export type EmailTemplateVersionStatus = "draft" | "published" | "retired";

/** The row as `pg` hands it back. */
export interface EmailTemplateVersionRow {
  readonly id: string;
  readonly template_id: string;
  readonly version: number;
  readonly status: string;
  readonly subject: string;
  readonly preheader: string;
  readonly body: string;
  readonly editor_user_id: string;
  readonly created_at: Date | string;
  readonly retired_at: Date | string | null;
}

/** One version as the editor draws it: the words, who wrote them, when, and whether they are live. */
export interface EmailTemplateVersionSummary {
  readonly id: string;
  readonly templateId: string;
  readonly version: number;
  readonly status: EmailTemplateVersionStatus;
  readonly subject: string;
  readonly preheader: string;
  readonly body: string;
  /** `user_profile.user_id`; the screen prints the last-edited *instant* and this for a join. */
  readonly editorUserId: string;
  /** ISO, UTC — whichever way `pg` handed the column back. */
  readonly createdAt: string;
  /** `null` is "still draft or still published". */
  readonly retiredAt: string | null;
}

/**
 * A version's id: `<template id>-v<number>`.
 *
 * Deterministic, like `templateVersionIdOf()`, so a retried write converges on the row it wrote
 * instead of adding a second copy of one fact. Derived here and spelled in
 * `0042_email_template_version.sql`, which is the one place a copy is unavoidable — a migration
 * cannot import a module.
 */
export function emailTemplateVersionIdOf(templateId: string, version: number): string {
  return `${templateId}-v${version}`;
}

/** A column as an ISO instant, whichever way `pg` hands it back. */
function instantOf(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

/** `status` from a row: a value outside the three is drift, and the throw names the row. */
function statusOf(row: EmailTemplateVersionRow): EmailTemplateVersionStatus {
  if (row.status === "draft" || row.status === "published" || row.status === "retired") {
    return row.status;
  }
  throw new Error(
    `email_template_version "${row.id}" carries status "${row.status}", which is none of draft / published / retired`,
  );
}

/** One row → one summary. */
export function emailTemplateVersionOf(row: EmailTemplateVersionRow): EmailTemplateVersionSummary {
  return {
    id: row.id,
    templateId: row.template_id,
    version: row.version,
    status: statusOf(row),
    subject: row.subject,
    preheader: row.preheader,
    body: row.body,
    editorUserId: row.editor_user_id,
    createdAt: instantOf(row.created_at),
    retiredAt: row.retired_at === null ? null : instantOf(row.retired_at),
  };
}

/* ------------------------------------------------------------------ *
 * The reads
 * ------------------------------------------------------------------ */

/** The pool as this module's narrower surface. */
const POOLED: EmailTemplateSql = {
  query: async <R = Record<string, unknown>>(text: string, values: readonly unknown[] = []) => ({
    rows: (await queryRows(text, values)) as R[],
  }),
};

/** Every version of one template, newest first — the history the editor lists. */
export async function listEmailTemplateVersions(
  templateId: string,
): Promise<EmailTemplateVersionSummary[]> {
  const rows = await queryRows<EmailTemplateVersionRow>(
    `SELECT ${EMAIL_TEMPLATE_VERSION_COLUMNS}
       FROM email_template_version
      WHERE template_id = $1
      ORDER BY version DESC`,
    [templateId],
  );
  return rows.map(emailTemplateVersionOf);
}

/** The non-retired rows of one template: at most a live published row and at most a pending draft. */
export interface EmailTemplateLive {
  readonly published?: EmailTemplateVersionSummary;
  readonly draft?: EmailTemplateVersionSummary;
}

/**
 * Every template's live state, in **one** statement — not one query per row.
 *
 * `DISTINCT ON (template_id, status)` with `ORDER BY … version DESC` answers "the newest draft and
 * the newest published row of each template", which is exactly the pair the list needs and the pair
 * the editor's badge reads. Retired rows are excluded because history is not state; a template with
 * no row here has never been overridden, and the caller reads that as "default".
 */
export async function listEmailTemplateLive(): Promise<ReadonlyMap<string, EmailTemplateLive>> {
  const rows = await queryRows<EmailTemplateVersionRow>(
    `SELECT DISTINCT ON (template_id, status) ${EMAIL_TEMPLATE_VERSION_COLUMNS}
       FROM email_template_version
      WHERE status <> 'retired'
      ORDER BY template_id, status, version DESC`,
  );
  const live = new Map<
    string,
    { published?: EmailTemplateVersionSummary; draft?: EmailTemplateVersionSummary }
  >();
  for (const row of rows) {
    const version = emailTemplateVersionOf(row);
    const entry = live.get(version.templateId) ?? {};
    if (version.status === "published") entry.published = version;
    if (version.status === "draft") entry.draft = version;
    live.set(version.templateId, entry);
  }
  return live;
}

/* ------------------------------------------------------------------ *
 * The writes (always inside a caller's transaction)
 * ------------------------------------------------------------------ */

/**
 * The published override for one template, or `undefined` — **the read the send path makes**.
 *
 * Every failure is `undefined` on purpose (see the header): an unreachable pool, an unmigrated
 * database, a parse that drifts. The failure is logged with the template id so an operator can
 * see the fallback happening, and the send proceeds with the code default. The published row is
 * the only row this function will ever return — a draft is not an offer (#1138 requirement 5).
 */
export async function readPublishedOverride(
  templateId: string,
  sql: EmailTemplateSql = POOLED,
): Promise<EmailOverride | undefined> {
  try {
    const result = await sql.query<EmailTemplateVersionRow>(
      `SELECT ${EMAIL_TEMPLATE_VERSION_COLUMNS}
         FROM email_template_version
        WHERE template_id = $1
          AND status = 'published'
        LIMIT 1`,
      [templateId],
    );
    const row = result.rows[0];
    if (row === undefined) return undefined;
    return overrideOf(row);
  } catch (error) {
    console.warn(
      `[email] no published override could be read for "${templateId}" — sending the code default`,
      error,
    );
    return undefined;
  }
}

/* ------------------------------------------------------------------ *
 * The writes (always inside a caller's transaction)
 * ------------------------------------------------------------------ */

/** The version a write will carry: one past the highest, and 1 for a template never overridden. */
export async function nextEmailTemplateVersion(
  sql: EmailTemplateSql,
  templateId: string,
): Promise<number> {
  const result = await sql.query<{ next: number }>(
    "SELECT COALESCE(max(version), 0) + 1 AS next FROM email_template_version WHERE template_id = $1",
    [templateId],
  );
  return Number(result.rows[0]?.next ?? 1);
}

/**
 * Write one row. `ON CONFLICT DO NOTHING … RETURNING id` makes the write a claim rather than a
 * race: a concurrent save that computed the same next number cannot both land, and the loser gets
 * no id back so the caller can refuse instead of overwriting.
 */
export async function insertEmailTemplateVersion(
  sql: EmailTemplateSql,
  input: {
    readonly templateId: string;
    readonly status: "draft" | "published";
    readonly subject: string;
    readonly preheader: string;
    readonly body: string;
    readonly editorUserId: string;
  },
): Promise<EmailTemplateVersionSummary | undefined> {
  const version = await nextEmailTemplateVersion(sql, input.templateId);
  const id = emailTemplateVersionIdOf(input.templateId, version);
  const result = await sql.query<EmailTemplateVersionRow>(
    `INSERT INTO email_template_version
       (id, template_id, version, status, subject, preheader, body, editor_user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (template_id, version) DO NOTHING
     RETURNING ${EMAIL_TEMPLATE_VERSION_COLUMNS}`,
    [
      id,
      input.templateId,
      version,
      input.status,
      input.subject,
      input.preheader,
      input.body,
      input.editorUserId,
    ],
  );
  const row = result.rows[0];
  return row === undefined ? undefined : emailTemplateVersionOf(row);
}

/**
 * Retire every row of one template in the given states. The only UPDATE this module makes, and the
 * trigger permits nothing but `status` and `retired_at` (and refuses a row that is already
 * retired), so a double reset is a no-op rather than a re-dated instant.
 */
export async function retireEmailTemplateVersions(
  sql: EmailTemplateSql,
  input: { readonly templateId: string; readonly statuses: readonly ("draft" | "published")[] },
): Promise<number> {
  if (input.statuses.length === 0) return 0;
  const result = await sql.query<{ id: string }>(
    `UPDATE email_template_version
        SET status = 'retired', retired_at = now()
      WHERE template_id = $1
        AND status = ANY($2::text[])
      RETURNING id`,
    [input.templateId, [...input.statuses]],
  );
  return result.rows.length;
}

/**
 * A save: retire the working draft, then write the new one.
 *
 * The published row is untouched — a save cannot change production mail (#1138 requirement 5),
 * and that is a property of this statement rather than of the action's discipline.
 */
export async function saveEmailTemplateDraft(
  sql: EmailTemplateSql,
  input: {
    readonly templateId: string;
    readonly subject: string;
    readonly preheader: string;
    readonly body: string;
    readonly editorUserId: string;
  },
): Promise<EmailTemplateVersionSummary | undefined> {
  await retireEmailTemplateVersions(sql, { templateId: input.templateId, statuses: ["draft"] });
  return insertEmailTemplateVersion(sql, { ...input, status: "draft" });
}

/**
 * A publish: retire the draft **and** the live published row, then write a new published row.
 *
 * Two retirements in one statement-set because the partial unique index allows one published row
 * per template; doing them in a different order would violate it. The words written are the ones
 * the caller validated — `lib/admin/email-templates.ts` publishes the *stored draft* when there is
 * one, so an unsaved edit can never go live.
 */
export async function publishEmailTemplateVersion(
  sql: EmailTemplateSql,
  input: {
    readonly templateId: string;
    readonly subject: string;
    readonly preheader: string;
    readonly body: string;
    readonly editorUserId: string;
  },
): Promise<EmailTemplateVersionSummary | undefined> {
  await retireEmailTemplateVersions(sql, {
    templateId: input.templateId,
    statuses: ["draft", "published"],
  });
  return insertEmailTemplateVersion(sql, { ...input, status: "published" });
}

/**
 * A reset: retire the draft and the published row and insert nothing.
 *
 * "Nothing published" is the default, so this needs no tombstone to mean it — and #1138's
 * requirement that "the reset is itself a version" is satisfied by the retired rows, which keep
 * their words, their actor and the instant they stopped being live.
 */
export async function resetEmailTemplateOverride(
  sql: EmailTemplateSql,
  input: { readonly templateId: string },
): Promise<number> {
  return retireEmailTemplateVersions(sql, {
    templateId: input.templateId,
    statuses: ["draft", "published"],
  });
}
