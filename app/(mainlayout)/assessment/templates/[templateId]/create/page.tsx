/**
 * `/assessment/templates/[templateId]/create` — the create step, shipped as **in-progress UI**
 * (#409, R1-E).
 *
 * A child of the template's own address, so the template being copied is the route's own fact:
 * there is no picker and no payload field that could name a different template.
 *
 * The read is `readLibraryTemplate(recordId, viewerUserId)` — the same authorization the library
 * and the template detail page use: the platform's templates plus the viewer's own, and
 * `undefined` for everything else. It is asked with the **session's** id, never one from the
 * URL, and a signed-out visitor's answer is the built-ins only (`author_user_id IS NULL`
 * matches nobody). The page does not redirect to login the way the detail page does, because
 * rendering this form writes nothing — it is a layout with a disabled control, and asking a
 * visitor to sign in for it would promise a create that cannot happen yet.
 *
 * `force-dynamic`: this route reads a database and must not do so at build time.
 */
import { CreateRelationship } from "@/components/assessment-flow/create-relationship";
import { assessmentCreatePageCopy } from "@/data/pages/assessment-create";
import { authConfigured } from "@/lib/auth/config";
import { currentUser } from "@/lib/auth/session";
import { readLibraryTemplate } from "@/lib/db/template-library";
import { templateDetailPath } from "@/lib/flow/paths";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Create a relationship",
};

/**
 * The signed-in account id, or `null` — never a thrown error on a tree without auth env.
 *
 * The instance page resolves the viewer the same way, and for the same reason: the gate renders
 * this route with no `NEON_AUTH_*` variables at all, and a build that throws on a missing
 * session reads as a broken route rather than a signed-out one.
 */
async function viewerUserId(): Promise<string | null> {
  if (!authConfigured()) return null;
  const user = await currentUser();
  return user?.userId ?? null;
}

export default async function TemplateCreatePage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  const detail = await readLibraryTemplate(templateId, await viewerUserId());
  if (detail === undefined) notFound();

  return (
    <CreateRelationship
      copy={assessmentCreatePageCopy}
      template={{
        title: detail.template.title,
        summary: detail.template.summary,
        aspectCount: detail.aspects.length,
      }}
      backHref={templateDetailPath(templateId)}
    />
  );
}
