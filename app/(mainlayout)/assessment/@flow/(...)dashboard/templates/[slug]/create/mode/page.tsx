/**
 * Stage 2, Settings (the mode screen), intercepted over `/assessment` (#979 B, #1109).
 *
 * Root-relative: the address it intercepts is `/dashboard/templates/<slug>/create/mode`.
 */
import type { ComponentProps } from "react";
import TemplateCreateModePage from "@/components/flow/template-create/mode";
import { FLOW_MOUNT_DIALOG } from "@/components/assessment-flow/relationship-flow-shell";

export default function Intercepted(props: ComponentProps<typeof TemplateCreateModePage>) {
  return <TemplateCreateModePage {...props} mount={FLOW_MOUNT_DIALOG} />;
}
