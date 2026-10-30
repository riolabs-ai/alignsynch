/**
 * The record — one root content type, and the shape every template validates against.
 *
 * **Every template is a record.** A quiz and an assessment are the two the platform
 * ships today, and they have the same identity, the same publication state, and the
 * same internal shape: **a record holds items, an item carries a response scale, and
 * a response is a value on that scale.** A third template is a new `type` member and
 * a new `content/` module, never a second root type. What makes two templates
 * different is only what each item adds:
 *
 *   quiz        an item is a question; it adds `correctOptionId`, and its scale is the
 *               option list, so a response is an option id            — `content/quiz.ts`
 *   assessment  an item is an Aspect; it adds a Left Value and a Right Value, and its
 *               scale is the fixed 1..5 band, so a response is a score — `content/assessment.ts`
 *
 * Neither template imports the other: both import this module. The fields that belong
 * to one template are never here — `correctOptionId` on the record would make an
 * Aspect carry an answer key it cannot use, and a score on the record would make a
 * question carry a number it cannot mark.
 *
 * Terms are the glossary's, used exactly (`docs/AlignSynch.com - Glossary`):
 *
 *   Record    id, slug, type, status, date — the post.
 *   `type`    `quiz` | `assessment` | `article`. The word is "type"; a database column
 *             may be `record_type`, and the model is not renamed to hide that.
 *   Item      a row inside a record: a question, an Aspect.
 *   Template  a record that holds items and has no parties.
 *   Instance  a template copied and given parties.
 *   Opinion   a score on an Aspect, 1..5, one per Feel / Wish / Think / Guess.
 *   Gap       a difference of Opinion — `gapOf()` below. A function, never a field.
 *
 * `strict()` everywhere, for the reason `content/core.ts` gives: an unknown key is a
 * validation error, which is what turns a fixture drift into a red build. Here it is
 * doing a second job — a template carrying `parties` is a validation error, so an
 * instance can never be mistaken for the template it was copied from.
 */
import { z } from "zod";
import { zId, zIsoDateTime, zPublishStatus, zSlug } from "./core";

/* ------------------------------------------------------------------ *
 * type — the field that makes one root content type
 * ------------------------------------------------------------------ */

/** Short values, lowercase. One record type; `type` says which template it is. */
export const zRecordType = z.enum(["quiz", "assessment", "article"]);

export type RecordType = z.infer<typeof zRecordType>;

/** The enum's members, in the order the model lists them. */
export const RECORD_TYPES = zRecordType.options;

/* ------------------------------------------------------------------ *
 * Response scale — the finite set of responses one item accepts
 * ------------------------------------------------------------------ */

/** Scores are 1..5: the glossary's opinion notches, five increments, no other width. */
export const SCORE_MIN = 1;
export const SCORE_MAX = 5;

export const zScore = z.number().int().min(SCORE_MIN).max(SCORE_MAX);

export type Score = z.infer<typeof zScore>;

/**
 * A named response on an option scale — an answer option. `a`..`f` on a question
 * today, and the id is stable so shuffling options can never re-point an answer.
 */
export const zResponseOption = z
  .object({
    id: zId,
    text: z.string().min(1),
  })
  .strict();

export type ResponseOption = z.infer<typeof zResponseOption>;

/** A list of named responses: the scale a question carries. */
export const zOptionScale = z
  .object({
    kind: z.literal("options"),
    options: z.array(zResponseOption).min(2),
  })
  .strict();

/**
 * The fixed 1..5 band: two named ends, five notches. The band is not authoring
 * input, so `min`/`max` are literals — an assessment cannot be widened to 1..7 and
 * a question cannot be narrowed to 1..3.
 */
export const zScoreScale = z
  .object({
    kind: z.literal("score"),
    min: z.literal(SCORE_MIN),
    max: z.literal(SCORE_MAX),
  })
  .strict();

/** The scale an item carries. Two shapes, one discriminator. */
export const zResponseScale = z.discriminatedUnion("kind", [zOptionScale, zScoreScale]);

export type ResponseScale = z.infer<typeof zResponseScale>;
export type OptionScale = z.infer<typeof zOptionScale>;
export type ScoreScale = z.infer<typeof zScoreScale>;

/** A response to an item: an option id, or a score. */
export const zResponse = z.union([zId, zScore]);

export type Response = z.infer<typeof zResponse>;

/**
 * Is this response a value on this scale? The one place the pair is compared, so
 * "a response is a value on that scale" is a function and not a convention.
 */
export function isResponseOn(scale: ResponseScale, response: Response): boolean {
  if (scale.kind === "options") {
    return typeof response === "string" && scale.options.some((option) => option.id === response);
  }
  return (
    typeof response === "number" &&
    Number.isInteger(response) &&
    response >= scale.min &&
    response <= scale.max
  );
}

/* ------------------------------------------------------------------ *
 * Item — a row inside a record
 * ------------------------------------------------------------------ */

export const zItem = z
  .object({
    /** Stable and unique within its record: `quiz-<quiz>-q<n>`, `aspect-<name>`. */
    id: zId,
    /** What is asked of the respondent. Was `text` on a question. */
    prompt: z.string().min(1),
    scale: zResponseScale,
  })
  .strict();

export type Item = z.infer<typeof zItem>;

/* ------------------------------------------------------------------ *
 * Record and Template
 * ------------------------------------------------------------------ */

export const zRecord = z
  .object({
    id: zId,
    slug: zSlug,
    type: zRecordType,
    /** Publication state. Never inferred from `date` — the two are different facts. */
    status: zPublishStatus,
    /**
     * The record's one date. Absolute and UTC like every instant in the model (D9):
     * the instant it went live when it is published, the instant it was authored
     * while it is a draft. A caller projecting a legacy record picks which one.
     */
    date: zIsoDateTime,
    title: z.string().min(1),
    summary: z.string().min(1),
  })
  .strict();

export type Record = z.infer<typeof zRecord>;

/**
 * Item ids are unique within their record. Exported as a refinement so a template
 * *reuses* the rule instead of copying it: two templates that each re-implement
 * "ids are unique" are two rules that can disagree.
 */
export function uniqueItemIds(
  record: { readonly id: string; readonly items: readonly { readonly id: string }[] },
  ctx: z.RefinementCtx,
): void {
  const seen = new Set<string>();
  record.items.forEach((item, index) => {
    if (seen.has(item.id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["items", index, "id"],
        message: `duplicate item id "${item.id}" within record "${record.id}"`,
      });
    }
    seen.add(item.id);
  });
}

/**
 * The template as a plain object, so a template type can extend it (`z.extend`)
 * before refining it — the same split as `zQuizStatsObject` / `zQuizStats`.
 */
export const zTemplateObject = zRecord
  .extend({
    /**
     * Empty is legal: an authoring draft starts with no items, on every template.
     * "A published record has items" is a census rule (W1 today), not
     * something this schema can decide without knowing the status.
     */
    items: z.array(zItem),
  })
  .strict();

/**
 * A template — a record that holds items and has no parties.
 *
 * There is no `parties` key to omit: `strict()` rejects one. That is the whole
 * difference between a template and an instance, and it is structural rather than
 * a rule someone has to remember.
 */
export const zTemplate = zTemplateObject.superRefine(uniqueItemIds);

export type Template = z.infer<typeof zTemplateObject>;

/** One problem a template has against the shared record, shaped like a zod issue. */
export interface TemplateProblem {
  readonly path: readonly (string | number)[];
  readonly message: string;
}

/**
 * A template, as the shared record sees it.
 *
 * Structural on purpose: an assessment's Items carry a Left Value and a Right Value
 * and a question's carry an answer key, so "does this validate as a record" compares
 * the **base** of each item, not the whole object. A template's own fields are not
 * the record's business; that they exist is the point of one record and two templates.
 */
export interface TemplateLike {
  readonly id: string;
  readonly slug: string;
  readonly type: string;
  readonly status: string;
  readonly date: string;
  readonly title: string;
  readonly summary: string;
  readonly items: readonly {
    readonly id: string;
    readonly prompt: string;
    readonly scale: ResponseScale;
  }[];
}

/**
 * Does this template validate against the shared record?
 *
 * The one mechanical answer to "every template is a record": the record
 * half parses as a `Record`, every item parses as an `Item` once the template's own
 * fields are left behind, and item ids are unique within the record. A template that
 * adds fields to an item passes — that is what `zItem.extend()` is for — and a template
 * that puts a value on the record the record cannot describe does not.
 *
 * Both templates call this (a quiz through its own schema, an assessment through its
 * fixture test), so "validates against" is one check and not two opinions.
 */
export function templateProblems(template: TemplateLike): TemplateProblem[] {
  const result = zTemplate.safeParse({
    id: template.id,
    slug: template.slug,
    type: template.type,
    status: template.status,
    date: template.date,
    title: template.title,
    summary: template.summary,
    items: template.items.map((item) => ({
      id: item.id,
      prompt: item.prompt,
      scale: item.scale,
    })),
  });
  if (result.success) return [];
  return result.error.issues.map((issue) => ({ path: issue.path, message: issue.message }));
}

/* ------------------------------------------------------------------ *
 * Gap — a difference of Opinion
 * ------------------------------------------------------------------ */

/** The widest two scores can disagree on a 1..5 scale. */
export const MAX_GAP = SCORE_MAX - SCORE_MIN;

/** `0` is In Synch (the glossary's green check); 1..4 is the glossary's small or big Gap. */
export type Gap = 0 | 1 | 2 | 3 | 4;

/**
 * The Gap: a difference of Opinion.
 *
 * It is a function and never a stored field. The value is arithmetic on two scores,
 * so a copy in the record could only ever drift from the pair it was computed from —
 * and there is no rule that could catch it, because two authored values cannot be
 * compared by a schema. `gapOf(2, 5) === 3`; `gapOf(4, 4) === 0` is In Synch.
 *
 * The eight gap *types* the glossary names (Feel Gap, Wish Gap, Initiator Gap, …) are
 * not this function's business: each of them is one call over one pair of opinions,
 * and none of them is implemented here.
 */
export function gapOf(left: Score, right: Score): Gap {
  const gap = Math.abs(left - right);
  if (!Number.isInteger(gap) || gap > MAX_GAP) {
    throw new RangeError(
      `gapOf(${left}, ${right}): the difference of two scores is a whole number in 0..${MAX_GAP}, so one of these is not a score`,
    );
  }
  return gap as Gap;
}
