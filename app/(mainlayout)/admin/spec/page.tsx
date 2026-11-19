/**
 * `/admin/spec` — the project spec's Overview, and a stakeholder's landing page (#1252).
 *
 * **Two gates, in this order, and the order is the policy.**
 *
 *   1. `requireAdminProduct()` (#509) — the spec is a surface inside the console template, so a
 *      build that does not claim `product.admin` answers the 404 an unknown URL gets, before a
 *      session is read.
 *   2. `requireSpecReader()` (`lib/auth/require-role.ts`) — the *capability*, not the rung:
 *      `stakeholder`, `admin` and `owner` read the spec, `support` does not even though it ranks
 *      above a stakeholder. A member or a support seat gets `notFound()` — byte for byte the
 *      unknown-URL 404, never a 403 and never a redirect, because either of those tells the reader
 *      that there is something here to be refused (s04). A signed-out visitor is sent to
 *      `/login?next=/admin/spec`.
 *
 * **The register is read per request (AS-09).** `readSpecValidationSafe()` opens
 * `data/spec/validation.json` on the visit, so an edited register is live on the next request with
 * no rebuild, and a missing or invalid file is a panel — not a 404, not a 500, not a log line
 * (s04b). `force-dynamic` is what makes the read per request; the `Cache-Control`/`X-Robots-Tag`
 * pair comes from `next.config.mjs`, one place for all three routes.
 *
 * **The greeting is the session's name, never a fixture person.** `requireSpecReader` answers the
 * session it admitted, and the Overview prints its name — falling back to the address's local part
 * for an account that has not set one, the same chain `lib/auth/shell-account.ts` uses.
 *
 * Every word is `data/pages/admin-spec.ts` (E23 budget 0).
 */
import type { Metadata } from "next";

import { SpecFrame } from "@/components/admin/spec/spec-frame";
import { SpecNotice } from "@/components/admin/spec/spec-notice";
import { SpecOverview } from "@/components/admin/spec/spec-overview";
import { StageColumn } from "@/components/assessment-flow/stage-column";
import { adminSpecPageCopy } from "@/data/pages/admin-spec";
import { ADMIN_SPEC_PATH } from "@/lib/admin/spec-paths";
import { requireSpecReader } from "@/lib/auth/require-role";
import { requireAdminProduct } from "@/lib/brand-boundary";
import { readSpecValidationSafe, SPEC_VALIDATION_SOURCE } from "@/lib/spec/file";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: adminSpecPageCopy.heading,
  robots: { index: false, follow: false },
};

export default async function AdminSpecPage() {
  requireAdminProduct();
  const { user } = await requireSpecReader({ next: ADMIN_SPEC_PATH });
  const { doc, reason } = readSpecValidationSafe();

  /** The name the welcome band prints: the session's, or the address's local part. */
  const viewerName = user.name.trim() === "" ? (user.email.split("@")[0] ?? "") : user.name;

  return (
    <StageColumn>
      <SpecFrame copy={adminSpecPageCopy} doc={doc} current={{ kind: "overview" }}>
        {doc === null ? (
          <SpecNotice copy={adminSpecPageCopy} path={SPEC_VALIDATION_SOURCE} reason={reason} />
        ) : (
          <SpecOverview copy={adminSpecPageCopy} doc={doc} viewerName={viewerName} />
        )}
      </SpecFrame>
    </StageColumn>
  );
}
