/**
 * Stage 3, Aspects, intercepted over `/dashboard/relationships` (#979 B, #1109).
 *
 * The same module the stage's own route renders; the marker is root-relative because the address it
 * intercepts is `/dashboard/templates/<slug>/create/aspects`.
 */
import type { ComponentProps } from "react";
import TemplateCreateAspectsPage from "@/components/flow/template-create/aspects";
import { FLOW_MOUNT_DIALOG } from "@/components/assessment-flow/relationship-flow-shell";

export default function Intercepted(props: ComponentProps<typeof TemplateCreateAspectsPage>) {
  return <TemplateCreateAspectsPage {...props} mount={FLOW_MOUNT_DIALOG} />;
}
