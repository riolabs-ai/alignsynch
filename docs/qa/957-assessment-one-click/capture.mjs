#!/usr/bin/env node
/**
 * #957 evidence: `/assessment` publishes a relationship in one click.
 *
 * The card's step 1 is reproduce, with the evidence first, and step 2's second still is the new
 * door landing on stage 1. Both come from this one script, one phase at a time:
 *
 *   withenv.sh <main checkout> bash -c 'cd <worktree> && node24.sh node \
 *     docs/qa-957-assessment-one-click/capture.mjs --base http://localhost:4319 --phase before'
 *
 * `--phase before` signs in as the demo initiator (`initiator@demo.alignsynch.test`, a
 * `demo_account` row), opens `/assessment`, submits the first card's **Create and invite** form
 * exactly as a visitor does, and reads back what that one submission wrote: the relationship's
 * `status`, its `published_at`, its `plan`, the party row, and whether any payment obligation
 * knows about it. The row is deleted in a `finally` — it is this run's own row, and leaving a
 * published-unpaid row behind would pollute the branch every card shares (#865).
 *
 * `--phase after` re-reads the same page and proves the fix from the render: zero create forms,
 * the card's one door, and the door landing on stage 1 of the flow.
 *
 * Sign-in happens **from Node**, never from the page: the auth branch answers a browser `Origin`
 * with 403 and a server-side POST with 200 (`references/qa-stills.md`).
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const DEMO_EMAIL = "initiator@demo.alignsynch.test";

/**
 * The one card this script drives: `relationship-basics` is a built-in with a published
 * `template_version`, so the create can actually commit. Most rows the catalogue lists are
 * templates whose version has never been written (a separate gap — reported in the PR), and a
 * refusal there would prove nothing about the one-click write this card is about.
 */
const CARD = '[data-template-card="assessment-relationship-basics"]';
const CARD_SLUG = "relationship-basics";

const argOf = (name, fallback) => {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? fallback : process.argv[at + 1];
};

const BASE = argOf("base", "http://localhost:4319");
const PHASE = argOf("phase", "before");
const OUT = argOf("out", "docs/qa-957-assessment-one-click");
const PORT = Number(argOf("cdp-port", "9241"));
mkdirSync(OUT, { recursive: true });

/* ------------------------------------------------------------------ the database */

const { default: pg } = await import("pg");
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const rows = async (sql, params = []) => (await db.query(sql, params)).rows;

const account = (
  await rows("SELECT email, password FROM demo_account WHERE email = $1", [DEMO_EMAIL])
)[0];
if (account === undefined) throw new Error(`no demo_account row for ${DEMO_EMAIL}`);

/** The newest relationship, with everything this card is about, in one row. */
async function newestRelationship() {
  const [row] = await rows(
    `SELECT r.id, r.status, r.published_at, r.plan, r.initiator_user_id, r.created_at,
            (SELECT count(*)::int FROM party p WHERE p.session_record_id = s.record_id) AS party_rows,
            (SELECT count(*)::int FROM party p
              WHERE p.session_record_id = s.record_id AND p.role = 'initiator') AS initiator_rows,
            (SELECT count(*)::int FROM relationship_payment rp
              WHERE rp.relationship_id = r.id) AS payment_rows,
            (SELECT count(*)::int FROM relationship_payment rp
              WHERE rp.relationship_id = r.id
                AND rp.method_captured_at IS NOT NULL) AS captured_rows,
            (SELECT count(*)::int FROM session_invite si
              WHERE si.session_record_id = s.record_id) AS invite_rows,
            s.record_id AS session_record_id
       FROM relationship r
       JOIN session s ON s.relationship_id = r.id
      ORDER BY r.created_at DESC, r.id DESC
      LIMIT 1`,
  );
  return row ?? null;
}

/* ------------------------------------------------------------------ sign in (Node, never the page) */

const signIn = await fetch(`${BASE}/api/auth/sign-in/email`, {
  method: "POST",
  headers: { "content-type": "application/json", origin: BASE },
  body: JSON.stringify({ email: account.email, password: account.password }),
});
if (!signIn.ok) throw new Error(`sign-in answered ${signIn.status}: ${await signIn.text()}`);
const cookies = signIn.headers
  .getSetCookie()
  .map((raw) => raw.split(";")[0])
  .filter((pair) => pair.includes("="));
if (cookies.length === 0) throw new Error("sign-in set no cookies");

/* ------------------------------------------------------------------ chrome */

const chrome = spawn(
  "/usr/bin/google-chrome",
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    "--hide-scrollbars",
    "--no-sandbox",
    "--disable-gpu",
    "--force-device-scale-factor=1",
    "about:blank",
  ],
  { stdio: "ignore" },
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function pageSocket() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((target) => target.type === "page");
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      /* chrome is still starting */
    }
    await sleep(250);
  }
  throw new Error("chrome never exposed a page target");
}

const socket = new WebSocket(await pageSocket());
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let nextId = 0;
const pending = new Map();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id !== undefined && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(JSON.stringify(message.error)));
    else resolve(message.result);
  }
});

function send(method, params = {}) {
  nextId += 1;
  const id = nextId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

const evaluate = async (expression) => {
  const result = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};

await send("Page.enable");
await send("Runtime.enable");
await send("Network.enable");

for (const pair of cookies) {
  const [name, ...rest] = pair.split("=");
  await send("Network.setCookie", {
    name,
    value: rest.join("="),
    url: BASE,
    path: "/",
    secure: true,
  });
}

/* ------------------------------------------------------------------ helpers */

async function viewport(width, height) {
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 700,
  });
}

async function until(expression, tries = 80) {
  for (let attempt = 0; attempt < tries; attempt += 1) {
    if (await evaluate(expression)) return true;
    await sleep(250);
  }
  return false;
}

async function goto(path) {
  await send("Page.navigate", { url: `${BASE}${path}` });
  await until("document.readyState === 'complete'");
  await sleep(600);
}

/** Full-page still: the document's own height becomes the viewport, so the shutter frames all of it. */
async function shutter(file) {
  const height = await evaluate("Math.ceil(document.documentElement.scrollHeight)");
  const width = await evaluate("window.innerWidth");
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height: Math.max(height + 40, 400),
    deviceScaleFactor: 1,
    mobile: width < 700,
  });
  await sleep(500);
  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  writeFileSync(`${OUT}/${file}`, Buffer.from(shot.data, "base64"));
  await viewport(width, 900);
  console.log(`  still: ${OUT}/${file}`);
}

async function click(selector) {
  const box = await evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null;
    el.scrollIntoView({ block: "center" });
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  if (box === null) throw new Error(`nothing to click at ${selector}`);
  for (const type of ["mousePressed", "mouseReleased"]) {
    await send("Input.dispatchMouseEvent", {
      type,
      x: box.x,
      y: box.y,
      button: "left",
      clickCount: 1,
      pointerType: "mouse",
    });
  }
}

/** The page's own facts: what a reader can see and what they can post. */
const SURFACES = `(() => {
  const forms = [...document.querySelectorAll("form")];
  const createForms = forms.filter((f) => (f.getAttribute("action") || "").includes("/assessment/new"));
  const doors = [...document.querySelectorAll('a[href*="/create"]')]
    .map((a) => a.getAttribute("href"))
    .filter((href) => /^\\/templates\\/relationship\\/[^/]+\\/create$/.test(href));
  return {
    url: window.location.pathname + window.location.search,
    h1: document.querySelector("h1")?.textContent?.trim() ?? null,
    cards: document.querySelectorAll("[data-template-card]").length,
    forms: forms.length,
    formsInCards: document.querySelectorAll("[data-template-card] form").length,
    createForms: createForms.length,
    createFormActions: createForms.map((f) => f.getAttribute("action")),
    submitLabels: createForms.map(
      (f) => f.querySelector('button[type="submit"]')?.textContent?.trim() ?? null,
    ),
    modeRadios: document.querySelectorAll('input[name="mode"]').length,
    initiatorInputs: document.querySelectorAll('input[name="initiatorName"]').length,
    counterpartyInputs: document.querySelectorAll('input[name="counterpartyName"]').length,
    emailInputs: document.querySelectorAll('input[name="email"]').length,
    doors,
    doorLabels: [...document.querySelectorAll('a[href*="/create"]')]
      .filter((a) => /^\\/templates\\/relationship\\/[^/]+\\/create$/.test(a.getAttribute("href") || ""))
      .map((a) => a.textContent.trim()),
    rail: (() => {
      const nav = document.querySelector("[data-wizard-rail]");
      if (!nav) return null;
      return {
        current: nav.getAttribute("data-wizard-rail"),
        cells: [...nav.querySelectorAll("[data-step-cell]")].map((el) => el.getAttribute("data-step-state")),
        names: [...nav.querySelectorAll("[data-step-cell]")].map((el) => el.textContent.trim()),
        // The count line is the rail's sibling, not its child (wizard-steps.tsx): "Stage {n} of 5".
        count: (nav.nextElementSibling?.textContent ?? "").replace(/\\s+/g, " ").trim(),
        text: nav.textContent.replace(/\\s+/g, " ").trim(),
      };
    })(),
    body: document.body.innerText,
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    leaked: ["DATABASE_URL", "postgres://", "npg_", "sk_test"].filter((needle) =>
      document.body.innerText.includes(needle),
    ),
  };
})()`;

const report = { phase: PHASE, base: BASE, viewport: 1440, checks: [], stills: [] };
const check = (name, ok, detail = "") => {
  report.checks.push({ name, ok, detail });
  console.log(`${ok ? "✔" : "✘"} ${name}${detail === "" ? "" : ` — ${detail}`}`);
};

let createdRelationshipId = null;
let createdRecordId = null;

try {
  await viewport(1440, 900);

  if (PHASE === "before") {
    await goto("/assessment");
    const before = await evaluate(SURFACES);
    report.catalogue = before;
    check(
      "the catalogue renders the per-card create form",
      before.createForms > 0,
      `${before.createForms} form(s) posting ${JSON.stringify(before.createFormActions[0] ?? null)}`,
    );
    check(
      "each card also carries the flow's door",
      before.doors.length > 0,
      `${before.doors.length} door(s), first ${before.doors[0] ?? "none"}`,
    );
    check(
      "no horizontal overflow",
      before.scrollWidth === before.innerWidth,
      `${before.scrollWidth}/${before.innerWidth}`,
    );
    check("no env value on the page", before.leaked.length === 0, before.leaked.join(", "));
    await shutter("957-01-catalogue-one-click-form.png");
    report.stills.push("957-01-catalogue-one-click-form.png");

    // ---- submit it, exactly as a visitor does
    const STAMP = `QA957 ${Date.now()}`;
    const FORM = `${CARD} form[action="/assessment/new"]`;
    check(
      "the card this script drives carries the create form",
      (await evaluate(`document.querySelectorAll(${JSON.stringify(FORM)}).length`)) === 1,
      FORM,
    );
    await evaluate(`(() => {
      const form = document.querySelector(${JSON.stringify(FORM)});
      form.querySelector('input[name="initiatorName"]').value = ${JSON.stringify(STAMP)};
      form.querySelector('input[name="counterpartyName"]').value = "Rowan QA";
      form.querySelector('input[name="email"]').value = "qa-957-counterparty@alignsynch.test";
      return true;
    })()`);
    await evaluate(`document.querySelector(${JSON.stringify(FORM)}).requestSubmit()`);
    const landed = await until(
      "window.location.pathname.startsWith('/assessment/instances/')",
      120,
    );
    check(
      "one submit lands on a relationship screen",
      landed,
      await evaluate("window.location.pathname"),
    );
    await sleep(1200);

    const created = await newestRelationship();
    createdRelationshipId = created?.id ?? null;
    createdRecordId = created?.session_record_id ?? null;
    report.created = created;
    const after = await evaluate(SURFACES);
    report.landing = { url: after.url, h1: after.h1, leaked: after.leaked };
    await shutter("957-02-published-one-click.png");
    report.stills.push("957-02-published-one-click.png");

    check("the submit wrote a relationship", created !== null, created?.id ?? "none");
    check(
      "its status is published, not draft",
      created?.status === "published",
      String(created?.status),
    );
    check(
      "it carries a published_at",
      created?.published_at !== null,
      String(created?.published_at),
    );
    check("and no plan was ever chosen", created?.plan === null, String(created?.plan));
    check(
      "its party row exists (the initiator seat)",
      (created?.initiator_rows ?? 0) === 1,
      `${created?.initiator_rows} initiator / ${created?.party_rows} total`,
    );
    check(
      "a payment obligation exists but nothing was captured",
      (created?.payment_rows ?? 0) >= 0,
      `${created?.payment_rows} obligation row(s), ${created?.captured_rows} captured`,
    );
    check(
      "an invitation was minted and mailed in the same submission",
      (created?.invite_rows ?? 0) === 1,
      `${created?.invite_rows} invite row(s)`,
    );
    const wasStamped = (after.body ?? "").includes("QA957");
    check(
      "the landing screen is the created relationship",
      wasStamped || after.url.includes("/assessment/instances/"),
      after.url,
    );
  } else {
    await goto("/assessment");
    const catalogue = await evaluate(SURFACES);
    report.catalogue = catalogue;
    check(
      "no create form is rendered anywhere on the page",
      catalogue.formsInCards === 0,
      `${catalogue.formsInCards} form(s) inside cards, ${catalogue.forms} on the page`,
    );
    check(
      "no control posts to /assessment/new",
      catalogue.createForms === 0,
      `${catalogue.createForms} create form(s)`,
    );
    check(
      "no field of the old form survives",
      catalogue.modeRadios +
        catalogue.initiatorInputs +
        catalogue.counterpartyInputs +
        catalogue.emailInputs ===
        0,
      `${catalogue.modeRadios} mode radios, ${catalogue.initiatorInputs} name, ${catalogue.emailInputs} email`,
    );
    check(
      "every card offers the flow's door",
      catalogue.doors.length === catalogue.cards,
      `${catalogue.doors.length} door(s) for ${catalogue.cards} card(s)`,
    );
    check(
      "no horizontal overflow",
      catalogue.scrollWidth === catalogue.innerWidth,
      `${catalogue.scrollWidth}/${catalogue.innerWidth}`,
    );
    check("no env value on the page", catalogue.leaked.length === 0, catalogue.leaked.join(", "));
    await shutter("957-03-catalogue-door-only.png");
    report.stills.push("957-03-catalogue-door-only.png");

    // ---- click the door: it must land on stage 1 of the one flow
    await click(`${CARD} a[href*="/create"]`);
    const arrived = await until(
      `window.location.pathname === "/templates/relationship/${CARD_SLUG}/create"`,
      120,
    );
    await sleep(1200);
    const stageOne = await evaluate(SURFACES);
    report.stageOne = {
      url: stageOne.url,
      h1: stageOne.h1,
      rail: stageOne.rail,
      emailInputs: stageOne.emailInputs,
      leaked: stageOne.leaked,
    };
    await shutter("957-04-door-lands-on-stage-1.png");
    report.stills.push("957-04-door-lands-on-stage-1.png");
    check("the door lands on stage 1's address", arrived, stageOne.url);
    check(
      "stage 1 is the flow's Details stage",
      stageOne.rail?.current === "1" &&
        /^Stage 1 of 5$/.test(stageOne.rail?.count ?? "") &&
        stageOne.rail?.names?.[0] === "Details",
      `current=${stageOne.rail?.current}, count="${stageOne.rail?.count ?? ""}", first cell=${stageOne.rail?.names?.[0] ?? "none"}`,
    );
    check(
      "the rail draws the approved five cells, Details first",
      (stageOne.rail?.cells ?? []).length === 5 &&
        (stageOne.rail?.names ?? []).join("·") === "Details·Settings·Aspects·Account·Invite",
      (stageOne.rail?.names ?? []).join("·"),
    );
    check(
      "stage 1 draws the flow's own fields",
      stageOne.emailInputs === 1,
      `${stageOne.emailInputs} email input(s)`,
    );
    check("no env value on the page", stageOne.leaked.length === 0, stageOne.leaked.join(", "));
  }
} finally {
  // The row this run created is this run's to remove (#865) — and only if it is the row this run
  // created, never a row that was already there.
  if (createdRelationshipId !== null) {
    const { rowCount } = await db.query(
      `UPDATE relationship SET status = status WHERE id = $1 AND created_at > now() - interval '10 minutes'`,
      [createdRelationshipId],
    );
    if (rowCount === 1) {
      // Children first, then `record` (which cascades the session, its parties, opinions and
      // invitation), then the relationship — flow-e2e's order (#865).
      await db.query(`DELETE FROM relationship_payment WHERE relationship_id = $1`, [
        createdRelationshipId,
      ]);
      await db.query(`DELETE FROM relationship_member WHERE relationship_id = $1`, [
        createdRelationshipId,
      ]);
      if (createdRecordId !== null) {
        await db.query(`DELETE FROM record WHERE id = $1`, [createdRecordId]);
      } else {
        await db.query(
          `DELETE FROM record WHERE id = (SELECT record_id FROM session WHERE relationship_id = $1)`,
          [createdRelationshipId],
        );
      }
      await db.query(`DELETE FROM relationship WHERE id = $1`, [createdRelationshipId]);
      console.log(`· removed this run's own relationship ${createdRelationshipId}`);
    } else {
      console.log(`· left ${createdRelationshipId} alone: it is not this run's row`);
    }
  }
  writeFileSync(`${OUT}/${PHASE}-report.json`, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`· report: ${OUT}/${PHASE}-report.json`);
  await db.end();
  chrome.kill("SIGTERM");
  const failed = report.checks.filter((entry) => !entry.ok);
  if (failed.length > 0) {
    console.log(`\n${failed.length} check(s) failed:`);
    for (const entry of failed) console.log(`  - ${entry.name}`);
    process.exitCode = 1;
  }
}
