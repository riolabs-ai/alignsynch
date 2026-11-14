/**
 * #971 — capture /login and /register at 1440 and 390, from one tree, over raw CDP.
 *
 * Node 24 has a global `WebSocket`, so this needs no browser driver: launch Chrome with
 * `--remote-debugging-port`, attach to the page target, override the device metrics (the only
 * honest 390 on this box), navigate, then read the DOM *and* take the still. Every still is
 * accompanied by the numbers that make it readable: `innerWidth`, the split panel's rect, the
 * heading's tag and text, and each tile's rect — so "the hero is there" is a measurement, not a
 * claim about a picture.
 *
 *   node capture-auth.mjs --base http://localhost:3438 --out <dir> --phase after
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
};

const BASE = arg("base", "http://localhost:3438");
const OUT = arg("out", ".");
const PHASE = arg("phase", "after");
const DEBUG_PORT = Number(arg("port", "9352"));
const WIDTHS = [1440, 390];
const HEIGHT = 1000;
const ROUTES = ["/login", "/register"];

mkdirSync(OUT, { recursive: true });

const chrome = spawn(
  "/usr/bin/google-chrome",
  [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--no-first-run",
    "--hide-scrollbars",
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=/tmp/t971-chrome-${PHASE}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);

/** The page target's websocket URL, once Chrome is listening. */
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

let nextId = 0;
const pending = new Map();
ws.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(JSON.stringify(message.error)));
    else resolve(message.result);
  }
});

const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    nextId += 1;
    const id = nextId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });

await send("Page.enable");
await send("Runtime.enable");

/** What the page measured about itself, after the viewport has been forced to `width`. */
const PROBE = (width) => `(() => {
  const rect = (el) => el ? { x: Math.round(el.getBoundingClientRect().x), y: Math.round(el.getBoundingClientRect().y), w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height) } : null;
  const all = [...document.querySelectorAll("body *")];
  const byText = (text) => all.find((el) => el.children.length === 0 && el.textContent.trim() === text);
  const panel = document.querySelector("div.lg\\\\:flex.hidden.lg\\\\:flex") || all.find((el) => el.className && String(el.className).includes("lg:w-1/2") && String(el.className).includes("bg-action"));
  const inner = panel ? [...panel.querySelectorAll("div")].find((el) => String(el.className).includes("z-10")) : null;
  const heading = inner ? inner.querySelector("h1,h2") : document.querySelector("h1,h2");
  const tiles = [...document.querySelectorAll("div")].filter((el) => String(el.className).includes("backdrop-blur-sm") && String(el.className).includes("p-4"));
  return {
    innerWidth: window.innerWidth,
    requested: ${width},
    panel: rect(panel),
    panelHidden: panel ? getComputedStyle(panel).display === "none" : null,
    heading: heading ? { tag: heading.tagName.toLowerCase(), text: heading.textContent.trim(), box: rect(heading) } : null,
    tiles: tiles.map((el) => ({ text: el.textContent.trim().replace(/\\s+/g, " "), box: rect(el) })),
    splitClasses: panel ? String(panel.className) : null,
  };
})()`;

const report = { phase: PHASE, base: BASE, routes: {} };

for (const route of ROUTES) {
  report.routes[route] = {};
  for (const width of WIDTHS) {
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height: HEIGHT,
      deviceScaleFactor: 1,
      mobile: width < 640,
    });
    await send("Page.navigate", { url: `${BASE}${route}` });
    // A dev-server render plus hydration: poll until the DOM has a heading and the width agrees.
    let probe = null;
    for (let i = 0; i < 120; i += 1) {
      await sleep(500);
      const result = await send("Runtime.evaluate", {
        expression: PROBE(width),
        returnByValue: true,
      });
      probe = result.result?.value ?? null;
      if (probe && probe.innerWidth === width && probe.heading) break;
    }
    if (!probe) throw new Error(`${route}@${width}: the page never rendered a heading`);
    if (probe.innerWidth !== width) {
      throw new Error(
        `${route}: viewport override refused — innerWidth ${probe.innerWidth} != ${width}`,
      );
    }

    const shot = await send("Page.captureScreenshot", { format: "png" });
    const file = join(OUT, `971-${PHASE}-${route.replaceAll("/", "")}-${width}.png`);
    writeFileSync(file, Buffer.from(shot.data, "base64"));

    // The markup, with script payloads stripped: a DOM diff of the tiles is the proof for /login.
    const html = await send("Runtime.evaluate", {
      expression: `(() => { const c = document.body.cloneNode(true); for (const s of c.querySelectorAll("script,next-route-announcer,nextjs-portal")) s.remove(); return c.innerHTML; })()`,
      returnByValue: true,
    });
    writeFileSync(
      join(OUT, `971-${PHASE}-${route.replaceAll("/", "")}-${width}.html`),
      html.result.value,
    );

    report.routes[route][width] = { ...probe, still: file };
    console.log(
      `${PHASE} ${route} @${width}: heading=${probe.heading.tag} tiles=${probe.tiles.length} panel=${JSON.stringify(probe.panel)}`,
    );
  }
}

writeFileSync(join(OUT, `971-${PHASE}-report.json`), `${JSON.stringify(report, null, 2)}\n`);
console.log(`wrote ${OUT}/971-${PHASE}-report.json`);
ws.close();
chrome.kill();
