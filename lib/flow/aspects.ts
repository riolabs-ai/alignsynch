/**
 * The create flow's Aspects (#689) — the working list stage 3 edits, and the one place it is
 * shaped, validated, reordered and reduced to what the create writes.
 *
 * **Stage 3 edits a list, not one field.** The template's Aspects arrive from the catalogue read
 * (`lib/db/template-library.ts` → `LibraryTemplateDetail.aspects`), the person reword an Aspect's
 * question and both of its opinion labels, drags them into the order they want to answer them in,
 * and the result has to survive a reload. So the list lives in the same draft object stage 1 and 2
 * built (`lib/flow/create-draft.ts`), one array inside the one cookie — a second cookie or a
 * table would be a second copy of "where the person got to".
 *
 * **Aspect ids are the template's.** The draft carries the id it was seeded with, and
 * `aspectEditsFor()` reduces the working list back to the template's own id set: a relationship's
 * copy of its Aspects is compared, id for id and in order, against the template version it is
 * bound to (`lib/db/rows.ts::copyDriftProblems`, `db:verify` V4). Editing a question and its two
 * labels keeps every id, so the copy is still a copy; adding or removing an Aspect would not, and
 * that is a separate decision (`#689` follow-up) rather than something this module smuggles in.
 *
 * **Pure on purpose** — no `next/headers`, no React, no database — so the rules, the seeding, the
 * drag's move and the reduction are unit-tested without a server, and the page, the two route
 * handlers and the client list share exactly one implementation.
 */
import { z } from "zod";

/**
 * One Aspect, as the stage-3 list holds it.
 *
 * The four fields are the model's own: `id` is the item id the copy keeps, `prompt` is what both
 * seats answer, and `leftValue` / `rightValue` are the two opinion labels at the ends of the 1..5
 * band (`content/assessment.ts::zAspect`). Nothing here is a second model — the array is parsed
 * back into `zAspect` rows by the store when the relationship is created.
 */
export const zAspectDraft = z
  .object({
    id: z.string().min(1),
    prompt: z.string(),
    leftValue: z.string(),
    rightValue: z.string(),
  })
  .strict();

export type AspectDraft = z.infer<typeof zAspectDraft>;

/** The fields a refusal may name — the id of the input, never a column name. */
export const ASPECT_FIELDS = ["prompt", "left", "right"] as const;

export type AspectField = (typeof ASPECT_FIELDS)[number];

/**
 * The template's Aspects, in the order the template offers them.
 *
 * Takes the projection `readLibraryTemplate()` returns, and not `zAspect` items, because that is
 * what the page has in hand: the read has already resolved whether the published version or the
 * working copy is what a person is copying.
 */
export function aspectsFromTemplate(
  aspects: readonly {
    readonly id: string;
    readonly prompt: string;
    readonly leftValue: string;
    readonly rightValue: string;
  }[],
): AspectDraft[] {
  return aspects.map((aspect) => ({
    id: aspect.id,
    prompt: aspect.prompt,
    leftValue: aspect.leftValue,
    rightValue: aspect.rightValue,
  }));
}

/**
 * The list stage 3 renders: what the draft holds, or the template's own list on a first visit.
 *
 * The draft's array wins the moment it exists, **including when it is empty** — a person who
 * removed every Aspect must see an empty list, not the template's list silently restored. That is
 * why the draft distinguishes "no aspects key" (absent, seeded from the template) from "an empty
 * array" (a list the person emptied) instead of treating both as falsy.
 */
export function workingAspects(
  draftAspects: readonly AspectDraft[] | undefined,
  templateAspects: readonly AspectDraft[],
): AspectDraft[] {
  return draftAspects === undefined ? [...templateAspects] : [...draftAspects];
}

/**
 * Why an Aspect cannot be saved, or `null`.
 *
 * The first empty field, in the order the form asks for them, so the refusal names the input the
 * person is looking at. Identical to the model's own rule (`zAspect`'s `.min(1)` on the prompt and
 * both values), said one screen earlier and by label.
 */
export function aspectProblem(aspect: {
  readonly prompt: string;
  readonly leftValue: string;
  readonly rightValue: string;
}): AspectField | null {
  if (aspect.prompt.trim() === "") return "prompt";
  if (aspect.leftValue.trim() === "") return "left";
  if (aspect.rightValue.trim() === "") return "right";
  return null;
}

/** The aspect's fields as the form posts them: trimmed, with the id the list keys on. */
export function normalizeAspect(aspect: AspectDraft): AspectDraft {
  return {
    id: aspect.id,
    prompt: aspect.prompt.trim(),
    leftValue: aspect.leftValue.trim(),
    rightValue: aspect.rightValue.trim(),
  };
}

/**
 * Move one Aspect to an index — the whole of the drag, as a pure function.
 *
 * The pointer drag in `components/assessment-flow/aspect-list.tsx` decides *which* index; this
 * decides what the new list is, so the reorder is testable without a DOM and the same call is
 * used by the keyboard path. An index outside the list is clamped rather than refused: the drag
 * computes it from a hit test, and landing one past the end means "at the end", not "drop it".
 */
export function moveAspect(
  aspects: readonly AspectDraft[],
  id: string,
  toIndex: number,
): AspectDraft[] {
  const from = aspects.findIndex((aspect) => aspect.id === id);
  if (from === -1) return [...aspects];
  const target = Math.max(0, Math.min(aspects.length - 1, toIndex));
  if (target === from) return [...aspects];
  const next = [...aspects];
  const [moved] = next.splice(from, 1);
  next.splice(target, 0, moved);
  return next;
}

/**
 * What the create writes: the template's id set, in the template's order, carrying the person's
 * words.
 *
 * **The order and the id set are the template's, deliberately.** A relationship's copy is
 * compared against the version it is bound to, id for id and in order
 * (`lib/db/rows.ts::copyDriftProblems` → `db:verify` V4), so a copy that is missing an Aspect or
 * carries one the template never offered is drift the verifier names. Rewording is not: the
 * prompt and both labels are the person's the moment the relationship exists, and the approved
 * artifact says so ("Copied from the template. You can rename or reword an Aspect here").
 *
 * An id the template does not offer is dropped and a template Aspect the list lost is written
 * from the template — the reduction never invents a row, and it never deletes one.
 */
export function aspectEditsFor(
  aspects: readonly AspectDraft[],
  templateAspects: readonly AspectDraft[],
): AspectDraft[] {
  const byId = new Map(aspects.map((aspect) => [aspect.id, aspect]));
  return templateAspects.map((template) => {
    const edited = byId.get(template.id);
    if (edited === undefined) return { ...template };
    const normalized = normalizeAspect(edited);
    return {
      id: template.id,
      prompt: normalized.prompt === "" ? template.prompt : normalized.prompt,
      leftValue: normalized.leftValue === "" ? template.leftValue : normalized.leftValue,
      rightValue: normalized.rightValue === "" ? template.rightValue : normalized.rightValue,
    };
  });
}

/**
 * Parse a posted list — the `POST /assessment/new/aspects` body, and the array inside the draft.
 *
 * `null` for anything that is not exactly the shape above: a hand-edited request must be refused
 * with a code, never throw inside a route or a render. An empty array is legal here (it is a list
 * a person emptied); whether a *save* may leave it empty is the store's rule at create time
 * (`template-has-no-aspects`, which the create endpoint already answers).
 */
export function parseAspects(value: unknown): AspectDraft[] | null {
  if (!Array.isArray(value)) return null;
  const parsed = z.array(zAspectDraft).safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** One Aspect by id, for a view that has the id and needs the row. */
export function aspectById(
  aspects: readonly AspectDraft[],
  id: string | undefined,
): AspectDraft | undefined {
  return id === undefined ? undefined : aspects.find((aspect) => aspect.id === id);
}
