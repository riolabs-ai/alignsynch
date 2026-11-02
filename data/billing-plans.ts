/**
 * The plan fixture — the three tiers as data.
 *
 * The pricing page states three tiers and two prices per tier. Billing needs the same facts in
 * three more places: `billing_plan` rows (the migration and the seed), the entitlement table (is
 * this tier paid?), and the checkout (what is charged). Four readers, one authored list — a second
 * copy would be a price that drifts from the amount a checkout charges, which is the defect this
 * file exists to make impossible.
 *
 *   `db/migrations/0018_billing_plan_rows.sql`   inserts these rows and deletes the two retired ones
 *   `scripts/billing-plans.mjs`                  the same upsert, for `db:seed` and the smoke scripts
 *   `scripts/db-verify.mjs`                      V13 proves those rows still equal this file
 *   `lib/billing/entitlements.ts`                plan → what the server allows
 *   `lib/billing/catalogue.ts`                   the plan grid's rows: this file's words, `billing_plan`'s prices
 *
 * **The plan table renders these rows, and types no price of its own.** The page reads
 * `billing_plan` (through `lib/billing/catalogue.ts`) for every figure, and this file for every
 * word. A retired row (`active = false`) or a missing one is a card with no CTA at all, which is
 * how "a button that cannot work does not render" is enforced by data.
 * `tests/billing-plans.test.ts` reads the component's source and fails the build if a price
 * literal reappears under `components/pricing/`, so the two lists cannot diverge again.
 *
 * **The tier set is exactly three (owner, 2026-11-02).** `pro` was renamed to `principal` — a
 * rename, not a new tier, so every id, string and row follows it; `enterprise` was removed, not
 * hidden, so it has no card, no row and no copy. `tests/billing-plan-migration.test.ts` asserts
 * that the migration's rows and this file's rows are the same list, which is what keeps a price
 * change from reaching one and not the other.
 *
 * **Money is integer cents**, the convention the rest of the tree already follows
 * (`QuizStats.rewardCents`, `data/metrics.ts`): `895` is `$8.95`, and no price is a float that
 * `0.1 + 0.2` can move.
 *
 * **`yearlyCents` is the amount charged once a year**, not the monthly-equivalent the card prints:
 * `$85.92` beside "/mo, billed yearly" is `8_592 / 12`. A `billing_plan` row is what a checkout
 * charges, so it holds 8_592 — an amount the page renders but a checkout never charges would be
 * exactly the drift this fixture prevents. The yearly rate is **20% off the monthly rate × 12**
 * (`895 × 12 × 0.8 = 8_592`), the discount the page's `pricing.annualDiscount` metric prints.
 */

/** The tiers, in the order the page draws them: cheapest first, the recommended one in the middle. */
export const BILLING_PLAN_IDS = ["free", "basic", "principal"] as const;

export type BillingPlanId = (typeof BILLING_PLAN_IDS)[number];

/** The two intervals a price can be billed on. `billing_plan` keys on the pair. */
export const BILLING_INTERVALS = ["month", "year"] as const;

export type BillingInterval = (typeof BILLING_INTERVALS)[number];

/**
 * Where a tier's button goes.
 *
 * `/register` is a route, and `checkout` is the plan table's own button: it posts to
 * `/api/billing/checkout`, which starts a purchase through whichever adapter is configured.
 * There is no third kind any more: the tier that was sold by conversation (`enterprise`, whose
 * CTA was the support mailbox) is not in the catalogue, so neither is the branch.
 */
export type BillingPlanCtaHref = "/register" | "checkout";

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
  /**
   * Drawn with the "Recommended" ribbon.
   *
   * Exactly one plan carries it, and the card reads this field rather than an index or a
   * literal, so moving the ribbon is a data edit. `billingPlanProblems()` is what makes "exactly
   * one" a checked fact instead of a convention.
   */
  readonly popular: boolean;
  /**
   * Whether a checkout will sell this tier.
   *
   * `false` for Free (nothing to buy — every account already has it). A checkout for a tier with
   * `false` is refused with a sentence that names the tier, not silently ignored.
   */
  readonly checkout: boolean;
}

/**
 * The three tiers — the pricing page's own rows, one home.
 *
 * **Every feature line is something this build does**, not something a pricing table usually
 * promises: the two-party assessment, the template a practice authors, the blind answer, the
 * report, the Gap and its Steps, the coach seat. Basic and Principal carry the same enforced
 * entitlement today (`lib/billing/entitlements.ts`: every paid tier is unlimited active
 * relationships and both modes), and the page says so by listing the same product on both — no
 * line claims a capability the server would refuse. A tier that buys something more needs the
 * gate in that file to change first; until then the difference the page draws is who each tier
 * is for, which is what a plan's `description` is.
 */
export const billingPlans: readonly BillingPlan[] = [
  {
    id: "free",
    name: "Free",
    description: "For one relationship at a time",
    monthlyCents: 0,
    yearlyCents: 0,
    features: [
      "One active relationship, start to finish",
      "Basic Mode: how it feels to each side, and how each wishes it to be",
      "Blind answers — neither party sees the other's until both have answered",
      "The report, one line per Gap",
      "Invite the other party by link",
    ],
    limitations: ["One active relationship at a time", "Advanced Mode needs a paid plan"],
    cta: { label: "Start free", href: "/register" },
    popular: false,
    checkout: false,
  },
  {
    id: "basic",
    name: "Basic",
    description: "For a coach running a practice",
    monthlyCents: 895,
    yearlyCents: 8_592, // 8.95 × 12, less 20% — the yearly rate, charged once
    features: [
      "Unlimited active relationships",
      "Basic Mode and Advanced Mode",
      "Your own templates — the Aspects you actually work on, reused for every client",
      "The report: every Gap by kind and size, and the Steps that follow from it",
      "Blind answers from both parties, and the coach seat that runs the session",
      "Invite either side by link",
    ],
    limitations: [],
    cta: { label: "Choose Basic", href: "checkout" },
    popular: true,
    checkout: true,
  },
  {
    id: "principal",
    name: "Principal",
    description: "For a practice running several relationships at once",
    monthlyCents: 1_695,
    yearlyCents: 16_272, // 16.95 × 12, less 20% — the yearly rate, charged once
    features: [
      "Everything in Basic",
      "Unlimited active relationships",
      "Basic Mode and Advanced Mode",
      "Your own templates — the Aspects you actually work on, reused for every client",
      "The report: every Gap by kind and size, and the Steps that follow from it",
      "Blind answers from both parties, and the coach seat that runs the session",
    ],
    limitations: [],
    cta: { label: "Choose Principal", href: "checkout" },
    popular: false,
    checkout: true,
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

/** One `billing_plan` row per tier × interval, in fixture order — what the migration and seed write. */
export interface BillingPlanRow {
  readonly id: BillingPlanId;
  readonly interval: BillingInterval;
  readonly name: string;
  readonly priceCents: number;
  /** Offered at this price today. Every row is; a retired tier would be `false`, not deleted. */
  readonly active: boolean;
}

/** The rows `billing_plan` holds. `0018`, `db:seed` and `db:verify` (V13) all compare to this. */
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
  // The ribbon is a claim about the catalogue, so "exactly one" is checked here rather than left
  // to the page: two ribbons tell a reader nothing, and none tells them nothing either.
  const recommended = billingPlans.filter((plan) => plan.popular);
  if (recommended.length !== 1) {
    problems.push(
      `exactly one plan must be recommended; ${recommended.length} are (${recommended.map((plan) => plan.id).join(", ") || "none"})`,
    );
  }
  return problems;
}
