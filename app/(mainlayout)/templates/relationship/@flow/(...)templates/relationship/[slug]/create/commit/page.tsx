/**
 * The flow's Account stage, intercepted over `/templates/relationship` (#979 B).
 *
 * The same module the stage's own route renders, mounted as the dialog — the embedded sign-in and
 * sign-up forms are this stage's body, and they are the ones drawn here.
 */
import type { ComponentProps } from "react";
import TemplateCreateCommitPage from "@/app/(mainlayout)/templates/relationship/[slug]/create/commit/page";
import { FLOW_MOUNT_DIALOG } from "@/components/assessment-flow/relationship-flow-shell";

export default function Intercepted(props: ComponentProps<typeof TemplateCreateCommitPage>) {
  return <TemplateCreateCommitPage {...props} mount={FLOW_MOUNT_DIALOG} />;
}
