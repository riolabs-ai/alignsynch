/**
 * #976 — before/after stills + the measured status, for `docs/qa-976-sent-none/`.
 *
 * One headless Chrome over raw CDP (Node 24 has a global `WebSocket`), signed in as the demo
 * initiative **from Node** — the branch's own `/api/auth/sign-in/email` — with the cookies
 * installed through `Network.setCookie` before the first navigation, the same shape
 * `docs/qa-958-no-initiator-member/capture.mjs` uses.
 *
 * The state under test is a relationship whose `session_invite` row does not exist: the invitation
 * was never written. That state is produced by the caller (the row is removed before the `before`
 * phase and restored after the `after` phase), not by this script.
 *
 *   --base    the dev server (default http://localhost:3438; must be `localhost`, not 127.0.0.1,
 *             or Neon Auth refuses the sign-in with `INVALID_ORIGIN`)
 *   --phase   `before` or `after`
 *   --out     the directory the stills and `report.json` land in
 *   --instance  the record id to read (default assessment-instance-avery-rowan)
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

const BASE = arg("base", "http://localhost:3438");
const PHASE = arg("phase", "after");
const OUT = arg("out", import.meta.dirname);
const INSTANCE = arg("instance", "assessment-instance-avery-rowan");
const DEBUG_PORT = 9351;
const PATH = `/assessment/instances/${INSTANCE}/sent`;
const WIDTHS = [1440, 390];

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
const account = await db.query("select email, password from demo_account where email = $1", [
  "initiator@demo.alignsynch.test",
]);
const inviteRow = await db.query(
  "select count(*)::int as n from session_invite where session_record_id = $1",
  [INSTANCE],
);
await db.end();
if (account.rows.length === 0) throw new Error("no demo initiator row — run `pnpm db:seed`");
const inviteRows = inviteRow.rows[0].n;

const signIn = await fetch(`${BASE}/api/auth/sign-in/email`, {
  method: "POST",
  headers: { "content-type": "application/json", origin: BASE },
  body: JSON.stringify(account.rows[0]),
});
if (signIn.status !== 200) {
  throw new Error(`sign-in answered ${String(signIn.status)}: ${await signIn.text()}`);
}
const cookies = signIn.headers.getSetCookie().map((cookie) => cookie.split(";")[0]);
const cookieHeader = cookies.join("; ");

/* ------------------------------------------------------------------ *
 * 2 — the measured status, from Node (a screenshot cannot be asserted on)
 * ------------------------------------------------------------------ */

const response = await fetch(`${BASE}${PATH}`, { headers: { cookie: cookieHeader } });
const body = await response.text();
const band = body.match(/data-sent-status="([\w-]+)"/)?.[1] ?? null;
const sentence =
  body
    .match(/data-sent-status="[\w-]+"[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/)?.[1]
    ?.replace(/<[^>]+>/g, "") ?? null;
const pageCopyError = body.match(/PageCopy: [^<"\\]+/)?.[0] ?? null;

/* ------------------------------------------------------------------ *
 * 3 — one Chrome, over CDP
 * ------------------------------------------------------------------ */

const chrome = spawn(
  "/usr/bin/google-chrome",
  [
    "--headless=new",
    `--remote-debugging-port=${String(DEBUG_PORT)}`,
    `--user-data-dir=/tmp/chrome-976-${PHASE}-${String(Date.now())}`,
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

/** What the document itself says, at whatever status the server answered. */
const PROBE = `(() => {
  const text = (node) => (node ? node.textContent.replace(/\\s+/g, ' ').trim() : null);
  const band = document.querySelector('[data-sent-status]');
  return {
    path: location.pathname,
    title: document.title,
    heading: text(document.querySelector('h1')),
    band: band ? band.getAttribute('data-sent-status') : null,
    sentence: band ? text(band.querySelector('p')) : null,
    errorOverlay: Boolean(document.querySelector('nextjs-portal, .next-error-overlay, [data-nextjs-error]')),
    bodyStart: text(document.body)?.slice(0, 220) ?? null,
  };
})()`;

const widths = {};
for (const width of WIDTHS) {
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height: width === 390 ? 844 : 1000,
    deviceScaleFactor: 1,
    mobile: width === 390,
  });
  await send("Page.navigate", { url: `${BASE}${PATH}` });
  await sleep(4500);
  widths[String(width)] = await evaluate(PROBE);
  const shot = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  writeFileSync(
    join(OUT, `976-${PHASE}-${String(width)}.png`),
    Buffer.from(shot.result.data, "base64"),
  );
}

const report = {
  phase: PHASE,
  base: BASE,
  path: PATH,
  instance: INSTANCE,
  inviteRows,
  capturedAt: new Date().toISOString(),
  http: { status: response.status, band, sentence: sentence?.trim() ?? null, pageCopyError },
  widths,
};
writeFileSync(join(OUT, `${PHASE}-report.json`), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));

socket.close();
chrome.kill();
