#!/usr/bin/env node
/**
 * scripts/design-audit.mjs — the v2 fidelity instrument: every doc's bundle reference beside the
 * live screen it claims to describe.
 *
 * ## Why this exists
 *
 * `docs/specs/v2-coverage-matrix.md` answers "does this screen paint the v2 token layer and carry
 * its bundle's structure", and it answers it with `file:line` citations. It does not answer "does
 * the screen look like the reference it was meant to replace", and the 51 v2 spec docs assert
 * `· design deltas open` 33 times while enumerating the deltas zero times. A gap asserted 33 times
 * and named 0 times cannot be scheduled and no card can accept it. This script is the measurement
 * half of closing that: it pairs one live capture with one reference render for every doc, and
 * `docs/specs/v2-rectification.md` is the authored half that names the differences.
 *
 * ## The instrument, and why it is not a screenshot diff
 *
 * Every bundle under `spec-design-v2-bundles/NN-*` ships the **HTML the reference PNGs were
 * rendered from** — `relationship-detail.html?state=live` is the page
 * `reference/rd-live-1280.png` is a photograph of. So the reference's text is extractable exactly,
 * with no OCR and no vision model, and so is the live screen's. The comparison this script performs
 * is therefore:
 *
 *   reference DOM text (bundle html, at the doc's state, at 1280/390)
 *     vs live DOM text (the demo deployment, at the doc's route, at the same widths)
 *
 * and the named delta is a string the reference draws and the live screen does not. That is the
 * shape of the three examples the card gives — "no trial-days marker in the rail", "tab counts
 * missing", "next-step callout absent" — all of which are DOM facts, not pixel judgements. The PNGs
 * are still written, because a human reads them; the register never claims a verdict from them that
 * this script did not measure, and a row whose difference is purely visual is `unverifiable`.
 *
 * ## Headless Chrome over CDP, and why not `--screenshot`
 *
 * The card names `google-chrome --headless=new --window-size=W,H --screenshot=<out> <url>`. That
 * command photographs the **viewport** at a height nothing controls, so a 1280 capture of a long
 * page is the top 800 px and pairs with nothing: the bundle references are full-page renders. It
 * also carries no cookies, and every screen this register is about sits behind a session. So the
 * same binary, in the same `--headless=new` mode, is driven over the DevTools protocol the browser
 * already exposes: a fixed **layout** width (390 and 1280 — the number that decides the layout, as
 * `--window-size` would) and a full-height capture (`Page.captureScreenshot` with
 * `captureBeyondViewport`). Still no dependency: Node 24 carries `WebSocket` and `fetch`.
 *
 * ## Sessions
 *
 * The demo branch only. `DEMO_AUTH`/`DEMO_PIN` come from the environment (`bin/withenv.sh <repo>
 * node scripts/design-audit.mjs --capture`), the PIN unlocks `/demo`, and a role button on `/login`
 * signs in the seeded account that role is about: `initiator`, `counterparty`, `admin`. Never a
 * production credential, and nothing is written — every route is a GET.
 *
 * ## Two callers
 *
 *   node scripts/design-audit.mjs --capture   resolves the three inputs, counts the docs, captures
 *                                             live + reference + side-by-side, writes the manifest
 *   node scripts/design-audit.mjs --check     the assertion: the register covers every doc that
 *                                             carries a build status, uses only the four verdict
 *                                             words, and gives each `deltas` row a named bullet
 *
 * `--check` is **not** a gate step on purpose: it reads three directories outside the checkout and
 * a network, so it cannot run in `verify.sh` or CI. It is the command the PR body and the register
 * quote, run by hand on a machine that has the spec drop.
 *
 * NO NEW DEPENDENCY. NO WRITE TO THE APP. NO PRODUCTION CREDENTIAL.
 */
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");

/** The map, authored row by row in `docs/specs/v2-surface-routes.json`. */
export const ROUTE_MAP = "docs/specs/v2-surface-routes.json";

/** The record this script's captures are checked against. */
export const REGISTER = "docs/specs/v2-rectification.md";

/** Where the evidence lands. The manifest is committed; the pixels are not. */
export const CAPTURES = "tests/design-captures";

/** The two layout widths every row is captured at. */
export const WIDTHS = [390, 1280];

/** The window height each capture is laid out at — a phone and a laptop. */
export const HEIGHT_FOR = { 390: 844, 1280: 800 };

/** The only verdicts a row may carry. */
export const VERDICTS = ["matches", "deltas", "not-built", "unverifiable"];

const DEFAULTS = {
  SPEC_DOCS_DIR: "/home/jadenblack/Desktop/dev.local/alignsynch/project-spec/spec-docs-v2",
  BUNDLES_DIR: "/home/jadenblack/Desktop/dev.local/alignsynch/project-spec/spec-design-v2-bundles",
  PROTOTYPE_DIR:
    "/home/jadenblack/Desktop/dev.local/alignsynch/project-spec/spec-design-v2-prototype",
};

const CHROME = process.env.CHROME ?? "/usr/bin/google-chrome";

/**
 * The ceiling on one CDP call. A page that never answers is a dead socket, not a slow render, and
 * the run must record that row rather than wait on it (see `Browser.send`).
 */
const CDP_TIMEOUT_MS = 60_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------------------------------------------------------------------------------------
 * 1. The status vocabulary, as a pure classification
 *
 * A doc's `status:` is prose, and the prose is the source of truth: "Built (#1144) · design deltas
 * open" is a built screen with a gap asserted, and counting it as anything else loses the whole
 * point of the register. The classifier is deliberately literal — it reads the words the docs use,
 * in the order they change the meaning — and a status it does not recognise is `untracked`, which
 * is counted and never invented into a bucket.
 * ------------------------------------------------------------------------------------------- */

/** Status words that assert a build with unnamed gaps. */
const DELTA_WORDS = [/design deltas open/i, /glossary deltas open/i, /deltas open per guide/i];

export function classifyStatus(status) {
  const s = String(status ?? "").trim();
  if (s === "") return "untracked";
  // A legend line ("Built | Designed | Prototype Only | Planned") is a table header, not a status.
  if (/\|/.test(s)) return "untracked";
  if (/^local only/i.test(s)) return "untracked";
  if (/^generated\b/i.test(s)) return "untracked";
  if (/^draft\b/i.test(s)) return "untracked";
  if (DELTA_WORDS.some((re) => re.test(s))) return "deltas-open";
  // `Planned` only when it is the whole status: "Built (…) · Planned: Basic-only price" is a built
  // screen with a planned sub-part, and counting it as unbuilt would lose the build.
  if (/^planned\b/i.test(s)) return "planned";
  if (/^designed\b/i.test(s)) return "designed";
  if (/^built\b/i.test(s)) return "built";
  return "untracked";
}

/** The status a register row prints, and the verdict its bucket defaults to. */
export const BUCKET_VERDICT = {
  "deltas-open": "deltas",
  built: "matches",
  designed: "not-built",
  planned: "not-built",
  untracked: null,
};

/* ---------------------------------------------------------------------------------------------
 * 2. Frontmatter, without a YAML dependency
 *
 * The docs carry five keys and a list; a parser that reads those five and refuses to invent the
 * rest is smaller and more honest than a YAML library in a tree that has none.
 * ------------------------------------------------------------------------------------------- */

function frontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { body: text, fields: {} };
  const fields = {};
  const sources = [];
  let inSources = false;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^(title|summary|audience|status):\s*(.*)$/);
    if (kv) {
      inSources = false;
      fields[kv[1]] = kv[2].replace(/^["']|["']$/g, "").trim();
      continue;
    }
    if (/^sources:\s*$/.test(line)) {
      inSources = true;
      continue;
    }
    const item = line.match(/^\s+-\s*(.*)$/);
    if (inSources && item) sources.push(item[1].replace(/^["']|["']$/g, "").trim());
  }
  if (sources.length > 0) fields.sources = sources;
  return { body: text.slice(m[0].length), fields };
}

/** `bundle: …`, `issues: …` and `code: …` out of the `sources:` list. */
export function readSources(sources = []) {
  const bundles = [];
  const issues = [];
  let code = "";
  for (const source of sources) {
    const bundle = source.match(/^bundle:\s*(.+)$/);
    if (bundle) for (const p of bundle[1].split(",")) bundles.push(p.trim());
    const issue = source.match(/^issues:\s*(.+)$/);
    if (issue) for (const m of issue[1].matchAll(/#(\d+)/g)) issues.push(Number(m[1]));
    const sha = source.match(/^code:\s*(.+)$/);
    if (sha) code = sha[1].trim();
  }
  return { bundles, issues, code };
}

function walkMarkdown(dir, out = []) {
  for (const name of readdirSync(dir).sort()) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walkMarkdown(path, out);
    else if (name.endsWith(".md")) out.push(path);
  }
  return out;
}

/** Every doc, with the fields the register prints. Derived — never a hardcoded list. */
export function readDocs(docsDir) {
  return walkMarkdown(docsDir).map((path) => {
    const { body, fields } = frontmatter(readFileSync(path, "utf8"));
    const { bundles, issues, code } = readSources(fields.sources);
    const status = fields.status ?? "";
    return {
      doc: relative(docsDir, path).split("\\").join("/"),
      title: fields.title ?? "",
      status,
      bucket: classifyStatus(status),
      bundles,
      issues,
      code,
      lines: body.split(/\r?\n/).length,
    };
  });
}

/* ---------------------------------------------------------------------------------------------
 * 3. The live/reference text comparison
 *
 * The delta a reader can act on is a string the reference draws and the live screen does not. Two
 * normalisations keep that honest: whitespace collapses, and text is compared case-sensitively on
 * the visible glyphs — so "Continue with 7 Days Free" and "Continue with 7 days free" are a real
 * finding (the copy rule is Title Case), which a case-insensitive compare would hide.
 * ------------------------------------------------------------------------------------------- */

/** Visible text, one line per run, trimmed, with the reference's own chrome removed. */
export function normaliseText(text) {
  return String(text ?? "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line !== "");
}

/** Lines of the reference that the live screen does not carry, longest-first. */
export function missingFromLive(referenceText, liveText, { minLength = 4 } = {}) {
  const live = new Set(normaliseText(liveText));
  const out = [];
  for (const line of normaliseText(referenceText)) {
    if (line.length < minLength) continue;
    if (live.has(line)) continue;
    out.push(line);
  }
  return out;
}

/* ---------------------------------------------------------------------------------------------
 * 4. Chrome, driven over the DevTools protocol
 * ------------------------------------------------------------------------------------------- */

class Browser {
  constructor({ chrome = CHROME, port } = {}) {
    this.chrome = chrome;
    this.port = port ?? 9400 + Math.floor(Math.random() * 400);
    this.profile = mkdtempSync(join(tmpdir(), "design-audit-"));
    this.child = null;
    this.ws = null;
    this.id = 0;
    this.pending = new Map();
  }

  async start() {
    this.child = spawn(
      this.chrome,
      [
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-dev-shm-usage",
        "--force-device-scale-factor=1",
        "--allow-file-access-from-files",
        `--user-data-dir=${this.profile}`,
        `--remote-debugging-port=${this.port}`,
        "about:blank",
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    let target = null;
    for (let i = 0; i < 120 && !target; i += 1) {
      try {
        const res = await fetch(`http://127.0.0.1:${this.port}/json/list`);
        if (res.ok) target = (await res.json()).find((t) => t.type === "page");
      } catch {
        /* not up yet */
      }
      if (!target) await sleep(125);
    }
    if (!target) throw new Error(`chrome did not open a page target on port ${this.port}`);
    this.ws = new WebSocket(target.webSocketDebuggerUrl);
    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        this.pending.get(message.id)(message);
        this.pending.delete(message.id);
      }
    });
    await new Promise((ok) => this.ws.addEventListener("open", ok, { once: true }));
    await this.send("Page.enable");
    await this.send("Runtime.enable");
    return this;
  }

  send(method, params = {}) {
    /*
     * **A CDP call is bounded, because a dead socket is not an answer.** A browser that dies
     * mid-run leaves `pending` holding a callback nobody will ever call, and the previous shape
     * awaited it forever: one closed tab mid-navigation stalled a 51-row run indefinitely, wrote no
     * manifest at all, and read exactly like "the capture is slow". The 60 s ceiling turns that into
     * a thrown error, which the row's own `catch` records as `capture failed: …` — the rest of the
     * run still lands.
     */
    return new Promise((ok, fail) => {
      this.id += 1;
      const id = this.id;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        fail(new Error(`CDP ${method} did not answer within ${CDP_TIMEOUT_MS} ms`));
      }, CDP_TIMEOUT_MS);
      this.pending.set(id, (message) => {
        clearTimeout(timer);
        ok(message);
      });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const reply = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (reply.result?.exceptionDetails) throw new Error(reply.result.exceptionDetails.text);
    return reply.result?.result?.value;
  }

  /** Navigate and wait for the network to settle. Returns the final path. */
  async go(url, { settle = 2600 } = {}) {
    await this.send("Page.navigate", { url });
    await sleep(settle);
    return this.evaluate("location.pathname + location.search");
  }

  /** Lay the page out at `width` and photograph all of it. */
  async shot(path, width) {
    const height = HEIGHT_FOR[width] ?? 800;
    await this.send("Emulation.setDeviceMetricsOverride", {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 600,
    });
    // Two frames, so a media-query-driven layout has settled before the pixels are taken.
    await this.evaluate("new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))");
    await sleep(250);
    const reply = await this.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: true,
    });
    const data = reply.result?.data;
    if (!data) throw new Error(`no screenshot data for ${path} at ${width}`);
    writeFileSync(path, Buffer.from(data, "base64"));
    await this.send("Emulation.clearDeviceMetricsOverride");
    return path;
  }

  async text() {
    return this.evaluate("document.body ? document.body.innerText : ''");
  }

  async stop() {
    try {
      this.ws?.close();
    } catch {
      /* already gone */
    }
    this.child?.kill("SIGKILL");
    await sleep(150);
  }
}

/**
 * The demo sign-in, exactly as a person does it: type the PIN at `/demo`, then pick a role on
 * `/login`. Both are server actions behind a native form, so `requestSubmit()` is enough.
 */
async function signIn(browser, { base, pin, role }) {
  if (!pin) return { ok: false, reason: "DEMO_PIN is not set in this environment" };
  await browser.go(`${base}/demo`, { settle: 2800 });
  const path = await browser.evaluate("location.pathname");
  if (path !== "/demo") return { ok: false, reason: `/demo did not render (landed on ${path})` };
  const submitted = await browser.evaluate(`(() => {
    const input = document.querySelector('#demo-pin');
    if (!input) return 'no PIN field';
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(input, ${JSON.stringify(pin)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const form = input.closest('form');
    if (!form) return 'no form';
    form.requestSubmit();
    return 'ok';
  })()`);
  if (submitted !== "ok") return { ok: false, reason: `the PIN gate refused: ${submitted}` };
  await sleep(3800);
  /*
   * The role button, twice at most — and the reason is measured, not defensive.
   *
   * `/demo`'s unlock cookie can be one round-trip behind the first role post: the first press signs
   * nothing in and leaves the reader on `/login`, and the same press on the second pass signs in.
   * Measured 2026-11-19 against the local demo branch, where the Initiator seat recorded
   * `NO SESSION` on every single-attempt run. Only the sign-in is retried, never the PIN, and two
   * attempts without a session is still `NO SESSION` — a retry that swallowed a real failure would
   * be worse than the race it hides.
   */
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const clicked = await browser.evaluate(`(() => {
      const wanted = ${JSON.stringify(role)};
      const button = [...document.querySelectorAll('button')]
        .find((b) => (b.textContent || '').replace(/\\s+/g, ' ').trim().toLowerCase().startsWith(wanted));
      if (!button) return 'no role button for ' + wanted;
      button.click();
      return 'ok';
    })()`);
    if (clicked !== "ok") return { ok: false, reason: `the role button: ${clicked}` };
    await sleep(5200);
    const landed = await browser.evaluate("location.pathname");
    if (!landed.startsWith("/login")) return { ok: true, landed };
  }
  return { ok: false, reason: "the role button did not sign in (two attempts)" };
}

/* ---------------------------------------------------------------------------------------------
 * 5. The inputs
 * ------------------------------------------------------------------------------------------- */

function resolveInputs(env = process.env) {
  const inputs = {
    docs: resolve(env.SPEC_DOCS_DIR ?? DEFAULTS.SPEC_DOCS_DIR),
    bundles: resolve(env.BUNDLES_DIR ?? DEFAULTS.BUNDLES_DIR),
    prototype: resolve(env.PROTOTYPE_DIR ?? DEFAULTS.PROTOTYPE_DIR),
  };
  const missing = Object.entries(inputs).filter(([, p]) => !existsSync(p));
  if (missing.length > 0) {
    throw new Error(
      `design-audit: input missing — ${missing.map(([k, p]) => `${k}=${p}`).join(", ")}`,
    );
  }
  return inputs;
}

/** The spec drop's root: the bundles and the docs are siblings under it. */
function specRoot(inputs) {
  return dirname(inputs.docs);
}

/** Where a `bundle:` path in a doc's frontmatter lands on disk, or null when it is a glob. */
function resolveBundlePath(inputs, spec) {
  if (!spec) return null;
  const cleaned = spec.replace(/\/$/, "");
  if (/[*?]/.test(cleaned)) return null;
  const candidate = join(specRoot(inputs), cleaned);
  if (existsSync(candidate)) return { path: candidate, exact: true };
  const asDir = join(inputs.bundles, basename(cleaned));
  if (existsSync(asDir)) return { path: asDir, exact: true };
  return null;
}

/* ---------------------------------------------------------------------------------------------
 * 6. The register, read back
 * ------------------------------------------------------------------------------------------- */

/** Rows of the register's table: `| doc | title | … |`, first cell a path under the docs dir. */
export function readRegister(markdown) {
  const rows = [];
  let inTable = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (/^\|\s*doc\s*\|/i.test(line)) {
      inTable = true;
      continue;
    }
    if (!inTable) continue;
    if (!line.startsWith("|")) {
      inTable = false;
      continue;
    }
    if (/^\|\s*-+/.test(line)) continue;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length < 9) continue;
    rows.push({
      doc: cells[0].replace(/`/g, "").trim(),
      title: cells[1],
      status: cells[2],
      route: cells[3],
      reference: cells[4],
      checkedAt: cells[5],
      verdict: cells[6].replace(/`/g, "").trim(),
      deltas: cells[7],
      issue: cells[8],
    });
  }
  return rows;
}

/** The named bullets under `### <doc>` in the register's delta section. */
export function readDeltas(markdown) {
  const out = new Map();
  let current = null;
  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^###\s+`?([^\s`]+\.md)`?\s*$/);
    if (heading) {
      current = heading[1];
      if (!out.has(current)) out.set(current, []);
      continue;
    }
    if (/^##\s/.test(line)) {
      current = null;
      continue;
    }
    if (current && /^\s*-\s+\S/.test(line)) out.get(current).push(line.trim().slice(2).trim());
  }
  return out;
}

/**
 * The assertion: the register is complete and uses only the four words. Every failure names the doc
 * and says what to do, because a check that only says "invalid" costs the next reader an hour.
 */
export function checkRegister({ docs, register, routeMap }) {
  const rows = readRegister(register);
  const deltas = readDeltas(register);
  const failures = [];
  const tracked = docs.filter((d) => BUCKET_VERDICT[d.bucket] !== null);
  const byDoc = new Map();
  for (const row of rows) {
    if (byDoc.has(row.doc)) failures.push(`${row.doc}: listed ${2} times — one row per doc`);
    byDoc.set(row.doc, row);
  }
  for (const doc of tracked) {
    const row = byDoc.get(doc.doc);
    if (!row) {
      failures.push(`${doc.doc}: missing from the register (status "${doc.status}")`);
      continue;
    }
    if (!VERDICTS.includes(row.verdict)) {
      failures.push(`${doc.doc}: verdict "${row.verdict}" is not one of ${VERDICTS.join(" · ")}`);
    }
    if (row.verdict === "deltas") {
      const bullets = deltas.get(doc.doc) ?? [];
      if (bullets.length === 0) {
        failures.push(`${doc.doc}: verdict deltas with no named bullet under ### ${doc.doc}`);
      }
    }
    if (row.verdict === "unverifiable" && (row.deltas === "" || row.deltas === "—")) {
      failures.push(`${doc.doc}: verdict unverifiable with no reason in its deltas cell`);
    }
    if (row.verdict === "matches" && doc.bucket === "deltas-open") {
      failures.push(
        `${doc.doc}: verdict matches while its status says "design deltas open" — either name the` +
          ` deltas or say why the status is stale`,
      );
    }
  }
  for (const row of rows) {
    if (!tracked.some((d) => d.doc === row.doc)) {
      failures.push(`${row.doc}: registered but carries no build status — it is not a row`);
    }
  }
  for (const row of rows) {
    const mapped = routeMap.rows.find((r) => r.doc === row.doc);
    if (!mapped) failures.push(`${row.doc}: not in ${ROUTE_MAP} — an unmapped doc is unverifiable`);
  }
  return { rows, deltas, failures, tracked };
}

/* ---------------------------------------------------------------------------------------------
 * 7. `--capture`
 * ------------------------------------------------------------------------------------------- */

function slugFor(doc) {
  return doc
    .replace(/\.md$/, "")
    .split("/")
    .filter((part) => part !== "reference" && part !== "guides")
    .join("-")
    .replace(/[^a-z0-9-]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

/** Fill `{relationship}`-style placeholders from the map's own measured ids. */
function fillRoute(route, entities) {
  if (!route) return null;
  return route.replace(/\{(\w+)\}/g, (whole, key) => {
    const value = entities[key];
    return typeof value === "string" && value !== "" ? value : whole;
  });
}

/**
 * The side-by-side: the live capture and the reference render at the same width, one image. Composed
 * by the same browser — an HTML page with the two files in it, photographed at twice the width — so
 * the tool that took the captures is the only tool that builds the pairing.
 */
async function compose(browser, { left, right, out, width, label }) {
  const html = `<!doctype html><meta charset="utf-8"><style>
    body{margin:0;background:#0f172a;font:600 13px/1.4 system-ui,sans-serif;color:#e2e8f0}
    .row{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:8px}
    figure{margin:0;display:flex;flex-direction:column;gap:4px}
    figcaption{text-transform:uppercase;letter-spacing:.08em;font-size:11px;color:#94a3b8}
    img{width:100%;height:auto;display:block;background:#fff}
  </style>
  <div class="row">
    <figure><figcaption>live · ${label} · ${width}</figcaption><img src="file://${left}"></figure>
    <figure><figcaption>reference · ${label} · ${width}</figcaption><img src="file://${right}"></figure>
  </div>`;
  const scratch = join(dirname(out), `.side-by-side-${width}.html`);
  writeFileSync(scratch, html, "utf8");
  await browser.go(`file://${scratch}`, { settle: 2200 });
  await browser.shot(out, width * 2);
  return out;
}

/** Render the bundle's own HTML at one width, and read its text. */
async function renderReference(browser, { htmlPath, query, click, out, width }) {
  const url = `file://${htmlPath}${query ?? ""}`;
  await browser.go(url, { settle: 1800 });
  // A prototype's stage rail is a *click*, not a URL: `?step=N` is rewritten to stage 1 by the
  // bundle's own script (measured 2026-11-19), so a reference for stage 2 has to press Stage 2.
  if (click) {
    const pressed = await browser.evaluate(`(() => {
      const wanted = ${JSON.stringify(click)};
      const leaf = [...document.querySelectorAll('*')]
        .find((el) => el.children.length === 0 && (el.textContent || '').trim() === wanted);
      if (!leaf) return 'no control labelled ' + wanted;
      (leaf.closest('a,button,[data-wz-step],[data-step]') || leaf).click();
      return 'ok';
    })()`);
    if (pressed !== "ok") return { text: await browser.text(), note: pressed };
    await sleep(900);
  }
  const text = await browser.text();
  await browser.shot(out, width);
  return { text, note: null };
}

/**
 * Drive the create flow to a stage, because the stage's own address is not enough: `/create/mode`
 * and `/create/aspects` answer 307 → `/create` until a draft exists (measured 2026-11-19, on every
 * seeded session). So the harness does what a person does — fills stage 1, presses the advance
 * control — and records the address it ended on instead of pretending the URL worked.
 */
async function driveWizard(browser, { base, template, target }) {
  await browser.go(`${base}/dashboard/templates/${template}/create`, { settle: 3200 });
  if (target < 2) return await browser.evaluate("location.pathname + location.search");
  const filled = await browser.evaluate(`(() => {
    const set = (el, value) => {
      const setter = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set;
      setter.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const fields = [...document.querySelectorAll('input,textarea')].filter((i) => i.type !== 'hidden');
    if (fields.length === 0) return 'no fields';
    for (const field of fields) {
      if (field.type === 'email' || /email/i.test(field.name || field.id)) {
        set(field, 'design-audit-' + Date.now() + '@example.com');
      } else {
        set(field, 'Design Audit Subject');
      }
    }
    return 'ok';
  })()`);
  if (filled !== "ok") throw new Error(`stage 1 would not fill: ${filled}`);
  for (let step = 1; step < target; step += 1) {
    const labels = {
      1: "Continue to Stage 2",
      2: "Continue to Stage 3",
      3: "Continue to Stage 4",
      4: "Continue to Stage 5",
    };
    const label = labels[step];
    if (!label) throw new Error(`no advance control known for stage ${step}`);
    const pressed = await browser.evaluate(`(() => {
      const button = [...document.querySelectorAll('button')]
        .find((b) => new RegExp(${JSON.stringify(label)}, 'i').test(b.textContent || ''));
      if (!button) return 'no button labelled ' + ${JSON.stringify(label)};
      button.click();
      return 'ok';
    })()`);
    if (pressed !== "ok") throw new Error(pressed);
    await sleep(4200);
  }
  return await browser.evaluate("location.pathname + location.search");
}

async function capture() {
  const inputs = resolveInputs();
  const docs = readDocs(inputs.docs);
  const routeMap = JSON.parse(readFileSync(join(ROOT, ROUTE_MAP), "utf8"));
  const tracked = docs.filter((d) => BUCKET_VERDICT[d.bucket] !== null);

  const base = process.env.DESIGN_AUDIT_BASE ?? routeMap.base ?? "https://demo.alignsynch.com";
  const outDir = resolve(ROOT, CAPTURES);
  mkdirSync(outDir, { recursive: true });

  console.log("design-audit — resolved inputs");
  console.log(`  SPEC_DOCS_DIR  ${inputs.docs}`);
  console.log(`  BUNDLES_DIR    ${inputs.bundles}`);
  console.log(`  PROTOTYPE_DIR  ${inputs.prototype}`);
  console.log(`  live base      ${base}`);
  console.log(`  captures       ${relative(ROOT, outDir)}/`);
  console.log("");
  const counts = {};
  for (const doc of docs) counts[doc.bucket] = (counts[doc.bucket] ?? 0) + 1;
  console.log(
    `design-audit — ${docs.length} docs · ${tracked.length} with a build status · ` +
      `${counts["deltas-open"] ?? 0} deltas open · ${counts.built ?? 0} built · ` +
      `${counts.designed ?? 0} designed · ${counts.planned ?? 0} planned · ` +
      `${counts.untracked ?? 0} untracked ({${Object.keys(counts).join(", ")}})`,
  );
  if (docs.length === 0) {
    throw new Error("design-audit: zero docs found — refusing to write an empty register");
  }
  console.log("");

  // The map is authored; the docs are derived. Every mapped row must be a real doc, and every
  // placeholder must have an id, or the run says which one it could not resolve and stops.
  const entities = routeMap.entities ?? {};
  const unresolved = [];
  for (const row of routeMap.rows) {
    if (row.route === null) continue;
    const filled = fillRoute(row.route, entities);
    if (/\{\w+\}/.test(filled)) unresolved.push(`${row.doc}: ${row.route}`);
  }
  if (unresolved.length > 0) {
    console.log("design-audit — placeholders with no id in the map's entities table:");
    for (const line of unresolved) console.log(`  ✗ ${line}`);
  }

  const roles = [...new Set(routeMap.rows.map((r) => r.role ?? "public"))].filter(
    (r) => r !== "public",
  );
  const sessions = new Map();
  const browsers = new Map();
  const pin = process.env.DEMO_PIN ?? "";
  const auth = (process.env.DEMO_AUTH ?? "").trim();

  if (roles.length > 0 && !(pin && auth === "1")) {
    console.log(
      `design-audit — no session: DEMO_AUTH=${auth || "unset"} and DEMO_PIN ` +
        `${pin ? "is set" : "is unset"}. Session rows will be recorded as unverifiable ` +
        `("no demo session in this environment"), and their captures will be the sign-in page.`,
    );
    console.log("");
  }

  for (const role of roles) {
    const browser = await new Browser().start();
    browsers.set(role, browser);
    /*
     * **The first role gets two attempts, because the unlock cookie is written by the act that just
     * happened.** `/demo`'s form sets the unlock cookie and `/login` reads it back when the role
     * button posts; for the first role in the list that read can beat the cookie's arrival, the
     * action refuses with its own sentence, and the page stays on `/login` — which is exactly what
     * "the role button did not sign in" reports. The second role onward never sees it. Retrying once
     * is not hiding a refusal (a real one is retried and re-reported with the same sentence); it is
     * giving the cookie the one round-trip it needs, so a role's capture is not lost to a race.
     */
    const first = await signIn(browser, { base, pin, role });
    const result = first.ok ? first : await signIn(browser, { base, pin, role });
    sessions.set(role, result);
    console.log(
      `design-audit — session ${role}: ${result.ok ? `signed in → ${result.landed}` : `NO SESSION (${result.reason})`}`,
    );
  }
  const anon = await new Browser().start();
  browsers.set("public", anon);
  const reference = await new Browser().start();
  browsers.set("reference", reference);
  console.log("");

  const manifest = {
    measuredAt: new Date().toISOString().slice(0, 10),
    base,
    head: process.env.DESIGN_AUDIT_HEAD ?? "",
    widths: WIDTHS,
    docs: docs.length,
    tracked: tracked.length,
    counts,
    sessions: Object.fromEntries(
      [...sessions].map(([role, s]) => [role, s.ok ? "signed in" : `none: ${s.reason}`]),
    ),
    rows: [],
  };

  let written = 0;
  let sideBySides = 0;
  for (const row of routeMap.rows) {
    const doc = docs.find((d) => d.doc === row.doc);
    if (!doc) {
      console.log(`  ✗ ${row.doc}: mapped but not a doc — remove the row`);
      continue;
    }
    if (BUCKET_VERDICT[doc.bucket] === null) continue;
    const slug = slugFor(doc.doc);
    const dir = join(outDir, slug);
    const url = fillRoute(row.route, entities);
    const unresolvedRoute = url !== null && /\{\w+\}/.test(url);
    let entry;
    try {
      mkdirSync(dir, { recursive: true });
      const role = row.role ?? "public";
      const browser = browsers.get(role === "public" ? "public" : role) ?? anon;
      const session = role === "public" ? { ok: true } : sessions.get(role);
      entry = {
        doc: doc.doc,
        slug,
        role,
        url: url ? `${base}${url}` : null,
        auth: row.auth,
        reference: null,
        captures: {},
        capturedAt: null,
        session: session?.ok ? "signed in" : `none: ${session?.reason ?? "not attempted"}`,
      };

      if (unresolvedRoute) {
        // A placeholder with no id is not a route: capturing it would photograph a 404 and call it
        // evidence. The row is recorded as uncaptured, and the register's reason quotes this line.
        entry.reason = `route ${url} has no id in the map's entities table`;
        console.log(`  ${entry.slug.padEnd(46)} ${url} — SKIPPED (${entry.reason})`);
      } else if (url) {
        let landed;
        if (row.prepare === "wizard") {
          // The stage's address alone answers 307 → /create; drive the flow the way a person does.
          landed = await driveWizard(browser, {
            base,
            template: entities.template,
            target: row.reference?.stage ?? 2,
          });
          entry.prepared = `wizard driven to stage ${row.reference?.stage ?? 2}`;
        } else {
          landed = await browser.go(`${base}${url}`, { settle: row.settle ?? 3000 });
        }
        entry.landed = landed;
        entry.signedOut = landed.startsWith("/login");
        const text = await browser.text();
        for (const width of WIDTHS) {
          const file = join(dir, `live-${width}.png`);
          await browser.shot(file, width);
          entry.captures[`live-${width}`] = relative(ROOT, file);
          written += 1;
        }
        writeFileSync(join(dir, "live.txt"), text, "utf8");
        entry.capturedAt = new Date().toISOString();

        // The reference: the bundle HTML this doc names, at the state the doc is about.
        const bundle = resolveBundlePath(inputs, doc.bundles[0]);
        const html = row.reference?.html
          ? join(specRoot(inputs), row.reference.html)
          : bundle
            ? guessBundleHtml(inputs, doc)
            : null;
        if (html && existsSync(html)) {
          entry.reference = {
            html: relative(specRoot(inputs), html),
            query: row.reference?.query ?? "",
          };
          const referenceText = {};
          for (const width of WIDTHS) {
            const file = join(dir, `reference-${width}.png`);
            const rendered = await renderReference(reference, {
              htmlPath: html,
              query: row.reference?.query ?? "",
              click: row.reference?.click ?? null,
              out: file,
              width,
            });
            referenceText[width] = rendered.text;
            if (rendered.note) entry.referenceNote = rendered.note;
            entry.captures[`reference-${width}`] = relative(ROOT, file);
            written += 1;
          }
          writeFileSync(
            join(dir, "reference.txt"),
            WIDTHS.map((w) => `### ${w}\n${referenceText[w]}`).join("\n\n"),
            "utf8",
          );
          const missing = {};
          for (const width of WIDTHS) missing[width] = missingFromLive(referenceText[width], text);
          writeFileSync(join(dir, "missing.json"), JSON.stringify(missing, null, 2), "utf8");
          entry.referenceMissing = {
            1280: missing[1280].length,
            390: missing[390].length,
          };
          const side = join(dir, "side-by-side.png");
          await compose(anon, {
            left: join(dir, "live-1280.png"),
            right: join(dir, "reference-1280.png"),
            out: side,
            width: 1280,
            label: slug,
          });
          entry.captures["side-by-side"] = relative(ROOT, side);
          sideBySides += 1;
        }
      }
    } catch (error) {
      // One row that cannot be driven is a finding, not the end of the run: the register records
      // why, and the other fifty rows still get measured.
      entry ??= { doc: doc.doc, slug, role: row.role ?? "public", url: null, captures: {} };
      entry.reason = `capture failed: ${error.message}`;
      console.log(`  ${slug.padEnd(46)} — FAILED (${entry.reason})`);
    }
    manifest.rows.push(entry);
    const flag = entry.signedOut ? " · signed out" : "";
    const missingCount = entry.referenceMissing
      ? ` · ref-only lines ${entry.referenceMissing[1280]}`
      : "";
    console.log(
      `  ${entry.slug.padEnd(46)} ${(url ?? "—").slice(0, 52).padEnd(52)} ${entry.session}${flag}${missingCount}`,
    );
  }

  writeFileSync(join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  for (const browser of browsers.values()) await browser.stop();

  console.log("");
  console.log(
    `design-audit — wrote ${written} images and ${sideBySides} side-by-sides for ` +
      `${manifest.rows.length} mapped rows → ${relative(ROOT, outDir)}/manifest.json`,
  );
  const signedOut = manifest.rows.filter((r) => r.signedOut).length;
  if (signedOut > 0) {
    console.log(
      `design-audit — ${signedOut} row(s) landed on the sign-in page and cannot be judged: ` +
        `those are unverifiable, with the reason the session line above gives.`,
    );
  }
  return 0;
}

/** The bundle html for a doc, when the map does not name one: the only html, or the first. */
function guessBundleHtml(inputs, doc) {
  const bundle = resolveBundlePath(inputs, doc.bundles[0]);
  if (!bundle?.exact || !statSync(bundle.path).isDirectory()) return null;
  const htmls = readdirSync(bundle.path).filter((n) => n.endsWith(".html"));
  return htmls.length === 1 ? join(bundle.path, htmls[0]) : null;
}

/* ---------------------------------------------------------------------------------------------
 * 8. `--check`
 * ------------------------------------------------------------------------------------------- */

function check() {
  const inputs = resolveInputs();
  const docs = readDocs(inputs.docs);
  const routeMap = JSON.parse(readFileSync(join(ROOT, ROUTE_MAP), "utf8"));
  const register = readFileSync(join(ROOT, REGISTER), "utf8");
  const { rows, failures, tracked } = checkRegister({ docs, register, routeMap });

  console.log("design-audit --check");
  console.log(`  SPEC_DOCS_DIR  ${inputs.docs}`);
  console.log(`  docs           ${docs.length}`);
  console.log(`  with a status  ${tracked.length}`);
  console.log(`  register rows  ${rows.length}`);
  console.log(
    `  ${docs.length} docs · ${tracked.length} with status · ` +
      `${rows.filter((r) => r.verdict === "unverifiable").length} unverifiable`,
  );
  if (failures.length > 0) {
    console.log("");
    for (const failure of failures) console.log(`  ✗ ${failure}`);
    return 1;
  }
  console.log(`\n  ✓ every doc with a build status has one row, in one of the four verdicts`);
  return 0;
}

/* ---------------------------------------------------------------------------------------------
 * 9. Entry
 * ------------------------------------------------------------------------------------------- */

const argv = process.argv.slice(2);
const known = new Set(["--capture", "--check", "--help"]);
const unknown = argv.filter((a) => !known.has(a));
if (unknown.length > 0) {
  console.error(`design-audit: unknown flag ${unknown.join(" ")} — try --capture or --check`);
  process.exit(2);
}
if (argv.includes("--help") || argv.length === 0) {
  console.log(
    "usage: node scripts/design-audit.mjs --capture | --check\n" +
      "  --capture  resolve the three inputs, count the docs, capture live + reference, write the manifest\n" +
      "  --check    assert the register covers every doc with a build status, in one of four verdicts\n" +
      "  env        SPEC_DOCS_DIR, BUNDLES_DIR, PROTOTYPE_DIR, DEMO_AUTH, DEMO_PIN, DESIGN_AUDIT_BASE, CHROME",
  );
  process.exit(argv.includes("--help") ? 0 : 2);
}

try {
  process.exit(argv.includes("--capture") ? await capture({ argv }) : check({ argv }));
} catch (error) {
  console.error(`design-audit: ${error.message}`);
  process.exit(1);
}
