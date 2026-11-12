/**
 * The template library's read path — the SQL behind `/templates/relationship` and its detail page.
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
import { assessmentTemplateFromPayload } from "@/lib/db/rows";
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

/**
 * The **published** version's words, falling back to the working copy for a template that has never
 * been published (#502b).
 *
 * The catalogue offers what has been published, not what somebody is currently editing: without
 * this lateral join an unsaved (or saved-but-unpublished) edit to a published template would change
 * what the catalogue offers while every relationship still reads the version it was created from.
 * The fallback is the draft's own words, which is what a never-published row is — and a draft is
 * only in this list for its author.
 *
 * `jsonb_array_length` is the Aspect count of the offered version; the row's own `item` count is the
 * fallback, and the two are equal until somebody edits a published template.
 */
const LIBRARY_COLUMNS = `
  r.id, r.slug, r.status, r.date, r.author_user_id,
  COALESCE(live.payload->>'title', r.title)       AS title,
  COALESCE(live.payload->>'summary', r.summary)   AS summary,
  COALESCE(jsonb_array_length(live.payload->'items'),
           (SELECT count(*) FROM item i WHERE i.record_id = r.id))::int AS aspects,
  (SELECT count(*) FROM session ai WHERE ai.template_record_id = r.id)::int AS instances
`;

const LIVE_VERSION_JOIN = `
  LEFT JOIN LATERAL (
    SELECT v.payload
      FROM template_version v
     WHERE v.template_record_id = r.id
     ORDER BY v.version DESC
     LIMIT 1
  ) live ON true
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
 *
 * **A relationship's private copy is not a template, and this read now says so (#743).** Creating
 * a relationship copies the chosen template into a `record` of its own and points
 * `relationship.template_id` at that copy (`lib/member/relationships.ts`). The copy is written
 * `draft`, `private`, and `author_user_id = actor` — which satisfied every clause above, so it was
 * listed on this screen as one of the account's own templates. Measured on the demo branch before
 * the fix: a freshly created relationship added a phantom "Yours" row whose archive and delete
 * controls would have reached a live relationship's own record. The exclusion is the same one
 * `lib/member/templates.ts` states for `/dashboard/templates` (`OWNED_TEMPLATE_PREDICATE`), spelled
 * the same way, because it is one fact: a private record somebody started a relationship from is
 * that relationship's configuration, not a template of theirs.
 */
export async function listLibraryTemplates(
  viewerUserId: string | null,
): Promise<LibraryTemplate[]> {
  const rows = await queryRows<LibraryRow>(
    `SELECT ${LIBRARY_COLUMNS}
       FROM record r
       ${LIVE_VERSION_JOIN}
      WHERE r.record_type = 'assessment'
        AND (r.status <> 'draft' OR r.author_user_id = $1)
        AND NOT EXISTS (SELECT 1 FROM session ai WHERE ai.record_id = r.id)
        AND NOT EXISTS (
          SELECT 1 FROM relationship rel
           WHERE rel.template_id = r.id AND r.visibility = 'private'
        )
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
 * The template a **slug** names, if this viewer may use it; `undefined` otherwise.
 *
 * The address carries `record.slug` since #794, and a bookmarked id-shaped URL that survived a
 * 308 still carries the row's `id` — so the handle is matched against both columns. Both are
 * indexed (`id` is the primary key, `slug` is `NOT NULL UNIQUE`), so this is one index lookup
 * either way, and it is what lets a permanent redirect land on a page that resolves it without a
 * second entry point in the app's own links.
 *
 * "Otherwise" covers all four misses with one answer — no such record, a record that is an
 * instance, a template somebody else wrote, and a withdrawn one — because the page turns every one
 * of them into `notFound()`. Distinguishing them in the response would tell a stranger that a
 * handle exists, which is the one thing a 404 is for.
 *
 * **A draft is readable only by its author**, which is the list's own rule and what makes
 * unpublishing withdraw the offer rather than merely hide a row: an unpublished template is
 * `draft`, so a bookmark or a shared link to its detail page answers `notFound()` instead of
 * drawing the Aspects of a template the catalogue no longer offers. The history is not withdrawn
 * with it — the versions and every relationship bound to one are untouched (#502b).
 */
export async function readLibraryTemplate(
  handle: string,
  viewerUserId: string | null,
): Promise<LibraryTemplateDetail | undefined> {
  const [row] = await queryRows<LibraryRow & { readonly live_payload: unknown }>(
    `SELECT ${LIBRARY_COLUMNS}, live.payload AS live_payload
       FROM record r
       ${LIVE_VERSION_JOIN}
      WHERE (r.slug = $1 OR r.id = $1)
        AND r.record_type = 'assessment'
        AND (r.status <> 'draft' OR r.author_user_id = $2)
        AND NOT EXISTS (SELECT 1 FROM session ai WHERE ai.record_id = r.id)
        AND (r.author_user_id IS NULL OR r.author_user_id = $2)`,
    [handle, viewerUserId],
  );
  if (row === undefined) return undefined;

  // The detail page shows what the catalogue offers: the published version's Aspects when there is
  // one, the working copy otherwise. Both are `zAssessment` items, so a version's payload is parsed
  // exactly as the rows would be, and `position` is the version's own order. The **id** is the
  // storage handle here (`item.record_id`), which is why the read above returns it beside the slug.
  const aspects: readonly TemplateAspect[] =
    row.live_payload === null
      ? (
          await queryRows<AspectRow>(
            `SELECT item_id, position, prompt, left_value, right_value
               FROM item
              WHERE record_id = $1
              ORDER BY position`,
            [row.id],
          )
        ).map((aspect) => ({
          id: aspect.item_id,
          position: aspect.position,
          prompt: aspect.prompt,
          leftValue: aspect.left_value ?? "",
          rightValue: aspect.right_value ?? "",
        }))
      : assessmentTemplateFromPayload(
          row.live_payload,
          `template version of "${row.id}"`,
        ).items.map((item, position) => ({
          id: item.id,
          position,
          prompt: item.prompt,
          leftValue: item.leftValue,
          rightValue: item.rightValue,
        }));

  return {
    template: libraryTemplateOf(row, viewerUserId),
    aspects,
  };
}

/** The two handles a template row has, and which of them belongs in a URL (#794). */
export interface TemplateHandle {
  /** The primary key — the storage handle: `item.record_id`, the draft cookie, a POST body. */
  readonly id: string;
  /** The address — `[slug]` in `/templates/relationship/<slug>`. Never a storage key. */
  readonly slug: string;
}

/**
 * The row a **slug or an id** names, or `undefined` — the two POST endpoints' and the create
 * endpoint's resolution step (#794).
 *
 * **Not an authorization read, deliberately.** The slug is in the URL and is not a secret, and the
 * two writers this feeds (`setTemplateStatus`, `duplicateTemplate`) keep their own `WHERE` — that
 * narrow clause *is* the permission, and a second copy of the rule here would be a second chance
 * to get it wrong. So this answers "which row is this address about", and nothing else.
 *
 * A single `record_type = 'assessment'` + `NOT EXISTS (session)` predicate, for the reason
 * `readLibraryTemplate` states: an instance must never be reachable as a template. Both columns
 * are indexed and the match is one of them, so the `OR` costs no scan.
 */
export async function resolveTemplateHandle(handle: string): Promise<TemplateHandle | undefined> {
  const [row] = await queryRows<{ readonly id: string; readonly slug: string }>(
    `SELECT r.id, r.slug
       FROM record r
      WHERE (r.slug = $1 OR r.id = $1)
        AND r.record_type = 'assessment'
        AND NOT EXISTS (SELECT 1 FROM session ai WHERE ai.record_id = r.id)
      LIMIT 1`,
    [handle],
  );
  return row === undefined ? undefined : { id: row.id, slug: row.slug };
}

/**
 * The **slug** a record id addresses, or `""` — the flow handlers' redirect target (#794).
 *
 * Stage 1's form and the draft cookie both carry `record.id`, and every stage's address carries
 * `record.slug`; a handler that redirects is therefore the one place the two meet. This is that
 * crossing, and it is deliberately **total**: an empty handle, a row that is gone and a database
 * that did not answer all return `""`, which every caller reads as "no template" and answers with
 * the library — the screen that lists what can be copied.
 *
 * A refusal is a redirect, and a redirect to a screen that is not the one asked for is still a
 * redirect. A 500 out of a refusal path is the one outcome worse than the refusal, so this
 * function never throws; the failure is logged instead of raised.
 */
export async function templateSlugOf(recordId: string): Promise<string> {
  const trimmed = recordId.trim();
  if (trimmed === "") return "";
  try {
    return (await resolveTemplateHandle(trimmed))?.slug ?? "";
  } catch (error) {
    console.error("[flow] the template's slug could not be read; refusing to the library", error);
    return "";
  }
}
