/**
 * The template library's read path — the SQL behind `/assessment/templates` and its detail page.
 *
 * **The author column is the filter, and there is no second one.** `WHERE r.author_user_id IS
 * NULL OR r.author_user_id = $1` is "the platform's templates plus this account's"; a row
 * written by anybody else is not returned by either statement, so the screen cannot render one
 * even if a component forgot to check. That is the difference between a filtered list and an
 * authorized one — the rule lives in the query, and `canUseTemplate` in
 * `lib/flow/template-library.ts` is the same rule stated once for the writer's side.
 *
 * `$1` is nullable on purpose: a signed-out visitor's answer is the built-ins only, because
 * `author_user_id = NULL` matches nothing. Nothing in this module reads a name, a header or a
 * role — the id is the session's (`lib/auth/session.ts`), which is the same rule
 * `lib/db/my-instances.ts` follows for `party.user_id`.
 *
 * **A template is a record with no `session` row.** The `NOT EXISTS` is the
 * definition `TEMPLATE_BY_ID_SQL` and `listPublishedTemplates()` already use, repeated here
 * rather than joined, so an instance can never be listed as a template and archived as one.
 *
 * Reads go through `queryRows` so this surface gets the same dead-socket retry and the same
 * `DatabaseUnavailableError` the instance list has.
 */
import type { PublishStatus } from "@/content/core";
import { queryRows } from "@/lib/db/client";
import { authorshipOf, type LibraryTemplate } from "@/lib/flow/template-library";

interface LibraryRow {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly status: string;
  readonly date: Date | string;
  /** NULL is the platform's template (`0011_console_columns.sql`). */
  readonly author_user_id: string | null;
  readonly aspects: number;
  readonly instances: number;
}

const LIBRARY_COLUMNS = `
  r.id, r.slug, r.title, r.summary, r.status, r.date, r.author_user_id,
  (SELECT count(*) FROM item i WHERE i.record_id = r.id)::int AS aspects,
  (SELECT count(*) FROM session ai WHERE ai.template_record_id = r.id)::int AS instances
`;

/** `record.date` as the model's one UTC instant, whichever way `pg` hands the column back. */
function instantOf(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function libraryTemplateOf(row: LibraryRow, viewerUserId: string | null): LibraryTemplate {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    status: row.status as PublishStatus,
    createdAt: instantOf(row.date),
    aspectCount: row.aspects,
    instanceCount: row.instances,
    authorship: authorshipOf(row.author_user_id, viewerUserId),
  };
}

/**
 * Every template this account may use: the platform's, plus the ones it wrote.
 *
 * **No `EXISTS (item)` filter**, unlike the catalogue's read. That read is a *picker* — a
 * template with no Aspects cannot be copied, so listing it there would offer a form that
 * refuses. This one is the author's management surface: a template with no Aspects is still a
 * row somebody owns, and hiding it would leave them no way to archive it. It renders with
 * "0 Aspects", which is the true answer.
 *
 * Archived templates are included: the screen is where a person finds one again to unarchive
 * it, and the status filter is what narrows the list when they do not want them. **Drafts are
 * not**, and not because they are somebody's: `draft` is the state the platform's blank fixture
 * holds (`assessment-blank-template`, which the catalogue has never listed either) and no path in
 * this app writes it — `createAssessmentTemplate` publishes, archiving archives. A draft on this
 * screen would be a template with no action that could make it usable, so the platform's blank
 * stays out; a draft the *viewer* wrote would stay in, because a person has to be able to manage
 * their own row whatever state it is in.
 */
export async function listLibraryTemplates(
  viewerUserId: string | null,
): Promise<LibraryTemplate[]> {
  const rows = await queryRows<LibraryRow>(
    `SELECT ${LIBRARY_COLUMNS}
       FROM record r
      WHERE r.record_type = 'assessment'
        AND (r.status <> 'draft' OR r.author_user_id = $1)
        AND NOT EXISTS (SELECT 1 FROM session ai WHERE ai.record_id = r.id)
        AND (r.author_user_id IS NULL OR r.author_user_id = $1)
      ORDER BY r.title`,
    [viewerUserId],
  );
  return rows.map((row) => libraryTemplateOf(row, viewerUserId));
}

/** One Aspect, as the detail page draws it. */
export interface TemplateAspect {
  readonly id: string;
  readonly position: number;
  readonly prompt: string;
  readonly leftValue: string;
  readonly rightValue: string;
}

/** One template and its Aspects — the "open" action's read. */
export interface LibraryTemplateDetail {
  readonly template: LibraryTemplate;
  readonly aspects: readonly TemplateAspect[];
}

interface AspectRow {
  readonly item_id: string;
  readonly position: number;
  readonly prompt: string;
  readonly left_value: string | null;
  readonly right_value: string | null;
}

/**
 * The template an id names, if this viewer may use it; `undefined` otherwise.
 *
 * "Otherwise" covers all three misses with one answer — no such record, a record that is an
 * instance, and a template somebody else wrote — because the page turns every one of them into
 * `notFound()`. Distinguishing them in the response would tell a stranger that an id exists,
 * which is the one thing a 404 is for.
 */
export async function readLibraryTemplate(
  recordId: string,
  viewerUserId: string | null,
): Promise<LibraryTemplateDetail | undefined> {
  const [row] = await queryRows<LibraryRow>(
    `SELECT ${LIBRARY_COLUMNS}
       FROM record r
      WHERE r.id = $1
        AND r.record_type = 'assessment'
        AND NOT EXISTS (SELECT 1 FROM session ai WHERE ai.record_id = r.id)
        AND (r.author_user_id IS NULL OR r.author_user_id = $2)`,
    [recordId, viewerUserId],
  );
  if (row === undefined) return undefined;

  const aspects = await queryRows<AspectRow>(
    `SELECT item_id, position, prompt, left_value, right_value
       FROM item
      WHERE record_id = $1
      ORDER BY position`,
    [recordId],
  );

  return {
    template: libraryTemplateOf(row, viewerUserId),
    aspects: aspects.map((aspect) => ({
      id: aspect.item_id,
      position: aspect.position,
      prompt: aspect.prompt,
      leftValue: aspect.left_value ?? "",
      rightValue: aspect.right_value ?? "",
    })),
  };
}
