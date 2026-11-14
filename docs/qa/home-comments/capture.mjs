#!/usr/bin/env node
/**
 * Capture the AlignSynch footer's Quick Links column at two widths (t_cf9a6ac6, owner comment 4).
 *
 * No Playwright, no Puppeteer — the same headless-Chrome-over-CDP loop `docs/qa-as2-home` uses.
 * Node 24 has a global `WebSocket`, so this is a hand-rolled session: attach to the page target,
 * send commands with an incrementing id, await the matching response.
 *
 * For every width it (1) overrides the device metrics, (2) navigates fresh, (3) **asserts before the
 * shutter** — `innerWidth === width`, no horizontal overflow, and the footer's Quick Links column
 * reads exactly the rows the caller expects (`href` and words, in order) — then (4) frames the
 * whole document, clips the `<footer>` element's box and writes the still.
 *
 * Usage:
 *   node docs/qa/home-comments/capture.mjs <base-url> <out-dir> <label> [--port 9444]
 *
 * The expected rows are stated here rather than read from the fixture: a capture that asks the
 * page to confirm itself proves nothing. The caller passes the list it wants to see — the
 * before run passes the three-row column, the after run the five-row mirror.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.argv[2] ?? "http://127.0.0.1:3401";
const OUT = process.argv[3] ?? "docs/qa-home-comments";
const LABEL = process.argv[4] ?? "after";
const portFlag = process.argv.indexOf("--port");
const DEBUG_PORT = portFlag === -1 ? 9444 : Number(process.argv[portFlag + 1]);
const WIDTHS = [1440, 390];

/**
 * The column each run must render. `expect` is the whole assertion: a row that moves, appears or
 * disappears is a failed capture rather than a bad screenshot nobody notices.
 */
const EXPECT = {
  before: [
    { href: "/relationship-types", text: "Templates" },
    { href: "/#questions", text: "How It Works" },
    { href: "/help", text: "Help" },
  ],
  after: [
    { href: "/", text: "Home" },
    { href: "/relationship-types", text: "Templates" },
    { href: "/#questions", text: "How It Works" },
    { href: "/pricing", text: "Pricing" },
    { href: "/help", text: "Help" },
  ],
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function json(path) {
  const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}${path}`);
  return await response.json();
}

/** A session-scoped CDP connection to the page target, picked by URL rather than position. */
async function attach() {
  const listed = await json("/json/list");
  const targetInfos = Array.isArray(listed) ? listed : listed.targetInfos;
  const page =
    targetInfos.find((t) => t.type === "page" && String(t.url).startsWith(BASE)) ??
    targetInfos.find((t) => t.type === "page");
  if (page === undefined) throw new Error("no page target — is chrome headless running?");

  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  let nextId = 1;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id === undefined) return;
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

  return { send, close: () => socket.close() };
}

/** Runs an expression in the page and returns its JSON value. */
async function evaluate(send, expression) {
  const result = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (result.exceptionDetails !== undefined) {
    throw new Error(`page threw: ${result.exceptionDetails.text}`);
  }
  return result.result.value;
}

/**
 * The footer's Quick Links column and the box the shot frames.
 *
 * The column is found by its heading (`Quick Links`) and then its own `<ul>`, so the assertion is
 * about the rows a reader sees — not about a class string that a restyle would change.
 */
const PROBE = `(() => {
  const footer = document.querySelector("footer");
  if (footer === null) return { error: "no <footer>" };
  const headings = [...footer.querySelectorAll("h3")];
  const heading = headings.find((h) => h.textContent.trim() === "Quick Links");
  if (heading === undefined) return { error: "no Quick Links heading" };
  const list = heading.parentElement.querySelector("ul");
  if (list === null) return { error: "no list under the Quick Links heading" };
  const rows = [...list.querySelectorAll(":scope > li > a")].map((a) => ({
    href: a.getAttribute("href"),
    text: a.textContent.replace(/\\s+/g, " ").trim(),
  }));
  const rect = footer.getBoundingClientRect();
  return {
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    documentHeight: document.documentElement.scrollHeight,
    rows,
    footer: {
      x: Math.max(0, Math.round(rect.left)),
      y: Math.round(rect.top + window.scrollY),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    },
  };
})()`;

const main = async () => {
  const expected = EXPECT[LABEL];
  if (expected === undefined) throw new Error(`unknown label "${LABEL}" — use before|after`);
  mkdirSync(OUT, { recursive: true });

  const { send, close } = await attach();
  await send("Page.enable");
  await send("Runtime.enable");

  const report = { base: BASE, label: LABEL, capturedAt: new Date().toISOString(), widths: [] };

  for (const width of WIDTHS) {
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: width < 700,
    });
    await send("Page.navigate", { url: `${BASE}/` });
    for (let attempt = 0; attempt < 80; attempt++) {
      await sleep(150);
      const ready = await evaluate(
        send,
        `document.readyState === "complete" && document.querySelectorAll("footer a").length > 8`,
      );
      if (ready) break;
    }
    for (let frame = 0; frame < 3; frame++) {
      await evaluate(
        send,
        "new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))",
      );
    }

    const probe = await evaluate(send, PROBE);
    if (probe.error !== undefined) throw new Error(`${width}: ${probe.error}`);
    const failures = [];
    if (probe.innerWidth !== width) failures.push(`innerWidth ${probe.innerWidth} !== ${width}`);
    if (probe.scrollWidth > probe.innerWidth) {
      failures.push(`horizontal overflow: scrollWidth ${probe.scrollWidth} > ${probe.innerWidth}`);
    }
    if (JSON.stringify(probe.rows) !== JSON.stringify(expected)) {
      failures.push(
        `Quick Links reads ${JSON.stringify(probe.rows)}, expected ${JSON.stringify(expected)}`,
      );
    }
    if (failures.length > 0)
      throw new Error(`asserts failed at ${width}:\n  - ${failures.join("\n  - ")}`);

    // Frame the whole document so the footer's page coordinates are inside the viewport, then clip.
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height: probe.documentHeight,
      deviceScaleFactor: 1,
      mobile: width < 700,
    });
    await sleep(300);
    const shot = await send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: true,
      clip: { ...probe.footer, scale: 1 },
    });
    const file = join(OUT, `footer-links-${LABEL}-${width}.png`);
    writeFileSync(file, Buffer.from(shot.data, "base64"));

    report.widths.push({ width, file, ...probe });
    console.log(
      `✓ ${width} → ${file} (footer ${probe.footer.width}×${probe.footer.height}, ${probe.rows.length} rows: ${probe.rows.map((r) => r.text).join(" · ")})`,
    );
  }

  writeFileSync(join(OUT, `capture-report-${LABEL}.json`), `${JSON.stringify(report, null, 2)}\n`);
  close();
  console.log(`✓ ${join(OUT, `capture-report-${LABEL}.json`)}`);
};

await main();
