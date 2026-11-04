/**
 * template-ancestor: components/explore/explore-quiz-list.tsx   (variation: Postgres template records grouped by the type each names, every action a plain POST form)
 *
 * `/assessment/templates` — the template library (#console 5/5, reshaped by #409).
 *
 * A server component with no state and no handler: the page above it resolved the session, read
 * the rows and applied the tab/status/search, and this file decides only how a card reads and
 * what a card may do. The words are `data/pages/assessment-templates.ts` (E23, budget 0); this
 * file holds none.
 *
 * **What this screen is a variation of.** Two ancestors, one citation each:
 *
 *   the catalogue grid, grouped `Business · Personal`, one shared card   components/v1/v1-template-library.tsx
 *   the tab row, the search field, the status filter, the per-row forms  components/my-quizzes/my-quizzes.tsx
 *
 * The **card** is not this file's: it is `TemplateCard` in `template-list.tsx`, shared with
 * `/assessment`'s picker. Two surfaces, one record shape, one card — the v1 library made the same
 * call when it gave the public catalogue and the dashboard the same `RelationshipTypeCard`.
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
import { formatCurrency, formatDate } from "@/content/core";
import { TEMPLATE_LIBRARY_PATH, templateDuplicatePath, templateStatusPath } from "@/lib/flow/paths";
import { fillLabel, itemLabel, sectionBody, sectionOf } from "@/lib/page-copy";
import {
  TemplateCatalogueGrid,
  templateGroupsOf,
  type CatalogueCardCopy,
  type TemplateGroupId,
} from "./template-card";

const CARD = "rounded-lg border border-border bg-card";
const MUTED = "text-sm text-muted-foreground";
const STRONG = "font-semibold text-foreground";

/**
 * The card's words, out of **this** route's fixture.
 *
 * Written here rather than shared with `/assessment`'s picker because E23 resolves every
 * `itemLabel` id against the fixture of the route whose page renders the file: a shared builder
 * would demand one vocabulary in both `data/pages/assessment.ts` and
 * `data/pages/assessment-templates.ts`, which are two surfaces' own words. The card itself —
 * `template-card.tsx` — takes the resolved strings and knows neither fixture.
 */
function cardCopyOf(copy: PageCopy): CatalogueCardCopy {
  const card = sectionOf(copy, "card");
  return {
    viewDetails: itemLabel(card, "view-details"),
    unnamedType: itemLabel(card, "unnamed-type"),
    rolesOf: (type) =>
      fillLabel(itemLabel(card, "roles"), {
        initiator: type.roles.initiator,
        counterparty: type.roles.counterparty,
      }),
    aspectsOf: (count) => fillLabel(itemLabel(card, "aspects"), { count }),
    priceLabel: itemLabel(card, "price-label"),
    priceOf: (plan, cents) =>
      fillLabel(itemLabel(card, "price"), { plan, price: formatCurrency(cents) }),
    useTemplate: itemLabel(card, "use"),
    seeExample: itemLabel(card, "see-example"),
  };
}

/**
 * The group headings, out of this route's fixture — with one exception.
 *
 * A realm's heading is the realm itself: `realm` is a field of the taxonomy (`REALMS`), so a
 * second authored spelling of "Office" in a copy fixture would be the drift this tree keeps
 * deleting. Only `other` — templates whose own words name no type — has words of its own.
 */
function groupLabelOf(copy: PageCopy): (id: TemplateGroupId) => string {
  const groups = sectionOf(copy, "groups");
  return (id) => (id === "other" ? itemLabel(groups, "other") : id);
}

/** The notice a write leaves behind, resolved by the page against the list it just read. */
export interface LibraryNotice {
  /** Which band of the fixture's `notice` section is the sentence. */
  readonly id: "archived" | "unarchived" | "duplicated" | "refused" | "missing";
  /** The template the notice is about, or `null` for `refused` / `missing`. */
  readonly title: string | null;
}

/** One link in the tab or status row: the query it asks for and whether it is the current one. */
function filterHref(
  filter: {
    view: LibraryView;
    status: LibraryStatus;
    query: string;
    realm: TemplateGroupId | null;
  },
  change: { view?: LibraryView; status?: LibraryStatus; realm?: TemplateGroupId | null },
): string {
  const params = new URLSearchParams();
  const view = change.view ?? filter.view;
  const status = change.status ?? filter.status;
  // `"realm" in change` rather than `??`: clearing the realm is a change to `null`, and `??`
  // would read that as "not asked" and keep the filter on.
  const realm = "realm" in change ? (change.realm ?? null) : filter.realm;
  if (view !== "all") params.set("view", view);
  if (status !== "all") params.set("status", status);
  if (realm !== null) params.set("realm", realm);
  if (filter.query !== "") params.set("q", filter.query);
  const query = params.toString();
  return query === "" ? TEMPLATE_LIBRARY_PATH : `${TEMPLATE_LIBRARY_PATH}?${query}`;
}

export function TemplateLibrary({
  copy,
  shown,
  state,
  filter,
  counts,
  notice,
  unreadable,
}: {
  copy: PageCopy;
  /** The rows after the tab, the status filter, the realm and the search. */
  shown: readonly LibraryTemplate[];
  /** `empty` when the account may use no template at all, `no-match` when only the filter is. */
  state: LibraryState;
  filter: {
    view: LibraryView;
    status: LibraryStatus;
    query: string;
    realm: TemplateGroupId | null;
  };
  /**
   * How many cards each realm holds, from the rows the tab and status left — the count beside a
   * realm's name, so a person choosing a realm sees how many it will show before they click it.
   */
  counts: readonly { readonly id: TemplateGroupId; readonly count: number }[];
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
          <h1 className="text-2xl font-bold text-foreground">{failure.heading}</h1>
          <p className="mt-2 text-sm text-foreground">{sectionBody(failure)}</p>
          <p className="mt-2 text-sm text-foreground">{unreadable}</p>
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
  const realms = sectionOf(copy, "realms");
  const search = sectionOf(copy, "search");
  const row = sectionOf(copy, "row");
  const legacy = sectionOf(copy, "legacy");
  const create = sectionOf(copy, "create");
  const empty = sectionOf(copy, "empty");
  const noMatch = sectionOf(copy, "no-match");
  const notices = sectionOf(copy, "notice");
  /**
   * The cards the tab and the status left, before the realm narrows them — the `of` in
   * "showing 10 of 28". A sum of the realm counts the same rows, so it cannot disagree with the
   * filter row above it.
   */
  const total = counts.reduce((sum, entry) => sum + entry.count, 0);

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
    <div className="container mx-auto max-w-5xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">{copy.heading}</h1>
        {copy.subtitle === undefined ? null : <p className={`mt-3 ${MUTED}`}>{copy.subtitle}</p>}
      </header>

      {notice === null ? null : (
        <div
          data-template-library-notice={notice.id}
          role="status"
          className={`mb-6 p-4 text-sm text-foreground ${CARD}`}
        >
          {fillLabel(itemLabel(notices, notice.id), { title: notice.title ?? "" })}
        </div>
      )}

      <section className="mb-6">
        <h2 className="text-xl font-semibold text-foreground">{list.heading}</h2>
        <p className={`mt-2 ${MUTED}`}>{sectionBody(list)}</p>
        {/*
         * How many cards this screen is showing, out of how many the tab and status left. It is
         * the count a filter has to move: choosing `Home` changes the number in this sentence,
         * which is what a person checks before believing the filter did anything.
         */}
        <p className="mt-2 text-sm font-medium text-foreground" data-template-count={shown.length}>
          {filter.realm === null
            ? fillLabel(itemLabel(list, "count"), { shown: shown.length, total })
            : fillLabel(itemLabel(list, "count-realm"), {
                shown: shown.length,
                total,
                realm:
                  filter.realm === "other"
                    ? itemLabel(sectionOf(copy, "groups"), "other")
                    : filter.realm,
              })}
        </p>
      </section>

      <div className="mb-6 grid gap-3">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
                    : "rounded-md border border-border px-3 py-1.5 text-sm"
                }
              >
                {itemLabel(tabs, tab.id)}
              </a>
            ))}
          </nav>
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
                    : "rounded-md border border-border px-3 py-1.5 text-sm"
                }
              >
                {itemLabel(statuses, entry.id)}
              </a>
            ))}
          </nav>
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {realms.heading}
          </p>
          {/*
           * The realm filter, as plain links: 27 types across seven realms do not fit on one
           * screen's worth of scanning, and a filter that is a URL is a page `curl` can ask for.
           * The count is in the label because it is the fact a person is choosing on — "Home 10"
           * says what the click will show without a second read of the same screen.
           */}
          <nav className="flex flex-wrap gap-2" aria-label={realms.heading}>
            <a
              href={filterHref(filter, { realm: null })}
              data-template-realm-filter="all"
              data-template-realm-count={total}
              aria-current={filter.realm === null ? "page" : undefined}
              className={
                filter.realm === null
                  ? "rounded-md bg-action px-3 py-1.5 text-sm font-semibold text-action-foreground"
                  : "rounded-md border border-border px-3 py-1.5 text-sm"
              }
            >
              {itemLabel(realms, "all")}
              <span className="ml-1.5 text-xs opacity-70">{total}</span>
            </a>
            {counts.map((entry) => (
              <a
                key={entry.id}
                href={filterHref(filter, { realm: entry.id })}
                data-template-realm-filter={entry.id}
                data-template-realm-count={entry.count}
                aria-current={filter.realm === entry.id ? "page" : undefined}
                className={
                  filter.realm === entry.id
                    ? "rounded-md bg-action px-3 py-1.5 text-sm font-semibold text-action-foreground"
                    : "rounded-md border border-border px-3 py-1.5 text-sm"
                }
              >
                {entry.id === "other" ? itemLabel(sectionOf(copy, "groups"), "other") : entry.id}
                <span className="ml-1.5 text-xs opacity-70">{entry.count}</span>
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
          {filter.realm === null ? null : <input type="hidden" name="realm" value={filter.realm} />}
          <label className="grid gap-1 text-sm" htmlFor="template-search">
            <span className="font-medium text-foreground">{itemLabel(search, "label")}</span>
            <input
              id="template-search"
              name="q"
              defaultValue={filter.query}
              placeholder={itemLabel(search, "placeholder")}
              className="rounded-md border border-border bg-background px-3 py-2"
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-action px-4 py-2 text-sm font-semibold text-action-foreground hover:bg-action-hover"
          >
            {itemLabel(search, "submit")}
          </button>
          {filter.query === "" ? null : (
            <a
              className="text-sm text-foreground underline"
              href={filterHref({ ...filter, query: "" }, {})}
            >
              {itemLabel(search, "clear")}
            </a>
          )}
        </form>
      </div>

      {state === "empty" ? (
        <section data-template-library-empty="true" className={`p-6 ${CARD}`}>
          <h2 className="text-lg font-semibold text-foreground">{empty.heading}</h2>
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
          <h2 className="text-lg font-semibold text-foreground">{noMatch.heading}</h2>
          <p className={`mt-2 ${MUTED}`}>{sectionBody(noMatch)}</p>
        </section>
      ) : (
        <TemplateCatalogueGrid
          copy={cardCopyOf(copy)}
          groups={templateGroupsOf(shown)}
          groupLabelOf={groupLabelOf(copy)}
          actionsOf={(template) => (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              {/*
               * The card's own controls, in the card's action row rather than in a second block
               * under it: 27 cards each carrying a stacked admin stanza is what made this page a
               * wall. `Duplicate` is always offered (a built-in can be copied, never archived);
               * the status and the instance count appear only when they say something — an
               * archived row, or a template somebody has actually used — and a creation date is
               * shown only for the account's own record, because "published on the platform's
               * day" repeated 27 times is not a fact about the template.
               */}
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

              {template.status === "archived" ? (
                <span className={`${STRONG} text-xs`} data-template-status={template.status}>
                  {itemLabel(row, "status-archived")}
                </span>
              ) : null}

              {template.instanceCount > 0 ? (
                <span
                  className={`${MUTED} text-xs`}
                  data-template-instances={template.instanceCount}
                >
                  {fillLabel(itemLabel(row, "instances"), { count: template.instanceCount })}
                </span>
              ) : null}

              {template.authorship === "mine" ? (
                <span className={`${MUTED} text-xs`}>
                  {fillLabel(itemLabel(row, "created"), {
                    date: formatDate(template.createdAt),
                  })}
                </span>
              ) : null}
            </div>
          )}
        />
      )}

      <section className={`mt-8 p-5 ${CARD}`} data-template-library-legacy="true">
        <h2 className="text-base font-semibold text-foreground">{legacy.heading}</h2>
        <p className={`mt-2 ${MUTED}`}>{sectionBody(legacy)}</p>
      </section>

      <section className={`mt-6 p-5 ${CARD}`} data-template-library-create="true">
        <h2 className="text-base font-semibold text-foreground">{create.heading}</h2>
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
  filter: {
    view: LibraryView;
    status: LibraryStatus;
    query: string;
    realm: TemplateGroupId | null;
  };
}) {
  return (
    <>
      {filter.view === "all" ? null : <input type="hidden" name="view" value={filter.view} />}
      {filter.status === "all" ? null : (
        <input type="hidden" name="status-filter" value={filter.status} />
      )}
      {/* The realm the person was looking at, so an action lands back on the same shelf. */}
      {filter.realm === null ? null : <input type="hidden" name="realm" value={filter.realm} />}
      {filter.query === "" ? null : <input type="hidden" name="q" value={filter.query} />}
    </>
  );
}
