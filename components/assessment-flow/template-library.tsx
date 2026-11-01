/**
 * template-ancestor: components/my-quizzes/my-quizzes.tsx   (variation: tabs, status and search in the URL over one list page, rows instead of a card grid)
 *
 * `/assessment/templates` — the template library (#console 5/5).
 *
 * A server component with no state and no handler: the page above it resolved the session, read
 * the rows and applied the tab/status/search, and this file decides only how a row reads and what
 * a row may do. The words are `data/pages/assessment-templates.ts` (E23, budget 0); this file
 * holds none of them.
 *
 * **What this screen is a variation of.** The console spec points at
 * `components/my-quizzes/my-quizzes.tsx` — tabs, search, grid-or-list, a per-row dropdown — and
 * that component is where the *pattern* comes from: the tab row is `Tabs`, the search box is a
 * plain `<input>`, and the row actions sit at the end of the row. The **base** is
 * `components/assessment-flow/template-list.tsx`, for three reasons: it is the same entity
 * (`TemplateSummary`, a template record read from Postgres), it is a server component over rows
 * the page already read, and it writes down the house rule this screen has to keep — a plain HTML
 * form with a `name`d field per control, so every action is drivable with `curl` and there is no
 * client bundle for a person to download in order to archive their own template.
 * `my-quizzes.tsx` is a `"use client"` mock over `shelfAuthoringCards()`: mounting it would drag a
 * client graph and a fixture projection in to render six rows, and its per-row actions are
 * dropdown items with nowhere to post to. So: the quiz list's shape, the assessment list's
 * plumbing, and the difference named here rather than discovered later.
 *
 * **What a row may offer is decided before it gets here.** `LibraryTemplate.authorship` is
 * `built-in` or `mine` (never `other`: the read excludes those), and only `mine` carries an
 * archive control — a built-in belongs to nobody, and the store refuses the write anyway
 * (`setTemplateStatus`'s own `WHERE`). Duplicate is offered on both, because copying the
 * platform's starting point into your own templates is the whole reason the action exists.
 *
 * **Archived rows are drawn, not hidden.** The status filter defaults to "any", so a person who
 * archived something last week finds it here and can unarchive it; `/assessment` (the catalogue)
 * filters archived out, and that difference is the point of a management screen.
 */
import type {
  LibraryState,
  LibraryStatus,
  LibraryTemplate,
  LibraryView,
} from "@/lib/flow/template-library";
import type { PageCopy } from "@/content/pages";
import { formatDate } from "@/content/core";
import {
  TEMPLATE_LIBRARY_PATH,
  templateDetailPath,
  templateDuplicatePath,
  templateStatusPath,
} from "@/lib/flow/paths";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";

const CARD = "rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900";
const MUTED = "text-sm text-gray-600 dark:text-gray-300";
const STRONG = "font-semibold text-gray-900 dark:text-gray-100";

/** The notice a write leaves behind, resolved by the page against the list it just read. */
export interface LibraryNotice {
  /** Which band of the fixture's `notice` section is the sentence. */
  readonly id: "archived" | "unarchived" | "duplicated" | "refused" | "missing";
  /** The template the notice is about, or `null` for `refused` / `missing`. */
  readonly title: string | null;
}

/** One link in the tab or status row: the query it asks for and whether it is the current one. */
function filterHref(
  filter: { view: LibraryView; status: LibraryStatus; query: string },
  change: { view?: LibraryView; status?: LibraryStatus },
): string {
  const params = new URLSearchParams();
  const view = change.view ?? filter.view;
  const status = change.status ?? filter.status;
  if (view !== "all") params.set("view", view);
  if (status !== "all") params.set("status", status);
  if (filter.query !== "") params.set("q", filter.query);
  const query = params.toString();
  return query === "" ? TEMPLATE_LIBRARY_PATH : `${TEMPLATE_LIBRARY_PATH}?${query}`;
}

export function TemplateLibrary({
  copy,
  shown,
  state,
  filter,
  notice,
  unreadable,
}: {
  copy: PageCopy;
  /** The rows after the tab, the status filter and the search. */
  shown: readonly LibraryTemplate[];
  /** `empty` when the account may use no template at all, `no-match` when only the filter is. */
  state: LibraryState;
  filter: { view: LibraryView; status: LibraryStatus; query: string };
  notice: LibraryNotice | null;
  /** The database layer's sentence when the read did not answer; `null` when it did. */
  unreadable: string | null;
}) {
  if (unreadable !== null) {
    const failure = sectionOf(copy, "unavailable");
    return (
      <div className="container mx-auto max-w-4xl px-4 py-10">
        <div
          data-template-library-unreadable="true"
          role="alert"
          className="rounded-lg border border-amber-300 bg-amber-50 p-6 dark:border-amber-700 dark:bg-amber-950"
        >
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{failure.heading}</h1>
          <p className="mt-2 text-sm text-gray-800 dark:text-gray-200">{sectionBody(failure)}</p>
          <p className="mt-2 text-sm text-gray-800 dark:text-gray-200">{unreadable}</p>
          <p className="mt-3 text-sm">
            <a className="underline" href={TEMPLATE_LIBRARY_PATH}>
              {itemLabel(failure, "reload")}
            </a>
          </p>
        </div>
      </div>
    );
  }

  const list = sectionOf(copy, "list");
  const tabs = sectionOf(copy, "tabs");
  const statuses = sectionOf(copy, "status");
  const search = sectionOf(copy, "search");
  const columns = sectionOf(copy, "columns");
  const row = sectionOf(copy, "row");
  const legacy = sectionOf(copy, "legacy");
  const create = sectionOf(copy, "create");
  const empty = sectionOf(copy, "empty");
  const noMatch = sectionOf(copy, "no-match");
  const notices = sectionOf(copy, "notice");

  const tabRow: ReadonlyArray<{ id: LibraryView }> = [
    { id: "all" },
    { id: "mine" },
    { id: "built-in" },
  ];
  const statusRow: ReadonlyArray<{ id: LibraryStatus }> = [
    { id: "all" },
    { id: "published" },
    { id: "archived" },
  ];

  return (
    <div className="container mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{copy.heading}</h1>
        {copy.subtitle === undefined ? null : <p className={`mt-3 ${MUTED}`}>{copy.subtitle}</p>}
      </header>

      {notice === null ? null : (
        <div
          data-template-library-notice={notice.id}
          role="status"
          className={`mb-6 p-4 text-sm text-gray-700 ${CARD} dark:text-gray-200`}
        >
          {fillLabel(itemLabel(notices, notice.id), { title: notice.title ?? "" })}
        </div>
      )}

      <section className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{list.heading}</h2>
        <p className={`mt-2 ${MUTED}`}>{sectionBody(list)}</p>
      </section>

      <div className="mb-6 grid gap-3">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {tabs.heading}
          </p>
          <nav className="flex flex-wrap gap-2" aria-label={tabs.heading}>
            {tabRow.map((tab) => (
              <a
                key={tab.id}
                href={filterHref(filter, { view: tab.id })}
                data-template-tab={tab.id}
                aria-current={filter.view === tab.id ? "page" : undefined}
                className={
                  filter.view === tab.id
                    ? "rounded-md bg-action px-3 py-1.5 text-sm font-semibold text-action-foreground"
                    : `rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 ${CARD}`
                }
              >
                {itemLabel(tabs, tab.id)}
              </a>
            ))}
          </nav>
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {statuses.heading}
          </p>
          <nav className="flex flex-wrap gap-2" aria-label={statuses.heading}>
            {statusRow.map((entry) => (
              <a
                key={entry.id}
                href={filterHref(filter, { status: entry.id })}
                data-template-status-filter={entry.id}
                aria-current={filter.status === entry.id ? "page" : undefined}
                className={
                  filter.status === entry.id
                    ? "rounded-md bg-action px-3 py-1.5 text-sm font-semibold text-action-foreground"
                    : `rounded-md border border-gray-300 px-3 py-1.5 text-sm dark:border-gray-600 ${CARD}`
                }
              >
                {itemLabel(statuses, entry.id)}
              </a>
            ))}
          </nav>
        </div>

        <form
          action={TEMPLATE_LIBRARY_PATH}
          method="get"
          className="flex flex-wrap items-end gap-2"
        >
          {filter.view === "all" ? null : <input type="hidden" name="view" value={filter.view} />}
          {filter.status === "all" ? null : (
            <input type="hidden" name="status" value={filter.status} />
          )}
          <label className="grid gap-1 text-sm" htmlFor="template-search">
            <span className="font-medium text-gray-700 dark:text-gray-200">
              {itemLabel(search, "label")}
            </span>
            <input
              id="template-search"
              name="q"
              defaultValue={filter.query}
              placeholder={itemLabel(search, "placeholder")}
              className="rounded-md border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-950"
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-action px-4 py-2 text-sm font-semibold text-action-foreground hover:bg-action/90"
          >
            {itemLabel(search, "submit")}
          </button>
          {filter.query === "" ? null : (
            <a
              className="text-sm underline text-gray-700 dark:text-gray-200"
              href={filterHref({ ...filter, query: "" }, {})}
            >
              {itemLabel(search, "clear")}
            </a>
          )}
        </form>
      </div>

      {state === "empty" ? (
        <section data-template-library-empty="true" className={`p-6 ${CARD}`}>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {empty.heading}
          </h2>
          <p className={`mt-2 ${MUTED}`}>{sectionBody(empty)}</p>
          {empty.cta === undefined ? null : (
            <p className="mt-4 text-sm">
              <a className="font-medium text-action underline" href={empty.cta.href}>
                {empty.cta.label}
              </a>
            </p>
          )}
        </section>
      ) : state === "no-match" ? (
        <section data-template-library-no-match="true" className={`p-6 ${CARD}`}>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {noMatch.heading}
          </h2>
          <p className={`mt-2 ${MUTED}`}>{sectionBody(noMatch)}</p>
        </section>
      ) : (
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-700 dark:text-gray-400">
              <th className="py-2 pr-2 font-semibold">{itemLabel(columns, "title")}</th>
              <th className="py-2 pr-2 font-semibold">{itemLabel(columns, "aspects")}</th>
              <th className="py-2 pr-2 font-semibold">{itemLabel(columns, "instances")}</th>
              <th className="py-2 pr-2 font-semibold">{itemLabel(columns, "authorship")}</th>
              <th className="py-2 pr-2 font-semibold">{itemLabel(columns, "status")}</th>
              <th className="py-2 pr-2 font-semibold">{itemLabel(columns, "created")}</th>
              <th className="py-2 font-semibold">{itemLabel(columns, "actions")}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((template) => (
              <tr
                key={template.id}
                data-template-row={template.id}
                data-template-authorship={template.authorship}
                className="border-b border-gray-100 align-top dark:border-gray-800"
              >
                <td className="py-3 pr-2">
                  <a className={`${STRONG} underline`} href={templateDetailPath(template.id)}>
                    {template.title}
                  </a>
                  <p className={MUTED}>{template.summary}</p>
                </td>
                <td className="py-3 pr-2">
                  {fillLabel(itemLabel(row, "aspects"), { count: template.aspectCount })}
                </td>
                <td className="py-3 pr-2">
                  {fillLabel(itemLabel(row, "instances"), { count: template.instanceCount })}
                </td>
                <td className="py-3 pr-2">
                  {itemLabel(
                    row,
                    template.authorship === "mine" ? "authorship-mine" : "authorship-built-in",
                  )}
                </td>
                <td className="py-3 pr-2">
                  {itemLabel(
                    row,
                    template.status === "archived" ? "status-archived" : "status-published",
                  )}
                </td>
                <td className={`py-3 pr-2 ${MUTED}`}>
                  {fillLabel(itemLabel(row, "created"), { date: formatDate(template.createdAt) })}
                </td>
                <td className="py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <a className="underline" href={templateDetailPath(template.id)}>
                      {itemLabel(row, "open")}
                    </a>

                    <form action={templateDuplicatePath(template.id)} method="post">
                      <FilterFields filter={filter} />
                      <button type="submit" className="underline">
                        {itemLabel(row, "duplicate")}
                      </button>
                    </form>

                    {template.authorship !== "mine" ? null : (
                      <form action={templateStatusPath(template.id)} method="post">
                        <FilterFields filter={filter} />
                        <input
                          type="hidden"
                          name="status"
                          value={template.status === "archived" ? "published" : "archived"}
                        />
                        <button type="submit" className="underline">
                          {itemLabel(row, template.status === "archived" ? "unarchive" : "archive")}
                        </button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <section className={`mt-8 p-5 ${CARD}`} data-template-library-legacy="true">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          {legacy.heading}
        </h2>
        <p className={`mt-2 ${MUTED}`}>{sectionBody(legacy)}</p>
      </section>

      <section className={`mt-6 p-5 ${CARD}`} data-template-library-create="true">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          {create.heading}
        </h2>
        <p className={`mt-2 ${MUTED}`}>{sectionBody(create)}</p>
        {create.cta === undefined ? null : (
          <p className="mt-3 text-sm">
            <a className="font-medium text-action underline" href={create.cta.href}>
              {create.cta.label}
            </a>
          </p>
        )}
      </section>
    </div>
  );
}

/**
 * The filter a row action was performed under, carried through the POST so the redirect lands
 * back on the same view.
 *
 * Hidden fields rather than a `return` URL: a URL posted by a browser and then followed would be
 * an open redirect, while three enumerated values can only rebuild the query the person was
 * looking at. The route validates them again (`parseLibraryView` / `parseLibraryStatus`), so a
 * crafted post cannot put anything but a known tab in the redirect.
 */
function FilterFields({
  filter,
}: {
  filter: { view: LibraryView; status: LibraryStatus; query: string };
}) {
  return (
    <>
      {filter.view === "all" ? null : <input type="hidden" name="view" value={filter.view} />}
      {filter.status === "all" ? null : (
        <input type="hidden" name="status-filter" value={filter.status} />
      )}
      {filter.query === "" ? null : <input type="hidden" name="q" value={filter.query} />}
    </>
  );
}
