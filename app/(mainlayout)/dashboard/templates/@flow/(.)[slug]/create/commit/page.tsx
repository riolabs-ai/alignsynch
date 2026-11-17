/**
 * Stage 4, Account (committed at `/create/commit`), intercepted over `/dashboard/templates`
 * (#979 B, #1109).
 *
 * `(.)`: the stage's address is a child of the shelf's own segment, so the dialog opens over the
 * shelf and a refresh of the same URL renders the stage as a page.
 */
import type { ComponentProps } from "react";
import TemplateCreateCommitPage from "@/components/flow/template-create/commit";
import { FLOW_MOUNT_DIALOG } from "@/components/assessment-flow/relationship-flow-shell";

export default function Intercepted(props: ComponentProps<typeof TemplateCreateCommitPage>) {
  return <TemplateCreateCommitPage {...props} mount={FLOW_MOUNT_DIALOG} />;
}
