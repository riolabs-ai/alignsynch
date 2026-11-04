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
  /** `owner_user_id = viewer`: the row is the member's own template, not one they adopted. */
  readonly owned: boolean;
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
  readonly owned: boolean;
  readonly aspect_count: number;
  readonly relationship_count: number;
}

/**
 * The two halves, spelled once: owned by the viewer, or named by an instance session the viewer is
 * a party to.
 *
 * `$1` is the viewer's id in both. **Membership is `party.user_id`, not `relationship.initiator…`**
 * — the same binding `lib/db/my-instances.ts` filters on, and the one the flow actually writes: an
 * instance's `session` row names the template it was copied from (`template_record_id`), and a
 * `party` row with this account's id on that session is what "one of my relationships" means. A
 * seeded instance whose parties have no account (`party.user_id IS NULL`) is therefore nobody's,
 * which is the honest answer rather than a row attributed by a column the seed leaves NULL.
 *
 * `voided_at IS NULL` is #503's rule, applied here for the same reason the instance list applies
 * it: an operator ended that relationship, so its template is not something the member is working
 * from any more.
 */
const IN_LIBRARY = `
  r.record_type = 'assessment'
  AND NOT EXISTS (SELECT 1 FROM session own WHERE own.record_id = r.id)
  AND (
    r.owner_user_id = $1
    OR EXISTS (
      SELECT 1
        FROM session ai
        JOIN party p ON p.session_record_id = ai.record_id
       WHERE ai.template_record_id = r.id
         AND p.user_id = $1
         AND ai.voided_at IS NULL
    )
  )
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

/** Every template in this member's library, A–Z. */
export async function listMemberLibrary(userId: string): Promise<LibraryRow[]> {
  const rows = await queryRows<LibraryQueryRow>(
    `SELECT r.id, r.slug, r.title, r.summary, r.status,
            (r.owner_user_id = $1) AS owned,
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
    owned: row.owned === true,
    aspectCount: Number(row.aspect_count),
    relationshipCount: Number(row.relationship_count),
  }));
}
