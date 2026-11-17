// template-ancestor: components/assessment-flow/template-detail.tsx   (variation: the same record read as the member who owns it — the template's own page with its Aspects drawn on the locked band, an Edit door into the console's editor in its `band: "private"` variation, and the retire band #1109 wired; the public detail page sells the template to a stranger and has no retire band)
/**
 * `/dashboard/templates/[id]` — one of the member's own templates (#1130, superseding the editor-only page).
 *
 * **`?edit=1` is the editor; the bare address is the template's page.** The bundle addresses the two that
 * way (`my-template-detail.html?id=<id>&edit=1`), and the split is what the surface needs: a person
 * arriving from a card wants to read the template and decide what to do with it, and the editor is one
 * click away rather than the first thing that loads. Both are this route, so there is one address, one
 * read and one 404 — not a second page shadowing the first.
 *
 * **The editor is the console's.** `components/admin/template-editor.tsx` renders it through
 * `band="private"`: the tabs, the Aspect rows, the save band and the answer-sheet preview are the same
 * code, and only the card underneath differs — the console's publish/withdraw controls would be a button
 * that always refuses for a member, because public listing is admin-curated (#533). Building a second
 * editor would have been the same six hundred lines with one card swapped.
 *
 * **The retire band is wired here as well (#1109).** Archive, restore and delete a member's own template
 * used to exist only on the retired `/templates/relationship` listing; the board's three server actions
 * (`archivePrivate` / `restorePrivate` / `deletePrivate`) hand both the editor's controls and this page's
 * band the same three writes, and the band's sentences and refusals are the fixture's — so the actions
 * survive the page that used to own them, with no second vocabulary.
 *
 * **A stranger's id is a 404, not a 403.** `readMyTemplate` answers `undefined` for three cases on
 * purpose — no such row, a row that is not a template, and somebody else's row — and this page turns all
 * three into `notFound()`, the 404 a URL that never existed returns. A distinguishable "not yours" would
 * tell a prober which ids are real.
 *
 * **`versions` is empty and `catalogue` is `null`, and both are true statements.** A member's template is
 * never published as a version (the private band has no publish control), and its slug does not name a
 * catalogue type — the details panel draws the fixture's "not in the catalogue" line rather than an empty
 * realm, which is exactly the fact: this template is the member's own.
 *
 * `force-dynamic` for the reason the console's editor carries it: per-request session, a database read,
 * and a build that must pass with no `DATABASE_URL`. `params` and `searchParams` are Promises in Next 16
 * and are unwrapped after the gate, never before — a refusal must not depend on the URL being well-formed.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { StageColumn } from "@/components/assessment-flow/stage-column";
import { PRIVATE_BAND, TemplateEditor } from "@/components/admin/template-editor";
import { MyTemplateDetail } from "@/components/dashboard/my-template-detail";
import { assessmentInstancePageCopy } from "@/data/pages/assessment-instance";
import { dashboardTemplateEditorPageCopy } from "@/data/pages/dashboard-template-editor";
import { requireRole } from "@/lib/auth/require-role";
import type { PublishStatus } from "@/content/core";
import { DatabaseUnavailableError } from "@/lib/db/client";
import { createRelationshipPath } from "@/lib/flow/paths";
import { listMyTemplates, MEMBER_TEMPLATES_PATH, readMyTemplate } from "@/lib/member/templates";
import { archivePrivate, deletePrivate, restorePrivate, savePrivate } from "../actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your template",
  robots: { index: false, follow: false },
};

/** `?edit=` — the one mode this address carries. Anything else is the template's own page. */
function editModeOf(value: string | readonly string[] | undefined): boolean {
  const raw = typeof value === "string" ? value : value?.[0];
  return raw === "1" || raw === "true";
}

export default async function MemberTemplatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ readonly edit?: string | string[] }>;
}) {
  const { user } = await requireRole("member", { next: MEMBER_TEMPLATES_PATH });
  const { id } = await params;
  const editing = editModeOf((await searchParams).edit);

  let view: Awaited<ReturnType<typeof readMyTemplate>>;
  let row: Awaited<ReturnType<typeof listMyTemplates>>[number] | undefined;
  try {
    view = await readMyTemplate(user.userId, id);
    row =
      view === undefined
        ? undefined
        : (await listMyTemplates(user.userId)).find((candidate) => candidate.id === id);
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

  /** `draft` is the only status a member's template is ever written with; the row reports what it is. */
  const status = (row?.status ?? view.template.status ?? "draft") as PublishStatus;

  if (editing) {
    return (
      <StageColumn>
        <div className="space-y-6">
          <header className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {dashboardTemplateEditorPageCopy.heading}
            </p>
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
            onArchive={archivePrivate}
            onRestore={restorePrivate}
            onDelete={deletePrivate}
            deleteHref={MEMBER_TEMPLATES_PATH}
          />
        </div>
      </StageColumn>
    );
  }

  return (
    <StageColumn>
      <MyTemplateDetail
        copy={dashboardTemplateEditorPageCopy}
        template={view.template}
        status={status}
        usedCount={row?.relationshipCount ?? 0}
        createHref={createRelationshipPath(view.template.slug)}
        editHref={`${MEMBER_TEMPLATES_PATH}/${view.template.id}?edit=1`}
        proposeHref={`${MEMBER_TEMPLATES_PATH}/${view.template.id}/propose`}
        deleteHref={MEMBER_TEMPLATES_PATH}
        onArchive={archivePrivate}
        onRestore={restorePrivate}
        onDelete={deletePrivate}
      />
    </StageColumn>
  );
}
