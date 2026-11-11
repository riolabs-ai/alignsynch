/**
 * `/templates/relationship/[slug]` — one template, read-only (#console 5/5, #794).
 *
 * The "open" action. `readLibraryTemplate(slug, userId)` answers with the template only when this
 * account may use it — a built-in, or one it wrote — and `undefined` for everything else, so
 * another account's template is a 404 here exactly as it is absent from the list. The page does
 * not distinguish "no such template" from "not yours", because distinguishing them would confirm
 * that one exists.
 *
 * **The address carries the slug, and an id-shaped one is canonicalised (#794).** A bookmarked
 * `/assessment/templates/<id>` 308s here with the id still in the segment, because a redirect row
 * cannot know a row's slug. The read matches either column, so that visitor gets a page rather
 * than a 404 — and this module then answers a 307 to the slug form, so the address bar ends on the
 * address the app itself writes. Two hops, and the second one is only for a legacy link.
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
import { relationshipTemplatePath } from "@/lib/flow/paths";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Template",
};

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await currentUser();
  if (user === null) redirect(loginPathFor(relationshipTemplatePath(slug)));

  const detail = await readLibraryTemplate(slug, user.userId);
  if (detail === undefined) notFound();
  if (detail.template.slug !== slug) redirect(relationshipTemplatePath(detail.template.slug));

  return <TemplateDetail copy={templateDetailPageCopy} detail={detail} />;
}
