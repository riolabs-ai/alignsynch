/**
 * `pnpm billing:stripe:smoke` — a **test-mode** checkout, an event from the provider, and a row
 * (#289, card 2 of 3).
 *
 * This is the acceptance script for the hosted adapter, and it is a script rather than a test
 * because the property under test is a row plus a real delivery: a unit test cannot complete a
 * hosted Checkout page. What it does, in order:
 *
 *   1. reads the credentials from `.env.local` and proves the provider's answer is `livemode:
 *      false` — test mode, from the API, not from the key's name;
 *   2. creates a Checkout Session **through the adapter** (the same code a route calls) and prints
 *      the hosted URL;
 *   3. waits for the page to be paid (card `4242 4242 4242 4242`, any future date, any CVC);
 *   4. reads the `checkout.session.completed` event the provider recorded and delivers it to the
 *      running app's webhook **twice**, then delivers a forged body;
 *   5. prints the `billing_event` count, the subscription row, and the entitlement;
 *   6. deletes every row it wrote — the smoke must not poison `pnpm db:seed`.
 *
 * It prints no key, no signature and no body. The subscription id it prints is the evidence.
 *
 *   PORT=3131 pnpm start &                      # the app, in another shell
 *   pnpm billing:stripe:smoke                   # this script
 *
 * Options:
 *   --url <base>        the app to deliver to (default http://localhost:3131)
 *   --account <id>      the throwaway account (default billing-stripe-smoke)
 *   --plan <id>         the tier to buy (default pro)
 *   --interval <m|y>    month or year (default month)
 *   --wait <seconds>    how long to wait for the card (default 600)
 *   --keep              leave the rows in place (they are printed either way)
 */
import { createHmac, randomUUID } from "node:crypto";
import { Client } from "pg";
import { syncBillingPlans } from "./billing-plans.mjs";
import { loadEnv, requireVariable, writeDatabaseUrl } from "./load-env.mjs";

/** The API base. Kept in step with `lib/billing/adapters/stripe.ts`. */
const API_BASE = "https://api.stripe.com/v1";

const results = [];

function pass(label, detail) {
  results.push({ ok: true, label });
  console.log(`  ✓ ${label}`);
  if (detail) console.log(`      ${detail}`);
}

function fail(label, detail) {
  results.push({ ok: false, label });
  console.log(`  ✗ ${label}`);
  if (detail) console.log(`      ${detail}`);
}

function heading(text) {
  console.log(`\n${text}`);
  console.log("─".repeat(Math.max(12, text.length)));
}

function argOf(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : (process.argv[index + 1] ?? fallback);
}

/** One API call. The key is a header and nothing else; errors carry the provider's message only. */
async function api(path, { method = "GET", form } = {}) {
  const key = requireVariable("STRIPE_TEST_SECRET_KEY");
  const init = { method, headers: { authorization: `Bearer ${key}` } };
  if (form !== undefined) {
    init.headers["content-type"] = "application/x-www-form-urlencoded";
    init.body = new URLSearchParams(form).toString();
  }
  const response = await fetch(`${API_BASE}${path}`, init);
  const text = await response.text();
  let payload = null;
  try {
    payload = text === "" ? null : JSON.parse(text);
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const message = payload?.error?.message ?? response.statusText;
    throw new Error(`${method} ${path} → HTTP ${response.status}: ${message}`);
  }
  return payload;
}

/** `t=<seconds>,v1=HMAC_SHA256(secret, "t.body")` — the provider's own signing scheme. */
function signedHeader(rawBody, secret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const mac = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex");
  return `t=${timestamp},v1=${mac}`;
}

/** Deliver one body to the app's webhook. Returns the status and the parsed answer. */
async function deliver(appUrl, rawBody, signature) {
  const response = await fetch(`${appUrl}/api/billing/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "stripe-signature": signature },
    body: rawBody,
  });
  const text = await response.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 200) };
  }
  return { status: response.status, body };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  loadEnv();

  const appUrl = argOf("url", "http://localhost:3131").replace(/\/+$/, "");
  const account = argOf("account", "billing-stripe-smoke");
  const planId = argOf("plan", "pro");
  const interval = argOf("interval", "month") === "y" ? "year" : "month";
  const waitSeconds = Number.parseInt(argOf("wait", "600"), 10);
  const keep = process.argv.includes("--keep");

  /* 0 — the credentials exist, and the account is in test mode. ------------------------------- */
  heading("credentials — names only, never values");
  for (const name of [
    "STRIPE_TEST_SECRET_KEY",
    "STRIPE_TEST_WEBHOOK_SECRET",
    "STRIPE_TEST_PUBLISHABLE_KEY",
  ]) {
    const value = process.env[name]?.trim() ?? "";
    console.log(`  ${name.padEnd(28)} ${value === "" ? "unset" : `${value.length} characters`}`);
  }

  const balance = await api("/balance");
  const testMode = balance?.livemode === false;
  if (testMode) {
    pass(
      "the API answers livemode=false — this is test mode",
      `balance.livemode=${balance.livemode}`,
    );
  } else {
    fail("the API is in test mode", `livemode=${balance?.livemode} — refusing to continue`);
    process.exitCode = 1;
    return;
  }

  /* 1 — a checkout session, created by the adapter. -------------------------------------------- */
  const billing = await import("@/lib/billing");
  if (billing.billingProvider() !== "stripe") {
    fail(
      "BILLING_PROVIDER selects the hosted adapter",
      `it is "${billing.billingProvider()}" — run with BILLING_PROVIDER=stripe`,
    );
    process.exitCode = 1;
    return;
  }

  heading("checkout — created through lib/billing, not through curl");
  const session = await billing.startCheckout({
    userId: account,
    planId,
    interval,
    successUrl: `${appUrl}/pricing?billing=complete`,
    cancelUrl: `${appUrl}/pricing?billing=cancelled`,
    email: "billing-smoke@example.test",
  });
  console.log(`  session    ${session.id}`);
  console.log(`  provider   ${session.provider}`);
  console.log(
    `  completed  ${session.completed} (a hosted checkout completes on the provider's page)`,
  );
  console.log(`  url        ${session.url}`);

  const created = await api(`/checkout/sessions/${session.id}`);
  if (created?.livemode === false) {
    pass(
      "the session itself reports livemode=false",
      `amount_total=${created.amount_total} ${created.currency}`,
    );
  } else {
    fail("the session is a test-mode object", `livemode=${created?.livemode}`);
  }
  console.log(
    `\n  → pay it with card 4242 4242 4242 4242, any future expiry, any CVC.\n` +
      `    waiting up to ${waitSeconds}s for the page to report complete…`,
  );

  /* 2 — wait for the card. --------------------------------------------------------------------- */
  const deadline = Date.now() + waitSeconds * 1000;
  let completedSession = created;
  while (completedSession?.status !== "complete" && Date.now() < deadline) {
    await sleep(3000);
    completedSession = await api(`/checkout/sessions/${session.id}`);
    if (completedSession?.status === "complete") break;
    process.stdout.write(".");
  }
  process.stdout.write("\n");

  if (completedSession?.status !== "complete") {
    fail(
      "the checkout completed in test mode",
      `session status is "${completedSession?.status}" after ${waitSeconds}s`,
    );
    process.exitCode = 1;
    return;
  }
  const subscriptionId = completedSession.subscription;
  if (typeof subscriptionId === "string" && subscriptionId.startsWith("sub_")) {
    pass(
      "the test-card checkout completed, and produced a subscription",
      `session ${session.id} status=${completedSession.status} payment_status=${completedSession.payment_status} subscription=${subscriptionId}`,
    );
  } else {
    fail("the checkout produced a subscription id", `subscription=${String(subscriptionId)}`);
    process.exitCode = 1;
    return;
  }

  const stripeSubscription = await api(`/subscriptions/${subscriptionId}`);
  console.log(
    `  subscription ${stripeSubscription.id} status=${stripeSubscription.status} ` +
      `customer=${stripeSubscription.customer} livemode=${stripeSubscription.livemode}`,
  );

  /* 3 — the event the provider recorded, delivered twice. -------------------------------------- */
  const events = await api("/events?type=checkout.session.completed&limit=20");
  const event = (events?.data ?? []).find((candidate) => candidate.data?.object?.id === session.id);
  if (event === undefined) {
    fail("the provider recorded a checkout.session.completed event", "none matched this session");
    process.exitCode = 1;
    return;
  }
  const rawBody = JSON.stringify(event);
  const secret = requireVariable("STRIPE_TEST_WEBHOOK_SECRET");

  heading("webhook — the real event, delivered twice, then forged");
  const first = await deliver(appUrl, rawBody, signedHeader(rawBody, secret));
  console.log(`  first delivery  HTTP ${first.status} ${JSON.stringify(first.body)}`);
  const second = await deliver(appUrl, rawBody, signedHeader(rawBody, secret));
  console.log(`  replay          HTTP ${second.status} ${JSON.stringify(second.body)}`);

  if (first.status === 200 && first.body?.applied === true) {
    pass("the first delivery applied the event", `kind=${first.body.kind}`);
  } else {
    fail("the first delivery applied the event", `HTTP ${first.status}`);
  }
  if (
    second.status === 200 &&
    second.body?.applied === false &&
    second.body?.kind === "duplicate"
  ) {
    pass("the replay applied nothing — it is a duplicate", `detail=${second.body.detail}`);
  } else {
    fail(
      "the replay was reported as a duplicate",
      `HTTP ${second.status} ${JSON.stringify(second.body)}`,
    );
  }

  const forgedBody = rawBody.includes('"livemode":false')
    ? rawBody.replace('"livemode":false', '"livemode":false,"tampered":true')
    : `${rawBody} `;
  if (forgedBody === rawBody) {
    fail("a forged body was rejected", "the probe could not alter the body it was given");
  }
  const forged = await deliver(appUrl, forgedBody, signedHeader(rawBody, secret));
  console.log(`  forged body     HTTP ${forged.status} ${JSON.stringify(forged.body)}`);
  if (forged.status === 400 && forged.body?.error === "invalid-request") {
    pass("a forged body was rejected on its signature", `"${forged.body.message}"`);
  } else {
    fail("a forged body was rejected", `HTTP ${forged.status} ${JSON.stringify(forged.body)}`);
  }

  /* 4 — the rows, read back out of Postgres. --------------------------------------------------- */
  const client = new Client({
    connectionString: writeDatabaseUrl(),
    application_name: "billing:stripe:smoke",
  });
  await client.connect();
  try {
    // The plan rows a subscription's foreign key needs. Idempotent, and it is the same fixture the
    // seed writes, so this smoke runs on a branch that has never been through `pnpm db:seed`.
    await syncBillingPlans(client);

    heading("billing_event — the idempotency key");
    const { rows: events_ } = await client.query(
      `SELECT provider, provider_event_id, type, payload_digest, received_at::text AS received_at
         FROM billing_event WHERE provider = 'stripe' AND provider_event_id = $1`,
      [event.id],
    );
    for (const row of events_) {
      console.log(
        `  ${row.provider} ${row.provider_event_id} ${row.type} received=${row.received_at}`,
      );
      console.log(`  digest ${row.payload_digest.slice(0, 16)}…`);
    }
    if (events_.length === 1) {
      pass("billing_event holds exactly one row for two deliveries", `count=${events_.length}`);
    } else {
      fail("billing_event holds one row for two deliveries", `count=${events_.length}`);
    }

    heading("billing_subscription — the row the webhook wrote");
    const { rows: subscriptions } = await client.query(
      `SELECT user_id, plan_id, interval, provider, provider_subscription_id, status,
              current_period_end::text AS current_period_end, created_at::text AS created_at
         FROM billing_subscription WHERE user_id = $1
         ORDER BY created_at DESC`,
      [account],
    );
    for (const row of subscriptions) {
      for (const [key, value] of Object.entries(row)) console.log(`  ${key.padEnd(24)} ${value}`);
    }
    if (subscriptions.length === 1 && subscriptions[0].provider === "stripe") {
      pass(
        "one subscription row, applied once",
        `${subscriptions[0].provider_subscription_id} → ${subscriptions[0].plan_id}/${subscriptions[0].interval} ${subscriptions[0].status}`,
      );
    } else {
      fail("one subscription row, applied once", `count=${subscriptions.length}`);
    }

    heading("entitlement — what the account may now do");
    const entitlement = await billing.entitlementForAccount(account);
    console.log(
      `  plan=${entitlement.planName} paid=${entitlement.paid} ` +
        `maxActiveInstances=${entitlement.maxActiveInstances} advanced=${entitlement.advancedMode}`,
    );
    if (entitlement.planId === planId) {
      pass("the account bought the tier and the gate says so", `plan=${entitlement.planName}`);
    } else {
      fail("the account bought the tier", `entitlement plan=${entitlement.planId}`);
    }

    /* 5 — leave the tree as it was found. ------------------------------------------------------ */
    if (!keep) {
      await client.query("DELETE FROM billing_subscription WHERE user_id = $1", [account]);
      await client.query(
        "DELETE FROM billing_event WHERE provider = 'stripe' AND provider_event_id = $1",
        [event.id],
      );
      const { rows: left } = await client.query(
        `SELECT (SELECT count(*) FROM billing_subscription WHERE user_id = $1)::int AS subscriptions,
                (SELECT count(*) FROM billing_event WHERE provider = 'stripe' AND provider_event_id = $2)::int AS events`,
        [account, event.id],
      );
      console.log(
        `\n  · cleaned up (rows left: ${left[0].subscriptions} subscription, ${left[0].events} event)`,
      );
    } else {
      console.log(`\n  · --keep: the rows for ${account} are still in the database`);
    }
  } finally {
    await client.end();
  }

  const failed = results.filter((result) => !result.ok);
  heading("summary");
  console.log(
    `${results.length - failed.length}/${results.length} check(s) passed` +
      (failed.length === 0
        ? " — a test-mode checkout, a signed delivery applied once, a forged one refused"
        : ""),
  );
  if (failed.length > 0) process.exitCode = 1;
  console.log(`  run ${randomUUID().slice(0, 8)}`);
}

main().catch((error) => {
  console.error(
    "billing:stripe:smoke — failed:",
    error instanceof Error ? error.message : String(error),
  );
  process.exitCode = 1;
});
