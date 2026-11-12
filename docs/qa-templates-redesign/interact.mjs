#!/usr/bin/env node
/**
 * Interaction checks over raw CDP: the search filters the rendered cards, the clear control
 * restores them, and a realm anchor lands its heading below BOTH sticky bars.
 */
import { spawn } from "node:child_process";

const url = process.argv[2] ?? "http://localhost:3011/relationship-types";
const PORT = 9231;
const chrome = spawn(
  "/usr/bin/google-chrome",
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    "--hide-scrollbars",
    "--no-sandbox",
    "--disable-gpu",
    "about:blank",
  ],
  { stdio: "ignore" },
);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let ws;
for (let attempt = 0; attempt < 60 && ws === undefined; attempt += 1) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    ws = list.find((target) => target.type === "page")?.webSocketDebuggerUrl;
  } catch {
    /* starting */
  }
  if (ws === undefined) await sleep(250);
}
const socket = new WebSocket(ws);
await new Promise((resolve) => socket.addEventListener("open", resolve, { once: true }));
let nextId = 0;
const pending = new Map();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  const entry = pending.get(message.id);
  if (entry === undefined) return;
  pending.delete(message.id);
  if (message.error) entry.reject(new Error(JSON.stringify(message.error)));
  else entry.resolve(message.result);
});
const send = (method, params = {}) => {
  nextId += 1;
  socket.send(JSON.stringify({ id: nextId, method, params }));
  return new Promise((resolve, reject) => pending.set(nextId, { resolve, reject }));
};
const evaluate = async (expression) => {
  const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  return result.result.value;
};

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false,
});
await send("Page.navigate", { url });
await sleep(1800);

const report = {};

// 1. Type into the search: the result count and the number of cards left rendered.
await evaluate(`document.querySelector('#template-search').focus(), true`);
await send("Input.insertText", { text: "handover" });
await sleep(400);
report.search = await evaluate(`({
  count: document.querySelector('[data-templates-result-count]').textContent.trim(),
  cards: document.querySelectorAll('[data-template-card]').length,
  realms: document.querySelectorAll('[data-templates-realm]').length,
  clearVisible: !!document.querySelector('[data-templates-clear]'),
  value: document.querySelector('#template-search').value,
})`);

// 2. A query that matches nothing shows the empty state and no realm headings.
await evaluate(`(() => {
  const input = document.querySelector('#template-search');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(input, 'zzzznothing');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
})()`);
await sleep(400);
report.empty = await evaluate(`({
  count: document.querySelector('[data-templates-result-count]').textContent.trim(),
  cards: document.querySelectorAll('[data-template-card]').length,
  empty: !!document.querySelector('[data-templates-empty]'),
  realms: document.querySelectorAll('[data-templates-realm]').length,
})`);

// 3. The clear control restores the whole shelf.
await evaluate(`document.querySelector('[data-templates-clear]').click(), true`);
await sleep(400);
report.cleared = await evaluate(`({
  count: document.querySelector('[data-templates-result-count]').textContent.trim(),
  cards: document.querySelectorAll('[data-template-card]').length,
  realms: document.querySelectorAll('[data-templates-realm]').length,
})`);

// 4. Click the last realm anchor and measure where its heading lands against both sticky bars.
report.anchors = await evaluate(`(async () => {
  const header = document.querySelector('header');
  const nav = document.querySelector('[data-templates-realm-nav]');
  const link = [...document.querySelectorAll('[data-templates-realm-nav] a')].at(-1);
  const id = link.getAttribute('href').slice(1);
  link.click();
  await new Promise((r) => setTimeout(r, 1200));
  const heading = document.getElementById('heading-' + id);
  const top = heading.getBoundingClientRect().top;
  return {
    target: id,
    headingTop: Math.round(top),
    headerBottom: Math.round(header.getBoundingClientRect().bottom),
    navBottom: Math.round(nav.getBoundingClientRect().bottom),
    navIsStuck: Math.round(nav.getBoundingClientRect().top) === Math.round(header.getBoundingClientRect().bottom),
    cleared: top > nav.getBoundingClientRect().bottom,
  };
})()`);

// 5. The realm menu scrolls inside itself at 360 and the page does not.
await send("Emulation.setDeviceMetricsOverride", {
  width: 360,
  height: 780,
  deviceScaleFactor: 1,
  mobile: true,
});
await send("Page.navigate", { url });
await sleep(1500);
report.phone = await evaluate(`(() => {
  const row = document.querySelector('[data-templates-realm-nav] > div > div');
  return {
    page: [document.documentElement.scrollWidth, document.documentElement.clientWidth],
    nav: [row.scrollWidth, row.clientWidth],
    navScrolls: row.scrollWidth > row.clientWidth,
    cardRails: (() => {
      const card = document.querySelector('[data-template-card]');
      const art = card.querySelector('[data-realm-art]');
      return { cardHeight: Math.round(card.getBoundingClientRect().height), artWidth: Math.round(art.getBoundingClientRect().width), artHeight: Math.round(art.getBoundingClientRect().height) };
    })(),
  };
})()`);

console.log(JSON.stringify(report, null, 2));
socket.close();
chrome.kill();
