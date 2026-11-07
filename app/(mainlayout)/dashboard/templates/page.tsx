/**
 * `/dashboard/templates` — one destination, two tabs (#620).
 *
 * **The member group's second row used to be three rows** (`My Templates`, `Library`, and the
 * catalogue) and a person had to know which of three doors held what they wanted. This page is
 * the one door: `?tab=catalogue` (the bare path) is the **Relationship Templates** shelf — what
 * this account can start a relationship from, with the price of the relationship on the card —
 * and `?tab=mine` is **My Templates**, the rows they own or that one of their relationships was
 * built from, plus the two ways to start a new one.
 *
 * **Every state of the tab is the URL.** `templatesTabOf()` reads `?tab=`, an unknown value lands
 * on the catalogue, and both tabs are links: a `curl` can ask for either, the back button works,
 * and nothing here needs a client bundle — the same rule `/assessment/instances` follows for
 * `?stage=`.
 *
 * **Two reads, and neither takes an id from the request.** `listLibraryTemplates(userId)` is the
 * platform's templates plus this account's (`author_user_id IS NULL OR = $1`), and
 * `listMemberLibrary(userId)` is the rows it owns or has adopted; `requireRole` resolved the id
 * from the request's own session. A crafted `?tab=` can change which shelf is drawn and nothing
 * else.
 *
 * **A read that cannot answer is a panel, not a 500.** `DatabaseUnavailableError` is caught and
 * its reason handed to both tabs; every other failure keeps throwing, because a row that does not
 * satisfy the model is drift the gate exists to catch.
 *
 * `force-dynamic` for the reasons every gated console route carries: per-request session, database
 * reads, and a `pnpm build` that must pass with no `DATABASE_URL`.
 */
import type { Metadata } from "next";

import { TemplateGallery } from "@/components/dashboard/template-gallery";
import {
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
import { catalogueCard, mineCard, templatesTabOf } from "@/lib/member/shelf";
import {
  listMyTemplates,
  listClonableTemplates,
  MEMBER_TEMPLATES_PATH,
  type ClonableTemplate,
  type MemberTemplateRow,
} from "@/lib/member/templates";
import { sectionOf } from "@/lib/page-copy";
import { clonePublic, createPrivate } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: dashboardTemplatesPageCopy.heading,
  robots: { index: false, follow: false },
};

type TemplatesParams = {
  readonly tab?: string | string[];
};

export default async function MemberTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<TemplatesParams>;
}) {
  const { user } = await requireRole("member", { next: MEMBER_TEMPLATES_PATH });
  const tab = templatesTabOf((await searchParams).tab);
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
   * The catalogue shelf is the **platform's** rows: a member's own templates are the second tab,
   * and showing them in both places is the duplication #620 merged away.
   */
  const catalogue = available
    .filter((row) => row.authorship === "built-in")
    .map((row) => catalogueCard(copy, row));
  const owned = mine.map((row) => mineCard(copy, row));

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">{copy.heading}</h1>
        {copy.subtitle === undefined ? null : (
          <p className="max-w-3xl text-sm text-muted-foreground">{copy.subtitle}</p>
        )}
      </header>
      <TemplateTabs copy={copy} current={tab} />

      {tab === "catalogue" ? (
        unreadable !== null ? (
          <TemplateShelfNotice section={sectionOf(copy, "unreadable")} reason={unreadable} />
        ) : catalogue.length === 0 ? (
          <TemplateShelfNotice section={sectionOf(copy, "catalogue-empty")} />
        ) : (
          <div className="space-y-4">
            <TemplateShelfHeading section={sectionOf(copy, "catalogue")} />
            <TemplateShelf cards={catalogue} />
          </div>
        )
      ) : unreadable !== null ? (
        <TemplateShelfNotice section={sectionOf(copy, "unreadable")} reason={unreadable} />
      ) : (
        <div className="space-y-4">
          <TemplateShelfHeading section={sectionOf(copy, "mine")} />
          {owned.length === 0 ? (
            <TemplateShelfNotice section={sectionOf(copy, "mine-empty")} />
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
  );
}
