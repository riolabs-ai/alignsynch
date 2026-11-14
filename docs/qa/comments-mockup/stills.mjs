/**
 * #921 QA stills — the comments mockup, captured from the artifact itself.
 *
 * No driver dependency: headless Chrome over CDP, the same plumbing as `docs/qa/873/stills.mjs`.
 * Unlike that rig this one needs no server, no cookies and no database — the artifact is a
 * standalone document, so the shutter opens on `file://<the committed file>` at the address the
 * reviewer would use (`?variant=&subject=&viewport=&spec=`). The picture and the page the owner
 * clicks are therefore the same document, not two builds of it.
 *
 * Every frame is asserted in the DOM before the shutter:
 *   — the heading is the artifact's, so a blank frame cannot pass as a capture
 *   — innerWidth is the width asked for, and scrollWidth equals it (no horizontal overflow)
 *   — data-vw / data-variant / data-subject are the drawing asked for
 *   — the specimen count is the one the address implies
 *
 * Usage, from the repo root:
 *   node docs/qa/comments-mockup/stills.mjs [outDir]
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const OUT = process.argv[2] ?? "docs/qa-comments-mockup";
const PORT = 9341;
const ARTIFACT = resolve("docs/review/artifacts/prototype-comments-v1.html");

mkdirSync(OUT, { recursive: true });

const chrome = spawn(
  "/usr/bin/google-chrome",
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    "--user-data-dir=/tmp/chrome-qa-comments",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--hide-scrollbars",
    "--allow-file-access-from-files",
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
await new Promise((done, fail) => {
  ws.addEventListener("open", done, { once: true });
  ws.addEventListener("error", fail, { once: true });
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
  return new Promise((done) => pending.set(callId, done));
}

async function evaluate(expression) {
  const res = await send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (res.result?.exceptionDetails) {
    throw new Error(`evaluate failed: ${res.result.exceptionDetails.text}`);
  }
  return res.result?.result?.value;
}

await send("Page.enable");
await send("Runtime.enable");

const report = [];

async function shoot({ file, label, width, query, expect }) {
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height: 900,
    deviceScaleFactor: 1,
    mobile: width < 500,
  });
  const loaded = new Promise((done) => {
    const onMsg = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.method === "Page.loadEventFired") {
        ws.removeEventListener("message", onMsg);
        done();
      }
    };
    ws.addEventListener("message", onMsg);
  });
  await send("Page.navigate", { url: `file://${ARTIFACT}${query}` });
  await loaded;
  await sleep(500);

  const facts = await evaluate(`(() => {
    const doc = document.documentElement;
    return {
      title: document.title,
      h1: document.querySelector("h1")?.textContent?.trim() ?? null,
      innerWidth: window.innerWidth,
      scrollWidth: doc.scrollWidth,
      docHeight: doc.scrollHeight,
      vw: document.body.dataset.vw,
      variant: document.body.dataset.variant,
      subject: document.body.dataset.subject,
      specimens: document.querySelectorAll(".specimen").length,
      rails: document.querySelectorAll(".pair-rail").length,
      forms: document.querySelectorAll("form").length,
      disabledSubmits: [...document.querySelectorAll("form button[type=submit]")].filter((b) => b.disabled).length,
      lockedNotes: document.querySelectorAll(".lock").length,
      refusals: document.querySelectorAll(".refusal").length,
      placeholders: document.querySelectorAll(".ph").length,
      overflowers: [...document.querySelectorAll(".card, .comment, .cbody, .ctext, .cname")]
        .filter((el) => el.scrollWidth > el.clientWidth + 1)
        .map((el) => el.className),
    };
  })()`);

  const problems = [];
  if (!facts.h1?.includes("Comments on an opinion")) problems.push("heading missing");
  if (facts.innerWidth !== width) problems.push(`innerWidth ${facts.innerWidth} != ${width}`);
  if (facts.scrollWidth !== facts.innerWidth)
    problems.push(`horizontal overflow: ${facts.scrollWidth}`);
  if (facts.overflowers.length > 0)
    problems.push(`elements overflow: ${facts.overflowers.join(", ")}`);
  if (facts.specimens !== expect.specimens) problems.push(`specimens ${facts.specimens}`);
  for (const [key, value] of Object.entries(expect.facts ?? {})) {
    if (facts[key] !== value)
      problems.push(`${key} ${JSON.stringify(facts[key])} != ${JSON.stringify(value)}`);
  }
  if (problems.length > 0) {
    chrome.kill();
    throw new Error(`${label}: ${problems.join("; ")}`);
  }

  const height = Math.min(facts.docHeight, 12000);
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 500,
  });
  await sleep(300);
  const shot = await send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  writeFileSync(`${OUT}/${file}`, Buffer.from(shot.result.data, "base64"));
  report.push({ file, label, width, height, ...facts });
  console.log(
    `${file} — ${width}×${height} · ${facts.specimens} specimen(s) · ${facts.placeholders} placeholders marked`,
  );
}

/* 1 — Variant A, 1440: the whole drawing for the aspect opinion, thread inline. */
await shoot({
  file: "comments-1440-variant-a.png",
  label: "1440 · variant A · aspect opinion",
  width: 1440,
  query: "?variant=A&subject=opinion&viewport=1440",
  expect: { specimens: 7, facts: { vw: "1440", variant: "A", subject: "opinion" } },
});

/* 2 — Variant B, 1440: the same states with the thread beside the subject. */
await shoot({
  file: "comments-1440-variant-b.png",
  label: "1440 · variant B · aspect opinion",
  width: 1440,
  query: "?variant=B&subject=opinion&viewport=1440",
  expect: { specimens: 7, facts: { vw: "1440", variant: "B", subject: "opinion" } },
});

/* 3 — 390, the long body: the frame the card names by width. */
await shoot({
  file: "comments-390-long-body.png",
  label: "390 · variant A · aspect opinion · long body",
  width: 390,
  query: "?variant=A&subject=opinion&viewport=390&spec=long",
  expect: { specimens: 1, facts: { vw: "390", variant: "A", subject: "opinion" } },
});

/* 4–5 — the other two subjects, variant A at 1440, so all three anchors are visible as pictures. */
await shoot({
  file: "comments-1440-variant-a-assessment.png",
  label: "1440 · variant A · assessment",
  width: 1440,
  query: "?variant=A&subject=assessment&viewport=1440",
  expect: { specimens: 7, facts: { vw: "1440", variant: "A", subject: "assessment" } },
});
await shoot({
  file: "comments-1440-variant-a-relationship.png",
  label: "1440 · variant A · relationship",
  width: 1440,
  query: "?variant=A&subject=relationship&viewport=1440",
  expect: { specimens: 7, facts: { vw: "1440", variant: "A", subject: "relationship" } },
});

writeFileSync(
  `${OUT}/capture-report.json`,
  `${JSON.stringify({ artifact: ARTIFACT, at: new Date().toISOString(), frames: report }, null, 2)}\n`,
);
console.log(`\n${report.length} frames written to ${OUT}/`);
chrome.kill();
