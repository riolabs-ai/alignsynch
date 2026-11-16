/**
 * `/dashboard/templates/[slug]/create/aspects` — stage 3, **Aspects**, at its real address (#1109).
 *
 * The stage reads the draft stages 1 and 2 wrote, so a cold open sends the person back to Details
 * rather than drawing a list with no relationship behind it — as a page as much as in the dialog.
 */
import type { ComponentProps } from "react";
import TemplateCreateAspectsPage from "@/components/flow/template-create/aspects";

export { metadata } from "@/components/flow/template-create/aspects";

export const dynamic = "force-dynamic";

export default function TemplateCreateAspectsRoute(
  props: ComponentProps<typeof TemplateCreateAspectsPage>,
) {
  return <TemplateCreateAspectsPage {...props} />;
}
