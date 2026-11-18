/**
 * Stage 2, Settings (the mode screen), intercepted over `/dashboard/relationships` (#979 B, #1109).
 *
 * Root-relative because the stage lives at `/dashboard/templates/<slug>/create/mode`, beside this
 * page rather than below it; the row list stays underneath on a soft navigation.
 */
import type { ComponentProps } from "react";
import TemplateCreateModePage from "@/components/flow/template-create/mode";
import { FLOW_MOUNT_DIALOG } from "@/components/assessment-flow/relationship-flow-shell";

export default function Intercepted(props: ComponentProps<typeof TemplateCreateModePage>) {
  return <TemplateCreateModePage {...props} mount={FLOW_MOUNT_DIALOG} />;
}
