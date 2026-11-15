#!/usr/bin/env node
/**
 * D12 capture — #975 row D12, card t_ca26527b.
 *
 * "The Edit this relationship dialog has no Aspects, while the page behind it edits them inline."
 * This walk builds the one state the seeded demo branch cannot offer (a relationship whose status
 * keeps the Edit control open), then photographs the dialog and the page's inline editor at 1440 and
 * 390 — plus the door the dialog now carries.
 *
 * Raw CDP, no Playwright (the shape `scripts/demo-flow.mjs` established and `ux-inventory/capture.mjs`
 * shipped). Nothing is written inside the repo.
 *
 *   node d12-capture.mjs --phase=after    create a draft, capture the after state, print its id
 *   node d12-capture.mjs --phase=before   REL_ID=<that id>: capture the same screens on a pinned tree
 *
 * Env: BASE_URL, SHOTS, DEMO_PIN, REPO (the tree `--serve` launches), CDP_PORT.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3427";
const CHROME = process.env.CHROME_BIN ?? "/usr/bin/google-chrome";
const DEBUG_PORT = Number(process.env.CDP_PORT ?? 9481);
const WIDTH = 1440;
const VIEWPORT_HEIGHT = 900;
const OUT = process.env.SHOTS ?? "/home/jadenblack/qa/t_ca26527b-975-d12";
const PHASE = (process.argv.find((a) => a.startsWith("--phase=")) ?? "--phase=after").split("=")[1];
const REL_ID = process.env.REL_ID ?? null;
const TEMPLATE = "/templates/relationship/assessment-relationship-basics";

let emulatedWidth = WIDTH;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let chrome = null;
async function launchChrome() {
  const profile = mkdtempSync(join(tmpdir(), "d12-profile-"));
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
    await sleep(300);
  }
  return await evaluate(send, "location.href");
}

async function setWidth(send, width) {
  emulatedWidth = width;
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height: width < 700 ? 844 : VIEWPORT_HEIGHT,
    deviceScaleFactor: 1,
    mobile: width < 700,
  });
  await sleep(350);
}

async function shoot(send, name, { viewportOnly = false } = {}) {
  await evaluate(
    send,
    `(() => { const el = document.activeElement; if (el && el.blur) el.blur(); return true; })()`,
  );
  if (viewportOnly) {
    // The frame a person actually sees, at the scroll position the page is on — the full-page
    // capture below resets the viewport and would photograph the top of the document instead.
    const png = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
    const bytes = Buffer.from(png.data, "base64");
    const path = join(OUT, `${name}.png`);
    writeFileSync(path, bytes);
    return {
      file: path,
      sha: createHash("sha256").update(bytes).digest("hex").slice(0, 12),
      height: VIEWPORT_HEIGHT,
    };
  }
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

const PROBE = `(() => {
  const px = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
  const main = document.querySelector("main") || document.body;
  const dialog = document.querySelector("[data-relationship-edit-dialog]") || document.querySelector("[data-relationship-edit-sheet]");
  const band = document.querySelector("[data-relationship-aspects-note]");
  const door = document.querySelector("[data-relationship-aspects-open]");
  const list = document.querySelector("[data-relationship-aspects]");
  const editor = document.querySelector("[data-aspect-row], [data-aspect-editor], [aria-label=\\"Reorder\\"]");
  return {
    url: location.pathname + location.search,
    doc: { scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth },
    overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    main: px(main),
    dialog: dialog ? { kind: dialog.hasAttribute("data-relationship-edit-dialog") ? "dialog" : "sheet", ...px(dialog) } : null,
    dialogWords: dialog ? (dialog.innerText || "").replace(/\\s+/g, " ").trim().slice(0, 1200) : null,
    dialogFields: dialog ? dialog.querySelectorAll("input, textarea, select").length : 0,
    band: band ? { ...px(band), words: (band.innerText || "").replace(/\\s+/g, " ").trim() } : null,
    bandPrompts: band ? [...band.querySelectorAll("[data-relationship-aspects-prompt]")].map((el) => el.innerText.trim()) : [],
    bandFields: band ? band.querySelectorAll("input, textarea, select").length : 0,
    bandControls: band ? band.querySelectorAll("button").length : 0,
    door: door ? { words: door.innerText.trim(), ...px(door) } : null,
    aspectsSection: list ? px(list) : null,
    inlineEditor: editor ? px(editor) : null,
    aspectRows: document.querySelectorAll("[data-relationship-aspect], [data-aspect-row]").length,
    readOnlyAspects: document.querySelectorAll("[data-relationship-aspect]").length,
    scrollY: Math.round(window.scrollY),
  };
})()`;

const log = [];
async function record(send, name, note, options = {}) {
  const probe = await evaluate(send, PROBE);
  const shot = await shoot(send, name, options);
  const row = {
    name,
    note: note ?? "",
    probe,
    shot: shot.file,
    sha: shot.sha,
    shotHeight: shot.height,
  };
  log.push(row);
  console.log(
    `· ${name} ${probe.url} dialog=${probe.dialog ? probe.dialog.kind : "-"} band=${probe.band ? probe.band.w + "x" + probe.band.h : "-"} prompts=${probe.bandPrompts.length} overflowX=${probe.overflowX}`,
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
  writeFileSync(join(OUT, `capture-report-${PHASE}.json`), JSON.stringify(log, null, 1));
  console.log(`\nwrote ${join(OUT, `capture-report-${PHASE}.json`)} (${log.length} screens)`);
}

/** Walk the five stages and keep the draft. Returns the draft's detail href. */
async function createDraft(send) {
  await navigate(send, TEMPLATE);
  await clickText(send, "Create Relationship", "a, button", { waitNav: true });
  await waitFor(send, `location.pathname.includes("/create")`, { label: "stage 1" });
  await fill(send, `input[name="title"]`, "Feedback cadence");
  await fill(send, `input[name="initiatorFirst"]`, "Dana");
  await fill(send, `input[name="initiatorLast"]`, "Okafor");
  await fill(send, `input[name="counterpartyFirst"]`, "Kit");
  await fill(send, `input[name="email"]`, "kit@demo.alignsynch.test");
  await clickText(send, "Continue to Stage 2", "button", { waitNav: true });
  await waitFor(send, `location.pathname.endsWith("/mode")`, { label: "stage 2" });
  // The two radios arrive unchecked (D7); pick them the way a person would.
  await evaluate(
    send,
    `(() => { const m = document.querySelector('input[name=mode][value=basic]'); if (m) m.click(); const s = document.querySelector('input[name=alignmentSetting][value=soft]'); if (s) s.click(); return true; })()`,
  );
  await sleep(400);
  await clickText(send, "Continue to Stage 3", "button", { waitNav: true });
  await waitFor(send, `location.pathname.endsWith("/aspects")`, { label: "stage 3" });
  await clickText(send, "Continue to Stage 4", "a, button", { waitNav: true });
  await waitFor(send, `location.pathname.endsWith("/commit")`, { label: "stage 4" });
  await clickText(send, "Continue to Stage 5", "a, button", { waitNav: true });
  await waitFor(send, `location.pathname.endsWith("/invite")`, {
    label: "stage 5",
    timeout: 30000,
  });
  await clickText(send, "Continue as Draft", "a, button", { waitNav: true });
  await sleep(1200);

  await navigate(send, "/dashboard/relationships");
  const hrefs = await evaluate(
    send,
    `[...document.querySelectorAll("a[href^='/dashboard/relationships/']")].map((a) => a.getAttribute("href"))`,
  );
  const href = hrefs[0];
  if (!href) throw new Error("no relationship row on the list after keeping the draft");
  console.log(`· draft kept at ${href}`);
  log.push({ name: "d12-00-draft", note: "the draft the walk created", href, allHrefs: hrefs });
  return href;
}

async function openDialog(send) {
  await click(send, "[data-relationship-edit-open]", { waitNav: false });
  await waitFor(
    send,
    `!!(document.querySelector("[data-relationship-edit-dialog]") || document.querySelector("[data-relationship-edit-sheet]"))`,
    { label: "the edit dialog" },
  );
  await sleep(600);
}

async function phaseAfter(send) {
  await demoSignIn(send, "initiator");
  const href = REL_ID === null ? await createDraft(send) : `/dashboard/relationships/${REL_ID}`;
  const id = href.split("/").filter(Boolean).pop();
  console.log(`D12_REL_ID=${id}`);

  // ── 1440 ───────────────────────────────────────────────────────────────
  await setWidth(send, 1440);
  await navigate(send, href);
  await record(
    send,
    "d12-01-inline-editor-1440",
    "the draft's detail: the Aspects editor that owns them (unchanged)",
  );

  await openDialog(send);
  await record(
    send,
    "d12-02-dialog-1440",
    "the Edit dialog on the draft: the Aspects band and the door",
  );

  const beforeReveal = await evaluate(send, "Math.round(window.scrollY)");
  await click(send, "[data-relationship-aspects-open]", { waitNav: false });
  await waitFor(send, `!document.querySelector("[data-relationship-edit-dialog]")`, {
    label: "the dialog closed by the door",
  });
  await sleep(1200);
  const revealed = await record(
    send,
    "d12-03-door-revealed-1440",
    "after the door: the dialog is gone and the page's Aspects section is in view",
    { viewportOnly: true },
  );
  revealed.note += ` (scrollY ${beforeReveal} -> ${revealed.probe.scrollY})`;

  // ── 390 ────────────────────────────────────────────────────────────────
  await setWidth(send, 390);
  await navigate(send, href);
  await record(
    send,
    "d12-04-inline-editor-390",
    "the same detail at 390: the Aspects editor (unchanged)",
  );
  await openDialog(send);
  await record(send, "d12-05-dialog-390", "the Edit sheet at 390: the same band, same door");
  await click(send, "[data-relationship-aspects-open]", { waitNav: false });
  await waitFor(
    send,
    `!document.querySelector("[data-relationship-edit-sheet]") && !document.querySelector("[data-relationship-edit-dialog]")`,
    { label: "the sheet closed by the door" },
  );
  await sleep(1200);
  await record(
    send,
    "d12-06-door-revealed-390",
    "after the door at 390: the sheet is gone and the Aspects section is in view",
    {
      viewportOnly: true,
    },
  );
}

/**
 * The door frames only, on a draft that already exists — the first pass photographed them with the
 * full-page camera, which resets the scroll and produced the same image as the untouched page.
 */
async function phaseDoor(send) {
  if (!REL_ID) throw new Error("REL_ID is required for --phase=door");
  const href = `/dashboard/relationships/${REL_ID}`;
  await demoSignIn(send, "initiator");

  await setWidth(send, 1440);
  await navigate(send, href);
  await openDialog(send);
  const before1440 = await evaluate(send, "Math.round(window.scrollY)");
  await click(send, "[data-relationship-aspects-open]", { waitNav: false });
  await waitFor(send, `!document.querySelector("[data-relationship-edit-dialog]")`, {
    label: "the dialog closed by the door",
  });
  await sleep(1400);
  const one = await record(
    send,
    "d12-03-door-revealed-1440",
    "after the door: the dialog is gone and the page's Aspects section is in view",
    {
      viewportOnly: true,
    },
  );
  one.note += ` (scrollY ${before1440} -> ${one.probe.scrollY})`;

  await setWidth(send, 390);
  await navigate(send, href);
  await openDialog(send);
  const before390 = await evaluate(send, "Math.round(window.scrollY)");
  await click(send, "[data-relationship-aspects-open]", { waitNav: false });
  await waitFor(
    send,
    `!document.querySelector("[data-relationship-edit-sheet]") && !document.querySelector("[data-relationship-edit-dialog]")`,
    { label: "the sheet closed by the door" },
  );
  await sleep(1400);
  const two = await record(
    send,
    "d12-06-door-revealed-390",
    "after the door at 390: the sheet is gone and the Aspects section is in view",
    {
      viewportOnly: true,
    },
  );
  two.note += ` (scrollY ${before390} -> ${two.probe.scrollY})`;
}

/** The same screens on a pinned tree: the dialog as it ships today, no band. */
async function phaseBefore(send) {
  if (!REL_ID) throw new Error("REL_ID is required for --phase=before");
  const href = `/dashboard/relationships/${REL_ID}`;
  await demoSignIn(send, "initiator");

  await setWidth(send, 1440);
  await navigate(send, href);
  await record(
    send,
    "d12-before-01-inline-editor-1440",
    "the draft's detail on the pinned tree: the inline Aspects editor",
  );
  await openDialog(send);
  await record(
    send,
    "d12-before-02-dialog-1440",
    "the same dialog on the pinned tree: no Aspects at all",
  );

  await setWidth(send, 390);
  await navigate(send, href);
  await openDialog(send);
  await record(
    send,
    "d12-before-03-dialog-390",
    "the same sheet at 390 on the pinned tree: no Aspects",
  );
}

let server = null;
async function serve() {
  server = spawn(
    process.env.NODE24 ?? "/home/jadenblack/.hermes/profiles/alignsynch/bin/node24.sh",
    ["pnpm", "dev", "--port", new URL(BASE).port, "--hostname", "127.0.0.1"],
    { cwd: process.env.REPO ?? process.cwd(), stdio: ["ignore", "pipe", "pipe"], env: process.env },
  );
  server.stdout.on("data", () => {});
  server.stderr.on("data", () => {});
  for (let i = 0; i < 240; i++) {
    try {
      const r = await fetch(`${BASE}/api/version`);
      if (r.ok) {
        const version = await r.json();
        console.log(`· dev server ready: ${JSON.stringify(version).slice(0, 160)}`);
        return;
      }
    } catch {}
    await sleep(400);
  }
  throw new Error(`dev server did not come up on ${BASE}`);
}

if (process.argv.includes("--serve")) await serve();

await launchChrome();
const page = await attach();
await page.send("Page.enable");
await page.send("Runtime.enable");
await page.send("Network.enable");
await setWidth(page.send, WIDTH);
mkdirSync(OUT, { recursive: true });

try {
  if (PHASE === "before") await phaseBefore(page.send);
  else if (PHASE === "door") await phaseDoor(page.send);
  else await phaseAfter(page.send);
  save();
} catch (error) {
  console.error(`! walk failed: ${error.message}`);
  try {
    await record(page.send, `zz-failure-${PHASE}`, error.message);
  } catch {}
  save();
  process.exitCode = 1;
} finally {
  stopChrome();
  if (server !== null && server.exitCode === null) server.kill("SIGTERM");
}
