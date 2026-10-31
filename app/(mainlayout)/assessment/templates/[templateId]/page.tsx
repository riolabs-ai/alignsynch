/**
 * `/assessment/templates/[templateId]` — one template, read-only (#console 5/5).
 *
 * The "open" action. `readLibraryTemplate(id, userId)` answers with the template only when this
 * account may use it — a built-in, or one it wrote — and `undefined` for everything else, so
 * another account's template is a 404 here exactly as it is absent from the list. The page does
 * not distinguish "no such id" from "not yours", because distinguishing them would confirm that
 * an id exists.
 *
 * Structure only: the words are `data/pages/assessment-template-detail.ts` (E23), and the read is
 * `lib/db/template-library.ts`. Nothing on this page writes — the two write actions it draws
 * (duplicate, archive) are the same POST endpoints the list uses.
 */
import { TemplateDetail } from "@/components/assessment-flow/template-detail";
import { templateDetailPageCopy } from "@/data/pages/assessment-template-detail";
import { loginPathFor } from "@/lib/auth/paths";
import { currentUser } from "@/lib/auth/session";
import { readLibraryTemplate } from "@/lib/db/template-library";
import { TEMPLATE_LIBRARY_PATH } from "@/lib/flow/paths";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Template",
};

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const user = await currentUser();
  if (user === null) redirect(loginPathFor(TEMPLATE_LIBRARY_PATH));

  const { templateId } = await params;
  const detail = await readLibraryTemplate(templateId, user.userId);
  if (detail === undefined) notFound();

  return <TemplateDetail copy={templateDetailPageCopy} detail={detail} />;
}
