/**
 * `pnpm billing:smoke` — the keyless demo, proved against the real database (#289).
 *
 * This is the acceptance script for the billing model: it buys a tier through the **mock** adapter
 * (no key, no network), reads the row back out of Postgres, and then drives the gate through
 * `createInstanceFromTemplate` — the same function the create form's POST endpoint calls, so what
 * it proves is the server-side gate and not a hidden button.
 *
 *   free   a draft in Advanced Mode      allowed, and opens no trial (nothing is published)
 *   free   a second relationship         refused (relationship-limit)
 *   free   publishing that draft         allowed, and grants the 7-day trial (#835)
 *   free   Advanced Mode, published      allowed — the trial *is* the Advanced entitlement
 *   paid   both                          allowed
 *
 * #835 removed the mode refusal and the session-count refusal from the create path, so the four
 * outcomes this script used to print (`instance-limit`, `mode-not-entitled`) are two: the plan's
 * relationship count, and the week the publish grants.
 *
 * It is a script and not a test because the property under test is a **row**: a unit test would
 * need a database and the gate is deliberately database-free (`docs/operations/gate.md`). It cleans up after
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
          AND NOT EXISTS (SELECT 1 FROM session ai WHERE ai.record_id = r.id)
          AND (SELECT count(*) FROM item i WHERE i.record_id = r.id) > 0
        ORDER BY r.id
        LIMIT 1`,
    );
    const templateId = templates[0]?.id;
    if (templateId === undefined) {
      throw new Error("no published template with Aspects — run `pnpm db:seed` first");
    }

    const billing = await import("@/lib/billing");
    const { createInstanceFromTemplate, sendDraftInvitation, FlowError } = await import(
      "@/lib/flow/store"
    );
    const { activeInstanceCount, listSubscriptionsFor } = await import("@/lib/db/billing");

    /* 3 — the free account: one relationship, and the publish trial is the entitlement. ------ */
    heading(`the free account (${FREE_ACCOUNT}) — no subscription`);
    const freeEntitlement = await billing.entitlementForAccount(FREE_ACCOUNT);
    console.log(
      `  plan=${freeEntitlement.planName} paid=${freeEntitlement.paid} ` +
        `maxActiveInstances=${freeEntitlement.maxActiveInstances} advanced=${freeEntitlement.advancedMode}`,
    );

    // A previous run that died before its cleanup would otherwise answer 3a's "no trial" question
    // with its own leftovers. The two ids are this script's alone, so deleting them is safe.
    await client.query("DELETE FROM billing_subscription WHERE user_id = ANY($1::text[])", [
      [FREE_ACCOUNT, PAID_ACCOUNT],
    ]);

    const createOnce = async (userId, mode, draft = false) =>
      createInstanceFromTemplate({
        templateRecordId: templateId,
        initiatorName: "Smoke Initiator",
        counterpartyName: "Smoke Counterparty",
        email: "counterparty@example.test",
        mode,
        viewerUserId: userId,
        ...(draft ? { draft: true } : {}),
      });

    // 3a — a draft is written whatever Mode it asks for (#834), and publishes nothing, so it opens
    //      no trial.
    let draftInstance;
    try {
      draftInstance = await createOnce(FREE_ACCOUNT, "advanced", true);
      createdInstances.push(draftInstance.instanceRecordId);
      const subs = await listSubscriptionsFor(FREE_ACCOUNT);
      if (subs.length === 0) {
        pass(
          "free account wrote an Advanced draft, and no trial opened with it",
          `instance ${draftInstance.instanceRecordId}, 0 subscription(s)`,
        );
      } else {
        fail(
          "free account wrote an Advanced draft, and no trial opened with it",
          `${subs.length} subscription row(s) appeared`,
        );
      }
    } catch (error) {
      fail("free account wrote an Advanced draft", String(error));
    }

    // 3b — the plan's relationship count still refuses (#505), and the sentence names the plan.
    try {
      const created = await createOnce(FREE_ACCOUNT, "basic");
      createdInstances.push(created.instanceRecordId);
      fail("free account refused a second relationship", "it was ALLOWED — the count gate is open");
    } catch (error) {
      if (error instanceof FlowError && error.code === "relationship-limit") {
        pass("free account refused a second relationship", `"${error.message}"`);
      } else {
        fail("free account refused a second relationship", `unexpected error: ${String(error)}`);
      }
    }

    // 3c — publishing the draft is what sells the relationship, so it opens the trial: the entry
    //      paid tier, `trialing`, one week from the publish (#840).
    if (draftInstance !== undefined) {
      const sent = await sendDraftInvitation({
        instanceRecordId: draftInstance.instanceRecordId,
        viewerUserId: FREE_ACCOUNT,
      });
      const trialRows = await listSubscriptionsFor(FREE_ACCOUNT);
      const trial = trialRows.find((row) => row.status === "trialing");
      if (sent.ok && trial !== undefined && trial.plan_id === "basic") {
        pass(
          "publishing the draft granted the 7-day trial",
          `${trial.provider_subscription_id} → plan ${trial.plan_id}/${trial.interval}, ends ${trial.current_period_end}`,
        );
      } else {
        fail(
          "publishing the draft granted the 7-day trial",
          `sent=${JSON.stringify(sent.ok)} rows=${JSON.stringify(trialRows.map((row) => `${row.plan_id}/${row.status}`))}`,
        );
      }

      // 3d — and the trial *is* the Advanced entitlement: the same account is now entitled to the
      //      Mode the old gate refused, and a published Advanced create is allowed.
      const during = await billing.entitlementForAccount(FREE_ACCOUNT);
      try {
        const advanced = await createOnce(FREE_ACCOUNT, "advanced");
        createdInstances.push(advanced.instanceRecordId);
        if (during.advancedMode) {
          pass(
            "the trial entitled Advanced Mode — the published create is allowed (#835)",
            `plan=${during.planName} advanced=${during.advancedMode}, instance ${advanced.instanceRecordId}, ${await activeInstanceCount(FREE_ACCOUNT)} active`,
          );
        } else {
          fail(
            "the trial entitled Advanced Mode",
            `the create was allowed but the entitlement says advanced=${during.advancedMode}`,
          );
        }
      } catch (error) {
        fail("the trial entitled Advanced Mode — the published create is allowed", String(error));
      }
    }

    /* 4 — the paid account: a mock checkout, then both gate answers are yes. ------------------ */
    heading(`the paid account (${PAID_ACCOUNT}) — a mock checkout`);
    const session = await billing.startCheckout({
      userId: PAID_ACCOUNT,
      planId: "principal",
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
      plan_id: "principal",
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
