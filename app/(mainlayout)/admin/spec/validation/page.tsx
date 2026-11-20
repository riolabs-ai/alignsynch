/**
 * `/admin/spec/validation` — the Validation matrix (#1252).
 *
 * The gate is `/admin/spec`'s, in the same order (`requireAdminProduct()` then the spec-reader
 * gate), and the refusal is the same unknown-URL 404. What this route adds is the reader: the
 * pinned three-column screen — a sticky status box, the four sections in the agreement's order,
 * and every row with its Definition of Done and its release evidence (s02, AS-07).
 *
 * **The register is read here, per request (AS-09).** `readSpecValidationSafe()` opens
 * `data/spec/validation.json` on the visit and hands it down; a missing or invalid file draws the
 * honest panel instead (s04b), answers 200 and logs nothing as an error. `force-dynamic` is what
 * makes the read per request, and the `Cache-Control`/`X-Robots-Tag` pair is `next.config.mjs`'s.
 *
 * Every word is `data/pages/admin-spec.ts`; every row is the register's (E23 budget 0).
 */
import type { Metadata } from "next";

import { SpecFrame } from "@/components/admin/spec/spec-frame";
import { SpecNotice } from "@/components/admin/spec/spec-notice";
import { ValidationMatrix } from "@/components/admin/spec/validation-matrix";
import { StageColumn } from "@/components/assessment-flow/stage-column";
import { adminSpecPageCopy } from "@/data/pages/admin-spec";
import { ADMIN_SPEC_VALIDATION_PATH } from "@/lib/admin/spec-paths";
import { requireSpecReader } from "@/lib/auth/require-role";
import { requireAdminProduct } from "@/lib/brand-boundary";
import { readSpecValidationSafe, SPEC_VALIDATION_SOURCE } from "@/lib/spec/file";
import { readSpecIssues } from "@/lib/spec/issues-cache";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: adminSpecPageCopy.heading,
  robots: { index: false, follow: false },
};

export default async function AdminSpecValidationPage() {
  requireAdminProduct();
  await requireSpecReader({ next: ADMIN_SPEC_VALIDATION_PATH });
  const { doc, reason } = readSpecValidationSafe();
  /**
   * The GitHub read (#1296), in parallel with nothing else and never a blocking dependency: it
   * answers the cached set, the last copy the process read, or a degraded reason — and the register
   * below is drawn from `data/spec/validation.json` whatever it says.
   */
  const issues = await readSpecIssues();

  return (
    <StageColumn>
      <SpecFrame copy={adminSpecPageCopy} doc={doc} current={{ kind: "validation" }}>
        {doc === null ? (
          <SpecNotice copy={adminSpecPageCopy} path={SPEC_VALIDATION_SOURCE} reason={reason} />
        ) : (
          <ValidationMatrix copy={adminSpecPageCopy} doc={doc} issues={issues} />
        )}
      </SpecFrame>
    </StageColumn>
  );
}
