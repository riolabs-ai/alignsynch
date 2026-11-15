/**
 * The flow's Invite stage, intercepted over `/templates/relationship` (#979 B).
 *
 * The same module the stage's own route renders, mounted as the dialog. Stage 5's own send is a
 * form post, which the dialog captures and follows softly — the library underneath survives it.
 */
import type { ComponentProps } from "react";
import TemplateCreateInvitePage from "@/app/(mainlayout)/templates/relationship/[slug]/create/invite/page";
import { FLOW_MOUNT_DIALOG } from "@/components/assessment-flow/relationship-flow-shell";

export default function Intercepted(props: ComponentProps<typeof TemplateCreateInvitePage>) {
  return <TemplateCreateInvitePage {...props} mount={FLOW_MOUNT_DIALOG} />;
}
