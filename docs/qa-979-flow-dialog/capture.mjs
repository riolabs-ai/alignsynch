/**
 * #979 B — capture the create flow's dialog open over `/dashboard/relationships` at 1440.
 *
 * No browser driver in this tree: Chrome is launched with `--remote-debugging-port` and driven over
 * raw CDP, exactly as `docs/qa-971-tiles/capture.mjs` does. The sign-in is done from **Node**, not
 * from the page (the auth branch answers 403 INVALID_ORIGIN to a browser-origin sign-in), and the
 * cookies are installed with `Network.setCookie` before the first navigation.
 *
 * The still is accompanied by the numbers that make it readable: the mount marker, the URL after the
 * click, the panel's rect at 1440, the rail's text and the stage heading — so "a real stage is in the
 * dialog" is a measurement, not a claim about a picture.
 *
 *   node flow979-capture.mjs --base http://localhost:3001 --out <dir>
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
};

const BASE = arg("base", "http://localhost:3001");
const OUT = arg("out", ".");
const DEBUG_PORT = Number(arg("port", "9361"));
const EMAIL = arg("email", "qa979-capture@alignsynch.test");
const PASSWORD = arg("password", "qa979-capture-passw0rd");

mkdirSync(OUT, { recursive: true });

/* ---------------------------------------------------------------- sign in, from Node */

import { existsSync, readFileSync } from "node:fs";

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
    name: "Avery QA",
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
    `--user-data-dir=/tmp/t979-chrome-${DEBUG_PORT}`,
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
await send("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
});

const jar = cookies.map((cookie) => {
  const index = cookie.indexOf("=");
  return {
    name: cookie.slice(0, index),
    value: cookie.slice(index + 1),
    url: BASE,
    // Both cookies are `__Secure-` prefixed: Chrome refuses them without the attribute, which is
    // what "Sanitizing cookie failed" was. `localhost` counts as a trustworthy origin, so the
    // `http://` URL is accepted.
    secure: true,
    path: "/",
  };
});
await send("Network.setCookies", { cookies: jar });
console.log("cookies installed:", jar.map((c) => c.name).join(" "));

const waitFor = async (expression, label, attempts = 100) => {
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
  const state = await evaluate(`(() => {
    const el = ${finder};
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return JSON.stringify({
      label: ${JSON.stringify(label)},
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      ariaExpanded: el.getAttribute("aria-expanded"),
      hit: hit === null ? null : hit.tagName + "." + (hit.className || "").toString().slice(0, 60),
      hitIsTarget: hit === el || el.contains(hit),
    });
  })()`);
  throw new Error(
    `never became true: ${label} — ${state}\npage errors: ${pageErrors.slice(0, 3).join(" | ")}`,
  );
};

await send("Page.navigate", { url: `${BASE}/dashboard/relationships` });
await waitFor(
  `document.readyState === "complete" && !!document.querySelector("main button[aria-expanded]")`,
  "the relationships page renders its Start a relationship control",
);
console.log(
  "toggles:",
  JSON.stringify(
    await evaluate(`[...document.querySelectorAll("button[aria-expanded]")].map((el, i) => {
      const r = el.getBoundingClientRect();
      return { i, text: el.textContent.trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) };
    })`),
  ),
);
console.log("page url:", await evaluate("location.pathname"));

/* The page's own toggle opens the chooser (#913): the Create control lives inside it. The shell's
   header also carries `aria-expanded` buttons, so the toggle is found by its own label and a real
   box — the first match, the mobile menu, is 24px of chrome with no text. */
const START_TOGGLE = `[...document.querySelectorAll("button[aria-expanded]")].find((b) =>
  b.textContent.trim() === "Start a relationship" && b.getBoundingClientRect().width > 0)`;
await clickUntilFound(
  START_TOGGLE,
  `!!document.querySelector("#relationship-template") || !!document.querySelector("[data-relationship-create-empty]")`,
  "the chooser opens",
);

/* The chooser: open the Radix select and take the first option with the keyboard, which is the path
   the primitive guarantees — a synthetic pointer click on a portalled item depends on where the
   content lands and has already failed here once. */
await click("#relationship-template");
await waitFor(`!!document.querySelector('[role="option"]')`, "the template list opens");
const key = async (name, code) => {
  for (const type of ["keyDown", "keyUp"]) {
    await send("Input.dispatchKeyEvent", {
      type,
      key: name,
      code,
      windowsVirtualKeyCode: name === "Enter" ? 13 : 40,
      nativeVirtualKeyCode: name === "Enter" ? 13 : 40,
    });
  }
};
await key("ArrowDown", "ArrowDown");
await sleep(200);
await key("Enter", "Enter");
const chooserState = await evaluate(`(() => {
  const trigger = document.querySelector("#relationship-template");
  const button = document.querySelector("[data-create-relationship-trigger]");
  return {
    triggerText: trigger?.textContent?.trim() ?? null,
    ariaExpanded: trigger?.getAttribute("aria-expanded") ?? null,
    options: document.querySelectorAll('[role="option"]').length,
    optionText: document.querySelector('[role="option"]')?.textContent?.trim() ?? null,
    buttonExists: button !== null,
    buttonDisabled: button?.disabled ?? null,
    empty: !!document.querySelector("[data-relationship-create-empty]"),
  };
})()`);
console.log("chooser state:", JSON.stringify(chooserState));
await waitFor(
  `(() => { const b = document.querySelector("[data-create-relationship-trigger]"); return b !== null && !b.disabled; })()`,
  "Create relationship becomes enabled",
);

/* The click this card is about: it opens the flow over the page it was pressed on. */
const beforeUrl = await evaluate("location.pathname");
await click("[data-create-relationship-trigger]");
await waitFor(
  `!!document.querySelector('[data-flow-mount="dialog"]') &&
   document.querySelector("[data-flow-mount=dialog]").getBoundingClientRect().height > 200`,
  "the dialog mounts over the page",
);
await sleep(600);

const measured = await evaluate(`(() => {
  const dialog = document.querySelector("[data-flow-mount=\\"dialog\\"]");
  const panel = document.querySelector("[data-stage-shell=\\"true\\"]");
  const heading = document.querySelector("#create-stage-heading");
  const rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) }; };
  const stageText = (document.querySelector("[data-stage-shell] .sr-only")?.textContent ?? "").trim();
  return {
    url: location.pathname,
    innerWidth: window.innerWidth,
    mountMarker: dialog !== null,
    dialog: rect(dialog),
    panel: rect(panel),
    heading: heading?.textContent?.trim() ?? null,
    railTitle: stageText,
    // The page the flow was pressed on is still in the document, under the panel.
    pageHeadings: [...document.querySelectorAll("h1")].map((h) => h.textContent.trim()),
    pageStillMounted: [...document.querySelectorAll("h1")].some(
      (h) => h.textContent.trim() === "My Relationships",
    ),
    fieldLabels: [...document.querySelectorAll("[data-flow-mount=\\"dialog\\"] label")].map((l) => l.textContent.trim()),
  };
})()`);

const shot = await send("Page.captureScreenshot", { format: "png" });
const file = join(OUT, "flow-dialog-relationships-1440.png");
writeFileSync(file, Buffer.from(shot.data, "base64"));

const report = { base: BASE, beforeUrl, ...measured, still: file };
writeFileSync(join(OUT, "flow-dialog-report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));

ws.close();
chrome.kill("SIGKILL");
