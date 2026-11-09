#!/usr/bin/env node
/**
 * `pnpm prototype:save` — the sink behind the prototype's `Save .json` button.
 *
 * **Why a local service and not a download.** The review artifact is a `file://` page opened in a
 * browser, and a browser cannot write to a repository: the old button made a Blob and clicked an
 * anchor, which in an embedded preview pane lands nowhere at all. So the page POSTs the copy tree
 * here, and this writes three things inside the repo:
 *
 *   1. `docs/review/artifacts/<page>.copy.json` — the state exactly as saved, so the words the
 *      owner typed are a committed file and not something living in one browser profile;
 *   2. the page's own `DEFAULT_COPY` literal, **value by value** — only the keys that changed are
 *      rewritten, so the provenance comments beside them survive (a whole-literal rewrite would
 *      delete them, and a rewritten literal the page cannot parse is worse than no save);
 *   3. `docs/review/artifacts/PROTOTYPE-CHANGES.md` — an append-only log, one dated entry per save,
 *      each changed key with its old value beside its new one. That log is what the implementation
 *      reads: a copy change an engineer cannot see is a change that does not ship.
 *
 * **A save is diffed against the file, never against the browser.** `localStorage` overrides can be
 * older than the committed defaults, so the comparison base is the page on disk — otherwise the log
 * would report yesterday's edits again every time.
 *
 * It binds `127.0.0.1` only, takes no write path from the request, and refuses a page name that is
 * not a file in this directory. Nothing here is reachable from off the machine.
 *
 *   node scripts/prototype-save.mjs                 # http://127.0.0.1:8791
 *   PROTOTYPE_SAVE_PORT=9000 node …                 # a port of your own
 *   node scripts/prototype-save.mjs --once <json>   # write one payload from a file, then exit
 *   node scripts/prototype-save.mjs --once <json> --dry-run   # report the diff, write nothing
 */
import { createServer } from "node:http";
import { existsSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";

const PORT = Number(process.env.PROTOTYPE_SAVE_PORT ?? 8791);
const ROOT = join(import.meta.dirname, "..");
const ARTIFACTS = join(ROOT, "docs", "review", "artifacts");
const PAGE = "prototype-relationship-lifecycle-v7.html";
const LOG = join(ARTIFACTS, "PROTOTYPE-CHANGES.md");

/** The page this sink serves, refused unless it is a bare file name in the artifacts directory. */
function pagePath(name) {
  const file = (name ?? PAGE).trim();
  if (file !== file.split("/").pop() || !file.endsWith(".html")) {
    throw new Error(`not a page in docs/review/artifacts: ${file}`);
  }
  const path = join(ARTIFACTS, file);
  if (!existsSync(path)) throw new Error(`no such page: ${file}`);
  return { file, path };
}

/**
 * The `DEFAULT_COPY` literal's extent. **Both the read and the rewrite are scoped to this span**,
 * and that is not tidiness: the page is full of `"key": "otherKey"` pairs outside it — a ternary
 * like `isGallery ? "s1.galleryNote" : "s1.dashboardNote"` reads as one — and an unscoped scan
 * diffed every key against the *name* of its fallback and then rewrote the ternary. Measured: nine
 * rows of nonsense in the change log and two wrong values in the page.
 */
function copySpan(html) {
  const start = html.indexOf("const DEFAULT_COPY = {");
  if (start < 0) throw new Error("no DEFAULT_COPY literal — refusing to save");
  const end = html.indexOf("\n};", start);
  if (end < 0) throw new Error("DEFAULT_COPY is unterminated — refusing to save");
  return { start, end: end + 3 };
}

/**
 * Every `"key": "value"` pair inside that span, read in place.
 *
 * The literal carries comments between its entries, so it is not parsed as JSON — the pairs are
 * matched individually and each value is unescaped on its own. That is enough to diff and to
 * rewrite one value without touching the structure around it.
 */
function readValues(html) {
  const values = new Map();
  for (const match of html.matchAll(/"([\w.]+)"\s*:\s*("(?:[^"\\]|\\.)*")/g)) {
    try {
      values.set(match[1], { value: JSON.parse(match[2]), raw: match[2], index: match.index });
    } catch {
      /* a literal this reader does not understand is left alone, not guessed at */
    }
  }
  return values;
}

/** A JSON string literal that can sit inside the page's source without breaking it. */
const literal = (value) => JSON.stringify(value);

/**
 * Replace one key's value, keeping everything around it. The search is anchored on the quoted key
 * followed by its colon, and the replacement is bounded to that pair.
 */
function rewrite(html, key, value) {
  const { start, end } = copySpan(html);
  const body = html.slice(start, end);
  const pattern = new RegExp(
    `("${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\s*:\\s*)"(?:[^"\\\\]|\\\\.)*"`,
  );
  if (!pattern.test(body)) throw new Error(`cannot find the value for "${key}" — refusing to save`);
  const nextBody = body.replace(pattern, (_match, head) => head + literal(value));
  return html.slice(0, start) + nextBody + html.slice(end);
}

/** The log entry a save appends: what changed, old beside new, in the order the page lists them. */
function entry({ file, changes, removed, added, savedAt }) {
  const lines = [`## ${savedAt} — \`${file}\``, ""];
  if (changes.length === 0 && removed.length === 0 && added.length === 0) {
    lines.push("No copy differs from the committed page. Nothing to implement.", "");
    return `${lines.join("\n")}\n`;
  }
  if (changes.length > 0) {
    lines.push("| key | was | now |", "| --- | --- | --- |");
    for (const { key, was, now } of changes) {
      const cell = (text) => String(text).replace(/\|/g, "\\|").replace(/\n/g, " ");
      lines.push(`| \`${key}\` | ${cell(was)} | ${cell(now)} |`);
    }
    lines.push("");
  }
  if (added.length > 0) lines.push(`- **added** ${added.map((k) => `\`${k}\``).join(", ")}`, "");
  if (removed.length > 0)
    lines.push(`- **removed** ${removed.map((k) => `\`${k}\``).join(", ")}`, "");
  lines.push(
    "Which screens these reach: each key's prefix names its stage — `s4.` Details, `s5.` Settings,",
    "`s6.` Aspects, `s7.` Invite, `s8.`/`s9.` Connect, `s10.` the dashboard's relationship — and the",
    "implementing card moves them into `data/pages/*` rather than the artifact.",
    "",
  );
  return `${lines.join("\n")}\n`;
}

/** Write the payload. Returns what it did, so the caller can report it rather than assume it. */
function save(payload, { dryRun = false } = {}) {
  const { file, path } = pagePath(payload.page);
  const html = readFileSync(path, "utf8");
  const { start, end } = copySpan(html);
  const current = readValues(html.slice(start, end));
  const incoming = payload.copy ?? {};

  const changes = [];
  const added = [];
  for (const [key, raw] of Object.entries(incoming)) {
    const now = String(raw);
    const before = current.get(key);
    if (!before) {
      added.push(key);
      changes.push({ key, was: "(new key)", now });
      continue;
    }
    if (before.value !== now) changes.push({ key, was: before.value, now });
  }
  const removed = [...current.keys()].filter((key) => !(key in incoming));

  // Only the keys whose value moved are rewritten: an untouched entry keeps its line, its comment
  // and its ordering, so the page's diff is exactly the owner's edit.
  let next = html;
  for (const { key, was, now } of changes) {
    if (was === "(new key)") continue;
    next = rewrite(next, key, now);
  }

  const savedAt = new Date().toISOString().replace("T", " ").slice(0, 16);
  const snapshot = {
    savedAt,
    page: file,
    source: "prototype Save .json",
    copy: Object.fromEntries(
      Object.entries(incoming)
        .map(([k, v]) => [k, String(v)])
        .sort(([a], [b]) => a.localeCompare(b)),
    ),
    aspects: payload.aspects ?? null,
  };

  const summary = {
    file,
    changes: changes.length,
    added: added.length,
    removed: removed.length,
    savedAt,
  };
  if (dryRun) return summary;

  writeFileSync(path, next);
  writeFileSync(
    join(ARTIFACTS, `${file.replace(/\.html$/, "")}.copy.json`),
    `${JSON.stringify(snapshot, null, 2)}\n`,
  );
  if (!existsSync(LOG)) {
    writeFileSync(
      LOG,
      [
        "# Prototype copy changes",
        "",
        "One entry per `Save .json` pressed in the review artifact. Written by",
        "[`scripts/prototype-save.mjs`](../../../scripts/prototype-save.mjs); never edited by hand.",
        "Each row is a string the owner changed in place, with what it said before — this is the",
        "record the implementing card works from.",
        "",
      ].join("\n"),
    );
  }
  appendFileSync(LOG, entry({ file, changes, removed, added, savedAt }));
  return summary;
}

/* --once: the same write from a piece of JSON on disk, for a save driven by a script or a test. */
const onceIndex = process.argv.indexOf("--once");
if (onceIndex > -1) {
  const input = process.argv[onceIndex + 1];
  if (!input) {
    console.error("prototype-save: --once needs a JSON file");
    process.exit(2);
  }
  const summary = save(JSON.parse(readFileSync(input, "utf8")), {
    dryRun: process.argv.includes("--dry-run"),
  });
  console.log(JSON.stringify(summary));
  process.exit(0);
}

const server = createServer((req, res) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
  };
  if (req.method === "OPTIONS") {
    res.writeHead(204, cors);
    res.end();
    return;
  }
  if (req.method === "GET" && req.url?.startsWith("/health")) {
    res.writeHead(200, { ...cors, "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, page: PAGE }));
    return;
  }
  if (req.method !== "POST" || !req.url?.startsWith("/copy")) {
    res.writeHead(404, cors);
    res.end("not found");
    return;
  }
  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
  });
  req.on("end", () => {
    try {
      const summary = save(JSON.parse(body));
      console.log(
        `prototype-save: ${summary.changes} change(s) → ${summary.file} (${summary.savedAt})`,
      );
      res.writeHead(200, { ...cors, "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, ...summary }));
    } catch (error) {
      console.error("prototype-save:", error.message);
      res.writeHead(400, { ...cors, "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: error.message }));
    }
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`prototype-save: listening on http://127.0.0.1:${PORT} — ${PAGE}`);
  console.log(
    "  press Save .json in the prototype; each save writes the page, a .copy.json and the change log",
  );
});
