/**
 * #923 QA stills — headless Chrome over CDP, no driver dependency.
 *
 * Five frames, each asserted in the live DOM before the shutter:
 *
 *   1. `rel-detail-edit-closed-1440.png`  the detail with no edit surface on the page at all
 *   2. `rel-detail-edit-dialog-1440.png`  the same page with the Edit control's dialog open
 *   3. `rel-detail-edit-closed-390.png`   the closed state at the sheet width
 *   4. `rel-detail-edit-sheet-390.png`    the sheet open at 390
 *   5. `rel-detail-edit-live-1440.png`    a relationship past invite, Edit control present
 *
 * The closed frames are full-page; the open ones are viewport-height, because a modal is a
 * viewport artefact and a 390 × 3 000 image of a fixed sheet is unreadable.
 *
 * Cookies come from `rig.mjs` (Node signs in; a page-origin sign-in answers 403 INVALID_ORIGIN on
 * this branch). Run against the dev server on :4317:
 *
 *   node docs/qa-rel-detail-edit/stills.mjs
 */
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const OUT = process.argv[2] ?? "docs/qa-rel-detail-edit";
const COOKIES = process.argv[3] ?? "/tmp/qarel-edit-cookies.json";
const BASE = "http://localhost:4317";
const PORT = 9333;
const DRAFT_PATH = "/dashboard/relationships/qarel-edit-draft";
const LIVE_PATH = "/dashboard/relationships/qarel-edit-live";

mkdirSync(OUT, { recursive: true });

const chrome = spawn(
  "/usr/bin/google-chrome",
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    "--user-data-dir=/tmp/chrome-qarel-edit",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--hide-scrollbars",
    "about:blank",
  ],
  { stdio: "ignore", detached: false },
);

let wsUrl = null;
for (let i = 0; i < 60; i += 1) {
  await sleep(300);
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
    const page = list.find((target) => target.type === "page");
    if (page?.webSocketDebuggerUrl) {
      wsUrl = page.webSocketDebuggerUrl;
      break;
    }
  } catch {
    /* not up yet */
  }
}
if (wsUrl === null) {
  chrome.kill();
  throw new Error("chrome did not expose a page target");
}

const ws = new WebSocket(wsUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve, { once: true });
  ws.addEventListener("error", reject, { once: true });
});

let id = 0;
const pending = new Map();
ws.addEventListener("message", (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id !== undefined && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
});

function send(method, params = {}) {
  const callId = ++id;
  ws.send(JSON.stringify({ id: callId, method, params }));
  return new Promise((resolve) => pending.set(callId, resolve));
}

async function evaluate(expression) {
  const res = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  return res.result?.result?.value;
}

const { initiator } = JSON.parse(readFileSync(COOKIES, "utf8"));

async function setCookies(jar) {
  await send("Network.clearBrowserCookies");
  for (const pair of jar) {
    const eq = pair.indexOf("=");
    const name = pair.slice(0, eq);
    const value = pair.slice(eq + 1);
    const res = await send("Network.setCookie", {
      name,
      value,
      url: BASE,
      secure: true,
      httpOnly: true,
    });
    if (res.result?.success !== true) throw new Error(`cookie ${name} refused`);
  }
}

await send("Page.enable");
await send("Network.enable");
await send("Runtime.enable");

const report = [];

/** The facts every frame is judged on. Read from the live DOM, never from the source. */
const FACTS = `(() => {
  const q = (s) => document.querySelector(s);
  const trigger = q("[data-relationship-edit-open]");
  const dialog = q("[role=dialog]");
  const rect = (el) => (el ? el.getBoundingClientRect() : null);
  const box = (el) => {
    const r = rect(el);
    return r === null ? null : {
      x: Math.round(r.x), y: Math.round(r.y),
      width: Math.round(r.width), height: Math.round(r.height),
    };
  };
  return {
    url: location.pathname,
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    docHeight: document.documentElement.scrollHeight,
    h1: q("h1")?.textContent?.trim() ?? null,
    state: q("[data-relationship-status]")?.getAttribute("data-relationship-status") ?? null,
    trigger: trigger
      ? { text: trigger.textContent.trim(), box: box(trigger), expanded: trigger.getAttribute("aria-expanded") }
      : null,
    triggerInRail: !!q("aside [data-relationship-edit-open]"),
    /* The form the panel draws: FormSurface with data-relationship-edit. Absent = no surface. */
    formOnPage: !!q("[data-relationship-edit]"),
    formInRail: !!q("aside [data-relationship-edit]"),
    dialog: dialog
      ? {
          /*
           * box is the rect (what the shutter frames); clientHeight / scrollHeight are the
           * numbers that say the form is reachable — a modal taller than the viewport with no
           * inner scroll is a form whose Save button nobody can press.
           */
          box: {
            ...box(dialog),
            clientHeight: dialog.clientHeight,
            scrollHeight: dialog.scrollHeight,
          },
          kind: dialog.hasAttribute("data-relationship-edit-dialog")
            ? "dialog"
            : dialog.hasAttribute("data-relationship-edit-sheet")
              ? "sheet"
              : "other",
          labelledBy: q("[aria-labelledby]") && dialog.getAttribute("aria-labelledby")
            ? document.getElementById(dialog.getAttribute("aria-labelledby"))?.textContent?.trim() ?? null
            : null,
          hasTitleField: !!dialog.querySelector("#edit-title"),
          fields: dialog.querySelectorAll("input, textarea, select").length,
          focusInside: dialog.contains(document.activeElement),
        }
      : null,
    aspectList: !!q('[data-aspect-list="true"]'),
    leaked: /DATABASE_URL|postgres:\\/\\/|npg_|sk_test/.test(document.body.innerText),
  };
})()`;

async function load(path, width, height) {
  await setCookies(initiator);
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 700,
  });
  const loaded = new Promise((resolve) => {
    const onMsg = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === "Page.loadEventFired") {
        ws.removeEventListener("message", onMsg);
        resolve();
      }
    };
    ws.addEventListener("message", onMsg);
  });
  await send("Page.navigate", { url: `${BASE}${path}` });
  await loaded;
  await sleep(2200); // hydration + the server render settling
  return evaluate(FACTS);
}

async function shoot(file, facts, { viewport, width, height }) {
  if (viewport) {
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 700,
    });
  } else {
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height: facts.docHeight,
      deviceScaleFactor: 1,
      mobile: width < 700,
    });
  }
  await sleep(400);
  const shot = await send(
    "Page.captureScreenshot",
    viewport ? { format: "png" } : { format: "png" },
  );
  writeFileSync(`${OUT}/${file}`, Buffer.from(shot.result.data, "base64"));
  report.push({
    file,
    viewport: viewport ? `${width}x${height}` : `${width}x${facts.docHeight}`,
    ...facts,
  });
  console.log(
    `${file}: ${facts.url} state=${facts.state} trigger=${JSON.stringify(facts.trigger)}`,
  );
  console.log(`  dialog=${JSON.stringify(facts.dialog)} formOnPage=${facts.formOnPage}`);
}

function judge(label, facts, problems) {
  if (facts.innerWidth !== facts.expectedWidth) problems.push(`innerWidth ${facts.innerWidth}`);
  if (facts.scrollWidth !== facts.innerWidth) problems.push("horizontal overflow");
  if (facts.leaked) problems.push("body carries an env value");
  if (problems.length > 0) throw new Error(`${label}: ${problems.join("; ")}`);
}

/* 1 — 1440, closed: no edit surface on the page, the door in the rail. */
const closed1440 = await load(DRAFT_PATH, 1440, 900);
closed1440.expectedWidth = 1440;
judge("closed 1440", closed1440, [
  ...(closed1440.trigger?.text === "Edit" ? [] : [`trigger ${closed1440.trigger?.text}`]),
  ...(closed1440.triggerInRail ? [] : ["the door is not in the actions rail"]),
  ...(closed1440.formOnPage ? ["an edit form is on the page while closed"] : []),
  ...(closed1440.formInRail ? ["the old left column is still drawn"] : []),
  ...(closed1440.dialog ? ["a dialog is open on a closed page"] : []),
  ...(closed1440.h1 === "Relationship Basics" ? [] : [`h1 ${closed1440.h1}`]),
  ...(closed1440.state === "draft" ? [] : [`state ${closed1440.state}`]),
]);
await shoot("rel-detail-edit-closed-1440.png", closed1440, { viewport: false, width: 1440 });

/* 2 — 1440, the dialog open: the same panel, inside a modal, focus inside it. */
/* Restore the viewport first: the full-page shot above left the emulation at the document's
   height, and `vh` would then resolve against that number (85vh = 961 on a 900 px viewport is the
   tell) — the modal must be measured against the viewport a person actually has. */
await send("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});
await sleep(300);
await evaluate("document.querySelector('[data-relationship-edit-open]').click()");
await sleep(700);
const dialog1440 = await evaluate(FACTS);
dialog1440.expectedWidth = 1440;
judge("dialog 1440", dialog1440, [
  ...(dialog1440.dialog?.kind === "dialog" ? [] : [`modal ${JSON.stringify(dialog1440.dialog)}`]),
  ...(dialog1440.dialog?.hasTitleField ? [] : ["the panel's fields are not in the dialog"]),
  ...(dialog1440.dialog?.fields >= 5 ? [] : [`fields ${dialog1440.dialog?.fields}`]),
  ...(dialog1440.dialog?.focusInside ? [] : ["focus is not inside the dialog"]),
  ...(dialog1440.dialog?.labelledBy === "Edit this relationship"
    ? []
    : [`dialog name ${dialog1440.dialog?.labelledBy}`]),
  ...((dialog1440.dialog?.box?.width ?? 0) <= 700
    ? []
    : [`dialog width ${dialog1440.dialog?.box?.width}`]),
  ...((dialog1440.dialog?.box?.clientHeight ?? 0) <= 900
    ? []
    : [`dialog clientHeight ${dialog1440.dialog?.box?.clientHeight} exceeds the viewport`]),
  ...((dialog1440.dialog?.box?.scrollHeight ?? 0) > (dialog1440.dialog?.box?.clientHeight ?? 0)
    ? []
    : ["the dialog does not scroll: a long form would be unreachable"]),
  ...(dialog1440.trigger?.expanded === "true"
    ? []
    : [`aria-expanded ${dialog1440.trigger?.expanded}`]),
]);
await shoot("rel-detail-edit-dialog-1440.png", dialog1440, {
  viewport: true,
  width: 1440,
  height: 900,
});

/* 2b — Escape closes, and the focus goes back to the door it came from. */
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
await sleep(600);
const afterEscape = await evaluate(`(() => {
  const trigger = document.querySelector("[data-relationship-edit-open]");
  return {
    dialog: !!document.querySelector("[role=dialog]"),
    form: !!document.querySelector("[data-relationship-edit]"),
    focusOnTrigger: document.activeElement === trigger,
  };
})()`);
if (afterEscape.dialog || afterEscape.form) throw new Error("Escape left the dialog open");
if (!afterEscape.focusOnTrigger) throw new Error("Escape did not return focus to the trigger");
report.push({ check: "escape-closes", ...afterEscape });
console.log("escape:", JSON.stringify(afterEscape));

/* 3 — 390, closed. */
const closed390 = await load(DRAFT_PATH, 390, 844);
closed390.expectedWidth = 390;
judge("closed 390", closed390, [
  ...(closed390.trigger?.text === "Edit" ? [] : [`trigger ${closed390.trigger?.text}`]),
  ...(closed390.formOnPage ? ["an edit form is on the page while closed"] : []),
  ...(closed390.dialog ? ["a dialog is open on a closed page"] : []),
  ...((closed390.trigger?.box?.width ?? 0) <= 390
    ? []
    : [`trigger width ${closed390.trigger?.box?.width}`]),
]);
await shoot("rel-detail-edit-closed-390.png", closed390, { viewport: false, width: 390 });

/* 4 — 390, the sheet open. Same viewport reset for the same reason. */
await send("Emulation.setDeviceMetricsOverride", {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
});
await sleep(300);
await evaluate("document.querySelector('[data-relationship-edit-open]').click()");
await sleep(800);
const sheet390 = await evaluate(FACTS);
sheet390.expectedWidth = 390;
judge("sheet 390", sheet390, [
  ...(sheet390.dialog?.kind === "sheet" ? [] : [`modal ${JSON.stringify(sheet390.dialog)}`]),
  ...(sheet390.dialog?.hasTitleField ? [] : ["the panel's fields are not in the sheet"]),
  ...(sheet390.dialog?.focusInside ? [] : ["focus is not inside the sheet"]),
  ...(sheet390.dialog?.box?.width === 390 ? [] : [`sheet width ${sheet390.dialog?.box?.width}`]),
  ...(sheet390.dialog?.box?.clientHeight === 844
    ? []
    : [`sheet clientHeight ${sheet390.dialog?.box?.clientHeight}`]),
  ...((sheet390.dialog?.box?.scrollHeight ?? 0) > (sheet390.dialog?.box?.clientHeight ?? 0)
    ? []
    : ["the sheet does not scroll: the save button would be unreachable at 390"]),
]);
await shoot("rel-detail-edit-sheet-390.png", sheet390, { viewport: true, width: 390, height: 844 });

/* 5 — a relationship past invite: published, and the door is still there. */
const live1440 = await load(LIVE_PATH, 1440, 900);
live1440.expectedWidth = 1440;
judge("past invite 1440", live1440, [
  ...(live1440.state === "published" ? [] : [`state ${live1440.state}`]),
  ...(live1440.trigger !== null ? [] : ["no Edit control on a published relationship"]),
  ...(live1440.formOnPage ? ["an edit form is on the page while closed"] : []),
  ...(live1440.dialog ? ["a dialog is open on a closed page"] : []),
  ...(live1440.aspectList ? ["the draft Aspect editor is drawn on a published relationship"] : []),
]);
await shoot("rel-detail-edit-live-1440.png", live1440, { viewport: false, width: 1440 });

writeFileSync(`${OUT}/capture-report.json`, `${JSON.stringify(report, null, 2)}\n`);
console.log(`report: ${OUT}/capture-report.json`);

ws.close();
chrome.kill();
