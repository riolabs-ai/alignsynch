/**
 * `/admin/brand` — the brand and audience profile, behind the console's gate (#906).
 *
 * **What it is.** The company story — positioning, who the product is for, how the flow works and
 * the three reusable profile descriptions — rendered as a page instead of living in a private HTML
 * file only the people holding the folder can read. An operator can read the canonical wording while
 * writing a release note or a support reply, and the wording has one home that is not a copy in
 * somebody's downloads folder. It is a **reference page**: no form, no save, no edit affordance and
 * no server action. Editing the words happens in the canon, never here.
 *
 * **Three gates, in this order, before any read.**
 *
 *   1. `requireAdminProduct()` — the console is a template capability (`product.admin`), so a
 *      template that sells no console answers the 404 an unknown URL gets, with no session read
 *      behind it (`lib/brand-boundary.ts`).
 *   2. `requireAlignmentProduct()` — **the "never on QuizHub" rule, and it is a capability, not a
 *      brand name.** The brand story is the alignment product's; a quiz-only build answering 200
 *      for it is the "fifty-two wrong statements" failure `product.quiz-surfaces` exists to stop,
 *      read from the side that does not ship the quiz catalogue so the two answers cannot disagree.
 *   3. `requireAdmin({ next })` — signed out → `redirect("/login?next=/admin/brand")`, a member →
 *      `notFound()` (the same 404 an unknown URL returns; a 403 would confirm the page exists), an
 *      admin or owner → render. The order is documented on `/admin/health` and pinned for this page
 *      by `tests/admin-brand.test.tsx`, which drives a `member` through the real policy.
 *
 * **On a tree with no `NEON_AUTH_*` env a request answers the documented 500**
 * (`NEON_AUTH_BASE_URL is not set`), exactly like the rest of the gated set — `currentUser()` builds
 * the auth server outside its `try` on purpose. That is the expected answer for a fresh clone, not a
 * defect to card, and the gate never issues a request: `pnpm build` passes with no auth env.
 *
 * **`noindex, nofollow, noarchive`.** The mockup carries all three and so does the served page —
 * `noarchive` being the one that matters most here, because a search engine holding a cached copy of
 * a private strategy document would outlive the session allowed to read it. `/admin/health` omits
 * `noarchive`; this page does not.
 *
 * **Request-time.** The gate reads a session, so the page renders per request; `force-dynamic` is
 * stated rather than inferred, the way the console's other screens state it.
 */
import type { Metadata } from "next";

import { BrandProfile } from "@/components/admin/brand-profile";
import { StageColumn } from "@/components/assessment-flow/stage-column";
import { adminBrandPageCopy } from "@/data/pages/admin-brand";
import { requireAdmin } from "@/lib/auth/require-role";
import { requireAdminProduct, requireAlignmentProduct } from "@/lib/brand-boundary";
import { ADMIN_BRAND_PATH } from "@/lib/shell/admin-notice";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: adminBrandPageCopy.heading,
  robots: { index: false, follow: false, noarchive: true },
};

export default async function AdminBrandPage() {
  // The capability before the role: a template that does not claim the console answers the 404 an
  // unknown URL gets, and only then does a session get read.
  requireAdminProduct();
  // …and the alignment product before the role too: a quiz-only build sells no brand story.
  requireAlignmentProduct();
  await requireAdmin({ next: ADMIN_BRAND_PATH });

  return (
    <StageColumn>
      <BrandProfile copy={adminBrandPageCopy} />
    </StageColumn>
  );
}
