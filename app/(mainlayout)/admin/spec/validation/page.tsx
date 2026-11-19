/**
 * `/admin/spec/validation` — the Validation matrix's route (#1252).
 *
 * The gate is `/admin/spec`'s, in the same order (`requireAdminProduct()` then the spec-reader
 * gate), and the refusal is the same unknown-URL 404. What this route renders in this card is the
 * spine's own panel, because the matrix — the pinned three-column screen, its 76 rows and their
 * counts — is the next card (t_f5458e3d). The address exists now so the gate's three states are
 * provable at the depth the submenu will link to, rather than only at the parent.
 *
 * `force-dynamic`, like its parent, and for the same reason: session, profile row, and a source
 * read per request. The `Cache-Control`/`X-Robots-Tag` pair comes from `next.config.mjs`.
 */
import type { Metadata } from "next";

import { SpecSpine } from "@/components/admin/spec/spec-spine";
import { StageColumn } from "@/components/assessment-flow/stage-column";
import { adminSpecPageCopy } from "@/data/pages/admin-spec";
import { ADMIN_SPEC_VALIDATION_PATH } from "@/lib/admin/spec-paths";
import { requireSpecReader } from "@/lib/auth/require-role";
import { requireAdminProduct } from "@/lib/brand-boundary";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: adminSpecPageCopy.heading,
  robots: { index: false, follow: false },
};

export default async function AdminSpecValidationPage() {
  requireAdminProduct();
  await requireSpecReader({ next: ADMIN_SPEC_VALIDATION_PATH });

  return (
    <StageColumn>
      <SpecSpine copy={adminSpecPageCopy} />
    </StageColumn>
  );
}
