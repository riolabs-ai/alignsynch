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
 * post in the browser before `whoDraft()` ever sees it. Both marks cover the same five fields.
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

export function StageOneFields({
  copy,
  values,
  descriptionDefault,
}: {
  copy: StageOneCopy;
  values: StageOneValues;
  /** The template's own summary — the description's default, never a second fixture. */
  descriptionDefault: string;
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
          onChange={(event) => {
            setTitle(event.target.value);
            setTitleTouched(true);
          }}
          className={INPUT_CLASSES}
        />
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
              onChange={setPart("initiatorFirst")}
              className={INPUT_CLASSES}
            />
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
              onChange={setPart("initiatorLast")}
              className={INPUT_CLASSES}
            />
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
              onChange={setPart("counterpartyFirst")}
              className={INPUT_CLASSES}
            />
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
          className={INPUT_CLASSES}
        />
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
