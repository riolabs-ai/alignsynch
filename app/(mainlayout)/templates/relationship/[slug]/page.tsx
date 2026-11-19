/**
 * `/templates/relationship/[slug]` — **the in-app template page** (#1259).
 *
 * The screen the Library card's `View Details` opens. Until this page existed the address answered
 * a **308 to `/relationship-templates`** (`next.config.mjs`), so a signed-in member who asked about
 * a template on their own shelf was ejected from the app shell into the **public marketing**
 * catalogue — the same rule the repo states the other way round for a link out of the dashboard
 * (`components/layout/leaving-link.tsx`, `data:check` E39). The redirect is gone, and this route
 * answers under the address `relationshipTemplatePath()` already produced.
 *
 * **Inside the shell, by placement.** It lives under `app/(mainlayout)/`, so the rail, the header
 * and the account menu are the ones a member is already using; a page rendered bare here would be
 * the marketing surface with a different stylesheet, which is exactly what it must not be.
 *
 * **One read, and it is the shelf's.** `readLibraryTemplate(slug, user.userId)` returns the row the
 * Library listed *and* its Aspects — the read `lib/db/template-library.ts` calls "the open action's
 * read". It refuses what the shelf refuses (a session, somebody else's template, a withdrawn
 * draft), and every refusal is the same plain `notFound()`: a page that distinguished them would
 * tell a stranger which handles exist.
 *
 * **The taxonomy is enrichment, never a requirement.** `relationshipType(slug)` supplies the shelf
 * the template files under, the two descriptor sentences and the Counterparty's role word — and is
 * `undefined` for a hand-authored template or a member's own copy, which then draw the plain
 * `Template` chip and the generic start panel. `lib/member/template-page.ts` is that join; this
 * module reads a session and renders, and owns no word of its own.
 *
 * `force-dynamic`: per-request session, a database read, and a `pnpm build` that must pass with no
 * `DATABASE_URL` — the same three reasons every gated console route gives.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StageColumn } from "@/components/assessment-flow/stage-column";
import { TemplatePage } from "@/components/templates/template-page";
import { billingPlan } from "@/data/billing-plans";
import { dashboardTemplatesPageCopy } from "@/data/pages/dashboard-templates";
import { templatePageCopy } from "@/data/pages/template-page";
import { relationshipType } from "@/data/relationship-types";
import { requireRole } from "@/lib/auth/require-role";
import { DatabaseUnavailableError } from "@/lib/db/client";
import { readLibraryTemplate } from "@/lib/db/template-library";
import { relationshipTemplatePath } from "@/lib/flow/paths";
import { templatePageModel } from "@/lib/member/template-page";
import { itemLabelOr, sectionOf } from "@/lib/page-copy";
import { saveTemplateCopy } from "./actions";

export const dynamic = "force-dynamic";

/**
 * The plan the page prices against — **Basic**, the same tier the shelf's cards print
 * (`lib/member/shelf.ts`). A page that looked up its own tier would be a second answer to "what
 * does this cost me", and the two surfaces would drift.
 */
const PAGE_PLAN = (() => {
  const plan = billingPlan("basic");
  if (plan === undefined) {
    throw new Error('data/billing-plans.ts has no "basic" plan to price the template page from');
  }
  return plan;
})();

export const metadata: Metadata = {
  title: dashboardTemplatesPageCopy.heading,
  /** A member's own copy is not a public document. */
  robots: { index: false, follow: false },
};

export default async function TemplatePageRoute({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ problem?: string | string[] }>;
}) {
  const { slug } = await params;
  const { user } = await requireRole("member", { next: relationshipTemplatePath(slug) });

  let detail: Awaited<ReturnType<typeof readLibraryTemplate>>;
  try {
    detail = await readLibraryTemplate(slug, user.userId);
  } catch (error) {
    if (!(error instanceof DatabaseUnavailableError)) throw error;
    console.error("template-page: the template could not be read", error);
    return (
      <StageColumn>
        <section className="rounded-lg border bg-card p-5" data-template-unreadable>
          <h1 className="text-base font-semibold text-primary">
            {sectionOf(templatePageCopy, "unreadable").heading}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {sectionOf(templatePageCopy, "unreadable").body}
          </p>
        </section>
      </StageColumn>
    );
  }

  /** No row, or a row this viewer may not use — one answer, and it is the same 404. */
  if (detail === undefined) notFound();

  const model = templatePageModel({
    copy: templatePageCopy,
    shelfCopy: dashboardTemplatesPageCopy,
    template: detail.template,
    aspects: detail.aspects,
    plan: PAGE_PLAN,
    type: relationshipType(detail.template.slug),
  });

  /** `?problem=<code>` from a refused copy — a code with no sentence draws no band. */
  const query = await searchParams;
  const problemCode = typeof query.problem === "string" ? query.problem : "";
  const problem =
    problemCode === ""
      ? undefined
      : itemLabelOr(sectionOf(templatePageCopy, "refusals"), problemCode);

  return (
    <StageColumn>
      <div className="space-y-4">
        {problem === undefined ? null : (
          <p
            className="rounded-md border border-status-line bg-status px-3 py-2 text-sm text-foreground"
            data-template-problem={problemCode}
            role="alert"
          >
            {problem}
          </p>
        )}
        <TemplatePage model={model} save={saveTemplateCopy} />
      </div>
    </StageColumn>
  );
}
