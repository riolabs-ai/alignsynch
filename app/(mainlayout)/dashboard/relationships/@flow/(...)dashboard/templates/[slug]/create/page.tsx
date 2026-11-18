/**
 * Stage 1, Details, intercepted over `/dashboard/relationships` (#979 B, #1109).
 *
 * **The stage is not re-implemented here.** This file is the mounting and nothing else: it renders
 * `components/flow/template-create/create.tsx` with `mount={FLOW_MOUNT_DIALOG}`, and
 * `RelationshipFlowShell` decides that the frame is drawn over the page underneath instead of on a
 * page of its own. One stage component, two mountings, so the dialog cannot drift from the page it
 * claims to be.
 *
 * **`(...)` because the flow's address is no longer under this segment.** Since #1109 the stage is
 * `/dashboard/templates/<slug>/create`; the marker reads from the root, and the address stays the
 * stage's own — a refresh of it renders `[slug]/create/page.tsx` as a page, which is the deep-link
 * parity the flow requires.
 *
 * **Why the props are forwarded, not rebuilt.** `params` and `searchParams` are the target route's
 * own arguments, including the refusal codes (`?problem=&field=`) a refused post answers with. A
 * second parser here would be a second reading of the same address.
 */
import type { ComponentProps } from "react";
import TemplateCreatePage from "@/components/flow/template-create/create";
import { FLOW_MOUNT_DIALOG } from "@/components/assessment-flow/relationship-flow-shell";

export default function Intercepted(props: ComponentProps<typeof TemplateCreatePage>) {
  return <TemplateCreatePage {...props} mount={FLOW_MOUNT_DIALOG} />;
}
