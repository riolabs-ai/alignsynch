"use client";

/**
 * template-ancestor: components/assessment-flow/create-relationship.tsx   (variation: stage 2's one single-select control and its form lifted into a client component, because a refused press has to answer in words a server render cannot draw)
 *
 * **Stage 2's two choices, and the reason this is a client module (#975 D7).**
 *
 * The stage asks two `required` questions — Opinions Mode and Alignment Setting — and neither is
 * pre-selected, on purpose (`create-relationship.tsx`: a default would be this form choosing a bar
 * for two people who never saw the question). Both groups are native `required` radios on a plain
 * `method="post"` form, which meant a press with nothing chosen was refused **by the browser**: the
 * form did not submit, no sentence was drawn, and `form.checkValidity() === false` was the only
 * evidence anything had happened. To the person the Continue control simply did not work — the
 * defect is recorded as `D7` in the #975 inventory.
 *
 * **One mechanism, and it is the field's own sentence.** The advance stays enabled and the press
 * answers it: each group nobody answered prints the fixture's own `{field} is required.` sentence,
 * filled with that group's legend by `lib/flow/create-copy.ts::fieldSentence()` — so the screen says
 * `Opinions Mode is required.`, the radios of that group carry `aria-describedby` and
 * `aria-invalid`, and focus moves to the first of them. This file holds no copy: every word arrives
 * as a prop from `data/pages/assessment-create.ts` (E23).
 *
 * **Why the message and not a disabled control.** A disabled advance cannot be focused, so its
 * reason cannot be reached from the keyboard, and it reports nothing when pressed because it cannot
 * be pressed. The sentence is drawn where the decision is, it stays until the decision is made
 * (never a toast that disappears before it is read), and it clears group by group as choices land.
 *
 * **`noValidate` is what makes the sentence possible, and it relaxes no field.** Every radio keeps
 * `required`. `noValidate` suppresses only the browser's own speech bubble — the feedback nobody
 * could see on the screen — because a native-invalid form never fires `submit`, so this handler
 * would never run. The validation is not weakened: `fieldset` radios still refuse a post in any
 * browser, `lib/flow/create-draft.ts::modeDraft()` refuses a crafted post without one, and the
 * server's refusal lands on this same stage as `?problem=invalid-input&field=…`, where
 * `lib/flow/create-copy.ts` composes the same sentence into the band above the form.
 */
import { useState } from "react";
import type { ReactNode } from "react";

/** One option of a single-select group: the value stored, the word, and what it does. */
export interface ChoiceOption {
  readonly value: string;
  readonly label: string;
  readonly help: string;
}

/**
 * One single-select group, as the page describes it. The page owns every word and the model's own
 * vocabulary (`MODE_LABELS`, `SETTING_DEFINITIONS`); this module owns only the refusal.
 */
export interface ChoiceGroup {
  /** The radio `name` — and the key into `selected`. */
  readonly name: string;
  readonly legend: string;
  readonly options: readonly ChoiceOption[];
  /**
   * The fixture's `{field} is required.` sentence with this group's own label already filled in.
   * Empty only when the fixture lost the row, and then the refusal is still refused: focus moves to
   * the group and nothing is invented on screen.
   */
  readonly requiredSentence: string;
  /** The chip beside the legend — "Fixed at creation" on Opinions Mode. */
  readonly badge?: string;
  /** The line above the cells — the Alignment Setting's lens sentence. */
  readonly intro?: string;
  /** The line under the cells — the Alignment Setting's threshold sentence. */
  readonly note?: string;
}

/** The message a group's own radios point at, so the refusal is tied to the control it is about. */
function problemId(name: string): string {
  return `${name}-problem`;
}

/** The heading's id: the stage's `<h2>` and the form's accessible name, so the two cannot drift. */
const MODE_HEADING_ID = "create-mode-heading";

/**
 * Which groups nobody answered. Read off the form itself rather than off React state, because the
 * radios are uncontrolled — the DOM is the answer of record, which is also what the browser and the
 * server validate.
 */
function unansweredGroups(form: HTMLFormElement, groups: readonly ChoiceGroup[]): string[] {
  return groups
    .filter((group) => {
      const field = form.elements.namedItem(group.name);
      // A `RadioNodeList`'s `value` is the checked radio's value, or "" when none is chosen.
      return field === null || (field as RadioNodeList).value === "";
    })
    .map((group) => group.name);
}

export function StageChoiceForm({
  action,
  heading,
  body,
  templateRecordId,
  groups,
  selected,
  foot,
}: {
  /** Where the form posts — the page's own `SAVE_MODE_PATH`. */
  action: string;
  heading: string;
  body: string;
  /** The template the stage is copying; the form carries it so the POST names it. */
  templateRecordId: string;
  groups: readonly ChoiceGroup[];
  /** The draft's answers, keyed by group name — a return visit draws what was chosen. */
  selected: Readonly<Record<string, string | undefined>>;
  /** The stage foot: `[Back][Cancel]` left, the advance flush right. Built by the page. */
  foot: ReactNode;
}) {
  const [refused, setRefused] = useState<readonly string[]>([]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const missing = unansweredGroups(form, groups);
    setRefused(missing);
    if (missing.length === 0) return; // both answered: the post goes ahead, untouched
    // Answer the press instead of swallowing it: name the field and put the cursor on it.
    event.preventDefault();
    const first = form.querySelector<HTMLInputElement>(`input[name="${missing[0]}"]`);
    first?.focus();
  }

  /** A choice lands: the group's sentence goes away, and any group still unanswered keeps its own. */
  function handleChange(event: React.FormEvent<HTMLFormElement>) {
    if (refused.length === 0) return;
    setRefused(unansweredGroups(event.currentTarget, groups));
  }

  return (
    <form
      action={action}
      method="post"
      // Only the browser's bubble is switched off — see the module docstring. Every radio keeps
      // `required`, and the store keeps its own refusal for a crafted post.
      noValidate
      aria-labelledby={MODE_HEADING_ID}
      onSubmit={handleSubmit}
      onChange={handleChange}
      className="space-y-5 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
    >
      <h2 id={MODE_HEADING_ID} className="text-lg font-semibold text-gray-900 dark:text-gray-100">
        {heading}
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-300">{body}</p>

      <input type="hidden" name="templateRecordId" value={templateRecordId} />

      {/*
       * **Two peers, not two stacks** (#760). Opinions Mode and Alignment Setting are two
       * independent dimensions of equal weight, so they are one control drawn twice: side by side
       * from `sm` up, one column below it.
       */}
      <div className="grid gap-3 sm:grid-cols-2">
        {groups.map((group) => (
          <ChoiceFieldset
            key={group.name}
            group={group}
            selected={selected[group.name]}
            refused={refused.includes(group.name)}
          />
        ))}
      </div>

      {foot}
    </form>
  );
}

/**
 * **One single-select group**, drawn twice on Settings (#760).
 *
 * A `fieldset` with the live legend, one bordered cell per option, a native `required` radio (the
 * browser's own single-choice contract — arrow keys move within one `name`) and the option's
 * one-line glossary help. The refusal sentence sits under the cells, inside the fieldset, so it is
 * read as part of the question that refused it; the radios carry `aria-describedby` to it and
 * `aria-invalid` while it stands.
 */
function ChoiceFieldset({
  group,
  selected,
  refused,
}: {
  group: ChoiceGroup;
  selected: string | undefined;
  refused: boolean;
}) {
  const messageId = problemId(group.name);
  return (
    <fieldset
      data-choice-group={group.name}
      data-choice-refused={refused ? "true" : undefined}
      className="grid content-start gap-2 rounded-lg border border-gray-200 p-4 text-sm dark:border-gray-700"
    >
      <legend className="font-medium text-gray-800 dark:text-gray-100">
        {group.legend}
        {group.badge === undefined ? null : (
          <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 align-middle text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            {group.badge}
          </span>
        )}
      </legend>
      {group.intro === undefined ? null : (
        <p className="text-xs text-gray-500 dark:text-gray-400">{group.intro}</p>
      )}
      <div className="grid gap-2">
        {group.options.map((option) => (
          <label
            key={option.value}
            className="flex items-start gap-2 rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700"
          >
            <input
              type="radio"
              name={group.name}
              value={option.value}
              required
              defaultChecked={selected === option.value}
              aria-describedby={refused ? messageId : undefined}
              aria-invalid={refused ? true : undefined}
              className="mt-1"
            />
            <span>
              <span className="font-medium text-gray-800 dark:text-gray-100">{option.label}</span>
              <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                {option.help}
              </span>
            </span>
          </label>
        ))}
      </div>
      {/*
       * The refusal (#975 D7): the fixture's own sentence, at the field it is about, announced by
       * `role="alert"` and reachable from the radios by `aria-describedby`.
       */}
      {refused && group.requiredSentence !== "" ? (
        <p id={messageId} role="alert" className="font-medium text-amber-700 dark:text-amber-300">
          {group.requiredSentence}
        </p>
      ) : null}
      {group.note === undefined ? null : (
        <p className="text-xs text-gray-500 dark:text-gray-400">{group.note}</p>
      )}
    </fieldset>
  );
}
