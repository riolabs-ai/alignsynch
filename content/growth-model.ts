/**
 * The growth model — a business a reader can see, computed rather than pasted (#920).
 *
 * **What this file is.** Thirty-six monthly cohorts of a customer base that reaches a $3M
 * run-rate, and the aggregate series an operator reads: signups, active accounts, MRR → ARR,
 * logo and revenue churn, plan mix and invoice outcomes. `/admin/growth` charts the committed
 * artifact (`data/demo/growth-model.json`); `pnpm growth` writes it; `pnpm growth:check` proves the
 * committed bytes are what this module produces. One model, three readers — a chart built from the
 * model and a screen built from sampled rows are two readings of one truth, never two datasets.
 *
 * **Why the model is not 3M rows.** The Neon demo branch is at its ceiling (#909) and a demo is a
 * demonstration, not a load test. The *scale* is modelled — every aggregate below is computed as if
 * all the accounts existed — and a *sample* is materialised at ~5k relationships by
 * `sampleGrowthOperations`, drawn from the same distribution so the two agree.
 *
 * **Determinism is the feature, not a nicety.** A screenshot, a transcript and a chart have to
 * agree tomorrow, and a byte-identical artifact is what makes `pnpm growth:check` a real check
 * instead of a diff of noise. So the module reads no clock and no unseeded randomness:
 *
 *   - every instant is derived from `DEMO_NOW_ISO` (`content/core.ts`) — the fixture clock, which
 *     `data:check` E10 already holds every other fixture against. The final cohort month is the
 *     clock's own month, so nothing in the model is dated after "now";
 *   - every draw comes from a seeded stream (`mulberry32`, the generator precedent in
 *     `scripts/gen-fixtures.mjs`) keyed by `(seed, cohort, plan, row)` rather than from one
 *     sequential stream, so a row's noise does not move when an earlier cohort is retuned;
 *   - rates and shares are **integer basis points** and money is **integer cents**, so the JSON
 *     carries no float that a different platform could format differently.
 *
 * **The ARR target is solved, not eyeballed.** Revenue is linear in the acquisition index — the
 * scalar this module applies to its growth curve — so `solveAcquisitionBps` iterates the ratio
 * `target / actual` a few times and lands inside the ±1 % band, then records the index and the pass
 * count in the artifact. The alternative (hand-tune `baseSignups` until the last number looks
 * right) is a magic constant nobody can re-derive, and it silently breaks the moment a price or a
 * churn rate moves.
 *
 * **Purity.** No React, no Next, no `fs`, no `node:*` import: `data:check` compiles `content/` with
 * `tsconfig.datacheck.json` and runs it under plain node, and the page imports the *types* across
 * the client boundary (`data:check` E34). Writing bytes is `scripts/growth.ts`'s job.
 */
import { z } from "zod";

import { DEMO_NOW_ISO } from "./core";

/* ------------------------------------------------------------------ *
 * Constants
 * ------------------------------------------------------------------ */

/** The version of the *document* (not of the product). A reader that cannot express a newer one refuses it. */
export const GROWTH_MODEL_VERSION = 1;

/**
 * The paid tiers the model bills, by the ids `data/billing-plans.ts` already owns.
 *
 * `free` is deliberately absent: it is a sign-up destination, not revenue, and a model that
 * counted it would report an ARR no invoice could ever support. The prices below are the fixture's
 * (asserted by `tests/growth-model.test.ts`), so a price change reaches the model in the same edit
 * that reaches the pricing page.
 */
export const GROWTH_PLAN_IDS = ["basic", "principal"] as const;

export type GrowthPlanId = (typeof GROWTH_PLAN_IDS)[number];

/** The modelled months a caller may ask for: a year is the floor for a cohort curve to say anything. */
export const GROWTH_MONTH_BOUNDS = { min: 12, max: 60 } as const;

/** The ±1 % the acceptance band allows between the solved final ARR and the target. */
export const GROWTH_ARR_TOLERANCE_BPS = 100;

const BPS = 10_000;

/* ------------------------------------------------------------------ *
 * The schemas — every object `.strict()`, so a fixture drift is an error
 * ------------------------------------------------------------------ */

export const zGrowthPlanId = z.enum(GROWTH_PLAN_IDS);

/**
 * One tier's economics.
 *
 * `logoChurnBps` is the share of *accounts* lost per month and `revenueChurnBps` the share of
 * *revenue* lost from the accounts that stay (a downgrade, a seat removed, a discount). They are
 * separate because they move separately in a real base, and a model that folded them into one rate
 * could not show a month where revenue churn outran logo churn.
 *
 * `startingShareBps` → `endingShareBps` is the documented **mix ramp**: the share of new signups
 * on this tier in the first month and in the last, interpolated linearly. Early cohorts land on the
 * entry tier and the base matures onto the upper one — which is what makes the plan-mix chart a
 * story rather than a constant.
 */
export const zGrowthPlan = z
  .object({
    id: zGrowthPlanId,
    label: z.string().min(1),
    /** Integer cents per account per month — the fixture's own price. */
    monthlyCents: z.number().int().positive(),
    logoChurnBps: z.number().int().min(0).max(BPS),
    revenueChurnBps: z.number().int().min(0).max(BPS),
    startingShareBps: z.number().int().min(0).max(BPS),
    endingShareBps: z.number().int().min(0).max(BPS),
  })
  .strict();

export type GrowthPlan = z.infer<typeof zGrowthPlan>;

/** Everything the model is a function of. `seed` moves the invoice noise only — never the solve. */
export const zGrowthParams = z
  .object({
    seed: z.number().int().nonnegative(),
    months: z.number().int().min(GROWTH_MONTH_BOUNDS.min).max(GROWTH_MONTH_BOUNDS.max),
    /** Integer cents. `300_000_000` is the $3M the issue asks for. */
    targetArrCents: z.number().int().positive(),
    /** Accounts acquired in month 0, before the index and the growth curve. */
    baseSignups: z.number().int().positive(),
    /** Month-on-month growth of the acquisition curve, in basis points. */
    monthlyGrowthBps: z.number().int().min(0),
    /** Share of issued invoices that fail on the first attempt. */
    failureBps: z.number().int().min(0).max(BPS),
    /** Share of paid invoices later refunded. */
    refundBps: z.number().int().min(0).max(BPS),
  })
  .strict();

export type GrowthParams = z.infer<typeof zGrowthParams>;

/** One month's invoice outcomes for one plan. `refunded` is not part of `issued` — it is a later event. */
export const zGrowthInvoices = z
  .object({
    issued: z.number().int().nonnegative(),
    paid: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    refunded: z.number().int().nonnegative(),
    collectedCents: z.number().int().nonnegative(),
    refundedCents: z.number().int().nonnegative(),
  })
  .strict();

export type GrowthInvoices = z.infer<typeof zGrowthInvoices>;

/** A plan's slice of one month: the accounts it holds and what they are worth. */
export const zGrowthPlanAccounts = z
  .object({
    plan: zGrowthPlanId,
    accounts: z.number().int().nonnegative(),
    mrrCents: z.number().int().nonnegative(),
  })
  .strict();

export type GrowthPlanAccounts = z.infer<typeof zGrowthPlanAccounts>;

/** A month's slice also carries the invoices those accounts were billed — a cohort's does not. */
export const zGrowthPlanSlice = z
  .object({
    plan: zGrowthPlanId,
    accounts: z.number().int().nonnegative(),
    mrrCents: z.number().int().nonnegative(),
    invoices: zGrowthInvoices,
  })
  .strict();

export type GrowthPlanSlice = z.infer<typeof zGrowthPlanSlice>;

/**
 * One point on a cohort's retention curve. `age` 0 is the month the cohort started.
 *
 * `retentionBps` is stored rather than left to the render: the chart's y-axis is a percentage, and a
 * component dividing two integers would be a second place the same ratio is computed.
 */
export const zGrowthRetentionPoint = z
  .object({
    age: z.number().int().nonnegative(),
    retainedAccounts: z.number().int().nonnegative(),
    retentionBps: z.number().int().min(0).max(BPS),
  })
  .strict();

export type GrowthRetentionPoint = z.infer<typeof zGrowthRetentionPoint>;

/** One monthly cohort: what it acquired, how it kept them, and what it is worth today. */
export const zGrowthCohort = z
  .object({
    month: z.number().int().nonnegative(),
    /** `YYYY-MM`, computed from the instant — never formatted by a render. */
    label: z.string().regex(/^\d{4}-\d{2}$/),
    startedAt: z.string().datetime(),
    signups: z.number().int().nonnegative(),
    accounts: z.number().int().nonnegative(),
    mrrCents: z.number().int().nonnegative(),
    plans: z.array(zGrowthPlanAccounts),
    retention: z.array(zGrowthRetentionPoint),
  })
  .strict();

export type GrowthCohort = z.infer<typeof zGrowthCohort>;

/** One month of the business: the aggregate the charts draw. */
export const zGrowthMonth = z
  .object({
    month: z.number().int().nonnegative(),
    label: z.string().regex(/^\d{4}-\d{2}$/),
    startedAt: z.string().datetime(),
    signups: z.number().int().nonnegative(),
    activeAccounts: z.number().int().nonnegative(),
    churnedAccounts: z.number().int().nonnegative(),
    newMrrCents: z.number().int().nonnegative(),
    retainedMrrCents: z.number().int().nonnegative(),
    lostMrrCents: z.number().int().nonnegative(),
    mrrCents: z.number().int().nonnegative(),
    arrCents: z.number().int().nonnegative(),
    logoChurnBps: z.number().int().min(0).max(BPS),
    revenueChurnBps: z.number().int().min(0).max(BPS),
    plans: z.array(zGrowthPlanSlice),
  })
  .strict();

export type GrowthMonth = z.infer<typeof zGrowthMonth>;

export const zGrowthTotals = z
  .object({
    signups: z.number().int().nonnegative(),
    activeAccounts: z.number().int().nonnegative(),
    churnedAccounts: z.number().int().nonnegative(),
    finalMrrCents: z.number().int().nonnegative(),
    finalArrCents: z.number().int().nonnegative(),
    peakArrCents: z.number().int().nonnegative(),
    collectedCents: z.number().int().nonnegative(),
    refundedCents: z.number().int().nonnegative(),
    failedInvoices: z.number().int().nonnegative(),
    refundedInvoices: z.number().int().nonnegative(),
  })
  .strict();

export type GrowthTotals = z.infer<typeof zGrowthTotals>;

/** How the acquisition curve was solved, recorded so the number can be re-derived instead of trusted. */
export const zGrowthSolve = z
  .object({
    method: z.literal("ratio-iteration"),
    targetArrCents: z.number().int().positive(),
    acquisitionIndexBps: z.number().int().nonnegative(),
    passes: z.number().int().positive(),
    finalArrCents: z.number().int().nonnegative(),
    /** The distance from the target, in bps. Not band-bounded: only the solved model is (see `solveGrowthModel`). */
    errorBps: z.number().int().min(0),
    toleranceBps: z.literal(GROWTH_ARR_TOLERANCE_BPS),
  })
  .strict();

export type GrowthSolve = z.infer<typeof zGrowthSolve>;

/** The whole artifact. `data/demo/growth-model.json` is one of these, and this schema is the only validator. */
export const zGrowthModel = z
  .object({
    modelVersion: z.literal(GROWTH_MODEL_VERSION),
    generatedBy: z.string().min(1),
    params: zGrowthParams,
    /** At least one plan and one month: an empty model describes no business, and `readGrowthModel` refuses it. */
    plans: z.array(zGrowthPlan).min(1),
    solve: zGrowthSolve,
    months: z.array(zGrowthMonth).min(1),
    cohorts: z.array(zGrowthCohort).min(1),
    totals: zGrowthTotals,
  })
  .strict();

export type GrowthModel = z.infer<typeof zGrowthModel>;

/* ------------------------------------------------------------------ *
 * The authored inputs
 * ------------------------------------------------------------------ */

/**
 * The three tiers' economics, in the order the plan-mix chart stacks them.
 *
 * Measured against the product rather than invented: `basic` is the $8.95 entry tier and
 * `principal` the $16.95 one (`data/billing-plans.ts`), and an upper tier that churns at half the
 * rate of the entry one is the ordinary shape of a subscription base, not a boast.
 */
export const GROWTH_PLANS: readonly GrowthPlan[] = [
  {
    id: "basic",
    label: "Basic",
    monthlyCents: 895,
    logoChurnBps: 340,
    revenueChurnBps: 210,
    startingShareBps: 6_800,
    endingShareBps: 4_200,
  },
  {
    id: "principal",
    label: "Principal",
    monthlyCents: 1_695,
    logoChurnBps: 160,
    revenueChurnBps: 110,
    startingShareBps: 3_200,
    endingShareBps: 5_800,
  },
];

/**
 * The parameters the committed artifact was generated with, and the ones `growth:check` re-runs.
 *
 * `--seed 42 --months 36 --target-arr 3000000` on the command line is this object exactly; the
 * default lives here so a test and the script cannot disagree about what "the default model" means.
 */
export const GROWTH_DEFAULT_PARAMS: GrowthParams = {
  seed: 42,
  months: 36,
  targetArrCents: 300_000_000,
  baseSignups: 190,
  monthlyGrowthBps: 810,
  failureBps: 90,
  refundBps: 300,
};

/* ------------------------------------------------------------------ *
 * Small pure helpers
 * ------------------------------------------------------------------ */

const MONTH_ISO = /^(\d{4})-(\d{2})/;

/** The calendar month an ISO instant falls in, as `year * 12 + monthIndex`. Parsed, never constructed. */
function monthOrdinalOf(iso: string): number {
  const match = MONTH_ISO.exec(iso);
  if (!match) throw new Error(`growth-model: "${iso}" is not an ISO instant`);
  return Number(match[1]) * 12 + (Number(match[2]) - 1);
}

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/**
 * The instant cohort `index` starts at, given how many months the model spans.
 *
 * The **last** month is the fixture clock's own month and the first is `months - 1` before it, so
 * the series ends "now" no matter when it is read and nothing is dated after the clock (E10's
 * rule, held from the inside). Pure: the only input is `DEMO_NOW_ISO` and the two numbers.
 */
export function growthMonthInstant(
  index: number,
  months: number,
  nowIso: string = DEMO_NOW_ISO,
): string {
  const last = monthOrdinalOf(nowIso);
  const ordinal = last - (months - 1) + index;
  const year = Math.floor(ordinal / 12);
  const month = (ordinal % 12) + 1;
  return `${year}-${pad2(month)}-01T00:00:00.000Z`;
}

/** `YYYY-MM` for a month ordinal, computed rather than formatted. */
function monthLabelOf(iso: string): string {
  const match = MONTH_ISO.exec(iso);
  if (!match) throw new Error(`growth-model: "${iso}" is not an ISO instant`);
  return `${match[1]}-${match[2]}`;
}

/** mulberry32 — the generator precedent (`scripts/gen-fixtures.mjs`), deterministic per seed. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A stable per-row seed: FNV-1a over the tuple.
 *
 * One sequential stream would couple every row to the order rows happen to be drawn in, so
 * retuning cohort 4 would move cohort 30's invoice noise. Keying on the tuple keeps a row's noise
 * about that row.
 */
export function rowSeed(seed: number, ...parts: readonly number[]): number {
  let hash = (0x811c9dc5 ^ (seed >>> 0)) >>> 0;
  for (const part of parts) {
    let value = Math.max(0, Math.trunc(part)) >>> 0;
    for (let byte = 0; byte < 4; byte += 1) {
      hash = Math.imul(hash ^ (value & 0xff), 0x01000193) >>> 0;
      value >>>= 8;
    }
  }
  return hash >>> 0;
}

/**
 * Split `total` across `weights` so the parts are integers that sum to `total` exactly.
 *
 * Largest-remainder, because `Math.round` on each part does not sum to the whole: a plan mix that
 * adds up to 4,999 of 5,000 accounts is the kind of one-account drift that makes a reconciliation
 * assertion meaningless.
 */
export function apportion(total: number, weights: readonly number[]): number[] {
  const sum = weights.reduce((acc, weight) => acc + weight, 0);
  if (sum <= 0 || total <= 0) return weights.map(() => 0);
  const exact = weights.map((weight) => (total * weight) / sum);
  const floors = exact.map((value) => Math.floor(value));
  let remainder = total - floors.reduce((acc, value) => acc + value, 0);
  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (const entry of order) {
    if (remainder <= 0) break;
    const current = floors[entry.index];
    if (current === undefined) continue;
    floors[entry.index] = current + 1;
    remainder -= 1;
  }
  return floors;
}

/** Retained share after `age` months of churn at `bps` per month, as a float in 0..1. */
function retentionFactor(bps: number, age: number): number {
  return (1 - bps / BPS) ** age;
}

/**
 * Each plan's share of one month's signups, interpolated between its starting and ending share and
 * normalised to exactly 10,000 bps so the ramp cannot leak accounts.
 */
export function planSharesBps(
  plans: readonly GrowthPlan[],
  month: number,
  months: number,
): number[] {
  const t = months <= 1 ? 1 : month / (months - 1);
  const raw = plans.map(
    (plan) => plan.startingShareBps + (plan.endingShareBps - plan.startingShareBps) * t,
  );
  const total = raw.reduce((acc, value) => acc + value, 0);
  if (total <= 0) return plans.map(() => 0);
  const normalised = raw.map((value) => Math.round((value / total) * BPS));
  // Rounding can leave the list a basis point or two off 10,000; give the difference to the first.
  const drift = BPS - normalised.reduce((acc, value) => acc + value, 0);
  if (normalised.length > 0) {
    const first = normalised[0];
    if (first !== undefined) normalised[0] = first + drift;
  }
  return normalised;
}

/* ------------------------------------------------------------------ *
 * Building the model
 * ------------------------------------------------------------------ */

/** Accounts acquired in a month, before the solve's index is applied. */
function baseCurveAt(params: GrowthParams, month: number): number {
  return params.baseSignups * (1 + params.monthlyGrowthBps / BPS) ** month;
}

/**
 * The model for one acquisition index. Pure: `params`, `plans` and the index in, a document out.
 *
 * Exported because the linearity of revenue in the index is a *test* (`tests/growth-model.test.ts`
 * doubles it and asserts ARR doubles), which is what makes the solver's one-line assumption
 * checkable instead of asserted in prose.
 */
export function buildGrowthModel(
  params: GrowthParams,
  plans: readonly GrowthPlan[],
  acquisitionIndexBps: number,
): GrowthModel {
  const months = params.months;
  const indexFactor = acquisitionIndexBps / BPS;

  const instants = Array.from({ length: months }, (_, month) => growthMonthInstant(month, months));
  const labels = instants.map((iso) => monthLabelOf(iso));

  // The acquisition curve, and each cohort's split across the plans at its own month.
  const signups = instants.map((_, month) => Math.round(baseCurveAt(params, month) * indexFactor));
  const cohortPlanAccounts = instants.map((_, month) =>
    apportion(signups[month] ?? 0, planSharesBps(plans, month, months)),
  );

  /** Retained accounts and MRR for cohort `cohort` at `age`, per plan. */
  const retainedAt = (cohort: number, age: number) => {
    const accounts = cohortPlanAccounts[cohort] ?? [];
    return plans.map((plan, planIndex) => {
      const acquired = accounts[planIndex] ?? 0;
      const kept = Math.round(acquired * retentionFactor(plan.logoChurnBps, age));
      const revenue = Math.round(
        kept * plan.monthlyCents * retentionFactor(plan.revenueChurnBps, age),
      );
      return { plan, acquired, kept, revenue };
    });
  };

  // Month series: sum every live cohort at its own age, month by month.
  const months_: GrowthMonth[] = instants.map((_, month) => {
    let activeAccounts = 0;
    let mrrCents = 0;
    let newMrrCents = 0;
    let lostMrrCents = 0;

    const slices: GrowthPlanSlice[] = plans.map((plan) => ({
      plan: plan.id,
      accounts: 0,
      mrrCents: 0,
      invoices: { issued: 0, paid: 0, failed: 0, refunded: 0, collectedCents: 0, refundedCents: 0 },
    }));

    for (let cohort = 0; cohort <= month; cohort += 1) {
      const age = month - cohort;
      const rows = retainedAt(cohort, age);
      for (const [planIndex, row] of rows.entries()) {
        const slice = slices[planIndex];
        if (!slice) continue;
        slice.accounts += row.kept;
        slice.mrrCents += row.revenue;
        if (age === 0) newMrrCents += row.revenue;
        // One invoice per active account per month; the failure and refund rates are the model's.
        slice.invoices.issued += row.kept;
        activeAccounts += row.kept;
        mrrCents += row.revenue;
      }

      if (age > 0) {
        const previous = retainedAt(cohort, age - 1);
        for (const [planIndex, row] of previous.entries()) {
          const slice = slices[planIndex];
          if (!slice) continue;
          lostMrrCents += Math.max(0, row.revenue - (rows[planIndex]?.revenue ?? 0));
        }
      }
    }

    for (const [planIndex, slice] of slices.entries()) {
      slice.invoices.failed = Math.round((slice.invoices.issued * params.failureBps) / BPS);
      slice.invoices.paid = slice.invoices.issued - slice.invoices.failed;
      slice.invoices.refunded = Math.round((slice.invoices.paid * params.refundBps) / BPS);
      const price = plans[planIndex]?.monthlyCents ?? 0;
      slice.invoices.collectedCents = slice.invoices.paid * price;
      slice.invoices.refundedCents = slice.invoices.refunded * price;
    }

    return {
      month,
      label: labels[month] ?? "",
      startedAt: instants[month] ?? "",
      signups: signups[month] ?? 0,
      activeAccounts,
      // Filled by `finalise`: churn is a difference between two months, so it cannot be known while
      // the month it needs is still being built.
      churnedAccounts: 0,
      newMrrCents,
      retainedMrrCents: mrrCents - newMrrCents,
      lostMrrCents,
      mrrCents,
      arrCents: mrrCents * 12,
      logoChurnBps: 0,
      revenueChurnBps: 0,
      plans: slices,
    };
  });

  return finalise(params, plans, {
    acquisitionIndexBps,
    months: months_,
    signups,
    instants,
    labels,
    retainedAt,
  });
}

/**
 * Second pass: the rates and totals that are only knowable once every month exists.
 *
 * Churn on month `m` is `activeAccounts(m-1) + signups(m) - activeAccounts(m)` — a *derived*
 * number, because a churned count read from anywhere else is a second opinion about the same fact.
 * The same pass fills the solve record and the totals, so the document is assembled in one place.
 */
function finalise(
  params: GrowthParams,
  plans: readonly GrowthPlan[],
  input: {
    acquisitionIndexBps: number;
    months: GrowthMonth[];
    signups: number[];
    instants: string[];
    labels: string[];
    retainedAt: (
      cohort: number,
      age: number,
    ) => { plan: GrowthPlan; acquired: number; kept: number; revenue: number }[];
  },
): GrowthModel {
  const months = input.months.map((row, month) => {
    const previousActive = month === 0 ? 0 : (input.months[month - 1]?.activeAccounts ?? 0);
    const priorMrr = month === 0 ? 0 : (input.months[month - 1]?.mrrCents ?? 0);
    const churnedAccounts = Math.max(
      0,
      previousActive + (input.signups[month] ?? 0) - row.activeAccounts,
    );
    return {
      ...row,
      churnedAccounts,
      // Rates are *of the base that existed*, so month 0 (no base) reports 0 rather than a divide by zero.
      logoChurnBps: previousActive === 0 ? 0 : Math.round((churnedAccounts / previousActive) * BPS),
      revenueChurnBps:
        priorMrr === 0
          ? 0
          : Math.round((Math.min(priorMrr, Math.max(0, row.lostMrrCents)) / priorMrr) * BPS),
    };
  });

  const cohorts: GrowthCohort[] = input.instants.map((_, cohort) => {
    const ageMax = params.months - 1 - cohort;
    const retention: GrowthRetentionPoint[] = [];
    for (let age = 0; age <= ageMax; age += 1) {
      const rows = input.retainedAt(cohort, age);
      const retainedAccounts = rows.reduce((acc, row) => acc + row.kept, 0);
      const acquired = rows.reduce((acc, row) => acc + row.acquired, 0);
      retention.push({
        age,
        retainedAccounts,
        retentionBps: acquired === 0 ? 0 : Math.round((retainedAccounts / acquired) * BPS),
      });
    }

    const first = input.retainedAt(cohort, 0);
    const accounts = first.reduce((acc, row) => acc + row.kept, 0);
    const mrrCents = first.reduce((acc, row) => acc + row.revenue, 0);
    return {
      month: cohort,
      label: input.labels[cohort] ?? "",
      startedAt: input.instants[cohort] ?? "",
      signups: input.signups[cohort] ?? 0,
      accounts,
      mrrCents,
      plans: first.map((row) => ({
        plan: row.plan.id,
        accounts: row.kept,
        mrrCents: row.revenue,
      })),
      retention,
    };
  });

  const finalMonth = months.at(-1);
  const finalArrCents = finalMonth?.arrCents ?? 0;
  const errorBps =
    params.targetArrCents === 0
      ? 0
      : Math.round((Math.abs(finalArrCents - params.targetArrCents) / params.targetArrCents) * BPS);

  const totals: GrowthTotals = {
    signups: months.reduce((acc, row) => acc + row.signups, 0),
    activeAccounts: finalMonth?.activeAccounts ?? 0,
    churnedAccounts: months.reduce((acc, row) => acc + row.churnedAccounts, 0),
    finalMrrCents: finalMonth?.mrrCents ?? 0,
    finalArrCents,
    peakArrCents: months.reduce((acc, row) => Math.max(acc, row.arrCents), 0),
    collectedCents: months.reduce(
      (acc, row) => acc + row.plans.reduce((sum, slice) => sum + slice.invoices.collectedCents, 0),
      0,
    ),
    refundedCents: months.reduce(
      (acc, row) => acc + row.plans.reduce((sum, slice) => sum + slice.invoices.refundedCents, 0),
      0,
    ),
    failedInvoices: months.reduce(
      (acc, row) => acc + row.plans.reduce((sum, slice) => sum + slice.invoices.failed, 0),
      0,
    ),
    refundedInvoices: months.reduce(
      (acc, row) => acc + row.plans.reduce((sum, slice) => sum + slice.invoices.refunded, 0),
      0,
    ),
  };

  return zGrowthModel.parse({
    modelVersion: GROWTH_MODEL_VERSION,
    generatedBy:
      "pnpm growth --seed " +
      `${params.seed} --months ${params.months} --target-arr ${params.targetArrCents / 100}`,
    params,
    plans: [...plans],
    solve: {
      method: "ratio-iteration",
      targetArrCents: params.targetArrCents,
      acquisitionIndexBps: input.acquisitionIndexBps,
      passes: 1,
      finalArrCents,
      errorBps,
      toleranceBps: GROWTH_ARR_TOLERANCE_BPS,
    },
    months,
    cohorts,
    totals,
  });
}

/**
 * Solve the acquisition index that lands the final month's ARR on the target, then build.
 *
 * Revenue is linear in the index (accounts × price, and the price does not move with volume), so
 * `index ← index × target / actual` converges quadratically: three passes are enough to land inside
 * a basis point, and five are the cap. The loop records how many passes it took, which is the
 * evidence that the number was solved rather than chosen.
 */
export function solveGrowthModel(
  params: GrowthParams,
  plans: readonly GrowthPlan[] = GROWTH_PLANS,
): { model: GrowthModel; passes: number } {
  let indexBps = BPS;
  let model = buildGrowthModel(params, plans, indexBps);
  let passes = 0;

  while (passes < 5) {
    passes += 1;
    const actual = model.totals.finalArrCents;
    if (actual === 0) break;
    const ratio = params.targetArrCents / actual;
    const next = Math.max(1, Math.round(indexBps * ratio));
    model = buildGrowthModel(params, plans, next);
    indexBps = next;
    const errorBps = model.solve.errorBps;
    if (errorBps <= 1) break;
    if (Math.abs(ratio - 1) < 1e-9) break;
  }

  const withPasses = zGrowthModel.parse({ ...model, solve: { ...model.solve, passes } });
  if (withPasses.solve.errorBps > GROWTH_ARR_TOLERANCE_BPS) {
    throw new Error(
      `growth-model: the solve landed ${withPasses.solve.errorBps} bps off the target ` +
        `(${withPasses.totals.finalArrCents} vs ${params.targetArrCents}), outside the ` +
        `${GROWTH_ARR_TOLERANCE_BPS} bps band — retune the curve, do not widen the band`,
    );
  }
  return { model: withPasses, passes };
}

/** The artifact, serialised. Two spaces, one trailing newline, key order as the schema declares it. */
export function modelToJson(model: GrowthModel): string {
  return `${JSON.stringify(model, null, 2)}\n`;
}

/** Solve and serialise — what `pnpm growth` writes and what `pnpm growth:check` compares against. */
export function generateGrowthModel(
  params: GrowthParams = GROWTH_DEFAULT_PARAMS,
  plans: readonly GrowthPlan[] = GROWTH_PLANS,
): { model: GrowthModel; json: string } {
  const { model } = solveGrowthModel(params, plans);
  return { model, json: modelToJson(model) };
}

/* ------------------------------------------------------------------ *
 * The sampled operational set
 * ------------------------------------------------------------------ */

export interface GrowthRelationship {
  readonly id: string;
  readonly cohortMonth: number;
  readonly startedAt: string;
  readonly plan: GrowthPlanId;
  readonly state: "active" | "churned";
  readonly churnedAt: string | null;
  readonly monthsActive: number;
  readonly mrrCents: number;
}

export interface GrowthSession {
  readonly id: string;
  readonly relationshipId: string;
  readonly cohortMonth: number;
  readonly openedAt: string;
  readonly state: "complete" | "abandoned";
}

export interface GrowthPayment {
  readonly id: string;
  readonly relationshipId: string;
  readonly cohortMonth: number;
  readonly billedAt: string;
  readonly amountCents: number;
  readonly attempt: number;
  readonly outcome: "paid" | "failed" | "refunded";
}

export interface GrowthChurnEvent {
  readonly id: string;
  readonly relationshipId: string;
  readonly cohortMonth: number;
  readonly churnedAt: string;
  readonly plan: GrowthPlanId;
  readonly monthsActive: number;
}

export interface GrowthSample {
  readonly relationships: readonly GrowthRelationship[];
  readonly sessions: readonly GrowthSession[];
  readonly payments: readonly GrowthPayment[];
  readonly churnEvents: readonly GrowthChurnEvent[];
}

/** A day inside the month an ISO instant names, so a row has a plausible timestamp, not a month-literal. */
function instantWithinMonth(iso: string, day: number, hour: number, minute: number): string {
  const date = iso.slice(0, 10);
  const dayPart = pad2(day);
  return `${date.slice(0, 8)}${dayPart}T${pad2(hour)}:${pad2(minute)}:00.000Z`;
}

/** The churn age a draw implies, given the plan's monthly logo churn and the cohort's age budget. */
function churnAgeFor(draw: number, logoChurnBps: number, maxAge: number): number | null {
  for (let age = 1; age <= maxAge; age += 1) {
    if (draw >= retentionFactor(logoChurnBps, age)) return age;
  }
  return null;
}

/**
 * Draw the operational sample: `rows` relationships, spread over the cohorts in proportion to each
 * month's signups, then over the plans in proportion to that cohort's mix, then aged against the
 * plan's own churn curve.
 *
 * **Representative, not scaled.** Each relationship is *drawn* — a cohort, a plan, a start day, a
 * churn age and its invoices — using a stream keyed by `(seed, cohort, plan, row)`. That is what
 * makes the sample a sample: an operator's chart says "about 55 % Basic in month 12" and the rows
 * they click through are about 55 % Basic, because the same distribution produced both. Rounding the
 * model down to 5k rows instead would be a second dataset wearing the first one's numbers.
 */
export function sampleGrowthOperations(
  model: GrowthModel,
  rows: number,
  seed: number = model.params.seed,
): GrowthSample {
  const months = model.params.months;
  const planById = new Map(model.plans.map((plan) => [plan.id, plan]));
  const cohortSizes = apportion(
    rows,
    model.cohorts.map((cohort) => cohort.signups),
  );

  const relationships: GrowthRelationship[] = [];
  const sessions: GrowthSession[] = [];
  const payments: GrowthPayment[] = [];
  const churnEvents: GrowthChurnEvent[] = [];

  for (const cohort of model.cohorts) {
    const size = cohortSizes[cohort.month] ?? 0;
    if (size === 0) continue;
    const planWeights = cohort.plans.map((slice) => slice.accounts);
    const perPlan = apportion(
      size,
      planWeights.some((weight) => weight > 0) ? planWeights : model.plans.map(() => 1),
    );
    const maxAge = months - 1 - cohort.month;

    for (const [planIndex, planRow] of model.plans.entries()) {
      const plan = planById.get(planRow.id);
      if (!plan) continue;
      const count = perPlan[planIndex] ?? 0;

      for (let i = 0; i < count; i += 1) {
        const rng = mulberry32(rowSeed(seed, cohort.month, planIndex, i));
        const day = 1 + Math.floor(rng() * 27);
        const hour = 8 + Math.floor(rng() * 10);
        const minute = Math.floor(rng() * 60);
        const startedAt = instantWithinMonth(cohort.startedAt, day, hour, minute);

        const draw = rng();
        const churnAge = churnAgeFor(draw, plan.logoChurnBps, maxAge);
        const churnedAt =
          churnAge === null
            ? null
            : instantWithinMonth(
                growthMonthInstant(cohort.month + churnAge, months),
                1 + Math.floor(rng() * 27),
                9 + Math.floor(rng() * 9),
                Math.floor(rng() * 60),
              );
        const monthsActive = churnAge === null ? maxAge + 1 : churnAge;
        const id = `rel-growth-${cohort.month}-${plan.id}-${String(i).padStart(4, "0")}`;

        relationships.push({
          id,
          cohortMonth: cohort.month,
          startedAt,
          plan: plan.id,
          state: churnedAt === null ? "active" : "churned",
          churnedAt,
          monthsActive,
          mrrCents: plan.monthlyCents,
        });

        sessions.push({
          id: `ses-growth-${cohort.month}-${plan.id}-${String(i).padStart(4, "0")}`,
          relationshipId: id,
          cohortMonth: cohort.month,
          openedAt: instantWithinMonth(cohort.startedAt, day, Math.min(23, hour + 1), minute),
          state: monthsActive >= 1 ? "complete" : "abandoned",
        });

        if (churnedAt !== null) {
          churnEvents.push({
            id: `churn-growth-${cohort.month}-${plan.id}-${String(i).padStart(4, "0")}`,
            relationshipId: id,
            cohortMonth: cohort.month,
            churnedAt,
            plan: plan.id,
            monthsActive,
          });
        }

        // One invoice per live month: a failed attempt is retried once, which is what makes the
        // operational set read as a billing flow rather than a count.
        for (let age = 0; age < monthsActive; age += 1) {
          const billedAt = instantWithinMonth(
            growthMonthInstant(cohort.month + age, months),
            1 + Math.floor(rng() * 27),
            7 + Math.floor(rng() * 6),
            Math.floor(rng() * 60),
          );
          const failed = rng() < model.params.failureBps / BPS;
          const refunded = !failed && rng() < model.params.refundBps / BPS;
          payments.push({
            id: `pay-growth-${cohort.month}-${plan.id}-${String(i).padStart(4, "0")}-${age}`,
            relationshipId: id,
            cohortMonth: cohort.month,
            billedAt,
            amountCents: plan.monthlyCents,
            attempt: 1,
            outcome: failed ? "failed" : "paid",
          });
          if (failed) {
            payments.push({
              id: `pay-growth-${cohort.month}-${plan.id}-${String(i).padStart(4, "0")}-${age}-r`,
              relationshipId: id,
              cohortMonth: cohort.month,
              billedAt: instantWithinMonth(
                growthMonthInstant(cohort.month + age, months),
                1 + Math.floor(rng() * 27),
                7 + Math.floor(rng() * 6),
                Math.floor(rng() * 60),
              ),
              amountCents: plan.monthlyCents,
              attempt: 2,
              outcome: "paid",
            });
          } else if (refunded) {
            payments.push({
              id: `pay-growth-${cohort.month}-${plan.id}-${String(i).padStart(4, "0")}-${age}-f`,
              relationshipId: id,
              cohortMonth: cohort.month,
              billedAt,
              amountCents: plan.monthlyCents,
              attempt: 1,
              outcome: "refunded",
            });
          }
        }
      }
    }
  }

  return { relationships, sessions, payments, churnEvents };
}

export interface GrowthSamplePlanRow {
  readonly plan: GrowthPlanId;
  readonly modelPct: number;
  readonly sampledPct: number;
}

export interface GrowthSampleMonthRow {
  readonly month: number;
  readonly modelPct: number;
  readonly sampledPct: number;
}

export interface GrowthSampleComparison {
  readonly planMix: readonly GrowthSamplePlanRow[];
  readonly signups: readonly GrowthSampleMonthRow[];
}

/**
 * Sampled-vs-model, as percentages — the proof that the sample is a sample.
 *
 * Plan mix is compared at the **final month** (the mix the charts end on) and signups month by
 * month. Both sides are percentages of their own whole, so a sample of 5k is comparable to a model
 * of 30k without pretending the counts should match.
 */
export function compareSampleToModel(
  model: GrowthModel,
  sample: GrowthSample,
): GrowthSampleComparison {
  const finalMonth = model.months.at(-1);
  const modelByPlan = new Map(
    (finalMonth?.plans ?? []).map((slice) => [slice.plan, slice.accounts]),
  );
  const modelAccounts = Math.max(1, finalMonth?.activeAccounts ?? 0);

  const sampledByPlan = new Map<GrowthPlanId, number>();
  for (const row of sample.relationships) {
    if (row.state !== "active") continue;
    sampledByPlan.set(row.plan, (sampledByPlan.get(row.plan) ?? 0) + 1);
  }
  const sampledActive = Math.max(
    1,
    [...sampledByPlan.values()].reduce((acc, value) => acc + value, 0),
  );

  const planMix: GrowthSamplePlanRow[] = model.plans.map((plan) => ({
    plan: plan.id,
    modelPct: round1((100 * (modelByPlan.get(plan.id) ?? 0)) / modelAccounts),
    sampledPct: round1((100 * (sampledByPlan.get(plan.id) ?? 0)) / sampledActive),
  }));

  const sampledByMonth = new Map<number, number>();
  for (const row of sample.relationships) {
    sampledByMonth.set(row.cohortMonth, (sampledByMonth.get(row.cohortMonth) ?? 0) + 1);
  }
  const modelSignups = model.cohorts.reduce((acc, cohort) => acc + cohort.signups, 0);
  const signups: GrowthSampleMonthRow[] = model.cohorts.map((cohort) => ({
    month: cohort.month,
    modelPct: round1((100 * cohort.signups) / Math.max(1, modelSignups)),
    sampledPct: round1(
      (100 * (sampledByMonth.get(cohort.month) ?? 0)) / Math.max(1, sample.relationships.length),
    ),
  }));

  return { planMix, signups };
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
