/**
 * The provider's Price ids — one per (tier, interval), **test mode only** (#1010 R2).
 *
 * A subscription needs a Price object to renew against, so stage 5's purchase names one of these
 * instead of writing an inline `price_data` amount into the request. The amount is still authored
 * in exactly one place, `data/billing-plans.ts`; this file carries the **provider's handle** for
 * that amount and nothing else, which is why it is a config module beside the fixture rather than
 * a column on it (the `billing_plan` mirror is a price, not a dashboard id).
 *
 * **What these are.** **Two accounts, two complete sets, and no id crosses between them.** A Price
 * id is account-scoped: the same id resolves on exactly one account and answers
 * `resource_missing: No such price` on the other, which is a checkout that fails in the middle of
 * the flow rather than at configuration time. So each account carries its own row, and
 * `BILLING_KEY_SET` (`lib/billing/adapters/stripe.ts`) picks the row — never a fallback.
 *
 * **`alignsynch-test`** — the AlignSynch test account `acct_1If98uIxC4rz96cc`
 * (`settings.dashboard.display_name = "AlignSynch"`), created 2026-11-14, one Product per tier and
 * a recurring Price per interval, each Price carrying its `lookup_key`:
 *
 *   Basic      prod_Vd1JwLLr4gRqE9   month  price_1UblGqIxC4rz96ccmAumC406   $8.95   (895)
 *                                    year   price_1UblGqIxC4rz96ccmptGY2EQ   $85.92  (8_592)
 *   Principal  prod_Vd1JHMddelStiz   month  price_1UblGrIxC4rz96cc1Zt530Ir   $16.95  (1_695)
 *                                    year   price_1UblGsIxC4rz96ccA1IrDjSA   $162.72 (16_272)
 *
 * **`ventureio-test`** — the Venture I/O test account `acct_19bZw7KKtWHoLhLR`, read live on 2026-11-15
 * with `GET /v1/prices?expand[]=data.product`, four Prices at the **same amounts** and the same
 * `alignsynch_<tier>_<interval>` lookup keys:
 *
 *   Basic      prod_VcoKngMHfNjvvh   month  price_1UbYhtKKtWHoLhLRBv4fuNvT   $8.95   (895)
 *                                    year   price_1UbYhuKKtWHoLhLR9QPb4nfh   $85.92  (8_592)
 *   Principal  prod_VcoK6IzuL7qcx9   month  price_1UbYhvKKtWHoLhLR5LFOHRnk   $16.95  (1_695)
 *                                    year   price_1UbYhwKKtWHoLhLRgTkvF8A9   $162.72 (16_272)
 *
 * Products are listed because they are account-scoped too and a Product id pasted into a Purchase
 * is a 404: the four above are the only Products either set uses. Nothing here is created by this
 * build — a missing id is a refused checkout, never a silent inline amount, and creating one is a
 * spend-adjacent act on a third party that needs the owner's word.
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

/**
 * The key sets that have a Price row — **a Price id is account-scoped and does not travel**.
 *
 * Two test accounts carry the same two tiers at the same amounts, and the same id resolves on
 * exactly one of them: a checkout that names the other account's Price answers
 * `resource_missing: No such price` in the middle of the flow. `BILLING_KEY_SET`
 * (`lib/billing/adapters/stripe.ts`) names one of these sets, and the two vocabularies are asserted
 * against each other by `tests/billing-prices.test.ts` so they cannot drift.
 *
 * **`alignsynch-live` has no row, on purpose.** Live Prices do not exist yet — creating them is a
 * release decision with its own card — so a deployment selecting the live set refuses at
 * `startCheckout` with `not-configured` naming the plan, rather than charging a live customer
 * against a test Price or borrowing the other set's id.
 */
export const BILLING_PRICE_KEY_SETS = ["alignsynch-test", "ventureio-test"] as const;

export type BillingPriceKeySet = (typeof BILLING_PRICE_KEY_SETS)[number];

/**
 * The ids, per key set. **The `alignsynch-test` row is the default** — the set three deployments
 * resolve today when no selector is set — so a deployment that never sets `BILLING_KEY_SET` keeps
 * the ids it already ships.
 */
export const BILLING_PRICE_IDS_BY_KEY_SET: Readonly<
  Record<BillingPriceKeySet, Readonly<Record<PaidPlanId, PlanPriceIds>>>
> = {
  "alignsynch-test": {
    basic: {
      month: "price_1UblGqIxC4rz96ccmAumC406",
      year: "price_1UblGqIxC4rz96ccmptGY2EQ",
    },
    principal: {
      month: "price_1UblGrIxC4rz96cc1Zt530Ir",
      year: "price_1UblGsIxC4rz96ccA1IrDjSA",
    },
  },
  "ventureio-test": {
    basic: {
      month: "price_1UbYhtKKtWHoLhLRBv4fuNvT",
      year: "price_1UbYhuKKtWHoLhLR9QPb4nfh",
    },
    principal: {
      month: "price_1UbYhvKKtWHoLhLR5LFOHRnk",
      year: "price_1UbYhwKKtWHoLhLRgTkvF8A9",
    },
  },
};

/** The default (AlignSynch test) ids, in the order `BILLING_PLAN_IDS` draws the tiers. */
export const BILLING_PRICE_IDS: Readonly<Record<PaidPlanId, PlanPriceIds>> =
  BILLING_PRICE_IDS_BY_KEY_SET["alignsynch-test"];

/**
 * The Price for a (tier, interval) in one key set, or `undefined` — never a fallback id.
 *
 * `keySet` is the selector's value. `null`/unset answers the **default** set, which is what a
 * deployment with no `BILLING_KEY_SET` has always got; a set name answers that set's row and
 * nothing else, so a missing row (or a set with no row at all, like `alignsynch-live` today) is a
 * refusal the caller names rather than a Price from another account — the failure nobody notices
 * until a customer cannot pay.
 *
 * `undefined` is also the answer for the free tier, for a tier this build does not sell, and for
 * a pair nobody has created a Price for; the caller refuses with that pair named.
 */
export function billingPriceIdFor(
  planId: string,
  interval: BillingInterval,
  keySet?: string | null,
): string | undefined {
  if (planId !== "basic" && planId !== "principal") return undefined;
  const set =
    keySet === null || keySet === undefined || keySet === ""
      ? BILLING_PRICE_IDS
      : BILLING_PRICE_IDS_BY_KEY_SET[keySet as BillingPriceKeySet];
  if (set === undefined) return undefined;
  return set[planId][interval];
}
