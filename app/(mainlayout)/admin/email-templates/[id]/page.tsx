/**
 * `/admin/email-templates/<id>` — one transactional mail, its override and its history (#1138).
 *
 * **The same two gates as the list, and the same order** (`requireAdminProduct()` before
 * `requireAdmin({ next })`), so a member and a `support` seat get the 404 an unknown URL gets and a
 * signed-out visitor is sent to `/login` with this path as `next`. The read that follows is the one
 * query that can grow — the version history — so the page bounds what it draws rather than fetching
 * lazily: a dozen templates, a handful of versions each.
 *
 * **`notFound()` for an id the register does not carry**, including the operator's release note:
 * `memberFacingTemplate()` is the intersection of "the code has it" and "this page owns it", so a URL
 * to `stakeholder-release-note` answers 404 rather than rendering a mail #1138 keeps off the screen.
 *
 * **The first preview is rendered here, not in the browser.** The register is TypeScript functions,
 * so `renderSampleEmail()` runs on the server and the page hands the client the two bodies it
 * produced — the same call the live preview action makes later, which is why the first paint and the
 * first keystroke cannot disagree about what a mail looks like.
 *
 * **The four server actions are passed, never closured.** A function defined inside this render
 * cannot cross into the client component; the actions themselves can, because they are
 * `"use server"` — and the editor supplies the template id it already holds, so no wrapper is
 * needed.
 */
import { StageColumn } from "@/components/assessment-flow/stage-column";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { EmailTemplateEditor } from "@/components/admin/email-templates/email-template-editor";
import { adminEmailTemplatesPageCopy } from "@/data/pages/admin-email-templates";
import { readEmailTemplateEditor } from "@/lib/admin/email-templates";
import { ADMIN_EMAIL_TEMPLATES_PATH } from "@/lib/admin/paths";
import { requireAdmin } from "@/lib/auth/require-role";
import { requireAdminProduct } from "@/lib/brand-boundary";
import { DatabaseUnavailableError } from "@/lib/db/client";
import { renderSampleEmail } from "@/lib/email/samples";
import {
  previewEmailTemplateAction,
  publishEmailTemplateAction,
  resetEmailTemplateAction,
  saveEmailTemplateAction,
  sendEmailTemplateTestAction,
} from "../actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  // A value, not a `generateMetadata` that reads the database: Next resolves head and body in
  // parallel, so a title derived from the row would be computed before the gates run.
  const { id } = await params;
  return {
    title: `${id} · ${adminEmailTemplatesPageCopy.heading}`,
    robots: { index: false, follow: false },
  };
}

export default async function AdminEmailTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // The capability before the role, exactly as the list does it (#509): a template that does not
  // claim the console answers the 404 an unknown URL gets, with no session and no database read.
  requireAdminProduct();
  await requireAdmin({ next: `${ADMIN_EMAIL_TEMPLATES_PATH}/${id}` });

  let view: Awaited<ReturnType<typeof readEmailTemplateEditor>>;
  try {
    view = await readEmailTemplateEditor(id);
  } catch (error) {
    // The tests' and the demo branch's failure mode: a database that does not answer is a 500 with
    // the reason, not a page claiming every template is the default.
    if (!(error instanceof DatabaseUnavailableError)) throw error;
    console.error(`admin-email-templates: "${id}" could not be read`, error);
    throw error;
  }
  if (view === undefined) notFound();

  // The first paint's preview: the draft, else the published words, else the default — the same
  // precedence the form's initial values use, so what is on screen is what is drawn below it.
  const initial = view.draft ?? view.published;
  const initialRender = renderSampleEmail(
    view.template.id,
    initial === undefined
      ? undefined
      : { subject: initial.subject, preheader: initial.preheader, body: initial.body },
  );

  return (
    <StageColumn>
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold font-mono">{view.template.id}</h1>
        </header>
        <EmailTemplateEditor
          copy={adminEmailTemplatesPageCopy}
          view={{
            id: view.template.id,
            numeral: view.template.numeral,
            emailClass: view.template.emailClass,
            recipient: view.template.recipient,
            editable: view.editable,
            placeholders: view.placeholders,
            defaultSubject: view.defaultSubject,
            defaultPreheader: view.defaultPreheader,
            defaultBody: view.defaultBody,
            initialText: initialRender.text,
            initialHtml: initialRender.html,
            ...(view.published === undefined
              ? {}
              : {
                  published: {
                    version: view.published.version,
                    subject: view.published.subject,
                    preheader: view.published.preheader,
                    body: view.published.body,
                  },
                }),
            ...(view.draft === undefined
              ? {}
              : {
                  draft: {
                    subject: view.draft.subject,
                    preheader: view.draft.preheader,
                    body: view.draft.body,
                  },
                }),
            versions: view.versions.map((version) => ({
              id: version.id,
              version: version.version,
              status: version.status,
              subject: version.subject,
              preheader: version.preheader,
              body: version.body,
              editorUserId: version.editorUserId,
              createdAt: version.createdAt,
            })),
          }}
          onSave={saveEmailTemplateAction}
          onPublish={publishEmailTemplateAction}
          onReset={resetEmailTemplateAction}
          onTest={sendEmailTemplateTestAction}
          onPreview={previewEmailTemplateAction}
        />
      </div>
    </StageColumn>
  );
}
