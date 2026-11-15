/**
 * Published template versions (#502b) — the read and the write, as SQL.
 *
 * One row per publish, and it is the **whole validated template** as JSONB. That is what makes
 * "a relationship reads the version it was created from" a property of a row rather than a
 * convention: `relationship.template_version_id` names a row here, and every party-facing read
 * parses that row's payload through `zAssessment` — the same schema `data/assessments.ts` and
 * `content/` are checked against, so a version cannot hold a template the model would refuse.
 *
 * **Numbering.** `version` starts at 1 and the publish path writes `max + 1`, so "the live
 * version" is the highest number and `superseded_at` is the fact "a later one exists" rather than
 * a second opinion about which row is current. The migration's backfill writes v1 from the rows as
 * they stood; `scripts/db-seed.mjs` publishes the catalogue through `snapshotTemplateVersion()`
 * below, so a seeded version is written by the same statement a publish writes (#962).
 *
 * **Immutability is the database's.** `db/migrations/0026_template_version.sql` installs a
 * `BEFORE UPDATE` trigger that refuses any change except `superseded_at` NULL → instant, so the
 * only statement in this module that writes an existing row is `supersedeVersionsBelow()`.
 *
 * **Pure where it can be.** `latestVersionOf()` and `templateVersionIdOf()` are functions over
 * values, so the ordering rule and the key format are testable with no connection — the same
 * split `lib/db/rows.ts` uses. The reads take a `VersionSql` (a `pg` client, a pool query, or a
 * test's log) rather than reaching for the pool, which is also what lets the publish transaction
 * read the rows it is about to snapshot.
 */
import { zAssessment, type Assessment } from "@/content/assessment";
import { parseOrThrow } from "@/lib/db/rows";
import { queryRows } from "@/lib/db/client";

/** The one statement surface these reads and writes need: a client, a pool, or a test's fake. */
export interface VersionSql {
  query<R = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ readonly rows: readonly R[] }>;
}

/** Every column of a version row, in one place so a read and a statement cannot disagree. */
export const TEMPLATE_VERSION_COLUMNS =
  "id, template_record_id, version, payload, published_at, published_by, superseded_at";

/** The row as `pg` hands it back. `payload` is `unknown` because it is JSONB, not a type. */
export interface TemplateVersionRow {
  readonly id: string;
  readonly template_record_id: string;
  readonly version: number;
  readonly payload: unknown;
  readonly published_at: Date | string;
  readonly published_by: string | null;
  readonly superseded_at: Date | string | null;
}

/** A version without its payload — what a list needs, and nothing more. */
export interface TemplateVersionSummary {
  readonly id: string;
  readonly version: number;
  /** ISO, UTC — the instant it was published, whichever way `pg` hands the column back. */
  readonly publishedAt: string;
  /** `null` is "before publishing was recorded" — the backfill's rows and every seeded one. */
  readonly publishedBy: string | null;
  /** `null` is "this is the live version". */
  readonly supersededAt: string | null;
}

/** A version with the model it holds. */
export interface TemplateVersion extends TemplateVersionSummary {
  readonly template: Assessment;
}

/**
 * A version's id: `template-version-<record id>-v<number>`.
 *
 * Deterministic for the same reason the migration's backfill ids are: a re-run converges on the
 * row it wrote instead of adding a second copy of one fact. It is derived here and spelled in
 * `0026_template_version.sql`, which is the one place a copy is unavoidable — a migration cannot
 * import a module.
 */
export function templateVersionIdOf(templateRecordId: string, version: number): string {
  return `template-version-${templateRecordId}-v${version}`;
}

/** `record.date` as the model's one UTC instant, whichever way `pg` hands the column back. */
function instantOf(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

/** One row → one summary. No payload, so a list of versions costs no parse. */
export function versionSummaryOf(row: TemplateVersionRow): TemplateVersionSummary {
  return {
    id: row.id,
    version: row.version,
    publishedAt: instantOf(row.published_at),
    publishedBy: row.published_by,
    supersededAt: row.superseded_at === null ? null : instantOf(row.superseded_at),
  };
}

/**
 * One row → one version, payload parsed through `zAssessment`.
 *
 * A payload that does not parse is thrown, never best-effort: it is the template a relationship
 * draws, and a half-read one would render a report over questions nobody published. The message
 * names the version row's id, so `db:verify` and a 500 both point at the row to look at.
 */
export function templateOfVersionRow(row: TemplateVersionRow): Assessment {
  return parseOrThrow(zAssessment, row.payload, `template version "${row.id}"`);
}

/**
 * The live version of a list: the highest number wins.
 *
 * Pure, and the one place "which version is current" is decided for a list. A version with
 * `superseded_at IS NULL` is conventionally the highest, and the publish path maintains that; this
 * function does not trust the convention and takes the number, because a wrong `superseded_at`
 * must not be able to hide the newest publication.
 */
export function latestVersionOf<T extends { readonly version: number }>(
  versions: readonly T[],
): T | undefined {
  let latest: T | undefined;
  for (const version of versions) {
    if (latest === undefined || version.version > latest.version) latest = version;
  }
  return latest;
}

/* ------------------------------------------------------------------ *
 * The reads
 * ------------------------------------------------------------------ */

/** The pool as this module's narrower surface: `queryRows` answers rows, and `VersionSql` wants them wrapped. */
const POOLED: VersionSql = {
  query: async <R = Record<string, unknown>>(text: string, values: readonly unknown[] = []) => ({
    rows: (await queryRows(text, values)) as R[],
  }),
};

/** Every version of one template, newest first. The publish band on the editor draws this. */
export async function listTemplateVersions(
  templateRecordId: string,
): Promise<TemplateVersionSummary[]> {
  const rows = await queryRows<TemplateVersionRow>(
    `SELECT ${TEMPLATE_VERSION_COLUMNS}
       FROM template_version
      WHERE template_record_id = $1
      ORDER BY version DESC`,
    [templateRecordId],
  );
  return rows.map(versionSummaryOf);
}

const LIVE_VERSION_SQL = `
  SELECT ${TEMPLATE_VERSION_COLUMNS}
    FROM template_version
   WHERE template_record_id = $1
   ORDER BY version DESC
   LIMIT 1`;

/** The highest-numbered version's row, read through any statement surface. */
export async function readLiveVersionRow(
  sql: VersionSql,
  templateRecordId: string,
): Promise<TemplateVersionRow | undefined> {
  const result = await sql.query<TemplateVersionRow>(LIVE_VERSION_SQL, [templateRecordId]);
  return result.rows[0];
}

/**
 * The template a record id currently offers: its newest published version, or `undefined`.
 *
 * `undefined` is the honest answer for a template that has never been published (a draft) — the
 * catalogue, the picker and `createInstanceFromTemplate()` each decide what to do about it, and
 * none of them may fall back to the working copy: an unpublished edit is not an offer.
 */
export async function readLiveTemplateVersion(
  templateRecordId: string,
): Promise<TemplateVersion | undefined> {
  const row = await readLiveVersionRow(POOLED, templateRecordId);
  if (row === undefined) return undefined;
  return { ...versionSummaryOf(row), template: templateOfVersionRow(row) };
}

/* ------------------------------------------------------------------ *
 * The writes (always inside a caller's transaction)
 * ------------------------------------------------------------------ */

/** The version a publish will write: one past the highest, and 1 for a template never published. */
export async function nextVersionNumber(
  sql: VersionSql,
  templateRecordId: string,
): Promise<number> {
  const result = await sql.query<{ next: number }>(
    "SELECT COALESCE(max(version), 0) + 1 AS next FROM template_version WHERE template_record_id = $1",
    [templateRecordId],
  );
  return Number(result.rows[0]?.next ?? 1);
}

/**
 * Write one immutable version row.
 *
 * `published_at` defaults to `now()`, which in Postgres is the **transaction's** start instant:
 * every statement a publish runs therefore agrees about the instant it happened, and two rows
 * written by one transaction cannot carry instants in the wrong order (the table's CHECK would
 * refuse them).
 *
 * **`publishedAt` is the seed's, and only the seed's (#962).** `scripts/db-seed.mjs` writes the
 * catalogue as the bundle describes it, and `0026_template_version.sql` records why a seeded
 * version carries the template record's own `date` rather than the instant the seed ran: there is
 * no publish to attribute, and `now()` would claim one nobody made. It is an argument with a
 * default instead of a second INSERT for the same reason `insertTemplateVersion` exists at all —
 * one statement decides what a version row is, and the payload it is handed is already a
 * `zAssessment`.
 *
 * `ON CONFLICT (template_record_id, version) DO NOTHING RETURNING id` makes the write a claim
 * rather than a race: two publishes that computed the same next number cannot both land, and the
 * one that loses gets no id back, so the caller can refuse instead of overwriting.
 */
export async function insertTemplateVersion(
  sql: VersionSql,
  input: {
    readonly templateRecordId: string;
    readonly version: number;
    readonly template: Assessment;
    readonly publishedBy: string | null;
    /** ISO instant; omit for `now()`. The seed passes the record's own `date`. */
    readonly publishedAt?: string;
  },
): Promise<string | undefined> {
  const id = templateVersionIdOf(input.templateRecordId, input.version);
  const result = await sql.query<{ id: string }>(
    // `$5` stays the actor and `$6` is the optional instant, even though the instant appears first
    // in the VALUES list: the parameter positions are part of this statement's contract (the
    // publish tests read `values[4]` as the actor), so an argument added after them does not move
    // the ones an existing caller passes.
    `INSERT INTO template_version
       (id, template_record_id, version, payload, published_at, published_by)
     VALUES ($1, $2, $3, $4::jsonb, COALESCE($6::timestamptz, now()), $5)
     ON CONFLICT (template_record_id, version) DO NOTHING
     RETURNING id`,
    [
      id,
      input.templateRecordId,
      input.version,
      JSON.stringify(input.template),
      input.publishedBy,
      input.publishedAt ?? null,
    ],
  );
  return result.rows[0]?.id;
}

/**
 * Mark every version below `version` as superseded by this publish.
 *
 * The guard trigger refuses any other write to these rows, so this statement sets exactly one
 * column on rows that have not been superseded yet — `WHERE superseded_at IS NULL` keeps it from
 * rewriting an instant that is already a fact.
 */
export async function supersedeVersionsBelow(
  sql: VersionSql,
  templateRecordId: string,
  version: number,
): Promise<number> {
  const result = await sql.query<{ id: string }>(
    `UPDATE template_version
        SET superseded_at = now()
      WHERE template_record_id = $1
        AND version < $2
        AND superseded_at IS NULL
      RETURNING id`,
    [templateRecordId, version],
  );
  return result.rows.length;
}

/**
 * Write one published version of a template that has **already** been validated: write the next
 * number, supersede the rest — all through the caller's transaction.
 *
 * Validation is the caller's, and deliberately so: the console's publish validates the working copy
 * with `validateTemplateRecord()` (the validator `502a`'s save uses) so a refusal names the field,
 * and the two member surfaces that create a published template validate the rows they just wrote
 * with `assessmentTemplateFromRows()`. Both are `zAssessment`; neither is a second rule.
 *
 * `undefined` is "another publish won the number between the read and the insert" — the caller
 * refuses rather than retrying, because a retry would silently number a version the operator did
 * not see.
 */
export async function snapshotTemplateVersion(
  sql: VersionSql,
  input: {
    readonly template: Assessment;
    readonly publishedBy: string | null;
    /** ISO instant; omit for `now()`. Only `scripts/db-seed.mjs` passes one (#962). */
    readonly publishedAt?: string;
  },
): Promise<
  { readonly id: string; readonly version: number; readonly template: Assessment } | undefined
> {
  const version = await nextVersionNumber(sql, input.template.id);
  const id = await insertTemplateVersion(sql, {
    templateRecordId: input.template.id,
    version,
    template: input.template,
    publishedBy: input.publishedBy,
    ...(input.publishedAt === undefined ? {} : { publishedAt: input.publishedAt }),
  });
  if (id === undefined) return undefined;
  await supersedeVersionsBelow(sql, input.template.id, version);
  return { id, version, template: input.template };
}
