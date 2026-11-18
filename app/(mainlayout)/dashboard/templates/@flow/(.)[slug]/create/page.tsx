/**
 * Stage 1, Details, intercepted over `/dashboard/templates` (#979 B, #1109).
 *
 * The flow's address is a **child of this segment** since #1109 — `/dashboard/templates/<slug>/create`
 * — so the marker is `(.)`: a soft navigation from the shelf renders this into the `@flow` slot with
 * the shelf still underneath, while a hard load of the same URL renders `[slug]/create/page.tsx`.
 *
 * Not re-implemented: it renders `components/flow/template-create/create.tsx` — the one stage module,
 * which moved out of `app/` in #1109 so the address could change without the component knowing — with
 * `mount={FLOW_MOUNT_DIALOG}`. One component, two mountings, no second copy of a stage.
 */
import type { ComponentProps } from "react";
import TemplateCreatePage from "@/components/flow/template-create/create";
import { FLOW_MOUNT_DIALOG } from "@/components/assessment-flow/relationship-flow-shell";

export default function Intercepted(props: ComponentProps<typeof TemplateCreatePage>) {
  return <TemplateCreatePage {...props} mount={FLOW_MOUNT_DIALOG} />;
}
