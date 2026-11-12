#!/usr/bin/env node
/**
 * Capture the AS2 home page at five widths over the DevTools protocol (#853).
 *
 * No Playwright, no Puppeteer — the same headless-Chrome-over-CDP loop the rest of `docs/qa-*` uses.
 * Node 24 has a global `WebSocket`, so this is a hand-rolled session: attach to the page target, send
 * commands with an incrementing id, await the matching response.
 *
 * For every width it (1) overrides the device metrics, (2) navigates fresh, (3) **asserts before the
 * shutter** — `innerWidth === width`, no horizontal overflow, the h1, the five menu rows, one element
 * per anchor id, every target's resolved `scroll-margin-top` at least the header height, the menu
 * actually sticky, and no secret-shaped string in `innerText` — then (4) measures the document height,
 * sets the viewport to it, and captures the full page.
 *
 * `captureScreenshot` with a `clip` below the fold returns a blank frame and `captureBeyondViewport`
 * still frames only the viewport, so the viewport is resized to the measured height before the shot.
 *
 * Usage: node docs/qa-as2-home/capture.mjs <base-url> <out-dir>
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.argv[2] ?? "http://127.0.0.1:3199";
const OUT = process.argv[3] ?? "docs/qa-as2-home";
const DEBUG_PORT = 9333;
const WIDTHS = [1440, 1024, 768, 390, 360];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function json(path) {
  const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}${path}`);
  return await response.json();
}

/** A session-scoped CDP connection to the page target. */
async function attach() {
  // `/json/list` answers a bare array; older builds wrapped it in `{ targetInfos }`.
  const listed = await json("/json/list");
  const targetInfos = Array.isArray(listed) ? listed : listed.targetInfos;
  const page = targetInfos.find((t) => t.type === "page");
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
    throw new Error(
      `page threw: ${result.exceptionDetails.text} ${JSON.stringify(result.exceptionDetails.exception?.description ?? "")}`,
    );
  }
  return result.result.value;
}

const PROBE = `(() => {
  const sectionIds = ["how-it-works", "relationship-templates", "questions", "stories", "benefits"];
  const nestedIds = ["personal-relationships", "business-relationships"];
  const nav = document.querySelector("nav[aria-label]");
  const header = document.querySelector("header");
  const targets = [...sectionIds, ...nestedIds].map((id) => {
    const nodes = document.querySelectorAll("#" + id);
    const node = nodes[0];
    const margin = node === null ? null : parseFloat(getComputedStyle(node).scrollMarginTop);
    return { id, count: nodes.length, scrollMarginTop: margin };
  });
  const rows = nav === null ? [] : [...nav.querySelectorAll("a")].map((a) => ({
    text: a.textContent.trim(),
    href: a.getAttribute("href"),
    name: a.getAttribute("aria-label") ?? a.textContent.trim(),
    tabbable: a.tabIndex >= 0,
  }));
  const text = document.body.innerText;
  return {
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    documentHeight: document.documentElement.scrollHeight,
    h1: document.querySelector("h1")?.textContent?.trim() ?? null,
    headerHeight: header === null ? null : Math.round(header.getBoundingClientRect().height),
    navPosition: nav === null ? null : getComputedStyle(nav).position,
    navTop: nav === null ? null : getComputedStyle(nav).top,
    navRows: rows,
    targets,
    templateChips: document.querySelectorAll('#relationship-templates a[href^="/relationship-types/"]').length,
    bandCount: document.querySelectorAll("[data-home-anchor]").length,
    images: [...document.images].map((i) => ({ src: i.currentSrc || i.src, natural: i.naturalWidth, complete: i.complete })),
    secrets: ["DATABASE_URL", "postgres://", "npg_", "sk_test", "NEON_"].filter((needle) => text.includes(needle)),
    overflowOffenders: [...document.querySelectorAll("body *")]
      .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 1)
      .slice(0, 6)
      .map((el) => el.tagName + "." + String(el.className).slice(0, 40)),
  };
})()`;

const main = async () => {
  const { send, close } = await attach();
  await send("Page.enable");
  await send("Runtime.enable");

  const report = { base: BASE, capturedAt: new Date().toISOString(), widths: [] };

  for (const width of WIDTHS) {
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: width < 700,
    });
    await send("Page.navigate", { url: `${BASE}/` });
    // `Page.navigate` resolves before hydration; wait for the markup the page guarantees, then settle
    // two frames so `next/image` has committed its `srcSet` and the sticky rows have measured.
    for (let attempt = 0; attempt < 60; attempt++) {
      await sleep(150);
      const ready = await evaluate(
        send,
        `document.readyState === "complete" && document.querySelectorAll("[data-home-anchor]").length >= 7`,
      );
      if (ready) break;
    }
    for (let frame = 0; frame < 3; frame++) {
      await evaluate(
        send,
        "new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))",
      );
    }

    const before = await evaluate(send, PROBE);
    const failures = [];
    if (before.innerWidth !== width) failures.push(`innerWidth ${before.innerWidth} !== ${width}`);
    if (before.scrollWidth !== before.innerWidth) {
      failures.push(
        `horizontal overflow: scrollWidth ${before.scrollWidth} > ${before.innerWidth} (${before.overflowOffenders.join(", ")})`,
      );
    }
    if (before.h1 === null) failures.push("no h1");
    if (before.navPosition !== "sticky")
      failures.push(`in-page menu is ${before.navPosition}, not sticky`);
    if (before.navRows.length !== 5)
      failures.push(`menu has ${before.navRows.length} rows, expected 5`);
    for (const target of before.targets) {
      if (target.count !== 1) failures.push(`#${target.id} occurs ${target.count}×, expected 1`);
      if (target.scrollMarginTop === null || target.scrollMarginTop < before.headerHeight) {
        failures.push(
          `#${target.id} scroll-margin-top ${target.scrollMarginTop} < header ${before.headerHeight}`,
        );
      }
    }
    if (before.bandCount < 7)
      failures.push(`${before.bandCount} data-home-anchor bands, expected 7`);
    if (before.secrets.length > 0)
      failures.push(`secret-shaped text in the render: ${before.secrets.join(", ")}`);
    const broken = before.images.filter((image) => !image.complete || image.natural === 0);
    if (broken.length > 0) failures.push(`${broken.length} image(s) did not decode`);

    if (failures.length > 0) {
      throw new Error(`asserts failed at ${width}:\n  - ${failures.join("\n  - ")}`);
    }

    // Frame the whole document, then shoot.
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height: before.documentHeight,
      deviceScaleFactor: 1,
      mobile: width < 700,
    });
    await sleep(250);
    const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
    const file = join(OUT, `home-${width}.png`);
    writeFileSync(file, Buffer.from(shot.data, "base64"));

    report.widths.push({ width, file, ...before });
    console.log(
      `✓ ${width} → ${file} (${before.documentHeight}px tall, ${before.templateChips} chips, ${before.bandCount} bands)`,
    );
  }

  writeFileSync(join(OUT, "capture-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  close();
  console.log(`✓ ${join(OUT, "capture-report.json")}`);
};

await main();
