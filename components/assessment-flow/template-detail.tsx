/**
 * template-ancestor: components/identity/account-home.tsx   (variation: one template, read-only — a header band then the Aspect cards, with open and duplicate actions)
 *
 * `/assessment/templates/[templateId]` — one template, read-only (#console 5/5).
 *
 * "Open" has to open something, and the spec keeps template *editing* for a later card: the
 * editor will extend this route, not replace it (`console-ia.md` §3.6). So this page reads: the
 * template's Aspects in their authored order, each with its Left and Right Value, the counts, and
 * whether it is archived. There is no field, no submit and no write on this page at all — the two
 * writes it can trigger (duplicate, archive) are the same POST endpoints the list uses, and they
 * are drawn here only because a person who opened a template is the person most likely to want
 * them.
 *
 * The archived state is drawn as a band, not as a hidden control: an archived template still
 * opens, because its instances copied their Aspects at creation and nothing joins back to it.
 * That sentence is the answer to "what does archiving do to an instance already made", and it
 * belongs on the page where the question is asked.
 */
import type { PageCopy } from "@/content/pages";
import { formatDate } from "@/content/core";
import type { LibraryTemplateDetail } from "@/lib/db/template-library";
import {
  ASSESSMENTS_PATH,
  TEMPLATE_LIBRARY_PATH,
  templateDuplicatePath,
  templateStatusPath,
} from "@/lib/flow/paths";
import { itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";

const CARD = "rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900";
const MUTED = "text-sm text-gray-600 dark:text-gray-300";

export function TemplateDetail({
  copy,
  detail,
}: {
  copy: PageCopy;
  detail: LibraryTemplateDetail;
}) {
  const { template, aspects } = detail;
  const back = sectionOf(copy, "back");
  const facts = sectionOf(copy, "facts");
  const aspectsSection = sectionOf(copy, "aspects");
  const actions = sectionOf(copy, "actions");
  const archived = sectionOf(copy, "archive-note");

  const archivedTemplate = template.status === "archived";

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <p className="mb-4 text-sm">
        <a className="underline" href={TEMPLATE_LIBRARY_PATH}>
          {itemLabel(back, "all")}
        </a>
      </p>

      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {copy.heading}
      </p>
      <h1 className="mt-1 text-3xl font-bold text-gray-900 dark:text-gray-100">{template.title}</h1>
      <p className={`mt-2 ${MUTED}`}>{template.summary}</p>
      <p className="mt-3 flex flex-wrap gap-2 text-xs">
        <span
          data-template-detail-authorship={template.authorship}
          className="rounded-md border border-gray-300 px-2 py-1 dark:border-gray-600"
        >
          {itemLabel(
            facts,
            template.authorship === "mine" ? "authorship-mine" : "authorship-built-in",
          )}
        </span>
        <span
          data-template-detail-status={template.status}
          className="rounded-md border border-gray-300 px-2 py-1 dark:border-gray-600"
        >
          {itemLabel(facts, archivedTemplate ? "status-archived" : "status-published")}
        </span>
      </p>

      <dl className={`mt-6 grid gap-3 p-5 sm:grid-cols-2 ${CARD}`}>
        <div>
          <dt className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {itemLabel(facts, "aspects")}
          </dt>
          <dd className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {template.aspectCount}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {itemLabel(facts, "instances")}
          </dt>
          <dd className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {template.instanceCount}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {itemLabel(facts, "status")}
          </dt>
          <dd className={MUTED}>
            {itemLabel(facts, archivedTemplate ? "status-archived" : "status-published")}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {itemLabel(facts, "created")}
          </dt>
          <dd className={MUTED}>{formatDate(template.createdAt)}</dd>
        </div>
      </dl>

      <section className="mt-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          {aspectsSection.heading}
        </h2>
        <p className={`mt-2 ${MUTED}`}>{sectionBody(aspectsSection)}</p>

        {aspects.length === 0 ? (
          <p className={`mt-4 ${MUTED}`}>{itemLabel(aspectsSection, "empty")}</p>
        ) : (
          <ol className="mt-4 grid gap-3">
            {aspects.map((aspect) => (
              <li key={aspect.id} data-template-aspect={aspect.id} className={`p-4 ${CARD}`}>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {aspect.prompt}
                </p>
                <p className={`mt-2 ${MUTED}`}>
                  {itemLabel(aspectsSection, "left")}: {aspect.leftValue}
                </p>
                <p className={MUTED}>
                  {itemLabel(aspectsSection, "right")}: {aspect.rightValue}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className={`mt-8 p-5 ${CARD}`} data-template-detail-actions="true">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          {actions.heading}
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
          {archivedTemplate ? null : (
            <a className="underline" href={ASSESSMENTS_PATH}>
              {itemLabel(actions, "start")}
            </a>
          )}

          <form action={templateDuplicatePath(template.id)} method="post">
            <button type="submit" className="underline">
              {itemLabel(actions, "duplicate")}
            </button>
          </form>

          {template.authorship !== "mine" ? null : (
            <form action={templateStatusPath(template.id)} method="post">
              <input
                type="hidden"
                name="status"
                value={archivedTemplate ? "published" : "archived"}
              />
              <button type="submit" className="underline">
                {itemLabel(actions, archivedTemplate ? "unarchive" : "archive")}
              </button>
            </form>
          )}
        </div>
      </section>

      {archivedTemplate ? (
        <section
          data-template-detail-archived="true"
          className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-5 dark:border-amber-700 dark:bg-amber-950"
        >
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {archived.heading}
          </h2>
          <p className="mt-2 text-sm text-gray-800 dark:text-gray-200">{sectionBody(archived)}</p>
        </section>
      ) : null}
    </div>
  );
}
