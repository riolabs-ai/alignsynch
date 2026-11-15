/**
 * The demo's subscription count is **computed from the dataset**, never typed beside the loop that
 * writes it (#1091).
 *
 * `data/verify/demo-expectations.json` records `billing_subscription: 1` while
 * `seedDemoSubscriptions()` writes one row per demo account that initiates a plan-bearing
 * relationship — two identities over `#1079`'s population, so two rows. `pnpm demo:verify` failed
 * on every run against a database that was right, because the number had been authored in the same
 * commit as the loop that made it wrong (`#1083`, `985ca784`) and nothing computed it.
 *
 * So the assertion is not "the file says 2". It is:
 *
 *   1. the file's count equals the number of plan-initiating demo accounts, derived from the
 *      bundle `pnpm demo:reset` seeds;
 *   2. the bundle and the fixtures (`data/assessments.ts`, which `data:check` E32 holds the bundle
 *      equal to) derive the **same** accounts — a count that only holds on one of the two sources
 *      is a seed that disagrees with itself;
 *   3. the derivation is not vacuous: it names the seat-holding identities, at least one of them
 *      initiates a live (`active`) relationship — the reason a row exists at all — and each row's
 *      `demo-${email}` idempotency key is unique, so a re-seed updates rather than stacks.
 *
 * What this test cannot see is the row count in Postgres, and it does not pretend to: the seed
 * refuses at run time when its own `relationship.plan` query disagrees with this derivation, and
 * `pnpm db:verify` reads the two rows back (`2 seeded binding(s) intact … 2 live subscription(s)`).
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { zAssessmentInstance, seededLifecycleOf } from "@/content/assessment";
import type { AssessmentInstance } from "@/content/assessment";
import { assessmentInstances } from "@/data/assessments";
import { planInitiatingAccounts, subscriptionIdFor } from "../scripts/db-seed-subscriptions.mjs";

const BUNDLE_PATH = new URL("../data/bundles/demo-dataset.alignsynch.json", import.meta.url);
const EXPECTATIONS_PATH = new URL("../data/verify/demo-expectations.json", import.meta.url);

interface DatasetBundle {
  readonly payload: { readonly instances: unknown[] };
}

interface Expectations {
  readonly rows: Record<string, number>;
}

const bundle = JSON.parse(readFileSync(BUNDLE_PATH, "utf8")) as DatasetBundle;
const expectations = JSON.parse(readFileSync(EXPECTATIONS_PATH, "utf8")) as Expectations;

/** The bundle's instances, through the model — a bundle that drifts fails here, not in a seed. */
const bundleInstances = zAssessmentInstance.array().parse(bundle.payload.instances);

const planOf = (instance: AssessmentInstance) => seededLifecycleOf(instance).plan;

const fromBundle = planInitiatingAccounts(bundleInstances, planOf);
const fromFixtures = planInitiatingAccounts(assessmentInstances, planOf);

describe("the demo dataset's billing subscriptions", () => {
  it("records the number of plan-initiating demo accounts, computed rather than typed", () => {
    // The one assertion this file exists for. Change the dataset, and the expectation has to move
    // with it in the same diff — `pnpm demo:verify --update` records the row count, this states
    // what the count has to be.
    expect(expectations.rows.billing_subscription).toBe(fromBundle.length);
  });

  it("derives the same accounts from the committed bundle and from the fixtures", () => {
    // `data:check` E32 already holds the bundle equal to `data/assessments.ts`; this is the seed's
    // own reading of that equality, because the seed writes the bundle under `DEMO_AUTH=1` and the
    // fixtures without it. A count that holds on one source only is the drift this test names.
    expect(fromFixtures.map((account) => account.email)).toEqual(
      fromBundle.map((account) => account.email),
    );
  });

  it("is not vacuous: a seat-holding identity initiates a live relationship, and ids are unique", () => {
    // A dataset that stops carrying plans would derive zero and "match" an expectation of zero.
    // That is a demo with no membership to show, so it fails here instead of passing quietly.
    expect(fromBundle.length).toBeGreaterThan(0);

    for (const account of fromBundle) {
      expect(account.holdsSeat).not.toBe(false);
      expect(account.email).toMatch(/@demo\.alignsynch\.test$/);
    }

    // The tier a row is written on comes from the relationship the account initiates — one that a
    // `membershipOf()` read needs to be `active`, not merely authored.
    const liveInitiations = bundleInstances.filter((instance) => {
      const lifecycle = seededLifecycleOf(instance);
      return lifecycle.status === "active" && lifecycle.plan !== null;
    });
    expect(
      liveInitiations.some((instance) =>
        fromBundle.some((account) =>
          instance.parties.some(
            (party) => party.role === "initiator" && party.name === account.name,
          ),
        ),
      ),
    ).toBe(true);

    // `demo-${email}` is the idempotency key (`ON CONFLICT (provider_subscription_id) DO UPDATE`),
    // so two accounts sharing an address would silently keep one row.
    const ids = fromBundle.map((account) => subscriptionIdFor(account.email));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
