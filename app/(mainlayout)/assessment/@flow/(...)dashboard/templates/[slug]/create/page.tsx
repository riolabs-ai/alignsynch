/**
 * Stage 1, Details, intercepted over `/assessment` (#979 B, #1109).
 *
 * Not re-implemented here: this file renders `components/flow/template-create/create.tsx` — the
 * stage a deep link, a refresh and an invitation link all land on — with `mount={FLOW_MOUNT_DIALOG}`.
 * One stage component, two mountings, and the address stays the stage's own.
 *
 * `(...)` reads from the root because the stage's address left this segment in #1109: it is
 * `/dashboard/templates/<slug>/create`, so the catalogue stays underneath on a soft navigation and
 * `[slug]/create/page.tsx` answers a hard load.
 */
import type { ComponentProps } from "react";
import TemplateCreatePage from "@/components/flow/template-create/create";
import { FLOW_MOUNT_DIALOG } from "@/components/assessment-flow/relationship-flow-shell";

export default function Intercepted(props: ComponentProps<typeof TemplateCreatePage>) {
  return <TemplateCreatePage {...props} mount={FLOW_MOUNT_DIALOG} />;
}
