/**
 * #979 B — capture six sampled entry points opening the create flow **in place**, at 1440 and 390.
 *
 * The dialogue's claim is not "the dialog exists" (the parent card proved that): it is that **a
 * control whose destination is a stage of the flow now opens it over the page it was pressed on**,
 * whichever surface drew the control. So each sample records the same four facts, because all four
 * can be wrong independently:
 *
 *   1. **the dialog mounts** — `[data-flow-mount="dialog"]` with a real box, over a page that is
 *      still in the document (its own `h1` still present);
 *   2. **stage 1 completes** — the seven fields are filled through the browser's own input events
 *      and the advance is a *soft* navigation, which is the only way the page underneath survives;
 *   3. **the address is the stage's own** — `/templates/relationship/<slug>/create/mode` after the
 *      advance, never a dialog-specific URL;
 *   4. **`Esc` returns focus to the trigger** — the dialog is gone, the address is the page that was
 *      pressed on, and `document.activeElement` is the anchor that opened it.
 *
 * Plus the class that must **not** move: a marketing entry (`/relationship-types`) and an empty-state
 * entry (`/assessments`) keep navigating, captured with the same harness so "unchanged" is a still
 * and not a sentence.
 *
 * No browser driver in this tree: Chrome is launched with `--remote-debugging-port` and driven over
 * raw CDP, as `docs/qa-971-tiles/capture.mjs` and the parent card's `docs/qa-979-flow-dialog/`
 * harness do. The sign-in happens from **Node** (the auth branch refuses a browser-origin sign-in),
 * and the cookies are installed before the first navigation.
 *
 *   node capture.mjs --base http://localhost:3479 --slug relationship-basics
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
};

const BASE = arg("base", "http://localhost:3479");
const OUT = arg("out", ".");
const DEBUG_PORT = Number(arg("port", "9411"));
const SLUG = arg("slug", "relationship-basics");
const EMAIL = arg("email", "qa979-entries@alignsynch.test");
const PASSWORD = arg("password", "qa979-entries-passw0rd");

mkdirSync(OUT, { recursive: true });

/* ---------------------------------------------------------------- sign in, from Node */

const COOKIE_CACHE = join(OUT, "cookies.json");
const post = (path, body) =>
  fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE },
    body: JSON.stringify(body),
  });

let cookies = existsSync(COOKIE_CACHE) ? JSON.parse(readFileSync(COOKIE_CACHE, "utf8")) : [];
if (cookies.length === 0) {
  let res = await post("/api/auth/sign-up/email", {
    name: "Entry QA",
    email: EMAIL,
    password: PASSWORD,
  });
  if (res.status >= 300)
    res = await post("/api/auth/sign-in/email", { email: EMAIL, password: PASSWORD });
  cookies = res.headers.getSetCookie().map((c) => c.split(";")[0]);
  console.log("auth:", res.status, cookies.length, "cookie(s)");
  if (cookies.length === 0) process.exit(1);
  writeFileSync(COOKIE_CACHE, JSON.stringify(cookies));
} else {
  console.log("auth: reusing", cookies.length, "cached cookie(s)");
}

/* ---------------------------------------------------------------- chrome, over CDP */

const chrome = spawn(
  "/usr/bin/google-chrome",
  [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--no-first-run",
    "--hide-scrollbars",
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=/tmp/t979-entries-chrome-${DEBUG_PORT}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);

const endpoint = async () => {
  for (let i = 0; i < 80; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
      const page = list.find((t) => t.type === "page");
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      // not up yet
    }
    await sleep(250);
  }
  throw new Error(`chrome never exposed a page target on ${DEBUG_PORT}`);
};

const ws = new WebSocket(await endpoint());
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve, { once: true });
  ws.addEventListener("error", reject, { once: true });
});

let seq = 0;
const pending = new Map();
ws.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  const waiter = pending.get(message.id);
  if (!waiter) return;
  pending.delete(message.id);
  if (message.error) waiter.reject(new Error(JSON.stringify(message.error)));
  else waiter.resolve(message.result);
});

const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    seq += 1;
    const id = seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });

const pageErrors = [];
/** Every response the page's own fetch makes to the flow's stage endpoints, for the diagnosis. */
const netLog = [];
/** `console.*` from the page, so a harness diagnosis is a fact rather than a guess. */
const logs = [];
ws.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.method === "Runtime.exceptionThrown") {
    pageErrors.push(message.params.exceptionDetails.exception?.description ?? "exception");
  }
  if (message.method === "Runtime.consoleAPICalled") {
    const line = message.params.args.map((a) => a.value ?? a.description).join(" ");
    if (message.params.type === "error") pageErrors.push(line);
    else logs.push(line);
  }
  if (message.method === "Network.responseReceived") {
    const { url, status } = message.params.response;
    if (url.includes("/assessment/new"))
      netLog.push({ url: url.replace(/^.*\/\/[^/]+/, ""), status });
  }
});

const evaluate = async (expression) => {
  const result = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
};

await send("Page.enable");
await send("Runtime.enable");
await send("Network.enable");

const jar = cookies.map((cookie) => {
  const index = cookie.indexOf("=");
  return {
    name: cookie.slice(0, index),
    value: cookie.slice(index + 1),
    url: BASE,
    secure: true,
    path: "/",
  };
});
await send("Network.setCookies", { cookies: jar });

const waitFor = async (expression, label, attempts = 120) => {
  for (let i = 0; i < attempts; i += 1) {
    if (await evaluate(expression)) return true;
    await sleep(200);
  }
  throw new Error(
    `never became true: ${label}\npage errors: ${pageErrors.slice(0, 3).join(" | ")}`,
  );
};

/** A real pointer click at an element's centre — Radix and `Link` both listen to pointer events. */
const clickFound = async (finder, label) => {
  const box = await evaluate(`(() => {
    const el = ${finder};
    if (!el) return null;
    el.scrollIntoView({ block: "center" });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
  if (!box) throw new Error(`no element for ${label}`);
  for (const type of ["mousePressed", "mouseReleased"]) {
    await send("Input.dispatchMouseEvent", {
      type,
      x: box.x,
      y: box.y,
      button: "left",
      clickCount: 1,
    });
  }
};

const key = async (name, code, virtualKeyCode, raw = false) => {
  await send("Input.dispatchKeyEvent", {
    type: raw ? "rawKeyDown" : "keyDown",
    key: name,
    code,
    windowsVirtualKeyCode: virtualKeyCode,
    nativeVirtualKeyCode: virtualKeyCode,
  });
  await send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: name,
    code,
    windowsVirtualKeyCode: virtualKeyCode,
    nativeVirtualKeyCode: virtualKeyCode,
  });
};

const shot = async (name) => {
  const image = await send("Page.captureScreenshot", { format: "png" });
  const file = join(OUT, `${name}.png`);
  writeFileSync(file, Buffer.from(image.data, "base64"));
  return file;
};

/* ---------------------------------------------------------------- the samples */

const DOOR = `[data-flow-entry="true"]`;
const CHOPPER_DOOR = `[data-create-relationship-trigger]`;

const CHOPPER = async () => {
  // `/dashboard/relationships`: the page's own toggle opens the chooser, the Radix select picks the
  // first template with the keyboard, and the band's button is the door.
  await clickFound(
    `[...document.querySelectorAll("button[aria-expanded]")].find((b) =>
      b.textContent.trim() === "Start a relationship" && b.getBoundingClientRect().width > 0)`,
    "Start a relationship toggle",
  );
  await waitFor(`!!document.querySelector("#relationship-template")`, "the chooser opens");
  await clickFound(`document.querySelector("#relationship-template")`, "template select");
  await waitFor(`!!document.querySelector('[role="option"]')`, "the template list opens");
  await key("ArrowDown", "ArrowDown", 40);
  await sleep(200);
  await key("Enter", "Enter", 13);
  await waitFor(
    `(() => { const b = document.querySelector("[data-create-relationship-trigger]"); return b !== null && !b.disabled; })()`,
    "Start the relationship becomes enabled",
  );
};

const SAMPLES = [
  {
    id: "dashboard-templates-1440",
    width: 1440,
    height: 1000,
    path: "/dashboard/templates",
    selector: DOOR,
  },
  {
    id: "templates-library-1440",
    width: 1440,
    height: 1000,
    path: "/templates/relationship",
    selector: DOOR,
  },
  {
    id: "template-detail-1440",
    width: 1440,
    height: 1000,
    path: `/templates/relationship/${SLUG}`,
    selector: `[data-template-detail-cta="create"]`,
  },
  {
    id: "relationships-chooser-1440",
    width: 1440,
    height: 1000,
    path: "/dashboard/relationships",
    before: CHOPPER,
    selector: CHOPPER_DOOR,
  },
  { id: "assessment-390", width: 390, height: 844, path: "/assessment", selector: DOOR },
  {
    id: "dashboard-templates-390",
    width: 390,
    height: 844,
    path: "/dashboard/templates",
    selector: DOOR,
  },
];

const results = [];

const ONLY = arg("only", null);
const RUN = ONLY === null ? SAMPLES : SAMPLES.filter((sample) => sample.id.includes(ONLY));

for (const sample of RUN) {
  pageErrors.length = 0;
  logs.length = 0;
  netLog.length = 0;
  // A fresh cookie jar per sample: the flow's draft lives in a cookie, and a draft left by the
  // previous sample would make this one advance into *that* template's flow. The auth cookies are
  // the only ones kept.
  await send("Network.clearBrowserCookies");
  await send("Network.setCookies", { cookies: jar });
  await send("Emulation.setDeviceMetricsOverride", {
    width: sample.width,
    height: sample.height,
    deviceScaleFactor: 1,
    mobile: sample.width < 600,
  });
  await send("Page.navigate", { url: `${BASE}${sample.path}` });
  await waitFor(`document.readyState === "complete"`, `${sample.id} loads`);
  // A chooser's door only exists once the chooser is open, so that runs before the wait.
  if (sample.before) {
    await waitFor(`!!document.querySelector("main button[aria-expanded]")`, `${sample.id} renders`);
    await sample.before();
  }
  await waitFor(
    `!!document.querySelector(${JSON.stringify(sample.selector)})`,
    `${sample.id} renders its door`,
  );

  /* The door is read before the press so "focus returned to the trigger" can be compared with the
     *same* control afterwards — the element is not marked, because a client-side attribute on a
     hydrating page is a hydration mismatch of the harness's own making. */
  const trigger = await evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(sample.selector)});
    if (el === null) return null;
    return { text: el.textContent.trim().slice(0, 40), href: el.getAttribute("href") };
  })()`);
  if (trigger === null) throw new Error(`${sample.id}: no door to press`);

  let opened = false;
  for (let attempt = 0; attempt < 5 && !opened; attempt += 1) {
    await clickFound(
      `document.querySelector(${JSON.stringify(sample.selector)})`,
      `${sample.id} door (attempt ${attempt + 1})`,
    );
    for (let i = 0; i < 15 && !opened; i += 1) {
      opened = await evaluate(
        `!!document.querySelector('[data-flow-mount="dialog"]') &&
         document.querySelector('[data-flow-mount=dialog]').getBoundingClientRect().height > 200`,
      );
      if (!opened) await sleep(200);
    }
  }
  if (!opened) {
    throw new Error(`${sample.id} never opened the dialog — ${pageErrors.slice(0, 3).join(" | ")}`);
  }
  await sleep(500);

  const openedState = await evaluate(`(() => {
    const dialog = document.querySelector('[data-flow-mount="dialog"]');
    const panel = document.querySelector('[data-stage-shell="true"]');
    const rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) }; };
    return {
      url: location.pathname,
      innerWidth: window.innerWidth,
      dialog: rect(dialog),
      panel: rect(panel),
      stageHeading: (document.querySelector("#create-stage-heading")?.textContent ?? "").trim(),
      pageHeadings: [...document.querySelectorAll("h1")].map((h) => h.textContent.trim()),
      fields: [...document.querySelectorAll('[data-flow-mount="dialog"] input')].map((i) => i.name).filter(Boolean),
      rail: (document.querySelector("[data-stage-shell] .sr-only")?.textContent ?? "").trim(),
    };
  })()`);

  const still = await shot(`${sample.id}-dialog`);

  /* Stage 1: fill the five required controls through the browser's own input events, then advance. */
  const fill = [
    ["initiatorFirst", "Avery"],
    ["initiatorLast", "Rowan"],
    ["counterpartyFirst", "Sam"],
    ["counterpartyLast", "Rivera"],
    // The counterparty's address is required by stage 1's own form (the invitation is mailed to it
    // at stage 5); a browser refuses the submit without it, which is how this sample learned that.
    ["email", "qa979-counterparty@alignsynch.test"],
  ];
  for (const [name, value] of fill) {
    // The draft cookie persists between runs (it is the flow's own state), so the field may already
    // hold a previous run's text: clear it the way React expects, then type the value.
    const ready = await evaluate(`(() => {
      const el = document.querySelector('[data-flow-mount="dialog"] input[name="${name}"]');
      if (!el) return false;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(el, "");
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.focus();
      return document.activeElement === el && el.value === "";
    })()`);
    if (!ready) throw new Error(`${sample.id}: no focusable input ${name}`);
    await send("Input.insertText", { text: value });
    await sleep(80);
  }
  const filled = await evaluate(`(() => {
    const value = (name) => document.querySelector('[data-flow-mount="dialog"] input[name="' + name + '"]')?.value ?? null;
    return { title: value("title"), initiatorFirst: value("initiatorFirst"), counterpartyLast: value("counterpartyLast") };
  })()`);
  const filledStill = await shot(`${sample.id}-stage1-filled`);

  await clickFound(
    `[...document.querySelectorAll('[data-flow-mount="dialog"] button[type="submit"]')].find((b) => b.textContent.trim().length > 0)`,
    `${sample.id} advance`,
  );
  let afterAdvance = null;
  for (let i = 0; i < 60; i += 1) {
    afterAdvance = await evaluate(`(() => {
      const dialog = document.querySelector('[data-flow-mount="dialog"]');
      const invalid = [...document.querySelectorAll('[data-flow-mount="dialog"] :invalid')].map((el) => el.name || el.tagName);
      return {
        path: location.pathname,
        search: location.search,
        dialog: dialog !== null,
        busy: dialog?.getAttribute("aria-busy") ?? null,
        invalid,
        title: document.querySelector('[data-flow-mount="dialog"] input[name="title"]')?.value ?? null,
      };
    })()`);
    if (/\/create\/mode$/.test(afterAdvance.path)) break;
    await sleep(200);
  }
  if (!/\/create\/mode$/.test(afterAdvance?.path ?? "")) {
    throw new Error(
      `${sample.id} did not advance — ${JSON.stringify({ filled, afterAdvance, netLog })}\npage errors: ${pageErrors.slice(0, 3).join(" | ")}`,
    );
  }
  await sleep(2500);
  const advanced = await evaluate(`(() => ({
    url: location.pathname,
    dialogMounted: !!document.querySelector('[data-flow-mount="dialog"]'),
    stageHeading: (document.querySelector("#create-stage-heading")?.textContent ?? "").trim(),
    pageStillMounted: [...document.querySelectorAll("h1")].length > 1,
  }))()`);

  /* Esc: measured, not asserted. A dismissal that does nothing is a finding, not a harness failure. */
  let closed = null;
  const pathTrace = [];
  const before = await evaluate("history.length");
  // Focus the frame first: an Escape is a key press *at the dialog*, and the advance left focus on
  // a submit button that no longer exists.
  await evaluate(
    `(() => {
      const frame = document.querySelector('[data-stage-shell="true"]');
      if (frame === null) return null;
      frame.setAttribute("tabindex", "-1");
      frame.focus();
      return document.activeElement?.getAttribute("data-stage-shell") ?? null;
    })()`,
  );
  await key("Escape", "Escape", 27, true);
  for (let i = 0; i < 16; i += 1) {
    const state = await evaluate(
      `({ path: location.pathname, dialog: !!document.querySelector('[data-flow-mount="dialog"]'), history: history.length })`,
    );
    pathTrace.push(`${i}:${state.path}:${state.dialog ? "open" : "closed"}:h${state.history}`);
    if (!state.dialog) {
      closed = { attempt: 1 };
      break;
    }
    await sleep(150);
  }
  if (closed === null) closed = { closedByEsc: false, historyBefore: before };

  /* Where the dismissal left the page — measured **before** any diagnostic, so the still and the
     numbers below describe the product's behaviour and not the harness's probing. The close is
     asynchronous (a pop, then a commit, then the shell's focus hand-back), so focus is *traced* for
     1.5 s and the settled reading is the recorded one: a single sample taken the instant the panel
     left would call a focus that lands a frame later "focus on body". */
  const focusTrace = [];
  let closedState = null;
  for (let i = 0; i < 15; i += 1) {
    closedState = await evaluate(`(() => {
      const active = document.activeElement;
      const trigger = document.querySelector(${JSON.stringify(sample.selector)});
      return {
        url: location.pathname,
        focusIsTrigger: trigger !== null && active === trigger,
        activeText: active === null ? null : active.textContent.trim().slice(0, 40),
        activeTag: active === null ? null : active.tagName.toLowerCase(),
        activeIsFlowEntry: active !== null && active.getAttribute("data-flow-entry") === "true",
        historyAfter: history.length,
      };
    })()`);
    focusTrace.push(`${i * 100}ms:${closedState.activeTag}:${closedState.focusIsTrigger}`);
    if (closedState.focusIsTrigger) break;
    await sleep(100);
  }
  closedState.focusTrace = focusTrace;
  const closedStill = await shot(`${sample.id}-after-esc`);

  /*
   * The one diagnostic, recorded only when the dismissal did nothing: can the browser's own Back
   * leave the stage? If it can, the address is real and the router's navigation is what was dropped
   * — which is what tells a reader this is a Next router behaviour and not a dead link.
   */
  let backDiagnostic = null;
  if (closedState.url !== sample.path) {
    await evaluate("history.back()");
    await sleep(1500);
    backDiagnostic = await evaluate(`(() => ({
      url: location.pathname,
      dialogOpen: !!document.querySelector('[data-flow-mount="dialog"]'),
    }))()`);
  }

  results.push({
    id: sample.id,
    viewport: `${sample.width}x${sample.height}`,
    origin: sample.path,
    trigger,
    opened: openedState,
    dialogStill: still,
    filled,
    filledStill,
    advanced,
    closed: { ...closedState, ...closed, pathTrace, backDiagnostic },
    closedStill,
    pageErrors: [...pageErrors],
    logs: [...logs],
    netLog: [...netLog],
  });
  console.log(
    sample.id,
    JSON.stringify({
      opened: openedState.url,
      advanced: advanced.url,
      closed: closedState.url,
      focus: closedState.focusIsTrigger,
    }),
  );
}

/* ---------------------------------------------------------------- the class that must not move */

const UNCHANGED = [
  {
    id: "marketing-relationship-types-1440",
    width: 1440,
    height: 1000,
    path: "/relationship-types",
    ready: `document.readyState === "complete" && document.querySelectorAll("a").length > 10`,
    find: `[...document.querySelectorAll("a")].find((a) => a.textContent.trim() === "Create Relationship")`,
    expectPath: /^\/(register|templates\/relationship)/,
  },
  {
    id: "assessments-empty-390",
    width: 390,
    height: 844,
    path: "/assessments",
    ready: `document.readyState === "complete" && document.body.innerText.length > 200`,
    find: `[...document.querySelectorAll("a")].find((a) => a.textContent.trim() === "Start a relationship")`,
    expectPath: /^\/(assessment|register|dashboard)/,
  },
];

const unchangedResults = [];
for (const entry of UNCHANGED) {
  await send("Emulation.setDeviceMetricsOverride", {
    width: entry.width,
    height: entry.height,
    deviceScaleFactor: 1,
    mobile: entry.width < 600,
  });
  await send("Page.navigate", { url: `${BASE}${entry.path}` });
  await waitFor(`document.readyState === "complete"`, `${entry.id} loads`);
  await waitFor(entry.ready, `${entry.id} renders`);
  await sleep(400);
  const before = await shot(`${entry.id}-page`);
  const found = await evaluate(`(() => {
    const el = ${entry.find};
    return el === null || el === undefined ? null : { text: el.textContent.trim().slice(0, 40), href: el.getAttribute("href") };
  })()`);
  let after = null;
  if (found !== null) {
    // A marketing door is a plain anchor on a crawlable page (no client router of ours involved in
    // the decision): press it from the element itself, so a sticky header over the card cannot turn
    // "it navigates" into "the harness missed".
    await evaluate(`(${entry.find})?.click()`);
    await sleep(2500);
    after = await evaluate(`(() => ({
      url: location.pathname,
      query: location.search,
      dialogMounted: !!document.querySelector('[data-flow-mount="dialog"]'),
    }))()`);
  }
  unchangedResults.push({
    id: entry.id,
    viewport: `${entry.width}x${entry.height}`,
    before,
    found,
    after,
    still: before,
  });
  console.log(entry.id, JSON.stringify({ found, after }));
}

const report = {
  base: BASE,
  slug: SLUG,
  capturedAt: new Date().toISOString(),
  samples: results,
  unchanged: unchangedResults,
};
writeFileSync(join(OUT, "capture-report.json"), JSON.stringify(report, null, 2));
console.log("\nreport:", join(OUT, "capture-report.json"));

ws.close();
chrome.kill("SIGKILL");
