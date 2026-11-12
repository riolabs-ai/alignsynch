// template-ancestor: components/assessment-flow/template-detail.tsx   (variation: the same record read as an editor, for the member who owns it — the console's editor in its `band: "private"` variation, where the publish card is replaced by the sentence that public listing is the console's decision)
/**
 * `/dashboard/templates/[id]` — edit one of the member's own templates (#533 phase 2).
 *
 * **The editor is the console's, and that is the point.** `components/admin/template-editor.tsx`
 * renders this page through its `band="private"` prop: the tabs, the Aspect rows, the save band and
 * the answer-sheet preview are the same code, and only the card underneath differs — the console's
 * publish/withdraw controls would be a button that always refuses for a member, because public
 * listing is admin-curated (#533). Building a second editor would have been the same six hundred
 * lines with one card swapped, which is the hand-bake #336's rule exists to catch.
 *
 * **A stranger's id is a 404, not a 403.** `readMyTemplate` answers `undefined` for three cases on
 * purpose — no such row, a row that is not a template, and somebody else's row — and this page
 * turns all three into `notFound()`, the 404 a URL that never existed returns. A distinguishable
 * "not yours" would tell a prober which ids are real.
 *
 * **`versions` is empty and `catalogue` is `null`, and both are true statements.** A member's
 * template is never published as a version (the private band has no publish control), and its slug
 * does not name a catalogue type — the details panel draws the fixture's "not in the catalogue"
 * line rather than an empty realm, which is exactly the fact: this template is the member's own.
 *
 * `force-dynamic` for the reason the console's editor carries it: per-request session, a database
 * read, and a build that must pass with no `DATABASE_URL`. `params` is a Promise in Next 16 and is
 * unwrapped after the gate, never before — a refusal must not depend on the URL being well-formed.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StageColumn } from "@/components/assessment-flow/stage-column";
import { PRIVATE_BAND, TemplateEditor } from "@/components/admin/template-editor";
import { assessmentInstancePageCopy } from "@/data/pages/assessment-instance";
import { dashboardTemplateEditorPageCopy } from "@/data/pages/dashboard-template-editor";
import { requireRole } from "@/lib/auth/require-role";
import { DatabaseUnavailableError } from "@/lib/db/client";
import { MEMBER_TEMPLATES_PATH, readMyTemplate } from "@/lib/member/templates";
import { savePrivate } from "../actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Edit a template",
  robots: { index: false, follow: false },
};

export default async function MemberTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireRole("member", { next: MEMBER_TEMPLATES_PATH });
  const { id } = await params;

  let view: Awaited<ReturnType<typeof readMyTemplate>>;
  try {
    view = await readMyTemplate(user.userId, id);
  } catch (error) {
    if (!(error instanceof DatabaseUnavailableError)) throw error;
    console.error("member-template: the template could not be read", error);
    return (
      <StageColumn>
        <div className="space-y-6">
          <h1 className="text-2xl font-semibold">{dashboardTemplateEditorPageCopy.heading}</h1>
          <p data-template-unreadable className="text-sm text-muted-foreground">
            {dashboardTemplateEditorPageCopy.sections?.find(
              (section) => section.id === "unreadable",
            )?.body ?? ""}
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
          <p className="text-sm text-muted-foreground">{dashboardTemplateEditorPageCopy.heading}</p>
          <h1 className="text-2xl font-semibold">{view.template.title}</h1>
          {dashboardTemplateEditorPageCopy.subtitle === undefined ? null : (
            <p className="max-w-3xl text-sm text-muted-foreground">
              {dashboardTemplateEditorPageCopy.subtitle}
            </p>
          )}
        </header>
        <TemplateEditor
          copy={dashboardTemplateEditorPageCopy}
          sheetCopy={assessmentInstancePageCopy}
          template={view.template}
          editable={view.editable}
          status={view.template.status}
          versions={[]}
          catalogue={null}
          band={PRIVATE_BAND}
          onSave={savePrivate}
        />
      </div>
    </StageColumn>
  );
}
