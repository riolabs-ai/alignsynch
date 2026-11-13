#!/usr/bin/env node
/**
 * Capture one page of a production build at 1440, over the DevTools protocol (card `t_ca4570a3`,
 * the v1.17.0 release notes).
 *
 * No Playwright, no Puppeteer — the same headless-Chrome-over-CDP loop every other `docs/qa-*` folder
 * uses (`docs/qa-as2-home/capture.mjs` is the ancestor). Node 24 has a global `WebSocket`, so this is
 * a hand-rolled session: attach to the page target, send commands with an incrementing id, await the
 * matching response.
 *
 * It asserts **before** the shutter, because a still of a shell or an error page is worse than none:
 * the emulation applied, no horizontal overflow, an `h1` on the page, every `<img>` loaded, and no
 * env-shaped secret in the rendered text. Then it measures the document height, resizes the viewport
 * to it and captures the whole page — `Page.captureScreenshot` with a clip below the fold returns a
 * blank frame, and `captureBeyondViewport` alone still frames only the viewport.
 *
 * Usage: node docs/qa-release-1.17.0/capture.mjs <base-url> <route> <out.png> [width]
 */
import { writeFileSync } from "node:fs";

const BASE = process.argv[2] ?? "http://127.0.0.1:3413";
const ROUTE = process.argv[3] ?? "/relationship-templates";
const OUT = process.argv[4] ?? "docs/qa-release-1.17.0/relationship-templates-1440.png";
const WIDTH = Number(process.argv[5] ?? 1440);
const DEBUG_PORT = 9333;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function json(path) {
  const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}${path}`);
  return await response.json();
}

async function attach() {
  const listed = await json("/json/list");
  const targets = Array.isArray(listed) ? listed : listed.targetInfos;
  const page = targets.find((t) => t.type === "page");
  if (page === undefined) throw new Error("no page target — is chrome headless running?");

  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  let nextId = 1;
  const pending = new Map();
  const events = [];
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id === undefined) {
      events.push(message.method);
      return;
    }
    const entry = pending.get(message.id);
    if (entry === undefined) return;
    pending.delete(message.id);
    if (message.error) entry.reject(new Error(JSON.stringify(message.error)));
    else entry.resolve(message.result);
  });

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });

  return { send, events, socket };
}

const { send, socket } = await attach();

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: WIDTH,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});

const url = `${BASE}${ROUTE}`;
await send("Page.navigate", { url });
await sleep(2000);

/** The document is complete, its fonts are in and every image has pixels. */
async function settled() {
  const { result } = await send("Runtime.evaluate", {
    expression: `document.readyState === "complete" && document.fonts.status === "loaded" &&
      [...document.images].every((i) => i.complete && i.naturalWidth > 0)`,
    returnByValue: true,
  });
  return result.value === true;
}

const resize = async (height) =>
  await send("Emulation.setDeviceMetricsOverride", {
    width: WIDTH,
    height: Math.ceil(height),
    deviceScaleFactor: 1,
    mobile: false,
  });

// Resize to the whole document **before** the wait. An image below the fold is lazy, so measuring
// the height, waiting at 900px and then growing the viewport for the shutter is what leaves a blank
// band in the still — the image only starts loading once something asks the browser to lay it out.
const measured = await send("Runtime.evaluate", {
  expression: "document.documentElement.scrollHeight",
  returnByValue: true,
});
await resize(measured.result.value);

let ready = false;
for (let i = 0; i < 40; i += 1) {
  if (await settled()) {
    ready = true;
    break;
  }
  await sleep(250);
}
if (!ready) console.error("! the page never settled — the assertions below name what is wrong");

// Growing the viewport can add height (a wrapped line, a lazy block). Re-measure once and only.
const remeasured = await send("Runtime.evaluate", {
  expression: "document.documentElement.scrollHeight",
  returnByValue: true,
});
if (Math.abs(remeasured.result.value - measured.result.value) > 8) {
  await resize(remeasured.result.value);
  for (let i = 0; i < 20 && !(await settled()); i += 1) await sleep(250);
}
await sleep(400);

const probe = await send("Runtime.evaluate", {
  expression: `(() => {
    const images = [...document.images];
    return {
      innerWidth: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
      h1: document.querySelectorAll("h1").length,
      h1Text: document.querySelector("h1")?.innerText ?? "",
      title: document.title,
      brokenImages: images.filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.currentSrc || i.src),
      imageCount: images.length,
      leaks: ["DATABASE_URL", "postgres://", "npg_", "sk_test", "NEON_"].filter((needle) =>
        document.body.innerText.includes(needle),
      ),
    };
  })()`,
  returnByValue: true,
});

const facts = probe.result.value;
const problems = [];
if (facts.innerWidth !== WIDTH) problems.push(`innerWidth ${facts.innerWidth} !== ${WIDTH}`);
if (facts.scrollWidth !== facts.innerWidth) {
  problems.push(`horizontal overflow: scrollWidth ${facts.scrollWidth} > ${facts.innerWidth}`);
}
if (facts.h1 < 1) problems.push("no h1 — the page rendered a shell, not a page");
if (facts.brokenImages.length > 0) problems.push(`broken images: ${facts.brokenImages.join(", ")}`);
if (facts.leaks.length > 0)
  problems.push(`env-shaped string in innerText: ${facts.leaks.join(", ")}`);

if (problems.length > 0) {
  console.error(`✗ ${url}`);
  for (const problem of problems) console.error(`  · ${problem}`);
  process.exit(1);
}

const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
writeFileSync(OUT, Buffer.from(shot.data, "base64"));

console.log(`✓ ${url}`);
console.log(`  h1        ${JSON.stringify(facts.h1Text.slice(0, 90))}`);
console.log(`  viewport  ${WIDTH}×${facts.height}  scrollWidth ${facts.scrollWidth}`);
console.log(`  images    ${facts.imageCount} present, 0 broken`);
console.log(`  secrets   none in innerText`);
console.log(`  wrote     ${OUT}`);

// The session is a live WebSocket, so the event loop never empties on its own.
socket.close();
process.exit(0);
