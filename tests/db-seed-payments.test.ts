/**
 * **A completed relationship carries its fee, and the demo's count of them is computed** — the
 * regression this file exists to stop (t_b9679354).
 *
 * The demo held eight `complete` relationships and one `relationship_payment` row: the console's
 * own charge card, authored by hand in `scripts/db-seed-admin-surfaces.mjs`. So a relationship both
 * people had finished and accepted — a real report — had no obligation behind it on any list, while
 * the one row that existed belonged to a screen rather than to the data. In production the same gap
 * showed up as the other half of the same defect: four seeded relationships held `active` against a
 * dataset authoring `complete`, with no fee row and no `completed_at`.
 *
 * The seed now writes the fee through the product's own writers
 * (`lib/db/relationship-payment.ts`), for every `complete` relationship whose **payer seat is an
 * account**, with the amount read from `data/billing-plans.ts`. This file holds the four properties
 * a reviewer cannot check from one screen:
 *
 *   1. **the expectation file's count is the dataset's count** — `data/verify/demo-expectations.json`
 *      is what `pnpm demo:verify` diffs the branch against, so the number is derived here, never
 *      typed beside the loop that writes it (#1091's lesson);
 *   2. **the bundle and the fixtures agree** — `data:check` E32 holds them equal, and this is the
 *      seed's own reading of that equality, because the seed writes the bundle under `DEMO_AUTH=1`
 *      and the fixtures without it;
 *   3. **every complete relationship is either paid for or reported** — a `complete` row whose
 *      initiator is an authored name has no account, so `relationship_payment.payer_user_id`
 *      (NOT NULL) can name nobody. That is a fact about the demo's two identities, and it is
 *      surfaced rather than papered over: no payer is invented, and no row is silently missing;
 *   4. **the fee's schedule and amount are the product's** — captured a day after the relationship
 *      was created, charged a day after the delay it is due, amount equal to the tier's month price
 *      in `data/billing-plans.ts` (the fixture `billing_plan` is seeded from).
 *
 * What this file cannot see is the branch: whether the rows landed, and whether `/admin/billing`
 * draws them. That is `pnpm db:seed` + `pnpm db:verify` + `pnpm demo:verify`.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  type AssessmentSession,
  seededLifecycleOf,
  zAssessmentSession,
} from "@/content/assessment";
import { assessmentSessions } from "@/data/assessments";
import { billingPlan, planPriceCents } from "@/data/billing-plans";
import { DEMO_ACCOUNTS } from "../scripts/db-seed-invite.mjs";
import {
  FEE_INTERVAL,
  feeScheduleOf,
  payableFeeRows,
  payerAccountOf,
  unpayableCompleteRows,
} from "../scripts/db-seed-payments.mjs";

const BUNDLE_PATH = new URL("../data/bundles/demo-dataset.alignsynch.json", import.meta.url);
const EXPECTATIONS_PATH = new URL("../data/verify/demo-expectations.json", import.meta.url);

interface DatasetBundle {
  readonly payload: { readonly sessions: unknown[] };
}

interface Expectations {
  readonly rows: Record<string, number>;
}

const bundle = JSON.parse(readFileSync(BUNDLE_PATH, "utf8")) as DatasetBundle;
const expectations = JSON.parse(readFileSync(EXPECTATIONS_PATH, "utf8")) as Expectations;
const bundleSessions = zAssessmentSession.array().parse(bundle.payload.sessions);

const lifecycleOf = (session: AssessmentSession) => seededLifecycleOf(session);
const priceOf = (planId: string) => {
  const plan = billingPlan(planId);
  return plan === undefined ? undefined : planPriceCents(plan, FEE_INTERVAL);
};

const fromBundle = payableFeeRows(bundleSessions, lifecycleOf, priceOf);
const fromFixtures = payableFeeRows(assessmentSessions, lifecycleOf, priceOf);
const unpayableFromBundle = unpayableCompleteRows(bundleSessions, lifecycleOf);
const completeSessions = bundleSessions.filter(
  (session) => lifecycleOf(session).status === "complete",
);

describe("the fee a completed demo relationship carries", () => {
  it("records the number of fee rows the dataset produces, computed rather than typed", () => {
    // The assertion this file exists for. Change the dataset, and the expectation has to move with
    // it in the same diff — `pnpm demo:verify --update` records the row count, this states what the
    // count has to be.
    expect(expectations.rows.relationship_payment).toBe(fromBundle.length);
  });

  it("derives the same fee rows from the committed bundle and from the fixtures", () => {
    expect(fromFixtures.map((row) => row.relationshipId)).toEqual(
      fromBundle.map((row) => row.relationshipId),
    );
    expect(fromFixtures.map((row) => row.amountCents)).toEqual(
      fromBundle.map((row) => row.amountCents),
    );
  });

  it("is not vacuous: a completed relationship an account pays for exists, and each row is distinct", () => {
    // A dataset that stopped binding a payer would derive zero and "match" an expectation of zero,
    // which is the defect this whole change repairs, so it fails here instead.
    expect(fromBundle.length).toBeGreaterThan(0);
    for (const row of fromBundle) {
      expect(row.email).toMatch(/@demo\.alignsynch\.test$/);
      expect(row.amountCents).toBeGreaterThan(0);
      expect(row.planId).toBeTruthy();
    }
    // One row per relationship — `relationship_payment.relationship_id` is the primary key, so a
    // duplicated relationship here would be a seed that refuses at the second write.
    const ids = fromBundle.map((row) => row.relationshipId);
    expect(new Set(ids).size).toBe(ids.length);
    // The payer is the account holding the initiator seat, and the tier is the one the lifecycle
    // authored: a fee on the wrong tier is a charge the checkout would not have made.
    for (const row of fromBundle) {
      const session = bundleSessions.find((candidate) => candidate.id === row.sessionId);
      expect(session, `${row.sessionId} must be in the bundle`).toBeDefined();
      expect(lifecycleOf(session!).plan).toBe(row.planId);
      expect(payerAccountOf(session!)?.email).toBe(row.email);
    }
  });

  it("accounts for every complete relationship: paid for, or reported as having no payer", () => {
    // The two halves of the census must partition the complete set — a seeded relationship that is
    // neither charged nor named is exactly the silent gap this change closes.
    expect(fromBundle.length + unpayableFromBundle.length).toBe(completeSessions.length);
    const payable = new Set(fromBundle.map((row) => row.relationshipId));
    for (const row of unpayableFromBundle) {
      expect(payable.has(row.relationshipId)).toBe(false);
      expect(row.slug).toBeTruthy();
    }
    // And the unpayable ones are unpayable for the reason the module documents: no account holds
    // their initiator seat, so `relationship_payment.payer_user_id` (NOT NULL) has nothing to name.
    const seatHolders = new Set(
      DEMO_ACCOUNTS.filter((account) => account.holdsSeat !== false).map((account) => account.name),
    );
    for (const row of unpayableFromBundle) {
      const session = bundleSessions.find(
        (candidate) => `relationship-${candidate.id}` === row.relationshipId,
      );
      expect(session, `${row.relationshipId} must be in the bundle`).toBeDefined();
      const initiator = session!.parties.find((party) => party.role === "initiator");
      expect(initiator).toBeDefined();
      expect(seatHolders.has(initiator!.name)).toBe(false);
    }
  });

  it("writes the product's chronology and the tier's own month price", () => {
    // `0036` CHECKs the order: a charge cannot predate the captured method, and an amount is a
    // positive integer of cents. Both are asserted against the product's own constants rather than
    // against numbers typed here.
    const created = "2026-09-28T03:00:00.000Z";
    const schedule = feeScheduleOf(created);
    expect(Date.parse(schedule.capturedAt)).toBeGreaterThan(Date.parse(created));
    expect(Date.parse(schedule.chargeDueAt)).toBe(Date.parse(schedule.capturedAt) + 7 * 86_400_000);
    expect(Date.parse(schedule.chargedAt)).toBeGreaterThanOrEqual(Date.parse(schedule.capturedAt));
    // Deterministic: a second seed must converge on the same instants, or every re-seed rewrites
    // history the console reads.
    expect(feeScheduleOf(created)).toEqual(schedule);

    // The amount is the fixture's month price for the row's own tier — the same figure
    // `billing_plan` is seeded from, so the seeded charge and the price a checkout quotes cannot
    // part company.
    for (const row of fromBundle) {
      const tier = billingPlan(row.planId);
      expect(tier, `data/billing-plans.ts must carry "${row.planId}"`).toBeDefined();
      expect(row.amountCents).toBe(planPriceCents(tier!, "month"));
    }
  });

  it("refuses a complete row with no tier instead of inventing an amount", () => {
    // A completed relationship is paid for on a tier. The model defaults one for `complete`, so the
    // refusal is only reachable through the module's own contract — and a fee with no amount is the
    // one thing this seed will not write.
    const tierless = {
      id: "assessment-instance-tierless",
      slug: "tierless",
      parties: [
        { role: "initiator", name: "Avery" },
        { role: "counterparty", name: "Rowan" },
      ],
    };
    expect(() =>
      payableFeeRows([tierless as never], () => ({ status: "complete", plan: null }), priceOf),
    ).toThrow(/no plan/);
    // And a tier the catalogue does not price is a refusal, not a zero.
    expect(() =>
      payableFeeRows(
        [tierless as never],
        () => ({ status: "complete", plan: "basic" }),
        () => 0,
      ),
    ).toThrow(/no positive month price/);
  });
});
