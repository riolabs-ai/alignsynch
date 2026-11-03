/**
 * template-ancestor: components/create/quiz-editor.tsx   (variation: a plain POST form of eight blank Aspect rows — no edit, no delete, no reorder)
 *
 * `/assessment/templates/new`'s form: a title and eight Aspect rows (#255).
 *
 * Plain HTML — no `"use client"`, no state, no handler. `action` is the POST-only route handler
 * (`lib/flow/paths.ts`), every field is `name`d for `FormData`, and the browser does the rest, which
 * is also what makes the form postable by `curl` and the acceptance provable in a real browser.
 *
 * **Eight rows, always.** There is no "add an Aspect" button, because adding one needs state and the
 * whole authoring surface is a text form: eight rows are drawn, a person fills in as many as they
 * need, and a row left entirely blank is a row they did not use (`lib/flow/template-draft.ts` skips
 * it). That is also why the count is `MAX_ASPECTS` from the model's module rather than a number
 * typed here — the form and the refusal cannot disagree about the limit.
 *
 * **The refusal is drawn above the form, not instead of it.** A save that failed is a GET of this
 * page with `?problem=<code>`, so the person sees the form they can fix plus one sentence saying
 * what stopped it. The inputs come back empty: the alternative is a round trip that renders what a
 * stranger posted into the page, and the form is eight short fields.
 *
 * The words come from `data/pages/assessment-template-new.ts` (E23); this file holds none.
 */
import type { PageCopy } from "@/content/pages";
import { CREATE_TEMPLATE_PATH } from "@/lib/flow/paths";
import { MAX_ASPECTS } from "@/lib/flow/template-draft";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";

const FIELD =
  "rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950";
const LABEL = "grid gap-1 text-sm";
const LABEL_TEXT = "font-medium text-gray-700 dark:text-gray-200";

export function TemplateForm({
  copy,
  problem,
}: {
  copy: PageCopy;
  /** The fixture's sentence for the refusal that brought the person back; `null` on a clean visit. */
  problem: string | null;
}) {
  const form = sectionOf(copy, "form");
  const problems = sectionOf(copy, "problems");
  const rows = Array.from({ length: MAX_ASPECTS }, (_, index) => index + 1);

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{copy.heading}</h1>
        {copy.subtitle === undefined ? null : (
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{copy.subtitle}</p>
        )}
      </header>

      {problem === null ? null : (
        <div
          data-template-problem="true"
          role="alert"
          className="mb-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-gray-800 dark:border-amber-700 dark:bg-amber-950 dark:text-gray-200"
        >
          <p className="font-semibold">{problems.heading}</p>
          <p className="mt-1">{problem}</p>
        </div>
      )}

      <form action={CREATE_TEMPLATE_PATH} method="post" className="grid gap-6">
        <section className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{form.heading}</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{sectionBody(form)}</p>

          <label className={`${LABEL} mt-4`} htmlFor="template-title">
            <span className={LABEL_TEXT}>{itemLabel(form, "title")}</span>
            <input
              id="template-title"
              name="title"
              required
              placeholder={itemLabel(form, "title-placeholder")}
              className={FIELD}
            />
          </label>
        </section>

        <section className="grid gap-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {itemLabel(form, "aspects-heading")}
          </h2>

          {rows.map((number) => (
            <fieldset
              key={number}
              data-aspect={number}
              className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900"
            >
              <legend className="px-1 text-sm font-semibold text-gray-900 dark:text-gray-100">
                {fillLabel(itemLabel(form, "aspect"), { number })}
              </legend>

              <label className={`${LABEL} mt-2`} htmlFor={`aspect-${number}-prompt`}>
                <span className={LABEL_TEXT}>{itemLabel(form, "prompt")}</span>
                <input
                  id={`aspect-${number}-prompt`}
                  name={`aspect-${number}-prompt`}
                  placeholder={itemLabel(form, "prompt-placeholder")}
                  className={FIELD}
                />
              </label>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className={LABEL} htmlFor={`aspect-${number}-leftValue`}>
                  <span className={LABEL_TEXT}>{itemLabel(form, "left-value")}</span>
                  <input
                    id={`aspect-${number}-leftValue`}
                    name={`aspect-${number}-leftValue`}
                    placeholder={itemLabel(form, "left-placeholder")}
                    className={FIELD}
                  />
                </label>

                <label className={LABEL} htmlFor={`aspect-${number}-rightValue`}>
                  <span className={LABEL_TEXT}>{itemLabel(form, "right-value")}</span>
                  <input
                    id={`aspect-${number}-rightValue`}
                    name={`aspect-${number}-rightValue`}
                    placeholder={itemLabel(form, "right-placeholder")}
                    className={FIELD}
                  />
                </label>
              </div>
            </fieldset>
          ))}

          <button
            type="submit"
            className="justify-self-start rounded-md bg-action px-4 py-2 text-sm font-semibold text-action-foreground hover:bg-action/90"
          >
            {itemLabel(form, "submit")}
          </button>
        </section>
      </form>

      <section className="mt-10 grid gap-6 text-sm text-gray-600 dark:text-gray-300">
        {(["scale", "copy-note"] as const).map((id) => {
          const section = sectionOf(copy, id);
          return (
            <div key={id}>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {section.heading}
              </h2>
              <p className="mt-1">{sectionBody(section)}</p>
            </div>
          );
        })}
      </section>
    </div>
  );
}
