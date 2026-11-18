/**
 * Stage 5, Invite, intercepted over `/dashboard/templates` (#979 B, #1109).
 *
 * The last stage's address is a child of the shelf's own segment, so `(.)` opens it over the shelf;
 * `[slug]/create/invite/page.tsx` answers the same URL on a hard load.
 */
import type { ComponentProps } from "react";
import TemplateCreateInvitePage from "@/components/flow/template-create/invite";
import { FLOW_MOUNT_DIALOG } from "@/components/assessment-flow/relationship-flow-shell";

export default function Intercepted(props: ComponentProps<typeof TemplateCreateInvitePage>) {
  return <TemplateCreateInvitePage {...props} mount={FLOW_MOUNT_DIALOG} />;
}
