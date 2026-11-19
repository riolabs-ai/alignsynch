/**
 * `/dashboard/templates/[id]/create/aspects` — stage 3, **Aspects**, at its real address (#1109).
 *
 * The stage reads the draft stages 1 and 2 wrote, so a cold open sends the person back to Details
 * rather than drawing a list with no relationship behind it — as a page as much as in the dialog.
 *
 * The directory is `[id]` and the value is a template **slug** — Next refuses two dynamic segment
 * names at one level, so the flow shares the editor's segment name; `slugFromSegmentParams` is the
 * translation and `create/page.tsx` carries the long version of why.
 */
import type { ComponentProps } from "react";
import TemplateCreateAspectsPage from "@/components/flow/template-create/aspects";
import { slugFromSegmentParams } from "@/lib/flow/segment-params";

export { metadata } from "@/components/flow/template-create/aspects";

export const dynamic = "force-dynamic";

type RouteProps = Omit<ComponentProps<typeof TemplateCreateAspectsPage>, "params"> & {
  params: Promise<{ id: string }>;
};

export default async function TemplateCreateAspectsRoute({ params, searchParams }: RouteProps) {
  return (
    <TemplateCreateAspectsPage params={slugFromSegmentParams(params)} searchParams={searchParams} />
  );
}
