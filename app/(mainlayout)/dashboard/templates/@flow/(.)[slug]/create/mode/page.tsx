/**
 * Stage 2, Settings (the mode screen), intercepted over `/dashboard/templates` (#979 B, #1109).
 *
 * `(.)` because the stage's address is a child of the segment the slot is declared in; the shelf
 * stays underneath on a soft navigation, and `[slug]/create/mode/page.tsx` is what a hard load hits.
 */
import type { ComponentProps } from "react";
import TemplateCreateModePage from "@/components/flow/template-create/mode";
import { FLOW_MOUNT_DIALOG } from "@/components/assessment-flow/relationship-flow-shell";

export default function Intercepted(props: ComponentProps<typeof TemplateCreateModePage>) {
  return <TemplateCreateModePage {...props} mount={FLOW_MOUNT_DIALOG} />;
}
