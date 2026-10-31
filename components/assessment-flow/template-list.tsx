/**
 * `/assessment`'s list: the published templates, each with its own create form (#146).
 *
 * One form per template rather than a template picker plus one form: the template is the
 * thing being copied, so it belongs in the form's own payload (`templateRecordId`) and a
 * submit cannot be posted against the wrong one.
 *
 * Plain HTML forms — no `"use client"`, no handler, no state. `action` is the POST-only
 * route handler (`lib/flow/paths.ts`), the fields are `name`d for `FormData`, and the
 * browser does the rest. That is also what makes the flow testable with `curl` and with two
 * plain browser sessions, which is the acceptance's dogfood.
 *
 * The words come from `data/pages/assessment.ts` (E23); this file holds none.
 */
import type { PageCopy } from "@/content/pages";
import { ASSESSMENT_MODES } from "@/content/assessment";
import { itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";
import { CREATE_INSTANCE_PATH } from "@/lib/flow/paths";
import type { TemplateSummary } from "@/lib/flow/store";

export function TemplateList({
  copy,
  templates,
}: {
  copy: PageCopy;
  templates: readonly TemplateSummary[];
}) {
  const create = sectionOf(copy, "create");
  const list = sectionOf(copy, "templates");

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{copy.heading}</h1>
        {copy.subtitle === undefined ? null : (
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{copy.subtitle}</p>
        )}
      </header>

      <p className="mb-6 rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
        {sectionBody(create)}
      </p>

      <section className="space-y-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{list.heading}</h2>

        {templates.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {sectionBody(sectionOf(copy, "empty"))}
          </p>
        ) : (
          templates.map((template) => (
            <article
              key={template.id}
              data-template={template.id}
              className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900"
            >
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {template.title}
              </h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{template.summary}</p>

              <form action={CREATE_INSTANCE_PATH} method="post" className="mt-4 grid gap-3">
                <input type="hidden" name="templateRecordId" value={template.id} />

                {/* The mode is chosen **here**, when the instance is created (#213): it belongs
                    to the play, and the answer sheet never offers a way to change it. Basic is
                    ticked because it is what the flow asked before modes existed. */}
                <fieldset className="grid gap-1 text-sm">
                  <legend className="font-medium text-gray-700 dark:text-gray-200">
                    {itemLabel(create, "mode-label")}
                  </legend>
                  {ASSESSMENT_MODES.map((mode) => (
                    <label key={mode} className="inline-flex items-center gap-2">
                      <input
                        type="radio"
                        name="mode"
                        value={mode}
                        defaultChecked={mode === "basic"}
                      />
                      <span>
                        {itemLabel(create, mode === "basic" ? "mode-basic" : "mode-advanced")}
                      </span>
                    </label>
                  ))}
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {itemLabel(create, "mode-help")}
                  </p>
                </fieldset>

                <label className="grid gap-1 text-sm" htmlFor={`initiator-name-${template.id}`}>
                  <span className="font-medium text-gray-700 dark:text-gray-200">
                    {itemLabel(create, "initiator-name")}
                  </span>
                  <input
                    id={`initiator-name-${template.id}`}
                    name="initiatorName"
                    required
                    placeholder={itemLabel(create, "initiator-placeholder")}
                    className="rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-950"
                  />
                </label>

                <label className="grid gap-1 text-sm" htmlFor={`counterparty-name-${template.id}`}>
                  <span className="font-medium text-gray-700 dark:text-gray-200">
                    {itemLabel(create, "counterparty-name")}
                  </span>
                  <input
                    id={`counterparty-name-${template.id}`}
                    name="counterpartyName"
                    required
                    placeholder={itemLabel(create, "counterparty-placeholder")}
                    className="rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-950"
                  />
                </label>

                <label className="grid gap-1 text-sm" htmlFor={`email-${template.id}`}>
                  <span className="font-medium text-gray-700 dark:text-gray-200">
                    {itemLabel(create, "email")}
                  </span>
                  <input
                    id={`email-${template.id}`}
                    name="email"
                    type="email"
                    required
                    placeholder={itemLabel(create, "email-placeholder")}
                    className="rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-950"
                  />
                </label>

                <button
                  type="submit"
                  className="justify-self-start rounded-md bg-action px-4 py-2 text-sm font-semibold text-action-foreground hover:bg-action/90"
                >
                  {itemLabel(create, "submit")}
                </button>
              </form>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
