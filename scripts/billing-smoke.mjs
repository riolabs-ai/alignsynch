/**
 * `pnpm billing:smoke` — the keyless demo, proved against the real database (#289).
 *
 * This is the acceptance script for the billing model: it buys a tier through the **mock** adapter
 * (no key, no network), reads the row back out of Postgres, and then drives the four gate outcomes
 * through `createInstanceFromTemplate` — the same function the create form's POST endpoint calls,
 * so what it proves is the server-side gate and not a hidden button.
 *
 *   free   a second active instance        refused  (instance-limit)
 *   free   Advanced Mode                   refused  (mode-not-entitled)
 *   paid   both                            allowed
 *   paid   an ordinary Basic instance      allowed
 *
 * It is a script and not a test because the property under test is a **row**: a unit test would
 * need a database and the gate is deliberately database-free (`docs/GATE.md`). It cleans up after
 * itself — the instances it creates, the subscriptions it buys and the checkout events it records
 * are deleted at the end — because `pnpm db:seed` refuses a tree carrying assessment records it
 * does not author, and a smoke that poisoned the next seed would be a trap.
 *
 * Run it against the demo branch after `pnpm db:migrate` (the script seeds the plan rows itself,
 * so it works on a database that has never been through `db:seed`):
 *
 *   pnpm billing:smoke
 */
import { Client } from "pg";
import { syncBillingPlans } from "./billing-plans.mjs";
import { loadEnv, writeDatabaseUrl } from "./load-env.mjs";

/** The two accounts this script owns. Fixed ids, so a re-run converges instead of accumulating. */
const FREE_ACCOUNT = "billing-smoke-free";
const PAID_ACCOUNT = "billing-smoke-paid";

const results = [];

function pass(label, detail) {
  results.push({ ok: true, label, detail });
  console.log(`  ✓ ${label}`);
  if (detail) console.log(`      ${detail}`);
}

function fail(label, detail) {
  results.push({ ok: false, label, detail });
  console.log(`  ✗ ${label}`);
  if (detail) console.log(`      ${detail}`);
}

/** Prints `key: value` rows under a heading, so the acceptance has something to paste. */
function heading(text) {
  console.log(`\n${text}`);
  console.log("─".repeat(Math.max(12, text.length)));
}

async function main() {
  loadEnv();

  const client = new Client({
    connectionString: writeDatabaseUrl(),
    application_name: "billing:smoke",
  });
  await client.connect();

  const createdInstances = [];
  try {
    /* 1 — the plan rows, from the same fixture a pricing surface renders. --------------------- */
    heading("billing_plan — seeded from data/billing-plans.ts");
    const rows = await syncBillingPlans(client);
    const { rows: planRows } = await client.query(
      "SELECT id, interval, name, price_cents, active FROM billing_plan ORDER BY id, interval",
    );
    for (const row of planRows) {
      console.log(
        `  ${row.id.padEnd(11)} ${row.interval.padEnd(6)} $${(row.price_cents / 100).toFixed(2).padStart(8)}  ${row.name}${row.active ? "" : "  (inactive)"}`,
      );
    }
    if (planRows.length === rows.length) {
      pass(`${planRows.length} billing_plan row(s) match the fixture`);
    } else {
      fail(`${planRows.length} row(s) in the table, ${rows.length} in the fixture`);
    }

    /* 2 — a published, un-instanced template to copy. ---------------------------------------- */
    const { rows: templates } = await client.query(
      `SELECT r.id
         FROM record r
        WHERE r.record_type = 'assessment'
          AND r.status = 'published'
          AND NOT EXISTS (SELECT 1 FROM assessment_instance ai WHERE ai.record_id = r.id)
          AND (SELECT count(*) FROM item i WHERE i.record_id = r.id) > 0
        ORDER BY r.id
        LIMIT 1`,
    );
    const templateId = templates[0]?.id;
    if (templateId === undefined) {
      throw new Error("no published template with Aspects — run `pnpm db:seed` first");
    }

    const billing = await import("@/lib/billing");
    const { createInstanceFromTemplate, FlowError } = await import("@/lib/flow/store");
    const { activeInstanceCount, listSubscriptionsFor } = await import("@/lib/db/billing");

    /* 3 — the free account: one instance, Basic Mode only. ---------------------------------- */
    heading(`the free account (${FREE_ACCOUNT}) — no subscription`);
    const freeEntitlement = await billing.entitlementForAccount(FREE_ACCOUNT);
    console.log(
      `  plan=${freeEntitlement.planName} paid=${freeEntitlement.paid} ` +
        `maxActiveInstances=${freeEntitlement.maxActiveInstances} advanced=${freeEntitlement.advancedMode}`,
    );

    const createOnce = async (userId, mode) =>
      createInstanceFromTemplate({
        templateRecordId: templateId,
        initiatorName: "Smoke Initiator",
        counterpartyName: "Smoke Counterparty",
        email: "counterparty@example.test",
        mode,
        viewerUserId: userId,
      });

    // 3a — Advanced Mode with nothing open: the mode refusal, not the count one.
    try {
      const created = await createOnce(FREE_ACCOUNT, "advanced");
      createdInstances.push(created.instanceRecordId);
      fail("free account was refused Advanced Mode", "it was ALLOWED — the gate is open");
    } catch (error) {
      if (error instanceof FlowError && error.code === "mode-not-entitled") {
        pass("free account refused Advanced Mode", `"${error.message}"`);
      } else {
        fail("free account refused Advanced Mode", `unexpected error: ${String(error)}`);
      }
    }

    // 3b — the first Basic instance is allowed.
    try {
      const created = await createOnce(FREE_ACCOUNT, "basic");
      createdInstances.push(created.instanceRecordId);
      pass(
        "free account allowed its first Basic instance",
        `instance ${created.instanceRecordId}, ${await activeInstanceCount(FREE_ACCOUNT)} active`,
      );
    } catch (error) {
      fail("free account allowed its first Basic instance", String(error));
    }

    // 3c — the second is refused, and the sentence names the plan.
    try {
      const created = await createOnce(FREE_ACCOUNT, "basic");
      createdInstances.push(created.instanceRecordId);
      fail("free account refused a second active instance", "it was ALLOWED — the gate is open");
    } catch (error) {
      if (error instanceof FlowError && error.code === "instance-limit") {
        pass("free account refused a second active instance", `"${error.message}"`);
      } else {
        fail("free account refused a second active instance", `unexpected error: ${String(error)}`);
      }
    }

    /* 4 — the paid account: a mock checkout, then both gate answers are yes. ------------------ */
    heading(`the paid account (${PAID_ACCOUNT}) — a mock checkout`);
    const session = await billing.startCheckout({
      userId: PAID_ACCOUNT,
      planId: "pro",
      interval: "month",
      successUrl: "http://localhost:3000/pricing?billing=complete",
      cancelUrl: "http://localhost:3000/pricing?billing=cancelled",
      email: "smoke@example.test",
    });
    console.log(
      `  checkout: provider=${session.provider} completed=${session.completed} id=${session.id}`,
    );

    const subscriptionRows = await listSubscriptionsFor(PAID_ACCOUNT);
    heading("billing_subscription — the row the mock checkout wrote");
    for (const row of subscriptionRows) {
      console.log(`  user_id                  ${row.user_id}`);
      console.log(`  plan_id                  ${row.plan_id}`);
      console.log(`  interval                 ${row.interval}`);
      console.log(`  provider                 ${row.provider}`);
      console.log(`  provider_subscription_id ${row.provider_subscription_id}`);
      console.log(`  status                   ${row.status}`);
      console.log(`  current_period_end       ${row.current_period_end}`);
      console.log(`  created_at               ${row.created_at}`);
    }
    const live = subscriptionRows.find((row) => row.status === "active");
    if (live === undefined) {
      fail("the mock checkout wrote an active subscription row", "no active row found");
    } else {
      pass(
        "the mock checkout wrote an active subscription row",
        `${live.provider_subscription_id} → plan ${live.plan_id}/${live.interval}`,
      );
    }

    const paidEntitlement = await billing.entitlementForAccount(PAID_ACCOUNT);
    console.log(
      `  entitlement: plan=${paidEntitlement.planName} paid=${paidEntitlement.paid} ` +
        `maxActiveInstances=${paidEntitlement.maxActiveInstances} advanced=${paidEntitlement.advancedMode}`,
    );

    try {
      const advanced = await createOnce(PAID_ACCOUNT, "advanced");
      createdInstances.push(advanced.instanceRecordId);
      const basic = await createOnce(PAID_ACCOUNT, "basic");
      createdInstances.push(basic.instanceRecordId);
      pass(
        "paid account allowed Advanced Mode and a second instance",
        `${await activeInstanceCount(PAID_ACCOUNT)} active instance(s): ${advanced.instanceRecordId}, ${basic.instanceRecordId}`,
      );
    } catch (error) {
      fail("paid account allowed Advanced Mode and a second instance", String(error));
    }

    /* 5 — the webhook, twice: the second delivery applies nothing. ---------------------------- */
    const { mockSignature } = await import("@/lib/billing/adapters/mock");
    const rawBody = JSON.stringify({
      id: "evt_billing_smoke_1",
      type: "subscription.updated",
      user_id: PAID_ACCOUNT,
      plan_id: "pro",
      interval: "month",
      status: "active",
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
    const first = await billing.handleWebhook({ rawBody, signature: mockSignature(rawBody) });
    const second = await billing.handleWebhook({ rawBody, signature: mockSignature(rawBody) });
    const { rows: eventCount } = await client.query(
      "SELECT count(*)::int AS n FROM billing_event WHERE provider = 'mock' AND provider_event_id = $1",
      ["evt_billing_smoke_1"],
    );
    if (first.applied === true && second.applied === false && eventCount[0].n === 1) {
      pass(
        "a replayed webhook applied once",
        `first=${first.kind} second=${second.kind} billing_event rows=${eventCount[0].n}`,
      );
    } else {
      fail(
        "a replayed webhook applied once",
        `first=${JSON.stringify(first)} second=${JSON.stringify(second)} rows=${eventCount[0].n}`,
      );
    }
  } finally {
    /* 6 — leave the tree as it was found. ---------------------------------------------------- */
    if (createdInstances.length > 0) {
      await client.query("DELETE FROM record WHERE id = ANY($1::text[])", [createdInstances]);
    }
    await client.query("DELETE FROM billing_subscription WHERE user_id = ANY($1::text[])", [
      [FREE_ACCOUNT, PAID_ACCOUNT],
    ]);
    await client.query("DELETE FROM billing_event WHERE provider = 'mock'");
    const { rows: leftovers } = await client.query(
      `SELECT count(*)::int AS n FROM record WHERE id = ANY($1::text[])`,
      [createdInstances],
    );
    if (leftovers[0].n > 0) {
      console.log(`\n  ! cleanup left ${leftovers[0].n} instance record(s) behind`);
      process.exitCode = 1;
    } else if (createdInstances.length > 0) {
      console.log(
        `\n  · cleaned up ${createdInstances.length} smoke instance(s), the subscriptions and the mock events`,
      );
    }
    await client.end();
  }

  const failed = results.filter((result) => !result.ok);
  heading("summary");
  console.log(
    `${results.length - failed.length}/${results.length} check(s) passed` +
      (failed.length === 0 ? " — the gate refuses, the mock charges nothing, the row exists" : ""),
  );
  if (failed.length > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error("billing:smoke — failed:", error);
  process.exitCode = 1;
});
