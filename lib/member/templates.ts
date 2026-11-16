/**
 * The member's own templates — `/dashboard/templates` (#533 phase 2), reads and writes.
 *
 * **A template is a `record` with Aspects, no session and no owner but its author.** That
 * definition is not restated in SQL here where it already exists (`lib/db/assessments.ts`'s
 * `NOT EXISTS (session)` half, `lib/admin/templates.ts`'s same sentence for the console); what this
 * module adds is the two columns `0029_record_ownership_visibility.sql` gave the table:
 *
 *   owner_user_id  the member this template belongs to. Every write below writes the **actor's**
 *                  id and never a value from a request body, so a crafted post cannot author a
 *                  template for somebody else.
 *   visibility     always `private` on this path. Public listing is admin-curated (#533's "do
 *                  not make the public directory a form"), so a member's row is never in the
 *                  catalogue — and it is written `private` explicitly rather than relying on the
 *                  column's `public` default, which exists for the fixtures that predate #533.
 *
 * **`status` stays `draft`.** A draft is what keeps the row out of `listPublishedTemplates()` and
 * off `/assessment` without a second filter, and it is the honest word: nothing has been
 * published. #502b's versioned publish belongs to the console; a member does not publish a
 * template at all, they publish a *relationship* (which snapshots one — `lib/member/
 * relationships.ts`).
 *
 * **Every write is `act()`.** The action is `template.draft` (`lib/admin/roles.ts`), floored at
 * `member`, and `act()` writes the `admin_action` row with the reason inside the same transaction
 * as the `record` and `item` rows. There is no pool write here and no second transaction, so
 * "a refused save wrote nothing" is a property of the runner rather than a claim in a comment.
 *
 * **Ownership is checked inside the transaction, `FOR UPDATE`.** `readMyTemplate` filters by owner
 * so a stranger's row is not even read; the write path re-checks it under a row lock, because the
 * read a screen did is not the read that decides and #533 says to enforce it in the server action.
 *
 * **A relationship's own configuration is not a template of yours.** Creating a relationship copies
 * the chosen template into a private record that the relationship names (`template_id`), and the
 * two list reads below exclude exactly those rows — `visibility = 'private' AND EXISTS
 * (relationship.template_id = r.id)`. Without the exclusion every relationship would add a phantom
 * "template" to this screen and to `/templates/relationship`, and a published *public* template a
 * relationship copies is unaffected because its visibility is not private.
 */
import { act, type ActResult, type ActSql, type ActTransactionRunner } from "@/lib/admin/act";
import type { AdminAction } from "@/lib/admin/roles";
import type { Assessment } from "@/content/assessment";
import { queryRows } from "@/lib/db/client";
import { readAssessmentTemplateRowsById } from "@/lib/db/assessments";
import { assessmentTemplateFromRows } from "@/lib/db/rows";

/** Where the two member template screens live. One place, because a redirect and a link agree. */
export const MEMBER_TEMPLATES_PATH = "/dashboard/templates";

/** One member template, in one list's shape. */
export interface MemberTemplateRow {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  /** `record.status` — always `draft` today, and reported rather than assumed. */
  readonly status: string;
  /** `record.date`, as the model's one UTC instant. */
  readonly date: string;
  readonly aspectCount: number;
  /** Relationships copied from this template. `0` is "not used yet". */
  readonly relationshipCount: number;
}

interface MemberTemplateQueryRow {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly status: string;
  readonly date: Date | string;
  readonly aspect_count: number;
  readonly relationship_count: number;
}

/**
 * The two halves of "these are the member's own, and not a relationship's private copy".
 *
 * Spelled once so the list, the editor's 404 and the create path's duplicate check cannot drift
 * apart. `$1` is the viewer's id.
 */
const OWNED_TEMPLATE_PREDICATE = `
  r.record_type = 'assessment'
  AND r.owner_user_id = $1
  AND NOT EXISTS (SELECT 1 FROM session own WHERE own.record_id = r.id)
  AND NOT EXISTS (
    SELECT 1 FROM relationship rel
     WHERE rel.template_id = r.id AND r.visibility = 'private'
  )
`;

/** Every template this member owns, newest first. */
export async function listMyTemplates(userId: string): Promise<MemberTemplateRow[]> {
  const rows = await queryRows<MemberTemplateQueryRow>(
    `SELECT r.id, r.slug, r.title, r.summary, r.status, r.date,
            (SELECT count(*)::int FROM item i WHERE i.record_id = r.id) AS aspect_count,
            (SELECT count(*)::int FROM relationship rel WHERE rel.template_id = r.id)::int
              AS relationship_count
       FROM record r
      WHERE ${OWNED_TEMPLATE_PREDICATE}
      ORDER BY r.date DESC, r.title ASC`,
    [userId],
  );
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    status: row.status,
    date: row.date instanceof Date ? row.date.toISOString() : new Date(row.date).toISOString(),
    aspectCount: Number(row.aspect_count),
    relationshipCount: Number(row.relationship_count),
  }));
}

/** A template another member may clone: the admin-curated catalogue, and nothing else. */
export interface ClonableTemplate {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly aspectCount: number;
}

/**
 * The templates a member may copy into one of their own — the public catalogue, **and their own**.
 *
 * **Own rows are here because duplicating your own template is a real action** (#1109). Until the
 * legacy `/templates/relationship` listing retired, its row menu offered "duplicate" on a template
 * the member had written; the dashboard's copy band is that action's only home now, so the band
 * lists what a member can copy and a row they own is copyable by them.
 *
 * The public half is `visibility = 'public'` **and** `status = 'published'` **and** at least one
 * Aspect. The last clause is the picker's own: a template with none cannot be copied into a record
 * `zAssessment` would accept, so offering it would be offering a form that refuses.
 * `owner_user_id IS DISTINCT FROM $1` on that half keeps a member's own row out of "copy somebody
 * else's" — it is not a permission, it is deduplication, and the second half is where an own row
 * appears exactly once. Both halves exclude a relationship's private copy (`relationship.template_id`
 * on a private row): that row is not a template anybody authored, and it has its own fork path.
 */
export async function listClonableTemplates(userId: string): Promise<ClonableTemplate[]> {
  const rows = await queryRows<{
    id: string;
    slug: string;
    title: string;
    summary: string;
    aspects: number;
  }>(
    `SELECT r.id, r.slug, r.title, r.summary,
            (SELECT count(*) FROM item i WHERE i.record_id = r.id)::int AS aspects
       FROM record r
      WHERE r.record_type = 'assessment'
        AND NOT EXISTS (SELECT 1 FROM session own WHERE own.record_id = r.id)
        AND EXISTS (SELECT 1 FROM item i WHERE i.record_id = r.id)
        AND (
          (
            r.visibility = 'public'
            AND r.status = 'published'
            AND r.owner_user_id IS DISTINCT FROM $1
          )
          OR (
            r.owner_user_id = $1
            AND NOT EXISTS (
              SELECT 1 FROM relationship rel
               WHERE rel.template_id = r.id AND r.visibility = 'private'
            )
          )
        )
      ORDER BY r.title`,
    [userId],
  );
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    aspectCount: Number(row.aspects),
  }));
}

/** The editor's view: the parsed template and whether this member may still edit it. */
export interface MemberTemplateView {
  readonly template: Assessment;
  /**
   * Always `true` for a member template today, and asked rather than assumed: a row an operator
   * archived is read-only, and the editor's locked panel needs the fact.
   */
  readonly editable: boolean;
}

/**
 * One template, if it is this member's.
 *
 * `undefined` covers three cases on purpose — no such id, an instance rather than a template, and
 * **somebody else's row** — because the page turns all three into `notFound()`, which is the 404 a
 * URL that never existed returns. A distinguishable "not yours" would tell a prober which ids are
 * real, which is `lib/auth/require-role.ts`'s rule applied to a row instead of a surface.
 */
export async function readMyTemplate(
  userId: string,
  templateId: string,
): Promise<MemberTemplateView | undefined> {
  const owned = await queryRows<{ id: string; status: string }>(
    `SELECT r.id, r.status FROM record r WHERE r.id = $2 AND ${OWNED_TEMPLATE_PREDICATE}`,
    [userId, templateId],
  );
  const row = owned[0];
  if (row === undefined) return undefined;

  const rows = await readAssessmentTemplateRowsById(templateId);
  if (rows === undefined) return undefined;
  return {
    template: assessmentTemplateFromRows(rows),
    editable: row.status !== "archived",
  };
}

/* ------------------------------------------------------------------ *
 * The writes
 * ------------------------------------------------------------------ */

/** What a member template write is asked for: who, why, and the record the editor built. */
export interface MemberTemplateWriteRequest {
  readonly actorUserId: string;
  readonly reason: string;
  /** Parsed by `zAssessment` in the caller (`app/(mainlayout)/dashboard/templates/actions.ts`). */
  readonly record: Assessment;
}

/** What the audit row keeps: the template's own words, never a party or an opinion. */
function auditPayload(record: Assessment) {
  return {
    id: record.id,
    slug: record.slug,
    title: record.title,
    status: record.status,
    visibility: "private" as const,
    aspects: record.items.map((item) => ({
      id: item.id,
      prompt: item.prompt,
      leftValue: item.leftValue,
      rightValue: item.rightValue,
    })),
  };
}

export type MemberTemplateAuditPayload = ReturnType<typeof auditPayload>;

/** The statements that write one template's Aspects, in the record's own order. */
async function writeItems(sql: ActSql, recordId: string, record: Assessment) {
  for (const [position, item] of record.items.entries()) {
    await sql.query(
      `INSERT INTO item (record_id, item_id, position, prompt, scale_kind, left_value, right_value)
       VALUES ($1, $2, $3, $4, 'score', $5, $6)`,
      [recordId, item.id, position, item.prompt, item.leftValue, item.rightValue],
    );
  }
}

/**
 * A slug no record answers to.
 *
 * `record.slug` is `UNIQUE` across the whole table (0001) — every brand, every template, every
 * instance — so two members naming a template "Team check-in" collide on the natural slug. The
 * first attempt keeps the natural slug (a readable URL is worth having); a taken one gets six hex
 * characters appended, which is unique by construction with overwhelming probability and is
 * re-checked anyway. The check is a `SELECT` in the transaction that inserts, so the failure mode is
 * one retry rather than a `23505` a member would read as a bug.
 *
 * **Only the slug is derived here.** The record's `id` is the caller's, generated from a token
 * before the transaction opens — it is the `admin_action` target, and an id that changed inside the
 * transaction would leave the audit row pointing at nothing.
 */
export async function freeSlug(sql: ActSql, base: string): Promise<string> {
  const stem = base.trim() === "" ? "template" : base.trim();
  const first = await sql.query<{ id: string }>("SELECT id FROM record WHERE slug = $1 LIMIT 1", [
    stem,
  ]);
  if (first.rows[0] === undefined) return stem;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = `${stem}-${Math.random().toString(16).slice(2, 8)}`;
    const taken = await sql.query<{ id: string }>("SELECT id FROM record WHERE slug = $1 LIMIT 1", [
      candidate,
    ]);
    if (taken.rows[0] === undefined) return candidate;
  }
  throw new Error("member/templates: no free slug after 8 attempts — refusing to invent one");
}

/**
 * Create a **private** template from the editor's record.
 *
 * The record arrives validated (`zAssessment`) and the three fields a member does not control are
 * forced here: `owner_user_id`/`author_user_id` are the actor's, `visibility` is `private`, and
 * `status` is `draft`. The action's body cannot name any of them — `bodyOf()` in the server action
 * overwrites the ones the schema carries and never copies the rest — so "members can never create a
 * public template" is a property of this statement, not of a hidden input.
 */
export async function createPrivateTemplate(
  request: MemberTemplateWriteRequest,
  runner?: ActTransactionRunner,
): Promise<ActResult<MemberTemplateAuditPayload & { slug: string }>> {
  const record = request.record;

  return act<MemberTemplateAuditPayload & { slug: string }>(
    {
      actorUserId: request.actorUserId,
      action: "template.draft" satisfies AdminAction,
      target: { table: "record", id: record.id },
      reason: request.reason,
      mutate: async (sql) => {
        const slug = await freeSlug(sql, record.slug);

        await sql.query(
          `INSERT INTO record
             (id, slug, record_type, status, date, title, summary,
              author_user_id, owner_user_id, visibility)
           VALUES ($1, $2, 'assessment', 'draft', $3, $4, $5, $6, $6, 'private')`,
          [record.id, slug, record.date, record.title, record.summary, request.actorUserId],
        );
        await writeItems(sql, record.id, record);

        return {
          before: null,
          after: { ...auditPayload(record), slug },
        };
      },
    },
    runner,
  );
}

/** What a clone is asked for: who, why, which public template — and the new record's id. */
export interface CloneRequest {
  readonly actorUserId: string;
  readonly reason: string;
  readonly templateId: string;
  /**
   * The new record's id, generated by the action before the transaction opens.
   *
   * It is the `admin_action` target, so it cannot be derived inside the transaction — and it is a
   * token rather than a slug because the slug has to be checked against the whole `record` table
   * inside the transaction that inserts, while the id only has to be unique.
   */
  readonly id: string;
}

/**
 * Clone a template into a private one of the member's own — the catalogue's, or their own.
 *
 * The copy is `INSERT … SELECT` over the source's `item` rows, in the transaction: the source can
 * be withdrawn between the page's read and this write, so a copy assembled from a value the screen
 * held would be a copy of a template nobody may use any more. The source is read `FOR SHARE`, the
 * same lock `createInstanceFromTemplate` takes, so a concurrent unpublish waits rather than
 * committing under a copy that is half-written.
 *
 * **Two sources are copyable, and the difference is a product rule.** A public published template
 * is how a person takes the catalogue's starting point and makes it theirs; **a template they own**
 * is the duplicate action the retired `/templates/relationship` row menu carried (#1109), and it is
 * offered here because this band is that action's only home now. Anything else — another account's
 * row, a relationship's private copy — is `no-such-template`, which is the same refusal an id that
 * names nothing gets, so a prober learns nothing about which ids exist.
 *
 * The rows written are the member's: `owner_user_id` and `author_user_id` are the actor's,
 * `visibility` is `private`, `status` is `draft`. Nothing links the clone back to the original —
 * a clone is a copy, and an edit to either one must not reach the other.
 */
export async function clonePublicTemplate(
  request: CloneRequest,
  runner?: ActTransactionRunner,
): Promise<ActResult<MemberTemplateAuditPayload & { slug: string }>> {
  return act<MemberTemplateAuditPayload & { slug: string }>(
    {
      actorUserId: request.actorUserId,
      action: "template.draft" satisfies AdminAction,
      target: { table: "record", id: request.id },
      reason: request.reason,
      mutate: async (sql) => {
        const source = await sql.query<{
          id: string;
          slug: string;
          record_type: string;
          title: string;
          summary: string;
          status: string;
          visibility: string;
          owner_user_id: string | null;
        }>(
          `SELECT id, slug, title, summary, status, visibility, owner_user_id
             FROM record
            WHERE id = $1
              AND record_type = 'assessment'
              AND NOT EXISTS (SELECT 1 FROM session own WHERE own.record_id = record.id)
              FOR SHARE`,
          [request.templateId],
        );
        const from = source.rows[0];
        const copyable =
          from !== undefined &&
          ((from.visibility === "public" && from.status === "published") ||
            from.owner_user_id === request.actorUserId);
        if (!copyable) {
          throw new MemberTemplateRefused(
            "no-such-template",
            `"${request.templateId}" is not a template this account may copy — the catalogue offers published templates, and a member copies their own`,
          );
        }

        const slug = await freeSlug(sql, from.slug);
        await sql.query(
          `INSERT INTO record
             (id, slug, record_type, status, date, title, summary,
              author_user_id, owner_user_id, visibility)
           VALUES ($1, $2, 'assessment', 'draft', now(), $3, $4, $5, $5, 'private')`,
          [request.id, slug, from.title, from.summary, request.actorUserId],
        );
        await sql.query(
          `INSERT INTO item (record_id, item_id, position, prompt, scale_kind, left_value, right_value)
           SELECT $1, i.item_id, i.position, i.prompt, 'score', i.left_value, i.right_value
             FROM item i
            WHERE i.record_id = $2
            ORDER BY i.position`,
          [request.id, from.id],
        );

        const items = await sql.query<{
          item_id: string;
          prompt: string;
          left_value: string;
          right_value: string;
        }>(
          `SELECT item_id, prompt, left_value, right_value FROM item
            WHERE record_id = $1 ORDER BY position`,
          [request.id],
        );

        return {
          before: null,
          after: {
            id: request.id,
            slug,
            title: from.title,
            status: "draft",
            visibility: "private" as const,
            aspects: items.rows.map((item) => ({
              id: item.item_id,
              prompt: item.prompt,
              leftValue: item.left_value,
              rightValue: item.right_value,
            })),
          },
        };
      },
    },
    runner,
  );
}

/**
 * Edit one of the member's own templates.
 *
 * The row is read `FOR UPDATE` and the owner is re-checked inside the transaction: `readMyTemplate`
 * filtered the page's read, and this is the read that decides. A stranger's id answers
 * `not-yours` — which the *action* maps to the same `notFound()` the page gives, so the two paths
 * cannot disagree about whether the row exists.
 *
 * The Aspects are rewritten rather than diffed, exactly as the console does it, and for the same
 * reason: a template's items have no session depending on them (a session copies them and never
 * joins back), so replacing the set cannot leave a stale Aspect behind.
 */
export async function savePrivateTemplate(
  request: MemberTemplateWriteRequest,
  runner?: ActTransactionRunner,
): Promise<ActResult<MemberTemplateAuditPayload & { slug: string }>> {
  const record = request.record;

  return act<MemberTemplateAuditPayload & { slug: string }>(
    {
      actorUserId: request.actorUserId,
      action: "template.draft" satisfies AdminAction,
      target: { table: "record", id: record.id },
      reason: request.reason,
      mutate: async (sql) => {
        const found = await sql.query<{
          id: string;
          slug: string;
          record_type: string;
          status: string;
          title: string;
          summary: string;
          owner_user_id: string | null;
        }>(
          `SELECT id, slug, record_type, status, title, summary, owner_user_id
             FROM record WHERE id = $1 FOR UPDATE`,
          [record.id],
        );
        const row = found.rows[0];
        if (row === undefined || row.record_type !== "assessment") {
          throw new MemberTemplateRefused(
            "no-such-template",
            `no template record holds the id "${record.id}"`,
          );
        }
        if (row.owner_user_id !== request.actorUserId) {
          throw new MemberTemplateRefused(
            "not-yours",
            `template "${row.slug}" belongs to another account; only its owner may edit it`,
          );
        }
        if (row.status === "archived") {
          throw new MemberTemplateRefused(
            "not-editable",
            `"${row.slug}" is archived — a retired template is read-only`,
          );
        }

        const before = {
          id: row.id,
          slug: row.slug,
          title: row.title,
          status: row.status,
          visibility: "private" as const,
          aspects: (
            await sql.query<{
              item_id: string;
              prompt: string;
              left_value: string | null;
              right_value: string | null;
            }>(
              `SELECT item_id, prompt, left_value, right_value FROM item
                WHERE record_id = $1 ORDER BY position`,
              [record.id],
            )
          ).rows.map((item) => ({
            id: item.item_id,
            prompt: item.prompt,
            leftValue: item.left_value,
            rightValue: item.right_value,
          })),
        };

        let slug = row.slug;
        if (record.slug !== row.slug) {
          const clash = await sql.query<{ id: string }>(
            "SELECT id FROM record WHERE slug = $1 AND id <> $2 LIMIT 1",
            [record.slug, record.id],
          );
          slug = clash.rows[0] === undefined ? record.slug : await freeSlug(sql, record.slug);
        }

        await sql.query("UPDATE record SET slug = $2, title = $3, summary = $4 WHERE id = $1", [
          record.id,
          slug,
          record.title,
          record.summary,
        ]);
        await sql.query("DELETE FROM item WHERE record_id = $1", [record.id]);
        await writeItems(sql, record.id, record);

        return { before, after: { ...auditPayload(record), slug } };
      },
    },
    runner,
  );
}

/* ------------------------------------------------------------------ *
 * Retire: archive, restore, destroy — the member's own template
 * ------------------------------------------------------------------ */

/**
 * What a retire is asked for: who, why, which template.
 *
 * The three writers below are the dashboard's half of #1109: `/templates/relationship` was the only
 * surface that could archive, unarchive or delete a member's own template, and retiring that listing
 * without these would have deleted three actions a member has. They live here rather than in
 * `lib/admin/templates.ts` for the reason `lib/admin/roles.ts` gives: the console's retire pair is
 * floored at `admin` because the catalogue is what the product offers, while these three act on a
 * row whose `owner_user_id` is the caller's, which is `template.draft`'s rung (`member`).
 */
export interface MemberTemplateRetireRequest {
  readonly actorUserId: string;
  /** The audit sentence, composed by the caller (`lib/member/template-reasons.ts`). */
  readonly reason: string;
  readonly templateId: string;
}

/** The row a retire begins from: enough to write the audit row's `before` and its `after`. */
interface RetirableTemplateRow {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly status: string;
}

/**
 * The template a retire may touch, read **inside** the transaction that writes.
 *
 * `undefined`-shaped failures are two refusals, not one: an id that names no template this account
 * owns and an id that names nothing at all both answer `no-such-template` (`readMyTemplate`'s rule —
 * a distinguishable "not yours" tells a prober which ids are real), and a row that exists without
 * being the caller's answers `not-yours`.
 */
async function lockOwnedTemplate(
  sql: ActSql,
  request: MemberTemplateRetireRequest,
): Promise<RetirableTemplateRow> {
  const found = await sql.query<RetirableTemplateRow & { owner_user_id: string | null }>(
    `SELECT r.id, r.slug, r.title, r.status, r.owner_user_id
       FROM record r
      WHERE r.id = $1
        AND r.record_type = 'assessment'
        AND NOT EXISTS (SELECT 1 FROM session own WHERE own.record_id = r.id)
        FOR UPDATE OF r`,
    [request.templateId],
  );
  const row = found.rows[0];
  if (row === undefined) {
    throw new MemberTemplateRefused(
      "no-such-template",
      `no template record holds the id "${request.templateId}"`,
    );
  }
  if (row.owner_user_id !== request.actorUserId) {
    throw new MemberTemplateRefused(
      "not-yours",
      `template "${row.slug}" belongs to another account; only its owner may retire it`,
    );
  }
  return { id: row.id, slug: row.slug, title: row.title, status: row.status };
}

/**
 * Archive a template the member owns.
 *
 * Archiving is the reversible half, and the fixture says what it means: the row stops being offered
 * and every relationship that was created from it keeps the version it copied. `already-archived`
 * is a refusal rather than a silent no-op, because an archive control on an archived row is a
 * question ("did anything happen?") the answer has to settle.
 */
export async function archiveMyTemplate(
  request: MemberTemplateRetireRequest,
  runner?: ActTransactionRunner,
): Promise<ActResult<RetirableTemplateRow>> {
  return act<RetirableTemplateRow>(
    {
      actorUserId: request.actorUserId,
      action: "template.draft" satisfies AdminAction,
      target: { table: "record", id: request.templateId },
      reason: request.reason,
      mutate: async (sql) => {
        const before = await lockOwnedTemplate(sql, request);
        if (before.status === "archived") {
          throw new MemberTemplateRefused(
            "already-archived",
            `"${before.slug}" is already archived: there is nothing to retire`,
          );
        }

        await sql.query("UPDATE record SET status = 'archived' WHERE id = $1", [before.id]);

        return { before, after: { ...before, status: "archived" } };
      },
    },
    runner,
  );
}

/**
 * Bring an archived template back as a working copy — `draft`, never `published`.
 *
 * Restoring to the state it was retired from would be `published` for a template that never had a
 * version, and a member's row is never published to the catalogue (public listing is admin-curated,
 * #533). `draft` is also the honest word: nothing is being offered, it is being handed back.
 */
export async function restoreMyTemplate(
  request: MemberTemplateRetireRequest,
  runner?: ActTransactionRunner,
): Promise<ActResult<RetirableTemplateRow>> {
  return act<RetirableTemplateRow>(
    {
      actorUserId: request.actorUserId,
      action: "template.draft" satisfies AdminAction,
      target: { table: "record", id: request.templateId },
      reason: request.reason,
      mutate: async (sql) => {
        const before = await lockOwnedTemplate(sql, request);
        if (before.status !== "archived") {
          throw new MemberTemplateRefused(
            "not-archived",
            `"${before.slug}" is ${before.status}: there is nothing to restore`,
          );
        }

        await sql.query("UPDATE record SET status = 'draft' WHERE id = $1", [before.id]);

        return { before, after: { ...before, status: "draft" } };
      },
    },
    runner,
  );
}

/**
 * Destroy a template no reader can reach, and refuse every row that has one.
 *
 * The same referential rule the console's delete enforces, with the two codes this screen's fixture
 * carries: a relationship was created from it (`template-in-use` — archive it), or it has a
 * published version (`template-published` — its history is what the catalogue offered). What is
 * left is a draft nobody answered under, and `item` cascades from `record`, so one statement is
 * enough. The audit row's `before` is the last copy of the template that exists afterwards.
 */
export async function deleteMyTemplate(
  request: MemberTemplateRetireRequest,
  runner?: ActTransactionRunner,
): Promise<ActResult<RetirableTemplateRow>> {
  return act<RetirableTemplateRow>(
    {
      actorUserId: request.actorUserId,
      action: "template.draft" satisfies AdminAction,
      target: { table: "record", id: request.templateId },
      reason: request.reason,
      mutate: async (sql) => {
        const before = await lockOwnedTemplate(sql, request);

        const started = await sql.query<{ started: number }>(
          `SELECT (SELECT count(*) FROM session s WHERE s.template_record_id = $1)
                + (SELECT count(*) FROM relationship rel WHERE rel.template_id = $1) AS started`,
          [before.id],
        );
        if (Number(started.rows[0]?.started ?? 0) > 0) {
          throw new MemberTemplateRefused(
            "template-in-use",
            `"${before.slug}" was used by a relationship — archive it. A template somebody answered under is never destroyed`,
          );
        }

        const versions = await sql.query<{ version: number | null }>(
          "SELECT max(version) AS version FROM template_version WHERE template_record_id = $1",
          [before.id],
        );
        if ((versions.rows[0]?.version ?? null) !== null) {
          throw new MemberTemplateRefused(
            "template-published",
            `"${before.slug}" has a published version: its history is what the catalogue offered — archive it`,
          );
        }

        await sql.query("DELETE FROM record WHERE id = $1", [before.id]);

        return { before, after: { ...before, status: "deleted" } };
      },
    },
    runner,
  );
}

/* ------------------------------------------------------------------ *
 * Refusals
 * ------------------------------------------------------------------ */

/**
 * Why a member template write was refused — facts about the row, not about permission.
 *
 * `act()`'s own refusals (`ActRefused`: a short reason, a role below the floor) and these are
 * different kinds of answer, and the action maps both to one code union so the screen draws one
 * sentence per code.
 *
 * The last four belong to the retire writers (#1109), and each names a state of the row rather than
 * a rule: already archived, not archived, answered under, published. Every one of them has a
 * sentence in the member editor's fixture.
 */
export type MemberTemplateRefusal =
  | "no-such-template"
  | "not-yours"
  | "not-editable"
  | "already-archived"
  | "not-archived"
  | "template-in-use"
  | "template-published";

export class MemberTemplateRefused extends Error {
  readonly reason: MemberTemplateRefusal;

  constructor(reason: MemberTemplateRefusal, message: string) {
    super(message);
    this.name = "MemberTemplateRefused";
    this.reason = reason;
  }
}
