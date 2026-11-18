/**
 * Stage 5, Invite, intercepted over `/assessment` (#979 B, #1109).
 *
 * The invite query (`?instance=`) rides on the intercepted address and is read by the stage module,
 * not here: the props are forwarded whole.
 */
import type { ComponentProps } from "react";
import TemplateCreateInvitePage from "@/components/flow/template-create/invite";
import { FLOW_MOUNT_DIALOG } from "@/components/assessment-flow/relationship-flow-shell";

export default function Intercepted(props: ComponentProps<typeof TemplateCreateInvitePage>) {
  return <TemplateCreateInvitePage {...props} mount={FLOW_MOUNT_DIALOG} />;
}
