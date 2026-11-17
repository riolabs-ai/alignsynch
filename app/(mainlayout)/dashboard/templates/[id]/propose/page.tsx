/**
 * `/dashboard/templates/[id]/propose` — Propose a Template (#1130).
 *
 * **The page reads one row and renders one form.** `readMyTemplate(userId, id)` is the same read the
 * template's own page uses, so an id that is not this account's is a `404` here too — the form never
 * becomes a way to propose somebody else's work, and it does not have to spin a second ownership rule to
 * say so.
 *
 * **The proposal publishes nothing.** `proposeToLibrary()` validates the four required fields, confirms
 * the row is the caller's, and answers `sent`; the review queue behind it is undecided (crud-matrix
 * "Conflicts: Propose to Library"), so nothing durable is written and the sent panel says that in words
 * rather than implying a reviewer is reading it today. When the ruling lands, that action gains one
 * insert and this page does not change.
 *
 * `force-dynamic`, like every gated console route: per-request session, a database read, and a build that
 * must pass with no `DATABASE_URL`. `params` is a Promise in Next 16 and is unwrapped after the gate.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StageColumn } from "@/components/assessment-flow/stage-column";
import { TemplateProposalForm } from "@/components/dashboard/template-proposal-form";
import { dashboardTemplateProposalPageCopy } from "@/data/pages/dashboard-template-proposal";
import { requireRole } from "@/lib/auth/require-role";
import { DatabaseUnavailableError } from "@/lib/db/client";
import { dashboardTemplateEditorPath } from "@/lib/flow/paths";
import { MEMBER_TEMPLATES_PATH, readMyTemplate } from "@/lib/member/templates";
import { itemLabel, sectionOf } from "@/lib/page-copy";
import { proposeToLibrary } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: dashboardTemplateProposalPageCopy.heading,
  robots: { index: false, follow: false },
};

export default async function ProposeTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireRole("member", { next: MEMBER_TEMPLATES_PATH });
  const { id } = await params;
  const copy = dashboardTemplateProposalPageCopy;
  const backHref = dashboardTemplateEditorPath(id);

  let view: Awaited<ReturnType<typeof readMyTemplate>>;
  try {
    view = await readMyTemplate(user.userId, id);
  } catch (error) {
    if (!(error instanceof DatabaseUnavailableError)) throw error;
    console.error("template-proposal: the template could not be read", error);
    return (
      <StageColumn>
        <div className="space-y-4">
          <h1 className="text-2xl font-semibold">{copy.heading}</h1>
          <p data-template-unreadable className="text-sm text-muted-foreground">
            {itemLabel(sectionOf(copy, "refusals"), "failed")}
          </p>
        </div>
      </StageColumn>
    );
  }
  if (view === undefined) notFound();

  return (
    <StageColumn>
      <div className="space-y-6">
        <header className="space-y-2">
          {copy.eyebrow === undefined ? null : (
            <p className="text-sm text-muted-foreground">{copy.eyebrow}</p>
          )}
          <h1 className="text-2xl font-semibold">{copy.heading}</h1>
          {copy.subtitle === undefined ? null : (
            <p className="max-w-3xl text-sm text-muted-foreground">{copy.subtitle}</p>
          )}
          <p className="text-sm">
            <Link href={backHref} className="text-action underline underline-offset-4">
              {itemLabel(sectionOf(copy, "send"), "back")}
            </Link>
          </p>
        </header>
        <TemplateProposalForm
          copy={copy}
          templateId={view.template.id}
          defaultName={view.template.title}
          backHref={backHref}
          onSubmit={proposeToLibrary}
        />
      </div>
    </StageColumn>
  );
}
