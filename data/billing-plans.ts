/**
 * The plan fixture — the four tiers as data (#289).
 *
 * The pricing page states four tiers and two prices per tier. Billing needs the same facts in
 * three more places: `billing_plan` rows (the seed), the entitlement table (is this tier paid?),
 * and the checkout (what is charged). Four readers, one authored list — a second copy would be a
 * price that drifts from the amount a checkout charges, which is the defect this file exists to
 * make impossible.
 *
 *   `scripts/db-seed.mjs`        writes `billing_plan` rows, one per tier × interval
 *   `scripts/db-verify.mjs`      V13 proves those rows still equal this file
 *   `lib/billing/entitlements.ts`  plan → what the server allows
 *   `scripts/billing-smoke.mjs`  the keyless demo, which buys a tier through the mock adapter
 *
 * **`components/pricing/pricing-plans.tsx` still carries its own `PLANS_DATA`** — moving the
 * component onto these rows is card 3 of #289 (the CTA card), and this card does not touch
 * `components/pricing/**`. Until then the two lists cannot diverge silently:
 * `tests/billing-plans.test.ts` parses the component's `PLANS_DATA` and fails when a name,
 * description, price, feature, limitation, CTA or ribbon disagrees with this file. When card 3
 * makes the component read `billing_plan`, that test recognises the switch (the import) and
 * checks the rows instead, so it is never vacuous and never a leftover.
 *
 * **Money is integer cents**, the convention the rest of the tree already follows
 * (`QuizStats.rewardCents`, `data/metrics.ts`): `999` is `$9.99`, and no price is a float that
 * `0.1 + 0.2` can move.
 *
 * **The prices are the ones the page renders today and they do not change here.** The
 * pricing-table card (t_dd21895e) ruled that all four tiers and every price stay while billing is
 * built underneath them; this file carries them verbatim, so that ruling has one home.
 *
 * `yearlyCents` is **the amount charged once a year**, not the monthly-equivalent the card
 * prints: `$7.99` beside "/mo, billed yearly" is `9588 / 12`. A `billing_plan` row is what a
 * checkout charges, so it holds 9588 — an amount the page renders but a checkout never charges
 * would be exactly the drift this fixture prevents.
 */

/** The tiers, in the order the page draws them. */
export const BILLING_PLAN_IDS = ["free", "basic", "pro", "enterprise"] as const;

export type BillingPlanId = (typeof BILLING_PLAN_IDS)[number];

/** The two intervals a price can be billed on. `billing_plan` keys on the pair. */
export const BILLING_INTERVALS = ["month", "year"] as const;

export type BillingInterval = (typeof BILLING_INTERVALS)[number];

/**
 * Where a tier's button goes.
 *
 * `/register` is a route. The literal `"support"` is resolved by the surface that renders it to
 * `mailto:${brand.supportEmail}` — the address is per-brand (`data/brand.ts`), so a mailto
 * written here would pin one brand's address into both builds, and a data module that imported a
 * brand could not also be imported by a seed script.
 */
export type BillingPlanCtaHref = "/register" | "support";

export interface BillingPlan {
  /** The tier. `billing_plan.id` — one row per (tier, interval). */
  readonly id: BillingPlanId;
  /** What the card's title renders. */
  readonly name: string;
  /** The one line under the title. */
  readonly description: string;
  /** Integer cents per month. `0` for the free tier. */
  readonly monthlyCents: number;
  /** Integer cents per year — the amount charged once, at the yearly interval. */
  readonly yearlyCents: number;
  readonly features: readonly string[];
  readonly limitations: readonly string[];
  /** The card's button. */
  readonly cta: { readonly label: string; readonly href: BillingPlanCtaHref };
  /** Drawn with the "Recommended" ribbon. */
  readonly popular: boolean;
  /**
   * Whether a checkout will sell this tier.
   *
   * `false` for Free (nothing to buy — every account already has it) and for Enterprise (the
   * card's CTA is a conversation, not a price form). A checkout for a tier with `false` is
   * refused with a sentence that names the tier, not silently ignored.
   */
  readonly checkout: boolean;
}

/**
 * The four tiers — the pricing page's own rows, one home.
 *
 * Every string here is rendered by `components/pricing/pricing-plans.tsx` today (the
 * reconciliation test proves it), so an edit to a feature bullet is a visible edit, not a data
 * change nobody notices.
 */
export const billingPlans: readonly BillingPlan[] = [
  {
    id: "free",
    name: "Free",
    description: "For trying the assessment format",
    monthlyCents: 0,
    yearlyCents: 0,
    features: [
      "Basic Mode: Feel and Wish on every Aspect",
      "The report, one line per Gap",
      "Your assessments in one list",
      "Invite the other party by link",
    ],
    limitations: ["One active assessment at a time", "Advanced Mode needs a paid plan"],
    cta: { label: "Start free", href: "/register" },
    popular: false,
    checkout: false,
  },
  {
    id: "basic",
    name: "Basic",
    description: "For a two-party practice",
    monthlyCents: 999,
    yearlyCents: 9_588, // 7.99 × 12 — the monthly rate, billed yearly
    features: [
      "Unlimited active assessments",
      "Basic Mode and Advanced Mode",
      "The report, one line per Gap",
      "Your assessments in one list",
      "Invite the other party by link",
    ],
    limitations: [],
    cta: { label: "Talk to us", href: "support" },
    popular: false,
    checkout: true,
  },
  {
    id: "pro",
    name: "Pro",
    description: "For a busier two-party practice",
    monthlyCents: 1_999,
    yearlyCents: 20_388, // 16.99 × 12
    features: [
      "Unlimited active assessments",
      "Basic Mode and Advanced Mode",
      "The report, one line per Gap",
      "Your assessments in one list",
      "Invite the other party by link",
    ],
    limitations: [],
    cta: { label: "Talk to us", href: "support" },
    popular: true,
    checkout: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "For organisations that want to agree terms first",
    monthlyCents: 4_999,
    yearlyCents: 47_988, // 39.99 × 12
    features: ["Everything in Pro", "Volume, procurement and terms, agreed by email"],
    limitations: ["SSO, team management, custom reporting and integrations are not built"],
    cta: { label: "Contact us", href: "support" },
    popular: false,
    checkout: false,
  },
];

/** The tier, or `undefined` when a string names no row. Never a default. */
export function billingPlan(id: string): BillingPlan | undefined {
  return billingPlans.find((plan) => plan.id === id);
}

/** The price in cents for an interval. The amount a checkout charges. */
export function planPriceCents(plan: BillingPlan, interval: BillingInterval): number {
  return interval === "month" ? plan.monthlyCents : plan.yearlyCents;
}

/** One `billing_plan` row per tier × interval, in fixture order — what the seed writes. */
export interface BillingPlanRow {
  readonly id: BillingPlanId;
  readonly interval: BillingInterval;
  readonly name: string;
  readonly priceCents: number;
  /** Offered at this price today. Every row is; a retired tier would be `false`, not deleted. */
  readonly active: boolean;
}

/** The rows `billing_plan` holds. `db:seed` writes them, `db:verify` (V13) compares them. */
export function billingPlanRows(): BillingPlanRow[] {
  return billingPlans.flatMap((plan) =>
    BILLING_INTERVALS.map((interval) => ({
      id: plan.id,
      interval,
      name: plan.name,
      priceCents: planPriceCents(plan, interval),
      active: true,
    })),
  );
}

/**
 * The fixture's own invariants, so a bad edit is a named failure rather than a render.
 *
 * `tests/billing-plans.test.ts` runs every one of these, and V13 in `scripts/db-verify.mjs` calls
 * the same function before it compares rows — a fixture that contradicts itself is reported
 * once, by name, instead of as a confusing row diff.
 */
export function billingPlanProblems(): string[] {
  const problems: string[] = [];
  const seen = new Set<string>();
  for (const plan of billingPlans) {
    if (seen.has(plan.id)) problems.push(`plan "${plan.id}" is listed twice`);
    seen.add(plan.id);
    if (!Number.isInteger(plan.monthlyCents) || plan.monthlyCents < 0) {
      problems.push(`plan "${plan.id}": monthlyCents must be a non-negative integer (cents)`);
    }
    if (!Number.isInteger(plan.yearlyCents) || plan.yearlyCents < 0) {
      problems.push(`plan "${plan.id}": yearlyCents must be a non-negative integer (cents)`);
    }
    if (plan.id === "free" && (plan.monthlyCents !== 0 || plan.yearlyCents !== 0)) {
      problems.push('plan "free": the free tier cannot have a price');
    }
    if (plan.yearlyCents % 12 !== 0) {
      // The card prints `yearlyCents / 12` beside "/mo", so a yearly amount that is not a whole
      // number of months would render a third decimal.
      problems.push(
        `plan "${plan.id}": yearlyCents (${plan.yearlyCents}) is not a whole number of months — the card prints it divided by 12`,
      );
    }
    if (plan.id !== "free" && plan.monthlyCents === 0) {
      problems.push(`plan "${plan.id}" is paid but costs nothing per month`);
    }
    if (plan.checkout && plan.id === "free") {
      problems.push('plan "free": checkout is a purchase, and the free tier is not bought');
    }
  }
  if (billingPlans.length !== BILLING_PLAN_IDS.length) {
    problems.push(
      `the fixture lists ${billingPlans.length} plan(s); BILLING_PLAN_IDS names ${BILLING_PLAN_IDS.length}`,
    );
  }
  for (const id of BILLING_PLAN_IDS) {
    if (!billingPlans.some((plan) => plan.id === id)) problems.push(`plan "${id}" has no row`);
  }
  return problems;
}
