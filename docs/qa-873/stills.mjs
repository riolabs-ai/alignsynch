/**
 * #873 QA stills — headless Chrome over CDP, no driver dependency.
 *
 * Three frames, each asserted in the DOM before the shutter:
 *   1. the initiator's draft, edit panel + Aspect editor in the rail/content (steps 1–2)
 *   2. the same draft with the plan door (step 3 — no method on file)
 *   3. the publish form once a method is on file (step 4)
 *   4. the counterparty's published relationship: the read-only notice and its door
 *
 * Cookies come from `qa873-rig.mjs` (Node signs in; a page-origin sign-in answers 403
 * INVALID_ORIGIN on this branch).
 */
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const OUT = process.argv[2] ?? "docs/qa-873";
const COOKIES = process.argv[3] ?? "/tmp/qa873-cookies.json";
const BASE = "http://localhost:4317";
const PORT = 9333;
const WIDTH = 1440;

mkdirSync(OUT, { recursive: true });

const chrome = spawn(
  "/usr/bin/google-chrome",
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    "--user-data-dir=/tmp/chrome-qa873",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--hide-scrollbars",
    "about:blank",
  ],
  { stdio: "ignore", detached: false },
);

let wsUrl = null;
for (let i = 0; i < 60; i += 1) {
  await sleep(300);
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
    const page = list.find((t) => t.type === "page");
    if (page?.webSocketDebuggerUrl) {
      wsUrl = page.webSocketDebuggerUrl;
      break;
    }
  } catch {
    /* not up yet */
  }
}
if (wsUrl === null) {
  chrome.kill();
  throw new Error("chrome did not expose a page target");
}

const ws = new WebSocket(wsUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve, { once: true });
  ws.addEventListener("error", reject, { once: true });
});

let id = 0;
const pending = new Map();
ws.addEventListener("message", (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id !== undefined && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
});

function send(method, params = {}) {
  const callId = ++id;
  ws.send(JSON.stringify({ id: callId, method, params }));
  return new Promise((resolve) => pending.set(callId, resolve));
}

async function evaluate(expression) {
  const res = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  return res.result?.result?.value;
}

const { initiator, counterparty } = JSON.parse(readFileSync(COOKIES, "utf8"));

async function setCookies(jar) {
  await send("Network.clearBrowserCookies");
  for (const pair of jar) {
    const eq = pair.indexOf("=");
    const name = pair.slice(0, eq);
    const value = pair.slice(eq + 1);
    const res = await send("Network.setCookie", {
      name,
      value,
      url: BASE,
      secure: true,
      httpOnly: true,
    });
    if (res.result?.success !== true) throw new Error(`cookie ${name} refused`);
  }
}

await send("Page.enable");
await send("Network.enable");
await send("Runtime.enable");

const report = [];

async function shoot({ file, path, jar, label, assert }) {
  await setCookies(jar);
  await send("Emulation.setDeviceMetricsOverride", {
    width: WIDTH,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  const loaded = new Promise((resolve) => {
    const onMsg = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === "Page.loadEventFired") {
        ws.removeEventListener("message", onMsg);
        resolve();
      }
    };
    ws.addEventListener("message", onMsg);
  });
  await send("Page.navigate", { url: `${BASE}${path}` });
  await loaded;
  await sleep(2500); // hydration + the server render settling

  const facts = await evaluate(`(() => {
    const q = (s) => document.querySelector(s);
    return {
      url: location.pathname + location.search,
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      docHeight: document.documentElement.scrollHeight,
      h1: q("h1")?.textContent?.trim() ?? null,
      edit: !!q("[data-relationship-edit]"),
      aspectsSection: !!q("[data-relationship-aspects]"),
      aspectList: !!q('[data-aspect-list="true"]'),
      aspectAdd: !!q('[data-aspect-add="true"]'),
      planDoor: q("[data-publish-gate-link]")?.getAttribute("href") ?? null,
      publishName: !!q("#publish-name"),
      notice: !!q('[data-relationship-read-only="counterparty"]'),
      door: q('[data-relationship-read-only-open="relationships"]')
        ? {
            href: q('[data-relationship-read-only-open="relationships"]').getAttribute("href"),
            text: q('[data-relationship-read-only-open="relationships"]').textContent.trim(),
            box: Math.round(
              q('[data-relationship-read-only-open="relationships"]').getBoundingClientRect().height,
            ),
          }
        : null,
      seat: q("[data-viewer-role]")?.getAttribute("data-viewer-role") ?? null,
      state: q("[data-relationship-status]")?.getAttribute("data-relationship-status") ?? null,
      leaked: /DATABASE_URL|postgres:\\/\\/|npg_|sk_test/.test(document.body.innerText),
    };
  })()`);

  const problems = assert(facts);
  if (problems.length > 0) throw new Error(`${label}: ${problems.join("; ")}`);
  if (facts.innerWidth !== WIDTH) throw new Error(`${label}: innerWidth ${facts.innerWidth}`);
  if (facts.scrollWidth !== facts.innerWidth) throw new Error(`${label}: horizontal overflow`);
  if (facts.leaked) throw new Error(`${label}: body carries an env value`);

  await send("Emulation.setDeviceMetricsOverride", {
    width: WIDTH,
    height: facts.docHeight,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await sleep(400);
  const shot = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(`${OUT}/${file}`, Buffer.from(shot.result.data, "base64"));
  report.push({ file, label, ...facts });
  console.log(`${file}: ${facts.url} h1=${facts.h1} seat=${facts.seat} state=${facts.state}`);
  console.log(`  door=${JSON.stringify(facts.door)} plan=${facts.planDoor}`);
}

/*
 * The plan door is the *absence* of a method on file (`publishable && !hasPaymentMethod`), so the
 * two frames are two database states of one relationship. `method_captured_at` is the row
 * `capturePaymentMethodAction` writes; this script toggles it rather than driving Stripe, labelled
 * as the harness's stand-in for the card entry.
 */
const { default: pg } = await import("pg");
const db = new pg.Client({ connectionString: process.env.DATABASE_URL_UNPOOLED });
await db.connect();

/** A panel's rect, measured at scrollY 0 so a crop from the full-page PNG needs no offset. */
async function rectOf(selector) {
  const rect = await evaluate(`(() => {
    window.scrollTo(0, 0);
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
  })()`);
  return rect;
}

await db.query("delete from relationship_payment where relationship_id = 'qa873-draft'");

await shoot({
  file: "873-initiator-draft-steps-1-3-1440.png",
  path: "/dashboard/relationships/qa873-draft",
  jar: initiator,
  label: "initiator draft — edit · aspects · plan (no method on file)",
  assert: (f) => [
    ...(f.edit ? [] : ["edit panel missing"]),
    ...(f.aspectList && f.aspectAdd ? [] : ["Aspect editor missing"]),
    ...(f.planDoor === "/pricing" ? [] : [`plan door ${f.planDoor}`]),
    ...(f.publishName ? ["publish form drawn with no method on file"] : []),
    ...(f.seat === "initiator" ? [] : [`seat ${f.seat}`]),
    ...(f.notice ? ["counterparty notice on an initiator's screen"] : []),
  ],
});

const planRect = await rectOf('[data-publish-gate="method-required"]');
console.log("plan band rect:", JSON.stringify(planRect));

await db.query(
  `insert into relationship_payment (relationship_id, payer_user_id, provider, method_captured_at, created_at, updated_at)
   select 'qa873-draft', initiator_user_id, 'mock', now(), now(), now()
     from relationship where id = 'qa873-draft'`,
);
await db.end();

await shoot({
  file: "873-initiator-draft-publish-1440.png",
  path: "/dashboard/relationships/qa873-draft",
  jar: initiator,
  label: "initiator draft — publish form",
  assert: (f) => [
    ...(f.publishName ? [] : ["publish form missing"]),
    ...(f.planDoor === null ? [] : ["plan gate still drawn"]),
  ],
});

await shoot({
  file: "873-counterparty-read-only-door-1440.png",
  path: "/dashboard/relationships/qa873-live",
  jar: counterparty,
  label: "counterparty — read-only, with a door",
  assert: (f) => [
    ...(f.notice ? [] : ["read-only notice missing"]),
    ...(f.door?.href === "/dashboard/relationships" ? [] : [`door ${JSON.stringify(f.door)}`]),
    ...(f.door?.box >= 44 ? [] : [`door box ${f.door?.box}`]),
    ...(f.aspectList ? ["editor drawn for a counterparty"] : []),
    ...(f.publishName ? ["publish form drawn for a counterparty"] : []),
    ...(f.edit ? ["edit panel drawn for a counterparty"] : []),
    ...(f.seat === "counterparty" ? [] : [`seat ${f.seat}`]),
  ],
});

writeFileSync(
  `${OUT}/capture-report.json`,
  `${JSON.stringify({ width: WIDTH, planBandRect: planRect, shots: report }, null, 2)}\n`,
);
console.log("report written:", `${OUT}/capture-report.json`);

ws.close();
chrome.kill();
