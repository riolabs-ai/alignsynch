/**
 * The provider's Price ids — one per (tier, interval), **test mode only** (#1010 R2).
 *
 * A subscription needs a Price object to renew against, so stage 5's purchase names one of these
 * instead of writing an inline `price_data` amount into the request. The amount is still authored
 * in exactly one place, `data/billing-plans.ts`; this file carries the **provider's handle** for
 * that amount and nothing else, which is why it is a config module beside the fixture rather than
 * a column on it (the `billing_plan` mirror is a price, not a dashboard id).
 *
 * **What these are.** Created 2026-11-13 with the test-mode secret key against the shared test
 * account, one Product per tier and a recurring Price per interval:
 *
 *   Basic      prod_VcoKngMHfNjvvh   month  price_1UbYhtKKtWHoLhLRB4fuNvT   $8.95   (895)
 *                                    year   price_1UbYhuKKtWHoLhLR9QPb4nfh   $85.92  (8_592)
 *   Principal  prod_VcoK6IzuL7qcx9   month  price_1UbYhvKKtWHoLhLR5LFOHRnk   $16.95  (1_695)
 *                                    year   price_1UbYhwKKtWHoLhLRgTkvF8A9   $162.72 (16_272)
 *
 * The yearly pair exists because `/pricing` sells both intervals (`pricing-plans.ts`'s switch posts
 * `interval: "year"`); a tier/interval with no Price here is a checkout this adapter **refuses**
 * (`startCheckout` answers `not-for-sale`), so the fixture and this file have to agree row for row.
 * `tests/billing-prices.test.ts` asserts that they do, and that every id is a Price (never a live
 * one, never a Product).
 *
 * **Live mode is not a configuration this file can hold.** There is no `livemode` switch, no second
 * map and no fallback: creating the live Prices is a release decision with its own card, and until
 * it happens a live-key deployment refuses at `stripeCredentialsFromEnv()` (which accepts
 * `sk_test_…` and nothing else). A missing id is a refused checkout, never a silent inline amount.
 *
 * Each Price carries a `lookup_key` (`alignsynch_<tier>_<interval>`) so a re-run of the creation
 * command is recognisable in the dashboard instead of making a fourth copy of the same amount.
 */

import type { BillingInterval, BillingPlanId } from "./billing-plans";

/** The tier that is actually sold. Free is a relationship limit, never a purchase. */
export type PaidPlanId = Exclude<BillingPlanId, "free">;

/**
 * How many days the membership is free before the first charge.
 *
 * One home for the number: the checkout sends it (`subscription_data[trial_period_days]`) and every
 * sentence that promises "7 days" is reading the same intent. Changing it is a product decision;
 * changing it in one place and not the other is the defect this constant prevents.
 */
export const TRIAL_PERIOD_DAYS = 7;

/** The provider's Price id per interval. `undefined` would be a checkout that cannot charge. */
export type PlanPriceIds = Readonly<Record<BillingInterval, string>>;

/** The ids, in the order `BILLING_PLAN_IDS` draws the tiers. */
export const BILLING_PRICE_IDS: Readonly<Record<PaidPlanId, PlanPriceIds>> = {
  basic: {
    month: "price_1UbYhtKKtWHoLhLRBv4fuNvT",
    year: "price_1UbYhuKKtWHoLhLR9QPb4nfh",
  },
  principal: {
    month: "price_1UbYhvKKtWHoLhLR5LFOHRnk",
    year: "price_1UbYhwKKtWHoLhLRgTkvF8A9",
  },
};

/**
 * The Price for a (tier, interval), or `undefined` — never a fallback id.
 *
 * `undefined` is the answer for the free tier, for a tier this build does not sell, and for a pair
 * nobody has created a Price for; the caller refuses with that pair named.
 */
export function billingPriceIdFor(planId: string, interval: BillingInterval): string | undefined {
  if (planId !== "basic" && planId !== "principal") return undefined;
  return BILLING_PRICE_IDS[planId][interval];
}
