/**
 * data/v1/plans.ts — the per-relationship subscription plans, one home.
 *
 * The public `/v1/pricing` and the initiator's in-app shop (`/v1/[persona]/shop`) are the same
 * component with a capability check (#384 §3), and the money each surface shows comes from this
 * one file. A price the marketing page prints is the price the shop's prototype checkout applies —
 * there is no second list to drift.
 *
 * The two plans are the prototype's own vocabulary (`data/v1/fixtures.ts`): the Initiator
 * subscribes monthly or quarterly, per relationship, and the counterparty pays nothing, ever.
 * Both prices derive from the single cents constant `RELATIONSHIP_PRICE_CENTS`
 * (`data/v1/relationship-types.ts`), which is itself the Basic plan's monthly price
 * (`data/billing-plans.ts`). Quarterly is three months at the monthly rate, with **no discount**
 * — there is no "save 20%" line because the prototype does not invent one, and no tax or total
 * is computed anywhere.
 *
 * Imported through relative paths so `tsconfig.datacheck.json` (module: commonjs, no `@/` alias)
 * compiles it exactly as it compiles `data/v1/fixtures.ts`. Nothing here is a component and
 * nothing reads a clock at render: no React, no Next, no `lib/db/**`.
 */
import type { SubscriptionPlan } from "./fixtures";
import { RELATIONSHIP_PRICE_CENTS } from "./relationship-types";

/** One plan the shop offers and `/v1/pricing` prints. */
export interface SubscriptionPlanInfo {
  readonly id: SubscriptionPlan;
  /** The word the card renders: "Monthly" / "Quarterly". */
  readonly label: string;
  /** The cadence, said plainly: "billed every month" / "billed every three months". */
  readonly cadence: string;
  /** Integer cents charged per period. Quarterly is three months, no discount. */
  readonly priceCents: number;
  /** The period in days, so a checkout and a renewal extend the same way. */
  readonly periodDays: number;
}

/** What every plan buys — the one sentence both surfaces repeat. */
export const WHAT_EACH_BUYS =
  "Unlimited sessions for that relationship while it is in good standing.";

/** One month, in cents — the single price `RELATIONSHIP_PRICE_CENTS` already carries. */
export const MONTHLY_CENTS = RELATIONSHIP_PRICE_CENTS;

/** Three months, in cents — the monthly rate times three, no discount. */
export const QUARTERLY_CENTS = RELATIONSHIP_PRICE_CENTS * 3;

/** The two plans, monthly first. */
export const subscriptionPlans: readonly SubscriptionPlanInfo[] = [
  {
    id: "monthly",
    label: "Monthly",
    cadence: "billed every month",
    priceCents: MONTHLY_CENTS,
    periodDays: 30,
  },
  {
    id: "quarterly",
    label: "Quarterly",
    cadence: "billed every three months",
    priceCents: QUARTERLY_CENTS,
    periodDays: 90,
  },
];

/** The plan for an id — never a default, so a bad id is a named failure. */
export function subscriptionPlan(id: SubscriptionPlan): SubscriptionPlanInfo {
  const plan = subscriptionPlans.find((candidate) => candidate.id === id);
  if (plan === undefined) throw new Error(`plans: no subscription plan "${id}"`);
  return plan;
}

/** The amount a checkout applies for a plan, in cents. */
export function subscriptionPriceCents(id: SubscriptionPlan): number {
  return subscriptionPlan(id).priceCents;
}
