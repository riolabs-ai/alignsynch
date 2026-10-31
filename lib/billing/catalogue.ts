/**
 * The pricing page's rows — `billing_plan` read into the four cards (#289, card 3 of 3).
 *
 * The plan table used to carry its own `PLANS_DATA`: a second copy of every name, price, bullet
 * and CTA that `data/billing-plans.ts` already authors. This module is what replaced it, and the
 * two halves it joins are deliberately different sources:
 *
 *   the authored tier   `data/billing-plans.ts` — name, description, bullets, CTA, ribbon
 *   the sellable row    `billing_plan` — the price at each interval, and whether it is live
 *
 * `billing_plan` is seeded from that same fixture (`scripts/billing-plans.mjs`) and compared back
 * to it by `pnpm db:verify` V13, so there is still exactly one authored price. Reading the table
 * rather than the fixture for money is what lets a row be **retired**: `active = false`, or no
 * row at all, is a card that prints no CTA — the honesty requirement this card carries, because
 * a button that cannot work must not render as if it does.
 *
 * **The table is asked, and a keyless tree is not.** `DATABASE_URL` absent (the gate, `next
 * build`, a laptop with no `neon env pull`) means no account can sign in and no checkout can be
 * written, so the authored rows are rendered and nothing is marked sellable. That is not a
 * second price list: `billingPlanRows()` is the same authored list the seed writes, and V13 is
 * what keeps the table equal to it.
 *
 * A row that cannot be read is not the same fact as a row that says `active = false`. The first
 * is an outage we log and degrade — no CTA, because we cannot confirm what we would sell — and
 * the second is a decision somebody made, also no CTA, by the data rather than by this module.
 *
 * One row per (tier, interval), so **sellability is per interval**: `basic/month` can be live
 * while `basic/year` is not, and the card's CTA follows the toggle. That is why the view model
 * carries an interval map instead of one price and one boolean.
 */
import {
  type BillingInterval,
  BILLING_INTERVALS,
  type BillingPlanCtaHref,
  type BillingPlanId,
  type BillingPlanRow,
  billingPlanRows,
  billingPlans,
} from "@/data/billing-plans";
import { databaseConfigured } from "@/lib/db/client";
import { readBillingPlans } from "@/lib/db/billing";

/** The intervals, in the order the toggle offers them. */
export const PRICING_INTERVALS: readonly BillingInterval[] = BILLING_INTERVALS;

/** Where the rows came from — and therefore whether a checkout may be offered at all. */
export type PlanRowSource = "table" | "fixture";

/**
 * One tier at one interval, as the card needs it.
 *
 * `chargeCents` is what a checkout takes; `displayCents` is what the card prints beside "/mo"
 * (the yearly row is charged once a year, so its display figure is that amount divided by
 * twelve — the same arithmetic `data/billing-plans.ts` documents for `yearlyCents`).
 */
export interface PlanIntervalView {
  readonly chargeCents: number;
  readonly displayCents: number;
  /**
   * May a checkout be started for this tier at this interval, right now?
   *
   * True only when all three hold: the rows came from the table (a keyless tree sells nothing),
   * the row for this interval exists and is `active`, and the fixture marks the tier as one a
   * checkout sells (Free is every account's default; Enterprise is a conversation).
   */
  readonly sellable: boolean;
}

/** One card of the plan grid. */
export interface PricingPlanView {
  readonly id: BillingPlanId;
  readonly name: string;
  readonly description: string;
  readonly features: readonly string[];
  readonly limitations: readonly string[];
  /** The button's words and its destination kind, from the fixture. */
  readonly cta: { readonly label: string; readonly href: BillingPlanCtaHref };
  readonly popular: boolean;
  /** The account is on this tier: the card says so and offers nothing to buy. */
  readonly current: boolean;
  /** `null` when `billing_plan` holds no row for that interval at all (no price to print). */
  readonly intervals: Readonly<Record<BillingInterval, PlanIntervalView | null>>;
}

export interface PricingCatalogueInput {
  /** The rows read from `billing_plan`, or the authored ones when the table was not consulted. */
  readonly rows: readonly BillingPlanRow[];
  readonly source: PlanRowSource;
  /** The tier the viewer is entitled to. `null` for a signed-out visitor. */
  readonly entitledPlanId: BillingPlanId | null;
}

/**
 * The grid, in the fixture's order — the page's one projection from rows to cards.
 *
 * Pure: no database, no environment, no clock. `tests/pricing-catalogue.test.ts` drives it with
 * rows it hands in, which is how the retired-row case is proved without Postgres.
 */
export function pricingPlans(input: PricingCatalogueInput): PricingPlanView[] {
  const { rows, source, entitledPlanId } = input;

  const rowFor = (id: BillingPlanId, interval: BillingInterval): BillingPlanRow | undefined =>
    rows.find((row) => row.id === id && row.interval === interval);

  return billingPlans.map((plan) => {
    const monthly = rowFor(plan.id, "month");
    const yearly = rowFor(plan.id, "year");
    const view = (
      row: BillingPlanRow | undefined,
      interval: BillingInterval,
    ): PlanIntervalView | null =>
      row === undefined
        ? null
        : {
            chargeCents: row.priceCents,
            // One month of the interval's charge. `Math.round` keeps a hand-edited row from
            // printing a fraction of a cent; the fixture's own validator forbids the case.
            displayCents: interval === "month" ? row.priceCents : Math.round(row.priceCents / 12),
            sellable: source === "table" && row.active && plan.checkout,
          };

    return {
      id: plan.id,
      // The table's name wins when it has one: a renamed tier is a row edit, and V13 reports a
      // rename that never reached the fixture rather than letting the page disagree with it.
      name: monthly?.name ?? yearly?.name ?? plan.name,
      description: plan.description,
      features: plan.features,
      limitations: plan.limitations,
      cta: plan.cta,
      popular: plan.popular,
      current: entitledPlanId !== null && entitledPlanId === plan.id,
      intervals: {
        month: view(monthly, "month"),
        year: view(yearly, "year"),
      },
    };
  });
}

/** The rows, and which source answered — the page passes both to `pricingPlans`. */
export interface PlanRows {
  readonly rows: readonly BillingPlanRow[];
  readonly source: PlanRowSource;
}

/**
 * `billing_plan`, when this deployment has a database; the authored rows when it does not.
 *
 * A read that throws is caught rather than propagated: the pricing page is a public page, and a
 * database blip must not turn it into a 500. It is not silently hidden either — the log line
 * names the cause, and `source: "fixture"` takes every checkout CTA off the page for that render
 * rather than offering a purchase we could not confirm.
 */
export async function readPricingPlanRows(): Promise<PlanRows> {
  if (!databaseConfigured()) {
    return { rows: billingPlanRows(), source: "fixture" };
  }
  try {
    return { rows: await readBillingPlans(), source: "table" };
  } catch (error) {
    console.error(
      "billing: billing_plan could not be read — rendering the authored rows with no checkout",
      error instanceof Error ? error.message : String(error),
    );
    return { rows: billingPlanRows(), source: "fixture" };
  }
}
