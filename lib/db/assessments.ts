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
} from "@/lib/db/rows";
import type { Assessment, AssessmentInstance } from "@/content/assessment";

const RECORD_JSON = "to_jsonb(r) AS record";

/** One instance record plus its copy, parties and opinions — one statement, one round trip. */
const INSTANCE_BY_SLUG_SQL = `
  SELECT
    ${RECORD_JSON},
    ai.template_record_id,
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
         FROM party p WHERE p.instance_record_id = r.id),
      '[]'::json
    ) AS parties,
    COALESCE(
      (SELECT json_agg(to_jsonb(opinion))
         FROM opinion WHERE opinion.instance_record_id = r.id),
      '[]'::json
    ) AS opinions
  FROM record r
  JOIN assessment_instance ai ON ai.record_id = r.id
  WHERE r.slug = $1 AND r.record_type = 'assessment'
`;

/**
 * One template record plus its items.
 *
 * A template is a record with `record_type = 'assessment'` and **no** `assessment_instance`
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
    AND NOT EXISTS (SELECT 1 FROM assessment_instance ai WHERE ai.record_id = r.id)
`;

interface InstanceQueryRow {
  readonly record: RecordRow;
  readonly template_record_id: string;
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
 * `assessment_instance` row, so an instance can never stand in for the template it was copied
 * from.
 */
const SCREEN_BY_SLUG_SQL = `
  SELECT
    ${RECORD_JSON},
    ai.template_record_id,
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
         FROM party p WHERE p.instance_record_id = r.id),
      '[]'::json
    ) AS parties,
    COALESCE(
      (SELECT json_agg(to_jsonb(opinion))
         FROM opinion WHERE opinion.instance_record_id = r.id),
      '[]'::json
    ) AS opinions,
    (SELECT to_jsonb(t) FROM record t
      WHERE t.id = ai.template_record_id
        AND t.record_type = 'assessment'
        AND NOT EXISTS (SELECT 1 FROM assessment_instance ti WHERE ti.record_id = t.id)
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
  JOIN assessment_instance ai ON ai.record_id = r.id
  WHERE r.slug = $1 AND r.record_type = 'assessment'
`;

interface ScreenQueryRow extends InstanceQueryRow {
  readonly template_record: RecordRow | null;
  readonly template_items: readonly ItemRow[];
  readonly template_options: readonly OptionRow[];
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
    if (row === undefined) return undefined;
    // A template that stopped resolving is a 404 and a `db:verify` failure, never a render with
    // an empty title: the copy has no second source for its words.
    if (row.template_record === null) return undefined;
    return {
      instance: assessmentInstanceFromRows({
        record: row.record,
        items: row.items,
        options: row.options,
        instance: { record_id: row.record.id, template_record_id: row.template_record_id },
        parties: row.parties,
        opinions: row.opinions,
      }),
      template: assessmentTemplateFromRows({
        record: row.template_record,
        items: row.template_items,
        options: row.template_options,
      }),
    };
  },
);

/** Every instance, in slug order — `db:verify` walks this. */
export async function listAssessmentInstances(): Promise<
  { slug: string; recordId: string; templateRecordId: string }[]
> {
  const rows = await queryRows<{
    slug: string;
    record_id: string;
    template_record_id: string;
  }>(
    `SELECT r.slug, ai.record_id, ai.template_record_id
       FROM assessment_instance ai
       JOIN record r ON r.id = ai.record_id
      WHERE r.record_type = 'assessment'
      ORDER BY r.slug`,
  );
  return rows.map((row) => ({
    slug: row.slug,
    recordId: row.record_id,
    templateRecordId: row.template_record_id,
  }));
}

/** The slugs an instance exists for. No route prerenders from this any more — it is a read. */
export async function listAssessmentInstanceSlugs(): Promise<string[]> {
  const instances = await listAssessmentInstances();
  return instances.map((instance) => instance.slug);
}

/** Re-exported so a caller can compare a copy's ids without reaching into `rows.ts`. */
export { itemIdsOf };
