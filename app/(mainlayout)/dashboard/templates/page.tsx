/**
 * `/dashboard/templates` — one destination, two tabs: **Library | My Templates** (#620, #1130).
 *
 * **The member group's second row used to be three rows** (`My Templates`, `Library`, and the catalogue)
 * and a person had to know which of three doors held what they wanted. This page is the one door.
 * `?tab=library` (the bare path) is the **Library** — what this account can start a relationship from,
 * with a featured band, a category filter, a search and the price of the plan on every card — and
 * `?tab=mine` is **My Templates**, the rows this account owns plus the two ways to start a new one.
 *
 * **Every state of the tab is the URL.** `templatesTabOf()` reads `?tab=`, an unknown value lands on the
 * Library and `?tab=catalogue` (this tab's name before #1130) lands there too, so an old bookmark still
 * opens the shelf it describes. The filter and the search are `?filter=` and `?q=` for the same reason:
 * a `curl` can ask for `?filter=family&q=sibling`, the back button works, and nothing here needs a
 * client bundle — the same rule `/assessment/instances` follows for `?stage=`.
 *
 * **Two reads, and neither takes an id from the request.** `listLibraryTemplates(userId)` is the
 * platform's templates plus this account's, and `listMemberLibrary(userId)` is the rows it owns;
 * `requireRole` resolved the id from the request's own session. A crafted `?tab=` or `?filter=` can
 * change which shelf is drawn and nothing else — the filter is a filing of the rows already read
 * (`data/template-categories.ts`), never a second query.
 *
 * **A read that cannot answer is a panel, not a 500.** `DatabaseUnavailableError` is caught and its
 * reason handed to both tabs; every other failure keeps throwing, because a row that does not satisfy
 * the model is drift the gate exists to catch.
 *
 * `force-dynamic` for the reasons every gated console route carries: per-request session, database
 * reads, and a `pnpm build` that must pass with no `DATABASE_URL`.
 */
import type { Metadata } from "next";
import Link from "next/link";

import { StageColumn } from "@/components/assessment-flow/stage-column";
import { TemplateGallery } from "@/components/dashboard/template-gallery";
import {
  TemplateCategoryFilter,
  TemplateFeaturedBand,
  TemplateSearch,
  TemplateShelf,
  TemplateShelfHeading,
  TemplateShelfNotice,
  TemplateTabs,
} from "@/components/dashboard/template-shelf";
import { dashboardTemplatesPageCopy } from "@/data/pages/dashboard-templates";
import { requireRole } from "@/lib/auth/require-role";
import { DatabaseUnavailableError } from "@/lib/db/client";
import type { LibraryTemplate } from "@/lib/flow/template-library";
import { listLibraryTemplates } from "@/lib/db/template-library";
import { listMemberLibrary, type LibraryRow } from "@/lib/member/library";
import {
  catalogueCard,
  featuredCard,
  featuredTemplateOf,
  libraryFilterOf,
  libraryFilters,
  mineCard,
  searchRowsOf,
  shelfRowsOf,
  templatesTabOf,
  templatesTabPath,
  libraryFilterPath,
} from "@/lib/member/shelf";
import {
  listMyTemplates,
  listClonableTemplates,
  MEMBER_TEMPLATES_PATH,
  type ClonableTemplate,
  type MemberTemplateRow,
} from "@/lib/member/templates";
import { itemLabel, sectionOf } from "@/lib/page-copy";
import { clonePublic, createPrivate } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: dashboardTemplatesPageCopy.heading,
  robots: { index: false, follow: false },
};

type TemplatesParams = {
  readonly tab?: string | string[];
  readonly filter?: string | string[];
  readonly q?: string | string[];
};

/** One query value as the string a person typed. Arrays (a repeated key) take the first entry. */
function queryOf(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : (value?.[0] ?? "");
}

export default async function MemberTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<TemplatesParams>;
}) {
  const { user } = await requireRole("member", { next: MEMBER_TEMPLATES_PATH });
  const params = await searchParams;
  const tab = templatesTabOf(params.tab);
  const filter = libraryFilterOf(params.filter);
  const query = queryOf(params.q).trim();
  const copy = dashboardTemplatesPageCopy;

  let available: readonly LibraryTemplate[] = [];
  let mine: readonly LibraryRow[] = [];
  let rows: readonly MemberTemplateRow[] = [];
  let clonable: readonly ClonableTemplate[] = [];
  let unreadable: string | null = null;
  try {
    [available, mine, rows, clonable] = await Promise.all([
      listLibraryTemplates(user.userId),
      listMemberLibrary(user.userId),
      listMyTemplates(user.userId),
      listClonableTemplates(user.userId),
    ]);
  } catch (error) {
    if (!(error instanceof DatabaseUnavailableError)) throw error;
    console.error("member-templates: the lists could not be read", error);
    unreadable = error.reason;
  }

  /**
   * The Library is the **platform's** rows: a member's own templates are the second tab, and showing
   * them in both places is the duplication #620 merged away.
   */
  const library = available.filter((row) => row.authorship === "built-in");
  const searched = searchRowsOf(library, query);
  const shelved = shelfRowsOf(searched, filter);
  const featured = featuredTemplateOf(library);
  const filters = libraryFilters(copy, searched, query);
  const owned = mine.map((row) => mineCard(copy, row));
  const proposeHref = templatesTabPath("mine");

  return (
    <StageColumn>
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold">{copy.heading}</h1>
          {copy.subtitle === undefined ? null : (
            <p className="max-w-3xl text-sm text-muted-foreground">{copy.subtitle}</p>
          )}
        </header>
        <TemplateTabs
          copy={copy}
          current={tab}
          counts={{ library: library.length, mine: mine.length }}
        />

        {tab === "library" ? (
          unreadable !== null ? (
            <TemplateShelfNotice section={sectionOf(copy, "unreadable")} reason={unreadable} />
          ) : library.length === 0 ? (
            <TemplateShelfNotice section={sectionOf(copy, "library-empty")} />
          ) : (
            <div className="space-y-5">
              {filter === "all" && query === "" && featured !== undefined ? (
                <TemplateFeaturedBand
                  section={sectionOf(copy, "featured")}
                  card={featuredCard(copy, featured)}
                />
              ) : null}
              <div className="space-y-4">
                <TemplateShelfHeading section={sectionOf(copy, "library")} />
                <TemplateCategoryFilter
                  section={sectionOf(copy, "categories")}
                  rows={filters}
                  current={filter}
                />
                <TemplateSearch section={sectionOf(copy, "search")} filter={filter} value={query} />
              </div>
              {shelved.length === 0 ? (
                <TemplateShelfNotice
                  section={sectionOf(copy, "no-match")}
                  action={{
                    href: libraryFilterPath("all"),
                    label: itemLabel(sectionOf(copy, "no-match"), "clear"),
                  }}
                />
              ) : (
                <TemplateShelf cards={shelved.map((row) => catalogueCard(copy, row))} />
              )}
              {/* The proposal door. A proposal is made from one of your own templates, so the
                control opens the tab that holds them rather than a form with nothing behind it. */}
              <div
                data-template-propose
                className="rounded-lg border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900"
              >
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  {itemLabel(sectionOf(copy, "propose"), "cta")}
                </h2>
                <p className="mt-1 max-w-3xl text-sm text-gray-600 dark:text-gray-300">
                  {sectionOf(copy, "propose").body}
                </p>
                <Link
                  href={proposeHref}
                  className="mt-3 inline-flex h-9 items-center justify-center rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
                >
                  {itemLabel(sectionOf(copy, "propose"), "cta")}
                </Link>
              </div>
            </div>
          )
        ) : unreadable !== null ? (
          <TemplateShelfNotice section={sectionOf(copy, "unreadable")} reason={unreadable} />
        ) : (
          <div className="space-y-4">
            <TemplateShelfHeading section={sectionOf(copy, "mine")} />
            {owned.length === 0 ? (
              <TemplateShelfNotice
                section={sectionOf(copy, "mine-empty")}
                action={{
                  href: templatesTabPath("library"),
                  label: itemLabel(sectionOf(copy, "mine-empty"), "browse"),
                }}
              />
            ) : (
              <TemplateShelf cards={owned} />
            )}
            {/* The two ways to start a template. They are the shipped bands — `showList={false}`
              keeps only those, because the shelf above already lists the rows. */}
            <TemplateGallery
              copy={copy}
              rows={rows}
              clonable={clonable}
              unreadable={unreadable}
              onCreate={createPrivate}
              onClone={clonePublic}
              showList={false}
            />
          </div>
        )}
      </div>
    </StageColumn>
  );
}
