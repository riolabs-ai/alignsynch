/**
 * `pnpm billing:webhooks` — the dashboard's endpoint subscription, recorded and compared (#1055).
 *
 * **Why this exists.** The receiver acts on `STRIPE_WEBHOOK_EVENTS`
 * (`lib/billing/adapters/stripe.ts`), and the events that make it act are enabled **in the
 * provider's dashboard, not in this repository**. Nothing in a build can read that setting, so the
 * two drifted silently once already: the state machine named `invoice.paid` as the trigger of the
 * `expired → active` edge and the endpoint never sent it, while every check stayed green because a
 * green check was never asked. This script is the missing half — it reads the account's endpoints
 * from the API and either records what it found (`--write`) or fails on a difference (`--check`).
 * `tests/billing-webhook-events.test.ts` compares the committed record to the code, so a drift is
 * a red test in the gate and not a discovery six weeks later.
 *
 * Three modes:
 *
 *   --check   (default) compare the account to `tests/fixtures/stripe-webhook-endpoints.json` and
 *             the fixture to `STRIPE_WEBHOOK_EVENTS`. Exit 1 on any difference, naming it.
 *   --write   record the account's endpoints into the fixture. Run after changing the dashboard,
 *             and commit the file with the change that needed it.
 *   --apply   set `enabled_events` on every **test-mode** endpoint whose URL ends in
 *             `/api/billing/webhook` to exactly `STRIPE_WEBHOOK_EVENTS`. Idempotent; prints the
 *             before/after counts per endpoint. Live endpoints are refused, not edited — that is
 *             #847's key and #847's card.
 *
 * The key is read from the repo's env (`scripts/load-env.mjs`) and never printed. `--apply` is the
 * only mode that writes to the provider, and it writes one field.
 *
 *   pnpm billing:webhooks --check
 *   pnpm billing:webhooks --apply && pnpm billing:webhooks --write
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv, requireVariable } from "./load-env.mjs";

/** The API base. Kept in step with `lib/billing/adapters/stripe.ts`. */
const API_BASE = "https://api.stripe.com/v1";

/** Where the record lives. The test suite reads the same file. */
const FIXTURE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "tests",
  "fixtures",
  "stripe-webhook-endpoints.json",
);

/**
 * The events this build acts on — **read out of the adapter's own source**, not repeated here.
 *
 * A script that carried its own copy would be a third list, and the whole point of this file is that
 * two lists drifted. Parsing the exported constant keeps it at two (code, dashboard) and makes the
 * script fail loudly if the constant's shape changes.
 */
function eventsFromAdapter() {
  const source = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "..", "lib", "billing", "adapters", "stripe.ts"),
    "utf8",
  );
  const block = /export const STRIPE_WEBHOOK_EVENTS = \[([\s\S]*?)\] as const;/.exec(source);
  if (block === null) {
    throw new Error("STRIPE_WEBHOOK_EVENTS is not a `[…] as const` array in the adapter");
  }
  const events = [...block[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  if (events.length === 0) throw new Error("STRIPE_WEBHOOK_EVENTS parsed to an empty list");
  return events;
}

function arg(name) {
  return process.argv.includes(`--${name}`);
}

/** One API call. The key is a header and nothing else; an error carries the provider's message. */
async function api(path, { method = "GET", form } = {}) {
  const key = requireVariable("STRIPE_TEST_SECRET_KEY");
  const init = { method, headers: { authorization: `Bearer ${key}` } };
  if (form !== undefined) {
    init.headers["content-type"] = "application/x-www-form-urlencoded";
    init.body = new URLSearchParams(form).toString();
  }
  const response = await fetch(`${API_BASE}${path}`, init);
  const text = await response.text();
  const payload = text === "" ? null : JSON.parse(text);
  if (!response.ok) {
    throw new Error(
      `GET ${path} → HTTP ${response.status}: ${payload?.error?.message ?? "no body"}`,
    );
  }
  return payload;
}

/** Every endpoint on the account, reduced to the facts the record carries. */
async function readEndpoints() {
  const listing = await api("/webhook_endpoints?limit=100");
  return listing.data
    .map((endpoint) => ({
      id: endpoint.id,
      url: endpoint.url,
      livemode: endpoint.livemode === true,
      status: endpoint.status,
      enabledEvents: [...endpoint.enabled_events].sort(),
    }))
    .sort((a, b) => a.url.localeCompare(b.url));
}

/** The endpoints this product owns: the webhook path, test mode, enabled or not. */
function ourEndpoints(endpoints) {
  return endpoints.filter(
    (endpoint) => endpoint.url.endsWith("/api/billing/webhook") && endpoint.livemode === false,
  );
}

function sameSet(a, b) {
  const left = [...new Set(a)].sort();
  const right = [...new Set(b)].sort();
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function report(problems) {
  if (problems.length === 0) return 0;
  console.error(`\n${problems.length} difference(s):`);
  for (const problem of problems) console.error(`  ✗ ${problem}`);
  return 1;
}

async function main() {
  loadEnv();
  const events = eventsFromAdapter();
  const endpoints = await readEndpoints();
  const ours = ourEndpoints(endpoints);

  console.log(`webhook endpoints on this account (test mode): ${ours.length}`);
  for (const endpoint of ours) {
    console.log(
      `  ${endpoint.id} ${endpoint.status} ${endpoint.url} — ${endpoint.enabledEvents.length} events`,
    );
  }

  if (arg("apply")) {
    for (const endpoint of ours) {
      const before = endpoint.enabledEvents;
      if (sameSet(before, events)) {
        console.log(`  = ${endpoint.id} already carries all ${events.length}; nothing to write`);
        continue;
      }
      const form = new URLSearchParams();
      // The provider replaces the whole list, so it is sent whole and in the code's order.
      for (const event of events) form.append("enabled_events[]", event);
      await api(`/webhook_endpoints/${endpoint.id}`, { method: "POST", form });
      console.log(`  ✓ ${endpoint.id}: ${before.length} → ${events.length} events`);
    }
    const after = ourEndpoints(await readEndpoints());
    const problems = after
      .filter((endpoint) => !sameSet(endpoint.enabledEvents, events))
      .map(
        (endpoint) =>
          `${endpoint.id} still differs after --apply: ${endpoint.enabledEvents.join(", ")}`,
      );
    const code = report(problems);
    if (code === 0) console.log("\nevery endpoint carries the code's list.");
    return code;
  }

  if (arg("write")) {
    const record = {
      account: (await api("/account")).id,
      recordedAt: new Date().toISOString().slice(0, 10),
      source: "GET /v1/webhook_endpoints (test mode), reduced to id/url/livemode/status/events",
      endpoints: ours,
    };
    writeFileSync(FIXTURE_PATH, `${JSON.stringify(record, null, 2)}\n`, "utf8");
    console.log(
      `\nrecorded ${ours.length} endpoint(s) → tests/fixtures/stripe-webhook-endpoints.json`,
    );
    return 0;
  }

  const problems = [];
  let recorded = null;
  try {
    recorded = JSON.parse(readFileSync(FIXTURE_PATH, "utf8"));
  } catch (error) {
    problems.push(`tests/fixtures/stripe-webhook-endpoints.json is unreadable: ${error.message}`);
  }

  if (recorded !== null) {
    const recordedById = new Map(recorded.endpoints.map((endpoint) => [endpoint.id, endpoint]));
    for (const endpoint of ours) {
      const known = recordedById.get(endpoint.id);
      if (known === undefined) {
        problems.push(`${endpoint.id} (${endpoint.url}) is not in the record — run --write`);
        continue;
      }
      if (!sameSet(known.enabledEvents, endpoint.enabledEvents)) {
        problems.push(
          `${endpoint.id} differs from the record: dashboard ${endpoint.enabledEvents.length} ` +
            `(${endpoint.enabledEvents.join(", ")}), record ${known.enabledEvents.length}`,
        );
      }
      if (!sameSet(endpoint.enabledEvents, events)) {
        problems.push(
          `${endpoint.id} does not carry the code's list: missing ` +
            `${events.filter((event) => !endpoint.enabledEvents.includes(event)).join(", ") || "none"}`,
        );
      }
    }
    for (const endpoint of recorded.endpoints) {
      if (!ours.some((candidate) => candidate.id === endpoint.id)) {
        problems.push(`${endpoint.id} is in the record but no longer on the account — run --write`);
      }
    }
  }

  const code = report(problems);
  if (code === 0)
    console.log(`\nboth endpoints carry all ${events.length} events the code handles.`);
  return code;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(`billing:webhooks — ${error.message}`);
    process.exit(1);
  },
);
