/**
 * `/dashboard/templates/[id]/create/mode` — stage 2, **Settings**, at its real address (#1109).
 *
 * The route a refresh or a deep link lands on; the in-app presentation is the
 * `@flow/(.)[slug]/create/mode` interception over the shelf. The stage itself is
 * `components/flow/template-create/mode.tsx`, mounted at its `"page"` default here.
 *
 * The directory is `[id]` and the value is a template **slug** — Next refuses two dynamic segment
 * names at one level, so the flow shares the editor's segment name; `slugFromSegmentParams` is the
 * translation and `create/page.tsx` carries the long version of why.
 */
import type { ComponentProps } from "react";
import TemplateCreateModePage from "@/components/flow/template-create/mode";
import { slugFromSegmentParams } from "@/lib/flow/segment-params";

export { metadata } from "@/components/flow/template-create/mode";

export const dynamic = "force-dynamic";

type RouteProps = Omit<ComponentProps<typeof TemplateCreateModePage>, "params"> & {
  params: Promise<{ id: string }>;
};

export default async function TemplateCreateModeRoute({ params, searchParams }: RouteProps) {
  return (
    <TemplateCreateModePage params={slugFromSegmentParams(params)} searchParams={searchParams} />
  );
}
