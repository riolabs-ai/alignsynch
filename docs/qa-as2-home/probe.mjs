#!/usr/bin/env node
/**
 * The interaction probe (#853): the one thing on this page that is easy to get wrong.
 *
 * The in-page menu is a **second sticky bar** under the shared header, so an anchor target has to
 * clear both, and a nested target (the Business/Personal groups) has to clear them from inside a
 * band that is itself a target. This measures it in a real browser instead of trusting the CSS:
 *
 *  - the header's measured height, and the menu's row height;
 *  - the container's measured width against `--container-marketing`;
 *  - the hero's two cards, to prove they are side by side at 1440 and stacked at 390;
 *  - after `location.hash = "#questions"` and `="#personal-relationships"`: the target's top against
 *    the menu's bottom, and the menu's top against the header's bottom. A positive gap means the
 *    heading is not under either bar.
 *
 * `prefers-reduced-motion` is honoured by the page (`html:has(.home-anchors)` scrolls smoothly), so
 * the probe waits for the scroll to settle rather than reading a mid-animation rect.
 *
 * Usage: node docs/qa-as2-home/probe.mjs <base-url> <out-file>
 */
import { writeFileSync } from "node:fs";

const BASE = process.argv[2] ?? "http://127.0.0.1:3199";
const OUT = process.argv[3] ?? "docs/qa-as2-home/measurements.json";
const DEBUG_PORT = 9333;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function attach() {
  const listed = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)).json();
  const targetInfos = Array.isArray(listed) ? listed : listed.targetInfos;
  const page = targetInfos.find((t) => t.type === "page");
  if (page === undefined) throw new Error("no page target");

  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  let nextId = 1;
  const pending = new Map();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    const entry = message.id === undefined ? undefined : pending.get(message.id);
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

const MEASURE = `(() => {
  const rect = (el) => el === null ? null : JSON.parse(JSON.stringify(el.getBoundingClientRect()));
  const header = document.querySelector("header");
  const menu = document.querySelector("nav[aria-label]");
  const row = menu === null ? null : menu.firstElementChild;
  const container = document.querySelector("main .marketing-container, .home-anchors .marketing-container");
  const cards = [...document.querySelectorAll('.home-anchors a[aria-label^="Explore"]')].map(rect);
  const style = (el) => el === null ? null : getComputedStyle(el);
  return {
    viewport: { width: window.innerWidth, height: window.innerHeight },
    documentHeight: document.documentElement.scrollHeight,
    header: { rect: rect(header), position: style(header)?.position },
    menu: { rect: rect(menu), position: style(menu)?.position, top: style(menu)?.top },
    menuRow: { rect: rect(row), scrollWidth: row?.scrollWidth ?? null, clientWidth: row?.clientWidth ?? null },
    containerWidth: container === null ? null : Math.round(rect(container).width),
    heroCards: cards.map((c) => ({ x: Math.round(c.x), y: Math.round(c.y), width: Math.round(c.width), height: Math.round(c.height) })),
    h1: { text: document.querySelector("h1")?.textContent?.trim(), fontSize: style(document.querySelector("h1"))?.fontSize },
  };
})()`;

/** Set the hash, let the smooth scroll settle, then read where the target landed. */
async function jump(send, id) {
  await evaluate(send, "window.scrollTo({ top: 0, behavior: 'instant' })");
  await sleep(120);
  await evaluate(send, `location.hash = ${JSON.stringify(`#${id}`)}`);
  let previous = -1;
  for (let attempt = 0; attempt < 40; attempt++) {
    await sleep(100);
    const y = await evaluate(send, "Math.round(window.scrollY)");
    if (y === previous) break;
    previous = y;
  }
  return await evaluate(
    send,
    `(() => {
      const target = document.getElementById(${JSON.stringify(id)});
      const menu = document.querySelector("nav[aria-label]");
      const header = document.querySelector("header");
      const t = target?.getBoundingClientRect();
      const m = menu?.getBoundingClientRect();
      const h = header?.getBoundingClientRect();
      return {
        id: ${JSON.stringify(id)},
        scrollY: Math.round(window.scrollY),
        targetTop: t === undefined ? null : Math.round(t.top),
        menuTop: m === undefined ? null : Math.round(m.top),
        menuBottom: m === undefined ? null : Math.round(m.bottom),
        headerBottom: h === undefined ? null : Math.round(h.bottom),
        gapBelowMenu: t === undefined || m === undefined ? null : Math.round(t.top - m.bottom),
      };
    })()`,
  );
}

/** Scroll to the top and wait until the browser agrees — scroll restoration fights a single call. */
async function toTop(send) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const y = await evaluate(
      send,
      "window.scrollTo({ top: 0, behavior: 'instant' }), Math.round(window.scrollY)",
    );
    if (y === 0) return;
    await sleep(100);
  }
  throw new Error("could not return the page to scrollY 0");
}

const main = async () => {
  const { send, close } = await attach();
  await send("Page.enable");
  await send("Runtime.enable");

  const report = { base: BASE, measuredAt: new Date().toISOString(), widths: [] };
  const failures = [];

  for (const width of [1440, 390]) {
    await send("Emulation.setDeviceMetricsOverride", {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: width < 700,
    });
    await send("Page.navigate", { url: `${BASE}/?qa=${width}` });
    for (let attempt = 0; attempt < 60; attempt++) {
      await sleep(150);
      const ready = await evaluate(
        send,
        `document.readyState === "complete" && document.querySelectorAll("[data-home-anchor]").length >= 7`,
      );
      if (ready) break;
    }
    await sleep(400);
    // `Page.navigate` to the same URL restores the previous scroll position, so the geometry below
    // has to be measured from the top or it reads a scrolled page.
    await toTop(send);

    const base = await evaluate(send, MEASURE);
    const questions = await jump(send, "questions");
    const nested = await jump(send, "personal-relationships");
    const howItWorks = await jump(send, "how-it-works");

    const entry = { width, ...base, jumps: { questions, nested, howItWorks } };
    report.widths.push(entry);

    // --- asserts -----------------------------------------------------------------------------
    if (base.menu.position !== "sticky")
      failures.push(`${width}: menu is ${base.menu.position}, not sticky`);
    // The menu is only *pinned* once the hero has scrolled past, so the pin is measured on a jump
    // that goes below the hero rather than at scrollY 0 (where its natural position is correct).
    const pinned = entry.jumps.questions.menuTop;
    if (pinned !== 80) {
      failures.push(`${width}: pinned menu top is ${pinned}px, expected 80 (--site-header-height)`);
    }
    const menuHeight = Math.round(base.menu.rect.height);
    if (Math.round(entry.jumps.questions.menuBottom) !== 80 + menuHeight) {
      // 80 (the pin) + the menu's own box, border included — the row is 52/48 and the box is 53/49.
      failures.push(
        `${width}: pinned menu bottom ${entry.jumps.questions.menuBottom} !== 80 + box ${menuHeight}`,
      );
    }
    for (const [name, jumpResult] of Object.entries(entry.jumps)) {
      if (jumpResult.gapBelowMenu === null) {
        failures.push(`${width}/${name}: target or menu missing`);
        continue;
      }
      if (jumpResult.gapBelowMenu < 0) {
        failures.push(
          `${width}/${name}: target top ${jumpResult.targetTop} is ${-jumpResult.gapBelowMenu}px under the menu (bottom ${jumpResult.menuBottom})`,
        );
      }
      if (jumpResult.menuTop !== null && jumpResult.menuTop < jumpResult.headerBottom - 1) {
        failures.push(
          `${width}/${name}: menu top ${jumpResult.menuTop} is under the header (bottom ${jumpResult.headerBottom})`,
        );
      }
    }
    if (width === 1440) {
      if (base.containerWidth !== 1152)
        failures.push(`1440: container is ${base.containerWidth}px, expected 1152`);
      const [first, second] = base.heroCards;
      if (first === undefined || second === undefined) failures.push("1440: hero cards not found");
      else if (second.y !== first.y)
        failures.push(
          `1440: hero cards stacked (y ${first.y} vs ${second.y}), expected side by side`,
        );
    }
    if (width === 390) {
      const [first, second] = base.heroCards;
      if (first !== undefined && second !== undefined && Math.abs(second.y - first.y) < 10) {
        failures.push("390: hero cards are side by side, expected stacked");
      }
      if (base.menuRow.scrollWidth <= base.menuRow.clientWidth) {
        failures.push(
          "390: the menu row does not scroll (scrollWidth <= clientWidth) — it may be wrapping",
        );
      }
    }

    console.log(
      `✓ ${width}: header ${Math.round(base.header.rect.height)}px, menu row ${Math.round(base.menuRow.rect.height)}px, container ${base.containerWidth}px, jumps ${JSON.stringify(Object.fromEntries(Object.entries(entry.jumps).map(([k, v]) => [k, v.gapBelowMenu])))}`,
    );
  }

  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
  close();

  if (failures.length > 0) {
    console.error(`\n✗ ${failures.length} measurement(s) failed:\n  - ${failures.join("\n  - ")}`);
    process.exitCode = 1;
  } else {
    console.log(`\n✓ all geometry asserts passed — ${OUT}`);
  }
};

await main();
