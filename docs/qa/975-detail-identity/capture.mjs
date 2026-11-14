#!/usr/bin/env node
/**
 * UX inventory walker — captures screenshots + measurements for the three surfaces named by
 * kanban t_df8c157e (#975): the initiator/counterparty lifecycle, the create-relationship modal,
 * and the member dashboard.
 *
 * Raw CDP, no Playwright (same shape as scripts/demo-flow.mjs). Writes PNGs and a JSON log of
 * measurements into SHOTS. Nothing is written inside the repo.
 *
 *   node capture.mjs --phase=a      (initiator: dashboard, list, detail, modal stages, draft)
 *   node capture.mjs --phase=b      (counterparty: dashboard, list, detail, invite/accept)
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3413";
const CHROME = process.env.CHROME_BIN ?? "/usr/bin/google-chrome";
const DEBUG_PORT = Number(process.env.CDP_PORT ?? 9477);
const WIDTH = 1440;
let emulatedWidth = WIDTH;
async function setWidth(send, width) {
  emulatedWidth = width;
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height: width < 700 ? 844 : VIEWPORT_HEIGHT,
    deviceScaleFactor: 1,
    mobile: width < 700,
  });
}
const VIEWPORT_HEIGHT = 900;
const OUT =
  process.env.SHOTS ??
  "/home/jadenblack/.hermes/profiles/alignsynch-ops/cache/scratch/ux-inventory/shots";
const PHASE = (process.argv.find((a) => a.startsWith("--phase=")) ?? "--phase=a").split("=")[1];
const REL_ID = process.env.REL_ID ?? "relationship-assessment-instance-avery-rowan";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let chrome = null;
async function launchChrome() {
  const profile = mkdtempSync(join(tmpdir(), "ux-inv-profile-"));
  chrome = spawn(
    CHROME,
    [
      "--headless=new",
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      `--window-size=${WIDTH},${VIEWPORT_HEIGHT}`,
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  chrome.stderr.on("data", () => {});
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
      if (r.ok) return;
    } catch {}
    await sleep(100);
  }
  throw new Error("chrome did not answer");
}
function stopChrome() {
  if (chrome !== null && chrome.exitCode === null) chrome.kill("SIGTERM");
}

async function attach() {
  const listed = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
  const list = Array.isArray(listed) ? listed : listed.targetInfos;
  const page = list.find((t) => t.type === "page");
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    socket.addEventListener("open", res, { once: true });
    socket.addEventListener("error", rej, { once: true });
  });
  let nextId = 1;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const m = JSON.parse(event.data);
    if (m.id === undefined) return;
    const entry = pending.get(m.id);
    if (entry === undefined) return;
    pending.delete(m.id);
    if (m.error) entry.reject(new Error(JSON.stringify(m.error)));
    else entry.resolve(m.result);
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  await send("Target.setAutoAttach", {
    autoAttach: true,
    waitForDebuggerOnStart: false,
    flatten: true,
  });
  return { send };
}

async function evaluate(send, expression) {
  const r = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
    userGesture: true,
  });
  if (r.exceptionDetails !== undefined) {
    throw new Error(
      `page threw: ${r.exceptionDetails.text} ${String(r.exceptionDetails.exception?.description ?? "").slice(0, 200)}`,
    );
  }
  return r.result.value;
}

async function waitFor(send, expression, { timeout = 20000, label = expression } = {}) {
  const deadline = Date.now() + timeout;
  let last = null;
  while (Date.now() < deadline) {
    try {
      if (await evaluate(send, expression)) return true;
    } catch (e) {
      last = e;
    }
    await sleep(120);
  }
  throw new Error(`timeout waiting for ${label}${last ? ` (${last.message.slice(0, 120)})` : ""}`);
}

async function navigate(send, path) {
  await send("Page.navigate", { url: `${BASE}${path}` });
  await waitFor(send, `document.readyState === "complete"`, { timeout: 30000, label: path });
  await evaluate(send, "new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))");
  await sleep(300);
}

async function fill(send, selector, value) {
  const ok = await evaluate(
    send,
    `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.focus(); return document.activeElement === el; })()`,
  );
  if (!ok) throw new Error(`no control at ${selector}`);
  await send("Input.insertText", { text: value });
  const landed = await evaluate(
    send,
    `document.querySelector(${JSON.stringify(selector)}).value === ${JSON.stringify(value)}`,
  );
  if (landed) return;
  await evaluate(
    send,
    `(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  })()`,
  );
  const again = await evaluate(
    send,
    `document.querySelector(${JSON.stringify(selector)}).value === ${JSON.stringify(value)}`,
  );
  if (!again) throw new Error(`control at ${selector} did not take the value`);
}

async function click(send, selector, { waitNav = true, timeout = 25000 } = {}) {
  const before = await evaluate(send, "location.href");
  const ok = await evaluate(
    send,
    `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()`,
  );
  if (!ok) throw new Error(`no control at ${selector}`);
  if (!waitNav) return before;
  try {
    await waitFor(
      send,
      `document.readyState === "complete" && location.href !== ${JSON.stringify(before)}`,
      { timeout, label: `nav from ${before}` },
    );
  } catch {}
  await evaluate(send, "new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))");
  await sleep(300);
  return await evaluate(send, "location.href");
}

/** Click the first visible element whose trimmed text matches, among a selector set. */
async function clickText(
  send,
  text,
  selector = "button, a, [role=button]",
  { waitNav = true } = {},
) {
  const before = await evaluate(send, "location.href");
  const ok = await evaluate(
    send,
    `(() => {
    const want = ${JSON.stringify(text)}.trim().toLowerCase();
    for (const el of document.querySelectorAll(${JSON.stringify(selector)})) {
      const t = (el.innerText || el.textContent || "").replace(/\\s+/g, " ").trim().toLowerCase();
      if (t === want || t.startsWith(want)) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) { el.click(); return true; }
      }
    }
    return false;
  })()`,
  );
  if (!ok) throw new Error(`no control with text "${text}"`);
  if (waitNav) {
    try {
      await waitFor(
        send,
        `document.readyState === "complete" && location.href !== ${JSON.stringify(before)}`,
        { timeout: 25000, label: `nav from ${before}` },
      );
    } catch {}
    await evaluate(
      send,
      "new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))",
    );
    await sleep(300);
  }
  return await evaluate(send, "location.href");
}

async function shoot(send, name) {
  await evaluate(
    send,
    `(() => { const el = document.activeElement; if (el && el.blur) el.blur(); return true; })()`,
  );
  const height = await evaluate(
    send,
    "Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, 900)",
  );
  await send("Emulation.setDeviceMetricsOverride", {
    width: emulatedWidth,
    height: Math.min(height, 6000),
    deviceScaleFactor: 1,
    mobile: emulatedWidth < 700,
  });
  await sleep(220);
  const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
  await send("Emulation.setDeviceMetricsOverride", {
    width: emulatedWidth,
    height: VIEWPORT_HEIGHT,
    deviceScaleFactor: 1,
    mobile: emulatedWidth < 700,
  });
  const buf = Buffer.from(shot.data, "base64");
  const file = join(OUT, `${name}.png`);
  writeFileSync(file, buf);
  return { file, sha: createHash("sha256").update(buf).digest("hex").slice(0, 12), height };
}

/** Geometry + copy probe: reads the page the way the spec measures it. */
const PROBE = `(() => {
  const px = (el) => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
  const cs = (el, p) => getComputedStyle(el).getPropertyValue(p);
  const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const main = document.querySelector("main") || document.body;
  const h1 = [...document.querySelectorAll("h1")].find(visible);
  // every top-level block in the content column: direct children of main's inner container
  const blocks = [...main.querySelectorAll(":scope > * > *, :scope > *")].filter(visible).map((el) => ({ tag: el.tagName.toLowerCase(), ...px(el) }));
  const lefts = [...new Set(blocks.map((b) => b.x))].sort((a, b) => a - b);
  const widest = blocks.reduce((m, b) => (b.w > m.w ? b : m), { w: 0 });
  return {
    url: location.pathname + location.search,
    title: document.title,
    doc: { scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, scrollHeight: document.documentElement.scrollHeight },
    main: px(main),
    h1: h1 ? { text: h1.innerText.replace(/\\s+/g, " ").trim(), ...px(h1), fontSize: cs(h1, "font-size"), fontWeight: cs(h1, "font-weight") } : null,
    bodyFont: cs(document.body, "font-family").slice(0, 60),
    contentLefts: lefts.slice(0, 8),
    widestBlock: widest,
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    overflowing: [...document.querySelectorAll("main *")].filter(visible).filter((el) => { const r = el.getBoundingClientRect(); return r.right > document.documentElement.clientWidth + 1 || r.left < -1; }).slice(0, 6).map((el) => ({ tag: el.tagName.toLowerCase(), cls: String(el.className).slice(0, 60), ...px(el) })),
    countBlocks: blocks.length,
  };
})()`;

const log = [];
async function record(send, name, note) {
  const probe = await evaluate(send, PROBE);
  const shot = await shoot(send, name);
  const body = await evaluate(
    send,
    `document.body.innerText.replace(/\\s+/g, " ").trim().slice(0, 2200)`,
  );
  const row = {
    name,
    note: note ?? "",
    probe,
    shot: shot.file,
    sha: shot.sha,
    shotHeight: shot.height,
    body,
  };
  log.push(row);
  console.log(
    `· ${name} ${probe.url} x=${probe.main.x} w=${probe.main.w} h1=${probe.h1 ? probe.h1.x + "/" + probe.h1.fontSize : "-"} overflowX=${probe.overflowX}`,
  );
  return row;
}

async function demoSignIn(send, role) {
  const pin = process.env.DEMO_PIN;
  if (!pin) throw new Error("DEMO_PIN unset");
  await navigate(send, "/demo");
  await waitFor(send, `!!document.querySelector("#demo-pin")`, { label: "demo pin field" });
  await fill(send, "#demo-pin", pin);
  await click(send, "form button[type=submit]");
  await waitFor(send, `location.pathname === "/login"`, { label: "login after pin" });
  const sel = `form:has(input[name="as"][value="${role}"]) button[type=submit]`;
  await waitFor(send, `!!document.querySelector(${JSON.stringify(sel)})`, {
    label: `role button ${role}`,
  });
  await click(send, sel, { timeout: 30000 });
  await waitFor(send, `location.pathname !== "/login"`, { label: "signed in" });
  console.log(`· signed in as ${role} -> ${await evaluate(send, "location.pathname")}`);
}

function save() {
  writeFileSync(join(OUT, `log-${PHASE}.json`), JSON.stringify(log, null, 1));
  console.log(`\nwrote ${join(OUT, `log-${PHASE}.json`)} (${log.length} screens)`);
}

/* ------------------------------------------------------------------ *
 * #975 D2 / D9 — the detail page's identity, both roles, both widths.
 *
 *   node capture-975.mjs --phase=identity      (initiator, then counterparty)
 *
 * Read-only: this walk opens screens and writes PNGs. It creates no relationship and no account.
 * ------------------------------------------------------------------ */

/** What the page says about *whose* relationship it is — the subject of both rows. */
const IDENTITY = `(() => {
  const norm = (s) => (s || "").replace(/\\s+/g, " ").trim();
  const band = document.querySelector('[data-record-band="relationship"]');
  const h1 = document.querySelector('[data-record-band="relationship"] h1') || document.querySelector("h1");
  const chip = document.querySelector("[data-viewer-role]");
  const ro = document.querySelector("[data-relationship-read-only]");
  const facts = document.querySelector("[data-relationship-facts]");
  const txt = norm(document.body.innerText);
  return {
    url: location.pathname,
    h1: h1 ? norm(h1.innerText) : null,
    bandLines: band ? norm(band.innerText) : null,
    seatChip: chip ? { seat: chip.getAttribute("data-viewer-role"), text: norm(chip.innerText) } : null,
    readOnly: ro ? { seat: ro.getAttribute("data-relationship-read-only"), text: norm(ro.innerText) } : null,
    facts: facts ? norm(facts.innerText) : null,
    saysInitiator: (txt.match(/You are the Counterparty/g) || []).length,
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  };
})()`;

async function identity(send, name, note) {
  const probe = await evaluate(send, IDENTITY);
  const shot = await shoot(send, name);
  log.push({
    name,
    note: note ?? "",
    probe,
    shot: shot.file,
    sha: shot.sha,
    shotHeight: shot.height,
  });
  console.log(
    `· ${name} ${probe.url} h1="${probe.h1}" seat=${probe.seatChip ? probe.seatChip.seat : "-"} readOnly=${probe.readOnly ? probe.readOnly.seat : "-"} "You are the Counterparty"×${probe.saysInitiator} overflowX=${probe.overflowX}`,
  );
  console.log(`    band: ${probe.bandLines}`);
  return probe;
}

async function signOut(send) {
  await send("Network.clearBrowserCookies", {});
  await send("Storage.clearDataForOrigin", {
    origin: BASE,
    storageTypes: "cookies,local_storage,session_storage",
  }).catch(() => {});
  await navigate(send, "/");
}

async function phaseIdentity(send) {
  await demoSignIn(send, "initiator");
  await navigate(send, "/dashboard/relationships");
  await record(
    send,
    "i01-relationships-list-initiator",
    "the list the detail is opened from, initiator seat",
  );
  await navigate(send, `/dashboard/relationships/${REL_ID}`);
  await identity(
    send,
    "i02-detail-initiator-1440",
    "the seeded relationship, initiator seat, 1440",
  );
  await setWidth(send, 390);
  await navigate(send, `/dashboard/relationships/${REL_ID}`);
  await identity(send, "i03-detail-initiator-390", "the same relationship, initiator seat, 390");
  await setWidth(send, 1440);

  await signOut(send);
  await demoSignIn(send, "counterparty");
  await navigate(send, "/dashboard/relationships");
  await record(send, "i04-relationships-list-counterparty", "the same list, Counterparty seat");
  await navigate(send, `/dashboard/relationships/${REL_ID}`);
  await identity(
    send,
    "i05-detail-counterparty-1440",
    "the same relationship, Counterparty seat, 1440",
  );
  await setWidth(send, 390);
  await navigate(send, `/dashboard/relationships/${REL_ID}`);
  await identity(
    send,
    "i06-detail-counterparty-390",
    "the same relationship, Counterparty seat, 390",
  );
  await setWidth(send, 1440);
}

await launchChrome();
const page = await attach();
await page.send("Page.enable");
await page.send("Runtime.enable");
await page.send("Network.enable");
await page.send("Emulation.setDeviceMetricsOverride", {
  width: WIDTH,
  height: VIEWPORT_HEIGHT,
  deviceScaleFactor: 1,
  mobile: false,
});
mkdirSync(OUT, { recursive: true });

try {
  await phaseIdentity(page.send);
  save();
} catch (error) {
  console.error(`! walk failed: ${error.message}`);
  try {
    await record(page.send, "zz-failure", error.message);
  } catch {}
  save();
  process.exitCode = 1;
} finally {
  stopChrome();
}
