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
 * **Aspect ids are the template's — while the list still is a copy.** The draft carries the id it
 * was seeded with, and `aspectEditsFor()` reduces the working list back to the template's own id
 * set: a relationship's copy of its Aspects is compared, id for id and in order, against the
 * template version it is bound to (`lib/db/rows.ts::copyDriftProblems`, `db:verify` V4). Rewording
 * a question and its two labels keeps every id, so the copy is still a copy. **Adding or removing
 * an Aspect makes the list the creator's own** (#699): `aspectsToWrite()` answers which of the two
 * it is, `authoredAspects()` writes the person's list in their order (minting an id for each row
 * they added), and the create records the fact as `session.aspects_authored_at`. V4 then validates
 * that copy's own structure instead of comparing it to a version it deliberately left — the rule
 * stops being a lie without being removed.
 *
 * **A relationship needs at least one Aspect**, so the last row cannot be removed
 * (`canRemoveAspect`) and a create whose list came back empty is refused rather than written as an
 * instance the model cannot parse (`zAssessmentInstance.items` is `.min(1)`).
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
 * What the create writes **when the list is still a copy**: the template's id set, in the
 * template's order, carrying the person's words.
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
 *
 * **This is the copy branch only** (#699). A list that added or removed an Aspect is not reduced
 * back into a copy — that silently threw the creator's edit away — it goes through
 * `authoredAspects()` and is recorded as authored.
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
 * Has this list stopped being a copy of the version? (#699)
 *
 * True the moment the id sequence differs — an Aspect added, one removed, or the list dragged
 * into a different order. Rewording is not authorship: the words were always the person's, and
 * V4 compares ids, not sentences. The answer is what the create stamps on
 * `session.aspects_authored_at`, so it has to be the one rule and not a judgement call.
 */
export function aspectsAreAuthored(
  aspects: readonly AspectDraft[],
  templateAspects: readonly AspectDraft[],
): boolean {
  if (aspects.length !== templateAspects.length) return true;
  return aspects.some((aspect, index) => aspect.id !== templateAspects[index]?.id);
}

/**
 * What the create writes when the list is the creator's own (#699): every row, in their order,
 * with an id nothing else holds.
 *
 * **Kept rows keep the template's id; added rows are minted one.** An id the template offers is
 * the handle that says which Aspect of the source this row came from, so it travels unchanged
 * through any number of edits. A row the person added has no such handle — its draft id is the
 * client's placeholder (`new-1`) — so `mintId` gives it a real one, once, at the write.
 *
 * **A blank field on a kept row falls back to the template's**, exactly as the copy branch does:
 * the store must never write an Aspect with an empty question because a browser posted one. A
 * blank field on an added row is not filled in — there is nothing to fall back to, and
 * `aspectWriteProblem` refuses the list rather than inventing the creator's question for them.
 */
export function authoredAspects(
  aspects: readonly AspectDraft[],
  templateAspects: readonly AspectDraft[],
  mintId: () => string,
): AspectDraft[] {
  const templateById = new Map(templateAspects.map((aspect) => [aspect.id, aspect]));
  return aspects.map((aspect) => {
    const normalized = normalizeAspect(aspect);
    const template = templateById.get(aspect.id);
    const id = template === undefined ? mintId() : template.id;
    if (template === undefined) {
      return { ...normalized, id };
    }
    return {
      id,
      prompt: normalized.prompt === "" ? template.prompt : normalized.prompt,
      leftValue: normalized.leftValue === "" ? template.leftValue : normalized.leftValue,
      rightValue: normalized.rightValue === "" ? template.rightValue : normalized.rightValue,
    };
  });
}

/** What a create writes for stage 3's list, and whether the list was authored (#699). */
export interface AspectWrite {
  /** The rows to insert, in the order both seats will answer them. */
  readonly aspects: AspectDraft[];
  /** `true` when the create stamps `session.aspects_authored_at` — the list is not the version's. */
  readonly authored: boolean;
}

/**
 * The one decision a create makes about its Aspects (#699): is this list the version's copy, or
 * the creator's own?
 *
 * A copy keeps the version's ids **and order** (V4 compares both). An authored list keeps the
 * person's order, because that is what the drags and the added rows were for. There is no third
 * answer and no silent drop: whichever branch runs, every row the person is looking at is either
 * written or refused by `aspectWriteProblem` — never quietly replaced by the template's list.
 */
export function aspectsToWrite(
  aspects: readonly AspectDraft[],
  templateAspects: readonly AspectDraft[],
  mintId: () => string,
): AspectWrite {
  if (!aspectsAreAuthored(aspects, templateAspects)) {
    return { aspects: aspectEditsFor(aspects, templateAspects), authored: false };
  }
  return { aspects: authoredAspects(aspects, templateAspects, mintId), authored: true };
}

/** Why a create must refuse this list, or `null` when it can be written (#699). */
export type AspectListProblem = "none" | "blank" | "duplicate";

/**
 * The invariants a create can check **before it opens a transaction**: the list is not empty, and
 * no id appears twice.
 *
 * Both are list-level facts that need no template: a relationship needs at least one Aspect
 * (`zAssessmentInstance.items` is `.min(1)`) and `uniqueItemIds` refuses a repeat, so a post that
 * breaks either cannot be written whatever version it names. A refusal here costs nothing — no
 * record, no item, no transaction — which is the same discipline the Mode and the Setting follow.
 */
export function aspectListProblem(aspects: readonly AspectDraft[]): "none" | "duplicate" | null {
  if (aspects.length === 0) return "none";
  const ids = new Set(aspects.map((aspect) => aspect.id));
  return ids.size === aspects.length ? null : "duplicate";
}

/**
 * The invariants of **the rows the create is about to write** — `aspectListProblem` plus the one
 * question that needs the template in hand.
 *
 * **A blank row is refused only when nothing can fill it.** A kept row with an empty field has
 * already fallen back to the version's words by the time this runs (`aspectEditsFor` /
 * `authoredAspects`), so a blank here is a row the person added with no question — there is no
 * template Aspect to stand in for it, and writing it would put an unanswerable line on both seats'
 * sheets. The model agrees (`zAspect` requires the prompt and both labels), so this is the refusal
 * a stage can print instead of an instance no page can parse.
 */
export function aspectWriteProblem(aspects: readonly AspectDraft[]): AspectListProblem | null {
  const listProblem = aspectListProblem(aspects);
  if (listProblem !== null) return listProblem;
  for (const aspect of aspects) {
    if (aspectProblem(aspect) !== null) return "blank";
  }
  return null;
}

/**
 * Whether the row at this position may be removed (#699).
 *
 * A relationship with no Aspects asks nothing of either seat, so the last row stays and the
 * remove control refuses it — the state the flow renders is one Aspect minimum, matching the
 * model's `.min(1)` rather than discovering it at the create.
 */
export function canRemoveAspect(count: number): boolean {
  return count > 1;
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
