/**
 * template-ancestor: components/v1/create-relationship-form.tsx   (variation: a server component on the app's own route, with the write not wired — the form's layout and both decisions are real, the submit is disabled and says why)
 *
 * `CreateRelationship` — the create step shipped as **in-progress UI** (#409, R1-E).
 *
 * The v1 create form's shape, in the order a person decides: the template and its two seats at
 * the top, the counterparty, then the two choices that shape everything after creation. What it
 * is **not** is a working create: the card this file belongs to ships the screen without the
 * write, so the submit is disabled and the sentence beside it says so. That is the difference
 * between in-progress UI and a convincing lie — a form that looked ready and did nothing would
 * be the defect, not the design.
 *
 * The form carries **no `action`** for the same reason: there is no destination this screen is
 * allowed to reach yet, and a real endpoint behind a disabled button is one HTML edit away from
 * a write nobody decided on. When the write path ships, the action and the removal of `disabled`
 * are the whole change.
 *
 * **Two decisions, stated differently, because they behave differently.**
 *
 *   Mode     fixed at creation. Both parties answer one shape; a sheet that could switch would
 *            let one party answer Basic and the other Advanced on one relationship.
 *   Setting  the one thing a party may change later. It moves the bar the report is judged
 *            against (`SETTING_DEFINITIONS`) and changes no question.
 *
 * Neither is pre-selected: a default would be this form choosing a bar for two people who never
 * saw the question, and the Mode is too consequential to inherit from a designer's taste.
 *
 * Literal-free: every word is `data/pages/assessment-create.ts` (E23), except the two vocabulary
 * sets the model authors once — `MODE_LABELS` and `SETTING_LABELS`/`SETTING_DEFINITIONS`.
 */
import Link from "next/link";
import {
  ALIGNMENT_SETTINGS,
  ASSESSMENT_MODES,
  MODE_LABELS,
  SETTING_DEFINITIONS,
  SETTING_LABELS,
} from "@/content/assessment";
import type { PageCopy } from "@/content/pages";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";

/** The template being copied, as much of it as this screen prints. */
export interface CreateTemplate {
  readonly title: string;
  readonly summary: string;
  readonly aspectCount: number;
}

export function CreateRelationship({
  copy,
  template,
  backHref,
}: {
  copy: PageCopy;
  template: CreateTemplate;
  backHref: string;
}) {
  const band = sectionOf(copy, "template");
  const form = sectionOf(copy, "form");
  const noteId = "create-not-wired";

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-8">
      <p>
        <Link href={backHref} className="text-sm font-medium text-action hover:underline">
          {itemLabel(band, "back")}
        </Link>
      </p>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-100">
          {copy.heading}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-600 dark:text-gray-300">{copy.subtitle}</p>
      </div>

      {/* What is being copied — its name, its words and its size, all from the record. */}
      <section
        aria-labelledby="create-template-heading"
        className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
      >
        <h2
          id="create-template-heading"
          className="text-lg font-semibold text-gray-900 dark:text-gray-100"
        >
          {band.heading}
        </h2>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{sectionBody(band)}</p>
        <div className="mt-3 rounded-md border border-gray-200 px-3 py-2.5 dark:border-gray-700">
          <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {template.title}
          </p>
          <p className="mt-0.5 text-sm text-gray-600 dark:text-gray-300">{template.summary}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {fillLabel(itemLabel(band, "aspects"), { count: template.aspectCount })}
          </p>
        </div>
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{itemLabel(band, "seats")}</p>
      </section>

      <form
        aria-labelledby="create-form-heading"
        className="space-y-5 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
      >
        <h2
          id="create-form-heading"
          className="text-lg font-semibold text-gray-900 dark:text-gray-100"
        >
          {form.heading}
        </h2>

        <label className="grid gap-1 text-sm" htmlFor="create-initiator-name">
          <span className="font-medium text-gray-700 dark:text-gray-200">
            {itemLabel(form, "initiator-label")}
          </span>
          <input
            id="create-initiator-name"
            name="initiatorName"
            className="rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-950"
          />
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {itemLabel(form, "initiator-help")}
          </span>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm" htmlFor="create-counterparty-name">
            <span className="font-medium text-gray-700 dark:text-gray-200">
              {itemLabel(form, "counterparty-label")}
            </span>
            <input
              id="create-counterparty-name"
              name="counterpartyName"
              placeholder={itemLabel(form, "counterparty-placeholder")}
              className="rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-950"
            />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {itemLabel(form, "counterparty-help")}
            </span>
          </label>

          <label className="grid gap-1 text-sm" htmlFor="create-email">
            <span className="font-medium text-gray-700 dark:text-gray-200">
              {itemLabel(form, "email-label")}
            </span>
            <input
              id="create-email"
              name="email"
              type="email"
              placeholder={itemLabel(form, "email-placeholder")}
              className="rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-950"
            />
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {itemLabel(form, "email-help")}
            </span>
          </label>
        </div>

        {/* Mode — fixed at creation, and said so on the form. */}
        <fieldset className="grid gap-2 text-sm">
          <legend className="font-medium text-gray-700 dark:text-gray-200">
            {itemLabel(form, "mode-label")}
          </legend>
          {ASSESSMENT_MODES.map((mode) => (
            <label
              key={mode}
              className="flex items-start gap-2 rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700"
            >
              <input type="radio" name="mode" value={mode} className="mt-1" />
              <span>
                <span className="font-medium text-gray-800 dark:text-gray-100">
                  {MODE_LABELS[mode]}
                </span>
                <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                  {mode === "basic"
                    ? itemLabel(form, "mode-basic-help")
                    : itemLabel(form, "mode-advanced-help")}
                </span>
              </span>
            </label>
          ))}
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {itemLabel(form, "mode-fixed")}
          </p>
        </fieldset>

        {/* Setting — the bar the report is judged against, and the one choice a party may change. */}
        <fieldset className="grid gap-2 text-sm">
          <legend className="font-medium text-gray-700 dark:text-gray-200">
            {itemLabel(form, "setting-label")}
          </legend>
          {ALIGNMENT_SETTINGS.map((setting) => (
            <label
              key={setting}
              className="flex items-start gap-2 rounded-md border border-gray-200 px-3 py-2 dark:border-gray-700"
            >
              <input type="radio" name="alignmentSetting" value={setting} className="mt-1" />
              <span>
                <span className="font-medium text-gray-800 dark:text-gray-100">
                  {SETTING_LABELS[setting]}
                </span>
                <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                  {SETTING_DEFINITIONS[setting]}
                </span>
              </span>
            </label>
          ))}
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {itemLabel(form, "setting-changeable")}
          </p>
        </fieldset>

        {/* The point of action: the control, disabled, with its reason beside it. */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <button
            type="submit"
            disabled
            aria-describedby={noteId}
            className="rounded-md bg-action px-4 py-2 text-sm font-semibold text-action-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {itemLabel(form, "submit")}
          </button>
          <p id={noteId} className="text-xs text-gray-600 dark:text-gray-300">
            {itemLabel(form, "not-wired")}
          </p>
        </div>
      </form>
    </div>
  );
}
