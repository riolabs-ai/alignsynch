#!/usr/bin/env node
/**
 * `docs/qa/nav-ordering/capture.mjs` — the stills and the measurements for #929 (card
 * `t_6e012a9c`): the rail's **standard menu for every role**, drawn as the owner ordered it.
 *
 *   BASE_URL=http://127.0.0.1:3411 DEMO_PIN=… node docs/qa/nav-ordering/capture.mjs
 *
 * The card's claim is a claim about the *rendered* rail, so a JSON diff is not enough:
 * `data/nav-menu.json` can be right while the shell draws something else. So this walks the app
 * with a browser, signs in through the app's own demo gate for each role, **reads the rail's own
 * markup** (`#app-sidebar [data-nav-group]` and the hrefs under it), asserts the order it claims,
 * and only then takes the picture at 1440 CSS pixels.
 *
 * Two roles, because "one ordering, every role" is exactly the claim that fails when only the
 * admin's rail is photographed: an admin's rail must open on the operator group, and a member's
 * must open on their own work with no `needs` gap closing the staff rows up.
 *
 * Raw Chrome DevTools Protocol over a global `WebSocket` (Node 24) — no Playwright, no Puppeteer,
 * no dependency, the same shape `scripts/demo-flow.mjs` and `docs/qa-*` use. Nothing here writes
 * to the app; the sign-in is the seeded demo identity, not a new account.
 */
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = (process.env.BASE_URL ?? "http://127.0.0.1:3411").replace(/\/+$/, "");
const CHROME = process.env.CHROME_BIN ?? "/usr/bin/google-chrome";
const PORT = Number(process.env.NAV_SHOT_DEBUG_PORT ?? 9466);
const WIDTH = 1440;
const HEIGHT = 900;

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = HERE;

const PIN = process.env.DEMO_PIN ?? "";
if (PIN.trim() === "") throw new Error("DEMO_PIN is not set — the demo gate is the only door here");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
  return path;
}

/* ------------------------------------------------------------------ *
 * Chrome and one CDP session
 * ------------------------------------------------------------------ */

let chrome = null;

async function launchChrome() {
  if (!existsSync(CHROME)) throw new Error(`no Chrome at ${CHROME} — set CHROME_BIN`);
  // Never under the repo: a Chrome profile is ~1 200 files and one in `docs/` makes `biome check`
  // walk it (the same trap `scripts/demo-flow.mjs` records).
  const profile = mkdtempSync(join(tmpdir(), "nav-ordering-profile-"));
  chrome = spawn(
    CHROME,
    [
      "--headless=new",
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      `--window-size=${WIDTH},${HEIGHT}`,
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  chrome.stderr.on("data", () => {});
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (response.ok) return;
    } catch {
      // not listening yet
    }
    await sleep(100);
  }
  throw new Error(`Chrome did not answer on ${PORT} within 10 s`);
}

function stopChrome() {
  if (chrome !== null && chrome.exitCode === null) chrome.kill("SIGTERM");
  chrome = null;
}

async function attach() {
  const listed = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = listed.find((target) => target.type === "page");
  if (page === undefined) throw new Error("no page target — is Chrome headless running?");

  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  let nextId = 1;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id === undefined) return;
    const entry = pending.get(message.id);
    if (entry === undefined) return;
    pending.delete(message.id);
    if (message.error) entry.reject(new Error(`${message.error.message} (${entry.method})`));
    else entry.resolve(message.result ?? {});
  });

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject, method });
      socket.send(JSON.stringify({ id, method, params }));
    });

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: WIDTH,
    height: HEIGHT,
    deviceScaleFactor: 1,
    mobile: false,
  });
  return { send, close: () => socket.close() };
}

/* ------------------------------------------------------------------ *
 * Page helpers
 * ------------------------------------------------------------------ */

async function evaluate(send, expression) {
  const result = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? "evaluate threw");
  }
  return result.result?.value;
}

async function navigate(send, path) {
  await send("Page.navigate", { url: `${BASE}${path}` });
  await waitFor(send, `document.readyState === "complete"`, { label: `load ${path}` });
}

async function waitFor(send, expression, { timeout = 20000, label = expression } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      if ((await evaluate(send, expression)) === true) return;
    } catch {
      // The document is between navigations; try again.
    }
    await sleep(100);
  }
  const where = await evaluate(
    send,
    `({ url: location.pathname + location.search, head: document.body.innerText.replace(/\\s+/g, " ").slice(0, 400) })`,
  ).catch(() => null);
  throw new Error(
    `timed out waiting for ${label}\n    at ${where?.url ?? "(unread)"}\n    page: ${where?.head ?? ""}`,
  );
}

async function fill(send, selector, value) {
  const json = JSON.stringify(value);
  await evaluate(
    send,
    `(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (el === null) throw new Error("no " + ${JSON.stringify(selector)});
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setter.call(el, ${json});
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    })()`,
  );
}

async function click(send, selector) {
  await evaluate(
    send,
    `(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (el === null) throw new Error("no " + ${JSON.stringify(selector)});
      el.click();
      return true;
    })()`,
  );
}

/**
 * The rail as the browser has it: one entry per drawn group, with the label the fixture printed
 * and the hrefs underneath it, in document order.
 */
async function railOrder(send) {
  return await evaluate(
    send,
    `(() => {
      const rail = document.querySelector("#app-sidebar");
      if (rail === null) return null;
      const groups = [...rail.querySelectorAll("[data-nav-group]")].map((group) => ({
        label: (group.querySelector("p")?.textContent ?? "").trim(),
        hrefs: [...group.querySelectorAll("a[href]")].map((anchor) => anchor.getAttribute("href")),
      }));
      return {
        groups,
        width: Math.round(rail.getBoundingClientRect().width),
        innerWidth: window.innerWidth,
      };
    })()`,
  );
}

/** The screen at 1440 CSS pixels wide and as tall as the document. */
async function shutter(send, file) {
  await evaluate(
    send,
    `(() => { const el = document.activeElement; if (el && typeof el.blur === "function") el.blur(); return true; })()`,
  );
  const height = await evaluate(
    send,
    "Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, 900)",
  );
  await send("Emulation.setDeviceMetricsOverride", {
    width: WIDTH,
    height: Math.min(height, 6000),
    deviceScaleFactor: 1,
    mobile: false,
  });
  await sleep(300);
  const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
  const bytes = Buffer.from(shot.data, "base64");
  writeFileSync(file, bytes);
  await send("Emulation.setDeviceMetricsOverride", {
    width: WIDTH,
    height: HEIGHT,
    deviceScaleFactor: 1,
    mobile: false,
  });
  return { sha256: createHash("sha256").update(bytes).digest("hex"), h: Math.min(height, 6000) };
}

/* ------------------------------------------------------------------ *
 * The walk
 * ------------------------------------------------------------------ */

const ADMIN_GROUP = [
  "/admin/inbox",
  "/admin/console",
  "/admin/instances",
  "/admin/gaps",
  "/admin/growth",
  "/admin/billing",
  "/admin/broadcast",
  "/admin/docs",
  "/admin/audit",
];
const WORKSPACE = ["/dashboard/relationships", "/assessments", "/dashboard/templates"];
const SUPPORT_GROUP = ["/admin/review", "/dashboard/help", "/admin/health", "/dashboard/support"];

/** The app's own door: PIN, then the role button (/demo → /login, #183/#218). */
async function signIn(send, role) {
  await navigate(send, "/demo");
  await waitFor(send, `!!document.querySelector("#demo-pin")`, { label: "the PIN gate on /demo" });
  await fill(send, "#demo-pin", PIN);
  await click(send, "form button[type=submit]");
  await waitFor(send, `location.pathname === "/login"`, { label: "the PIN to unlock /login" });

  const selector = `form:has(input[name="as"][value="${role}"]) button[type=submit]`;
  await waitFor(send, `!!document.querySelector(${JSON.stringify(selector)})`, {
    label: `the "${role}" role button`,
  });
  await click(send, selector);
  await waitFor(send, `location.pathname !== "/login"`, { label: `sign in as ${role}` });
}

function fail(message) {
  console.error(`✗ ${message}`);
  process.exitCode = 1;
}

function expectEqual(actual, expected, what) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    fail(`${what}\n    expected ${e}\n    actual   ${a}`);
    return false;
  }
  console.log(`  ✓ ${what}`);
  return true;
}

const measurements = { base: BASE, width: WIDTH, roles: [] };

async function shootRole(send, { role, signInAs, path, file }) {
  console.log(`\n— ${role} · ${path}`);
  await signIn(send, signInAs);
  await navigate(send, path);
  await waitFor(send, `!!document.querySelector("#app-sidebar")`, { label: "the rail" });
  // The rail is expanded at `lg`; an icon-only column would photograph the wrong thing.
  await waitFor(send, `window.innerWidth === ${WIDTH}`, { label: `a ${WIDTH}px viewport` });

  const rail = await railOrder(send);
  if (rail === null) throw new Error("the shell drew no #app-sidebar");
  console.log(`  rail width ${rail.width}px · innerWidth ${rail.innerWidth}px`);
  for (const group of rail.groups) {
    console.log(`  ${group.label}`);
    for (const href of group.hrefs) console.log(`    ${href}`);
  }

  if (role === "admin") {
    expectEqual(
      rail.groups.map((group) => group.hrefs),
      [ADMIN_GROUP, WORKSPACE, SUPPORT_GROUP],
      "an admin's rail draws the operator group first, then Workspace, then Support",
    );
  } else {
    expectEqual(
      rail.groups.map((group) => group.hrefs),
      [WORKSPACE, ["/dashboard/help", "/dashboard/support"]],
      "a member's rail draws the same order with the staff rows filtered out — no gap closed up",
    );
    expectEqual(
      rail.groups.flatMap((group) => group.hrefs).filter((href) => href.startsWith("/admin")),
      [],
      "a member's rail draws no /admin row at all",
    );
  }

  const shot = await shutter(send, file);
  console.log(`  → ${file} (${shot.h}px tall, sha256 ${shot.sha256.slice(0, 12)}…)`);
  measurements.roles.push({ role, route: path, groups: rail.groups, shot: file, ...shot });
}

async function main() {
  ensureDir(OUT);
  await launchChrome();
  const { send, close } = await attach();
  try {
    await shootRole(send, {
      role: "admin",
      signInAs: "admin",
      path: "/admin/console",
      file: join(OUT, "admin-console-1440.png"),
    });
    // The member's rail: the `initiator` demo account is the seeded member identity
    // (`lib/auth/demo-accounts.ts` — initiator | counterparty | admin; there is no "member" button,
    // a member *is* the party the two member buttons sign in as).
    await shootRole(send, {
      role: "member (initiator)",
      signInAs: "initiator",
      path: "/dashboard/relationships",
      file: join(OUT, "member-relationships-1440.png"),
    });
  } finally {
    close();
    stopChrome();
  }

  const file = join(OUT, "measurements.json");
  writeFileSync(file, `${JSON.stringify(measurements, null, 2)}\n`);
  // The artifact is committed, and `pnpm lint` runs `biome check` over the tree — so a capture run
  // leaves it in the shape the gate wants rather than a red lint for the next person. A failure
  // here is not a capture failure: the measurements are already written, and the values are the
  // evidence.
  const formatted = spawnSync("pnpm", ["exec", "biome", "format", "--write", file], {
    cwd: join(HERE, "..", ".."),
    stdio: "ignore",
  });
  if (formatted.status !== 0) console.warn("  (could not run `biome format` on the artifact)");
  console.log(`\nmeasurements → ${file}`);
  if (process.exitCode === 1) console.error("\n✗ the rendered rail disagrees with #929");
  else console.log("\n✓ the rendered rail is the owner's order, for both roles");
}

await main();
