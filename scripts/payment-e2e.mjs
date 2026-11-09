#!/usr/bin/env node
/**
 * `pnpm payment:e2e` — the payer's two acts, on the demo branch, as a signed-in initiator (#739).
 *
 * The card's diagnosis was that the whole payment workflow was green on the server and reachable
 * from nothing. This script is the wire half of the answer, and it is deliberately split in two
 * because the acts are **server actions**: a script can render the screen and read the rows it
 * writes, but the clicks belong to a browser. So:
 *
 *   setup      one signed-in account, one relationship carried through the four create stages, the
 *              counterparty's claim, both sheets answered and both acceptances recorded — the
 *              state the fee is gated on, reached through the app's own requests. Then the payer's
 *              screen is fetched and asserted to **draw both acts**.
 *   verify     after a browser has pressed them: the method is on file, the fee landed, the
 *              relationship is `complete`, and the instance the payer was gated out of now reads
 *              the Gap. This is the "a member can pay" column of the report.
 *   teardown   deletes what `setup` wrote — the rows and the auth account — because `pnpm db:seed`
 *              refuses a branch carrying assessment records it does not author.
 *
 * **Nothing here decides anything.** Creation, sealing, capture and completion all go through the
 * app's endpoints and actions; this script reads the rows back to prove it. The only thing it
 * writes itself is a JSON handoff file (relationships, instance ids, the signed-in cookie) so the
 * browser pass knows which screen to open as which account — never a secret that outlives the run.
 *
 * Usage:
 *   BASE_URL=http://localhost:3100 node --import ./scripts/ts-modules.mjs scripts/payment-e2e.mjs setup
 *   … a browser presses "Add a payment method", then "Complete and open the Gap" …
 *   BASE_URL=http://localhost:3100 node --import ./scripts/ts-modules.mjs scripts/payment-e2e.mjs verify
 *   … teardown
 *
 * `PAYMENT_E2E_STATE` names the handoff file (default: `.payment-e2e.json` in the repo root, which
 * `.gitignore` already covers — it carries a session cookie and must never be committed).
 */
import { randomBytes } from "node:crypto";
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { Client } from "pg";

const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const STATE_PATH = process.env.PAYMENT_E2E_STATE ?? ".payment-e2e.json";
const TEMPLATE_ID = "assessment-relationship-basics";

const failures = [];

function check(name, ok, detail = "") {
  console.log(`${ok ? "✔" : "✘"} ${name}${detail === "" ? "" : ` — ${detail}`}`);
  if (!ok) failures.push(name);
}

/* ------------------------------------------------------------------ *
 * One browser, as a cookie jar
 * ------------------------------------------------------------------ */

class Jar {
  constructor(label) {
    this.label = label;
    this.cookies = new Map();
  }

  absorb(response) {
    for (const raw of response.headers.getSetCookie?.() ?? []) {
      const pair = raw.split(";")[0];
      const index = pair.indexOf("=");
      if (index === -1) continue;
      const name = pair.slice(0, index);
      const value = pair.slice(index + 1);
      if (value === "") this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  header() {
    return [...this.cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
  }

  async get(path) {
    const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
    const response = await fetch(url, { redirect: "manual", headers: { cookie: this.header() } });
    this.absorb(response);
    return {
      status: response.status,
      location: response.headers.get("location"),
      html: await response.text(),
    };
  }

  async post(path, fields) {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      redirect: "manual",
      headers: { cookie: this.header(), "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(fields).toString(),
    });
    this.absorb(response);
    return {
      status: response.status,
      location: response.headers.get("location"),
      html: await response.text(),
    };
  }

  async postJson(path, body) {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      redirect: "manual",
      headers: { cookie: this.header(), "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    this.absorb(response);
    return { status: response.status, body: await response.json().catch(() => null) };
  }
}

/* ------------------------------------------------------------------ *
 * The account — created through the branch's own auth, signed in through the app's proxy
 * ------------------------------------------------------------------ */

async function createAccount(email, password, name) {
  const base = (process.env.NEON_AUTH_BASE_URL ?? "").replace(/\/+$/, "");
  if (base === "") throw new Error("NEON_AUTH_BASE_URL is not set — the run needs this branch's auth");
  const response = await fetch(`${base}/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE_URL },
    body: JSON.stringify({ email, password, name }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      `account ${email}: sign-up answered HTTP ${response.status}${body?.code ? ` (${body.code})` : ""}`,
    );
  }
  const userId = body?.user?.id;
  if (typeof userId !== "string") throw new Error(`account ${email}: sign-up answered no user id`);
  return userId;
}

/** Sign in through `/api/auth` — the same door `/login` uses, so the session is a real one. */
async function signIn(email, password) {
  const jar = new Jar("initiator");
  const response = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE_URL },
    body: JSON.stringify({ email, password }),
  });
  jar.absorb(response);
  const body = await response.json().catch(() => null);
  check(
    `the payer signs in as ${email}`,
    response.ok && body?.user?.id !== undefined,
    `HTTP ${response.status}`,
  );
  if (!response.ok) throw new Error(`sign-in refused: HTTP ${response.status}`);
  return jar;
}

/* ------------------------------------------------------------------ *
 * One relationship, through the screens the app draws
 * ------------------------------------------------------------------ */

function instanceIdIn(location) {
  return location?.match(/[?&]instance=([0-9a-f-]{36})/)?.[1] ?? null;
}

async function createRelationship(jar, templateAspects, label) {
  const stem = (recordId) => `/assessment/templates/${recordId}/create`;
  const who = await jar.post("/assessment/new/who", {
    templateRecordId: TEMPLATE_ID,
    initiatorName: "Avery E2E",
    counterpartyName: "Rowan E2E",
    email: `${label}-rowan@example.test`,
    title: `Avery and Rowan ${label}`,
    description: "",
  });
  check(
    `[${label}] stage 1 Details answers 303 to Settings`,
    who.status === 303 && (who.location ?? "").endsWith(`${stem(TEMPLATE_ID)}/mode`),
    `${who.status} ${who.location}`,
  );

  const mode = await jar.post("/assessment/new/mode", {
    templateRecordId: TEMPLATE_ID,
    mode: "basic",
    alignmentSetting: "soft",
  });
  check(
    `[${label}] stage 2 Settings answers 303 to Aspects`,
    mode.status === 303 && (mode.location ?? "").endsWith(`${stem(TEMPLATE_ID)}/aspects`),
    `${mode.status} ${mode.location}`,
  );

  const saved = await jar.postJson("/assessment/new/aspects", {
    templateRecordId: TEMPLATE_ID,
    aspects: templateAspects,
  });
  check(`[${label}] stage 3 saves its list`, saved.status === 200 && saved.body?.ok === true);

  const committed = await jar.post("/assessment/new", { templateRecordId: TEMPLATE_ID });
  check(
    `[${label}] stage 4 commits`,
    committed.status === 303,
    `${committed.status} ${committed.location}`,
  );
  return committed;
}

/** Answer both sheets and record both acceptances — the seal the fee is gated on. */
async function seal(jars, instancePath, aspectIds) {
  const sheet = (feel, wish) => {
    const fields = {};
    for (const itemId of aspectIds) {
      fields[`feel:${itemId}`] = String(feel);
      fields[`wish:${itemId}`] = String(wish);
    }
    return fields;
  };
  for (const [role, jar, feel, wish] of [
    ["initiator", jars.initiator, 2, 5],
    ["counterparty", jars.counterparty, 5, 3],
  ]) {
    const answered = await jar.post(`${instancePath}/answers`, sheet(feel, wish));
    check(
      `the ${role} answers every Aspect`,
      answered.status === 303,
      `${answered.status} ${answered.location}`,
    );
    const page = await jar.get(`${instancePath}/accept`);
    const action = (page.html.match(/<form\b[^>]*action="([^"]*\/accepts)"[^>]*>/) ?? [])[1];
    const accepted = await jar.post(action ?? `${instancePath}/accepts`, {});
    check(
      `the ${role} accepts`,
      accepted.status === 303,
      `${accepted.status} ${accepted.location}`,
    );
  }
}

/* ------------------------------------------------------------------ *
 * setup
 * ------------------------------------------------------------------ */

async function setup(db) {
  const stamp = Date.now();
  const email = `payer-${stamp}@demo.alignsynch.test`;
  // 24 random bytes, and it lives only in the handoff file this run deletes.
  const password = randomBytes(24).toString("base64url");
  const userId = await createAccount(email, password, "Avery E2E");
  const initiator = await signIn(email, password);

  /*
   * The payer needs a live membership before a relationship can be published: `membershipOf()`
   * reads a `published`/`active` relationship with no trial and no subscription as **lapsed**, and
   * the claim refuses it (`claim=lapsed`). That is the product's own rule, not this script's — a
   * paid relationship is paid for — so the run buys a plan through the app's checkout route, on the
   * keyless mock adapter, exactly as the pricing page does.
   */
  const checkout = await initiator.postJson("/api/billing/checkout", {
    planId: "basic",
    interval: "month",
  });
  check(
    "the payer buys a plan through the app's checkout",
    checkout.status === 200 && checkout.body?.completed === true,
    `HTTP ${checkout.status}${checkout.body?.error ? ` (${checkout.body.error})` : ""}`,
  );

  const items = await db.query(
    "SELECT item_id, prompt, left_value, right_value FROM item WHERE record_id = $1 ORDER BY position",
    [TEMPLATE_ID],
  );
  const aspects = items.rows.map((row) => ({
    id: row.item_id,
    prompt: row.prompt,
    leftValue: row.left_value,
    rightValue: row.right_value,
  }));
  check(`the template carries ${aspects.length} Aspects to answer`, aspects.length > 0);

  const committed = await createRelationship(initiator, aspects, `pay-${stamp}`);
  // A signed-in creator closes onto the dashboard, so the id is the row, not the address.
  const newest = await db.query(
    `SELECT rel.id, s.record_id, rel.status
       FROM relationship rel
       JOIN session s ON s.relationship_id = rel.id
      WHERE rel.initiator_user_id = $1
      ORDER BY rel.created_at DESC LIMIT 1`,
    [userId],
  );
  const relationship = newest.rows[0];
  check(
    "the relationship is bound to the signed-in payer, not to a cookie",
    relationship !== undefined,
    relationship === undefined ? `no row after ${committed.status} ${committed.location}` : relationship.id,
  );
  if (relationship === undefined) throw new Error("the create wrote no relationship for this account");

  const instancePath = `/assessment/instances/${relationship.record_id}`;
  const inviteScreen = await initiator.get(instancePath);
  const link = inviteScreen.html.match(/http:\/\/[^\s"<>]+\/invite\/[A-Za-z0-9_-]{43}/)?.[0];
  check("the invitation link is on the creator's screen", link !== undefined);
  if (link === undefined) throw new Error("no invitation link on the instance screen");
  const token = link.split("/invite/")[1];

  const counterparty = new Jar("counterparty");
  const claim = await counterparty.post(`/invite/${token}/claim`, { confirm: "Rowan E2E" });
  check(
    "the counterparty claims the invitation",
    claim.status === 303,
    `${claim.status} ${claim.location}`,
  );

  await seal({ initiator, counterparty }, instancePath, items.rows.map((row) => row.item_id));

  const sealed = await db.query(
    `SELECT rel.status,
            (SELECT rp.method_captured_at FROM relationship_payment rp WHERE rp.relationship_id = rel.id) AS method_captured_at,
            (SELECT rp.charged_at FROM relationship_payment rp WHERE rp.relationship_id = rel.id) AS charged_at,
            (SELECT count(*) FROM party p WHERE p.session_record_id = $2 AND p.accepted_at IS NOT NULL)::int AS accepted,
            (SELECT count(*) FROM opinion o WHERE o.session_record_id = $2)::int AS opinions
       FROM relationship rel WHERE rel.id = $1`,
    [relationship.id, relationship.record_id],
  );
  const facts = sealed.rows[0];
  check(
    "both sheets are sealed and nothing is on file",
    facts?.status === "active" && facts.accepted === 2 && facts.opinions > 0 &&
      facts.method_captured_at === null && facts.charged_at === null,
    `status=${facts?.status} accepted=${facts?.accepted} opinions=${facts?.opinions} method=${facts?.method_captured_at}`,
  );

  /* The payer's screen: the two acts, drawn. */
  const screen = await initiator.get(`/dashboard/relationships/${relationship.id}`);
  const state = {
    baseUrl: BASE_URL,
    email,
    password,
    userId,
    relationshipId: relationship.id,
    instanceId: relationship.record_id,
    cookie: initiator.header(),
    setup: {
      relationship: "active",
      accepted: facts?.accepted,
      opinions: facts?.opinions,
      methodCapturedAt: facts?.method_captured_at,
      chargedAt: facts?.charged_at,
    },
  };
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));

  check("the payer's detail screen renders", screen.status === 200, `status ${screen.status}`);
  check(
    "and draws the completion gate with both acts",
    screen.html.includes('data-completion-gate="none"') &&
      screen.html.includes('data-capture-method="true"') &&
      screen.html.includes('data-complete-relationship="true"'),
    `gate=${/data-completion-gate="([a-z-]+)"/.exec(screen.html)?.[1] ?? "absent"}`,
  );
  check(
    "it says the fee and its deadline before anyone clicks",
    screen.html.includes('data-completion-amount="') && screen.html.includes("has to be paid by"),
  );
  const counterpartyScreen = await counterparty.get(`/dashboard/relationships/${relationship.id}`);
  check(
    "the Counterparty's screen draws no act at all",
    !counterpartyScreen.html.includes("data-completion-gate"),
    `status ${counterpartyScreen.status}`,
  );

  console.log(`\nstate written to ${STATE_PATH}`);
  console.log(`relationship ${relationship.id} · instance ${relationship.record_id}`);
}

/* ------------------------------------------------------------------ *
 * verify — after the browser has pressed both acts
 * ------------------------------------------------------------------ */

async function verify(db, state) {
  const jar = new Jar("initiator");
  for (const pair of state.cookie.split("; ")) {
    const index = pair.indexOf("=");
    jar.cookies.set(pair.slice(0, index), pair.slice(index + 1));
  }

  const after = await db.query(
    `SELECT rel.status, rel.completed_at,
            rp.method_captured_at, rp.charged_at, rp.charge_amount_cents,
            (SELECT count(*) FROM admin_action a
              WHERE a.target_table = 'relationship' AND a.target_id = rel.id)::int AS actions
       FROM relationship rel
       LEFT JOIN relationship_payment rp ON rp.relationship_id = rel.id
      WHERE rel.id = $1`,
    [state.relationshipId],
  );
  const facts = after.rows[0];
  check(
    "the method is on file",
    facts?.method_captured_at !== null && facts?.method_captured_at !== undefined,
    `method_captured_at=${facts?.method_captured_at}`,
  );
  check(
    "the fee landed",
    facts?.charged_at !== null && facts?.charged_at !== undefined && facts.charge_amount_cents > 0,
    `charged_at=${facts?.charged_at} amount=${facts?.charge_amount_cents}`,
  );
  check("the relationship is complete", facts?.status === "complete", `status=${facts?.status}`);
  check(
    "the payer's acts left audit rows",
    facts?.actions >= 2,
    `${facts?.actions} admin_action row(s) on the relationship`,
  );

  const instance = await jar.get(`/assessment/instances/${state.instanceId}`);
  check(
    "the Gap is open to the payer",
    instance.html.includes("data-alignment-gap") || instance.html.includes("data-alignment-aspect"),
    `status ${instance.status}, alignment rows ${(instance.html.match(/data-alignment-gap="/g) ?? []).length}`,
  );
  check(
    "and the session no longer reads awaiting payment",
    !instance.html.includes("awaiting_payment"),
  );

  const screen = await jar.get(`/dashboard/relationships/${state.relationshipId}`);
  check(
    "the screen reports the fee it took",
    screen.html.includes('data-completion-gate="charged"') || screen.html.includes("data-completion-charged"),
    `gate=${/data-completion-gate="([a-z-]+)"/.exec(screen.html)?.[1] ?? "absent"}`,
  );

  const report = {
    relationshipId: state.relationshipId,
    instanceId: state.instanceId,
    status: facts?.status,
    methodCapturedAt: facts?.method_captured_at,
    chargedAt: facts?.charged_at,
    amountCents: facts?.charge_amount_cents,
    adminActions: facts?.actions,
    gapRows: (instance.html.match(/data-alignment-gap="/g) ?? []).length,
  };
  console.log(`\n${JSON.stringify(report, null, 2)}`);
  return report;
}

/* ------------------------------------------------------------------ *
 * teardown
 * ------------------------------------------------------------------ */

async function teardown(db, state) {
  const base = (process.env.NEON_AUTH_BASE_URL ?? "").replace(/\/+$/, "");
  await db.query("DELETE FROM admin_action WHERE target_table = 'relationship' AND target_id = $1", [
    state.relationshipId,
  ]);
  await db.query("DELETE FROM relationship_payment WHERE relationship_id = $1", [state.relationshipId]);
  await db.query("DELETE FROM session_invite WHERE session_record_id = $1", [state.instanceId]);
  await db.query("DELETE FROM opinion WHERE session_record_id = $1", [state.instanceId]);
  await db.query("DELETE FROM party WHERE session_record_id = $1", [state.instanceId]);
  await db.query("DELETE FROM item WHERE record_id = $1", [state.instanceId]);
  await db.query("DELETE FROM response_option WHERE record_id = $1", [state.instanceId]);
  await db.query("DELETE FROM session WHERE record_id = $1", [state.instanceId]);
  await db.query("DELETE FROM record WHERE id = $1", [state.instanceId]);
  await db.query("DELETE FROM relationship WHERE id = $1", [state.relationshipId]);
  await db.query(
    "DELETE FROM record WHERE id IN (SELECT template_id FROM relationship WHERE initiator_user_id = $1)",
    [state.userId],
  ).catch(() => undefined);
  await db.query("DELETE FROM demo_account WHERE email = $1", [state.email]).catch(() => undefined);
  await db.query("DELETE FROM user_profile WHERE user_id = $1", [state.userId]).catch(() => undefined);
  await db
    .query("DELETE FROM billing_subscription WHERE user_id = $1", [state.userId])
    .catch(() => undefined);
  if (base !== "") {
    // The auth user lives in `neon_auth`, which the app never migrates — the branch's own endpoint
    // is the supported way to remove it.
    await fetch(`${base}/delete-user`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE_URL },
      body: JSON.stringify({ userId: state.userId }),
    }).catch(() => undefined);
  }
  unlinkSync(STATE_PATH);
  console.log("teardown: the relationship, its rows and the account are gone");
}

/* ------------------------------------------------------------------ */

async function main() {
  const mode = process.argv[2] ?? "setup";
  const db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  try {
    if (mode === "setup") {
      await setup(db);
    } else if (mode === "verify") {
      const state = JSON.parse(readFileSync(STATE_PATH, "utf8"));
      await verify(db, state);
    } else if (mode === "teardown") {
      const state = JSON.parse(readFileSync(STATE_PATH, "utf8"));
      await teardown(db, state);
    } else {
      throw new Error(`unknown mode "${mode}" — setup | verify | teardown`);
    }
  } finally {
    await db.end();
  }
  if (failures.length > 0) {
    console.error(`\n${failures.length} check(s) failed:\n- ${failures.join("\n- ")}`);
    process.exitCode = 1;
  }
}

await main();
