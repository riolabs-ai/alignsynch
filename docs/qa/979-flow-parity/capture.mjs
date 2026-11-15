/**
 * #979 B — the shell behaves like a route: the four proofs the card asks for, measured.
 *
 * No browser driver in this tree: Chrome is launched with `--remote-debugging-port` and driven over
 * raw CDP, exactly as `docs/qa-979-flow-dialog/capture.mjs` and `docs/qa-971-tiles/capture.mjs` do.
 * The sign-in happens in **Node**, not in the page (the auth branch answers 403 INVALID_ORIGIN to a
 * browser-origin sign-in), and the cookies are installed with `Network.setCookie` before the first
 * navigation.
 *
 * It walks the flow the way a person does and records what the address said and what the document
 * did at every step, so each claim is a number in `report.json` and a still beside it:
 *
 *   `advance`    stage 1 → 2 → 3 from the dialog, with the address at each step;
 *   `backWalk`   three **browser Back** presses (`Page.navigateToHistoryEntry`, the same history
 *                navigation the Back button performs) — a stage back, a stage back, then the page
 *                the flow was opened from, with the dialog leaving only on the last one;
 *   `refresh`    the stage-3 address typed into the page and reloaded: the same stage, drawn as a
 *                page, with no dialog (the screenshot pair the card asks for);
 *   `keyboard`   focus inside the panel, twelve real `Tab` presses that never leave it, a focus
 *                aimed at the page that is pulled back, the scroll lock, `Esc`, and the focus the
 *                dismissal gives back to the Create control;
 *   `draft`      the draft stage 1 wrote is still there after `Esc` — the reopened flow shows it;
 *   `narrow`     at 390×844 the panel is the viewport (not a card), with no horizontal overflow.
 *
 *   node docs/qa/979-flow-parity/capture.mjs --base http://localhost:3001 --out docs/qa/979-flow-parity
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
};

const BASE = arg("base", "http://localhost:3001");
const OUT = arg("out", "docs/qa/979-flow-parity");
const DEBUG_PORT = Number(arg("port", "9362"));
const EMAIL = arg("email", "qa979-parity@alignsynch.test");
const PASSWORD = arg("password", "qa979-parity-passw0rd");

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
    name: "Riley QA",
    email: EMAIL,
    password: PASSWORD,
  });
  // The auth branch rate-limits repeated sign-ins; a wait is cheaper than a new account.
  for (let attempt = 0; attempt < 6 && res.status === 429; attempt += 1) {
    console.log("auth: 429, waiting 20s");
    await sleep(20_000);
    res = await post("/api/auth/sign-in/email", { email: EMAIL, password: PASSWORD });
  }
  if (res.status >= 300) {
    res = await post("/api/auth/sign-in/email", { email: EMAIL, password: PASSWORD });
  }
  cookies = res.headers.getSetCookie().map((c) => c.split(";")[0]);
  console.log(
    "auth:",
    res.status,
    cookies.map((c) => `${c.slice(0, c.indexOf("="))}(${c.length})`).join(" "),
  );
  if (res.status >= 300 || cookies.length === 0) process.exit(1);
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
    `--user-data-dir=/tmp/t979-parity-chrome-${DEBUG_PORT}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);

const endpoint = async () => {
  for (let i = 0; i < 60; i += 1) {
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
/** Page-side errors, so a client-side exception is printed instead of guessed at. */
const pageErrors = [];
ws.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.method === "Runtime.exceptionThrown") {
    pageErrors.push(message.params.exceptionDetails.exception?.description ?? "exception");
  }
  if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
    pageErrors.push(message.params.args.map((a) => a.value ?? a.description).join(" "));
  }
});

const viewport = (width, height) =>
  send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });

await viewport(1440, 1000);

const jar = cookies.map((cookie) => {
  const index = cookie.indexOf("=");
  return {
    name: cookie.slice(0, index),
    value: cookie.slice(index + 1),
    url: BASE,
    // Both cookies are `__Secure-` prefixed: Chrome refuses them without the attribute.
    secure: true,
    path: "/",
  };
});
await send("Network.setCookies", { cookies: jar });
console.log("cookies installed:", jar.map((c) => c.name).join(" "));

const waitFor = async (expression, label, attempts = 125) => {
  for (let i = 0; i < attempts; i += 1) {
    if (await evaluate(expression)) return true;
    await sleep(200);
  }
  throw new Error(`never became true: ${label}`);
};

/** A real pointer click at an element's centre — Radix listens to pointerdown, not `.click()`. */
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

const click = (selector) =>
  clickFound(`document.querySelector(${JSON.stringify(selector)})`, selector);

/** Click, then wait for the effect — retried, because the first click can land pre-hydration. */
const clickUntilFound = async (finder, readyExpression, label) => {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await clickFound(finder, label);
    for (let i = 0; i < 15; i += 1) {
      if (await evaluate(readyExpression)) return;
      await sleep(200);
    }
  }
  throw new Error(
    `never became true: ${label}\npage errors: ${pageErrors.slice(0, 3).join(" | ")}`,
  );
};

const key = async (name, code, virtualKeyCode) => {
  for (const type of ["keyDown", "keyUp"]) {
    await send("Input.dispatchKeyEvent", {
      type,
      key: name,
      code,
      windowsVirtualKeyCode: virtualKeyCode,
      nativeVirtualKeyCode: virtualKeyCode,
    });
  }
};

const pressTab = async (shift = false) => {
  for (const type of ["rawKeyDown", "keyUp"]) {
    await send("Input.dispatchKeyEvent", {
      type,
      key: "Tab",
      code: "Tab",
      windowsVirtualKeyCode: 9,
      nativeVirtualKeyCode: 9,
      modifiers: shift ? 8 : 0,
    });
  }
  await sleep(60);
};

/** `Esc`, as the keyboard sends it — the same dispatch `docs/qa-rel-detail-edit/stills.mjs` proves. */
const pressEscape = async () => {
  for (const type of ["keyDown", "keyUp"]) {
    await send("Input.dispatchKeyEvent", {
      type,
      key: "Escape",
      code: "Escape",
      windowsVirtualKeyCode: 27,
      nativeVirtualKeyCode: 27,
    });
  }
  await sleep(120);
};

/** What the document looks like from the outside: address, dialog, heading, focus. */
const snapshot = () =>
  evaluate(`(() => {
    const panel = document.querySelector('[data-stage-shell="true"]');
    const mount = document.querySelector('[data-flow-mount="dialog"]');
    const active = document.activeElement;
    const trigger = document.querySelector("[data-create-relationship-trigger]");
    const rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) }; };
    return {
      path: location.pathname + location.search,
      dialog: panel !== null,
      mount: mount !== null,
      title: (panel?.querySelector(".sr-only")?.textContent ?? "").trim() || null,
      rail: (panel?.textContent ?? "").match(/Stage \\d of 5/)?.[0] ?? null,
      headings: [...document.querySelectorAll("h1")].map((h) => h.textContent.trim()),
      activeTag: active?.tagName ?? null,
      activeText: (active?.textContent ?? "").trim().slice(0, 40),
      activeIsTrigger: trigger !== null && active === trigger,
      activeIsFallback:
        document.querySelector("[data-relationships-start-toggle]") !== null &&
        active === document.querySelector("[data-relationships-start-toggle]"),
      focusInsidePanel: panel !== null && active !== null && panel.contains(active),
      // The measured state of the page underneath: the chooser (and its Create control) is closed
      // by the intercepted render, so the trigger is not in the document while the dialog stands.
      triggerPresent: trigger !== null,
      fallbackPresent: document.querySelector("[data-relationships-start-toggle]") !== null,
      panel: rect(panel),
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      bodyOverflow: getComputedStyle(document.body).overflow,
      scrollX: Math.round(window.scrollX),
      scrollY: Math.round(window.scrollY),
      docScrollWidth: document.documentElement.scrollWidth,
      docScrollHeight: document.documentElement.scrollHeight,
    };
  })()`);

const shot = async (name) => {
  const data = await send("Page.captureScreenshot", { format: "png" });
  const file = join(OUT, name);
  writeFileSync(file, Buffer.from(data.data, "base64"));
  return file;
};

/** Set a control's value the way a person typing does: the native setter, then `input`. */
const type = async (selector, value) => {
  const ok = await evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return false;
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value").set.call(el, ${JSON.stringify(value)});
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  })()`);
  if (!ok) throw new Error(`no control for ${selector}`);
  await sleep(60);
};

const STEP = arg("step", "");

/* ---------------------------------------------------------------- the walk */

const report = { base: BASE, startedAt: new Date().toISOString() };
const stills = [];

const openChooser = async () => {
  // The chooser stays expanded across a dismissal — the page underneath never left — so opening it
  // twice is the second click that closes it. Only click when the select is not already there.
  if (await evaluate(`!!document.querySelector("#relationship-template")`)) return;
  const START_TOGGLE = `[...document.querySelectorAll("button[aria-expanded]")].find((b) =>
    b.textContent.trim() === "Start a relationship" && b.getBoundingClientRect().width > 0)`;
  await clickUntilFound(
    START_TOGGLE,
    `!!document.querySelector("#relationship-template") || !!document.querySelector("[data-relationship-create-empty]")`,
    "the chooser opens",
  );
  await click("#relationship-template");
  await waitFor(`!!document.querySelector('[role="option"]')`, "the template list opens");
  await key("ArrowDown", "ArrowDown", 40);
  await sleep(200);
  await key("Enter", "Enter", 13);
  await waitFor(
    `(() => { const b = document.querySelector("[data-create-relationship-trigger]"); return b !== null && !b.disabled; })()`,
    "Create relationship becomes enabled",
  );
};

const openFlow = async () => {
  await click("[data-create-relationship-trigger]");
  await waitFor(
    `!!document.querySelector('[data-flow-mount="dialog"]') &&
     document.querySelector('[data-flow-mount="dialog"]').getBoundingClientRect().height > 200`,
    "the dialog mounts over the page",
  );
  await sleep(400);
};

/** Fill stage 1 the way a person does, then advance with the stage's own submit. */
const fillStageOneAndAdvance = async () => {
  await waitFor(
    `!!document.querySelector('input[name="initiatorFirst"]')`,
    "stage 1 draws its fields",
  );
  await type('input[name="initiatorFirst"]', "Avery");
  await type('input[name="initiatorLast"]', "Quill");
  await type('input[name="counterpartyFirst"]', "Rowan");
  await type('input[name="counterpartyLast"]', "Vale");
  await type('input[name="email"]', "rowan.vale@alignsynch.test");
  const title = "Avery and Rowan, on trust";
  await type('input[name="title"]', title);
  await type('textarea[name="description"]', "What we want to understand about each other.");
  await clickFound(
    `[...document.querySelectorAll('[data-flow-mount="dialog"] button[type="submit"]')].pop()`,
    "stage 1's advance",
  );
  await waitFor(`location.pathname.endsWith("/create/mode")`, "stage 2 arrives");
  await sleep(400);
  return title;
};

const answerStageTwoAndAdvance = async () => {
  await waitFor(
    `[...document.querySelectorAll("[data-choice-group]")].length === 2`,
    "stage 2 draws its two groups",
  );
  const clicked = await evaluate(`(() => {
    const groups = [...document.querySelectorAll("[data-choice-group]")];
    const picked = [];
    for (const group of groups) {
      const radio = group.querySelector('input[type="radio"]');
      if (radio === null) continue;
      radio.click();
      picked.push({ group: group.getAttribute("data-choice-group"), value: radio.value });
    }
    return picked;
  })()`);
  await sleep(200);
  await clickFound(
    `[...document.querySelectorAll('[data-flow-mount="dialog"] button[type="submit"]')].pop()`,
    "stage 2's advance",
  );
  await waitFor(`location.pathname.endsWith("/create/aspects")`, "stage 3 arrives");
  await sleep(500);
  return clicked;
};

// 1. `/dashboard/relationships` → the dialog at stage 1 → stage 3.
await send("Page.navigate", { url: `${BASE}/dashboard/relationships` });
await waitFor(
  `document.readyState === "complete" && !!document.querySelector("main button[aria-expanded]")`,
  "the relationships page renders its Start a relationship control",
);
await openChooser();
report.beforeClick = await snapshot();
await openFlow();
report.opened = await snapshot();
report.stageOne = await snapshot();
report.draftTitle = await fillStageOneAndAdvance();
report.stageTwo = await snapshot();
report.stageTwoChoices = await answerStageTwoAndAdvance();
report.stageThree = await snapshot();
stills.push(await shot("1-stage3-in-dialog-1440.png"));

// 2. Browser Back, three times: two stages, then the page the flow was opened from.
report.backWalk = [];
for (const step of [1, 2, 3]) {
  const history = await send("Page.getNavigationHistory");
  const previous = history.entries[history.currentIndex - 1];
  if (previous === undefined) throw new Error(`no history entry behind step ${step}`);
  await send("Page.navigateToHistoryEntry", { entryId: previous.id });
  await sleep(1200);
  await waitFor(`document.readyState === "complete"`, `step ${step} finished navigating`);
  await sleep(600);
  report.backWalk.push({ step, target: previous.url.replace(BASE, ""), ...(await snapshot()) });
}

// 3. The refresh proof: type stage 3's address into the page and reload it.
const stageThreePath = report.stageThree.path;
await send("Page.navigate", { url: `${BASE}${stageThreePath}` });
await waitFor(
  `document.readyState === "complete" && !!document.querySelector("#create-stage-heading")`,
  "the stage-3 address renders",
);
await sleep(800);
report.refresh = await snapshot();
stills.push(await shot("2-stage3-as-a-page-1440.png"));

// 4. Back to the dashboard and in again — and forward to stage 3, because the dismissal has to be
//    proved from a *deep* stage: one pop per entry the flow pushed, not a single back press.
await send("Page.navigate", { url: `${BASE}/dashboard/relationships` });
await waitFor(
  `document.readyState === "complete" && !!document.querySelector("main button[aria-expanded]")`,
  "the relationships page comes back",
);
await openChooser();
await openFlow();
const indexAtOpen = await evaluate(`(() => window.navigation?.currentEntry?.index ?? null)()`);
report.reopenedStageOne = await snapshot();
report.draftAfterReopen = await evaluate(
  `document.querySelector('input[name="title"]')?.value ?? null`,
);
// The draft the first pass wrote fills stage 1, so advancing is a press and not a form fill.
await clickFound(
  `[...document.querySelectorAll('[data-flow-mount="dialog"] button[type="submit"]')].pop()`,
  "stage 1's advance (draft already written)",
);
await waitFor(`location.pathname.endsWith("/create/mode")`, "stage 2 arrives again");
await sleep(400);
await answerStageTwoAndAdvance();
report.keyboardStageThree = await snapshot();

// 5. The keyboard walk, at stage 3.
const keyboard = {};
keyboard.onMount = await snapshot();

// Twelve real Tab presses: focus must never land outside the panel.
keyboard.tabWalk = [];
for (let i = 0; i < 12; i += 1) {
  await pressTab();
  const at = await evaluate(`(() => {
    const panel = document.querySelector('[data-stage-shell="true"]');
    const active = document.activeElement;
    return {
      tag: active?.tagName ?? null,
      label: (active?.getAttribute("aria-label") || active?.textContent || "").trim().slice(0, 30),
      insidePanel: panel !== null && active !== null && panel.contains(active),
    };
  })()`);
  keyboard.tabWalk.push(at);
}
keyboard.tabWalkAllInside = keyboard.tabWalk.every((entry) => entry.insidePanel);

// A focus aimed at the page underneath is pulled back into the panel.
keyboard.focusAimedOutside = await evaluate(`(() => {
  const link = document.querySelector("main a[href]") ?? document.querySelector("a[href]");
  if (link === null) return { attempted: false };
  link.focus();
  const panel = document.querySelector('[data-stage-shell="true"]');
  return {
    attempted: true,
    landedInsidePanel: panel !== null && panel.contains(document.activeElement),
    activeTag: document.activeElement?.tagName ?? null,
  };
})()`);

// The page behind the dialog cannot scroll while it stands.
keyboard.scrollLock = await evaluate(`(() => {
  const before = Math.round(window.scrollY);
  window.scrollTo(0, before + 400);
  const after = Math.round(window.scrollY);
  return { bodyOverflow: getComputedStyle(document.body).overflow, before, after, moved: after !== before };
})()`);

// `Esc` closes it: one pop per entry the flow pushed, from stage 3 straight to the page it is over,
// with focus handed to the control that leads back into the flow.
await evaluate(
  `(() => { const el = document.querySelector('[data-stage-shell="true"] input, [data-stage-shell="true"] button'); el?.focus(); return document.activeElement?.tagName ?? null; })()`,
);
keyboard.beforeEscape = await snapshot();
const indexAtEscape = await evaluate(`(() => window.navigation?.currentEntry?.index ?? null)()`);
keyboard.entriesSinceOrigin = indexAtEscape === null ? null : indexAtEscape - indexAtOpen;
keyboard.escape = [];
for (let attempt = 1; attempt <= 3; attempt += 1) {
  await pressEscape();
  await sleep(900);
  const after = await snapshot();
  keyboard.escape.push({
    attempt,
    dialog: after.dialog,
    path: after.path,
    focusInsidePanel: after.focusInsidePanel,
    activeTag: after.activeTag,
    activeText: after.activeText,
    activeIsTrigger: after.activeIsTrigger,
    activeIsFallback: after.activeIsFallback,
  });
  if (!after.dialog) break;
}
await sleep(600);
keyboard.afterEscape = await snapshot();
report.keyboard = keyboard;
writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 2));

// 6. The draft stage 1 wrote survives the dismissal: reopening shows what was typed.
await openChooser();
await openFlow();
report.draftAfterEscape = {
  titleField: await evaluate(`document.querySelector('input[name="title"]')?.value ?? null`),
  counterpartyFirst: await evaluate(
    `document.querySelector('input[name="counterpartyFirst"]')?.value ?? null`,
  ),
  expectedTitle: report.draftTitle,
  ...(await snapshot()),
};

// 7. Narrow: 390, the same shell, full-bleed.
await viewport(390, 844);
await sleep(700);
report.narrow = await snapshot();
// Full-bleed is the panel's own geometry; this is the other half — nothing *inside* it is wider
// than the viewport, and the page behind it is locked rather than squeezing the panel.
report.narrow.overflow = await evaluate(`(() => {
  const panel = document.querySelector('[data-stage-shell="true"]');
  if (panel === null) return null;
  const box = panel.getBoundingClientRect();
  const wider = [...panel.querySelectorAll("*")].filter((el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && Math.round(r.right) > Math.round(box.right) + 1;
  });
  const scroller = [...panel.children].find((c) => getComputedStyle(c).overflowY !== "visible");
  return {
    panel: { width: Math.round(box.width), height: Math.round(box.height), x: Math.round(box.x), y: Math.round(box.y) },
    viewport: { width: window.innerWidth, height: window.innerHeight },
    fullBleed: Math.round(box.width) === window.innerWidth && Math.round(box.height) === window.innerHeight && Math.round(box.x) === 0 && Math.round(box.y) === 0,
    elementsWiderThanPanel: wider.slice(0, 5).map((el) => el.tagName + "." + String(el.className).slice(0, 40)),
    scrollerClientWidth: scroller?.clientWidth ?? null,
    scrollerScrollWidth: scroller?.scrollWidth ?? null,
    documentScrollWidth: document.documentElement.scrollWidth,
    pageScrollLocked: getComputedStyle(document.body).overflow,
    widestInDocument: [...document.querySelectorAll("*")]
      .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1)
      .slice(0, 8)
      .map((el) => ({
        tag: el.tagName,
        cls: String(el.className).slice(0, 50),
        right: Math.round(el.getBoundingClientRect().right),
        width: Math.round(el.getBoundingClientRect().width),
        insidePanel: panel.contains(el),
      })),
  };
})()`);
stills.push(await shot("3-dialog-390-full-bleed.png"));

// The page behind, with the dialog gone, at the same width — so "the document is wider than 390"
// is attributed to the page and not to the dialog's own content.
await pressEscape();
await sleep(1200);
report.narrowPageOnly = await evaluate(`(() => ({
  path: location.pathname,
  dialog: document.querySelector('[data-flow-mount="dialog"]') !== null,
  documentScrollWidth: document.documentElement.scrollWidth,
  innerWidth: window.innerWidth,
}))()`);

report.stills = stills;
report.pageErrors = pageErrors;
report.finishedAt = new Date().toISOString();
writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

ws.close();
chrome.kill("SIGKILL");
if (STEP === "advance-only") process.exit(0);
