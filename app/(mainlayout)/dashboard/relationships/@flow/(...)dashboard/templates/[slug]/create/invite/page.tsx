/**
 * Stage 5, Invite, intercepted over `/dashboard/relationships` (#979 B, #1109).
 *
 * The relationship this stage is about travels as `?instance=` on the address it intercepts, and the
 * props are forwarded whole so that query is the stage's own reading and not a second one here.
 */
import type { ComponentProps } from "react";
import TemplateCreateInvitePage from "@/components/flow/template-create/invite";
import { FLOW_MOUNT_DIALOG } from "@/components/assessment-flow/relationship-flow-shell";

export default function Intercepted(props: ComponentProps<typeof TemplateCreateInvitePage>) {
  return <TemplateCreateInvitePage {...props} mount={FLOW_MOUNT_DIALOG} />;
}
