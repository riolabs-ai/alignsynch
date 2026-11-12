// template-ancestor: components/assessment-flow/template-detail.tsx   (variation: the same record read, drawn as an editor rather than a detail page — tabs, per-Aspect accordion rows and a save band, with the preview a party's own answer sheet)
/**
 * `/admin/templates/[id]` — draft one template, and preview it as a party sees it (#502a).
 *
 * **The gate, in order, before the read.** `requireAdminProduct()` (the console capability),
 * `requireAlignmentProduct()` (this surface writes the assessment catalogue, and a quiz-only build
 * does not have one) and then `requireAdmin()` — signed out redirects to `/login` with this path
 * as `next`, a member or `support` session gets `notFound()`, `admin` proceeds. `params` is a
 * Promise in Next 16 and is unwrapped after the gates, never before: a refusal must not depend on
 * the URL being well-formed.
 *
 * **The record is read through the flow's own mapper.** `readAdminTemplate` uses
 * `readAssessmentTemplateRowsById` + `assessmentTemplateFromRows`, so a row that drifted from
 * `zAssessment` raises the mapper's sentence here instead of rendering a half-empty editor, and an
 * id that is not a template (an instance, a quiz, nothing) is `notFound()`.
 *
 * **Realm and price come from the catalogue, read-only.** The record holds a `slug`; the type that
 * slug names (`data/relationship-types.ts`) owns the realm, the two roles and the price. The page
 * resolves the type and hands the two facts to the editor, which draws them beside a sentence
 * saying where they live — editing one is editing the taxonomy, which is a fixture, not a row.
 *
 * `force-dynamic` for the reason the list carries: per-request session, a database read, and a
 * build that must pass with no `DATABASE_URL`.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TemplateEditor } from "@/components/admin/template-editor";
import { adminTemplateEditorPageCopy } from "@/data/pages/admin-template-editor";
import { assessmentInstancePageCopy } from "@/data/pages/assessment-instance";
import { relationshipTypes } from "@/data/relationship-types";
import { ADMIN_TEMPLATES_PATH, readAdminTemplate } from "@/lib/admin/templates";
import { requireAdmin } from "@/lib/auth/require-role";
import { requireAdminProduct, requireAlignmentProduct } from "@/lib/brand-boundary";
import { DatabaseUnavailableError } from "@/lib/db/client";
import {
  archiveTemplateVersion,
  destroyTemplateVersion,
  publishTemplateVersion,
  restoreTemplateVersion,
  saveTemplate,
  unpublishTemplateVersion,
} from "../actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Draft a template",
  robots: { index: false, follow: false },
};

export default async function AdminTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  requireAdminProduct();
  requireAlignmentProduct();
  await requireAdmin({ next: ADMIN_TEMPLATES_PATH });
  const { id } = await params;

  let view: Awaited<ReturnType<typeof readAdminTemplate>>;
  try {
    view = await readAdminTemplate(id);
  } catch (error) {
    if (!(error instanceof DatabaseUnavailableError)) throw error;
    console.error("admin-template: the template could not be read", error);
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">{adminTemplateEditorPageCopy.heading}</h1>
        <p data-template-unreadable className="text-sm text-muted-foreground">
          {adminTemplateEditorPageCopy.sections?.find((section) => section.id === "unreadable")
            ?.body ?? ""}
        </p>
      </div>
    );
  }
  if (view === undefined) notFound();

  const type = relationshipTypes.find((candidate) => candidate.id === view.template.slug);
  const catalogue = type === undefined ? null : { realm: type.realm, price: type.price };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm text-muted-foreground">{adminTemplateEditorPageCopy.heading}</p>
        <h1 className="text-2xl font-semibold">{view.template.title}</h1>
        {adminTemplateEditorPageCopy.subtitle === undefined ? null : (
          <p className="max-w-3xl text-sm text-muted-foreground">
            {adminTemplateEditorPageCopy.subtitle}
          </p>
        )}
      </header>
      <TemplateEditor
        copy={adminTemplateEditorPageCopy}
        sheetCopy={assessmentInstancePageCopy}
        template={view.template}
        editable={view.editable}
        status={view.status}
        versions={view.versions}
        catalogue={catalogue}
        onSave={saveTemplate}
        onPublish={publishTemplateVersion}
        onUnpublish={unpublishTemplateVersion}
        onArchive={archiveTemplateVersion}
        onRestore={restoreTemplateVersion}
        onDelete={destroyTemplateVersion}
      />
    </div>
  );
}
