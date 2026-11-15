"use client";

/**
 * template-ancestor: components/assessment-flow/create-relationship.tsx   (variation: the one stage whose fields derive from each other, lifted into a client component so the title can follow the names as they are typed)
 *
 * **Stage 1's seven fields**, and the one thing a server component cannot do: derive the title
 * from the four name inputs *while they are typed* (#825, v9 artifact `s4Who`).
 *
 * The form is still the page's — this component renders the controls inside
 * `<form action={SAVE_WHO_PATH}>`, so nothing here navigates, submits or reads a cookie. It owns
 * exactly two pieces of state: the four name parts and the title, plus a flag saying whether the
 * title has been typed in.
 *
 * **The title is a default, and the flag is what makes it one.** While `titleTouched` is false
 * the title input renders `derivedTitle(names)`, so typing a first or last name re-derives it;
 * the first keystroke *in the title* sets the flag, and from then on the names no longer move it.
 * On a reload the flag is derived from the draft (`values.title !== ""`) rather than stored: the
 * flow's own cookie already carries the title the person answered, so there is no second key, no
 * `localStorage`, and nothing that survives a reload which the flow did not already own.
 *
 * **The five required fields are marked twice, on purpose.** The asterisk is `aria-hidden` — a
 * glyph is not a word — with the fixture's own "required" beside it in a visually hidden span, so
 * a screen reader says the requirement; the input's own `required` attribute is what refuses the
 * post in the browser before `whoDraft()` ever sees it. Both marks cover the same five fields, and
 * both stay: `noValidate` on the form (`stage-one-form.tsx`) suppresses the browser's bubble, never
 * the mark or the contract.
 *
 * **A refused field prints its own sentence, inside its own label (#975 D8).** `problems` maps a
 * field's `data-field` id to the sentence the fixture composes for it (`lib/flow/create-copy.ts`'s
 * `fieldSentence`, resolved by the page); the control carries `aria-describedby` to the sentence
 * and `aria-invalid` while it stands, so a screen reader reads the refusal as part of the question
 * that was refused — the same shape stage 2 already ships (`stage-choice-form.tsx`, #984). The
 * sentences are `<span>`s, not `<p>`s: this control's label is the wrapper, and a `label` may only
 * hold phrasing content.
 *
 * **The layout is the artifact's**, not a 6/6 grid of five: row 1 is the title beside the
 * Initiator pair, row 2 the Counterparty pair beside the address, and the description closes the
 * form full width. A pair is two controls in one column and **collapses to one control each below
 * 720px**, with its help line under the pair rather than under half of it.
 *
 * Every word is a prop: the caller resolves it from `data/pages/assessment-create.ts` (E23), so
 * this file holds no copy and a label cannot drift from the sentence a refusal is composed from.
 */
import { useState } from "react";
import { derivedTitle } from "@/lib/flow/names";

/** The strings Stage 1 draws, resolved from the page fixture by the server component. */
export interface StageOneCopy {
  readonly titleLabel: string;
  readonly titleHelp: string;
  readonly initiatorFirstLabel: string;
  readonly initiatorLastLabel: string;
  readonly initiatorLastPlaceholder: string;
  readonly initiatorHelp: string;
  readonly counterpartyFirstLabel: string;
  readonly counterpartyFirstPlaceholder: string;
  readonly counterpartyLastLabel: string;
  readonly counterpartyLastPlaceholder: string;
  readonly counterpartyHelp: string;
  readonly emailLabel: string;
  readonly emailPlaceholder: string;
  readonly descriptionLabel: string;
  readonly descriptionPlaceholder: string;
  readonly descriptionHelp: string;
  /** The word a screen reader hears after a required field's label. */
  readonly requiredNote: string;
}

/** What the draft already holds, so a reload renders what was typed. */
export interface StageOneValues {
  readonly initiatorFirst: string;
  readonly initiatorLast: string;
  readonly counterpartyFirst: string;
  readonly counterpartyLast: string;
  readonly title: string;
  readonly email: string;
  readonly description: string;
}

/**
 * The shared control shapes — the shipped create form's own classes, not a second style — and a
 * control fills the cell it is in. `w-full` is what the old one-per-row form got away without: a
 * bare `<input>` keeps its intrinsic `size="20"` width, which fits a full-width row and is wider
 * than a half of the two-column name pair — where it overflowed the cell (found in local review of
 * Stage 1, 2026-11-12). `min-w-0` lets the grid item shrink below that intrinsic width instead of
 * pushing its own track wider.
 */
const INPUT_CLASSES =
  "w-full min-w-0 rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-950";
const LABEL_CLASSES = "font-medium text-gray-700 dark:text-gray-200";
const HELP_CLASSES = "text-xs text-gray-500 dark:text-gray-400";

/**
 * The red asterisk and the word beside it: an `aria-hidden` glyph, and the spoken label. One
 * component so the five required fields cannot mark themselves five different ways.
 */
function RequiredMark({ note }: { note: string }) {
  return (
    <>
      <span aria-hidden="true" className="ml-0.5 text-red-600 dark:text-red-400">
        *
      </span>
      <span className="sr-only">{note}</span>
    </>
  );
}

/**
 * The five required controls' `data-field` handles, named once (#975 D8).
 *
 * They are **handles, not copy**: the ids `StageOneForm` locates a control by and the key its
 * refusal sentence is filed under — never a word a reader sees. They are named here rather than
 * retyped at each of the ten call sites (the aria pair and the sentence, per control) because E23
 * counts a string written at a JSX attribute as copy and this route's budget is 0: the ids already
 * live on each `label` as `data-field`, which E23 exempts, so the rest of the file agrees with that
 * one place instead of spelling `"initiator-first"` a third time.
 */
export const STAGE_ONE_FIELDS = {
  title: "title",
  initiatorFirst: "initiator-first",
  initiatorLast: "initiator-last",
  counterpartyFirst: "counterparty-first",
  email: "email",
} as const;

/**
 * The sentence a refused field points at, under its own control (#975 D8).
 *
 * `<span>` and not `<p>`: the control's `<label>` is the wrapper here, and a `label` may only hold
 * phrasing content — a `<p>` inside it is invalid markup that browsers re-parent.
 */
function FieldProblem({
  field,
  problems,
}: {
  field: string;
  problems: Readonly<Record<string, string>>;
}) {
  const sentence = problems[field];
  // An empty string means the fixture lost the row: the press is still refused, nothing is drawn.
  if (sentence === undefined || sentence === "") return null;
  return (
    <span
      id={problemId(field)}
      role="alert"
      className="block text-xs font-medium text-amber-700 dark:text-amber-300"
    >
      {sentence}
    </span>
  );
}

/** The `id` a field's sentence carries, so the control can describe itself with it. */
function problemId(field: string): string {
  return `${field}-problem`;
}

/**
 * The aria pair an invalid control carries — empty when nothing refused it, so a clean stage draws
 * no `aria-invalid` at all rather than `"false"` on every field.
 */
function invalidProps(
  field: string,
  problems: Readonly<Record<string, string>>,
): { "aria-describedby"?: string; "aria-invalid"?: true } {
  if (problems[field] === undefined) return {};
  return { "aria-describedby": problemId(field), "aria-invalid": true };
}

export function StageOneFields({
  copy,
  values,
  descriptionDefault,
  problems = {},
}: {
  copy: StageOneCopy;
  values: StageOneValues;
  /** The template's own summary — the description's default, never a second fixture. */
  descriptionDefault: string;
  /**
   * The refused fields, keyed by `data-field` id, each with the sentence the fixture composes for
   * it. Absent on arrival: the stage is quiet until somebody presses the advance.
   */
  problems?: Readonly<Record<string, string>>;
}) {
  const [names, setNames] = useState({
    initiatorFirst: values.initiatorFirst,
    initiatorLast: values.initiatorLast,
    counterpartyFirst: values.counterpartyFirst,
    counterpartyLast: values.counterpartyLast,
  });
  const [title, setTitle] = useState(values.title);
  /**
   * Has anybody typed in the title? A stored title means yes — it is the answer the flow
   * already owns, so a reload holds it instead of deriving over it.
   */
  const [titleTouched, setTitleTouched] = useState(values.title.trim() !== "");

  const shownTitle = titleTouched
    ? title
    : derivedTitle(
        { first: names.initiatorFirst, last: names.initiatorLast },
        { first: names.counterpartyFirst, last: names.counterpartyLast },
      );

  const setPart = (key: keyof typeof names) => (event: { target: { value: string } }) => {
    setNames((previous) => ({ ...previous, [key]: event.target.value }));
  };

  return (
    <div className="grid gap-3 sm:grid-cols-12">
      {/* 1 — the title, beside the Initiator pair. */}
      <label className="grid gap-1 text-sm sm:col-span-6" htmlFor="create-title" data-field="title">
        <span className={LABEL_CLASSES}>
          {copy.titleLabel}
          <RequiredMark note={copy.requiredNote} />
        </span>
        <input
          id="create-title"
          name="title"
          value={shownTitle}
          required
          {...invalidProps(STAGE_ONE_FIELDS.title, problems)}
          onChange={(event) => {
            setTitle(event.target.value);
            setTitleTouched(true);
          }}
          className={INPUT_CLASSES}
        />
        <FieldProblem field={STAGE_ONE_FIELDS.title} problems={problems} />
        <span className={HELP_CLASSES}>{copy.titleHelp}</span>
      </label>

      {/* 2 — the Initiator: two required halves in one column, help under the pair. */}
      <div className="grid min-w-0 gap-3 sm:col-span-6" data-pair="initiator">
        <div className="grid min-w-0 grid-cols-1 gap-3 min-[720px]:grid-cols-2">
          <label
            className="grid min-w-0 gap-1 text-sm"
            htmlFor="create-initiator-first"
            data-field="initiator-first"
          >
            <span className={LABEL_CLASSES}>
              {copy.initiatorFirstLabel}
              <RequiredMark note={copy.requiredNote} />
            </span>
            <input
              id="create-initiator-first"
              name="initiatorFirst"
              value={names.initiatorFirst}
              required
              {...invalidProps(STAGE_ONE_FIELDS.initiatorFirst, problems)}
              onChange={setPart("initiatorFirst")}
              className={INPUT_CLASSES}
            />
            <FieldProblem field={STAGE_ONE_FIELDS.initiatorFirst} problems={problems} />
          </label>
          <label
            className="grid min-w-0 gap-1 text-sm"
            htmlFor="create-initiator-last"
            data-field="initiator-last"
          >
            <span className={LABEL_CLASSES}>
              {copy.initiatorLastLabel}
              <RequiredMark note={copy.requiredNote} />
            </span>
            <input
              id="create-initiator-last"
              name="initiatorLast"
              value={names.initiatorLast}
              placeholder={copy.initiatorLastPlaceholder}
              required
              {...invalidProps(STAGE_ONE_FIELDS.initiatorLast, problems)}
              onChange={setPart("initiatorLast")}
              className={INPUT_CLASSES}
            />
            <FieldProblem field={STAGE_ONE_FIELDS.initiatorLast} problems={problems} />
          </label>
        </div>
        <span className={HELP_CLASSES}>{copy.initiatorHelp}</span>
      </div>

      {/* 3 — the Counterparty: first name required, last name the one optional half. */}
      <div className="grid min-w-0 gap-3 sm:col-span-6" data-pair="counterparty">
        <div className="grid min-w-0 grid-cols-1 gap-3 min-[720px]:grid-cols-2">
          <label
            className="grid min-w-0 gap-1 text-sm"
            htmlFor="create-counterparty-first"
            data-field="counterparty-first"
          >
            <span className={LABEL_CLASSES}>
              {copy.counterpartyFirstLabel}
              <RequiredMark note={copy.requiredNote} />
            </span>
            <input
              id="create-counterparty-first"
              name="counterpartyFirst"
              value={names.counterpartyFirst}
              placeholder={copy.counterpartyFirstPlaceholder}
              required
              {...invalidProps(STAGE_ONE_FIELDS.counterpartyFirst, problems)}
              onChange={setPart("counterpartyFirst")}
              className={INPUT_CLASSES}
            />
            <FieldProblem field={STAGE_ONE_FIELDS.counterpartyFirst} problems={problems} />
          </label>
          <label
            className="grid min-w-0 gap-1 text-sm"
            htmlFor="create-counterparty-last"
            data-field="counterparty-last"
          >
            <span className={LABEL_CLASSES}>{copy.counterpartyLastLabel}</span>
            <input
              id="create-counterparty-last"
              name="counterpartyLast"
              value={names.counterpartyLast}
              placeholder={copy.counterpartyLastPlaceholder}
              onChange={setPart("counterpartyLast")}
              className={INPUT_CLASSES}
            />
          </label>
        </div>
        <span className={HELP_CLASSES}>{copy.counterpartyHelp}</span>
      </div>

      {/* 4 — the invitation address, beside the Counterparty pair. */}
      <label className="grid gap-1 text-sm sm:col-span-6" htmlFor="create-email" data-field="email">
        <span className={LABEL_CLASSES}>
          {copy.emailLabel}
          <RequiredMark note={copy.requiredNote} />
        </span>
        <input
          id="create-email"
          name="email"
          type="email"
          defaultValue={values.email}
          placeholder={copy.emailPlaceholder}
          required
          {...invalidProps(STAGE_ONE_FIELDS.email, problems)}
          className={INPUT_CLASSES}
        />
        <FieldProblem field={STAGE_ONE_FIELDS.email} problems={problems} />
      </label>

      {/* 5 — the description closes the form, full width, defaulted from the template. */}
      <label
        className="grid gap-1 text-sm sm:col-span-12"
        htmlFor="create-description"
        data-field="description"
      >
        <span className={LABEL_CLASSES}>{copy.descriptionLabel}</span>
        <textarea
          id="create-description"
          name="description"
          rows={3}
          defaultValue={values.description === "" ? descriptionDefault : values.description}
          placeholder={copy.descriptionPlaceholder}
          className={INPUT_CLASSES}
        />
        <span className={HELP_CLASSES}>{copy.descriptionHelp}</span>
      </label>
    </div>
  );
}
