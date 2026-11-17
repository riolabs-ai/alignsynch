/**
 * `/dashboard/templates/[id]/create/invite` — stage 5, **Invite**, at its real address (#1109).
 *
 * The relationship it is about travels as `?instance=`, read by the stage from `searchParams`; the
 * page passes them through untouched, so a deep link carries the same query a dialog navigation does.
 *
 * The directory is `[id]` and the value is a template **slug** — Next refuses two dynamic segment
 * names at one level, so the flow shares the editor's segment name; `slugFromSegmentParams` is the
 * translation and `create/page.tsx` carries the long version of why.
 */
import type { ComponentProps } from "react";
import TemplateCreateInvitePage from "@/components/flow/template-create/invite";
import { slugFromSegmentParams } from "@/lib/flow/segment-params";

export { metadata } from "@/components/flow/template-create/invite";

export const dynamic = "force-dynamic";

type RouteProps = Omit<ComponentProps<typeof TemplateCreateInvitePage>, "params"> & {
  params: Promise<{ id: string }>;
};

export default async function TemplateCreateInviteRoute({ params, searchParams }: RouteProps) {
  return (
    <TemplateCreateInvitePage params={slugFromSegmentParams(params)} searchParams={searchParams} />
  );
}
