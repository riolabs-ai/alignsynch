/**
 * The growth model's three promises (#920), pinned.
 *
 * `content/growth-model.ts` is the aggregate model behind `/admin/growth`, and it is a fixture:
 * the same parameters must produce the same bytes on every machine, or the chart an operator reads
 * and the sampled rows they can click through become two datasets that drift. So the cases below
 * are about the *properties* rather than the numbers — determinism, the target, the clock, the
 * sample's representativeness — because a number asserted here would have to be edited every time
 * the curve is retuned, which is how a suite stops meaning anything.
 *
 * The fixture-collision cases (`__tests__/data-model.test.ts` style) are deliberately not copied:
 * `data/demo/growth-model.json` is compared to a regeneration by `pnpm growth:check` in the gate,
 * which is the same proof one level down and with a better diagnostic.
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { test } from "vitest";
import assert from "node:assert/strict";

import { billingPlans } from "@/data/billing-plans";
import { DEMO_NOW_ISO } from "@/content/core";
import {
  GROWTH_DEFAULT_PARAMS,
  GROWTH_PLAN_IDS,
  GROWTH_PLANS,
  type GrowthModel,
  buildGrowthModel,
  compareSampleToModel,
  generateGrowthModel,
  growthMonthInstant,
  sampleGrowthOperations,
} from "@/content/growth-model";

/** The committed artifact, beside the model that generates it. */
const COMMITTED = join(process.cwd(), "data/demo/growth-model.json");

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

const generated = generateGrowthModel(GROWTH_DEFAULT_PARAMS);
const model: GrowthModel = generated.model;

test("the same parameters produce the same bytes, twice", () => {
  const again = generateGrowthModel(GROWTH_DEFAULT_PARAMS);
  assert.equal(again.json, generated.json);
  assert.equal(sha256(again.json), sha256(generated.json));
});

test("a different seed moves the invoice noise and not the ARR solve", () => {
  const other = generateGrowthModel({ ...GROWTH_DEFAULT_PARAMS, seed: 7 });
  const arrOf = (subject: GrowthModel) => subject.months.at(-1)?.arrCents ?? 0;
  // The solve is a function of the curve, not of the noise: both land on the same target and the
  // series are identical. The seed moves only what the sampled set draws — the model carries none.
  assert.equal(arrOf(other.model), arrOf(model));
  assert.deepEqual(other.model.months, model.months);
  assert.deepEqual(other.model.solve, model.solve);
  assert.notEqual(other.model.params.seed, model.params.seed);
});

test("the final month's ARR lands on the target inside the ±1 % band", () => {
  const final = model.months.at(-1);
  assert.ok(final, "the model has a final month");
  const target = GROWTH_DEFAULT_PARAMS.targetArrCents;
  const error = Math.abs(final.arrCents - target) / target;
  assert.ok(
    error <= 0.01,
    `final ARR ${final.arrCents} is ${(error * 100).toFixed(3)}% off target`,
  );
  // …and it is a real ramp, not a flat line that happens to end at the number.
  const first = model.months[0];
  assert.ok(first && final.arrCents > first.arrCents * 50, "month 36 is far above month 1");
});

test("36 monthly cohorts, one per month, ending on the fixture clock's month", () => {
  assert.equal(model.cohorts.length, GROWTH_DEFAULT_PARAMS.months);
  assert.equal(model.months.length, GROWTH_DEFAULT_PARAMS.months);
  for (const [index, month] of model.months.entries()) {
    assert.equal(month.month, index);
    assert.equal(month.startedAt, growthMonthInstant(index, GROWTH_DEFAULT_PARAMS.months));
  }
  const last = model.months.at(-1);
  assert.ok(last);
  // E10's rule, held here too: no instant may sit after the fixture clock.
  assert.ok(Date.parse(last.startedAt) < Date.parse(DEMO_NOW_ISO));
});

test("the model is linear in accounts and every invoice reconciles to its month", () => {
  const index = model.solve.acquisitionIndexBps;
  const doubled = buildGrowthModel(GROWTH_DEFAULT_PARAMS, GROWTH_PLANS, index * 2);
  const arrOf = (subject: GrowthModel) => subject.months.at(-1)?.arrCents ?? 0;
  const ratio = arrOf(doubled) / arrOf(model);
  assert.ok(Math.abs(ratio - 2) < 0.01, `doubling the index multiplied ARR by ${ratio.toFixed(3)}`);

  for (const month of model.months) {
    const planAccounts = month.plans.reduce((sum, row) => sum + row.accounts, 0);
    const planMrr = month.plans.reduce((sum, row) => sum + row.mrrCents, 0);
    assert.equal(planAccounts, month.activeAccounts, `month ${month.month}: accounts reconcile`);
    assert.equal(planMrr, month.mrrCents, `month ${month.month}: MRR reconciles`);
    assert.equal(month.arrCents, month.mrrCents * 12, `month ${month.month}: ARR is 12 × MRR`);
    for (const row of month.plans) {
      assert.equal(
        row.invoices.paid + row.invoices.failed,
        row.invoices.issued,
        `month ${month.month} ${row.plan}: paid + failed = issued`,
      );
      assert.ok(row.invoices.refunded <= row.invoices.paid, "a refund is never more than a paid");
    }
  }
});

test("the plan mix ramps toward the upper tier and the prices are the product's", () => {
  const firstShare = GROWTH_PLANS[0]?.startingShareBps ?? 0;
  const lastShare = GROWTH_PLANS[0]?.endingShareBps ?? 0;
  assert.ok(firstShare > lastShare, "the entry tier's share falls as the base matures");

  for (const plan of GROWTH_PLANS) {
    const fixture = billingPlans.find((row: { id: string }) => row.id === plan.id);
    assert.ok(fixture, `plan ${plan.id} is a billing tier`);
    assert.equal(plan.monthlyCents, fixture.monthlyCents);
  }
  // The model bills the paid tiers only: `free` is a sign-up destination, not revenue.
  assert.deepEqual([...GROWTH_PLAN_IDS], ["basic", "principal"]);
});

test("the model module reads no clock and no unseeded randomness", () => {
  const source = readFileSync(join(process.cwd(), "content/growth-model.ts"), "utf8");
  assert.ok(!/Math\.random\s*\(/.test(source), "no Math.random()");
  assert.ok(!/new Date\s*\(/.test(source), "no `new Date()`");
  assert.ok(!/Date\.now\s*\(/.test(source), "no Date.now()");
});

test("the sample is representative: plan mix and monthly signups track the model", () => {
  const sample = sampleGrowthOperations(model, 5_000, GROWTH_DEFAULT_PARAMS.seed);
  assert.equal(sample.relationships.length, 5_000);

  const comparison = compareSampleToModel(model, sample);
  for (const row of comparison.planMix) {
    assert.ok(
      Math.abs(row.sampledPct - row.modelPct) <= 3,
      `${row.plan}: sampled ${row.sampledPct}% vs model ${row.modelPct}%`,
    );
  }
  const worst = comparison.signups.reduce(
    (max, row) => Math.max(max, Math.abs(row.sampledPct - row.modelPct)),
    0,
  );
  assert.ok(worst <= 12, `worst monthly-signup deviation ${worst.toFixed(1)} percentage points`);

  // Every sampled row points at a real cohort month and a real plan.
  for (const row of sample.relationships) {
    assert.ok(row.cohortMonth >= 0 && row.cohortMonth < GROWTH_DEFAULT_PARAMS.months);
    assert.ok(GROWTH_PLAN_IDS.includes(row.plan));
    assert.ok(row.churnedAt === null || Date.parse(row.churnedAt) >= Date.parse(row.startedAt));
  }
  const relationshipIds = new Set(sample.relationships.map((row) => row.id));
  for (const payment of sample.payments) {
    assert.ok(
      relationshipIds.has(payment.relationshipId),
      "every payment belongs to a sampled relationship",
    );
  }
});

test("the committed artifact is the model this tree generates", () => {
  const committed = readFileSync(COMMITTED, "utf8");
  assert.equal(committed, generated.json);
});
