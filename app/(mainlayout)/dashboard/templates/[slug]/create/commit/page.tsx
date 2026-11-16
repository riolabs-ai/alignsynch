/**
 * `/dashboard/templates/[slug]/create/commit` — stage 4, **Account**, at its real address (#1109).
 *
 * The stage where the relationship is written as a `draft`; the address kept its name and changed its
 * job in #825, and #1109 moved it here without touching either.
 */
import type { ComponentProps } from "react";
import TemplateCreateCommitPage from "@/components/flow/template-create/commit";

export { metadata } from "@/components/flow/template-create/commit";

export const dynamic = "force-dynamic";

export default function TemplateCreateCommitRoute(
  props: ComponentProps<typeof TemplateCreateCommitPage>,
) {
  return <TemplateCreateCommitPage {...props} />;
}
