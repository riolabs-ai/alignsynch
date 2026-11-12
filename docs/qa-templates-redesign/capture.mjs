#!/usr/bin/env node
/**
 * Headless Chrome over raw CDP, with no dependency: Node 24 has a global `WebSocket`, so the whole
 * harness is `fetch` + that. Drives one URL at a list of viewports, measures horizontal overflow
 * and the page's own geometry, and writes a full-page PNG per viewport.
 *
 *   node shoot.mjs <url> <out-dir> <width>x<height> [<width>x<height> ...]
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const [, , url, outDir, ...sizes] = process.argv;
mkdirSync(outDir, { recursive: true });

const PORT = 9229;
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
  for (let attempt = 0; attempt < 60; attempt += 1) {
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

await send("Page.enable");
await send("Runtime.enable");

const report = [];
for (const size of sizes) {
  const [width, height] = size.split("x").map(Number);
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 700,
  });
  await send("Page.navigate", { url });
  await sleep(1200);
  // Let fonts and the deferred images settle before measuring.
  await send("Runtime.evaluate", { expression: "document.fonts.ready", awaitPromise: true });
  await sleep(600);

  const measured = await send("Runtime.evaluate", {
    returnByValue: true,
    expression: `(() => {
      const de = document.documentElement;
      const overflowing = [...document.querySelectorAll("*")]
        .filter((el) => el.scrollWidth > de.clientWidth + 1)
        .slice(0, 6)
        .map((el) => el.tagName.toLowerCase() + (el.className && typeof el.className === "string" ? "." + el.className.split(/\\s+/).slice(0, 3).join(".") : ""));
      return {
        scrollWidth: de.scrollWidth,
        clientWidth: de.clientWidth,
        scrollHeight: de.scrollHeight,
        overflow: de.scrollWidth > de.clientWidth,
        overflowing,
        cards: document.querySelectorAll("[data-template-card]").length,
        realms: document.querySelectorAll("[data-templates-realm]").length,
        pics: [...document.querySelectorAll("img")].map((img) => img.currentSrc.split("/").pop() + " " + img.naturalWidth + "x" + img.naturalHeight),
        navScrolls: (() => {
          const row = document.querySelector("[data-templates-realm-nav] > div > div");
          return row ? row.scrollWidth > row.clientWidth : null;
        })(),
      };
    })()`,
  });

  const shot = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: true,
  });
  const file = `${outDir}/relationship-types-${width}.png`;
  writeFileSync(file, Buffer.from(shot.data, "base64"));
  report.push({ viewport: size, file, ...measured.result.value });
}

console.log(JSON.stringify(report, null, 2));
socket.close();
chrome.kill();
