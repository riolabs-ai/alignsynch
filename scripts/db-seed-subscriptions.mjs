/**
 * Which demo identities the seed writes a `billing_subscription` for — and why the count in
 * `data/verify/demo-expectations.json` is a **computed** number, not a typed one (#1079, #1091).
 *
 * `membershipOf()` reads a live relationship with no entitling subscription as `lapsed`, so an
 * `active` demo whose initiator holds no live row renders "the initiator's membership ended — the
 * subscription was cancelled … read-only for both of you". That is a status lie, and it is why the
 * seed writes a subscription at all: **one row per demo account that initiates at least one
 * plan-bearing relationship**, on the tier that relationship was bought on, keyed
 * `demo-${email}` — the idempotency key a provider would use, so a re-seed updates the row instead
 * of stacking a second one behind the partial unique index (`one live subscription per account`).
 *
 * **Why this lives in its own module.** `scripts/db-seed.mjs` runs its seed at import, so nothing
 * left inside it can be tested — the same reason `db-seed-invite.mjs`, `db-seed-sweep.mjs`,
 * `db-seed-lock.mjs` and `db-seed-admin-proof.mjs` exist. The expectation file recorded `1` for two
 * datasets while the loop above it wrote two rows: a person typed the number beside the loop, and
 * no check ever computed it. This is that computation's one home — the seed consults it and
 * **refuses** when its own SQL disagrees (`seedDemoSubscriptions`), and
 * `tests/db-seed-subscriptions.test.ts` holds the expectations file equal to it. Neither carries a
 * second copy of the rule.
 */
import { DEMO_ACCOUNTS } from "./db-seed-invite.mjs";

/** The idempotency key of a demo subscription: deterministic, and a provider id's shape. */
export function subscriptionIdFor(email) {
  return `demo-${email}`;
}

/**
 * The demo accounts that get a row: the ones **initiating** at least one relationship whose seeded
 * lifecycle carries a plan.
 *
 * `instances` are the instance rows the seed is writing — a bundle's `payload.instances` and
 * `data/assessments.ts`'s `assessmentInstances` are the same rows, which
 * `tests/db-seed-subscriptions.test.ts` re-measures rather than assumes. `planOf(instance)` is
 * `content/assessment.ts::seededLifecycleOf(instance).plan`, passed in because the plan is a
 * derivation of the lifecycle and this file must not carry a second copy of it.
 *
 * Two predicates, each of which has already been wrong once:
 *
 *   - **initiator, matched by display name.** `bindDemoParties` binds every `party` row named after
 *     the account, and the relationship's `initiator_user_id` follows from the `initiator` seat —
 *     so "this account initiates this instance" is the name on the initiator's party, not a
 *     per-account `(instance, role)` pair.
 *   - **a plan, read from the lifecycle.** Not merely a status: `draft`, `pending` and a `void`
 *     relationship carry no plan at all, while `active`, `complete`, `expired` and a `published`
 *     row that authored one do. Counting statuses instead of plans is how the demo would write a
 *     subscription for an account that bought nothing.
 *
 * The operator (`holdsSeat: false`) holds no seat and therefore initiates nothing.
 */
export function planInitiatingAccounts(instances, planOf, accounts = DEMO_ACCOUNTS) {
  return accounts.filter((account) => {
    if (account.holdsSeat === false) return false;
    return instances.some(
      (instance) =>
        Boolean(planOf(instance)) &&
        instance.parties.some((party) => party.role === "initiator" && party.name === account.name),
    );
  });
}
