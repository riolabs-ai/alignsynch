"use client";

/**
 * template-ancestor: components/assessment-flow/create-relationship.tsx   (variation: stage 1's form lifted into a client component, because a refused press has to answer in words a server render cannot draw)
 *
 * **Stage 1's form, and the reason it is a client module (#975 D8).**
 *
 * The stage asks five `required` facts (both Initiator names, the Counterparty's first name, the
 * invitation address and the title) on a plain `method="post"` form. Pressing **Continue to
 * Stage 2** with the form empty was refused **by the browser**: no `submit` event, no sentence,
 * no band — the only evidence anything had happened was the browser's own tooltip, and the
 * inventory recorded it as `D8`. Stage 2 shipped the same defect one stage earlier (#975 D7,
 * `stage-choice-form.tsx`), and this file is the same answer for the same reason.
 *
 * **One mechanism: the field's own sentence, at the field.** Each control nobody answered prints
 * the fixture's own `{field} is required.` sentence — composed by
 * `lib/flow/create-copy.ts::fieldSentence(field, "required")` on the page and handed down as
 * `requirements`, so this file holds no copy — inside the field's own label, with the control
 * carrying `aria-describedby` to it and `aria-invalid` while it stands, and focus moves to the
 * first refused control. A value that is present but that the control itself rejects (the address
 * on `type="email"`) draws that field's `email` sentence rather than the `required` one, which is
 * the same split `lib/flow/create-draft.ts::whoDraft()` makes server-side.
 *
 * **`noValidate` is what makes the sentence reachable, and it relaxes nothing.** Every control
 * keeps `required`; `noValidate` suppresses only the browser's own bubble, because a
 * native-invalid form never fires `submit` and this handler would never run. The contract is
 * unchanged and is still enforced twice below the browser: `whoDraft()` refuses the posted blank
 * server-side and the store refuses it again before the transaction opens — that refusal comes
 * back as `?problem=invalid-input&field=…`, which `lib/flow/create-copy.ts` composes into the band
 * above this same form. `form.checkValidity()` may therefore still be `false` on arrival, by
 * design, and the acceptance line says so.
 *
 * The form, the refusal and the state live here; the controls stay in `StageOneFields` (which owns
 * the title derivation) and the foot arrives as a node, exactly as `StageChoiceForm` takes it.
 */
import { useState } from "react";
import type { ReactNode } from "react";
import { StageOneFields, type StageOneCopy, type StageOneValues } from "./stage-one-fields";

/**
 * One control the stage refuses to advance past, and the two sentences it can be refused with.
 *
 * `field` is the control's `data-field` id — the same handle the inventory and `StageOneFields`
 * use — not the POST's `name`, so a rename of a form field cannot silently detach its message.
 */
export interface StageOneRequirement {
  /** The `data-field` id of the control this is about. */
  readonly field: string;
  /** The fixture's `{field} is required.` sentence, already filled with the field's own label. */
  readonly sentence: string;
  /**
   * The sentence for a value the control rejects on its own terms — the address on `type="email"`.
   * Absent on every control that has no second way to be wrong.
   */
  readonly invalidSentence?: string;
}

/** The stage heading's id, so the form's accessible name is the page's `<h2>` and cannot drift. */
const STAGE_HEADING_ID = "create-stage-heading";

/** The control a `data-field` id names, or `null` when the fieldset does not draw it. */
function controlFor(form: HTMLFormElement, field: string): HTMLInputElement | null {
  return form.querySelector<HTMLInputElement>(`[data-field="${field}"] input`);
}

/**
 * Which controls refuse this press, and with what sentence.
 *
 * Read off the form rather than off React state, because the controls are uncontrolled: the DOM is
 * the answer of record, which is also what the browser and the server validate. A leading or
 * trailing space counts as nothing typed — the same `trim()` `whoDraft()` applies, so the screen
 * and the store cannot disagree about a blank field.
 */
function refusalsOf(
  form: HTMLFormElement,
  requirements: readonly StageOneRequirement[],
): Record<string, string> {
  const problems: Record<string, string> = {};
  for (const requirement of requirements) {
    const control = controlFor(form, requirement.field);
    if (control === null) continue;
    if (control.value.trim() === "") {
      problems[requirement.field] = requirement.sentence;
      continue;
    }
    if (requirement.invalidSentence !== undefined && !control.validity.valid) {
      problems[requirement.field] = requirement.invalidSentence;
    }
  }
  return problems;
}

export function StageOneForm({
  action,
  templateRecordId,
  copy,
  values,
  descriptionDefault,
  requirements,
  foot,
}: {
  /** Where the form posts — the page's own `SAVE_WHO_PATH`. */
  action: string;
  /** The template the stage is copying; the form carries it so the POST names it. */
  templateRecordId: string;
  copy: StageOneCopy;
  values: StageOneValues;
  /** The template's own summary — the description's default, never a second fixture. */
  descriptionDefault: string;
  /** The five required controls, in the order the stage draws them. */
  requirements: readonly StageOneRequirement[];
  /** The stage foot: `[Back][Cancel]` left, the advance flush right. Built by the page. */
  foot: ReactNode;
}) {
  const [problems, setProblems] = useState<Readonly<Record<string, string>>>({});

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const refusals = refusalsOf(form, requirements);
    setProblems(refusals);
    const first = Object.keys(refusals)[0];
    if (first === undefined) return; // nothing refused: the post goes ahead, untouched
    // Answer the press instead of swallowing it: name the field and put the cursor on it.
    event.preventDefault();
    controlFor(form, first)?.focus();
  }

  /** A keystroke lands: the fields that are now answered stop saying so; the rest keep their own. */
  function handleChange(event: React.FormEvent<HTMLFormElement>) {
    if (Object.keys(problems).length === 0) return;
    setProblems(refusalsOf(event.currentTarget, requirements));
  }

  return (
    <form
      action={action}
      method="post"
      // Only the browser's bubble is switched off — see the module docstring. Every control keeps
      // `required`, and `whoDraft()` keeps its own refusal for a crafted post.
      noValidate
      aria-labelledby={STAGE_HEADING_ID}
      onSubmit={handleSubmit}
      onChange={handleChange}
      className="space-y-5 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
    >
      {/* The template is the route's own fact; the form carries it so the POST names it. */}
      <input type="hidden" name="templateRecordId" value={templateRecordId} />

      <StageOneFields
        copy={copy}
        values={values}
        descriptionDefault={descriptionDefault}
        problems={problems}
      />

      {foot}
    </form>
  );
}
