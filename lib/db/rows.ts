/**
 * Rows → the content model, and nothing else.
 *
 * This module is the read boundary (#145): plain objects in, `content/record.ts` and
 * `content/assessment.ts` out. Every row set is `safeParse`d through the schema the fixtures
 * already satisfy, so the database inherits the model's invariants instead of re-encoding
 * them — a think without a guess, a party that skipped an Aspect or a copy that drifted is
 * rejected here for the same reason `data:check` rejects it in `data/assessments.ts`.
 *
 * **Pure, and free of `pg`.** No connection, no `process.env`, no clock: `tests/db-rows.test.ts`
 * imports it with no `DATABASE_URL` set, which is also the proof that the gate stays
 * database-free. `lib/db/assessments.ts` is the half that queries; this is the half that
 * decides what a row means.
 *
 * The Gap is not here either. It is `gapOf()` over two scores, computed later by
 * `lib/assessment-report.ts`; no row carries it and no column exists for it.
 */
import { zAssessment, zAssessmentInstance } from "@/content/assessment";
import { SCORE_MAX, SCORE_MIN, zRecordType, type ResponseScale } from "@/content/record";
import type { z } from "zod";

/* ------------------------------------------------------------------ *\
 * The row shapes, named after their columns
 * ------------------------------------------------------------------ */

/** One `record` row. `record_type` is the model's `type`. */
export interface RecordRow {
  readonly id: string;
  readonly slug: string;
  readonly record_type: string;
  readonly status: string;
  /** `TIMESTAMPTZ`, so `pg` hands back a `Date`; a string is accepted for script-shaped rows. */
  readonly date: Date | string;
  readonly title: string;
  readonly summary: string;
  /**
   * The author, when a person wrote it — `NULL` for the platform's own templates
   * (`0011_console_columns.sql`). Optional as well as nullable because a row shape is also built
   * by hand in the tests, and a column added after those rows were written means the same thing
   * absent as it does `NULL`: nobody.
   */
  readonly author_user_id?: string | null;
}

/** One `item` row: a question, an Aspect. `left_value`/`right_value` exist only on `score`. */
export interface ItemRow {
  readonly record_id: string;
  readonly item_id: string;
  readonly position: number;
  readonly prompt: string;
  readonly scale_kind: string;
  readonly left_value: string | null;
  readonly right_value: string | null;
}

/** One `response_option` row: a named response on an option scale. */
export interface OptionRow {
  readonly record_id: string;
  readonly item_id: string;
  readonly option_id: string;
  readonly position: number;
  readonly text: string;
}

/** One `session` row: the row that makes a record an instance. */
export interface InstanceRow {
  readonly record_id: string;
  readonly template_record_id: string;
  /**
   * The relationship this cycle belongs to (`0013_relationship_sessions.sql`). Every session
   * has exactly one; the relationship is the thing that persists between cycles.
   */
  readonly relationship_id: string;
  /**
   * `basic` or `advanced`, as text — the schema decides whether it is a mode, so a row that
   * says `nonsense` fails the parse with the instance named rather than rendering as one.
   */
  readonly mode: string;
  /**
   * `soft` or `full`, as text — the same rule the mode follows: the schema decides whether it
   * is a setting (#259), and a row that says `nonsense` fails the parse instead of deciding
   * what counts as aligned from an unknown lens.
   */
  readonly setting: string;
  /**
   * The relationship's own name (`0011_console_columns.sql`); `NULL` is **unnamed**, and the
   * surface falls back to the template's title via `instanceNameOf()`. Never a generated copy of
   * that title — a value here is a name a person chose.
   */
  readonly name?: string | null;
}

/** One `party` row. */
export interface PartyRow {
  readonly session_record_id: string;
  readonly role: string;
  readonly name: string;
  /**
   * When this seat submitted, or `NULL`/absent for "not recorded" — every party written before
   * `0011_console_columns.sql`, including the seeded ones that did answer.
   */
  readonly submitted_at?: Date | string | null;
}

/**
 * One `relationship` row (`0013_relationship_sessions.sql`): the container a session belongs to,
 * bought once by the Initiator and persisting across assessment cycles. `initiator_user_id`,
 * `purchased_at`, `plan` and `counterparty_user_id` are all nullable — a backfilled or seeded
 * relationship may predate an account binding or a purchase, and NULL is the honest absence.
 */
export interface RelationshipRow {
  readonly id: string;
  readonly template_id: string;
  readonly initiator_user_id: string | null;
  readonly purchased_at: Date | string | null;
  readonly plan: string | null;
  readonly counterparty_user_id: string | null;
  readonly created_at: Date | string;
}

/** One `opinion` row: a party's scores on one Aspect. */
export interface OpinionRow {
  readonly session_record_id: string;
  readonly role: string;
  readonly item_id: string;
  readonly feel: number;
  readonly wish: number;
  readonly think: number | null;
  readonly guess: number | null;
}

/** Everything one instance is read from. */
export interface AssessmentInstanceRows {
  readonly record: RecordRow;
  readonly items: readonly ItemRow[];
  readonly options: readonly OptionRow[];
  readonly instance: InstanceRow;
  readonly parties: readonly PartyRow[];
  readonly opinions: readonly OpinionRow[];
}

/** Everything one template is read from. */
export interface AssessmentTemplateRows {
  readonly record: RecordRow;
  readonly items: readonly ItemRow[];
  readonly options: readonly OptionRow[];
}

/* ------------------------------------------------------------------ *\
 * Field by field
 * ------------------------------------------------------------------ */

/**
 * Slot order, from the glossary: Initiator then Counterparty. The query's `ORDER BY` is not
 * trusted to decide it — a tuple's meaning is `[0]` and `[1]`, so the mapping orders it.
 */
const ROLE_ORDER = ["initiator", "counterparty"] as const;

function roleRank(role: string): number {
  const index = ROLE_ORDER.indexOf(role as (typeof ROLE_ORDER)[number]);
  return index === -1 ? ROLE_ORDER.length : index;
}

/**
 * `TIMESTAMPTZ` → the model's one UTC instant.
 *
 * `zIsoDateTime` is `z.string().datetime({ offset: true })`, so a `Date` has to become text
 * with a `Z` — the same string the fixture carries, which is what keeps the rendered page
 * byte-identical to the prerendered one. An unparseable value is passed through unchanged so
 * the schema names the field instead of this function throwing an unlabelled `RangeError`.
 */
export function isoInstantOf(value: Date | string): string {
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

/** The record's shared fields — everything a template and an instance both have. */
function recordFields(row: RecordRow): {
  id: string;
  slug: string;
  type: unknown;
  status: string;
  date: string;
  title: string;
  summary: string;
  authorUserId?: string;
} {
  return {
    id: row.id,
    slug: row.slug,
    // `record_type` is text in SQL and an enum in the model; the schema decides, not a cast.
    type: row.record_type,
    status: row.status,
    date: isoInstantOf(row.date),
    title: row.title,
    summary: row.summary,
    // `NULL` is "the platform wrote it", and an absent key is the same fact — so it is left out
    // rather than carried as `undefined`, which keeps a parsed object deep-equal to its fixture.
    ...(row.author_user_id === null || row.author_user_id === undefined
      ? {}
      : { authorUserId: row.author_user_id }),
  };
}

/** The record's items, in the record's own order, whatever order the query returned. */
export function orderedItems<T extends { readonly position: number }>(rows: readonly T[]): T[] {
  return [...rows].sort((left, right) => left.position - right.position);
}

/**
 * A row's scale, rebuilt from its columns.
 *
 * A `score` scale gets the schema's literals 1 and 5 — the table stores no `min`/`max`,
 * because a column there would be a second authored copy of a constant. An `options` scale
 * gets its rows in `position` order.
 */
function scaleOf(item: ItemRow, options: readonly OptionRow[]): ResponseScale {
  if (item.scale_kind === "score") {
    return { kind: "score", min: SCORE_MIN, max: SCORE_MAX };
  }
  return {
    kind: "options",
    options: orderedItems(options.filter((option) => option.item_id === item.item_id)).map(
      (option) => ({ id: option.option_id, text: option.text }),
    ),
  };
}

interface AspectCandidate {
  readonly id: string;
  readonly prompt: string;
  readonly scale: ResponseScale;
  readonly leftValue?: string;
  readonly rightValue?: string;
}

/**
 * `item` + `response_option` → the model's item.
 *
 * An Aspect's `leftValue`/`rightValue` are `undefined` when the columns are NULL, so a
 * `score` item with a missing end fails `zAspect` as "Required" rather than mapping to the
 * string `"null"`. `zAspect`'s `scale: zScoreScale` rejects an `options` item on an
 * assessment for the same reason it would reject one in `data/assessments.ts`.
 */
export function itemCandidates(
  items: readonly ItemRow[],
  options: readonly OptionRow[],
): AspectCandidate[] {
  return orderedItems(items).map((item) => ({
    id: item.item_id,
    prompt: item.prompt,
    scale: scaleOf(item, options),
    ...(item.left_value === null ? {} : { leftValue: item.left_value }),
    ...(item.right_value === null ? {} : { rightValue: item.right_value }),
  }));
}

interface OpinionsCandidate {
  readonly feel?: number;
  readonly wish?: number;
  readonly think?: number;
  readonly guess?: number;
}

/**
 * The four columns → `zOpinions`.
 *
 * A NULL think/guess pair becomes "absent", which is what `zOpinions` expects for Basic Mode;
 * a think present without a guess stays present and fails the refinement that names the rule.
 * A missing row (`undefined`) becomes `{}`, so the failure says which Aspect was not answered
 * instead of silently dropping the Aspect from the party.
 */
function opinionsCandidateOf(row: OpinionRow | undefined): OpinionsCandidate {
  if (row === undefined) return {};
  return {
    feel: row.feel,
    wish: row.wish,
    ...(row.think === null ? {} : { think: row.think }),
    ...(row.guess === null ? {} : { guess: row.guess }),
  } as OpinionsCandidate;
}

/* ------------------------------------------------------------------ *\
 * Whole objects
 * ------------------------------------------------------------------ */

/**
 * `safeParse`, or an error that names the object and every issue in it.
 *
 * A row that fails the schema is an error, never a best-effort object: the fixtures are the
 * authored source and the database is their mirror, so a row the model rejects is drift in
 * the mirror, and the page must not draw it.
 *
 * Exported because `lib/db/profile-rows.ts` is a second read boundary over a different table
 * and must report a rejected row the same way.
 */
export function parseOrThrow<T>(schema: z.ZodType<T>, candidate: unknown, context: string): T {
  const result = schema.safeParse(candidate);
  if (result.success) return result.data;
  const problems = result.error.issues
    .map(
      (issue) => `${issue.path.length === 0 ? "(root)" : issue.path.join(".")}: ${issue.message}`,
    )
    .join("; ");
  throw new Error(`${context} does not satisfy the content model — ${problems}`);
}

/** One template's rows → `zAssessment`. */
export function assessmentTemplateFromRows(
  rows: AssessmentTemplateRows,
): z.infer<typeof zAssessment> {
  return parseOrThrow(
    zAssessment,
    {
      ...recordFields(rows.record),
      items: itemCandidates(rows.items, rows.options),
    },
    `record "${rows.record.slug}"`,
  );
}

/**
 * One instance's rows → `zAssessmentInstance`.
 *
 * The instance's own items are the **copy**, read from the instance record's rows, not from
 * the template it names: an instance that drifted must fail on its own rows, which is what
 * makes the copy a copy (`copyDriftProblems` below).
 */
export function assessmentInstanceFromRows(
  rows: AssessmentInstanceRows,
): z.infer<typeof zAssessmentInstance> {
  const items = itemCandidates(rows.items, rows.options);
  const parties = [...rows.parties]
    .sort((left, right) => roleRank(left.role) - roleRank(right.role))
    .map((party) => ({
      role: party.role,
      name: party.name,
      // Absent and `NULL` both mean "not recorded", and both are left out: a seat that answered
      // before the column existed is not a seat that answered now.
      ...(party.submitted_at === null || party.submitted_at === undefined
        ? {}
        : { submittedAt: isoInstantOf(party.submitted_at) }),
      opinions: orderedItems(rows.items).map((item) => ({
        itemId: item.item_id,
        opinions: opinionsCandidateOf(
          rows.opinions.find(
            (opinion) => opinion.role === party.role && opinion.item_id === item.item_id,
          ),
        ),
      })),
    }));

  return parseOrThrow(
    zAssessmentInstance,
    {
      ...recordFields(rows.record),
      templateId: rows.instance.template_record_id,
      // Unnamed is the absence of a name, not a generated one: `instanceNameOf()` falls back to
      // the template's title at the surface that draws the row.
      ...(rows.instance.name === null || rows.instance.name === undefined
        ? {}
        : { name: rows.instance.name }),
      mode: rows.instance.mode,
      setting: rows.instance.setting,
      items,
      parties,
    },
    `instance "${rows.record.slug}"`,
  );
}

/**
 * The collection rule one instance cannot see — the DB port of E31.
 *
 * `instanceTemplateProblems()` in `content/assessment.ts` compares a fixture's copy to its
 * template; this compares rows to rows, and `db:verify` calls it. The comparison is on ids
 * **and order**, because order is load-bearing: a copy with the same Aspects in a different
 * order is a rewrite of what someone answered, not a copy of it.
 */
export const ID_SEPARATOR = "\u0000";

export function copyDriftProblems(input: {
  readonly instanceId: string;
  readonly templateId: string;
  readonly copyIds: readonly string[];
  readonly templateIds: readonly string[];
}): string[] {
  if (input.copyIds.join(ID_SEPARATOR) === input.templateIds.join(ID_SEPARATOR)) return [];
  return [
    `instance "${input.instanceId}" is a copy of "${input.templateId}" but its Aspects are [${input.copyIds.join(", ")}], the template's are [${input.templateIds.join(", ")}]`,
  ];
}

/** The template's item ids in order — the left side of `copyDriftProblems`. */
export function itemIdsOf(items: readonly ItemRow[]): string[] {
  return orderedItems(items).map((item) => item.item_id);
}

/** Re-exported so a caller typechecks a `record_type` filter against the model's enum. */
export const RECORD_TYPE_VALUES = zRecordType.options;
