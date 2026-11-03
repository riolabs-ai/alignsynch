/**
 * A template draft as the console edits it, validated by the model's own schema (#502a).
 *
 * The console may not accept a template a fixture could not. That is not a rule this module
 * implements — it is a rule it *inherits*: the draft is assembled into the plain record shape and
 * handed to `zAssessment` (`content/assessment.ts`), the same schema `data/assessments.ts` must
 * satisfy and `pnpm data:check` compiles against every fixture. There is no second validator
 * here, deliberately: a console-shaped copy of "an Aspect has two named ends" would be a second
 * rule that could disagree with the first, and the disagreement would surface as a record the
 * console saved and the gate then refused.
 *
 * **Why the payload is the record, not the form.** `validateTemplateRecord()` takes `unknown` and
 * parses it, so a body that carries an extra key is refused by `.strict()` **with the key named**
 * (`Unrecognized key(s) in object: 'opinionKind'`) rather than silently dropped by a reader that
 * only picks the fields it knows. The console's own fields are assembled into that object by
 * `buildTemplateRecord()` — the one place the 1..5 score scale is written — and from there the
 * schema decides.
 *
 * **Pure.** No `pg`, no React, no clock: the caller passes the record's `id`, `slug`, `status` and
 * `date`, because those are facts about the row that is being written, not about the form.
 * `tests/admin-template-draft.test.ts` drives every refusal without a database.
 */
import { zAssessment, type Assessment } from "@/content/assessment";
import { SCORE_MAX, SCORE_MIN } from "@/content/record";

/** One Aspect as the editor holds it: the item's own fields, and no id until it is saved. */
export interface AspectDraft {
  /** Stable once written — an edit keeps it, so a prompt rewrite is not a new Aspect. */
  readonly id?: string;
  readonly prompt: string;
  readonly leftValue: string;
  readonly rightValue: string;
}

/** Everything the editor sends. `status` is the row's, never a control (publishing is #502b). */
export interface TemplateDraftInput {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly summary: string;
  readonly status: string;
  readonly date: string;
  readonly aspects: readonly AspectDraft[];
}

/** One zod issue, with the field named the way an editor can point at it. */
export interface DraftProblem {
  readonly path: string;
  readonly message: string;
}

export type TemplateDraftResult =
  | { readonly ok: true; readonly record: Assessment }
  | { readonly ok: false; readonly problems: readonly DraftProblem[] };

/**
 * What the form posts, and what a save answers — the shapes that cross the client/server
 * boundary, so they live beside the validator rather than in a `"use server"` module (which may
 * export only async functions).
 *
 * `record` is `unknown` on purpose: it is a parsed JSON body, and typing it loosely is what lets
 * `zAssessment` be the thing that decides. A crafted post that adds a key still carries it here.
 */
export interface TemplateFormPayload {
  readonly record?: unknown;
  readonly reason?: string;
}

/** What a save answers. `problems` is `zAssessment`'s own finding, field by field. */
export type TemplateSaveOutcome =
  | { readonly ok: true; readonly id: string; readonly actionId: string }
  | {
      readonly ok: false;
      readonly code: TemplateRefusalCode;
      readonly problems?: readonly DraftProblem[];
    };

/** The refusal codes a save can answer with: the row's facts, or `act()`'s own refusals. */
export type TemplateRefusalCode =
  | "no-such-template"
  | "not-editable"
  | "slug-taken"
  | "invalid-draft"
  | "reason-too-short"
  | "unknown-action"
  | "unknown-target-table"
  | "role-too-low"
  | "signed-out"
  | "failed";

/** `Some Prompt!` → `some-prompt`: the kebab id/slug the model requires (`zId`). */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/g, "");
}

/**
 * The Aspects worth saving: trimmed, and a row with all three fields blank is a row the editor
 * drew and nobody used, so it is dropped rather than refused (the member form's rule, #255).
 * A row with *anything* typed in it is an attempt, and an attempt with a hole is a refusal the
 * schema reports field by field.
 */
export function savedAspects(aspects: readonly AspectDraft[]): AspectDraft[] {
  return aspects
    .map((aspect) => ({
      id: aspect.id,
      prompt: aspect.prompt.trim(),
      leftValue: aspect.leftValue.trim(),
      rightValue: aspect.rightValue.trim(),
    }))
    .filter(
      (aspect) => aspect.prompt !== "" || aspect.leftValue !== "" || aspect.rightValue !== "",
    );
}

/**
 * A new Aspect's id, derived from its prompt and never colliding with one already in the draft.
 *
 * An existing Aspect keeps the id it was read with: the id is what a session's copy and every
 * opinion row name (`E31`), so re-deriving it from a reworded prompt would point those rows at an
 * Aspect that no longer exists. Only an id-less row — a row added in this edit — is derived here.
 */
export function aspectIdOf(prompt: string, taken: ReadonlySet<string>): string {
  const stem = slugify(prompt).slice(0, 48) || "aspect";
  const base = `aspect-${stem}`;
  if (!taken.has(base)) return base;
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/**
 * The plain record the form is editing — **not** a validated one. Every field is the model's own
 * name, the scale is the fixed 1..5 band the schema requires, and the item ids are derived once
 * from the prompts. This is deliberately dumb: it asserts nothing, so `validateTemplateRecord()`
 * below is the only thing that decides whether the record is a template.
 */
export function buildTemplateRecord(input: TemplateDraftInput): Record<string, unknown> {
  const taken = new Set<string>();
  const items = savedAspects(input.aspects).map((aspect) => {
    const id = aspect.id?.trim() ? aspect.id.trim() : aspectIdOf(aspect.prompt, taken);
    taken.add(id);
    return {
      id,
      prompt: aspect.prompt,
      scale: { kind: "score", min: SCORE_MIN, max: SCORE_MAX },
      leftValue: aspect.leftValue,
      rightValue: aspect.rightValue,
    };
  });

  return {
    id: input.id,
    slug: input.slug,
    type: "assessment",
    status: input.status,
    date: input.date,
    title: input.title.trim(),
    summary: input.summary.trim(),
    items,
  };
}

/**
 * Ask `zAssessment` about a body. The **only** validator in the console's write path: a wrong
 * scale kind, a missing pole, a duplicate item id, an unknown key — anywhere in the body — is the
 * schema's finding, flattened to `{ path, message }` so the editor can point at the field.
 */
export function validateTemplateRecord(raw: unknown): TemplateDraftResult {
  const result = zAssessment.safeParse(raw);
  if (result.success) return { ok: true, record: result.data };
  return {
    ok: false,
    problems: result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  };
}

/** Assemble the editor's fields into a record and validate it — the form's whole save decision. */
export function validateTemplateDraft(input: TemplateDraftInput): TemplateDraftResult {
  return validateTemplateRecord(buildTemplateRecord(input));
}
