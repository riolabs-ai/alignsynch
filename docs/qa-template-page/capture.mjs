#!/usr/bin/env node
/**
 * `docs/qa-template-page/` — the stills for #1259, with the asserts written down.
 *
 * The screen under review is `/templates/relationship/<slug>`: the member's own template page,
 * inside the app shell. Two things have to be proven by pixels rather than by prose, and both are
 * routing-shaped, so a suite cannot carry them:
 *
 *   1. **The address answers 200 and not a 308.** It used to be a permanent redirect into the
 *      public marketing catalogue; this script asks over HTTP first (`status` in the report) and
 *      only then opens the same URL in a browser.
 *   2. **It renders inside the shell at both widths, with no horizontal overflow.** `<aside>`
 *      measured at a real width is the rail; `scrollWidth === clientWidth` at 390 and 1280 is the
 *      no-overflow claim the card's acceptance names.
 *
 * Everything is asserted **before** each shutter and written into `capture-report.json` beside the
 * images — a still is the reviewer's evidence, never the claim.
 *
 * Usage, from a worktree whose tree contains the commit under review:
 *
 *   ~/.hermes/profiles/alignsynch/bin/withenv.sh <main-checkout> \
 *     bash -c 'cd <worktree> && exec node24.sh pnpm dev --port 4317 --hostname 127.0.0.1'
 *   node docs/qa-template-page/capture.mjs            # BASE_URL defaults to http://localhost:4317
 *
 * `localhost`, not `127.0.0.1`: the demo branch trusts the hostname it was configured with, and the
 * other spelling answers `403 INVALID_ORIGIN` on the sign-up. The cookies the sign-up returns are
 * handed to Chrome over CDP, because the branch refuses a browser `Origin` for the same call.
 */
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:4317";
const OUT = process.env.OUT_DIR ?? "docs/qa-template-page";
const WIDTHS = [390, 1280];
const DEBUG_PORT = Number(process.env.CDP_PORT ?? 9333);
const EMAIL = `qa-template-page-${Date.now()}@example.test`;
const PASSWORD = "Qa-Capture-2026!";
const SECRET_PATTERNS = [/DATABASE_URL/, /postgres:\/\//, /npg_/, /sk_test/];

/* ── the app, over HTTP ──────────────────────────────────────────────────────────────────── */

const cookies = new Map();

function absorb(response) {
  for (const raw of response.headers.getSetCookie?.() ?? []) {
    const pair = raw.split(";")[0] ?? "";
    const index = pair.indexOf("=");
    if (index === -1) continue;
    const name = pair.slice(0, index);
    const value = pair.slice(index + 1);
    if (value === "") cookies.delete(name);
    else cookies.set(name, value);
  }
}

function cookieHeader() {
  return [...cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

async function get(path) {
  const response = await fetch(`${BASE_URL}${path}`, {
    redirect: "manual",
    headers: { cookie: cookieHeader() },
  });
  absorb(response);
  return {
    status: response.status,
    location: response.headers.get("location"),
    html: await response.text(),
  };
}

async function signUp() {
  const response = await fetch(`${BASE_URL}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE_URL },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, name: "QA Capture" }),
  });
  absorb(response);
  const body = await response.text();
  if (response.status !== 200) {
    throw new Error(`sign-up answered ${response.status}: ${body.slice(0, 160)}`);
  }
  return JSON.parse(body)?.user?.id ?? null;
}

/* ── chrome, over the DevTools protocol ──────────────────────────────────────────────────── */

async function browserSocket() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
      const { webSocketDebuggerUrl } = await response.json();
      if (webSocketDebuggerUrl) return webSocketDebuggerUrl;
    } catch {
      /* not listening yet */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`chrome never answered on ${DEBUG_PORT}`);
}

/** A CDP session: one WebSocket, request ids, and a listener per awaited event. */
function connect(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  const listeners = new Map();
  let nextId = 0;

  const ready = new Promise((resolve, reject) => {
    socket.addEventListener("open", () => resolve());
    socket.addEventListener("error", () => reject(new Error("chrome socket failed")));
  });

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id !== undefined && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(`${message.error.message} (${message.error.code})`));
      else resolve(message.result);
      return;
    }
    for (const listener of listeners.get(message.method) ?? []) listener(message.params);
  });

  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      nextId += 1;
      const id = nextId;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });

  const once = (method) =>
    new Promise((resolve) => {
      const list = listeners.get(method) ?? [];
      const listener = (params) => {
        listeners.set(
          method,
          (listeners.get(method) ?? []).filter((entry) => entry !== listener),
        );
        resolve(params);
      };
      listeners.set(method, [...list, listener]);
    });

  return { ready, send, once, close: () => socket.close() };
}

/* ── the run ─────────────────────────────────────────────────────────────────────────────── */

const report = {
  takenAt: new Date().toISOString(),
  baseUrl: BASE_URL,
  account: EMAIL,
  widths: WIDTHS,
  slug: null,
  http: {},
  stills: [],
  checks: [],
};

function check(name, ok, detail) {
  report.checks.push({ name, ok, detail: ok ? "pass" : detail });
  if (!ok) throw new Error(`assertion failed: ${name} — ${detail}`);
}

const profile = mkdtempSync(join(tmpdir(), "qa-template-page-"));
const chrome = spawn(
  "google-chrome",
  [
    "--headless=new",
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "about:blank",
  ],
  { stdio: "ignore" },
);

try {
  const userId = await signUp();
  report.accountId = userId;

  /** The shelf, as the member sees it: the page's address is read off the card, not written here. */
  const shelf = await get("/dashboard/templates");
  check("the shelf answers for this account", shelf.status === 200, `status ${shelf.status}`);
  const slugs = [...shelf.html.matchAll(/href="\/templates\/relationship\/([a-z0-9-]+)"/g)].map(
    (match) => match[1],
  );
  check("the shelf draws the View Details link", slugs.length > 0, `${slugs.length} link(s)`);
  const slug = slugs.includes("brother-sister") ? "brother-sister" : slugs[0];
  report.slug = slug;
  report.shelfSlugs = [...new Set(slugs)].slice(0, 10);

  const path = `/templates/relationship/${slug}`;
  report.http.path = path;

  /** 1 — the address answers, and it is not the 308 that used to eject the member. */
  const before = await get(path);
  report.http.status = before.status;
  report.http.location = before.location ?? null;
  check("the page answers 200, not a redirect", before.status === 200, `status ${before.status}`);
  check(
    "no 308 Location header",
    before.location === undefined || before.location === null,
    String(before.location),
  );
  check(
    "the server-rendered page is the template page",
    before.html.includes("data-template-page="),
    "marker absent",
  );
  check("it renders inside the shell", before.html.includes("<aside"), "no aside in the document");
  for (const pattern of SECRET_PATTERNS) {
    check("no environment value in the HTML", !pattern.test(before.html), String(pattern));
  }

  const { webSocketDebuggerUrl } = await (
    await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`)
  ).json();
  const browser = connect(webSocketDebuggerUrl);
  await browser.ready;

  const { targetId } = await browser.send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await browser.send("Target.attachToTarget", { targetId, flatten: true });
  const send = (method, params) => browser.send(method, params, sessionId);

  await send("Page.enable");
  await send("Network.enable");
  await send("Runtime.enable");
  for (const [name, value] of cookies.entries()) {
    await send("Network.setCookie", {
      name,
      value,
      url: BASE_URL,
      path: "/",
      secure: true,
      httpOnly: true,
    });
  }

  for (const width of WIDTHS) {
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height: 900,
      deviceScaleFactor: 2,
      mobile: width < 500,
    });

    const loaded = browser.once("Page.loadEventFired");
    await send("Page.navigate", { url: `${BASE_URL}${path}` });
    await loaded;

    const measured = await send("Runtime.evaluate", {
      returnByValue: true,
      expression: `(() => {
        const aside = document.querySelector("aside");
        const page = document.querySelector("[data-template-page]");
        return {
          url: location.pathname,
          innerWidth: window.innerWidth,
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          height: document.documentElement.scrollHeight,
          h1: document.querySelector("h1")?.textContent ?? null,
          markers: {
            page: page !== null,
            aspects: document.querySelectorAll("[data-template-aspect]").length,
            create: document.querySelectorAll("[data-template-create]").length,
            save: document.querySelector("[data-template-save]") !== null,
            trial: document.querySelector("[data-template-trial]") !== null,
            how: document.querySelector("[data-template-how]") !== null,
          },
          rail: aside === null ? null : Math.round(aside.getBoundingClientRect().width),
          text: document.body.innerText.slice(0, 4000),
        };
      })()`,
    });
    const value = measured.result.value;

    check(`${width}px: the browser stayed on the page`, value.url === path, value.url);
    check(
      `${width}px: the viewport is the emulated width`,
      value.innerWidth === width,
      String(value.innerWidth),
    );
    check(
      `${width}px: no horizontal overflow`,
      value.scrollWidth === value.clientWidth,
      `scrollWidth ${value.scrollWidth} vs clientWidth ${value.clientWidth}`,
    );
    check(
      `${width}px: the page marker is present`,
      value.markers.page,
      "data-template-page absent",
    );
    check(
      `${width}px: the Aspects render`,
      value.markers.aspects >= 1,
      `${value.markers.aspects} row(s)`,
    );
    check(
      `${width}px: the create action renders three times`,
      value.markers.create === 3,
      String(value.markers.create),
    );
    check(`${width}px: Save to My Templates renders`, value.markers.save, "missing");
    check(`${width}px: the trial panel renders`, value.markers.trial, "missing");
    check(`${width}px: How It Works renders`, value.markers.how, "missing");
    check(
      `${width}px: the h1 is the template's name`,
      value.h1 !== null && value.h1.length > 0,
      String(value.h1),
    );
    /** The rail: a column at 1280, an overlay sheet at 390 — present either way, measured. */
    check(`${width}px: the shell's rail is in the document`, value.rail !== null, "no aside");
    for (const pattern of SECRET_PATTERNS) {
      check(
        `${width}px: no environment value on screen`,
        !pattern.test(value.text),
        String(pattern),
      );
    }

    /** Height is the measured document height: a clip below the fold captures a blank frame. */
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height: value.height,
      deviceScaleFactor: 2,
      mobile: width < 500,
    });
    const shot = await send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: true,
    });
    const file = `${OUT}/relationship-template-page-${width}.png`;
    writeFileSync(file, Buffer.from(shot.data, "base64"));

    report.stills.push({
      file,
      width,
      height: value.height,
      h1: value.h1,
      railWidth: value.rail,
      aspects: value.markers.aspects,
      scrollWidth: value.scrollWidth,
      clientWidth: value.clientWidth,
    });
  }

  browser.close();
  writeFileSync(`${OUT}/capture-report.json`, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    `captured ${report.stills.length} still(s) of ${path} — ${report.stills.map((s) => `${s.width}×${s.height}`).join(", ")}`,
  );
} finally {
  chrome.kill("SIGTERM");
}
