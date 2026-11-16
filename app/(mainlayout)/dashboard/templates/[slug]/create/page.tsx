/**
 * `/dashboard/templates/[slug]/create` — the flow's stage 1, **Details**, at its real address (#1109).
 *
 * **Why this file is thin, and why it exists at all.** The stage itself is
 * `components/flow/template-create/create.tsx`: #1109 moved the five stage modules out of
 * `/templates/relationship/[slug]/create/**` so one module could be both a page and a `@flow` slot
 * child, and so the old tree could be retired without deleting the flow. This file is the **route**:
 * the interception at `@flow/(.)[slug]/create` only fires on a client navigation, so a refresh, a
 * deep link or an invitation link needs a page the tree really renders — and this is it. Same
 * module, two mountings; `mount` stays at its `"page"` default here.
 *
 * **`[slug]` beside the editor's `[id]`, and the two mean different things.** `/dashboard/templates/<x>`
 * is the member's editor, addressed by `record.id`; `<x>` under `/create` is the template's
 * `record.slug`, the URL fact the flow has used since #794. Next 16 resolves the two dynamic siblings
 * by depth — `[id]` has no `create` child, `[slug]` has no page of its own — so the pair never
 * compete for one URL; the build lists both, and `[slug]/create*` is the only branch below
 * `/dashboard/templates` that is not the editor.
 *
 * `dynamic` is declared here rather than only re-exported, because a route that reads a database must
 * be request-time at build (`pnpm build` runs with no `DATABASE_URL`). `metadata` is re-exported from
 * the module: one title, one place.
 */
import type { ComponentProps } from "react";
import TemplateCreatePage from "@/components/flow/template-create/create";

export { metadata } from "@/components/flow/template-create/create";

export const dynamic = "force-dynamic";

export default function TemplateCreateRoute(props: ComponentProps<typeof TemplateCreatePage>) {
  return <TemplateCreatePage {...props} />;
}
