/**
 * Authoring a template: the form's value, read into a draft or refused (#255).
 *
 * A template is a record with Aspects and **no party rows** (`content/assessment.ts`,
 * `db/migrations/0001_content_model.sql`), and until now nothing in the app wrote one — the four
 * seeded templates were the only source. This module is the whole of the "may this be saved"
 * decision, kept **pure over its argument** so the negative cases can be driven without a form, a
 * request or a database (the same split as `scripts/ui-refs.ts` and `lib/flow/state.ts`).
 *
 * It returns a **code**, not a sentence. The words a person reads are in the page-copy fixture
 * (`data/pages/assessment-template-new.ts`), where E23 can check that the view asks for text that
 * exists and an editor can reword a refusal without touching validation. A sentence authored in
 * two places — here and in the fixture — is a sentence that will disagree with itself.
 *
 * The refusals, in the order they are decided (first one wins, so a post with two defects is
 * answered about the first):
 *
 *   no-title           the template has no name to show the person you invite
 *   missing-question   a row carries Values but no question: nothing to answer
 *   missing-value      a row carries a question but one end of its scale is blank — and the SQL
 *                      table cannot even hold that (`item_score_needs_both_values`)
 *   duplicate-prompt   two Aspects ask the same question, which the report would then average
 *                      twice under two ids
 *   no-aspects         every row is blank: a template with no Aspects says nothing to either party
 *   too-many-aspects   more than `MAX_ASPECTS` — the form draws eight rows, and a crafted post
 *                      does not get to make a hundred-answer sheet
 *
 * A row is **skipped** only when all three of its fields are blank: the form renders eight rows and
 * a person fills in five, so "blank" means "not authored", not "incomplete". A row with anything
 * typed in it is an attempt, and an attempt with a hole in it is a refusal.
 */

/** The most Aspects the form offers and a template may hold. */
export const MAX_ASPECTS = 8;

/** One row of the form's Aspects — raw, as posted, before trimming. */
export interface AspectRowInput {
  readonly prompt: string;
  readonly leftValue: string;
  readonly rightValue: string;
}

/** What the route read off the form: a title and the rows, in the order they were drawn. */
export interface TemplateFormInput {
  readonly title: string;
  readonly rows: readonly AspectRowInput[];
}

/** What a save is made of — trimmed, every field present, in authored order. */
export interface AspectDraft {
  readonly prompt: string;
  readonly leftValue: string;
  readonly rightValue: string;
}

export interface TemplateDraft {
  readonly title: string;
  readonly aspects: readonly AspectDraft[];
}

export type TemplateProblemCode =
  | "no-title"
  | "missing-question"
  | "missing-value"
  | "duplicate-prompt"
  | "no-aspects"
  | "too-many-aspects";

/**
 * A refusal: the code the page resolves into a sentence, plus the number a sentence may name.
 *
 * `aspectNumber` is the Aspect's **position among the rows that carry anything** — what the reader
 * counts down the form — never the row's field index, because a row left entirely blank is not an
 * Aspect and numbering around it would point at nothing.
 */
export type TemplateProblem = {
  readonly ok: false;
  readonly code: TemplateProblemCode;
  readonly aspectNumber?: number;
};

export type TemplateDraftResult =
  | { readonly ok: true; readonly draft: TemplateDraft }
  | TemplateProblem;

/**
 * Two questions are the same question when they differ only in case or in whitespace.
 *
 * `"We talk about money"` and `"we talk  about money"` are one question written twice, and a
 * comparison that said they were different would let one sheet hold both and the report average
 * one answer into two. Punctuation is *not* normalised: `"Do we save?"` and `"Do we save!"` are
 * two questions someone may honestly mean.
 */
function questionKey(prompt: string): string {
  return prompt.replace(/\s+/g, " ").toLowerCase();
}

/** Read a posted form value into a draft, or name the first thing that stops it being one. */
export function readTemplateDraft(input: TemplateFormInput): TemplateDraftResult {
  const title = input.title.trim();
  if (title === "") return { ok: false, code: "no-title" };

  const aspects: AspectDraft[] = [];
  const firstSeenAt = new Map<string, number>();

  for (const row of input.rows) {
    const prompt = row.prompt.trim();
    const leftValue = row.leftValue.trim();
    const rightValue = row.rightValue.trim();
    // A row nobody touched is a row the form drew and the person did not use.
    if (prompt === "" && leftValue === "" && rightValue === "") continue;

    const aspectNumber = aspects.length + 1;
    if (prompt === "") return { ok: false, code: "missing-question", aspectNumber };
    if (leftValue === "" || rightValue === "") {
      return { ok: false, code: "missing-value", aspectNumber };
    }

    const key = questionKey(prompt);
    if (firstSeenAt.has(key)) return { ok: false, code: "duplicate-prompt", aspectNumber };
    firstSeenAt.set(key, aspectNumber);

    aspects.push({ prompt, leftValue, rightValue });
  }

  if (aspects.length === 0) return { ok: false, code: "no-aspects" };
  if (aspects.length > MAX_ASPECTS) return { ok: false, code: "too-many-aspects" };

  return { ok: true, draft: { title, aspects } };
}
