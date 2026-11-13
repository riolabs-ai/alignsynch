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
import { zAssessment, zAssessmentObject, type Assessment } from "@/content/assessment";
import { SCORE_MAX, SCORE_MIN, uniqueItemIds } from "@/content/record";

/** One Aspect as the editor holds it: the item's own fields, and no id until it is saved. */
export interface AspectDraft {
  /** Stable once written — an edit keeps it, so a prompt rewrite is not a new Aspect. */
  readonly id?: string;
  readonly prompt: string;
  readonly leftValue: string;
  readonly rightValue: string;
}

/**
 * The editor's rows as a record input: **a `new-` id is the list's placeholder, not an id** (#936).
 *
 * `AspectList` mints `new-N` for a row the person just added and that prefix is the protocol —
 * the list reads it back as "not on record yet" (`aspect-list.tsx::isNew`). `buildTemplateRecord`
 * derives an id from the prompt when one is absent, so a placeholder that reaches it is written
 * verbatim: the relationship's copy then holds `item_id = 'new-1'`, which is a row the screen that
 * wrote it can never recognise as saved. Every writer goes through this one function so the two
 * paths on the relationship detail cannot disagree about it again.
 */
export function aspectStatesOf(
  list: readonly {
    readonly id?: string;
    readonly prompt: string;
    readonly leftValue: string;
    readonly rightValue: string;
  }[],
): AspectDraft[] {
  return list.map((row) => ({
    id:
      row.id === undefined || row.id.trim() === "" || row.id.startsWith("new-")
        ? undefined
        : row.id,
    prompt: row.prompt,
    leftValue: row.leftValue,
    rightValue: row.rightValue,
  }));
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
}

/**
 * The console's **create-from-scratch** (#625, #732).
 *
 * `reason` is accepted and recorded when a caller has one, and no form asks for it any more: the
 * owner removed the field from every action surface. It lives on this payload rather than the base
 * one because a member write composes its sentence server-side (`lib/member/template-reasons.ts`),
 * so there is no member path that can reintroduce a field.
 */
export interface TemplateCreatePayload extends TemplateFormPayload {
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

/**
 * What the publish band posts: the template's id and a reason. No record — publishing writes what
 * is **stored**, not what is in the form, so an unsaved edit cannot be published by accident (and
 * the validator runs over the rows the transaction read).
 */
export interface TemplateVersionFormPayload {
  readonly templateId?: string;
  readonly reason?: string;
}

/**
 * What a publish, an unpublish, an archive, a restore or a delete answers. `version` is the version
 * the write landed on, or — for a delete — the highest one the row had before it went (`0` when it
 * had none). The delete's row carries `id` too, because the record it names no longer exists and
 * the audit row is the only place left to read what was destroyed.
 */
export type TemplateVersionOutcome =
  | {
      readonly ok: true;
      readonly version: number;
      readonly actionId: string;
      /** Set by a delete: the id of the record that no longer exists. */
      readonly deletedId?: string;
    }
  | {
      readonly ok: false;
      readonly code: TemplateRefusalCode;
      readonly problems?: readonly DraftProblem[];
    };

/** The refusal codes a save can answer with: the row's facts, or `act()`'s own refusals. */
export type TemplateRefusalCode =
  | "no-such-template"
  | "not-editable"
  /**
   * The row exists and this actor does not own it (#533 phase 2).
   *
   * The member path answers it where the console answers `no-such-template` — the console's rows
   * are the platform's and a wrong id is a wrong id, while a member's rows are rows, and "not
   * yours" is the sentence their screen carries. Both codes are in the union because one editor
   * renders either answer, and the page-level reads still turn both into the same 404.
   */
  | "not-yours"
  | "not-published"
  /**
   * #711 — retiring a template. `already-archived` is a refusal rather than a no-op, for the reason
   * unpublishing is: an operator who asked to retire something and got "nothing happened" cannot
   * tell a mistake from a success. `not-archived` is the same rule for the way back.
   */
  | "already-archived"
  | "not-archived"
  /**
   * #711 — the referential rule, and the reason `delete` exists at all.
   *
   * `template-in-use` means a relationship was created from this template, so it is **archived,
   * not destroyed**: every one of those relationships reads a version of it, and a version cannot
   * outlive the record it belongs to. `template-published` means it was offered in the catalogue at
   * least once, so its versions are the history of what customers saw — archive it instead. Only a
   * row that is neither has no reader, and only that row may be deleted.
   */
  | "template-in-use"
  | "template-published"
  | "slug-taken"
  | "invalid-draft"
  | "version-conflict"
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

/* ------------------------------------------------------------------ *
 * The edit path: a record whose item list may be absent (#943)
 * ------------------------------------------------------------------ */

/**
 * What an **edit** posts: a template's own fields, and `items` only if the caller means them.
 *
 * The distinction this type exists to carry is the one #935's panel could not express. An edit
 * surface that does not draw the Aspects — the relationship's edit dialog, whose list belongs to
 * the detail screen's `AspectList` — has no business naming them, and `items: []` is not a way of
 * saying "unchanged" (it is a way of saying *delete every Aspect*). Omitted is the only value that
 * means *leave the stored rows exactly as they are*, so it is the value the writer reads as a
 * no-op — and the type has to allow it for that to be true rather than merely stated.
 *
 * A caller that **does** mean to send a list is unaffected: `items` present is validated by
 * `zAssessment`'s own `z.array(zAspect).min(1)`, so an item-less or malformed list is still
 * refused field by field. That is why this is a variant of the same schema and not a second one.
 */
export type EditedRecord = Omit<Assessment, "items"> & {
  readonly items?: Assessment["items"];
};

/** What an edit's record is judged against: `zAssessment` with `items` optional, and no other change. */
const zEditedRecord = zAssessmentObject.partial({ items: true }).superRefine((record, ctx) => {
  // The id rule still applies to the list *when there is one* — an omitted list has nothing to
  // collide, and a supplied list is held to the same uniqueness every fixture is.
  if (record.items !== undefined) uniqueItemIds({ id: record.id, items: record.items }, ctx);
});

export type EditedRecordResult =
  | { readonly ok: true; readonly record: EditedRecord }
  | { readonly ok: false; readonly problems: readonly DraftProblem[] };

/**
 * Ask the same model about an **edit's** body: `validateTemplateRecord` with `items` optional.
 *
 * One validator family, one answer shape — the only difference is that the item list may be
 * absent, which `zAssessment` refuses and an edit must accept (#943). `buildTemplateRecord`'s
 * `.min(1)` is untouched: creating a template with no Aspects is still not creating a template.
 */
export function validateEditedRecord(raw: unknown): EditedRecordResult {
  const result = zEditedRecord.safeParse(raw);
  if (result.success) return { ok: true, record: result.data };
  return {
    ok: false,
    problems: result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  };
}

/**
 * The record an edit posts — **and it has no item list at all**, which is the point.
 *
 * It is not `buildTemplateRecord` with an empty array: that would post `items: []` and delete
 * every Aspect on a title change. The absence is the payload, so the surface that draws no aspect
 * control cannot name one, and the server's "omitted means unchanged" branch is the only thing
 * that decides.
 */
export function buildEditedRecord(input: Omit<TemplateDraftInput, "aspects">): unknown {
  return {
    id: input.id,
    slug: input.slug,
    type: "assessment",
    status: input.status,
    date: input.date,
    title: input.title.trim(),
    summary: input.summary.trim(),
  };
}
