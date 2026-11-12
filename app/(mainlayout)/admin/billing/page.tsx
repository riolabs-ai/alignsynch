/**
 * template-ancestor: components/my-quizzes/quiz-statistics.tsx   (variation: the quiz's metric cards become the plan counts, and its per-question table becomes one row per relationship — plan, period, provider state and the live/test badge, with a single audited grant band below in place of the chart tabs)
 *
 * `/admin/billing` — subscription state per relationship, and the owner's comp (#505, epic #500).
 *
 * **Why it exists.** `billing_subscription` has existed since #289 and the console could not see it:
 * an operator answering "is this customer paying, and is it a real charge?" had to open a SQL
 * client. This screen is that answer, and its first sentence is the one a reader could get wrong —
 * every row on a test-key deployment is a real row and not real money, so the mode is a banner at
 * the top of the list and a badge on every row, never a footnote.
 *
 * **Three gates, in the console's order.** `requireAdminProduct()` first (#509): a template that
 * does not claim `product.admin` answers the 404 an unknown URL gets, with no session read. Then
 * `requireAdmin()` — a signed-out visitor goes to `/login?next=/admin/billing`, a **`support`**
 * session gets `notFound()` (the same 404, never a 403 that confirms the page exists), and an
 * `admin` or `owner` session reaches the read. Then the read, then the render. The role the gate
 * *used* is passed down so the comp band can say what the floor is; it is never the enforcement —
 * `act()` re-reads the actor's rung inside the transaction (`plan.comp` is `owner`-floored).
 *
 * **Read-only except for one band.** The page imports one write path
 * (`./actions` → `lib/admin/billing-control.ts` → `act()`), and every other number on it is a
 * `SELECT`. Nothing here selects a payment instrument: `lib/db/admin-billing.ts` names its columns
 * and they are an id, a state, a period and a boolean.
 *
 * **No clock.** Every instant on the page is the row's own (`current_period_end`, a grant's period,
 * the read's `created_at`) formatted by `content/core.ts`; the comp's period start comes from the
 * operator's date input, so this render never calls `new Date()` and cannot disagree with its own
 * hydration.
 *
 * **`force-dynamic`**, for the registry's reason: the guard reads a session and a profile row, the
 * list is a database read on every visit, and `pnpm build` must keep passing with no `DATABASE_URL`
 * and no `NEON_AUTH_*`.
 */
import type { Metadata } from "next";

import { BillingControl } from "@/components/admin/billing-control";
import { adminBillingPageCopy } from "@/data/pages/admin-billing";
import { BILLING_PLAN_IDS, billingPlan, billingPlans } from "@/data/billing-plans";
import { ADMIN_BILLING_PATH } from "@/lib/admin/paths";
import { requireAdmin } from "@/lib/auth/require-role";
import { entitlementForPlan } from "@/lib/billing/entitlements";
import { requireAdminProduct } from "@/lib/brand-boundary";
import { countsOf, readAdminBilling, type AdminBillingRow } from "@/lib/db/admin-billing";
import { DatabaseUnavailableError } from "@/lib/db/client";

import { performComp } from "./actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: adminBillingPageCopy.heading,
  robots: { index: false, follow: false },
};

/**
 * The plan limits, from the same function the gate calls — so a screen saying "Free: 1" cannot
 * disagree with a refusal that says the same thing. `entitlementForPlan` falls back to Free for an
 * id the fixture does not carry, which is the direction a gate must fail in.
 */
const PLAN_LIMITS = BILLING_PLAN_IDS.map((planId) => {
  const entitlement = entitlementForPlan(planId);
  return {
    id: entitlement.planId,
    name: entitlement.planName,
    limit: entitlement.maxActiveRelationships,
  };
});

/** The tiers a comp may grant: the ones a checkout sells. Free is every account's floor already. */
const GRANTABLE_PLANS = billingPlans
  .filter((plan) => plan.checkout)
  .map((plan) => ({ id: plan.id, name: plan.name }));

export default async function AdminBillingPage() {
  // The capability before the role (#509), then the rung. A `support` session never reaches the
  // read below — `notFound()` is thrown, not returned.
  requireAdminProduct();
  const { role } = await requireAdmin({ next: ADMIN_BILLING_PATH });

  let rows: AdminBillingRow[] | null = null;
  let unreadable: string | null = null;
  try {
    rows = await readAdminBilling();
  } catch (error) {
    if (!(error instanceof DatabaseUnavailableError)) throw error;
    console.error("admin-billing: the rows could not be read", error);
    unreadable = error.reason;
  }

  // An unknown tier reads Free's limit: the narrowest answer, for the reason
  // `entitlingPlanId()` gives — a gate must never widen because a row is wrong.
  const limitFor = (planId: string) => {
    const plan = billingPlan(planId);
    return entitlementForPlan(plan?.id ?? "free").maxActiveRelationships;
  };

  return (
    <BillingControl
      copy={adminBillingPageCopy}
      rows={rows ?? []}
      counts={countsOf(rows ?? [], limitFor)}
      limits={PLAN_LIMITS}
      grantable={GRANTABLE_PLANS}
      role={role}
      unreadable={unreadable}
      action={performComp}
    />
  );
}
