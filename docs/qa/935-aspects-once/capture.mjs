#!/usr/bin/env node
/**
 * #935 evidence: the relationship detail's two Aspect surfaces, before and after.
 *
 * One headless Chrome over raw CDP (Node 24 has a global `WebSocket`), signed in as the demo
 * admin the owner's comment was left under — `admin@demo.alignsynch.test`, the initiator of the
 * relationship the comment names. Signs in from Node, because the branch's auth refuses a browser
 * `Origin` (403) and accepts a server-side POST, then hands the cookies to Chrome.
 *
 *   withenv.sh <main checkout> bash -c 'cd <this worktree> && node24.sh node \
 *     docs/qa/935-aspects-once/capture.mjs --base http://localhost:4317 --phase before --out <dir>'
 *
 * Every claim is measured before its shutter and written into `before-report.json` /
 * `after-report.json`: how many `[data-aspect-list]` surfaces the page renders, how many rows and
 * drag grips each carries, and — with the edit dialog open — how many `[data-edit-aspects]` lists
 * and `edit-prompt-*` inputs the panel draws. `--phase after` also drags row 2 onto row 1 with
 * real pointer events, reloads, and records whether the new order persisted (it then drags the row
 * back, so the shared demo branch is left as the seed wrote it).
 *
 * The stills beside this file came from that run on 2026-11-12 against a dev server on :4317
 * serving `64bc932c` + this card's diff:
 *
 *   before-1440-page.png        the detail's own list — the keeper, with its five drag handles
 *   before-1440-edit-open.png   the *same* five questions again, as the panel's stacked forms
 *   after-1440-page.png         identical to the before page (the page was not touched)
 *   after-1440-edit-open.png    the panel with no Aspect surface at all
 *   after-390-page.png / after-390-edit-open.png   the same two claims at a phone width
 *   after-drag.png / after-reload.png              the reordered list, and it after a reload
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const RELATIONSHIP = "95505193-1b22-4c9c-a563-b7abeeb2ff15";
const DEMO_EMAIL = "admin@demo.alignsynch.test";

const argOf = (name, fallback) => {
  const at = process.argv.indexOf(`--${name}`);
  return at === -1 ? fallback : process.argv[at + 1];
};

const BASE = argOf("base", "http://localhost:4317");
const PHASE = argOf("phase", "before");
const OUT = argOf("out", "/tmp/qa-935");
const PORT = Number(argOf("cdp-port", "9231"));
mkdirSync(OUT, { recursive: true });

/* ------------------------------------------------------------------ sign in (Node, never the page) */

const { default: pg } = await import("pg");
const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();
const account = (
  await db.query("SELECT email, password FROM demo_account WHERE email = $1", [DEMO_EMAIL])
).rows[0];
await db.end();
if (account === undefined) throw new Error(`no demo_account row for ${DEMO_EMAIL}`);

const signIn = await fetch(`${BASE}/api/auth/sign-in/email`, {
  method: "POST",
  headers: { "content-type": "application/json", origin: BASE },
  body: JSON.stringify({ email: account.email, password: account.password }),
});
if (!signIn.ok) throw new Error(`sign-in answered ${signIn.status}: ${await signIn.text()}`);
const cookies = signIn.headers
  .getSetCookie()
  .map((raw) => raw.split(";")[0])
  .filter((pair) => pair.includes("="));
if (cookies.length === 0) throw new Error("sign-in set no cookies");

/* ------------------------------------------------------------------ chrome */

const chrome = spawn(
  "/usr/bin/google-chrome",
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    "--hide-scrollbars",
    "--no-sandbox",
    "--disable-gpu",
    "--force-device-scale-factor=1",
    "about:blank",
  ],
  { stdio: "ignore" },
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function pageSocket() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((target) => target.type === "page");
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      /* chrome is still starting */
    }
    await sleep(250);
  }
  throw new Error("chrome never exposed a page target");
}

const socket = new WebSocket(await pageSocket());
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let nextId = 0;
const pending = new Map();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id !== undefined && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(JSON.stringify(message.error)));
    else resolve(message.result);
  }
});

function send(method, params = {}) {
  nextId += 1;
  const id = nextId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

const evaluate = async (expression) => {
  const result = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
};

await send("Page.enable");
await send("Runtime.enable");
await send("Network.enable");

for (const pair of cookies) {
  const [name, ...rest] = pair.split("=");
  // `__Secure-` names are rejected without `secure: true` ("Sanitizing cookie failed"); Chrome
  // accepts them on http://localhost because it is a trustworthy origin.
  await send("Network.setCookie", {
    name,
    value: rest.join("="),
    url: BASE,
    path: "/",
    secure: true,
  });
}

/* ------------------------------------------------------------------ helpers */

async function viewport(width, height) {
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 700,
  });
}

async function until(expression, tries = 60) {
  for (let attempt = 0; attempt < tries; attempt += 1) {
    if (await evaluate(expression)) return true;
    await sleep(250);
  }
  return false;
}

/** Full-page still: the page's own height becomes the viewport, so the shutter frames all of it. */
async function shutter(file) {
  const height = await evaluate("Math.ceil(document.documentElement.scrollHeight)");
  const width = await evaluate("window.innerWidth");
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height: Math.max(height + 40, 400),
    deviceScaleFactor: 1,
    mobile: width < 700,
  });
  await sleep(500);
  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  writeFileSync(file, Buffer.from(shot.data, "base64"));
  await viewport(width, 900);
  return file;
}

/** Click an element by its selector, with a real mouse event at its centre. */
async function click(selector) {
  const box = await evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  if (box === null) throw new Error(`nothing to click at ${selector}`);
  for (const type of ["mousePressed", "mouseReleased"]) {
    await send("Input.dispatchMouseEvent", {
      type,
      x: box.x,
      y: box.y,
      button: "left",
      clickCount: 1,
      pointerType: "mouse",
    });
  }
}

/** What the page draws, as numbers. `scope` is "" for the document, or a selector. */
const SURFACES = `(() => {
  const rowIds = () =>
    [...document.querySelectorAll("[data-aspect-row]")].map((el) => el.getAttribute("data-aspect-row"));
  return {
    aspectLists: document.querySelectorAll("[data-aspect-list]").length,
    aspectRows: document.querySelectorAll("[data-aspect-row]").length,
    grips: document.querySelectorAll("[data-aspect-grip]").length,
    positions: [...document.querySelectorAll("[data-aspect-position]")].map((el) => el.getAttribute("data-aspect-position")),
    order: rowIds(),
    editTrigger: document.querySelectorAll("[data-relationship-edit-open]").length,
    editSurfaces: document.querySelectorAll("[data-relationship-edit]").length,
    editAspectLists: document.querySelectorAll("[data-edit-aspects]").length,
    editAspectInputs: document.querySelectorAll('input[id^="edit-prompt-"]').length,
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    h1: document.querySelector("h1")?.textContent?.trim() ?? null,
    aspectRowText: [...document.querySelectorAll("[data-aspect-row]")].map((el) => el.innerText.replace(/\\s+/g, " ").trim()),
    editPanelText: (() => {
      const panel = document.querySelector("[data-relationship-edit-dialog], [data-relationship-edit-sheet]");
      return panel === null ? null : panel.innerText.replace(/\\s+/g, " ").trim().slice(0, 1400);
    })(),
  };
})()`;

async function openPage(width, height) {
  await viewport(width, height);
  await send("Page.navigate", { url: `${BASE}/dashboard/relationships/${RELATIONSHIP}` });
  const ready = await until('document.querySelector("[data-relationship-aspects]") !== null', 120);
  await evaluate("document.fonts.ready");
  await sleep(900);
  return ready;
}

/* ------------------------------------------------------------------ the walk */

const report = { phase: PHASE, base: BASE, relationship: RELATIONSHIP, widths: {} };

for (const [width, height] of [
  [1440, 900],
  [390, 844],
]) {
  const ready = await openPage(width, height);
  const page = await evaluate(SURFACES);
  const pageStill = await shutter(`${OUT}/${PHASE}-${width}-page.png`);

  await click("[data-relationship-edit-open]");
  const opened = await until(
    'document.querySelector("[data-relationship-edit-dialog], [data-relationship-edit-sheet]") !== null',
  );
  await sleep(700);
  const withDialog = await evaluate(SURFACES);
  const dialogStill = await shutter(`${OUT}/${PHASE}-${width}-edit-open.png`);

  report.widths[width] = {
    ready,
    opened,
    pageStill,
    dialogStill,
    pageAspectSurfaces: page.aspectLists,
    pageRows: page.aspectRows,
    pageGrips: page.grips,
    pageOrder: page.order,
    editPanelAspectLists: withDialog.editAspectLists,
    editPanelAspectInputs: withDialog.editAspectInputs,
    dialogAspectRows: withDialog.aspectRows - page.aspectRows,
    totalAspectListsWithDialogOpen: withDialog.aspectLists,
    horizontalOverflow: withDialog.scrollWidth > withDialog.innerWidth,
    innerWidth: withDialog.innerWidth,
    heading: page.h1,
    editTrigger: page.editTrigger,
    pageRowText: page.aspectRowText,
    editPanelText: withDialog.editPanelText,
  };

  await send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
  });
  await send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
  });
  await sleep(400);
}

/* ------------------------------------------------------------------ the drag, and that it persists */

if (PHASE === "after") {
  await openPage(1440, 900);
  const before = (await evaluate(SURFACES)).order;

  const drag = async (fromSelector, toSelector) => {
    const points = await evaluate(`(() => {
      const from = document.querySelector(${JSON.stringify(fromSelector)});
      const to = document.querySelector(${JSON.stringify(toSelector)});
      if (!from || !to) return null;
      const a = from.getBoundingClientRect();
      const b = to.getBoundingClientRect();
      return { from: { x: a.left + a.width / 2, y: a.top + a.height / 2 }, to: { x: b.left + b.width / 2, y: b.top + b.height / 2 } };
    })()`);
    if (points === null) throw new Error("drag targets missing");
    await send("Input.dispatchMouseEvent", {
      type: "mousePressed",
      x: points.from.x,
      y: points.from.y,
      button: "left",
      clickCount: 1,
      pointerType: "mouse",
    });
    for (let step = 1; step <= 12; step += 1) {
      await send("Input.dispatchMouseEvent", {
        type: "mouseMoved",
        x: points.from.x + ((points.to.x - points.from.x) * step) / 12,
        y: points.from.y + ((points.to.y - points.from.y) * step) / 12,
        button: "left",
        buttons: 1,
        pointerType: "mouse",
      });
      await sleep(40);
    }
    await send("Input.dispatchMouseEvent", {
      type: "mouseReleased",
      x: points.to.x,
      y: points.to.y,
      button: "left",
      clickCount: 1,
      pointerType: "mouse",
    });
  };

  /** Row `id` at index `index`'s grip, and the row currently at `index`. */
  const gripOf = (id) => `[data-aspect-grip="${id}"]`;
  const rowAt = (index) => `[data-aspect-row][data-aspect-position="${index}"]`;

  await drag(gripOf(before[1]), rowAt(0));
  await sleep(2600);
  const afterDrag = (await evaluate(SURFACES)).order;
  const dragStill = await shutter(`${OUT}/after-drag.png`);

  await openPage(1440, 900);
  const afterReload = (await evaluate(SURFACES)).order;
  const reloadStill = await shutter(`${OUT}/after-reload.png`);

  report.drag = {
    before,
    afterDrag,
    afterReload,
    moved: afterReload[0] === before[1],
    persisted: JSON.stringify(afterReload) === JSON.stringify(afterDrag),
    stills: { dragStill, reloadStill },
  };

  // Put the demo branch back the way it was found: the row that moved to the top goes back down.
  if (report.drag.moved) {
    await drag(gripOf(afterReload[0]), rowAt(1));
    await sleep(2600);
    await openPage(1440, 900);
    report.drag.restored = (await evaluate(SURFACES)).order;
    report.drag.restoredMatchesOriginal =
      JSON.stringify(report.drag.restored) === JSON.stringify(before);
  }
}

socket.close();
chrome.kill();
writeFileSync(`${OUT}/${PHASE}-report.json`, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
