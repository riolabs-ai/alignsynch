/**
 * `/dashboard/templates/[slug]/create/mode` — stage 2, **Settings**, at its real address (#1109).
 *
 * The route a refresh or a deep link lands on; the in-app presentation is the
 * `@flow/(.)[slug]/create/mode` interception over the shelf. The stage itself is
 * `components/flow/template-create/mode.tsx`, mounted at its `"page"` default here.
 */
import type { ComponentProps } from "react";
import TemplateCreateModePage from "@/components/flow/template-create/mode";

export { metadata } from "@/components/flow/template-create/mode";

export const dynamic = "force-dynamic";

export default function TemplateCreateModeRoute(
  props: ComponentProps<typeof TemplateCreateModePage>,
) {
  return <TemplateCreateModePage {...props} />;
}
