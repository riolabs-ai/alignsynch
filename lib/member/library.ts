/**
 * The member's library — `/dashboard/library`'s one read (#542 phase 1).
 *
 * **The question this answers is "what have I got", and the answer is a union of two facts.** A
 * template is in a member's library when either
 *
 *   they own it      `record.owner_user_id = $1` — the rows `/dashboard/templates` authors, and
 *                    the clones a member made from the catalogue;
 *   they used it     a `relationship` of theirs names it (`template_id`), which is how a template
 *                    somebody else published or an operator curated is "saved" to this account —
 *                    the relationship copies it, and the copy is what the relationship reads.
 *
 * Both halves are the *viewer's*: the owner column and the relationship's two person columns are
 * compared to the session's id, so the query cannot return somebody else's row even if a component
 * forgot to filter. That is the same shape `lib/member/templates.ts` and `lib/db/my-instances.ts`
 * use, and it is why this module takes an id rather than reading a session — the page resolves it
 * once (`requireRole`) and the read is a function of a value.
 *
 * **A relationship's private copy is not itself a library row.** A relationship copies its
 * template into a private record it names (`lib/member/templates.ts` records that exclusion on the
 * authoring side, for the same reason): listing the copy would put one row per relationship on the
 * screen and say nothing the original does not. The copy is still reachable from the relationship,
 * which is where a person looks for it.
 *
 * **`NOT EXISTS (session)` is the definition of a template**, repeated here rather than joined: a
 * record with a session is an instance, and an instance is never a template you can start from.
 *
 * Reads go through `queryRows`, so this surface gets the pool's dead-socket retry and the same
 * `DatabaseUnavailableError` every other console read raises — the page turns that into its panel.
 */
import { queryRows } from "@/lib/db/client";

/** One row of the library, in the list's shape. */
export interface LibraryRow {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly status: string;
  /** Aspects on the template, from its `item` rows. */
  readonly aspectCount: number;
  /** Relationships of this member's built from it. `0` is "not used yet". */
  readonly relationshipCount: number;
}

interface LibraryQueryRow {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly status: string;
  readonly aspect_count: number;
  readonly relationship_count: number;
}

/**
 * The library is **what the member owns**, and nothing else.
 *
 * It used to be two halves: a row you own, *or* a row named by a session you are a party to. That
 * second half was the defect — starting a relationship from a platform template put that template
 * in **My Templates** as if it were yours. A template is not a thing a relationship creates; the
 * relationship *uses* it. `party.user_id` is still how "one of my relationships" is spelled
 * (`MY_RELATIONSHIPS_OF` below), but membership of a relationship is not authorship of a template.
 *
 * A member who wants the template their relationship was built from can still have it — by an
 * explicit act, cloning it into a row they own, which is `listClonableTemplates`' door and not a
 * side effect of creating the relationship.
 *
 * `record_type = 'assessment'` excludes a session's own record; `NOT EXISTS` on `session.record_id`
 * keeps a row that is itself a session out for the same reason.
 */
const IN_LIBRARY = `
  r.record_type = 'assessment'
  AND NOT EXISTS (SELECT 1 FROM session own WHERE own.record_id = r.id)
  AND r.owner_user_id = $1
`;

/** The viewer's live relationships built from one template — distinct, because a session is one. */
const MY_RELATIONSHIPS_OF = `
  (SELECT count(DISTINCT ai.relationship_id)::int
     FROM session ai
     JOIN party p ON p.session_record_id = ai.record_id
    WHERE ai.template_record_id = r.id
      AND p.user_id = $1
      AND ai.voided_at IS NULL
      AND ai.relationship_id IS NOT NULL)
`;

/** Every template this member owns, A–Z. */
export async function listMemberLibrary(userId: string): Promise<LibraryRow[]> {
  const rows = await queryRows<LibraryQueryRow>(
    `SELECT r.id, r.slug, r.title, r.summary, r.status,
            (SELECT count(*)::int FROM item i WHERE i.record_id = r.id) AS aspect_count,
            ${MY_RELATIONSHIPS_OF} AS relationship_count
       FROM record r
      WHERE ${IN_LIBRARY}
      ORDER BY r.title`,
    [userId],
  );
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    summary: row.summary,
    status: row.status,
    aspectCount: Number(row.aspect_count),
    relationshipCount: Number(row.relationship_count),
  }));
}
