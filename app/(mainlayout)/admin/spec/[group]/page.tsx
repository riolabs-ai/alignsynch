/**
 * `/admin/spec/[group]` — one group's story page (#1252).
 *
 * The gate is the parent's, in the same order: `requireAdminProduct()` (#509) and then
 * `requireSpecReader()`, so a member or a support seat is answered with the unknown-URL 404 and a
 * signed-out visitor is sent to `/login?next=/admin/spec/<group>`.
 *
 * **The segment is not a vocabulary check.** Eleven group ids exist in the source the next card
 * reads (t_f5458e3d); this route accepts whatever the address named and renders it in the fixture's
 * sentence, because a 404 on a mistyped group would be indistinguishable from the *gate's* 404 —
 * which is the one answer that must stay unambiguous. The reader card decides what a group id means.
 *
 * **`params` is a Promise in Next 16**, so it is awaited before the gate: the `next` this page hands
 * `/login` is the address the person actually asked for, not a placeholder.
 *
 * `force-dynamic`, like its two siblings; the `Cache-Control`/`X-Robots-Tag` pair is
 * `next.config.mjs`'s.
 */
import type { Metadata } from "next";

import { SpecSpine } from "@/components/admin/spec/spec-spine";
import { StageColumn } from "@/components/assessment-flow/stage-column";
import { adminSpecPageCopy } from "@/data/pages/admin-spec";
import { adminSpecGroupPath } from "@/lib/admin/spec-paths";
import { requireSpecReader } from "@/lib/auth/require-role";
import { requireAdminProduct } from "@/lib/brand-boundary";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: adminSpecPageCopy.heading,
  robots: { index: false, follow: false },
};

export default async function AdminSpecGroupPage({
  params,
}: {
  params: Promise<{ group: string }>;
}) {
  const { group } = await params;

  requireAdminProduct();
  await requireSpecReader({ next: adminSpecGroupPath(group) });

  return (
    <StageColumn>
      <SpecSpine copy={adminSpecPageCopy} group={group} />
    </StageColumn>
  );
}
