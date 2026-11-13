#!/usr/bin/env node
/**
 * Capture `/` at 1440 and 390 and prove what the header's lockup is (t_6425a0a6).
 *
 * The owner's note on `/` was *"click logo goes to home page"*, and it did not. There is no
 * Playwright and no Puppeteer in this tree, so this is the same headless-Chrome-over-CDP loop every
 * other `docs/qa-*` folder uses: attach to the page target, send commands with an incrementing id,
 * await the matching response. Node 24 has a global `WebSocket`.
 *
 * `before` and `after` are two runs against **two serving trees**, not two commits of one tree
 * (`.worktrees/preview-logo-before` at `2e87eac3`, `.worktrees/preview-logo-after` at this card's
 * head), because the claim is about what a visitor's browser receives.
 *
 * Asserted before every shutter, and written to `capture-report-lockup-<mode>.json`:
 *
 *   - `innerWidth === width` and no horizontal overflow, so a still is framed at the width it claims;
 *   - the header's lockup, its anchor (or the absence of one, which is the `before` run), the
 *     `href`, whether an `aria-label` competes with the `alt`, and the image's own box in page
 *     coordinates — the numbers `before` and `after` are compared on for "no pixel movement";
 *   - the accessibility tree, filtered to the link whose name is the brand's;
 *   - the tab order, walked with real `Input.dispatchKeyEvent` presses, so "reachable by Tab" is a
 *     measurement rather than a reading of the markup;
 *   - the click-through from `/pricing`, which is the owner's actual sentence;
 *   - a scan of `innerText` for `DATABASE_URL` / `postgres://` / `npg_` / `sk_test`.
 *
 * `captureScreenshot` with a `clip` below the fold returns a blank frame and `captureBeyondViewport`
 * still frames only the viewport, so the viewport is resized to the document height before the shot.
 *
 * Usage: node docs/qa-home-comments/capture.mjs <base-url> <before|after> [out-dir]
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = process.argv[2] ?? "http://127.0.0.1:4318";
const MODE = process.argv[3] ?? "after";
const OUT = process.argv[4] ?? "docs/qa-home-comments";
const DEBUG_PORT = 9411;
const WIDTHS = [1440, 390];
/** The brand's own name, which is what the `alt` on the lockup carries (data/brands/alignsynch.ts). */
const BRAND = "AlignSynch";

if (!["before", "after"].includes(MODE)) {
  throw new Error(`mode must be "before" or "after", got "${MODE}"`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function json(path) {
  const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}${path}`);
  return await response.json();
}

/** A session-scoped CDP connection to the page target. */
async function attach() {
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

/**
 * The header's brand slot, in the terms the card is about.
 *
 * The lockup is found by the hook the image carries, never by position: `data-brand-lockup` is the
 * one selector `app/globals.css` sizes the file through, so a `before` run and an `after` run are
 * measuring the same element.
 */
const PROBE = `(() => {
  const img = document.querySelector('header img[data-brand-lockup]');
  const anchor = img === null ? null : img.closest('a');
  const header = document.querySelector('header');
  const rect = (el) => {
    if (el === null) return null;
    const r = el.getBoundingClientRect();
    return {
      x: Math.round(r.x * 100) / 100,
      y: Math.round(r.y * 100) / 100,
      width: Math.round(r.width * 100) / 100,
      height: Math.round(r.height * 100) / 100,
    };
  };
  const text = document.body.innerText;
  return {
    path: location.pathname,
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    documentHeight: document.documentElement.scrollHeight,
    headerHeight: header === null ? null : Math.round(header.getBoundingClientRect().height * 100) / 100,
    lockup: img === null ? null : {
      tag: img.tagName,
      alt: img.getAttribute('alt'),
      className: img.getAttribute('class'),
      src: img.getAttribute('src'),
      naturalWidth: img.naturalWidth,
      rect: rect(img),
    },
    slot: header === null ? null : rect(header.querySelector('header > div > span')),
    anchor: anchor === null ? null : {
      href: anchor.getAttribute('href'),
      ariaLabel: anchor.getAttribute('aria-label'),
      className: anchor.getAttribute('class'),
      rect: rect(anchor),
      tabIndex: anchor.tabIndex,
      text: anchor.textContent.trim(),
    },
    navRows: [...document.querySelectorAll('header nav a')].map((a) => a.textContent.trim()),
    secrets: ["DATABASE_URL", "postgres://", "npg_", "sk_test", "NEON_"].filter((n) => text.includes(n)),
    brokenImages: [...document.images]
      .filter((i) => i.complete && i.naturalWidth === 0)
      .map((i) => i.currentSrc || i.src),
    pendingImages: [...document.images].filter((i) => !i.complete).length,
  };
})()`;

/** Navigate, settle for the markup the page guarantees, then settle two more frames. */
async function open(send, url) {
  await send("Page.navigate", { url });
  for (let attempt = 0; attempt < 80; attempt++) {
    await sleep(150);
    const ready = await evaluate(
      send,
      `document.readyState === "complete" && document.querySelector('header img[data-brand-lockup]') !== null`,
    );
    if (ready) break;
  }
  for (let frame = 0; frame < 3; frame++) {
    await evaluate(
      send,
      "new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))",
    );
  }
}

/** The link nodes whose accessible name is the brand's — the a11y-tree evidence. */
async function brandLinkNodes(send) {
  const { nodes } = await send("Accessibility.getFullAXTree");
  return nodes
    .filter((node) => node.role?.value === "link" && (node.name?.value ?? "").includes(BRAND))
    .map((node) => ({
      role: node.role?.value ?? null,
      name: node.name?.value ?? null,
      ignored: node.ignored ?? false,
    }));
}

/** Walk the tab order from a clean focus, recording who gets focus each press. */
async function tabOrder(send, presses) {
  await evaluate(
    send,
    "document.activeElement instanceof HTMLElement && document.activeElement.blur()",
  );
  const seen = [];
  for (let press = 0; press < presses; press++) {
    await send("Input.dispatchKeyEvent", {
      type: "rawKeyDown",
      windowsVirtualKeyCode: 9,
      key: "Tab",
    });
    await send("Input.dispatchKeyEvent", { type: "keyUp", windowsVirtualKeyCode: 9, key: "Tab" });
    await sleep(60);
    seen.push(
      await evaluate(
        send,
        `(() => {
          const el = document.activeElement;
          if (el === null) return { tag: null };
          return {
            tag: el.tagName,
            href: el.getAttribute('href'),
            name: el.getAttribute('aria-label') ?? el.textContent.trim().slice(0, 40),
            isLockup: el.querySelector('img[data-brand-lockup]') !== null,
          };
        })()`,
      ),
    );
    if (seen[seen.length - 1].isLockup) break;
  }
  return seen;
}

const main = async () => {
  const { send, close } = await attach();
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Accessibility.enable");

  const report = { mode: MODE, base: BASE, capturedAt: new Date().toISOString(), widths: [] };

  for (const width of WIDTHS) {
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: width < 700,
    });
    await open(send, `${BASE}/`);

    const probe = await evaluate(send, PROBE);
    const failures = [];
    if (probe.innerWidth !== width) failures.push(`innerWidth ${probe.innerWidth} !== ${width}`);
    if (probe.scrollWidth !== probe.innerWidth) {
      failures.push(`horizontal overflow: scrollWidth ${probe.scrollWidth} > ${probe.innerWidth}`);
    }
    if (probe.lockup === null) failures.push("no img[data-brand-lockup] in the header");
    if (probe.brokenImages.length > 0) {
      failures.push(`broken image(s): ${probe.brokenImages.join(", ")}`);
    }
    if (probe.secrets.length > 0) {
      failures.push(`secret-shaped text in the render: ${probe.secrets.join(", ")}`);
    }
    if (probe.lockup !== null && probe.lockup.alt !== BRAND) {
      failures.push(`lockup alt is ${JSON.stringify(probe.lockup.alt)}, expected "${BRAND}"`);
    }

    if (MODE === "after") {
      if (probe.anchor === null) failures.push("the lockup is not inside an anchor");
      else {
        if (probe.anchor.href !== "/")
          failures.push(`anchor href is ${probe.anchor.href}, expected /`);
        if (probe.anchor.ariaLabel !== null) {
          failures.push(`anchor carries aria-label ${JSON.stringify(probe.anchor.ariaLabel)}`);
        }
        // The wrapper must not become the image's own box: same width, same height, same place.
        if (probe.anchor.rect.width !== probe.lockup.rect.width) {
          failures.push(
            `anchor width ${probe.anchor.rect.width} !== lockup width ${probe.lockup.rect.width}`,
          );
        }
        if (probe.anchor.rect.height !== probe.lockup.rect.height) {
          failures.push(
            `anchor height ${probe.anchor.rect.height} !== lockup height ${probe.lockup.rect.height}`,
          );
        }
      }
    } else if (probe.anchor !== null) {
      failures.push(
        `the lockup is inside an anchor (${probe.anchor.href}) — this is the after tree`,
      );
    }

    const axLinks = await brandLinkNodes(send);
    if (MODE === "after" && !axLinks.some((node) => node.name === BRAND && !node.ignored)) {
      failures.push(`no link named "${BRAND}" in the accessibility tree`);
    }

    const tabs = await tabOrder(send, 8);
    if (MODE === "after" && !tabs.some((entry) => entry.isLockup)) {
      failures.push(`the lockup is not reachable by Tab — order was ${JSON.stringify(tabs)}`);
    }

    if (failures.length > 0)
      throw new Error(`asserts failed at ${width}:\n  - ${failures.join("\n  - ")}`);

    // Frame the whole document, then shoot.
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height: probe.documentHeight,
      deviceScaleFactor: 1,
      mobile: width < 700,
    });
    await sleep(250);
    const shot = await send("Page.captureScreenshot", { format: "png", fromSurface: true });
    const file = join(OUT, `logo-${MODE}-${width}.png`);
    writeFileSync(file, Buffer.from(shot.data, "base64"));

    report.widths.push({ width, file, axLinks, tabs, ...probe });
    console.log(
      `✓ ${MODE} ${width} → ${file} (lockup ${probe.lockup?.rect.width}×${probe.lockup?.rect.height}, ` +
        `anchor ${probe.anchor?.href ?? "none"}, ax ${axLinks.length} link(s) named ${BRAND})`,
    );
  }

  /**
   * The owner's sentence, walked: from `/pricing` the lockup must land on `/`. This is the one
   * assertion a screenshot cannot make — the anchor can be present, correct and still not navigate —
   * so it is a real click on a real link, followed by a wait for the route to change.
   */
  if (MODE === "after") {
    await send("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await open(send, `${BASE}/pricing`);
    const from = await evaluate(send, "location.pathname");
    await evaluate(
      send,
      `(() => {
        const img = document.querySelector('header img[data-brand-lockup]');
        const anchor = img === null ? null : img.closest('a');
        if (anchor === null) throw new Error('no anchor');
        anchor.click();
        return true;
      })()`,
    );
    let landed = null;
    for (let attempt = 0; attempt < 60; attempt++) {
      await sleep(150);
      landed = await evaluate(send, "location.pathname");
      if (landed === "/") break;
    }
    if (from !== "/pricing") throw new Error(`click-through started at ${from}, expected /pricing`);
    if (landed !== "/") throw new Error(`click on the lockup landed on ${landed}, expected /`);
    report.clickThrough = { from, landed, ok: true };
    console.log(`✓ click-through: ${from} → ${landed}`);
  }

  writeFileSync(
    join(OUT, `capture-report-lockup-${MODE}.json`),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  close();
  console.log(`✓ ${join(OUT, `capture-report-lockup-${MODE}.json`)}`);
};

await main();
