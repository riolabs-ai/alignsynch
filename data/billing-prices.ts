/**
 * The provider's Price **lookup keys** — one per (tier, interval), **test mode only** (#1010 R2).
 *
 * A subscription needs a Price object to renew against, so stage 5's purchase names one of these
 * instead of writing an inline `price_data` amount into the request. The amount is still authored
 * in exactly one place, `data/billing-plans.ts`; this file carries the **provider's handle** for
 * that amount and nothing else, which is why it is a config module beside the fixture rather than
 * a column on it (the `billing_plan` mirror is a price, not a dashboard id).
 *
 * **Why a lookup key and not a Price id.** A Price id is account-scoped and does not travel: the
 * same id resolves on exactly one account and answers `resource_missing: No such price` on the
 * other, in the middle of the flow. A table of ids per account is therefore a table that has to be
 * edited on every key-set switch, and its failure mode is a checkout that silently names the wrong
 * account's Price. A `lookup_key` is **account-independent** — the same four keys resolve on both
 * test accounts, measured 2026-11-15 with `GET /v1/prices?lookup_keys[]=…` against each — so this
 * file names four strings, and `lib/billing/adapters/stripe.ts` resolves each against whichever
 * account `BILLING_KEY_SET` selected.
 *
 * The four keys, and what each resolves to on each account (same amounts, different ids):
 *
 *   plan/interval   lookup key                   $      current account   Venture I/O
 *   Basic month     alignsynch_basic_month      8.95   …GqIxC4rz96cc…    …htKKtWHoLhLR…
 *   Basic year      alignsynch_basic_year      85.92   …GqIxC4rz96cc…    …huKKtWHoLhLR…
 *   Principal month alignsynch_principal_month 16.95   …GrIxC4rz96cc…    …hvKKtWHoLhLR…
 *   Principal year  alignsynch_principal_year 162.72   …GsIxC4rz96cc…    …hwKKtWHoLhLR…
 *
 * Ids are deliberately not written here: an id in this file is a value that belongs to one account,
 * and the whole point of the lookup key is that no such value lives in the tree.
 *
 * The yearly pair exists because `/pricing` sells both intervals (`pricing-plans.ts`'s switch posts
 * `interval: "year"`); a tier/interval this file has no key for is a checkout the adapter refuses
 * (`not-for-sale`), so the fixture and this file have to agree row for row.
 * `tests/billing-prices.test.ts` asserts that they do, that every key is unique, and that the key
 * names the plan and interval it is filed under.
 *
 * **Test mode is not a switch this file can hold.** There is no `livemode` key, no live map and no
 * fallback: this product runs every environment in the provider's test mode, and
 * `stripeCredentialsFromEnv()` refuses any credential that is not `sk_test_` / `pk_test_` / `whsec_`.
 * A key that resolves to nothing on the selected account is a refused checkout (`not-configured`,
 * naming the plan) — never an inline amount, and never another account's Price.
 *
 * Each Price also carries a Product, and those are account-scoped too (`prod_…` on one account
 * resolves nowhere on the other). Nothing in this build names a Product: a checkout buys a Price.
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

/** The provider's lookup key per interval. `undefined` would be a checkout that cannot charge. */
export type PlanPriceLookupKeys = Readonly<Record<BillingInterval, string>>;

/**
 * The lookup keys, one row per sold tier.
 *
 * Spelled out rather than assembled from the plan id, so a key renamed in the dashboard fails a
 * test here instead of at a customer's click, and so this table is the one place a name is edited.
 */
export const BILLING_PRICE_LOOKUP_KEYS: Readonly<Record<PaidPlanId, PlanPriceLookupKeys>> = {
  basic: {
    month: "alignsynch_basic_month",
    year: "alignsynch_basic_year",
  },
  principal: {
    month: "alignsynch_principal_month",
    year: "alignsynch_principal_year",
  },
};

/**
 * The lookup key for a (tier, interval), or `undefined` — never a guessed key.
 *
 * `undefined` is the answer for the free tier and for a tier this build does not sell; the caller
 * refuses with that pair named. A key that is present but resolves to nothing on the account in use
 * is the adapter's refusal, because only the provider can answer that question.
 */
export function billingPriceLookupKeyFor(
  planId: string,
  interval: BillingInterval,
): string | undefined {
  if (planId !== "basic" && planId !== "principal") return undefined;
  return BILLING_PRICE_LOOKUP_KEYS[planId][interval];
}
