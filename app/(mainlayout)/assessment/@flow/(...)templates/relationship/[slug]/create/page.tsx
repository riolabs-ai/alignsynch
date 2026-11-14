/**
 * The flow's Details stage, intercepted over `/assessment` (#979 B).
 *
 * Not re-implemented here: this file renders `TemplateCreatePage` — the route a deep link, a
 * refresh and an invitation link all land on — with `mount={FLOW_MOUNT_DIALOG}`. One stage
 * component, two mountings, and the address stays the stage's own.
 */
import type { ComponentProps } from "react";
import TemplateCreatePage from "@/app/(mainlayout)/templates/relationship/[slug]/create/page";
import { FLOW_MOUNT_DIALOG } from "@/components/assessment-flow/relationship-flow-shell";

export default function Intercepted(props: ComponentProps<typeof TemplateCreatePage>) {
  return <TemplateCreatePage {...props} mount={FLOW_MOUNT_DIALOG} />;
}
