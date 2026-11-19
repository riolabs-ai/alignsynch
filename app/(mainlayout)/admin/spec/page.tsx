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
 * **Request-time, always.** `force-dynamic`: the gate reads a cookie, a session and a profile row,
 * and the reader the next card adds reads its source per request. The headers
 * (`Cache-Control: private, no-store`, `X-Robots-Tag: noindex`) come from `next.config.mjs`, one
 * place for all three routes, because a per-page header is a header somebody's new page forgets.
 *
 * **What it draws is the spine**, not the reader: see `components/admin/spec/spec-spine.tsx`. Every
 * word is `data/pages/admin-spec.ts`, and the E23 budget for this route is 0.
 */
import type { Metadata } from "next";

import { SpecSpine } from "@/components/admin/spec/spec-spine";
import { StageColumn } from "@/components/assessment-flow/stage-column";
import { adminSpecPageCopy } from "@/data/pages/admin-spec";
import { ADMIN_SPEC_PATH } from "@/lib/admin/spec-paths";
import { requireSpecReader } from "@/lib/auth/require-role";
import { requireAdminProduct } from "@/lib/brand-boundary";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: adminSpecPageCopy.heading,
  robots: { index: false, follow: false },
};

export default async function AdminSpecPage() {
  requireAdminProduct();
  await requireSpecReader({ next: ADMIN_SPEC_PATH });

  return (
    <StageColumn>
      <SpecSpine copy={adminSpecPageCopy} />
    </StageColumn>
  );
}
