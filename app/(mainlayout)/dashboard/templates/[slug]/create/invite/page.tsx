/**
 * `/dashboard/templates/[slug]/create/invite` — stage 5, **Invite**, at its real address (#1109).
 *
 * The relationship it is about travels as `?instance=`, read by the stage from `searchParams`; the
 * page passes them through untouched, so a deep link carries the same query a dialog navigation does.
 */
import type { ComponentProps } from "react";
import TemplateCreateInvitePage from "@/components/flow/template-create/invite";

export { metadata } from "@/components/flow/template-create/invite";

export const dynamic = "force-dynamic";

export default function TemplateCreateInviteRoute(
  props: ComponentProps<typeof TemplateCreateInvitePage>,
) {
  return <TemplateCreateInvitePage {...props} />;
}
