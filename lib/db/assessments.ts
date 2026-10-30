/**
 * The assessment read path — the database half of `lib/assessment-report.ts` (#145).
 *
 * Two reads, both one round trip, both returning the **model**: `readAssessmentInstanceBySlug`
 * and `readAssessmentTemplateByRecordId`. `lib/db/rows.ts` does the `safeParse`; this module
 * only says what to ask for, so a row that fails the schema throws here with the object named
 * and never reaches a render.
 *
 * Each read is a single statement with `json_agg` subselects rather than a join fan-out: one
 * connection round trip, and no risk of a cartesian product between items, parties and
 * opinions turning four opinions into sixteen rows.
 *
 * `/assessment/[slug]` is the only route that reads through this module today. It requires a
 * database **at request time and not at build time**: the page is `force-dynamic` and nothing
 * here runs until a request arrives, so `pnpm build` passes with `DATABASE_URL` unset.
 */
import { queryRows } from "@/lib/db/client";
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
 * Both halves of the screen, or `undefined` if either is missing.
 *
 * The page's 404 semantics are the fixture route's, unchanged: an instance that does not
 * exist **or** an instance whose template does not resolve is `notFound()`, because the
 * title and summary above the rows are the template's and there is no second source for them.
 */
export async function readAssessmentScreenBySlug(
  slug: string,
): Promise<{ instance: AssessmentInstance; template: Assessment } | undefined> {
  const instance = await readAssessmentInstanceBySlug(slug);
  if (instance === undefined) return undefined;
  const template = await readAssessmentTemplateByRecordId(instance.templateId);
  if (template === undefined) return undefined;
  return { instance, template };
}

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
