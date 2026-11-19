/**
 * Stage 4, Account (committed at `/create/commit`), intercepted over `/assessment` (#979 B, #1109).
 */
import type { ComponentProps } from "react";
import TemplateCreateCommitPage from "@/components/flow/template-create/commit";
import { FLOW_MOUNT_DIALOG } from "@/components/assessment-flow/relationship-flow-shell";

export default function Intercepted(props: ComponentProps<typeof TemplateCreateCommitPage>) {
  return <TemplateCreateCommitPage {...props} mount={FLOW_MOUNT_DIALOG} />;
}
