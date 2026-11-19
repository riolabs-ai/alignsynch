/**
 * `/dashboard/templates/[id]/create/commit` — stage 4, **Account**, at its real address (#1109).
 *
 * The stage where the relationship is written as a `draft`; the address kept its name and changed its
 * job in #825, and #1109 moved it here without touching either.
 *
 * The directory is `[id]` and the value is a template **slug** — Next refuses two dynamic segment
 * names at one level, so the flow shares the editor's segment name; `slugFromSegmentParams` is the
 * translation and `create/page.tsx` carries the long version of why.
 */
import type { ComponentProps } from "react";
import TemplateCreateCommitPage from "@/components/flow/template-create/commit";
import { slugFromSegmentParams } from "@/lib/flow/segment-params";

export { metadata } from "@/components/flow/template-create/commit";

export const dynamic = "force-dynamic";

type RouteProps = Omit<ComponentProps<typeof TemplateCreateCommitPage>, "params"> & {
  params: Promise<{ id: string }>;
};

export default async function TemplateCreateCommitRoute({ params, searchParams }: RouteProps) {
  return (
    <TemplateCreateCommitPage params={slugFromSegmentParams(params)} searchParams={searchParams} />
  );
}
