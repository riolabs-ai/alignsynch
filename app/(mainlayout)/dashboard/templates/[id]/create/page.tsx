/**
 * `/dashboard/templates/[id]/create` — the flow's stage 1, **Details**, at its real address (#1109).
 *
 * **Why this file is thin, and why it exists at all.** The stage itself is
 * `components/flow/template-create/create.tsx`: #1109 moved the five stage modules out of
 * `/templates/relationship/[slug]/create/**` so one module could be both a page and a `@flow` slot
 * child, and so the old tree could be retired without deleting the flow. This file is the **route**:
 * the interception at `@flow/(.)[slug]/create` only fires on a client navigation, so a refresh, a
 * deep link or an invitation link needs a page the tree really renders — and this is it. Same
 * module, two mountings; `mount` stays at its `"page"` default here.
 *
 * **The segment is `[id]`, and its value is a slug.** The URL is
 * `/dashboard/templates/<slug>/create`, unchanged; the *directory* is named `[id]` because Next
 * refuses two different dynamic segment names at one level — `You cannot use different slug names for
 * the same dynamic path ('id' !== 'slug')` — and the editor next door is
 * `/dashboard/templates/[id]`. The failure that rule produces is the one worth knowing: `next build`
 * passes, `scripts/verify.sh` passes and CI passes, while `next dev` and `next start` both refuse to
 * boot, so the app serves nothing. `slugFromSegmentParams` is the whole translation: a `/create` URL
 * carries a template **slug** (the fact the flow has used since #794), while the segment it arrives
 * under is the editor's **id**. The two names mean different things on purpose — the editor keys on
 * `record.id`, the flow keys on `record.slug` — and only the segment *name* is shared, because it has
 * to be.
 *
 * `dynamic` is declared here rather than only re-exported, because a route that reads a database must
 * be request-time at build (`pnpm build` runs with no `DATABASE_URL`). `metadata` is re-exported from
 * the module: one title, one place.
 */
import type { ComponentProps } from "react";
import TemplateCreatePage from "@/components/flow/template-create/create";
import { slugFromSegmentParams } from "@/lib/flow/segment-params";

export { metadata } from "@/components/flow/template-create/create";

export const dynamic = "force-dynamic";

type RouteProps = Omit<ComponentProps<typeof TemplateCreatePage>, "params"> & {
  params: Promise<{ id: string }>;
};

export default async function TemplateCreateRoute({ params, searchParams }: RouteProps) {
  return <TemplateCreatePage params={slugFromSegmentParams(params)} searchParams={searchParams} />;
}
