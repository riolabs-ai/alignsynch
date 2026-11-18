/**
 * **The fee a completed demo relationship carries** — and the ones no fee can exist for.
 *
 * `relationship_payment` has one row per relationship, written at creation by the product
 * (`lib/flow/store.ts:780` → `lib/db/relationship-payment.ts::openPaymentObligation`, #739). A
 * seeded relationship had none, and the demo's only row was authored by the admin half for the
 * console's charge card (`scripts/db-seed-admin-surfaces.mjs`). The two consequences are the same
 * defect on different screens:
 *
 *   · a `complete` relationship — sealed, both seats accepted, both sheets in — renders its report
 *     while the obligation behind it does not exist, so `/admin` drew a charge for one relationship
 *     out of eight and no screen could say which of the others had ever been paid for;
 *   · the four hand-authored sessions (`avery-rowan`, `marco-priya`, `noor-iris`, `ruth-sam`) held
 *     `relationship.status = 'active'` in production against a dataset that authors `complete`, and
 *     `db:verify` V31 named them — the status and the money were written by different hands.
 *
 * So this module owns the seeded fee, in the product's own words: the amount is the **tier's month
 * price from `data/billing-plans.ts`** (the fixture `billing_plan` is seeded from, so the seeded
 * charge cannot quote a price the checkout would not), and the row is written through the three
 * writers the product uses — `openPaymentObligation`, `recordMethodCaptured`, `recordChargeResult`
 * — never hand-written SQL, so the seeded shape cannot drift from the real one.
 *
 * **Why the schedule is derived, not stored.** A row's instants are its relationship's own
 * `created_at` plus whole days, exactly as `scripts/db-seed-admin-surfaces.mjs` derived the one row
 * it authored before this module owned them: the method comes on file a day after creation, the
 * charge is due a week after that, and it lands a day later. Read from the row, not from a clock,
 * so a second seed converges on the same instants and `0036`'s chronology CHECKs hold by
 * construction (`charge_after_capture`, `charged_or_expired`, `amount_positive`).
 *
 * **A relationship with no payer seat can carry no fee, and that is not a gap to paper over.**
 * `relationship_payment.payer_user_id` is `NOT NULL` and the product writes it only for a creator
 * who has an account (`lib/flow/store.ts:779`, "the payer is an account, and a signed-out create
 * has none"). The demo dataset is two accounts and thirty authored names: only `avery-rowan` and
 * `avery-rowan-summer` put a seat-holding identity on the initiator chair. The other six `complete`
 * rows name Ruth, Marco, Noor, Kenji, Greta and Ada, who have no account, no membership and nothing
 * to charge — inventing a payer for them would be inventing a person. `unpayableCompleteRows()`
 * returns them so the seed can print the census instead of leaving a silent gap, and
 * `tests/db-seed-payments.test.ts` proves every complete row is one or the other.
 *
 * Pure except `seedDemoPayments`, which is the writer and reaches the product's own module. No
 * clock: every instant is arithmetic on the relationship's `created_at`.
 */
import { DEMO_ACCOUNTS } from "./db-seed-invite.mjs";

/** The interval a seeded relationship's fee is charged on — the same one `billing_subscription` uses. */
export const FEE_INTERVAL = "month";

const DAY_MS = 86_400_000;

/** `createdAtIso` shifted by whole days. Pure arithmetic; no clock is read here. */
function daysAfter(createdAtIso, days) {
  const base = Date.parse(createdAtIso);
  if (Number.isNaN(base)) throw new Error(`"${createdAtIso}" is not an instant`);
  return new Date(base + days * DAY_MS).toISOString();
}

/**
 * The instants of one fee, in the order `0036` requires: a day to capture the method, a week's
 * delay on the charge (`METHOD_TRIAL_DAYS`, `lib/flow/payment.ts`), and the charge landing a day
 * after it was due.
 */
export function feeScheduleOf(createdAtIso) {
  const capturedAt = daysAfter(createdAtIso, 1);
  return {
    capturedAt,
    chargeDueAt: daysAfter(capturedAt, 7),
    chargedAt: daysAfter(capturedAt, 8),
  };
}

/**
 * The demo account that holds this session's **payer** seat, or `undefined`.
 *
 * The initiator is the payer (`0036`: "the original initiator always pays"), and a seat belongs to
 * an account by name — the key `bindDemoParties` binds on (`scripts/db-seed.mjs`) and
 * `planInitiatingAccounts` counts on (`scripts/db-seed-subscriptions.mjs`). One derivation, so the
 * subscription, the seat and the fee cannot disagree about who this relationship's money is.
 */
export function payerAccountOf(session, accounts = DEMO_ACCOUNTS) {
  const initiator = session.parties.find((party) => party.role === "initiator");
  if (initiator === undefined) return undefined;
  return accounts.find((account) => account.holdsSeat !== false && account.name === initiator.name);
}

/**
 * The fee rows the seed writes: one per **complete** relationship whose payer seat a demo account
 * holds.
 *
 * `lifecycleOf(session)` is `seededLifecycleOf(session).plan` and `priceOf(planId)` is
 * `planPriceCents(billingPlan(planId), "month")` from `data/billing-plans.ts`; both are passed in
 * because this file is `.mjs` and must import no TypeScript (the same seam
 * `db-seed-subscriptions.mjs` uses). A complete lifecycle with **no** plan has no fee defined, and
 * that is a refusal rather than a guess: `billing_plan` holds no amount for it.
 */
export function payableFeeRows(sessions, lifecycleOf, priceOf, accounts = DEMO_ACCOUNTS) {
  const rows = [];
  for (const session of sessions) {
    const lifecycle = lifecycleOf(session);
    if (lifecycle.status !== "complete") continue;
    if (payerAccountOf(session, accounts) === undefined) continue;
    const planId = lifecycle.plan;
    if (planId === null || planId === undefined) {
      throw new Error(
        `"${session.id}" is a complete seeded relationship with no plan — a completed relationship is paid for on a tier, and no amount can be read for a tier that was not bought`,
      );
    }
    const amountCents = priceOf(planId);
    if (!Number.isInteger(amountCents) || amountCents <= 0) {
      throw new Error(
        `"${session.id}" is complete on the "${planId}" tier, and data/billing-plans.ts carries no positive month price for it — a fee of ${JSON.stringify(amountCents)} is not a fee, and no amount is invented here`,
      );
    }
    const payer = payerAccountOf(session, accounts);
    rows.push({
      relationshipId: `relationship-${session.id}`,
      sessionId: session.id,
      slug: session.slug,
      email: payer.email,
      initiatorName: payer.name,
      planId,
      amountCents,
    });
  }
  return rows;
}

/**
 * The complete relationships **no fee can exist for** — the census line, never a silent gap.
 *
 * A `complete` row whose initiator seat is a fixture name (not an account) has no payer, and
 * `relationship_payment` cannot name one. Their report is real — both seats answered and accepted,
 * which is what the Gap reads — while their money is not: nobody bought anything, because nobody
 * there is a member. Surfacing the count is the difference between "the demo has no fee rows" and
 * "these six relationships have no account to charge".
 */
export function unpayableCompleteRows(sessions, lifecycleOf, accounts = DEMO_ACCOUNTS) {
  const rows = [];
  for (const session of sessions) {
    const lifecycle = lifecycleOf(session);
    if (lifecycle.status !== "complete") continue;
    if (payerAccountOf(session, accounts) !== undefined) continue;
    const initiator = session.parties.find((party) => party.role === "initiator");
    if (initiator === undefined) {
      throw new Error(
        `"${session.id}" is a complete seeded relationship with no initiator seat — a completed relationship names both parties, so this dataset row is broken rather than unpayable`,
      );
    }
    rows.push({ relationshipId: `relationship-${session.id}`, slug: session.slug });
  }
  return rows;
}

/**
 * Write the fee, through the product's writers.
 *
 * `rows` is `payableFeeRows()`'s answer. The row the database holds is authoritative for the three
 * facts the charge is made on — the payer (`relationship.initiator_user_id`), the tier
 * (`relationship.plan`) and the instant the obligation opened (`relationship.created_at`) — so each
 * one is read back and cross-checked against the derivation. A disagreement is a refusal, not a
 * smaller demo: it means the binding and the dataset have parted company, which is exactly the
 * drift `data/verify/demo-expectations.json` would then record as correct.
 *
 * **Idempotent by the writers' own guards**, not by a delete: `openPaymentObligation` is
 * `ON CONFLICT DO NOTHING`, `recordMethodCaptured` writes only while `method_captured_at IS NULL`,
 * and `recordChargeResult` writes a success only while `charged_at IS NULL`. A second seed
 * therefore converges on the row the first one wrote and re-charges nothing.
 */
export async function seedDemoPayments(client, rows) {
  if (rows.length === 0) return { written: [], refused: [] };

  // The product's own writes (`lib/db/relationship-payment.ts`) — a plain `.mjs` reaches them
  // through the resolver `pnpm db:seed` registers (`scripts/ts-modules.mjs`).
  const { openPaymentObligation, recordMethodCaptured, recordChargeResult } = await import(
    "../lib/db/relationship-payment.ts"
  );

  const { rows: facts } = await client.query(
    `SELECT rel.id, rel.status, rel.plan, rel.initiator_user_id, rel.created_at
       FROM relationship rel
      WHERE rel.id = ANY($1::text[])`,
    [rows.map((row) => row.relationshipId)],
  );
  const byId = new Map(facts.map((row) => [row.id, row]));

  const written = [];
  for (const row of rows) {
    const fact = byId.get(row.relationshipId);
    if (fact === undefined) {
      throw new Error(
        `the dataset authors ${row.slug} as a complete relationship, and the branch has no row for ${row.relationshipId} — the content seed and the demo half disagree`,
      );
    }
    if (fact.status !== "complete") {
      throw new Error(
        `${row.relationshipId} holds status "${fact.status}" while data/assessments.ts authors "complete" — a fee is written for a completed relationship, and this row is not one (run \`pnpm db:seed\`)`,
      );
    }
    if (fact.initiator_user_id === null || fact.initiator_user_id === undefined) {
      throw new Error(
        `${row.relationshipId} has no initiator account, and relationship_payment.payer_user_id is NOT NULL — the binding (scripts/db-seed.mjs::bindDemoParties) did not reach this seat`,
      );
    }
    if (fact.plan !== row.planId) {
      throw new Error(
        `${row.relationshipId} was seeded on plan ${JSON.stringify(fact.plan)} while the dataset authors ${JSON.stringify(row.planId)} — the fee would quote a tier the relationship was not bought on`,
      );
    }

    // The amount is the `billing_plan` row a checkout reads, and it must be the fixture's number:
    // `data/billing-plans.ts` is the one home for an amount (V13 holds the table equal to it).
    const { rows: priceRows } = await client.query(
      "SELECT price_cents FROM billing_plan WHERE id = $1 AND interval = $2",
      [row.planId, FEE_INTERVAL],
    );
    const priceCents = priceRows[0]?.price_cents;
    if (priceCents !== row.amountCents) {
      throw new Error(
        `billing_plan carries ${JSON.stringify(priceCents)} cents for "${row.planId}" per ${FEE_INTERVAL}, and data/billing-plans.ts carries ${row.amountCents} — the seeded charge and the price a checkout quotes have parted company (run \`pnpm db:seed\`)`,
      );
    }

    const schedule = feeScheduleOf(new Date(fact.created_at).toISOString());
    // The provider name, as `billing_subscription` and the admin half's row use it: there is no
    // Stripe object behind a demo, and `0036` requires a name rather than a blank.
    const provider = "mock";

    await openPaymentObligation(client, {
      relationshipId: row.relationshipId,
      payerUserId: fact.initiator_user_id,
      provider,
    });
    await recordMethodCaptured(client, {
      relationshipId: row.relationshipId,
      provider,
      // No provider object: the demo has no card, and `0036` stores no card data on purpose.
      customerId: null,
      paymentMethodId: null,
      capturedAt: new Date(schedule.capturedAt),
    });
    await recordChargeResult(client, {
      relationshipId: row.relationshipId,
      at: new Date(schedule.chargedAt),
      result: { ok: true, amountCents: row.amountCents },
    });

    written.push({
      relationshipId: row.relationshipId,
      slug: row.slug,
      amountCents: row.amountCents,
      chargedAt: schedule.chargedAt,
    });
  }

  // Every row either wrote its fee or threw above, so the count is the assertion on the way out:
  // a run that quietly wrote fewer would leave the demo reading "completed, unpaid".
  return { written, refused: [] };
}
