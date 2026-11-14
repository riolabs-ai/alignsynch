/**
 * #958 — the stills and the census, for `docs/qa/958-no-initiator-member/`.
 *
 * One headless Chrome over raw CDP (Node 24 has a global `WebSocket`), signed in as the demo
 * initiator **from Node**: the auth branch answers a browser `Origin` with `403` and a
 * server-side POST with `200`, so the cookies come from `probe958-signin`'s shape and are installed
 * with `Network.setCookie` before the first navigation.
 *
 *   --base    the dev server (default `http://localhost:3411`; must be `localhost`, not
 *             `127.0.0.1`, or Neon Auth refuses the sign-in with `INVALID_ORIGIN`)
 *   --phase   `before` (re-run on the commit this card was measured against) or `after`
 *   --out     the directory the stills and `report.json` land in
 *
 * What it records is the row's **controls**, not its pixels: `data-invite-members`,
 * `data-publish-to-counterparty`, `data-relationship-read-only` and the two bands' hooks. A
 * screenshot cannot be asserted on, and the claim this card makes is about which control exists.
 */
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const require = createRequire(join(process.cwd(), "package.json"));
const { Client } = require("pg");

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
};

const BASE = arg("base", "http://localhost:3411");
const PHASE = arg("phase", "after");
const OUT = arg("out", import.meta.dirname);
const DEBUG_PORT = 9346;
const RELATIONSHIP = "relationship-assessment-instance-avery-rowan";
const MODAL =
  "/templates/relationship/relationship-basics/create/invite?instance=assessment-instance-avery-rowan";

mkdirSync(OUT, { recursive: true });

/* ------------------------------------------------------------------ *
 * 1 — sign in as the demo Initiator, from Node
 * ------------------------------------------------------------------ */

const env = {};
for (const line of readFileSync(join(process.cwd(), ".env.local"), "utf8").split("\n")) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match) env[match[1]] = match[2].replace(/^"|"$/g, "");
}

const db = new Client({ connectionString: env.DATABASE_URL });
await db.connect();
const account = await db.query("SELECT email, password FROM demo_account WHERE email = $1", [
  "initiator@demo.alignsynch.test",
]);
await db.end();
if (account.rows.length === 0) throw new Error("no demo initiator row — run `pnpm db:seed`");

const signIn = await fetch(`${BASE}/api/auth/sign-in/email`, {
  method: "POST",
  headers: { "content-type": "application/json", origin: BASE },
  body: JSON.stringify(account.rows[0]),
});
if (signIn.status !== 200) {
  throw new Error(`sign-in answered ${String(signIn.status)}: ${await signIn.text()}`);
}
const cookies = signIn.headers.getSetCookie().map((cookie) => cookie.split(";")[0]);

/* ------------------------------------------------------------------ *
 * 2 — one Chrome, over CDP
 * ------------------------------------------------------------------ */

const chrome = spawn(
  "/usr/bin/google-chrome",
  [
    "--headless=new",
    `--remote-debugging-port=${String(DEBUG_PORT)}`,
    `--user-data-dir=/tmp/chrome-958-${PHASE}-${String(Date.now())}`,
    "--no-first-run",
    "--disable-gpu",
    "--hide-scrollbars",
    "about:blank",
  ],
  { stdio: "ignore" },
);

let wsUrl = null;
for (let attempt = 0; attempt < 80 && wsUrl === null; attempt += 1) {
  await sleep(300);
  try {
    const targets = await (await fetch(`http://127.0.0.1:${String(DEBUG_PORT)}/json`)).json();
    wsUrl = targets.find((target) => target.type === "page")?.webSocketDebuggerUrl ?? null;
  } catch {
    /* not listening yet */
  }
}
if (wsUrl === null) throw new Error("chrome never exposed a page target");

const socket = new WebSocket(wsUrl);
await new Promise((resolve) => socket.addEventListener("open", resolve, { once: true }));

let nextId = 0;
const pending = new Map();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id !== undefined && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
  }
});
const send = (method, params = {}) => {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve) => pending.set(id, resolve));
};
const evaluate = async (expression) =>
  (await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true })).result
    ?.result?.value;

await send("Page.enable");
await send("Network.enable");
await send("Runtime.enable");
for (const pair of cookies) {
  const split = pair.indexOf("=");
  await send("Network.setCookie", {
    name: pair.slice(0, split),
    value: pair.slice(split + 1),
    url: BASE,
    secure: true,
    httpOnly: true,
  });
}
await send("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 1200,
  deviceScaleFactor: 1,
  mobile: false,
});

/* ------------------------------------------------------------------ *
 * 3 — the two rows, and the modal they should land on
 * ------------------------------------------------------------------ */

/** The card's own controls, as the DOM has them. */
const CARD_PROBE = `(() => {
  const card = document.querySelector('[data-relationship-card="${RELATIONSHIP}"]');
  const text = (node) => node ? node.textContent.replace(/\\s+/g, ' ').trim() : null;
  if (!card) return { found: false };
  const link = (selector) => {
    const node = card.querySelector(selector);
    return node ? { text: text(node), href: node.getAttribute('href') } : null;
  };
  return {
    found: true,
    role: card.getAttribute('data-relationship-role'),
    status: card.getAttribute('data-relationship-status'),
    inviteMembers: link('[data-invite-members]'),
    publishToCounterparty: link('[data-publish-to-counterparty]'),
    inertInvite: card.querySelector('[data-invite-blocked]')
      ? { text: text(card.querySelector('[data-invite-blocked]')), reason: card.querySelector('[data-invite-blocked]').getAttribute('title') }
      : null,
    blockedWhy: text(card.querySelector('[data-invite-blocked-why]')),
    primary: text(card.querySelector('a.bg-action')),
    disabled: [...card.querySelectorAll('[aria-disabled="true"], button[disabled]')].map(text),
  };
})()`;

/** The detail screen's bands. */
const DETAIL_PROBE = `(() => {
  const text = (node) => node ? node.textContent.replace(/\\s+/g, ' ').trim() : null;
  const links = (selector) => [...document.querySelectorAll(selector)].map((node) => ({
    text: text(node),
    href: node.getAttribute('href'),
  }));
  const aspects = document.querySelector('[data-relationship-aspects]');
  return {
    readOnlyBand: links('[data-relationship-read-only]'),
    publishGate: document.querySelector('[data-publish-gate]')
      ? { state: document.querySelector('[data-publish-gate]').getAttribute('data-publish-gate'), links: [...document.querySelectorAll('[data-publish-gate] a')].map((node) => ({ text: text(node), href: node.getAttribute('href') })) }
      : null,
    inviteMembers: links('[data-invite-members]'),
    publishToCounterparty: links('[data-publish-to-counterparty]'),
    aspectsEditor: aspects ? aspects.querySelectorAll('input, textarea, button').length > 0 : false,
    forkPanel: links('[data-fork-template]').length,
  };
})()`;

/** The modal: which stage it is, and what has to happen for Send to unlock. */
const MODAL_PROBE = `(() => {
  const text = (node) => node ? node.textContent.replace(/\\s+/g, ' ').trim() : null;
  const sendButton = [...document.querySelectorAll('button')].find((button) => /^send/i.test(text(button) ?? ''));
  return {
    path: location.pathname + location.search,
    title: text(document.querySelector('h1')),
    planChoices: document.querySelectorAll('input[type=radio]').length,
    payWalk: Boolean(document.querySelector('[data-pay-action]')),
    payBuys: text(document.querySelector('[data-pay-buys]')),
    sendGate: Boolean(document.querySelector('[data-send-gate]')),
    sendDisabled: sendButton ? sendButton.disabled : null,
    sendLabel: sendButton ? text(sendButton) : null,
  };
})()`;

const report = {
  phase: PHASE,
  base: BASE,
  relationship: RELATIONSHIP,
  capturedAt: new Date().toISOString(),
};

async function visit(path, name, probe) {
  await send("Page.navigate", { url: `${BASE}${path}` });
  await sleep(5000);
  const facts = await evaluate(probe);
  const shot = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(shot.result.data, "base64"));
  return facts;
}

report.list = await visit("/dashboard/relationships", `958-${PHASE}-list`, CARD_PROBE);
report.detail = await visit(
  `/dashboard/relationships/${RELATIONSHIP}`,
  `958-${PHASE}-detail`,
  DETAIL_PROBE,
);
report.modal = await visit(MODAL, `958-${PHASE}-modal`, MODAL_PROBE);

writeFileSync(join(OUT, `${PHASE}-report.json`), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));

socket.close();
chrome.kill();
