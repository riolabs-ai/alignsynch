/**
 * #971 — the register panel's vertical rhythm, measured: is the hero one column that fits?
 * Prints every direct child of the panel's inner column (mark, headline, sentence, tiles, rail,
 * label) with its box, then the gaps and whether anything overlaps or leaves the panel.
 */
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const BASE = process.argv[2] ?? "http://localhost:3438";
const PORT = 9354;
const chrome = spawn(
  "/usr/bin/google-chrome",
  [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--no-first-run",
    "--hide-scrollbars",
    `--remote-debugging-port=${PORT}`,
    "--user-data-dir=/tmp/t971-layout",
    "about:blank",
  ],
  { stdio: "ignore" },
);

const endpoint = async () => {
  for (let i = 0; i < 60; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === "page");
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error("chrome never exposed a page target");
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
await send("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
});
await send("Page.navigate", { url: `${BASE}/register` });

const PROBE = `(() => {
  const all = [...document.querySelectorAll("div")];
  const panel = all.find((el) => String(el.className).includes("bg-action") && String(el.className).includes("lg:w-1/2"));
  if (!panel) return { error: "no panel" };
  const column = [...panel.querySelectorAll("div")].find((el) => String(el.className).includes("z-10"));
  const box = (el) => { const r = el.getBoundingClientRect(); return { y: Math.round(r.y), bottom: Math.round(r.bottom), h: Math.round(r.height), x: Math.round(r.x), w: Math.round(r.width) }; };
  const rows = [...column.children].map((el) => ({ cls: String(el.className).slice(0, 40), text: el.textContent.trim().replace(/\\s+/g, " ").slice(0, 40), box: box(el) }));
  const tiles = [...column.querySelectorAll("div")].filter((el) => String(el.className).includes("p-4") && String(el.className).includes("backdrop-blur-sm")).map((el) => ({ text: el.textContent.trim().replace(/\\s+/g, " "), box: box(el) }));
  const overlaps = [];
  for (let i = 1; i < rows.length; i += 1) if (rows[i].box.y < rows[i - 1].box.bottom) overlaps.push([rows[i - 1].cls, rows[i].cls]);
  const panelBox = box(panel);
  return {
    innerWidth: window.innerWidth,
    panel: panelBox,
    column: box(column),
    rows, tiles, overlaps,
    leavesPanel: rows.some((r) => r.box.y < panelBox.y || r.box.bottom > panelBox.bottom),
  };
})()`;

let probe = null;
for (let i = 0; i < 100; i += 1) {
  await sleep(500);
  const result = await send("Runtime.evaluate", { expression: PROBE, returnByValue: true });
  probe = result.result?.value ?? null;
  if (probe && !probe.error && probe.rows?.length) break;
}
console.log(JSON.stringify(probe, null, 2));
ws.close();
chrome.kill();
