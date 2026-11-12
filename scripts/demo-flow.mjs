#!/usr/bin/env node
/**
 * `pnpm demo:flow` — the demo driver. A **browser** walks the create flow the way a person does,
 * screenshots every screen it lands on, and writes the whole thing down as a committed transcript
 * (#898, card 1 of 2).
 *
 *   pnpm demo:flow          walk the three paths, write PNGs + docs/qa-demo-flow/transcript.json
 *   pnpm demo:flow:check    re-run on an unchanged tree and diff the transcript and the PNG hashes
 *
 * ## Not a second `flow:e2e`
 *
 * `scripts/flow-e2e.mjs` is an HTTP harness: it posts forms and reads the HTML back. It is right for
 * what it proves (the endpoint contract, the blind view, the Gap arithmetic) and this file does not
 * replace a line of it. What it cannot prove is that a person can **reach** a screen: a control that
 * renders `disabled`, a rail cell that opens nothing, a route that 404s after a redirect are all
 * invisible to a fetch and all obvious to a browser.
 *
 * So this walks with a browser: real Chrome, real typing, real clicks, and one PNG per screen.
 *
 * ## No browser dependency
 *
 * Raw Chrome DevTools Protocol over a `WebSocket`, the same shape `docs/qa-as2-home/capture.mjs` and
 * the rest of `docs/qa-*` use — Node 24 has a global `WebSocket`, so this is a hand-rolled session
 * with no Playwright and no Puppeteer in `package.json`, and there never will be one from this file.
 *
 * Two CDP details the stills convention already paid for:
 *
 *   * `Page.captureScreenshot` with a `clip` below the fold returns a **blank frame**, and
 *     `captureBeyondViewport` alone still frames only the viewport. The viewport is therefore
 *     resized to the measured document height before the shutter and restored afterwards.
 *   * `Emulation.setDeviceMetricsOverride` is what makes the width a fact rather than a hope; every
 *     shot in this file is taken at 1440 CSS pixels.
 *
 * ## The transcript is the deliverable, and card 2 renders it
 *
 * `docs/qa-demo-flow/transcript.json` — `demo-flow/v1`. The schema is documented in the file's own
 * `about` block, because a JSON file has no comments and the second reader is a script. Fields:
 *
 *   step   1..n, contiguous across the three paths (a reader can key on it)
 *   path   "create-published" | "create-draft" | "unpaid"
 *   route  where the step happened, with run-specific ids normalised to `<instance>` so two runs on
 *          an unchanged tree produce the same bytes
 *   action "fill" | "click" | "assert"
 *   values { field: value } — verbatim what was entered, empty for clicks and asserts
 *   shot   "docs/qa-demo-flow/<path>/<n>-<slug>-1440.png"
 *   expect the assertion this step proved, in words
 *   ok     whether it held; `actual` carries what was measured when it did not
 *
 * Nothing run-specific belongs in the transcript: no timestamps, no ids, no absolute paths. That is
 * what makes `--check` a byte diff instead of a fuzzy match.
 *
 * ## Findings are reported, not fixed
 *
 * A step whose assertion fails is recorded (`ok: false`), screenshotted anyway, and printed as a
 * numbered finding. The card's rule: report behaviour and copy questions, fix only outright breaks.
 * So a failed assertion is **not** a driver failure — the driver's job is to walk and to record
 * faithfully. Exit codes:
 *
 *   0  every path was walked and every screen in it was captured (findings are printed)
 *   1  the driver could not complete a path (server down, Chrome missing, a control that would not
 *      respond, cleanup failed) — `--strict` also makes a finding exit 1
 *   2  refused (production branch, wrong brand)
 *
 * ## It runs on the seeded demo branch, and leaves it as it found it
 *
 * The target is the demo instance with the demo dataset in it: example relationships, the demo
 * accounts and the templates. A driver against whatever happens to be in the branch is not
 * reproducible, so the seed runs first (unless `DEMO_FLOW_SKIP_SEED=1`) and takes the branch's own
 * advisory lock — never raced, never forced.
 *
 * The persona this run creates is **additive and invisible afterwards**: every relationship id is
 * registered the moment it is readable and deleted in a `finally` (and on SIGINT/SIGTERM), children
 * first, exactly as `flow-e2e.mjs` does since #865 — plus the auth user, if this run ever creates
 * one. `pnpm demo:verify` afterwards is the proof, not a count this file prints.
 *
 * ## Usage
 *
 *   BASE_URL=http://localhost:3411 pnpm demo:flow
 *   pnpm demo:flow:check
 *
 * The environment arrives through `withenv.sh` (see the repo skill): `.env.local` is the demo branch
 * and it wins over `.env`, so "which branch did this touch" is answered by the file set.
 */
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Client } from "pg";
import { repoRoot } from "./load-env.mjs";

/* ------------------------------------------------------------------ *
 * Configuration
 * ------------------------------------------------------------------ */

const ARGS = process.argv.slice(2);
const CHECK = ARGS.includes("--check");
const STRICT = ARGS.includes("--strict");
const SKIP_SEED = process.env.DEMO_FLOW_SKIP_SEED === "1";
/**
 * `DEMO_FLOW_ONLY=unpaid` walks one path. Iterating on one screen should not cost three paths, and a
 * path that stopped needs to be re-walked on its own without a second full run.
 */
const ONLY = (process.env.DEMO_FLOW_ONLY ?? "")
  .split(",")
  .map((entry) => entry.trim())
  .filter((entry) => entry !== "");

const ROOT = repoRoot;
const CANONICAL_OUT = join(ROOT, "docs", "qa-demo-flow");
/** Where the images are written. `--check` stages them elsewhere and diffs against the commit. */
const OUT = CHECK
  ? join(process.env.DEMO_FLOW_OUT ?? "/tmp", "demo-flow-check")
  : (process.env.DEMO_FLOW_OUT ?? (ONLY.length > 0 ? scratchOut() : CANONICAL_OUT));

/**
 * A single-path run writes beside the commit, never over it: `DEMO_FLOW_ONLY` is for iterating on one
 * screen, and a partial transcript is not the transcript.
 */
function scratchOut() {
  return join(tmpdir(), `demo-flow-${ONLY.join("-")}`);
}

const BASE = (process.env.BASE_URL ?? "http://localhost:3411").replace(/\/+$/, "");
const CHROME = process.env.CHROME_BIN ?? "/usr/bin/google-chrome";
const DEBUG_PORT = Number(process.env.DEMO_FLOW_DEBUG_PORT ?? 9455);
const WIDTH = 1440;
const VIEWPORT_HEIGHT = 900;

const TEMPLATE_SLUG = "relationship-basics";
const CREATE = `/templates/relationship/${TEMPLATE_SLUG}/create`;

/** The persona's own words. Fixed strings, so two runs produce the same transcript. */
const PERSONA = {
  published: {
    title: "Demo walk — published",
    initiatorFirst: "Jordan",
    initiatorLast: "Case",
    counterpartyFirst: "Sam",
    counterpartyLast: "Wren",
    email: "sam.wren@demo.alignsynch.test",
    description: "A demo walk of the create flow, published end to end.",
  },
  draft: {
    title: "Demo walk — draft",
    initiatorFirst: "Riley",
    initiatorLast: "Nolan",
    counterpartyFirst: "Alex",
    counterpartyLast: "Moreau",
    email: "alex.moreau@demo.alignsynch.test",
    description: "A demo walk of the create flow, kept as a draft.",
  },
  unpaid: {
    title: "Demo walk — unpaid",
    initiatorFirst: "Devon",
    initiatorLast: "Park",
    counterpartyFirst: "Casey",
    counterpartyLast: "Ives",
    email: "casey.ives@demo.alignsynch.test",
    description: "A demo walk of the create flow, published on Advanced and left unpaid.",
  },
};

/* ------------------------------------------------------------------ *
 * Small utilities
 * ------------------------------------------------------------------ */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Deterministic slug for a file name: lowercase, dashes, no punctuation. */
function slugOf(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true });
  return path;
}

/* ------------------------------------------------------------------ *
 * Chrome, and the CDP session (the shape `docs/qa-as2-home/capture.mjs` proved)
 * ------------------------------------------------------------------ */

let chrome = null;

async function launchChrome() {
  if (!existsSync(CHROME)) throw new Error(`no Chrome at ${CHROME} — set CHROME_BIN`);
  // **Never under the repo.** A Chrome profile is ~1 200 files, and one left in `docs/` makes
  // `biome check` die on its own gitignore walk (`path is expected to be under the root`) — a red
  // gate for a scratch directory nobody meant to commit.
  const profile = mkdtempSync(join(tmpdir(), "demo-flow-profile-"));
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

  // `/json/version` is the readiness signal: the port is bound before the page target exists.
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
      if (response.ok) return;
    } catch {
      // Not listening yet.
    }
    await sleep(100);
  }
  throw new Error(`Chrome did not answer on ${DEBUG_PORT} within 10 s`);
}

function stopChrome() {
  if (chrome !== null && chrome.exitCode === null) chrome.kill("SIGTERM");
  chrome = null;
}

async function json(path) {
  const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}${path}`);
  return await response.json();
}

/**
 * A session-scoped CDP connection to the page target.
 *
 * **Targets are auto-attached, because one screen in this flow is not in this document.** Stage 5's
 * card step mounts the provider's own checkout in a cross-origin iframe (#911). Same-origin policy
 * hides its DOM from `Runtime.evaluate` on the page target, and a driver that cannot type into the
 * card cannot prove the payment step ran — so every sub-target is attached flat and reachable by
 * `sessionId`. `waitForDebuggerOnStart: false` keeps a freshly attached target running; nothing here
 * pauses one.
 */
async function attach() {
  const listed = await json("/json/list");
  const targetInfos = Array.isArray(listed) ? listed : listed.targetInfos;
  const page = targetInfos.find((target) => target.type === "page");
  if (page === undefined) throw new Error("no page target — is Chrome headless running?");

  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  let nextId = 1;
  const pending = new Map();
  /** targetId → sessionId, and targetId → the target's own description. */
  const sessions = new Map();
  const targets = new Map();
  /**
   * Every JavaScript context the page has announced, keyed by id.
   *
   * A cross-origin frame is not always handed to `Target.setAutoAttach` as a sub-target; when it is
   * not, its world is still a context `Runtime` announced, and `Runtime.evaluate` can run in it by
   * `contextId`. This is the second door to the payment frame, and the one that works whether or not
   * Chrome decides the frame deserves its own process.
   */
  const contexts = new Map();

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.method === "Target.attachedToTarget") {
      sessions.set(message.params.targetInfo.targetId, message.params.sessionId);
      targets.set(message.params.targetInfo.targetId, message.params.targetInfo);
      // A sub-target's own contexts are announced on its session, not the page's.
      void send("Runtime.enable", {}, message.params.sessionId).catch(() => undefined);
      return;
    }
    if (message.method === "Target.detachedFromTarget") {
      sessions.delete(message.params.targetId);
      targets.delete(message.params.targetId);
      return;
    }
    if (message.method === "Runtime.executionContextCreated") {
      // The session is part of the context's identity: a context announced on a sub-target's session
      // has to be evaluated on **that** session, and sending it to the page answers
      // "Cannot find context with specified id".
      contexts.set(message.params.context.id, {
        ...message.params.context,
        sessionId: message.sessionId,
      });
      return;
    }
    if (
      message.method === "Runtime.executionContextDestroyed" ||
      message.method === "Runtime.executionContextsCleared"
    ) {
      if (message.method === "Runtime.executionContextsCleared") contexts.clear();
      else contexts.delete(message.params.executionContextId);
      return;
    }
    if (message.id === undefined) return;
    const entry = pending.get(message.id);
    if (entry === undefined) return;
    pending.delete(message.id);
    if (message.error)
      entry.reject(new Error(`${message.method ?? ""} ${JSON.stringify(message.error)}`));
    else entry.resolve(message.result);
  });

  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params, ...(sessionId === undefined ? {} : { sessionId }) }));
    });

  await send("Target.setAutoAttach", {
    autoAttach: true,
    waitForDebuggerOnStart: false,
    flatten: true,
  });

  cdp = { send, sessions, targets, contexts };
  return { send, close: () => socket.close() };
}

/** Runs an expression in the page and returns its JSON value. */
async function evaluate(send, expression) {
  const result = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
    userGesture: true,
  });
  if (result.exceptionDetails !== undefined) {
    throw new Error(
      `page threw: ${result.exceptionDetails.text} ${String(
        result.exceptionDetails.exception?.description ?? "",
      ).slice(0, 300)}`,
    );
  }
  return result.result.value;
}

/** Polls an expression until it is truthy. A destroyed context during navigation is a retry, not a failure. */
async function waitFor(send, expression, { timeout = 20000, label = expression } = {}) {
  const deadline = Date.now() + timeout;
  let lastError = null;
  while (Date.now() < deadline) {
    try {
      if (await evaluate(send, expression)) return true;
    } catch (error) {
      lastError = error;
    }
    await sleep(120);
  }
  throw new Error(
    `timed out after ${timeout} ms waiting for ${label}${lastError === null ? "" : ` (last: ${lastError.message.slice(0, 160)})`}`,
  );
}

/* ------------------------------------------------------------------ *
 * The page helpers — one verb per thing a person does
 * ------------------------------------------------------------------ */

/**
 * Fill a control the way a keyboard does, then prove the value landed.
 *
 * Focus and `Input.insertText` is a real typing path: the browser fires `input` before the value
 * exists, which is what a React controlled input listens for. The native setter is the fallback for
 * a control that `insertText` cannot reach (a `<select>`, a masked field that swallows keys); it
 * dispatches the same events React listens for. Either way the verdict is the same question —
 * `el.value === value` — so the transcript never claims a value the page did not take.
 */
async function fill(send, selector, value) {
  const focused = await evaluate(
    send,
    `(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (el === null) return false;
      el.focus();
      return document.activeElement === el;
    })()`,
  );
  if (focused !== true) throw new Error(`no focusable control at ${selector}`);
  await send("Input.insertText", { text: value });
  const landed = await evaluate(
    send,
    `document.querySelector(${JSON.stringify(selector)}).value === ${JSON.stringify(value)}`,
  );
  if (landed === true) return value;

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
  if (again !== true) throw new Error(`the control at ${selector} did not take the value`);
  return value;
}

/** Click an element and wait for the navigation it starts, when it starts one. */
async function click(send, selector, { navigate = true, timeout = 25000 } = {}) {
  const before = await url(send);
  const clicked = await evaluate(
    send,
    `(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (el === null) return false;
      el.click();
      return true;
    })()`,
  );
  if (clicked !== true) throw new Error(`no control at ${selector}`);
  if (!navigate) return before;
  try {
    await waitFor(
      send,
      `document.readyState === "complete" && location.href !== ${JSON.stringify(before)}`,
      { timeout, label: `navigation away from ${before}` },
    );
  } catch (error) {
    // A click that legitimately stays put (a dialog opening, a validation refusal) is not a
    // navigation failure; the caller's own assertion says what should have happened.
    if (!/timed out/.test(error.message)) throw error;
  }
  return await url(send);
}

async function url(send) {
  try {
    return await evaluate(send, "location.href");
  } catch {
    return "about:blank";
  }
}

async function navigate(send, path) {
  await send("Page.navigate", { url: `${BASE}${path}` });
  await waitFor(send, `document.readyState === "complete"`, { timeout: 30000, label: path });
  // Two frames, so hydration has run and a client panel has measured itself before any shutter.
  await evaluate(send, "new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))");
  await sleep(250);
}

/** The page's own words, normalised — the one probe most assertions read. */
async function text(send) {
  return await evaluate(send, `document.body.innerText.replace(/\\s+/g, " ").trim()`);
}

/**
 * The screen, at 1440 CSS pixels wide and as tall as the document.
 *
 * `captureScreenshot` frames the viewport, so the viewport is set to the measured height first and
 * restored afterwards — otherwise every later assertion runs at the height of the last shutter.
 */
async function shutter(send, file) {
  // A focused input draws a blinking caret, and a caret is the difference between two identical runs.
  // Nothing is typed between the blur and the frame, and the value stays in the control.
  await evaluate(
    send,
    `(() => { const el = document.activeElement; if (el && typeof el.blur === "function") el.blur(); return true; })()`,
  );
  // Motion is a rendering difference too: the same tree with a spinner at frame 3 and frame 9 hashes
  // differently. Reduced motion is the page's own switch for it.
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
  await sleep(250);
  const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
  writeFileSync(file, Buffer.from(shot.data, "base64"));
  await send("Emulation.setDeviceMetricsOverride", {
    width: WIDTH,
    height: VIEWPORT_HEIGHT,
    deviceScaleFactor: 1,
    mobile: false,
  });
  return createHash("sha256").update(Buffer.from(shot.data, "base64")).digest("hex");
}

/* ------------------------------------------------------------------ *
 * The transcript
 * ------------------------------------------------------------------ */

const transcript = {
  $doc: {
    schema: "demo-flow/v1",
    purpose:
      "A browser walked the create flow on the demo instance and wrote down every screen. Committed so a reviewer, and the /how-it-works replay (#898 card 2), can read what happened without re-running it.",
    topLevel: {
      $doc: "this block — the schema, in the file it describes",
      base: "the origin the walk ran against",
      paths:
        "one entry per path: { path, terminal (the screen the path must end on, in words), reached, steps }",
      findings:
        "behaviour the walk met that is not this driver's to fix: { n, path, title, shot, expected, actual, note }. A finding is a report, never a failure.",
      steps: "every screen, in order — see fields",
      seed: "what the run did about the demo dataset: { attempted, ok?, reason?, drift? }",
      summary: "what this run found: { paths, reached, steps, findings }",
      cleanup:
        "the branch before and after the walk: { created, before, after, leftover, unchanged }",
    },
    fields: {
      step: "1..n, contiguous across the three paths",
      path: "create-published | create-draft | unpaid — a state, not a happy path",
      route: "where the step happened; run-specific ids are normalised to <instance> and <token>",
      action: "fill | click | assert",
      values: "verbatim what was entered; {} for clicks and asserts",
      shot: "docs/qa-demo-flow/<path>/<n>-<slug>-1440.png",
      expect: "the assertion this step proved, in words",
      ok: "whether it held; `actual` carries what was measured when it did not",
      actual: "only present when ok is false",
      sha256: "the digest of the image this run wrote — evidence of the run, not an invariant",
      w: "the image's pixel width",
      h: "the image's pixel height",
    },
    determinism:
      "steps and paths carry no timestamp, id or absolute path, and two runs on an unchanged tree write them identically — that is what `pnpm demo:flow:check` diffs, byte for byte. `summary`, `seed`, `cleanup` and each step's `sha256` are measurements of one run or of a shared branch, so the diff excludes them: screenshots are compared by the geometry in `w`/`h`, because a page prints a minted invitation token, mounts the provider's live frame and seeds placeholder art from a row's id — none of which is byte-stable.",
  },
  base: BASE,
  paths: [],
  findings: [],
  steps: [],
};

let currentPath = null;
let stepNumber = 0;

function begin(path, terminal) {
  currentPath = path;
  transcript.paths.push({ path, terminal, reached: false, steps: 0 });
  return transcript.paths[transcript.paths.length - 1];
}

function normaliseRoute(href) {
  return (
    href
      .replace(BASE, "")
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<instance>")
      // An invitation token is minted per publish; the address is the same screen every run.
      .replace(/\/invite\/[A-Za-z0-9_-]{16,}/g, "/invite/<token>")
  );
}

async function record(send, { action, expect, values = {}, ok, actual, name, route }) {
  stepNumber += 1;
  const shotName = `${String(stepNumber).padStart(2, "0")}-${slugOf(name ?? route)}-${WIDTH}.png`;
  const relative = `docs/qa-demo-flow/${currentPath}/${shotName}`;
  const file = join(OUT, currentPath, shotName);
  ensureDir(dirname(file));
  const sha256 = await shutter(send, file);
  const bytes = readFileSync(file);
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);

  // `DEMO_FLOW_DUMP=<dir>` writes the judged page beside the failure. A shell in the transcript only
  // names `route` and `actual`; the rendered HTML is what a correction is made against, never a
  // remembered marker (the rule `flow-e2e.mjs` carries).
  if (typeof process.env.DEMO_FLOW_DUMP === "string" && process.env.DEMO_FLOW_DUMP !== "") {
    try {
      const dumpDir = join(process.env.DEMO_FLOW_DUMP, currentPath);
      ensureDir(dumpDir);
      writeFileSync(
        join(dumpDir, shotName.replace(/\.png$/, ".html")),
        await evaluate(send, "document.documentElement.outerHTML"),
      );
    } catch {
      // A dump is a diagnostic; never fail a run because the directory was not there.
    }
  }

  const step = {
    step: stepNumber,
    path: currentPath,
    route: route ?? normaliseRoute(await url(send)),
    action,
    values,
    shot: relative,
    expect,
    ok: ok !== false,
    sha256,
    w: width,
    h: height,
  };
  if (ok === false) step.actual = actual ?? null;
  transcript.steps.push(step);

  const entry = transcript.paths[transcript.paths.length - 1];
  entry.steps += 1;

  const mark = step.ok ? "✔" : "✘";
  console.log(
    `${mark} ${String(stepNumber).padStart(2, "0")} ${currentPath} · ${step.route} — ${expect}`,
  );
  if (!step.ok) console.log(`   actual: ${String(step.actual).slice(0, 300)}`);
  return step;
}

/**
 * Record a finding. A finding is a step that did not prove what the card says it should, plus the
 * sentence a lead needs to card it — never a fix, which is the card's rule.
 */
function finding(title, { path = currentPath, shot, expected, actual, note }) {
  transcript.findings.push({
    n: transcript.findings.length + 1,
    path,
    title,
    shot: shot ?? null,
    expected: expected ?? null,
    actual: actual === undefined ? null : actual,
    note: note ?? null,
  });
  console.log(`✘ FINDING ${transcript.findings.length} [${path}] ${title}`);
}

/* ------------------------------------------------------------------ *
 * Cleanup — what this run created, deleted in a finally (#865)
 * ------------------------------------------------------------------ */

const created = [];
const relationships = [];
const createdAccounts = [];

let db = null;
let cleaned = false;
/** The live CDP connection, so a helper can reach a sub-target (stage 5's card frame). */
let cdp = null;

async function authUserTable() {
  const { rows } = await db.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'neon_auth' ORDER BY table_name`,
  );
  const names = rows.map((row) => row.table_name);
  return names.find((name) => name === "user" || name === "users") ?? null;
}

async function cleanup() {
  if (cleaned || db === null) return;
  cleaned = true;
  try {
    const strays = new Set(relationships);
    if (created.length > 0) {
      const { rows } = await db.query(
        `SELECT DISTINCT relationship_id AS id FROM session
          WHERE record_id = ANY($1::text[]) AND relationship_id IS NOT NULL`,
        [created],
      );
      for (const row of rows) strays.add(row.id);
    }

    if (strays.size > 0) {
      const ids = [...strays];
      await db.query("DELETE FROM relationship_payment WHERE relationship_id = ANY($1::text[])", [
        ids,
      ]);
      await db.query("DELETE FROM relationship_member WHERE relationship_id = ANY($1::text[])", [
        ids,
      ]);
      await db.query("DELETE FROM coach_invite WHERE relationship_id = ANY($1::text[])", [ids]);
    }

    for (const instanceId of created) {
      await db.query("DELETE FROM record WHERE id = $1", [instanceId]);
    }

    if (strays.size > 0) {
      await db.query("DELETE FROM relationship WHERE id = ANY($1::text[])", [[...strays]]);
    }

    if (createdAccounts.length > 0) {
      // A user id is resolved by its address when the sign-up did not hand one back: the address is
      // how the row is found again, and it is the only handle a browser sign-up leaves behind.
      const accounts = [];
      for (const account of createdAccounts) {
        if (typeof account.userId === "string") {
          accounts.push(account.userId);
          continue;
        }
        const users = await authUserTable();
        if (users === null) continue;
        const { rows } = await db.query(
          `SELECT id::text AS id FROM neon_auth."${users}" WHERE email = $1`,
          [account.email],
        );
        for (const row of rows) accounts.push(row.id);
      }
      if (accounts.length > 0) {
        await db.query("UPDATE party SET user_id = NULL WHERE user_id = ANY($1::text[])", [
          accounts,
        ]);
        await db.query("DELETE FROM relationship_member WHERE user_id = ANY($1::text[])", [
          accounts,
        ]);
        await db.query("DELETE FROM coach_invite WHERE invited_by_user_id = ANY($1::text[])", [
          accounts,
        ]);
        await db.query("DELETE FROM user_profile WHERE user_id = ANY($1::text[])", [accounts]);
        const users = await authUserTable();
        if (users !== null) {
          await db.query(`DELETE FROM neon_auth."${users}" WHERE id::text = ANY($1::text[])`, [
            accounts,
          ]);
        }
      }
    }

    if (created.length > 0 || strays.size > 0 || createdAccounts.length > 0) {
      console.log(
        `· cleaned up ${created.length} record(s), ${strays.size} relationship(s), ${createdAccounts.length} account(s)`,
      );
    }
  } catch (error) {
    console.error(`! cleanup failed: ${error.message} — see the ids below`);
    console.error(
      `  records ${JSON.stringify(created)} relationships ${JSON.stringify(relationships)} accounts ${JSON.stringify(createdAccounts.map((a) => a.email))}`,
    );
    throw error;
  }
}

/** The branch's own counts — the evidence that the persona is gone rather than hidden. */
async function branchCounts() {
  const { rows } = await db.query(
    `SELECT
       (SELECT count(*)::int FROM record) AS record,
       (SELECT count(*)::int FROM relationship) AS relationship,
       (SELECT count(*)::int FROM session) AS session,
       (SELECT count(*)::int FROM party) AS party,
       (SELECT count(*)::int FROM demo_account) AS demo_account`,
  );
  return rows[0];
}

/* ------------------------------------------------------------------ *
 * The paths
 * ------------------------------------------------------------------ */

/** Fill stage 1's seven fields, one call, one recorded step. */
async function fillStageOne(send, persona) {
  const fields = [
    ["#create-title", "title"],
    ["#create-initiator-first", "initiatorFirst"],
    ["#create-initiator-last", "initiatorLast"],
    ["#create-counterparty-first", "counterpartyFirst"],
    ["#create-counterparty-last", "counterpartyLast"],
    ["#create-email", "email"],
    ["#create-description", "description"],
  ];
  for (const [selector, key] of fields) await fill(send, selector, persona[key]);

  const values = await evaluate(
    send,
    `(() => {
      const out = {};
      const pairs = ${JSON.stringify(fields)};
      for (const [selector, key] of pairs) out[key] = document.querySelector(selector)?.value ?? null;
      return out;
    })()`,
  );
  const wanted = Object.fromEntries(fields.map(([, key]) => [key, persona[key]]));
  const ok = JSON.stringify(values) === JSON.stringify(wanted);
  return { values: wanted, ok, actual: ok ? null : values };
}

/** Choose the Mode and the Setting on stage 2. */
async function chooseMode(send, { mode, setting }) {
  for (const [name, value] of [
    ["mode", mode],
    ["alignmentSetting", setting],
  ]) {
    const clicked = await evaluate(
      send,
      `(() => {
        const el = document.querySelector('input[name="${name}"][value="${value}"]');
        if (el === null) return false;
        el.click();
        return el.checked;
      })()`,
    );
    if (clicked !== true) throw new Error(`no ${name} radio for ${value}`);
  }
  return {
    mode: await evaluate(
      send,
      `document.querySelector('input[name="mode"]:checked')?.value ?? null`,
    ),
    setting: await evaluate(
      send,
      `document.querySelector('input[name="alignmentSetting"]:checked')?.value ?? null`,
    ),
  };
}

/**
 * The stage rail's own sentence, so "which stage is this" is read off the render.
 *
 * `innerText` is the wrong read here: the rail sits in a shell whose panel is `data-state="closed"`
 * on a page screen, and a closed dialog has no innerText — the same trap as asserting a marker from
 * memory, one level down. `textContent` is what the rail *renders*; the sentence is the spec's
 * (`docs/specs/flow-stages.md`), and the cell number is read off `data-step-state`.
 */
async function stageLine(send) {
  return await evaluate(
    send,
    `(() => {
      const rail = document.querySelector("[data-wizard-rail]");
      if (rail === null) return null;
      const flat = (rail.textContent || "").replace(/\\s+/g, " ").trim();
      const printed = flat.match(/Stage \\d of \\d/);
      if (printed !== null) return printed[0];
      const cells = rail.querySelectorAll("[data-step-cell]").length;
      const current = rail.querySelector('[data-step-state="current"]')?.getAttribute("data-step-cell");
      return current == null || cells === 0 ? null : "Stage " + current + " of " + cells;
    })()`,
  );
}

/** The advance control on a stage: a submit button inside the stage's own form. */
async function advanceStage(send, formSelector, navigateTo) {
  await click(send, formSelector);
  await waitFor(send, `location.pathname.endsWith("${navigateTo}")`, {
    timeout: 25000,
    label: navigateTo,
  });
}

/** Sign in through the demo gate — the app's own door, PIN then role (#183/#218). */
async function demoSignIn(send, role) {
  const pin = process.env.DEMO_PIN;
  if (pin === undefined || pin.trim() === "") {
    throw new Error("DEMO_PIN is not set — the demo sign-in is the one door this driver may use");
  }
  await navigate(send, "/demo");
  const onGate =
    (await text(send)).includes("demo PIN") ||
    (await evaluate(send, `!!document.querySelector("#demo-pin")`));
  if (onGate !== true)
    throw new Error("/demo did not render the PIN gate — is DEMO_AUTH=1 and DEMO_PIN set?");

  const pinStep = await record(send, {
    action: "assert",
    expect: "the demo gate answers /demo with a PIN field",
    name: "demo-gate",
  });

  await fill(send, "#demo-pin", pin);
  await click(send, `form button[type=submit]`);
  await waitFor(send, `location.pathname === "/login"`, {
    timeout: 25000,
    label: "the PIN to unlock /login",
  });

  const unlocked = await record(send, {
    action: "click",
    values: { pin: "<DEMO_PIN>" },
    expect: "the PIN unlocks /login's three demo role buttons",
    name: "demo-unlocked",
  });
  void pinStep;
  void unlocked;

  const selector = `form:has(input[name="as"][value="${role}"]) button[type=submit]`;
  const present = await evaluate(send, `!!document.querySelector(${JSON.stringify(selector)})`);
  if (present !== true) {
    throw new Error(
      `no demo role button for "${role}" — is demo_account seeded (DEMO_AUTH=1 db:seed)?`,
    );
  }
  await click(send, selector, { timeout: 30000 });
  await waitFor(send, `location.pathname !== "/login"`, {
    timeout: 25000,
    label: "the demo role button to sign in",
  });
  await record(send, {
    action: "click",
    values: { role },
    expect: `the "${role}" role button signs this browser in`,
    name: `signed-in-${role}`,
  });
}

async function walkCreateStages(send, persona, { mode, setting }) {
  await navigate(send, CREATE);
  const opening = await stageLine(send);
  await record(send, {
    action: "assert",
    expect: "stage 1 renders its seven fields and the five-cell rail reads Stage 1 of 5",
    ok:
      opening === "Stage 1 of 5" &&
      (await evaluate(send, `!!document.querySelector("#create-title")`)),
    actual: opening,
    name: "stage-1-details",
  });

  const filled = await fillStageOne(send, persona);
  await record(send, {
    action: "fill",
    values: filled.values,
    expect: "every field holds what was typed",
    ok: filled.ok,
    actual: filled.actual,
    name: "typed-the-details",
  });

  await advanceStage(
    send,
    `form[aria-labelledby="create-stage-heading"] button[type=submit]`,
    "/mode",
  );
  await record(send, {
    action: "click",
    expect: "Continue goes to stage 2 with both choice groups drawn",
    ok:
      (await stageLine(send)) === "Stage 2 of 5" &&
      (await evaluate(send, `!!document.querySelector('[data-choice-group="mode"]')`)) === true &&
      (await evaluate(
        send,
        `!!document.querySelector('[data-choice-group="alignmentSetting"]')`,
      )) === true,
    actual: await stageLine(send),
    name: "stage-2-mode",
  });

  const chosen = await chooseMode(send, { mode, setting });
  await record(send, {
    action: "click",
    values: { mode, alignmentSetting: setting },
    expect: "the Mode and the Setting are both selected",
    ok: chosen.mode === mode && chosen.setting === setting,
    actual: chosen,
    name: "chose-mode-and-setting",
  });

  await advanceStage(
    send,
    `form[aria-labelledby="create-mode-heading"] button[type=submit]`,
    "/aspects",
  );
  await record(send, {
    action: "click",
    expect: "stage 3 lists the template's Aspects",
    ok:
      (await stageLine(send)) === "Stage 3 of 5" &&
      (await evaluate(
        send,
        `document.querySelectorAll("[data-aspect-list] [data-aspect-row]").length`,
      )) > 0,
    actual: await evaluate(
      send,
      `document.querySelectorAll("[data-aspect-list] [data-aspect-row]").length`,
    ),
    name: "stage-3-aspects",
  });

  await advanceStage(send, `[data-create-next="account"]`, "/commit");
  await record(send, {
    action: "click",
    expect: "stage 4 is the Account stage",
    ok: (await stageLine(send)) === "Stage 4 of 5",
    actual: await stageLine(send),
    name: "stage-4-account",
  });
  return instanceIdOf(await url(send));
}

/**
 * Is stage 4 asking for an account, or confirming the one it has?
 *
 * The stage **heading** is "Create your account" either way — the stage header draws it, and the
 * panel below deliberately does not repeat it (#777). So the heading is not the signal: the account
 * form's own first field is, because the embedded register view is the only thing that renders it.
 */
async function accountFormDrawn(send) {
  return (
    (await evaluate(
      send,
      `!!document.querySelector('[data-create-account] input#email, [data-create-account] input[type=email]')`,
    )) === true
  );
}

/** The send control: the stage foot submits the send form from outside it (#825). */
const SEND_SELECTOR = 'button[form="create-invite-form"]';

/** The commit control: the same shape on stage 4. */
const COMMIT_SELECTOR = 'button[form="create-commit-form"]';

/**
 * The invitation URL the Sent screen draws.
 *
 * #220's rule is that the link is **on the screen** whether or not a mailer exists, and the screen
 * draws it as a `<code>` beside a copy control rather than as an anchor — so it is read as text, not
 * as `href`. The token is run-specific, so it is never written to the transcript verbatim: the step
 * records the shape and the origin, and the claim follows the path it printed.
 */
async function inviteUrlOnScreen(send) {
  return await evaluate(
    send,
    `(() => {
      const code = Array.from(document.querySelectorAll("code"))
        .map((el) => (el.textContent || "").trim())
        .find((text) => /\\/invite\\//.test(text));
      if (code !== undefined) return code;
      const match = (document.body.textContent || "").match(/https?:\\/\\/[^\\s"<]*\\/invite\\/[A-Za-z0-9_-]+/);
      return match === null ? null : match[0];
    })()`,
  );
}

/** The same path the screen printed, on the tree this run is actually driving. */
function onBase(printed) {
  try {
    const parsed = new URL(printed);
    return `${BASE}${parsed.pathname}${parsed.search}`;
  } catch {
    return printed;
  }
}

/** The relationship id stage 5 carries: `?instance=<id>`. */
function instanceIdOf(href) {
  try {
    return new URL(href).searchParams.get("instance");
  } catch {
    return null;
  }
}

/** Register the instance the moment its id is readable (#865). */
function registerInstance(instanceId) {
  if (typeof instanceId === "string" && instanceId !== "" && !created.includes(instanceId)) {
    created.push(instanceId);
  }
}

async function relationshipIdOf(instanceId) {
  const { rows } = await db.query(
    `SELECT DISTINCT relationship_id AS id FROM session
      WHERE record_id = $1 AND relationship_id IS NOT NULL`,
    [instanceId],
  );
  for (const row of rows) {
    if (!relationships.includes(row.id)) relationships.push(row.id);
  }
  return rows[0]?.id ?? null;
}

/** Write the draft at stage 4 and land on stage 5. Shared by all three paths. */
async function commitDraft(send, pathLabel) {
  const formDrawn = await accountFormDrawn(send);
  await record(send, {
    action: "assert",
    expect: "stage 4 draws the confirmation for the signed-in creator, not the account form",
    ok: formDrawn === false,
    actual: formDrawn ? "the embedded account form is still drawn" : null,
    name: `${pathLabel}-account-confirmed`,
  });

  await click(send, COMMIT_SELECTOR, { timeout: 30000 });
  await waitFor(send, `location.pathname.endsWith("/invite")`, {
    timeout: 30000,
    label: "stage 5 after the commit",
  });
  const instanceId = instanceIdOf(await url(send));
  registerInstance(instanceId);
  const relationshipId = instanceId === null ? null : await relationshipIdOf(instanceId);
  return { instanceId, relationshipId };
}

/* ------------------------------------------------------------------ *
 * Stage 5's left column: the pay walk, and the card it takes (#911)
 * ------------------------------------------------------------------ */

/** The pay panel, as the panel declares its own step. */
const payStep = (step) =>
  `!!document.querySelector('[data-create-plans="true"][data-pay-step="${step}"]')`;

/** The send column's state, as the column declares it. */
const SEND_GATE = `document.querySelector("[data-send-gate]")?.getAttribute("data-send-gate") ?? null`;

/** Run an expression inside a sub-target (by session) or a frame's context (by contextId). */
async function evaluateIn(door, expression) {
  const params = { expression, returnByValue: true, awaitPromise: true, userGesture: true };
  if (door.contextId !== undefined) params.contextId = door.contextId;
  const result = await cdp.send("Runtime.evaluate", params, door.sessionId);
  if (result.exceptionDetails !== undefined) {
    throw new Error(
      `frame threw: ${result.exceptionDetails.text} ${String(
        result.exceptionDetails.exception?.description ?? "",
      ).slice(0, 240)}`,
    );
  }
  return result.result.value;
}

/**
 * The provider's checkout frame — the one document in this flow that is not ours.
 *
 * Two doors, tried in order, because which one exists is Chrome's decision and not something to
 * assume: a cross-origin frame that got its own process is a **sub-target** with a `sessionId`; one
 * that did not is still a **context** `Runtime` announced, reachable by `contextId`. Same-origin
 * policy hides either one from `Runtime.evaluate` on the page, so a driver that only knows about the
 * first door reports "no frame" on a frame that is plainly on screen.
 */
async function cardFrameDoor({ timeout = 25000 } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    for (const [targetId, info] of cdp.targets) {
      if (!/stripe\.com/.test(info.url ?? "")) continue;
      const sessionId = cdp.sessions.get(targetId);
      if (sessionId !== undefined) return { sessionId, url: info.url, via: "target" };
    }
    for (const [id, context] of cdp.contexts) {
      const origin = context.origin ?? "";
      if (!/stripe\.com/.test(origin)) continue;
      if (context.auxData?.isDefault === false) continue;
      // A context is only reachable on the session that announced it — `undefined` is the page's own.
      return { contextId: id, sessionId: context.sessionId, url: origin, via: "context" };
    }
    await sleep(200);
  }

  // Named, not guessed: what the page actually has, so the next reader does not repeat this hunt.
  console.error(
    `! demo-flow: no provider frame — ${cdp.targets.size} sub-target(s), ${cdp.contexts.size} context(s):`,
  );
  for (const [, info] of cdp.targets) console.error(`    target ${info.type} ${info.url}`);
  for (const [, context] of cdp.contexts) {
    console.error(`    context ${context.id} ${context.origin} ${context.name}`);
  }
  return null;
}

/**
 * Print the page's frame tree and every announced JS context.
 *
 * A checkout is a document inside a document inside a document, and a driver that fills the wrong
 * one reports "no fields" on a screen full of them. Naming the topology when a fill finds nothing is
 * what turned this from a guess into a fact once already.
 */
async function dumpFrameTopology() {
  console.error("! demo-flow: the frame drew no visible field — topology follows");
  try {
    const tree = await cdp.send("Page.getFrameTree", {});
    const walk = (node, depth) => {
      console.error(`    ${"  ".repeat(depth)}frame ${node.frame.id} ${node.frame.url}`);
      for (const child of node.childFrames ?? []) walk(child, depth + 1);
    };
    walk(tree.frameTree, 0);
  } catch (error) {
    console.error(`    frame tree unavailable: ${error.message}`);
  }
  for (const [id, context] of cdp.contexts) {
    console.error(
      `    context ${context.id} session=${context.sessionId ?? "<page>"} ${context.origin} "${context.name}"`,
    );
    if (!/stripe\.com/.test(context.origin ?? "")) continue;
    try {
      const said = await evaluateIn(
        { contextId: id, sessionId: context.sessionId },
        `(() => ({
          href: location.href,
          title: document.title,
          html: document.documentElement ? document.documentElement.outerHTML.length : 0,
          text: (document.body && document.body.innerText ? document.body.innerText : "").slice(0, 300),
          frames: Array.from(document.querySelectorAll("iframe")).map((el) => el.src).slice(0, 5),
        }))()`,
      );
      console.error(`      ${JSON.stringify(said)}`);
    } catch (error) {
      console.error(`      unreadable: ${error.message.slice(0, 120)}`);
    }
  }
  for (const [, info] of cdp.targets) {
    console.error(`    target ${info.type} ${info.url}`);
  }
  // The page's own view of its iframes: a mounted checkout is an element here whether or not Chrome
  // gave it its own process, and an element with no size is a frame that never got a document.
  try {
    const mounted = await cdp.send("Runtime.evaluate", {
      expression: `(() => ({
        mount: (() => {
          const host = document.querySelector("[data-stripe-mount]");
          return host === null ? null : { html: host.innerHTML.length, boxes: host.querySelectorAll("iframe").length };
        })(),
        iframes: Array.from(document.querySelectorAll("iframe")).map((el) => ({
          src: (el.src || "").split("?")[0],
          w: el.clientWidth,
          h: el.clientHeight,
        })),
        caption: (document.querySelector("[data-capture-frame-placeholder]")?.textContent ?? "").slice(0, 120),
        refusal: (document.querySelector("[data-pay-refusal]")?.textContent ?? "").slice(0, 300),
        panel: (document.querySelector("[data-create-plans]")?.textContent ?? "").slice(0, 400),
      }))()`,
      returnByValue: true,
    });
    console.error(`    page: ${JSON.stringify(mounted.result.value)}`);
  } catch (error) {
    console.error(`    page unreadable: ${error.message.slice(0, 120)}`);
  }
}

/**
 * Poll the provider's frame until its form is actually drawn, and return what it drew.
 *
 * A checkout is a document inside a document: Stripe injects `stripe.js`, that script fetches the
 * session and mounts `/endive`'s own frame, and only then are there fields to type into. So the
 * question is not "is there a frame" (there is one almost immediately, and it is empty) but "does a
 * frame have a card field in it". Nothing here waits on a fixed sleep — it waits on the condition it
 * needs, and it names the last thing it saw when the condition never comes.
 */
async function waitForCardFields({ timeout = 60000 } = {}) {
  const deadline = Date.now() + timeout;
  let lastSeen = null;
  while (Date.now() < deadline) {
    for (const [id, context] of cdp.contexts) {
      if (!/stripe\.com/.test(context.origin ?? "")) continue;
      if (context.auxData?.isDefault === false) continue;
      const door = { contextId: id, sessionId: context.sessionId };
      try {
        const survey = await evaluateIn(
          door,
          `(() => {
            const inputs = Array.from(document.querySelectorAll("input, select, textarea"));
            const visible = inputs.filter((el) => el.type !== "hidden");
            return {
              ready: document.readyState,
              fields: visible.map((el) => ({
                tag: el.tagName.toLowerCase(),
                type: el.type ?? "",
                name: el.name ?? "",
                id: el.id ?? "",
                autocomplete: el.autocomplete ?? "",
                placeholder: el.placeholder ?? "",
                label: (el.labels && el.labels[0] && (el.labels[0].textContent || "").trim()) || "",
              })),
            };
          })()`,
        );
        if (survey.fields.length > 0) return { fields: survey.fields, origin: context.origin };
        lastSeen = `${context.origin} readyState=${survey.ready} 0 visible field(s)`;
      } catch {
        // A context that is being replaced mid-survey is a retry, not a failure.
      }
    }
    await sleep(500);
  }
  if (lastSeen !== null) console.error(`! demo-flow: ${lastSeen}`);
  return null;
}

/**
 * Put a test card on file, in the provider's own frame, in **test mode**.
 *
 * The card is the card Stripe documents for test mode (`4242 4242 4242 4242`, any future expiry, any
 * CVC). Nothing here decides a payment: the frame's own submit is what the provider answers, and the
 * app resolves the method server-side from the session it minted (`onComplete` → `onResolve`), never
 * from anything this file types.
 *
 * Returns what it did, so a step can record it — the transcript carries the field names and the
 * values as they were entered, and never the client secret.
 */
async function fillCardFrame(send, { email }) {
  // **Wait for the checkout document, not for the panel.** The panel's marker appears the moment the
  // server mints a client secret; the provider then injects its script, fetches the session and mounts
  // its form, which is a second or two later. Surveying at marker time finds the loader, not the card.
  const ready = await waitForCardFields();
  if (ready === null) {
    await dumpFrameTopology();
    return { filled: false, reason: "the provider's checkout never drew a card field" };
  }

  /** Run an expression in the provider's frame, surviving its context churn. */
  async function inFrame(expression) {
    let lastError = new Error("no provider frame attached");
    for (let attempt = 0; attempt < 15; attempt += 1) {
      const door = await cardFrameDoor({ timeout: 6000 });
      if (door === null) {
        await sleep(500);
        continue;
      }
      try {
        return await evaluateIn(door, expression);
      } catch (error) {
        lastError = error;
        if (!/Cannot find context|context.*destroyed|Execution context/i.test(error.message)) {
          throw error;
        }
        await sleep(400);
      }
    }
    throw lastError;
  }

  const fields = ready.fields;

  const wanted = {
    email: /email/i,
    card: /card.?number|number|cc-number/i,
    expiry: /exp|cc-exp/i,
    cvc: /cvc|cvv|security/i,
    name: /name/i,
    postal: /postal|zip|postcode/i,
  };
  const cardValues = {
    email,
    card: "4242424242424242",
    expiry: "12/34",
    cvc: "123",
  };

  const typed = {};
  for (const [key, pattern] of Object.entries(wanted)) {
    if (cardValues[key] === undefined) continue;
    const field = fields.find(
      (f) =>
        f.tag === "input" &&
        f.type !== "hidden" &&
        (pattern.test(f.name) || pattern.test(f.autocomplete) || pattern.test(f.label)),
    );
    if (field === undefined) continue;
    const selector = field.id !== "" ? `#${field.id}` : `input[name="${field.name}"]`;
    // Type the way a person does — focus, then `Input.insertText` — and accept the value the field
    // keeps. **A card field reformats as it fills** (`4242 4242 4242 4242`, `12 / 34`), so the
    // verdict is the digits and slashes that landed, never a byte comparison against what was typed.
    const focused = await inFrame(
      `(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (el === null) return false;
        el.focus();
        return document.activeElement === el;
      })()`,
    );
    if (focused !== true) continue;
    await cdp.send("Input.insertText", { text: cardValues[key] });
    let landed = await inFrame(
      `document.querySelector(${JSON.stringify(selector)})?.value ?? null`,
    );
    // A headless window is not a focused one, so a synthetic keystroke can land nowhere. The native
    // setter is the second door: same value, same `input` event, and the field is the judge either way.
    if (typeof landed !== "string" || landed === "") {
      await inFrame(
        `(() => {
          const el = document.querySelector(${JSON.stringify(selector)});
          if (el === null) return false;
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
          setter.call(el, ${JSON.stringify(cardValues[key])});
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
          return true;
        })()`,
      );
      landed = await inFrame(
        `document.querySelector(${JSON.stringify(selector)})?.value ?? null`,
      );
    }
    const bare = (text) => String(text).replace(/[\s-]/g, "");
    if (typeof landed === "string" && bare(landed) === bare(cardValues[key])) {
      typed[key] = cardValues[key];
    }
  }

  const submit = await inFrame(
    `(() => {
      const button = Array.from(document.querySelectorAll("button")).find(
        (el) => el.type === "submit" || /pay|subscribe|start|continue|save/i.test(el.textContent || ""),
      );
      if (button === undefined) return null;
      const text = (button.textContent || "").trim();
      button.click();
      return text;
    })()`,
  );

  return {
    filled: Object.keys(typed).length > 0,
    typed,
    submit,
    fields: fields.length,
    // What the frame drew, so a fill that matched nothing names what it saw instead of "no".
    seen: fields
      .filter((field) => field.type !== "hidden")
      .slice(0, 8)
      .map((field) => `${field.tag}[${field.type}]${field.name === "" ? "" : ` name=${field.name}`}`)
      .join(", "),
    frameUrl: normaliseRoute(ready.origin),
  };
}

/**
 * Walk stage 5's left column.
 *
 * The panel is three steps in one column and the send beside it is gated by the stage (#911): before
 * a card is on file the column is `data-send-gate="locked"` and the confirm control is disabled. So
 * a path that means to **send** has to complete the walk first, and a path that means to show the
 * unpaid state stops at the card step on purpose.
 */
async function payWalk(send, { pathLabel, complete, plan }) {
  await waitFor(send, payStep("plan"), { timeout: 25000, label: "the walk's plan panel" });

  // A measured, already-paying account is drawn a summary instead of a radio group (#870).
  const included = await evaluate(send, `!!document.querySelector("[data-pay-plan-included]")`);
  if (included !== true) {
    const chosen = await evaluate(
      send,
      `(() => {
        const radios = Array.from(document.querySelectorAll('input[name="plan"]'));
        if (radios.length === 0) return null;
        const pick = radios.find((el) => el.value === ${JSON.stringify(plan)}) ?? radios[0];
        pick.click();
        return pick.value;
      })()`,
    );
    if (chosen !== null) {
      await record(send, {
        action: "fill",
        values: { plan: chosen },
        expect: "the plan panel offers the membership plans and one is chosen",
        name: `${pathLabel}-pay-plan`,
      });
    }
  }

  await click(send, '[data-pay-action="card"]', { navigate: false, timeout: 25000 });
  await waitFor(send, payStep("card"), { timeout: 25000, label: "the walk's card panel" });

  // The gate is the stage, so it is asserted here — before anything is put on file.
  const gateBefore = await evaluate(send, SEND_GATE);
  await record(send, {
    action: "assert",
    expect: "the send column is locked while no card is on file, and says what unlocks it",
    ok: gateBefore === "locked",
    actual: `data-send-gate=${String(gateBefore)}`,
    name: `${pathLabel}-send-gate-locked`,
  });

  await click(send, '[data-pay-action="capture"]', { navigate: false, timeout: 40000 });
  await waitFor(
    send,
    `!!document.querySelector('[data-capture-frame="embedded"]') || !!document.querySelector("[data-pay-hosted]") || !!document.querySelector("[data-pay-refusal]")`,
    { timeout: 40000, label: "the card panel's frame" },
  );

  if (!complete) {
    // The card step, left unresolved — which is the state the `unpaid` path exists to show.
    const drawn = await text(send);
    await record(send, {
      action: "assert",
      expect:
        "the card step mounts the provider's frame in test mode, and leaving it unresolved leaves nothing on file",
      ok: !/card (is )?on file/i.test(drawn),
      actual: drawn.slice(0, 400),
      name: `${pathLabel}-card-frame`,
    });
    return { completed: false };
  }

  const card = await fillCardFrame(send, { email: PERSONA.published.email });
  await record(send, {
    action: "fill",
    values: card.typed ?? {},
    expect:
      "the payment step runs in Stripe test mode and the provider's own frame takes the test card",
    ok: card.filled === true,
    actual:
      card.filled === true
        ? `${Object.keys(card.typed).length} field(s) · submit "${card.submit}"`
        : `${card.reason ?? "the frame drew no field the driver recognises"} · ${card.fields ?? 0} input(s) in ${card.frameUrl ?? "no frame"}${card.seen ? ` · saw ${card.seen}` : ""}`,
    name: `${pathLabel}-card-filled`,
  });

  // The provider answers, the app resolves the method server-side, and the panel moves to its
  // third step — which has no button, because the walk ends there.
  const thanked = await waitFor(send, payStep("thanks"), { timeout: 60000, label: "the thank-you step" })
    .then(() => true)
    .catch(() => false);
  const gateAfter = await evaluate(send, SEND_GATE);
  await record(send, {
    action: "assert",
    expect: "the card on file ends the walk at the thank-you step and opens the send column",
    ok: thanked && gateAfter === "open",
    actual: `pay-step=${thanked ? "thanks" : "card"} · data-send-gate=${String(gateAfter)}`,
    name: `${pathLabel}-card-on-file`,
  });
  return { completed: thanked && gateAfter === "open" };
}

/* ---- path 1: create-published ------------------------------------- */

async function walkCreatePublished(send) {
  const entry = begin("create-published", "the relationship detail renders the published pairing");
  await send("Network.clearBrowserCookies");
  await navigate(send, "/");
  await record(send, {
    action: "assert",
    expect: "the walk starts signed out, on a page that is not the app shell's gated surface",
    name: "signed-out-start",
  });

  await walkCreateStages(send, PERSONA.published, { mode: "basic", setting: "full" });

  // The #704 shape: a signed-out creator reaches stage 4 and is asked for an account there.
  const gateForm = await accountFormDrawn(send);
  await record(send, {
    action: "assert",
    expect:
      "a signed-out creator is asked for an account at stage 4 (the #704 gate), not before it",
    ok: gateForm === true,
    actual: gateForm ? null : "stage 4 drew no account form for a signed-out visitor",
    name: "account-gate-at-stage-4",
  });

  // A control the viewer cannot mean: the rail's sign-out row is drawn to somebody who never signed in.
  const logoutToStranger =
    (await evaluate(
      send,
      `!!document.querySelector('a,button') && /Logout/i.test(document.body.innerText)`,
    )) === true;
  await record(send, {
    action: "assert",
    expect: "a signed-out visitor is not offered a sign-out control",
    ok: logoutToStranger === false,
    actual: logoutToStranger ? "the rail draws Logout for a signed-out visitor" : null,
    name: "no-logout-for-stranger",
  });
  if (logoutToStranger) {
    finding("the app shell draws a Logout row to a signed-out visitor", {
      expected: "no sign-out control before a session exists",
      actual: "the sidebar's `Logout` row renders on the signed-out create stages",
      shot: transcript.steps[transcript.steps.length - 1].shot,
      note: "components/layout/sidebar.tsx renders the row unconditionally at the foot of the rail; pressing it on a signed-out page has nothing to end.",
    });
  }

  await demoSignIn(send, "initiator");
  await navigate(send, `${CREATE}/commit`);
  const signedInText = await text(send);
  await record(send, {
    action: "assert",
    expect: "the creator returns to stage 4 signed in, with the review card drawn",
    ok:
      (await accountFormDrawn(send)) === false &&
      (await evaluate(send, `!!document.querySelector("[data-create-account]")`)),
    actual: signedInText.slice(0, 400),
    name: "stage-4-signed-in",
  });

  const { instanceId } = await commitDraft(send, "published");

  const invite = await text(send);
  await record(send, {
    action: "assert",
    expect: "stage 5 offers Send and Continue and Continue as Draft",
    ok: invite.includes("Send") && invite.includes("Draft"),
    actual: invite.slice(0, 400),
    name: "stage-5-invite",
  });

  if (instanceId === null) {
    finding("stage 5 does not carry ?instance=<id>, so the relationship cannot be identified", {
      expected: "?instance=<relationship record id>",
      actual: await url(send),
    });
    return;
  }

  // **Send is gated by stage 5's own pay walk (#911).** The confirm control is disabled until a card
  // is on file, so the published path has to walk the three panels and put one there first —
  // otherwise the click below is a click on a disabled button.
  const paid = await payWalk(send, {
    pathLabel: "published",
    complete: true,
    plan: "unlimited",
  });
  if (!paid.completed) {
    finding("the published path could not put a card on file, so Send never unlocks", {
      expected: "the pay walk reaches its thank-you step and data-send-gate=open",
      actual: "the walk stopped before the send column opened",
    });
  }

  const sendButton = await evaluate(
    send,
    `!!document.querySelector(${JSON.stringify(SEND_SELECTOR)})`,
  );
  if (sendButton !== true) {
    finding("stage 5 draws no Send control", {
      expected: SEND_SELECTOR,
      actual: "absent",
    });
    return;
  }
  await click(send, SEND_SELECTOR, { timeout: 40000 });
  await sleep(1200);

  // Send lands on the **Sent** screen — the #704 shape for a signed-in creator — not on the
  // relationship detail. That screen is a state of its own and is captured as one.
  const sentText = await text(send);
  const sentRoute = normaliseRoute(await url(send));
  const invitation = await inviteUrlOnScreen(send);
  await record(send, {
    action: "click",
    expect: "Send and Continue lands on the Sent screen, which draws the invitation link itself",
    ok:
      /Invitation sent|invitation sent/i.test(sentText) === true && typeof invitation === "string",
    actual: `${sentRoute} · invite link ${typeof invitation === "string" ? "drawn" : "absent"}`,
    name: "invitation-sent",
  });

  if (typeof invitation === "string") {
    const printed = new URL(invitation);
    if (printed.origin !== BASE) {
      finding("the invitation link is composed with a fixed origin, not the request's", {
        expected: `a link on ${BASE}`,
        actual: normaliseRoute(invitation),
        shot: transcript.steps[transcript.steps.length - 1].shot,
        note: "composed from DEFAULT_BASE_URL in lib/flow/email.ts (http://localhost:3000); a demo served on any other port prints a link that does not resolve to the tree under test.",
      });
    }
  }

  // "Where to go next" carries the one door to the relationship the send created.
  const nextHref = await evaluate(
    send,
    `(() => {
      const anchor = Array.from(document.querySelectorAll('a[href^="/assessment/instances/"], a[href^="/dashboard/relationships/"]'))
        .find((el) => !el.getAttribute("href").endsWith("/sent"));
      if (anchor === undefined) return null;
      anchor.click();
      return anchor.getAttribute("href");
    })()`,
  );
  await sleep(1500);

  const terminalText = await text(send);
  const terminalRoute = normaliseRoute(await url(send));
  const doorOpened =
    /^\/(assessment\/instances|dashboard\/relationships)\//.test(
      new URL(await url(send)).pathname,
    ) && terminalText.trim().length > 40;
  await record(send, {
    action: "click",
    expect: "the Sent screen's door opens the record the send created",
    ok: doorOpened,
    actual: `${terminalRoute} · ${terminalText.slice(0, 220)}`,
    name: "sent-door-opened",
  });

  // The card's terminal: the relationship detail, in its published state.
  const publishedId = relationships[relationships.length - 1] ?? null;
  void nextHref;
  const detailPath =
    typeof publishedId === "string"
      ? `/dashboard/relationships/${publishedId}`
      : `/dashboard/relationships`;
  await navigate(send, detailPath);
  // The detail is a client surface that mounts after hydration; the row marks are what say it has.
  await waitFor(send, `!!document.querySelector('[data-record-band="relationship"]')`, {
    timeout: 20000,
    label: "the relationship detail to mount",
  }).catch(() => undefined);
  const detailText = await text(send);
  const detailStatus = await evaluate(
    send,
    `document.querySelector("[data-relationship-status]")?.getAttribute("data-relationship-status") ?? null`,
  );
  await record(send, {
    action: "assert",
    expect: "the relationship detail reports the relationship as published",
    ok: detailStatus === "published",
    actual: `status ${detailStatus} · ${detailText.slice(0, 220)}`,
    name: "published-relationship-detail",
  });

  // The pairing is the other half of the card's sentence, and it is asked separately: a detail page
  // that says "published" while naming neither person is a state, not a pairing.
  const named = detailText.includes("Jordan") && detailText.includes("Sam");
  await record(send, {
    action: "assert",
    expect: "the relationship detail names the two parties",
    ok: named,
    actual: named
      ? null
      : `neither "Jordan Case" nor "Sam Wren" is in the rendered text (${detailText.slice(0, 160)})`,
    name: "detail-names-the-pairing",
  });

  entry.terminal = `the published relationship detail at ${normaliseRoute(await url(send))} (status ${detailStatus}, pairing ${named ? "named" : "not named"})`;
  entry.reached = detailStatus === "published";
  if (!named) {
    finding(
      "the relationship detail does not name either party, and is headed by the template's title",
      {
        expected:
          "the detail naming Jordan Case and Sam Wren, under the title the creator gave the relationship",
        actual: `h1 reads "Relationship Basics" (the template); the names exist only in the RSC payload — status ${detailStatus}`,
        shot: transcript.steps[transcript.steps.length - 1].shot,
        note: `the listing row for the same record prints "${PERSONA.published.title}" and its counterparty's name, so the two surfaces disagree about what the record is called and who is in it.`,
      },
    );
  }
}

/* ---- path 2: create-draft ----------------------------------------- */

async function walkCreateDraft(send) {
  const entry = begin(
    "create-draft",
    "the draft is listed on /dashboard/relationships and reopens in the editor",
  );
  // A filtered run walks one path from a fresh browser; this path begins signed in, so it opens the
  // session itself. In the full run the session is the one the published path established.
  if (ONLY.length > 0) await demoSignIn(send, "initiator");
  await navigate(send, CREATE);
  await record(send, {
    action: "assert",
    expect: "the draft walk starts signed in, on stage 1",
    ok: (await stageLine(send)) === "Stage 1 of 5",
    actual: await stageLine(send),
    name: "signed-in-stage-1",
  });

  await walkCreateStages(send, PERSONA.draft, { mode: "basic", setting: "soft" });
  const { instanceId } = await commitDraft(send, "draft");
  if (instanceId === null) {
    finding("create-draft: stage 5 does not carry ?instance=<id>", {
      expected: "?instance=<relationship record id>",
      actual: await url(send),
    });
    return;
  }

  const keepDraft = await evaluate(send, `!!document.querySelector("[data-create-keep-draft]")`);
  if (keepDraft !== true) {
    finding("create-draft: stage 5 draws no Continue as Draft control", {
      expected: "[data-create-keep-draft]",
      actual: "absent",
    });
    return;
  }
  await click(send, `[data-create-keep-draft]`, { timeout: 30000 });
  await waitFor(send, `location.pathname === "/dashboard/relationships"`, {
    timeout: 30000,
    label: "/dashboard/relationships",
  });
  const listed = await text(send);
  const shows = listed.includes(PERSONA.draft.title);
  await record(send, {
    action: "click",
    expect:
      "Continue as Draft lands on /dashboard/relationships with the draft listed by its own title",
    ok: shows,
    actual: listed.slice(0, 500),
    name: "draft-listed",
  });

  if (!shows) {
    finding("create-draft: the draft is not listed on /dashboard/relationships", {
      expected: `a row titled "${PERSONA.draft.title}"`,
      actual: listed.slice(0, 600),
      shot: transcript.steps[transcript.steps.length - 1].shot,
    });
    return;
  }

  const draftLink = await evaluate(
    send,
    `(() => {
      const anchors = Array.from(document.querySelectorAll('a[href^="/dashboard/relationships/"]'));
      const titled = anchors.find((anchor) => {
        const card = anchor.closest("article, li, section, div");
        return card !== null && card.textContent.includes(${JSON.stringify(PERSONA.draft.title)});
      });
      if (titled === undefined) return null;
      titled.click();
      return titled.getAttribute("href");
    })()`,
  );
  if (typeof draftLink !== "string") {
    finding("create-draft: no control opens the draft from the listing", {
      expected: `an anchor under /dashboard/relationships/ inside the row titled "${PERSONA.draft.title}"`,
      actual: listed.slice(0, 700),
      shot: transcript.steps[transcript.steps.length - 1].shot,
    });
    return;
  }
  await waitFor(send, `location.pathname.startsWith("/dashboard/relationships/")`, {
    timeout: 30000,
    label: "the relationship detail",
  });
  await waitFor(send, `!!document.querySelector('[data-record-band="relationship"]')`, {
    timeout: 20000,
    label: "the draft's detail to mount",
  }).catch(() => undefined);
  const editorText = await text(send);
  // The editor reopens when the surface offers the edit; the draft's **own title** is a separate
  // question, and it is asked separately — a detail page headed with the template's name still
  // reopens the editor, and collapsing the two would hide whichever one is wrong.
  const reopens =
    (await evaluate(
      send,
      `!!document.querySelector('[data-record-band="relationship"], [data-relationship-detail-band]')`,
    )) === true &&
    /Edit this relationship/i.test(editorText) === true &&
    /Aspects/i.test(editorText) === true;
  await record(send, {
    action: "click",
    expect: "the draft reopens in the editor",
    ok: reopens,
    actual: `${normaliseRoute(await url(send))} · ${editorText.slice(0, 300)}`,
    name: "draft-reopened",
  });

  const ownTitle = editorText.includes(PERSONA.draft.title);
  await record(send, {
    action: "assert",
    expect: "the relationship detail heads the draft with the title the creator gave it",
    ok: ownTitle,
    actual: ownTitle
      ? null
      : `the page reads "${(editorText.match(/^(.{0,80})/) ?? [""])[0]}" without "${PERSONA.draft.title}"`,
    name: "draft-own-title",
  });

  entry.terminal = `the draft reopened at ${normaliseRoute(await url(send))}`;
  entry.reached = reopens && shows;
  if (!ownTitle) {
    finding(
      "create-draft: the relationship detail is headed by the template's name, not the draft's own title",
      {
        expected: `"${PERSONA.draft.title}" on the detail page`,
        actual: editorText.slice(0, 300),
        shot: transcript.steps[transcript.steps.length - 1].shot,
        note: "the listing row prints the draft's own title, and the detail prints the template's (\"Relationship Basics\") — the row and the page disagree about what the record is called.",
      },
    );
  }
  if (!reopens) {
    finding("create-draft: the draft does not reopen in an editor", {
      expected: "the relationship detail with the draft's title and an editing surface",
      actual: editorText.slice(0, 600),
      shot: transcript.steps[transcript.steps.length - 1].shot,
    });
  }
}

/* ---- path 3: unpaid ------------------------------------------------ */

async function walkUnpaid(send) {
  const entry = begin("unpaid", "the Advanced trial, the claim, and the payment screens");
  // Same as create-draft: walked alone, this path opens its own session.
  if (ONLY.length > 0) await demoSignIn(send, "initiator");

  await navigate(send, CREATE);
  await walkCreateStages(send, PERSONA.unpaid, { mode: "advanced", setting: "full" });
  const { instanceId, relationshipId } = await commitDraft(send, "unpaid");
  if (instanceId === null) {
    finding("unpaid: stage 5 does not carry ?instance=<id>", {
      expected: "?instance=<relationship record id>",
      actual: await url(send),
    });
    return;
  }

  const walk = await text(send);
  const mentionsTrial = /trial/i.test(walk);
  const mentionsAdvanced = /Advanced/.test(walk);
  await record(send, {
    action: "assert",
    expect: "stage 5 names the Advanced trial and the plan walk before anything is sent",
    ok: mentionsTrial && mentionsAdvanced,
    actual: walk.slice(0, 500),
    name: "advanced-trial-on-stage-5",
  });

  // **The unpaid path stops at the card panel on purpose (#911).** The walk opens on Advanced with
  // its trial, reaches the card step, and leaves it there — the frame mounted, nothing on file.
  await payWalk(send, { pathLabel: "unpaid", complete: false, plan: "unlimited" });

  // The abandoned-payment screen: the send is still locked, and the sentence beside it says why.
  const sendDrawn = await evaluate(send, `!!document.querySelector(${JSON.stringify(SEND_SELECTOR)})`);
  const sendDisabled = await evaluate(
    send,
    `document.querySelector(${JSON.stringify(SEND_SELECTOR)})?.disabled ?? null`,
  );
  const gateState = await evaluate(send, SEND_GATE);
  const abandoned = await text(send);
  await record(send, {
    action: "assert",
    expect:
      "abandoning the payment step leaves the relationship unpublished, with the send locked and the reason drawn beside it",
    ok: sendDrawn === true && sendDisabled === true && gateState === "locked",
    actual: `send drawn=${String(sendDrawn)} disabled=${String(sendDisabled)} · data-send-gate=${String(gateState)} · ${abandoned.slice(0, 260)}`,
    name: "abandoned-payment-screen",
  });

  const afterSend = await text(send);

  // The invitation the counterparty has to claim: read the link off the screen, never type one.
  const invitation = await inviteUrlOnScreen(send);
  if (typeof invitation !== "string") {
    finding("unpaid: the Sent screen draws no invitation link to claim", {
      expected:
        "the invitation URL as text on the screen (the `<code>` beside its copy control, #220)",
      actual: afterSend.slice(0, 600),
      shot: transcript.steps[transcript.steps.length - 1].shot,
    });
  } else {
    // The counterparty is a different person: no session, no party cookie.
    await send("Network.clearBrowserCookies");
    const invitePath = new URL(onBase(invitation)).pathname;
    await navigate(send, invitePath);
    const inviteText = await text(send);
    await record(send, {
      action: "assert",
      expect: "the counterparty opens the invitation and lands on the first of its three steps",
      ok: /What this is/i.test(inviteText) === true,
      actual: inviteText.slice(0, 400),
      name: "invitation-opened",
    });

    // The wizard's own rail is the only way through it — the steps are links, not a state machine.
    for (const step of [2, 3]) {
      const moved = await evaluate(
        send,
        `(() => {
          const next = Array.from(document.querySelectorAll('a[href*="step=${step}"]'))
            .find((el) => !/back/i.test(el.textContent || ""));
          if (next === undefined) return null;
          next.click();
          return next.getAttribute("href");
        })()`,
      );
      if (moved === null) {
        finding(`unpaid: the invitation has no way from step ${step - 1} to step ${step}`, {
          expected: `a link to ?step=${step}`,
          actual: (await text(send)).slice(0, 500),
        });
        return;
      }
      await waitFor(send, `location.search.includes("step=${step}")`, {
        timeout: 20000,
        label: `invitation step ${step}`,
      });
    }

    const stepThree = await text(send);
    const needsAccount = /sign in|create an account|Sign in/i.test(stepThree) === true;
    await record(send, {
      action: "click",
      expect:
        "step 3 is the confirmation, and a signed-out counterparty is asked for an account there",
      ok: needsAccount,
      actual: stepThree.slice(0, 400),
      name: "invitation-confirm-step",
    });

    if (needsAccount) await demoSignIn(send, "counterparty");
    await navigate(send, `${invitePath}?step=3`);

    const confirmDrawn = await evaluate(send, `!!document.querySelector('input[name="confirm"]')`);
    const accepted = await evaluate(
      send,
      `(() => {
        const box = document.querySelector('input[name="confirm"]');
        if (box === null) return false;
        box.click();
        const button = box.closest("form")?.querySelector('button[type="submit"]');
        if (button === undefined || button === null) return false;
        button.click();
        return true;
      })()`,
    );
    await sleep(1500);
    await waitFor(
      send,
      `document.readyState === "complete" && document.body.innerText.trim().length > 40`,
      {
        timeout: 20000,
        label: "the claimed screen to render",
      },
    ).catch(() => undefined);
    const claimed = await text(send);
    // The row is the fact: a claim that renders a welcome and leaves `accepted_at` null is a screen,
    // not a seat. Read it back rather than trusting the copy.
    const acceptedAt = await evaluate(send, "location.pathname");
    void acceptedAt;
    const seat = await db.query(
      `SELECT r.counterparty_user_id AS bound_user, p.user_id AS party_user
         FROM relationship r
         LEFT JOIN session s ON s.relationship_id = r.id
         LEFT JOIN party p ON p.session_record_id = s.record_id AND p.role = 'counterparty'
        WHERE r.id = $1`,
      [relationshipId],
    );
    const bound = seat.rows[0]?.bound_user ?? null;
    const partyUser = seat.rows[0]?.party_user ?? null;
    await record(send, {
      action: "click",
      values: { confirm: "accepted" },
      expect: "the counterparty confirms and the claim binds their account to the seat",
      ok: confirmDrawn === true && accepted === true && (bound !== null || partyUser !== null),
      actual: `confirm ${confirmDrawn ? "drawn" : "absent"} · submit ${accepted ? "clicked" : "absent"} · bound account ${bound !== null || partyUser !== null ? "set" : "null"} · ${normaliseRoute(await url(send))} · ${claimed.slice(0, 240)}`,
      name: "counterparty-claimed",
    });
  }

  // The payer's side: the capture dialog, its plans, and the provider's frame.
  const payerRoute =
    relationshipId === null ? `${CREATE}/invite` : `/dashboard/relationships/${relationshipId}`;
  await demoSignIn(send, "initiator");
  await navigate(send, payerRoute);
  const payerText = await text(send);
  // The relationship's own state, read from the detail's marker rather than from the copy beside it.
  const payerStatus = await evaluate(
    send,
    `document.querySelector("[data-relationship-status]")?.getAttribute("data-relationship-status") ?? null`,
  );
  await record(send, {
    action: "assert",
    expect: "the payer's relationship detail draws the payment state the publish left it in",
    ok: /payment|Payment|trial|Trial/i.test(payerText) === true,
    actual: payerText.slice(0, 500),
    name: "payer-payment-state",
  });

  const captureControl = await evaluate(
    send,
    `(() => {
      const control = Array.from(document.querySelectorAll("button, a")).find((el) =>
        /payment method|card|Payment method/i.test(el.textContent || ""),
      );
      if (control === undefined || control.disabled) return control === undefined ? "absent" : "disabled";
      control.click();
      return "clicked";
    })()`,
  );
  await sleep(900);
  await record(send, {
    action: "click",
    expect: 'the payer can open the "Add a payment method" dialog',
    ok: captureControl === "clicked",
    actual: captureControl,
    name: "capture-dialog-opened",
  });

  const dialogText = await text(send);
  const captureStage = await evaluate(
    send,
    `document.querySelector("[data-capture-dialog]")?.querySelector("[data-capture-stage]")?.getAttribute("data-capture-stage") ?? null`,
  );
  await record(send, {
    action: "assert",
    expect: "the capture dialog draws the plans and the trial sentence before any card field",
    ok:
      dialogText.length > 0 &&
      (await evaluate(send, `!!document.querySelector("[data-capture-plans]")`)) === true,
    actual: `stage ${captureStage} · ${dialogText.slice(0, 350)}`,
    name: "capture-dialog",
  });

  // The provider's card fields: the dialog starts an embedded capture and mounts the frame.
  const started = await evaluate(
    send,
    `(() => {
      const button = document.querySelector("[data-add-method]");
      if (button === null || button.disabled) return false;
      button.click();
      return true;
    })()`,
  );
  let providerFrame = null;
  if (started === true) {
    for (let attempt = 0; attempt < 40; attempt++) {
      await sleep(500);
      providerFrame = await evaluate(
        send,
        `(() => {
          const frame = Array.from(document.querySelectorAll("iframe"))
            .find((el) => /checkout\\.stripe\\.com|js\\.stripe\\.com\\/v3\\/e/.test(el.src || ""));
          return frame === undefined ? null : frame.src.split("?")[0];
        })()`,
      );
      if (providerFrame !== null) break;
    }
  }
  await record(send, {
    action: "click",
    expect: "the capture runs in Stripe test mode and mounts the provider's own card frame",
    ok: started === true && providerFrame !== null,
    actual:
      started === true
        ? `provider frame ${providerFrame ?? "did not mount"}`
        : "the control did not press",
    name: "stripe-test-mode-frame",
  });

  // The dialog says out loud that the frame is the provider's test mode — that badge is the claim.
  const testModeBadge = await evaluate(
    send,
    `(() => {
      const frame = document.querySelector("[data-capture-frame]");
      return frame === null ? null : /test/i.test(frame.textContent || "");
    })()`,
  );
  await record(send, {
    action: "assert",
    expect: "the frame is labelled as the provider's test mode",
    ok: testModeBadge === true,
    actual: `test-mode label ${testModeBadge === true ? "drawn" : "absent"}`,
    name: "test-mode-label",
  });

  if (started === true && providerFrame === null) {
    finding("unpaid: the capture starts but the provider's card frame never mounts", {
      expected: "an embedded checkout frame from checkout.stripe.com",
      actual: dialogText.slice(0, 600),
      shot: transcript.steps[transcript.steps.length - 1].shot,
      note: "the dialog's own marker `data-capture-frame=embedded` and a mounted Stripe frame are what make the payer's step real; without them the screen is a plan list that cannot be completed.",
    });
  }

  // The abandoned payment: the payer leaves the checkout without saving a method. On the frame
  // stage that is the frame's own cancel (`data-closepay`); on the plan stage it is `data-capture-skip`.
  const skipped = await evaluate(
    send,
    `(() => {
      const button = document.querySelector("[data-closepay]") ?? document.querySelector("[data-capture-skip]");
      if (button === null) return false;
      button.click();
      return true;
    })()`,
  );
  await sleep(1000);
  const afterSkip = await evaluate(
    send,
    `(() => {
      const band = document.querySelector("[data-completion-method]");
      return {
        method: band?.getAttribute("data-completion-method") ?? null,
        gate: band?.getAttribute("data-completion-gate") ?? null,
        sealed: band?.getAttribute("data-completion-sealed") ?? null,
        openDialog: document.querySelectorAll('[data-capture-dialog][data-state="open"]').length,
      };
    })()`,
  );
  await record(send, {
    action: "click",
    expect:
      "leaving the payment step unresolved leaves the relationship owing a method, on a screen that says so",
    ok: skipped === true && afterSkip.method === "missing" && afterSkip.openDialog === 0,
    actual: `${JSON.stringify(afterSkip)} · ${(await text(send)).slice(0, 300)}`,
    name: "abandoned-payment",
  });

  entry.terminal = `the abandoned payment at ${normaliseRoute(`${BASE}${payerRoute}`)} — completion gate ${afterSkip.gate}, method ${afterSkip.method}, sealed ${afterSkip.sealed}, relationship ${String(payerStatus)}`;
  // **Not published is the point.** #911 gates the send on the card, so the state this path exists to
  // show is a relationship that owes a method and has therefore not been sent — the terminal screen
  // is the owing one, not a published pairing.
  entry.reached =
    payerStatus !== "published" && captureControl === "clicked" && afterSkip.method === "missing";

  if (entry.reached) {
    // The lapsed state is the one screen a browser cannot walk to: `expired` is the *system's* move
    // when the trial's `current_period_end` (or the 14-day payment window) passes, and the clock in
    // this tree is a real one. Recorded as a finding so the card that owns it is named, rather than
    // faking a screen the product never drew.
    finding("unpaid: the lapsed state is not reachable from a browser run", {
      expected: "the relationship in its `expired` state, with the screen it draws",
      actual: "the run ends at the abandoned-payment state; nothing in the UI advances the clock",
      shot: transcript.steps[transcript.steps.length - 1].shot,
      note: "`lib/relationship/status.ts` makes `published → expired` a **system** move driven by `lib/flow/payment-jobs.ts` against `current_period_end`. Driving it needs either a job run against a row whose window has passed (a seeded expired fixture, or `expired_at` written by the job) or a clock seam this tree does not have. This is a card for the lead, not a defect the driver can patch.",
    });
  } else {
    finding("unpaid: the payment step did not reach its terminal screen", {
      expected:
        "the capture dialog, the provider's frame, and the abandoned-payment state behind it",
      actual: `${captureControl}; frame ${providerFrame ?? "absent"}; ${JSON.stringify(afterSkip)}`,
      shot: transcript.steps[transcript.steps.length - 1].shot,
    });
  }
}

/* ------------------------------------------------------------------ *
 * seed, run, write, check
 * ------------------------------------------------------------------ */

/**
 * The drift `db:seed` refuses on, asked **before** the seed runs.
 *
 * `db:seed --check` answers a different question (what the *sweep* would remove — relationship
 * strays), so it passes on a branch that the seed then refuses, after phase 1 has already deleted
 * the demo accounts. This asks the seed's own question in the seed's own terms: an `assessment`
 * record whose id the bundle does not author. Read from the bundle file, never from a copy of the
 * ids, so the two can never disagree.
 */
async function seedDrift(client) {
  const file = join(ROOT, "data", "bundles", "demo-dataset.alignsynch.json");
  const parsed = JSON.parse(readFileSync(file, "utf8"));
  const payload = parsed.payload ?? parsed.bundle?.payload ?? {};
  const authored = [
    ...(payload.templates ?? []).map((record) => record.id),
    ...(payload.records ?? []).map((record) => record.id),
    ...(payload.instances ?? []).map((record) => record.id),
    ...(payload.assessments ?? []).map((record) => record.id),
  ].filter((id) => typeof id === "string");
  if (authored.length === 0) return { checked: false, extra: [] };
  const { rows } = await client.query(
    `SELECT id FROM record WHERE record_type = 'assessment' AND id <> ALL($1::text[]) ORDER BY id`,
    [authored],
  );
  return { checked: true, extra: rows.map((row) => row.id) };
}

function seed(drift) {
  if (SKIP_SEED) {
    console.log("· seed skipped (DEMO_FLOW_SKIP_SEED=1) — the branch is driven as it stands");
    return { attempted: false };
  }

  /**
   * **Ask the safe question first.** `db:seed` deletes the demo accounts in phase 1 and re-creates
   * them in phase 2, so a run that *refuses* in phase 2 leaves the branch with no demo identities —
   * the documented half-seeded state, which this driver then cannot sign in against. The refusal's
   * cause is drift the bundle does not author, and `seedDrift()` names it without writing anything.
   */
  if (drift.checked && drift.extra.length > 0) {
    console.error("! the demo branch holds assessment record(s) the bundle does not author:");
    for (const id of drift.extra.slice(0, 8)) console.error(`    ${id}`);
    console.error(
      "! seeding is skipped rather than attempted — a refusal would delete the demo accounts",
    );
    console.error("! the walk continues against the branch as it stands");
    return {
      attempted: false,
      reason: `db:seed would refuse: ${drift.extra.length} assessment record(s) the bundle does not author`,
      drift: drift.extra.slice(0, 8),
    };
  }

  console.log("· seeding the demo dataset (DEMO_AUTH=1, branch advisory lock algn/1)");
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      "./scripts/ts-modules.mjs",
      "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
      "scripts/db-seed.mjs",
    ],
    { cwd: ROOT, stdio: "inherit", env: { ...process.env, DEMO_AUTH: "1" } },
  );
  const ok = (result.status ?? 1) === 0;
  if (ok) return { attempted: true, ok: true };

  console.error("! the seed refused — see the lines above");
  if (process.env.DEMO_FLOW_REQUIRE_SEED === "1") {
    throw new Error("db:seed refused and DEMO_FLOW_REQUIRE_SEED=1");
  }
  console.error(
    "! continuing against the branch as it stands (DEMO_FLOW_REQUIRE_SEED=1 makes this fatal)",
  );
  return { attempted: true, ok: false, reason: "db:seed refused after the pre-flight passed" };
}

async function main() {
  const started = Date.now();
  ensureDir(OUT);

  console.log(`demo-flow · ${CHECK ? "check" : "run"} · base ${BASE} · out ${OUT}`);
  if (/production/i.test(process.env.NEON_BRANCH ?? "")) {
    console.error(
      "demo-flow: NEON_BRANCH=production — this driver seeds and creates rows; refusing.",
    );
    process.exit(2);
  }

  db = new Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();

  // The seed is decided from a read, never from a guess: `seedDrift()` asks the seed's own question.
  const drift = await seedDrift(db);
  const seedResult = seed(drift);
  transcript.seed = seedResult;

  const before = await branchCounts();
  console.log(`· branch before: ${JSON.stringify(before)}`);

  await launchChrome();
  const page = await attach();
  try {
    await page.send("Page.enable");
    await page.send("Runtime.enable");
    await page.send("Network.enable");
    await page.send("Emulation.setDeviceMetricsOverride", {
      width: WIDTH,
      height: VIEWPORT_HEIGHT,
      deviceScaleFactor: 1,
      mobile: false,
    });
    // One rendering preference for the whole run, so two runs frame the same tree the same way.
    await page.send("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: "reduce" }],
    });
    // A headless window has no OS focus, and a synthetic keystroke goes nowhere without it. The card
    // step is typed into, so the page is told to behave as the focused tab.
    await page.send("Emulation.setFocusEmulationEnabled", { enabled: true }).catch(() => undefined);

    const steps = [
      ["create-published", walkCreatePublished],
      ["create-draft", walkCreateDraft],
      ["unpaid", walkUnpaid],
    ].filter(([name]) => ONLY.length === 0 || ONLY.includes(name));
    if (steps.length === 0) {
      throw new Error(
        `DEMO_FLOW_ONLY names no path this driver walks (${ONLY.join(", ")}) — the three are create-published, create-draft, unpaid`,
      );
    }
    const failures = [];
    for (const [name, walk] of steps) {
      try {
        await walk(page.send);
      } catch (error) {
        failures.push(`${name}: ${error.message}`);
        console.error(`! ${name} stopped: ${error.message}`);
        finding(`${name} stopped before its terminal screen`, {
          path: name,
          expected: "the path walks to its terminal screen",
          actual: error.message,
        });
      }
    }

    transcript.steps.forEach((step, index) => {
      step.step = index + 1;
    });
    const reached = transcript.paths.filter((entry) => entry.reached).length;
    transcript.summary = {
      paths: transcript.paths.length,
      reached,
      steps: transcript.steps.length,
      findings: transcript.findings.length,
    };

    // The persona has to be **gone**, not merely invisible: clean up here (the `finally` is the
    // safety net for a throw), then read the branch back.
    //
    // The invariant is *this run's rows*, not the branch's totals. Another card's run moves the
    // totals while this one walks — a `before` reading 39 against an `after` reading 38 is one
    // foreign row arriving and leaving, and calling that "not unchanged" would fail an honest run
    // on a shared branch. So: every id this run created is counted after the delete, and 0 is the
    // only passing answer.
    await cleanup();
    const after = await branchCounts();
    const { rows: remainingRows } = await db.query(
      `SELECT (SELECT count(*)::int FROM record WHERE id = ANY($1::text[])) AS records,
              (SELECT count(*)::int FROM relationship WHERE id = ANY($2::text[])) AS relationships,
              (SELECT count(*)::int FROM session WHERE record_id = ANY($1::text[])) AS sessions`,
      [created, relationships],
    );
    const leftover = remainingRows[0];
    transcript.cleanup = {
      created: {
        records: created.length,
        relationships: relationships.length,
        accounts: createdAccounts.length,
      },
      before,
      after,
      leftover,
      unchanged: leftover.records === 0 && leftover.relationships === 0 && leftover.sessions === 0,
    };
    console.log(`· branch after:  ${JSON.stringify(after)}`);
    console.log(
      transcript.cleanup.unchanged
        ? `· cleanup proved: 0 of the ${created.length} record(s) and ${relationships.length} relationship(s) this run created still exist`
        : `! cleanup FAILED — rows this run created are still on the branch: ${JSON.stringify(leftover)}`,
    );
    writeFileSync(join(OUT, "transcript.json"), `${JSON.stringify(transcript, null, 2)}\n`);
    console.log(
      `· ${transcript.steps.length} steps · ${reached}/${transcript.paths.length} paths reached their terminal screen · ${transcript.findings.length} finding(s)`,
    );

    if (CHECK) return checkAgainstCommit();

    // Cleanup is a failure, not a warning: a persona left on a shared branch is the thing this
    // lane exists to prevent, and a green exit would report it as fine.
    if (!transcript.cleanup.unchanged) return 1;

    if (failures.length > 0) {
      console.error(`demo-flow: ${failures.length} path(s) did not complete`);
      for (const failure of failures) console.error(`  - ${failure}`);
      return 1;
    }
    if (STRICT && transcript.findings.length > 0) return 1;
    return 0;
  } finally {
    page.close();
  }
}

/**
 * `--check`: the run above wrote a staged copy; this diffs it against what is committed.
 *
 * **Two diffs, and one of them is a measurement rather than a byte comparison — on purpose.**
 *
 * The **transcript** is compared byte for byte. It is the artifact card 2 renders, and a changed
 * word in it is a changed screen: a route, a value that was typed, an assertion that flipped.
 *
 * The **PNGs** are compared by the geometry they record — every step carries the image's width and
 * height, and a screenshot whose size moved is a layout that moved. They are *not* compared by hash,
 * and the reason is measured, not assumed: a page prints values that are minted per run (the
 * invitation token on the Sent screen), mounts a third party's live frame (the Stripe capture) and
 * seeds its placeholder art from a row's id (the avatar gradients). Two runs of an unchanged tree
 * therefore produce identical transcripts and a handful of byte-different screenshots — 17 of 54
 * while writing this — and a hash comparison would fail every honest run and teach the reader to
 * ignore it. Each step's `sha256` stays in the transcript as the evidence of *the* run that wrote it.
 */
function checkAgainstCommit() {
  const canonicalTranscript = join(CANONICAL_OUT, "transcript.json");
  if (!existsSync(canonicalTranscript)) {
    console.error(
      `demo:flow:check — no committed transcript at ${canonicalTranscript}; run pnpm demo:flow first`,
    );
    return 1;
  }
  const committed = JSON.parse(readFileSync(canonicalTranscript, "utf8"));
  const staged = JSON.parse(readFileSync(join(OUT, "transcript.json"), "utf8"));

  // `summary` counts what this run found, `sha256` is the digest of one run's pixels, and `seed` and
  // `cleanup` are readings of a **shared** branch that another card's run moves (a new template, a
  // new party). None of them is a statement about a screen — the check compares the steps themselves.
  const strip = (value) => {
    const copy = JSON.parse(JSON.stringify(value));
    delete copy.summary;
    delete copy.seed;
    delete copy.cleanup;
    for (const step of copy.steps ?? []) delete step.sha256;
    return copy;
  };

  const a = JSON.stringify(strip(committed), null, 2);
  const b = JSON.stringify(strip(staged), null, 2);
  if (a !== b) {
    const before = a.split("\n");
    const after = b.split("\n");
    for (let index = 0; index < Math.max(before.length, after.length); index++) {
      if (before[index] !== after[index]) {
        console.error(
          `demo:flow:check — the transcript differs at line ${index + 1}\n  committed: ${String(before[index]).slice(0, 300)}\n  staged:    ${String(after[index]).slice(0, 300)}`,
        );
        return 1;
      }
    }
  }

  let redrawn = 0;
  for (const step of committed.steps) {
    const file = join(ROOT, step.shot);
    if (!existsSync(file)) {
      console.error(
        `demo:flow:check — the committed transcript names a missing image: ${step.shot}`,
      );
      return 1;
    }
    const bytes = readFileSync(file);
    const width = bytes.readUInt32BE(16);
    const height = bytes.readUInt32BE(20);
    if (width !== step.w || height !== step.h) {
      console.error(
        `demo:flow:check — ${step.shot} is ${width}×${height}, the transcript records ${step.w}×${step.h}`,
      );
      return 1;
    }
    const digest = createHash("sha256").update(bytes).digest("hex");
    if (digest !== step.sha256) redrawn += 1;
  }

  console.log(
    `✓ demo:flow:check — transcript byte-identical, ${committed.steps.length} image(s) present at the recorded size` +
      ` (${redrawn} image(s) changed since the transcript was written)`,
  );
  return 0;
}

/* ------------------------------------------------------------------ *
 * Entry
 * ------------------------------------------------------------------ */

async function shutdown(signal) {
  console.log(`· ${signal} — cleaning up`);
  try {
    await cleanup();
  } finally {
    stopChrome();
    process.exit(1);
  }
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

let exitCode = 1;
try {
  exitCode = await main();
} catch (error) {
  console.error(`demo-flow: ${error.message}`);
  exitCode = 1;
} finally {
  await cleanup();
  stopChrome();
}
process.exit(exitCode);
