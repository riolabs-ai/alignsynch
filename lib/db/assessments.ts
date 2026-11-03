/**
 * The assessment read path — the database half of `lib/assessment-report.ts` (#145).
 *
 * **One round trip per request, not four (#204).** The screen used to cost four statements: an
 * instance read and a template read, each repeated by `generateMetadata` and by the page. The
 * template is now a subselect of the instance statement — the two halves are the same row's
 * business — and `readAssessmentScreenBySlug` is memoised for the request, so the metadata call
 * and the render share one read instead of racing each other for a connection. Measured on the
 * demo branch: ~546 ms p50 for four round trips, ~200 ms for one.
 *
 * The row-level reads (`readAssessmentInstanceRowsBySlug`, `readAssessmentTemplateRowsById`)
 * stay separate on purpose: `db:verify` wants the unparsed rows so it can report drift, and it
 * runs in a script where a request-scoped memo means nothing.
 *
 * `/assessment/[slug]` is the only route that reads through this module today. It requires a
 * database **at request time and not at build time**: the page is `force-dynamic` and nothing
 * here runs until a request arrives, so `pnpm build` passes with `DATABASE_URL` unset.
 */
import { queryRows } from "@/lib/db/client";
import { cache } from "react";
import type { QueryResultRow } from "pg";
import {
  zAssessmentMode,
  zOpinions,
  type AssessmentMode,
  type PartyRole,
} from "@/content/assessment";
import { gapKindsOf, gapKindsIn, type AspectGaps } from "@/content/gaps";
import { inviteStateOf, type InviteDisplayState } from "@/lib/flow/invite-state";
import type { FlowScreen } from "@/lib/flow/screen";
import { readFlowScreen } from "@/lib/flow/store";
import { type FlowStage, relationshipStage } from "@/lib/flow/stage";
import {
  instanceStatusOf,
  myInstanceStateOf,
  unlockMarkOf,
  type InstanceProgress,
  type MyInstanceState,
  type UnlockMark,
} from "@/lib/flow/state";
import {
  assessmentInstanceFromRows,
  assessmentTemplateFromRows,
  itemIdsOf,
  type AssessmentInstanceRows,
  type AssessmentTemplateRows,
  type InstanceRow,
  type ItemRow,
  type OpinionRow,
  type OptionRow,
  type PartyRow,
  type RecordRow,
  type RelationshipRow,
} from "@/lib/db/rows";
import type { Assessment, AssessmentInstance } from "@/content/assessment";

const RECORD_JSON = "to_jsonb(r) AS record";

/** One instance record plus its copy, parties and opinions — one statement, one round trip. */
const INSTANCE_BY_SLUG_SQL = `
  SELECT
    ${RECORD_JSON},
    ai.template_record_id,
    ai.mode,
    ai.alignment_setting,
    ai.name,
    ai.relationship_id,
    COALESCE(
      (SELECT json_agg(to_jsonb(i) ORDER BY i.position) FROM item i WHERE i.record_id = r.id),
      '[]'::json
    ) AS items,
    COALESCE(
      (SELECT json_agg(to_jsonb(o) ORDER BY o.position)
         FROM response_option o WHERE o.record_id = r.id),
      '[]'::json
    ) AS options,
    COALESCE(
      (SELECT json_agg(to_jsonb(p) ORDER BY p.role)
         FROM party p WHERE p.session_record_id = r.id),
      '[]'::json
    ) AS parties,
    COALESCE(
      (SELECT json_agg(to_jsonb(opinion))
         FROM opinion WHERE opinion.session_record_id = r.id),
      '[]'::json
    ) AS opinions
  FROM record r
  JOIN session ai ON ai.record_id = r.id
  WHERE r.slug = $1 AND r.record_type = 'assessment'
`;

/**
 * One template record plus its items.
 *
 * A template is a record with `record_type = 'assessment'` and **no** `session`
 * row, so the `NOT EXISTS` is the definition and not a defensive filter: an id that names an
 * instance must not resolve as the template it was copied from.
 */
const TEMPLATE_BY_ID_SQL = `
  SELECT
    ${RECORD_JSON},
    COALESCE(
      (SELECT json_agg(to_jsonb(i) ORDER BY i.position) FROM item i WHERE i.record_id = r.id),
      '[]'::json
    ) AS items,
    COALESCE(
      (SELECT json_agg(to_jsonb(o) ORDER BY o.position)
         FROM response_option o WHERE o.record_id = r.id),
      '[]'::json
    ) AS options
  FROM record r
  WHERE r.id = $1
    AND r.record_type = 'assessment'
    AND NOT EXISTS (SELECT 1 FROM session ai WHERE ai.record_id = r.id)
`;

interface InstanceQueryRow {
  readonly record: RecordRow;
  readonly template_record_id: string;
  readonly mode: string;
  readonly alignment_setting: string;
  /** `NULL` is unnamed (`0011_console_columns.sql`); a surface falls back to the template title. */
  readonly name: string | null;
  readonly relationship_id: string;
  readonly items: readonly ItemRow[];
  readonly options: readonly OptionRow[];
  readonly parties: readonly PartyRow[];
  readonly opinions: readonly OpinionRow[];
}

/**
 * The whole screen in one statement: the instance's six row sets **and** the template it names.
 *
 * The template is four subselects on `ai.template_record_id` rather than a second call, because
 * a page that costs one round trip is a page a demo can afford: on the demo branch a round trip
 * measured 160–200 ms, and the screen used to pay four of them (instance, template, then both
 * again for `generateMetadata`).
 *
 * `template_record` is `NULL` when the copy's `templateId` no longer resolves — the state the
 * page turns into `notFound()` and `db:verify` reports as drift. The template subselect keeps
 * the same `NOT EXISTS` definition as `TEMPLATE_BY_ID_SQL`: a template is a record with **no**
 * `session` row, so an instance can never stand in for the template it was copied
 * from.
 *
 * **Two keys, one statement (#504).** The party's screen resolves an instance by its slug; the
 * console's report screen holds the record id it was handed by the registry. Writing the
 * statement twice would be two statements that can drift about which columns the model needs, so
 * `screenSql()` takes the predicate and both callers share the rest — including `voided_at`,
 * which the report reads to answer *is there a report at all* before it derives one.
 */
const screenSql = (where: string) => `
  SELECT
    ${RECORD_JSON},
    ai.template_record_id,
    ai.mode,
    ai.alignment_setting,
    ai.name,
    ai.voided_at,
    ai.relationship_id,
    COALESCE(
      (SELECT json_agg(to_jsonb(i) ORDER BY i.position) FROM item i WHERE i.record_id = r.id),
      '[]'::json
    ) AS items,
    COALESCE(
      (SELECT json_agg(to_jsonb(o) ORDER BY o.position)
         FROM response_option o WHERE o.record_id = r.id),
      '[]'::json
    ) AS options,
    COALESCE(
      (SELECT json_agg(to_jsonb(p) ORDER BY p.role)
         FROM party p WHERE p.session_record_id = r.id),
      '[]'::json
    ) AS parties,
    COALESCE(
      (SELECT json_agg(to_jsonb(opinion))
         FROM opinion WHERE opinion.session_record_id = r.id),
      '[]'::json
    ) AS opinions,
    (SELECT to_jsonb(t) FROM record t
      WHERE t.id = ai.template_record_id
        AND t.record_type = 'assessment'
        AND NOT EXISTS (SELECT 1 FROM session ti WHERE ti.record_id = t.id)
    ) AS template_record,
    COALESCE(
      (SELECT json_agg(to_jsonb(ti) ORDER BY ti.position)
         FROM item ti WHERE ti.record_id = ai.template_record_id),
      '[]'::json
    ) AS template_items,
    COALESCE(
      (SELECT json_agg(to_jsonb(to2) ORDER BY to2.position)
         FROM response_option to2 WHERE to2.record_id = ai.template_record_id),
      '[]'::json
    ) AS template_options
  FROM record r
  JOIN session ai ON ai.record_id = r.id
  WHERE ${where} AND r.record_type = 'assessment'
`;

/** The party's screen: `/assessment/<slug>` (#145). */
const SCREEN_BY_SLUG_SQL = screenSql("r.slug = $1");

/** The console's report: the record id the registry hands the route (#504). */
const SCREEN_BY_RECORD_ID_SQL = screenSql("r.id = $1");

/** One screen row, as the statement above selects it. Exported for the report's reader (#504). */
export interface ScreenQueryRow extends InstanceQueryRow {
  readonly template_record: RecordRow | null;
  readonly template_items: readonly ItemRow[];
  readonly template_options: readonly OptionRow[];
  /** `session.voided_at` — an operator ended the session; there is no report to draw. */
  readonly voided_at: string | Date | null;
}

/**
 * The one seam a caller may replace: a parameterised query that answers rows.
 *
 * It exists so the console's report write (`lib/admin/report-ops.ts`) can run the **same read**
 * inside `act()`'s transaction — the report it audits and the report it hashes are then one read
 * of one snapshot, not a read here and a hash of something else afterwards. Production passes the
 * pool (`queryRows`); a test passes a fake.
 */
export interface ScreenReaders {
  rowsOf<R extends QueryResultRow>(text: string, values: readonly unknown[]): Promise<readonly R[]>;
}

export const POOL_SCREEN_READERS: ScreenReaders = {
  rowsOf: (text, values) => queryRows(text, values),
};

/**
 * One screen row as the two records the report is built from, or `undefined` when the row names
 * no template this build can draw.
 *
 * Pure: the mapping is `lib/db/rows.ts`'s, and the "a template that stopped resolving is a 404"
 * rule is stated once here instead of at each caller.
 */
export function screenFromRow(
  row: ScreenQueryRow,
): { instance: AssessmentInstance; template: Assessment } | undefined {
  // A template that stopped resolving is a 404 and a `db:verify` failure, never a render with
  // an empty title: the copy has no second source for its words.
  if (row.template_record === null) return undefined;
  return {
    instance: assessmentInstanceFromRows({
      record: row.record,
      items: row.items,
      options: row.options,
      instance: {
        record_id: row.record.id,
        template_record_id: row.template_record_id,
        relationship_id: row.relationship_id,
        mode: row.mode,
        setting: row.alignment_setting,
        name: row.name,
      },
      parties: row.parties,
      opinions: row.opinions,
    }),
    template: assessmentTemplateFromRows({
      record: row.template_record,
      items: row.template_items,
      options: row.template_options,
    }),
  };
}

/**
 * One instance by its own record id, or `undefined`.
 *
 * Not memoised: this is the console's read, it runs once per request, and the one caller that
 * needs it inside a transaction hands its own `ScreenReaders`.
 */
export async function readAssessmentScreenByRecordId(
  recordId: string,
  readers: ScreenReaders = POOL_SCREEN_READERS,
): Promise<{ instance: AssessmentInstance; template: Assessment } | undefined> {
  const [row] = await readers.rowsOf<ScreenQueryRow>(SCREEN_BY_RECORD_ID_SQL, [recordId]);
  return row === undefined ? undefined : screenFromRow(row);
}

interface TemplateQueryRow {
  readonly record: RecordRow;
  readonly items: readonly ItemRow[];
  readonly options: readonly OptionRow[];
}

/**
 * The instance's rows, unparsed — `db:verify` needs the ids and order to report a drift that
 * the parse would only collapse into one line.
 */
export async function readAssessmentInstanceRowsBySlug(
  slug: string,
): Promise<AssessmentInstanceRows | undefined> {
  const [row] = await queryRows<InstanceQueryRow>(INSTANCE_BY_SLUG_SQL, [slug]);
  if (row === undefined) return undefined;
  const instance: InstanceRow = {
    record_id: row.record.id,
    template_record_id: row.template_record_id,
    relationship_id: row.relationship_id,
    mode: row.mode,
    setting: row.alignment_setting,
    name: row.name,
  };
  return {
    record: row.record,
    items: row.items,
    options: row.options,
    instance,
    parties: row.parties,
    opinions: row.opinions,
  };
}

/** The template's rows, unparsed, for the same reason. */
export async function readAssessmentTemplateRowsById(
  recordId: string,
): Promise<AssessmentTemplateRows | undefined> {
  const [row] = await queryRows<TemplateQueryRow>(TEMPLATE_BY_ID_SQL, [recordId]);
  if (row === undefined) return undefined;
  return { record: row.record, items: row.items, options: row.options };
}

/**
 * The instance a slug names, or `undefined`.
 *
 * `undefined` is "no such slug", which the page turns into `notFound()` — the same 404 the
 * fixture-driven route gave for a slug no instance carries.
 */
export async function readAssessmentInstanceBySlug(
  slug: string,
): Promise<AssessmentInstance | undefined> {
  const rows = await readAssessmentInstanceRowsBySlug(slug);
  return rows === undefined ? undefined : assessmentInstanceFromRows(rows);
}

/** The template a record id names, or `undefined` when it is not a template record. */
export async function readAssessmentTemplateByRecordId(
  recordId: string,
): Promise<Assessment | undefined> {
  const rows = await readAssessmentTemplateRowsById(recordId);
  return rows === undefined ? undefined : assessmentTemplateFromRows(rows);
}

/**
 * Both halves of the screen, or `undefined` if either is missing — **one statement, one round
 * trip**, memoised for the request (#204).
 *
 * The page's 404 semantics are the fixture route's, unchanged: an instance that does not exist
 * **or** an instance whose template does not resolve is `notFound()`, because the title and
 * summary above the rows are the template's and there is no second source for them.
 *
 * `cache()` is React's request-scoped memo, not a data cache: `generateMetadata` and the
 * component both ask for the same slug in the same request, and without it they would open two
 * connections and pay two round trips. It holds the value for the life of one request and
 * throws away nothing a database failure could hide — a failure is not memoised, and the next
 * request reads the database again.
 */
export const readAssessmentScreenBySlug = cache(
  async (
    slug: string,
  ): Promise<{ instance: AssessmentInstance; template: Assessment } | undefined> => {
    const [row] = await queryRows<ScreenQueryRow>(SCREEN_BY_SLUG_SQL, [slug]);
    return row === undefined ? undefined : screenFromRow(row);
  },
);

/** Every instance, in slug order — `db:verify` walks this. */
export async function listAssessmentInstances(): Promise<
  { slug: string; recordId: string; templateRecordId: string; mode: string }[]
> {
  const rows = await queryRows<{
    slug: string;
    record_id: string;
    template_record_id: string;
    mode: string;
  }>(
    `SELECT r.slug, ai.record_id, ai.template_record_id, ai.mode
       FROM session ai
       JOIN record r ON r.id = ai.record_id
      WHERE r.record_type = 'assessment'
      ORDER BY r.slug`,
  );
  return rows.map((row) => ({
    slug: row.slug,
    recordId: row.record_id,
    templateRecordId: row.template_record_id,
    mode: row.mode,
  }));
}

/** The slugs an instance exists for. No route prerenders from this any more — it is a read. */
export async function listAssessmentInstanceSlugs(): Promise<string[]> {
  const instances = await listAssessmentInstances();
  return instances.map((instance) => instance.slug);
}

/** Re-exported so a caller can compare a copy's ids without reaching into `rows.ts`. */
export { itemIdsOf };

/**
 * The relationship a session belongs to, or `undefined` — the relationship-scoped row read (#340).
 *
 * A session is one assessment cycle; the relationship is the container that persists across
 * cycles and carries the two accounts, the plan and the purchase instant. The session read
 * above exposes `relationship_id`, and this is the second half: the row itself, for the queries
 * that are about the relationship rather than one cycle.
 *
 * `/assessment/instances/[instanceId]` does **not** read through this: it needs the screen's
 * gated projection as well, and `readRelationshipById()` below is that (one call, not two reads
 * that could disagree). This stays as the bare row for a caller that only wants the row.
 */
export async function readRelationshipRow(
  relationshipId: string,
): Promise<RelationshipRow | undefined> {
  const [row] = await queryRows<RelationshipRow>(
    `SELECT id, template_id, initiator_user_id, purchased_at, plan, counterparty_user_id, created_at
       FROM relationship
      WHERE id = $1`,
    [relationshipId],
  );
  return row;
}

/* ------------------------------------------------------------------ *
 * The relationships surfaces (R1, issue #409)
 *
 * Two reads, one per read-only surface:

 *   `listRelationshipCards()`   `/assessment/instances` — one statement for the account's
 *                               relationships, as the list's cards draw them.
 *   `readRelationshipById()`    `/assessment/instances/[instanceId]` — the relationship's money
 *                               facts **plus** the flow screen's gated projection.
 *
 * **The blind rule is the read's, not the view's** (`lib/flow/state.ts::visibleRoles`). Before a
 * session is complete, `readFlowScreen()` asks Postgres for the viewer's own opinions and no
 * other role's, so the projection has no field in which the other party's answers could travel —
 * the page is handed `report: null` and `aspects[].own`, never a value it would then have to
 * hide. The list goes one step further and is handed **no score at all** unless the session it
 * would score is complete: the `opinions` column below is only mapped into a figure behind
 * `instanceStatusOf() === "complete"`, and the card's one Gap-shaped field (`alignment`) is
 * `null` — drawn `—`, never `0` — for every other row.
 *
 * **A relationship is not a session.** The relationship persists across cycles and carries the
 * account bindings, the plan and the purchase instant; a session is one cycle of it. So the
 * list is scoped by `relationship_member` (or, for the rows seeded before #340, the older
 * `party.user_id` binding), its stage and counts come from the relationship's **latest** session,
 * and `sessionsOpened` / `sessionsCompleted` count every cycle it has had.
 *
 * **The stage is the screen's three, not the ladder's four.** `relationshipStage()` maps the
 * derived status onto Invited / Connected / Sharing and cannot return `aligned`, because Aligned
 * is `instanceAlignment()`'s verdict over a finished Gap and not a step (#274,
 * `docs/specs/ux-stages.md`). The list therefore offers three stage tabs and the detail's
 * sentence says the same word: one derivation, two surfaces, no disagreement.
 *
 * **No clock is read in a render path.** The invitation's state needs an instant, so the
 * statement selects `now()` once and the mapping hands that one value to `inviteStateOf()`. The
 * instants themselves travel as ISO strings and every label over them is a pure function of the
 * instant (`formatDate` / `formatRelative`), which is what keeps a server render from printing a
 * time the same page would print differently a second later.
 * ------------------------------------------------------------------ */

/**
 * One relationship, as the list draws it.
 *
 * Every number is derived, none is authored: `sessionsOpened` is a count of the relationship's
 * sessions, `sessionsCompleted` is that count filtered through `instanceStatusOf()`, and
 * `alignment` is the mean Gap of the latest session when — and only when — that session is
 * complete. `null` is absent: the card draws `—` for it and never `0`, because a relationship
 * nobody has scored and one scored at zero are different facts.
 */
export interface RelationshipCard {
  readonly relationshipId: string;
  /** The latest session — the row's link target, and where its stage comes from. */
  readonly instanceRecordId: string;
  readonly slug: string;
  /** The relationship's own name, else the template's title it was copied from. */
  readonly name: string;
  readonly templateTitle: string;
  readonly mode: AssessmentMode;
  readonly viewerRole: PartyRole | "coach";
  readonly initiatorName: string | null;
  readonly counterpartyName: string | null;
  /** Invited / Connected / Sharing, from the derived status. Never `aligned`. */
  readonly stage: FlowStage;
  /** `lib/flow/state.ts::myInstanceStateOf` — the state the console's `?filter=` counts. */
  readonly state: MyInstanceState;
  readonly unlock: UnlockMark;
  /** The latest session's invitation, derived from its row at the instant of this read. */
  readonly inviteState: InviteDisplayState | null;
  readonly aspectCount: number;
  readonly sessionsOpened: number;
  readonly sessionsCompleted: number;
  /** The mean Gap of the latest session, or `null` until that session is complete. */
  readonly alignment: number | null;
  /**
   * What was paid, and only for the Initiator — `null` is "not this viewer's fact".
   *
   * Two columns, never a sum: `plan` is the tier and `purchasedAt` the instant it was bought.
   * There is no total on this surface because there is no second payment to add it up from —
   * one relationship, one purchase — and a number nobody was charged is the fabrication the
   * card forbids.
   */
  readonly paid: { readonly plan: string | null; readonly purchasedAt: string | null } | null;
  /** The latest session's own instant, ISO — the card's "last session" label is pure over it. */
  readonly lastSessionAt: string;
}

interface SessionCountRow {
  readonly aspectCount: number;
  readonly initiatorAnswered: number;
  readonly counterpartyAnswered: number;
  readonly hasCounterparty: boolean;
  /** `party.accepted_at IS NOT NULL` per seat (#R2) — the hinge `instanceStatusOf()` now needs. */
  readonly initiatorAccepted: boolean;
  readonly counterpartyAccepted: boolean;
  /** `session.voided_at IS NOT NULL` (#503) — a past session an operator ended. */
  readonly voided: boolean;
}

interface OpinionJsonRow {
  readonly role: string;
  readonly itemId: string;
  readonly feel: number;
  readonly wish: number;
  readonly think: number | null;
  readonly guess: number | null;
}

export interface RelationshipCardRow {
  readonly relationship_id: string;
  readonly plan: string | null;
  readonly purchased_at: Date | null;
  readonly template_title: string;
  readonly session_record_id: string;
  readonly slug: string;
  readonly mode: string;
  readonly session_name: string | null;
  readonly session_date: Date;
  readonly viewer_role: string;
  readonly viewer_unlock_seen_at: Date | null;
  readonly initiator_name: string | null;
  readonly counterparty_name: string | null;
  readonly aspect_count: number;
  readonly initiator_answered: number;
  readonly counterparty_answered: number;
  readonly has_counterparty: boolean;
  /** The latest session's two acceptances (#R2) — what `complete` additionally requires. */
  readonly initiator_accepted: boolean;
  readonly counterparty_accepted: boolean;
  readonly sessions_opened: number;
  readonly sessions: readonly SessionCountRow[];
  readonly opinions: readonly OpinionJsonRow[] | null;
  readonly items: readonly { readonly itemId: string }[] | null;
  readonly invite: {
    readonly claimed: boolean;
    readonly expiresAt: string | Date;
  } | null;
  /** `session.voided_at IS NOT NULL` — the latest session, ended by an operator (#503). */
  readonly voided: boolean;
  readonly read_at: Date;
}

/**
 * The account's relationships, one statement.
 *
 * `WHERE … user_id = $1` appears twice and both halves are the same value: the session's own
 * account. There is no second parameter that could widen it — no role, no name, no query value —
 * which is the same rule `lib/db/my-instances.ts` states for the per-instance list.
 *
 * `DISTINCT ON (s.relationship_id)` picks the relationship's latest session (newest `record.date`,
 * slug breaking the tie); a relationship with no session at all is absent rather than a card that
 * links to nothing, exactly as `listMyInstances()` drops an instance whose template stopped
 * resolving.
 */
const RELATIONSHIP_CARDS_SQL = `
  WITH mine AS (
    SELECT rel.id AS relationship_id
      FROM relationship rel
     WHERE EXISTS (SELECT 1 FROM relationship_member rm
                    WHERE rm.relationship_id = rel.id AND rm.user_id = $1)
        OR EXISTS (SELECT 1 FROM session s0
                     JOIN party p0 ON p0.session_record_id = s0.record_id
                    WHERE s0.relationship_id = rel.id AND p0.user_id = $1)
  ),
  latest AS (
    SELECT DISTINCT ON (s.relationship_id)
           s.relationship_id, s.record_id, s.mode, s.name, r.slug, r.date,
           (s.voided_at IS NOT NULL) AS voided
      FROM session s
      JOIN record r ON r.id = s.record_id
     WHERE s.relationship_id IN (SELECT relationship_id FROM mine)
     ORDER BY s.relationship_id, r.date DESC, r.slug DESC
  )
  SELECT
    rel.id                      AS relationship_id,
    rel.plan                    AS plan,
    rel.purchased_at            AS purchased_at,
    t.title                     AS template_title,
    l.record_id                 AS session_record_id,
    l.slug                      AS slug,
    l.mode                      AS mode,
    l.name                      AS session_name,
    l.date                      AS session_date,
    l.voided                    AS voided,
    COALESCE(vp.role, rm.role)  AS viewer_role,
    vp.unlock_seen_at           AS viewer_unlock_seen_at,
    ip.name                     AS initiator_name,
    cp.name                     AS counterparty_name,
    (SELECT count(*) FROM item i WHERE i.record_id = l.record_id)::int AS aspect_count,
    (SELECT count(*) FROM opinion o
      WHERE o.session_record_id = l.record_id AND o.role = 'initiator')::int AS initiator_answered,
    (SELECT count(*) FROM opinion o
      WHERE o.session_record_id = l.record_id AND o.role = 'counterparty')::int AS counterparty_answered,
    EXISTS (SELECT 1 FROM party cpx
             WHERE cpx.session_record_id = l.record_id AND cpx.role = 'counterparty')
                                AS has_counterparty,
    COALESCE((SELECT p4.accepted_at IS NOT NULL FROM party p4
               WHERE p4.session_record_id = l.record_id AND p4.role = 'initiator'), false)
                                AS initiator_accepted,
    COALESCE((SELECT p5.accepted_at IS NOT NULL FROM party p5
               WHERE p5.session_record_id = l.record_id AND p5.role = 'counterparty'), false)
                                AS counterparty_accepted,
    (SELECT count(*) FROM session s2 WHERE s2.relationship_id = rel.id)::int AS sessions_opened,
    COALESCE((
      SELECT json_agg(json_build_object(
        'aspectCount', (SELECT count(*) FROM item i2 WHERE i2.record_id = s2.record_id),
        'initiatorAnswered', (SELECT count(*) FROM opinion o2
                               WHERE o2.session_record_id = s2.record_id AND o2.role = 'initiator'),
        'counterpartyAnswered', (SELECT count(*) FROM opinion o2
                                  WHERE o2.session_record_id = s2.record_id AND o2.role = 'counterparty'),
        'hasCounterparty', EXISTS (SELECT 1 FROM party p2
                                    WHERE p2.session_record_id = s2.record_id
                                      AND p2.role = 'counterparty'),
        -- #R2: a session counts as complete only when both seats accepted it, so the count is
        -- carried per session rather than read off the latest row.
        'initiatorAccepted', COALESCE((SELECT p6.accepted_at IS NOT NULL FROM party p6
                                        WHERE p6.session_record_id = s2.record_id
                                          AND p6.role = 'initiator'), false),
        'counterpartyAccepted', COALESCE((SELECT p7.accepted_at IS NOT NULL FROM party p7
                                           WHERE p7.session_record_id = s2.record_id
                                             AND p7.role = 'counterparty'), false),
        -- #503: a voided past session counts as ended, so it never counts as a completion.
        'voided', (s2.voided_at IS NOT NULL)
      ))
      FROM session s2 WHERE s2.relationship_id = rel.id
    ), '[]'::json)              AS sessions,
    (SELECT json_agg(json_build_object(
        'role', o.role, 'itemId', o.item_id,
        'feel', o.feel, 'wish', o.wish, 'think', o.think, 'guess', o.guess))
       FROM opinion o WHERE o.session_record_id = l.record_id)     AS opinions,
    (SELECT json_agg(json_build_object('itemId', i.item_id) ORDER BY i.position)
       FROM item i WHERE i.record_id = l.record_id)                AS items,
    (SELECT json_build_object('claimed', ii.claimed_at IS NOT NULL, 'expiresAt', ii.expires_at)
       FROM session_invite ii WHERE ii.session_record_id = l.record_id) AS invite,
    now()                       AS read_at
  FROM relationship rel
  JOIN mine ON mine.relationship_id = rel.id
  JOIN record t ON t.id = rel.template_id AND t.record_type = 'assessment'
  JOIN latest l ON l.relationship_id = rel.id
  LEFT JOIN relationship_member rm ON rm.relationship_id = rel.id AND rm.user_id = $1
  LEFT JOIN party vp ON vp.session_record_id = l.record_id AND vp.user_id = $1
  LEFT JOIN party ip ON ip.session_record_id = l.record_id AND ip.role = 'initiator'
  LEFT JOIN party cp ON cp.session_record_id = l.record_id AND cp.role = 'counterparty'
  -- #503 — a relationship whose latest session an operator voided has no ladder position to draw,
  -- so it is not a card. The rows are preserved; the console's registry is where an ended session
  -- is read, and relationshipCardFromRow fails loudly if one ever reaches it.
  WHERE NOT l.voided
  ORDER BY l.date DESC, l.slug
`;

/** `party.role` and `relationship_member.role` are CHECK-constrained; anything else is drift. */
function viewerRoleOf(value: string): PartyRole | "coach" {
  if (value === "initiator" || value === "counterparty" || value === "coach") return value;
  throw new Error(
    `relationship membership role "${value}" is neither initiator, counterparty nor coach — the row does not satisfy the model`,
  );
}

/** One opinion row → the schema's `Opinions`, or `null` for a row the model rejects. */
function opinionsOf(row: OpinionJsonRow | undefined): ReturnType<typeof zOpinions.parse> | null {
  if (row === undefined) return null;
  const parsed = zOpinions.safeParse({
    feel: row.feel,
    wish: row.wish,
    ...(row.think === null ? {} : { think: row.think }),
    ...(row.guess === null ? {} : { guess: row.guess }),
  });
  return parsed.success ? parsed.data : null;
}

/**
 * The mean Gap of one complete session, or `null` when nothing in it is measurable.
 *
 * The arithmetic is `content/gaps.ts::gapKindsOf` over the two parsed opinions of each Aspect —
 * the same call the report makes — so the list's figure and the report's numbers cannot drift.
 * An Aspect whose pair is missing or fails the model contributes nothing rather than a zero: a
 * Gap the rows do not carry is not a Gap of 0.
 */
function meanGapOf(
  items: readonly { readonly itemId: string }[],
  opinions: readonly OpinionJsonRow[],
): number | null {
  const byRole = new Map<string, OpinionJsonRow>();
  for (const row of opinions) byRole.set(`${row.role}:${row.itemId}`, row);

  const aspects: AspectGaps[] = [];
  for (const item of items) {
    const initiator = opinionsOf(byRole.get(`initiator:${item.itemId}`));
    const counterparty = opinionsOf(byRole.get(`counterparty:${item.itemId}`));
    if (initiator === null || counterparty === null) continue;
    aspects.push({ itemId: item.itemId, gaps: gapKindsOf(initiator, counterparty) });
  }

  let sum = 0;
  let count = 0;
  for (const aspect of aspects) {
    for (const kind of gapKindsIn(aspect.gaps)) {
      const gap = aspect.gaps[kind];
      if (gap === undefined) continue;
      sum += gap;
      count += 1;
    }
  }
  return count === 0 ? null : sum / count;
}

/** Progress counts from one session's row, in the shape `instanceStatusOf()` reads. */
function progressOf(
  aspectCount: number,
  hasCounterparty: boolean,
  initiatorAnswered: number,
  counterpartyAnswered: number,
  initiatorAccepted: boolean,
  counterpartyAccepted: boolean,
  /** `session.voided_at IS NOT NULL` (#503) — answered before any count is read. */
  voided: boolean,
): InstanceProgress {
  return {
    aspectCount,
    hasCounterparty,
    initiatorAnswered,
    counterpartyAnswered,
    // The hinge (#R2): the count shape, from the row's two booleans.
    initiatorAccepted: initiatorAccepted ? 1 : 0,
    counterpartyAccepted: counterpartyAccepted ? 1 : 0,
    voided,
  };
}

/**
 * Every relationship `userId` is a member of, newest session first.
 *
 * A member who is not a party of the latest session (a coach) reads the same card with its stage
 * and counts: `state` is `complete` or `awaiting-other` and never `yours-to-answer`, because a
 * coach answers nothing — and `unlock` is `seen`, because `unlock_seen_at` is a party's own
 * column and a coach has no row to have marked.
 */
export async function listRelationshipCards(viewerUserId: string): Promise<RelationshipCard[]> {
  const rows = await queryRows<RelationshipCardRow>(RELATIONSHIP_CARDS_SQL, [viewerUserId]);
  return rows.map(relationshipCardFromRow);
}

/**
 * One row → one card, and the whole of what a card may say.
 *
 * Pure and exported for the reason `meanGapOf` is private: every figure here is derived from the
 * row — the stage from the two answer counts, the completion from the per-session counts, the Gap
 * from the opinions **only when the session is complete** — so a captured production row can be
 * driven through the same mapping the page uses, with no connection and no second implementation.
 * That is what makes "the list shows `—` for an unscored relationship" checkable against real data
 * instead of against a fixture that was written to pass.
 */
export function relationshipCardFromRow(row: RelationshipCardRow): RelationshipCard {
  const viewerRole = viewerRoleOf(row.viewer_role);
  // One derivation per row: the status is asked once and reused by the state, the stage and the
  // Gap's own gate, so a card cannot say "complete" in one field and "answering" in another.
  const progress = progressOf(
    row.aspect_count,
    row.has_counterparty,
    row.initiator_answered,
    row.counterparty_answered,
    row.initiator_accepted,
    row.counterparty_accepted,
    row.voided,
  );
  const status = instanceStatusOf(progress);
  const complete = status === "complete";

  const state: MyInstanceState =
    viewerRole === "coach"
      ? complete
        ? "complete"
        : "awaiting-other"
      : myInstanceStateOf({ ...progress, viewerRole });

  // Scored means complete, and only then are the session's opinions turned into a figure. A
  // session that is not complete never reaches `meanGapOf()`: the blind rule is enforced by
  // what this function is asked to do, not by the card declining to draw it.
  const alignment =
    complete && row.items !== null && row.opinions !== null
      ? meanGapOf(row.items, row.opinions)
      : null;

  const sessionsCompleted = row.sessions.filter(
    (session) =>
      instanceStatusOf(
        progressOf(
          session.aspectCount,
          session.hasCounterparty,
          session.initiatorAnswered,
          session.counterpartyAnswered,
          // A past session completed only if both seats accepted it (#R2): the count follows the
          // same rule as the latest session, not a weaker one. #503: a voided one never counts.
          session.initiatorAccepted,
          session.counterpartyAccepted,
          session.voided,
        ),
      ) === "complete",
  ).length;

  // #503 — the ladder has no rung for a voided session, so there is no card to draw: an operator
  // ended it and the party's to-do list is not the place to report that. The read excludes them
  // (`lib/db/my-instances.ts`), which makes a `null` here drift rather than a state, and drift is
  // loud in this tree rather than a `?? "connected"` that would draw a relationship still running.
  const stage = relationshipStage(status);
  if (stage === null) {
    throw new Error(
      `relationship "${row.slug}": its latest session was voided — the card list must not carry it`,
    );
  }

  return {
    relationshipId: row.relationship_id,
    instanceRecordId: row.session_record_id,
    slug: row.slug,
    name: row.session_name ?? row.template_title,
    templateTitle: row.template_title,
    mode: zAssessmentMode.parse(row.mode),
    viewerRole,
    initiatorName: row.initiator_name,
    counterpartyName: row.counterparty_name,
    stage,
    state,
    unlock: viewerRole === "coach" ? "seen" : unlockMarkOf(state, row.viewer_unlock_seen_at),
    inviteState:
      row.invite === null
        ? null
        : inviteStateOf(
            { claimed: row.invite.claimed, expiresAt: new Date(row.invite.expiresAt) },
            row.read_at,
          ),
    aspectCount: row.aspect_count,
    sessionsOpened: row.sessions_opened,
    sessionsCompleted,
    alignment,
    paid:
      viewerRole === "initiator"
        ? {
            plan: row.plan,
            purchasedAt: row.purchased_at === null ? null : row.purchased_at.toISOString(),
          }
        : null,
    lastSessionAt: row.session_date.toISOString(),
  };
}

/**
 * One relationship, as the detail screen draws it — the money facts plus the screen.
 *
 * `ref` is a relationship id **or** a session record id. The second is what every link in this
 * tree already carries (`lib/flow/paths.ts::instancePath`), so the newest session of the
 * relationship answers for it and the old URLs keep working; the first is what
 * `/v1/[persona]/relationships/[id]` uses, so the two surfaces can be compared on one id.
 *
 * The screen half is `readFlowScreen()` — the gated projection, not a second read of the same
 * rows. It resolves the viewer (bearer token, then account, then relationship membership), asks
 * Postgres for the roles `visibleRoles()` allows and no others, and builds the report only when
 * the status is `complete`. The money facts are sliced here, not in the view: a viewer who is
 * not the Initiator is handed `paid: null`, so there is no prop through which an amount could
 * reach their markup.
 *
 * `undefined` is "no such relationship, or not yours to read", which the page turns into
 * `notFound()` — the same answer the screen gave before this card.
 */
export interface RelationshipDetail {
  readonly relationshipId: string;
  readonly instanceRecordId: string;
  /** `null` for every viewer who is not the Initiator. Never an empty object. */
  readonly paid: { readonly plan: string | null; readonly purchasedAt: string | null } | null;
  readonly screen: FlowScreen;
}

export async function readRelationshipById(
  ref: string,
  viewer: {
    readonly token?: string | undefined;
    readonly inviteToken?: string | null;
    readonly viewerUserId: string | null;
    readonly now?: Date;
  },
): Promise<RelationshipDetail | undefined> {
  const [row] = await queryRows<{
    relationship_id: string;
    session_record_id: string;
    plan: string | null;
    purchased_at: Date | null;
  }>(
    `SELECT rel.id AS relationship_id,
            s.record_id AS session_record_id,
            rel.plan,
            rel.purchased_at
       FROM relationship rel
       JOIN session s ON s.relationship_id = rel.id
       JOIN record r ON r.id = s.record_id
      WHERE rel.id = $1 OR s.record_id = $1
      ORDER BY r.date DESC, r.slug DESC
      LIMIT 1`,
    [ref],
  );
  if (row === undefined) return undefined;

  const screen = await readFlowScreen({
    instanceRecordId: row.session_record_id,
    token: viewer.token,
    inviteToken: viewer.inviteToken ?? null,
    viewerUserId: viewer.viewerUserId,
    ...(viewer.now === undefined ? {} : { now: viewer.now }),
  });
  if (screen === undefined) return undefined;

  return {
    relationshipId: row.relationship_id,
    instanceRecordId: row.session_record_id,
    paid:
      screen.viewer.role === "initiator"
        ? {
            plan: row.plan,
            purchasedAt: row.purchased_at === null ? null : row.purchased_at.toISOString(),
          }
        : null,
    screen,
  };
}
