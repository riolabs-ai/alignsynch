/**
 * The flow's Settings stage, intercepted over `/dashboard/templates` (#979 B).
 *
 * The same module the stage's own route renders, mounted as the dialog — so advancing from
 * Details stays on the shelf with the flow open over it.
 */
import type { ComponentProps } from "react";
import TemplateCreateModePage from "@/app/(mainlayout)/templates/relationship/[slug]/create/mode/page";
import { FLOW_MOUNT_DIALOG } from "@/components/assessment-flow/relationship-flow-shell";

export default function Intercepted(props: ComponentProps<typeof TemplateCreateModePage>) {
  return <TemplateCreateModePage {...props} mount={FLOW_MOUNT_DIALOG} />;
}
