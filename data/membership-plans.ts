/**
 * `data/membership-plans.ts` — the plan catalogue the owner approved on #1127 (2026-11-17):
 * **Single $9.99/month · Family $19.99/month (up to 4 relationships) · Single Annual $99/year.**
 *
 * ## One catalogue, and this file holds no amount
 *
 * A plan is a *name, a capacity, an interval and a tier*. The money is not here: it is
 * `data/billing-plans.ts`'s `billingPlans`, and every `priceCents` below is read out of it through
 * `planPriceCents(tier, interval)`. That is deliberate and it is the whole reason this module exists
 * rather than a second price list — the pricing page, the checkout, the `billing_plan` mirror,
 * `/dashboard/templates`' price chip and the create flow's plan panel all already read that fixture,
 * so a plan that typed its own `$9.99` would be a fifth surface quoting a sixth number. Writing
 * `999` here would pass every type check and put two prices in one product, which is the defect
 * `tests/create-plan-prices.test.ts` was written for (#975).
 *
 * ## Three plans, four provider keys, and the fourth one unclaimed
 *
 * A subscription renews against a provider **Price**, named by a lookup key
 * (`data/billing-prices.ts`), and the account holds exactly four:
 *
 *   plan            tier / interval   lookup key
 *   Single          basic / month     alignsynch_basic_month
 *   Family          principal / month alignsynch_principal_month
 *   Single Annual   basic / year      alignsynch_basic_year
 *   (no plan)       principal / year  alignsynch_principal_year
 *
 * `alignsynch_principal_year` is a *Family Annual* key and the owner has not approved a Family
 * annual plan, so no row here claims it. It is not deleted from the table — deleting a key is a
 * provider-side change to a Stripe account this card is told not to touch — and it is not invented
 * into a plan either. `tests/plan-catalogue.test.ts` pins that shape: three plans, three distinct
 * keys, and the fourth key named as carried-but-unmapped rather than quietly dropped. A future
 * Family Annual plan is therefore a row here and no new provider object.
 *
 * ## Capacity is a fact about the plan, and it is not enforced by this file
 *
 * `capacity` is how many relationships one membership covers: Family is four, the two Single plans
 * are one. Copy and the plan panel read it from here, so a row cannot advertise a number the
 * catalogue does not carry. **The entitlement gate is not wired to it yet** — `lib/billing/
 * entitlements.ts` still treats every paid tier as unlimited active relationships, so a Family
 * member is not refused a fifth relationship today. That gap is named in the card's handoff rather
 * than guessed at here: enforcing a cap is a change to what a paid account is *allowed*, and this
 * card is the catalogue and the display.
 *
 * Imported through relative paths on purpose, like `data/relationship-types.ts`: `tsconfig.
 * datacheck.json` compiles this tree under `module: commonjs` and does not resolve the `@/` alias.
 * No React, no `lib/db/**`, no clock.
 */
import { type BillingInterval, billingPlans, planPriceCents } from "./billing-plans";
import { billingPriceLookupKeyFor, type PaidPlanId } from "./billing-prices";

/** The three plans, in the order the pricing artifact and the plan panel draw them. */
export const MEMBERSHIP_PLAN_IDS = ["single", "family", "annual"] as const;

export type MembershipPlanId = (typeof MEMBERSHIP_PLAN_IDS)[number];

/** One plan a person can hold: what it is called, what it costs, what it covers. */
export interface MembershipPlan {
  /** The stable id — the row's `data-plan` value and the create fixture's copy-key prefix. */
  readonly id: MembershipPlanId;
  /** What the card's title renders: `Single`, `Family`, `Single Annual`. */
  readonly name: string;
  /** The capacity in words, printed under the name: `1 relationship`, `Up to 4 relationships`. */
  readonly summary: string;
  /** How many relationships one membership covers. Family is {@link FAMILY_CAPACITY}. */
  readonly capacity: number;
  /** How the amount is charged, and what the price's suffix says. */
  readonly interval: BillingInterval;
  /** The billing tier this plan buys — the value a checkout is asked for. */
  readonly tier: PaidPlanId;
  /** Integer cents, read from `data/billing-plans.ts`. The amount a checkout charges. */
  readonly priceCents: number;
  /** The provider's handle for that amount, read from `data/billing-prices.ts`. */
  readonly lookupKey: string;
}

/** The owner's Family limit (#1127): one membership, up to four relationships. */
export const FAMILY_CAPACITY = 4;

/**
 * One plan, with its money resolved from the two fixtures that own it.
 *
 * Both lookups throw at import rather than returning a row with `priceCents: 0`: a plan with a
 * missing tier or a tier/interval the provider table has no key for is a screen that would print
 * `$0.00` or a checkout the adapter refuses, and both are worse than a build that names the row.
 */
function plan(
  id: MembershipPlanId,
  name: string,
  summary: string,
  capacity: number,
  tier: PaidPlanId,
  interval: BillingInterval,
): MembershipPlan {
  const billing = billingPlans.find((row) => row.id === tier);
  if (billing === undefined) {
    throw new Error(
      `data/billing-plans.ts has no "${tier}" tier — membership plan "${id}" cannot be priced`,
    );
  }
  const lookupKey = billingPriceLookupKeyFor(tier, interval);
  if (lookupKey === undefined) {
    throw new Error(
      `data/billing-prices.ts has no lookup key for "${tier}/${interval}" — membership plan "${id}" cannot be sold`,
    );
  }
  return {
    id,
    name,
    summary,
    capacity,
    interval,
    tier,
    priceCents: planPriceCents(billing, interval),
    lookupKey,
  };
}

/**
 * The three approved plans.
 *
 * The words are the approved artifact's — `docs/specs/v2-bundles/02-spec-design-page-onboarding-v2/
 * pricing.html` draws exactly these three cards, with these names and these summaries — and the
 * amounts arrive from the price fixture. `2 months free` is the artifact's own phrase for the
 * annual plan: $9.99 × 12 is $119.88, and $99 is the owner's round price for paying once.
 */
export const MEMBERSHIP_PLANS: readonly MembershipPlan[] = [
  plan("single", "Single", "1 relationship", 1, "basic", "month"),
  plan("family", "Family", "Up to 4 relationships", FAMILY_CAPACITY, "principal", "month"),
  plan("annual", "Single Annual", "1 relationship · 2 months free", 1, "basic", "year"),
];

/** The plan, or `undefined` when a string names none. Never a default. */
export function membershipPlan(id: string): MembershipPlan | undefined {
  return MEMBERSHIP_PLANS.find((row) => row.id === id);
}

/**
 * The plan row that buys a (tier, interval), or `null`.
 *
 * This is the crossing the create flow needs in both directions: a `/pricing` card carries a tier
 * and an interval, and the plan panel draws rows keyed by plan id. The exact pair is matched first,
 * so `basic/year` resolves to Single Annual rather than to Single; a tier whose yearly interval no
 * plan claims (the unclaimed Family Annual key) falls back to the plan for that tier, which is the
 * Family row, with the carried interval left as it arrived (`lib/flow/plan-intent.ts`).
 */
export function membershipPlanFor(
  tier: PaidPlanId,
  interval?: BillingInterval,
): MembershipPlan | null {
  const forTier = MEMBERSHIP_PLANS.filter((row) => row.tier === tier);
  if (interval !== undefined) {
    const exact = forTier.find((row) => row.interval === interval);
    if (exact !== undefined) return exact;
  }
  return forTier[0] ?? null;
}

/** The row id each tier is drawn by, for the walk's map — `PLAN_BILLING_TIER` is built from this. */
export const MEMBERSHIP_PLAN_TIERS: Readonly<Record<MembershipPlanId, PaidPlanId>> = {
  single: "basic",
  family: "principal",
  annual: "basic",
};

/**
 * The catalogue's own invariants, so a bad edit is a named failure rather than a render.
 *
 * `tests/plan-catalogue.test.ts` runs every one of these. The capacity rule is the owner's:
 * Family covers four relationships and the two Single plans cover one, so a Family row advertised
 * at five, or a Single row at four, is a catalogue that contradicts the approved prices.
 */
export function membershipPlanProblems(): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  const pairs = new Set<string>();
  const keys = new Set<string>();
  for (const row of MEMBERSHIP_PLANS) {
    if (seen.has(row.id)) problems.push(`plan "${row.id}" is listed twice`);
    seen.add(row.id);
    const pair = `${row.tier}/${row.interval}`;
    if (pairs.has(pair)) {
      problems.push(
        `two plans buy the same tier and interval (${pair}) — one of them is unreachable`,
      );
    }
    pairs.add(pair);
    if (keys.has(row.lookupKey)) {
      problems.push(`two plans resolve to the same lookup key (${row.lookupKey})`);
    }
    keys.add(row.lookupKey);
    if (row.lookupKey !== billingPriceLookupKeyFor(row.tier, row.interval)) {
      problems.push(
        `plan "${row.id}": lookup key "${row.lookupKey}" is not the one filed under ${pair}`,
      );
    }
    if (!Number.isInteger(row.priceCents) || row.priceCents <= 0) {
      problems.push(`plan "${row.id}": priceCents must be a positive integer (cents)`);
    }
    if (!Number.isInteger(row.capacity) || row.capacity < 1) {
      problems.push(
        `plan "${row.id}": capacity must be a whole number of relationships, at least 1`,
      );
    }
    if (row.id === "family" && row.capacity !== FAMILY_CAPACITY) {
      problems.push(
        `plan "family": capacity is ${row.capacity}; the approved catalogue says ${FAMILY_CAPACITY}`,
      );
    }
    if (row.id !== "family" && row.capacity !== 1) {
      problems.push(
        `plan "${row.id}": the Single plans cover one relationship; capacity is ${row.capacity}`,
      );
    }
    if (MEMBERSHIP_PLAN_TIERS[row.id] !== row.tier) {
      problems.push(
        `plan "${row.id}": the tier map says "${MEMBERSHIP_PLAN_TIERS[row.id]}", the row says "${row.tier}"`,
      );
    }
  }
  const ids = new Set(MEMBERSHIP_PLANS.map((row) => row.id));
  if (MEMBERSHIP_PLANS.length !== MEMBERSHIP_PLAN_IDS.length) {
    problems.push(
      `the catalogue lists ${MEMBERSHIP_PLANS.length} plan(s); MEMBERSHIP_PLAN_IDS names ${MEMBERSHIP_PLAN_IDS.length}`,
    );
  }
  for (const id of MEMBERSHIP_PLAN_IDS) {
    if (!ids.has(id)) problems.push(`plan "${id}" has no row`);
  }
  return problems;
}
