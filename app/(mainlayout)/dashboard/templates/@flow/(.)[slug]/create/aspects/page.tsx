/**
 * Stage 3, Aspects, intercepted over `/dashboard/templates` (#979 B, #1109).
 *
 * The same module the stage's own route renders, mounted as the dialog — its "Continue" is a link,
 * and a soft navigation keeps the shelf underneath instead of replacing it.
 */
import type { ComponentProps } from "react";
import TemplateCreateAspectsPage from "@/components/flow/template-create/aspects";
import { FLOW_MOUNT_DIALOG } from "@/components/assessment-flow/relationship-flow-shell";

export default function Intercepted(props: ComponentProps<typeof TemplateCreateAspectsPage>) {
  return <TemplateCreateAspectsPage {...props} mount={FLOW_MOUNT_DIALOG} />;
}
