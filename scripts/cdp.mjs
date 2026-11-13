#!/usr/bin/env node
/**
 * scripts/cdp.mjs — the browser client, shared by every harness that needs one.
 *
 * There is **no Playwright and no Puppeteer in this repo**, and adding one is not on the table: raw
 * Chrome DevTools Protocol over a `WebSocket` is enough, because Node 24 has a global `WebSocket`.
 * This module is the one copy of that client. It was lifted out of `scripts/demo-flow.mjs` (#945)
 * when the release atlas needed the same driver — two hand-rolled sessions would have been two
 * places for the screenshot geometry to drift.
 *
 *   scripts/demo-flow.mjs   the demo walk (transcript + stills)
 *   scripts/qa-atlas.mjs    the release atlas (every registered route, three widths)
 *
 * ## The two CDP details this module exists to keep
 *
 *   * `Page.captureScreenshot` with a `clip` below the fold returns a **blank frame**, and
 *     `captureBeyondViewport` alone still frames only the viewport. So a full-page shot resizes the
 *     viewport to the measured document height first and restores it afterwards.
 *   * `Emulation.setDeviceMetricsOverride` is what makes a width a fact rather than a hope. Every
 *     helper here takes the width from the configured viewport, never from the window Chrome
 *     happened to open with.
 *
 * ## Configuration
 *
 * `configureCdp({...})` is called once by each entry point, before `launchChrome()`. Defaults come
 * from the environment so an ad-hoc script needs no ceremony:
 *
 *   CHROME_BIN   the browser binary       (default /usr/bin/google-chrome)
 *   CDP_PORT     the debugging port       (default 9455)
 *   CDP_WIDTH    the emulated width       (default 1440)
 *   CDP_HEIGHT   the emulated height      (default 900)
 *
 * `base` is the origin `navigate()` resolves paths against; a harness that drives one server sets it
 * once. Nothing here reads the clock, the network (beyond the browser) or the repository.
 */
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const state = {
  chrome: process.env.CHROME_BIN ?? "/usr/bin/google-chrome",
  port: Number(process.env.CDP_PORT ?? 9455),
  width: Number(process.env.CDP_WIDTH ?? 1440),
  height: Number(process.env.CDP_HEIGHT ?? 900),
  base: null,
  process: null,
};

/**
 * Point the client at a binary, a port, a viewport and an origin.
 *
 * Only keys that are passed are changed, so a caller can override one value without restating the
 * rest. `base` has no sensible default on purpose: an origin written from memory is how a harness
 * screenshots the wrong server.
 */
export function configureCdp({ chrome, port, width, height, base } = {}) {
  if (chrome !== undefined) state.chrome = chrome;
  if (port !== undefined) state.port = port;
  if (width !== undefined) state.width = width;
  if (height !== undefined) state.height = height;
  if (base !== undefined) state.base = base;
  return { ...state };
}

/** The configured viewport — what a still's own name should quote. */
export function viewport() {
  return { width: state.width, height: state.height };
}

/**
 * Start headless Chrome and wait until the debugging port answers.
 *
 * The user-data directory is made under the OS temp dir and **never under the repo**: a Chrome
 * profile is ~1 200 files, and one left in `docs/` makes `biome check` die on its own gitignore walk
 * (`path is expected to be under the root`) — a red gate for a scratch directory nobody meant to
 * commit.
 */
export async function launchChrome() {
  if (!existsSync(state.chrome)) throw new Error(`no Chrome at ${state.chrome} — set CHROME_BIN`);
  const profile = mkdtempSync(join(tmpdir(), "cdp-profile-"));
  state.process = spawn(
    state.chrome,
    [
      "--headless=new",
      `--remote-debugging-port=${state.port}`,
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--hide-scrollbars",
      "--force-device-scale-factor=1",
      `--window-size=${state.width},${state.height}`,
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  state.process.stderr.on("data", () => {});

  // `/json/version` is the readiness signal: the port is bound before the page target exists.
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${state.port}/json/version`);
      if (response.ok) return;
    } catch {
      // Not listening yet.
    }
    await sleep(100);
  }
  throw new Error(`Chrome did not answer on ${state.port} within 10 s`);
}

export function stopChrome() {
  if (state.process !== null && state.process.exitCode === null) state.process.kill("SIGTERM");
  state.process = null;
}

async function json(path) {
  const response = await fetch(`http://127.0.0.1:${state.port}${path}`);
  return await response.json();
}

/**
 * A session-scoped CDP connection to the page target.
 *
 * **Targets are auto-attached, because one screen in the flow is not in this document.** Stage 5's
 * card step mounts the provider's own checkout in a cross-origin iframe (#911). Same-origin policy
 * hides its DOM from `Runtime.evaluate` on the page target, and a driver that cannot type into the
 * card cannot prove the payment step ran — so every sub-target is attached flat and reachable by
 * `sessionId`. `waitForDebuggerOnStart: false` keeps a freshly attached target running; nothing here
 * pauses one.
 *
 * Returns the client, `{ send, close, sessions, targets, contexts }`. `send` is the only function a
 * caller normally needs; the three maps are for a harness that has to walk into a frame.
 */
export async function attach({ onEvent } = {}) {
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
    // Every event is offered to the caller before this session interprets it: a harness that has to
    // assert on the console or on a document's response status needs the raw stream, and nothing
    // here should have to grow a listener of its own to get it.
    if (message.method !== undefined && onEvent !== undefined) onEvent(message);
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
      socket.send(
        JSON.stringify({ id, method, params, ...(sessionId === undefined ? {} : { sessionId }) }),
      );
    });

  await send("Target.setAutoAttach", {
    autoAttach: true,
    waitForDebuggerOnStart: false,
    flatten: true,
  });

  return { send, close: () => socket.close(), sessions, targets, contexts };
}

/** Runs an expression in the page and returns its JSON value. */
export async function evaluate(send, expression) {
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
export async function waitFor(send, expression, { timeout = 20000, label = expression } = {}) {
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
 * Hand a browser a session another process obtained.
 *
 * The demo branch's auth answers `403 INVALID_ORIGIN` to a **browser** sign-in on a loopback
 * preview (`lib/auth/`'s trusted-domain list is the branch's, not this tree's), while the same
 * POST from Node answers 200 — the trap `references/qa-stills.md` records. So a harness that needs
 * a signed-in screen signs in server-side and adopts the cookies, which is also the only way to do
 * it without the credential ever entering the page.
 *
 * `cookies` are the raw `Set-Cookie` header values. Nothing here prints or stores a value.
 */
export async function adoptSessionCookies(send, base, cookies) {
  if (cookies.length === 0) throw new Error("adoptSessionCookies: the sign-in returned no cookie");
  for (const raw of cookies) {
    const [pair] = raw.split(";");
    const index = pair.indexOf("=");
    if (index <= 0) continue;
    const name = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    const result = await send("Network.setCookie", {
      name,
      value,
      url: base,
      path: "/",
      httpOnly: true,
      // A `__Secure-` cookie is only set over a trustworthy origin; `127.0.0.1` is one, and Chrome
      // rejects it on any other http origin — which is the failure this throws instead of hiding.
      secure: true,
      sameSite: "Lax",
    });
    if (result?.success === false) {
      throw new Error(`adoptSessionCookies: Chrome refused the ${name} cookie for ${base}`);
    }
  }
}

/**
 * Is the demo PIN gate drawn? Navigates to `/demo` and reports whether the field is there.
 *
 * Split into three steps rather than one `signIn()` so a harness that records each step (a
 * transcript, an atlas row) can write its own entries between them — the sequence stays in one
 * place, the bookkeeping does not.
 */
export async function demoGateIsOpen(send) {
  await navigate(send, "/demo");
  return (
    (await text(send)).includes("demo PIN") ||
    (await evaluate(send, `!!document.querySelector("#demo-pin")`))
  );
}

/** Type the PIN and wait for `/login`. The password never leaves the credential store. */
export async function submitDemoPin(send) {
  const pin = process.env.DEMO_PIN;
  if (pin === undefined || pin.trim() === "") {
    throw new Error("DEMO_PIN is not set — the demo sign-in is the one door a driver may use");
  }
  await fill(send, "#demo-pin", pin);
  await click(send, "form button[type=submit]");
  await waitFor(send, `location.pathname === "/login"`, {
    timeout: 25000,
    label: "the PIN to unlock /login",
  });
}

/** Press one of `/login`'s three demo role buttons. Returns the role that was pressed. */
export async function chooseDemoRole(send, role) {
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
  return role;
}

/** Fill a control the way a keyboard does, then prove the value landed.
 *
 * Focus and `Input.insertText` is a real typing path: the browser fires `input` before the value
 * exists, which is what a React controlled input listens for. The native setter is the fallback for
 * a control that `insertText` cannot reach (a `<select>`, a masked field that swallows keys); it
 * dispatches the same events React listens for. Either way the verdict is the same question —
 * `el.value === value` — so the transcript never claims a value the page did not take.
 */
export async function fill(send, selector, value) {
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
export async function click(
  send,
  selector,
  { navigate: goesSomewhere = true, timeout = 25000 } = {},
) {
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
  if (!goesSomewhere) return before;
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

export async function url(send) {
  try {
    return await evaluate(send, "location.href");
  } catch {
    return "about:blank";
  }
}

/**
 * Navigate to a path on the configured base, and wait for the document plus two frames.
 *
 * Two frames, so hydration has run and a client panel has measured itself before any shutter — the
 * difference between a still of the app and a still of the app's skeleton.
 */
export async function navigate(send, path) {
  if (state.base === null) throw new Error("cdp: `base` is not configured — call configureCdp()");
  await send("Page.navigate", { url: `${state.base}${path}` });
  await waitFor(send, `document.readyState === "complete"`, { timeout: 30000, label: path });
  await evaluate(send, "new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))");
  await sleep(250);
}

/** The page's own words, normalised — the one probe most assertions read. */
export async function text(send) {
  return await evaluate(send, `document.body.innerText.replace(/\\s+/g, " ").trim()`);
}

/**
 * The screen at the configured width, as tall as the document.
 *
 * `captureScreenshot` frames the viewport, so the viewport is set to the measured height first and
 * restored afterwards — otherwise every later assertion runs at the height of the last shutter.
 * Returns the PNG bytes' sha256 and the pixel size the frame was taken at.
 */
export async function shutter(send, file) {
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
    width: state.width,
    height: Math.min(height, 6000),
    deviceScaleFactor: 1,
    mobile: false,
  });
  await sleep(250);
  const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
  const bytes = Buffer.from(shot.data, "base64");
  writeFileSync(file, bytes);
  await send("Emulation.setDeviceMetricsOverride", {
    width: state.width,
    height: state.height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  return {
    sha256: createHash("sha256").update(bytes).digest("hex"),
    width: state.width,
    height: Math.min(height, 6000),
  };
}
