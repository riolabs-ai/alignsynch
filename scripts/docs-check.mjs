#!/usr/bin/env node
/**
 * scripts/docs-check.mjs — the proof behind the hub (#651), run by the gate in every lane.
 *
 * Five rules, each failing by name with a file and a line, so a docs change is told what is wrong
 * instead of that something is:
 *
 *   links    every relative link in every markdown file in the checkout resolves on disk
 *   images   every `![](…)` and every `<img src="…">` points at a file that exists
 *   hub      every page under `docs/` is listed in `docs/README.md` exactly once, and every row
 *            points at a document that exists — a page nobody lists is an orphan
 *   nav      every page carries the generated nav block above and below its body (the hub is the
 *            root of the nav and carries none), byte for byte as `scripts/docs-nav.mjs` writes it
 *   manifest `docs/docs.json` and the pages agree in both directions
 *
 * A PAGE IS WHAT THE INDEX CARRIES (#1020). The walk reads the filesystem, so a document that
 * `.gitignore` deliberately keeps out of the index — five `AUDIENCE-AND-POSITIONING.md` copies
 * under `docs/specs/`, excluded by name at `.gitignore:73-77` — used to be judged a page and failed
 * the gate as an orphan on a tree that was clean at `origin/main`. Membership is now `git ls-files`
 * under `docs/`, so a local excluded file is not a page and draws no message, while a *tracked* page
 * missing from the hub is still an orphan and still fails by name. The rule is the index, never a
 * path list: `git check-ignore` needs no separate query here, because a pattern that excludes a file
 * is precisely what keeps it out of the index, and a file that is *tracked despite* a matching
 * pattern is still shipped and therefore still a page. When git cannot answer for the root (no git
 * binary, or a `--root` copy that is not a work tree of its own), every walked file is kept: a check
 * that cannot read the index never silently stops checking.
 *
 * The nav and the hub are *generated*, so their two rules are freshness checks rather than
 * judgements: the failure text names the page and says `run pnpm docs:nav`.
 *
 *   node scripts/docs-check.mjs                # 0 = the docs graph is whole, 1 = named failures
 *   node scripts/docs-check.mjs --root <dir>   # the same, against another tree (how the rule is
 *                                              # demonstrated: fabricate a violation on a copy)
 *
 * NO CLOCK, NO NETWORK, NO DEPENDENCY.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  HUB,
  HUB_BEGIN,
  HUB_END,
  MANIFEST,
  loadManifest,
  navProblems,
  walkDocs,
} from "./docs-nav.mjs";
import { indexedPaths } from "./git-index.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Directories no link rule can say anything about: generated output, the vendor drop, other
 * checkouts. `lib/quizhub/` is a vendored template (gitignored) and its HTML-ish markdown is not
 * this repo's prose.
 */
const SKIP_DIRS = new Set([
  ".git",
  ".next",
  ".datacheck",
  ".migration",
  ".vercel",
  ".worktrees",
  "node_modules",
]);

/** Every markdown file in the checkout that a reader could be handed. */
function walkMarkdown(root) {
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      const rel = relative(root, full).split("\\").join("/");
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name) || rel === "lib/quizhub") continue;
        walk(full);
      } else if (entry.name.endsWith(".md")) {
        found.push(rel);
      }
    }
  };
  walk(root);
  return found.sort();
}

/**
 * The pages on disk, split by whether the index carries them. `skipped` is what this rule used to
 * judge and must not: a file that `.gitignore` keeps out of the index is not a page, so it draws no
 * orphan and no manifest failure — but it is counted, so the run says it saw one instead of
 * pretending the walk found nothing.
 */
function docsPages(root) {
  const walked = walkDocs(root).filter((file) => file !== HUB);
  const index = indexedPaths(root, "docs");
  if (index === null) return { pages: walked, skipped: [] };
  return {
    pages: walked.filter((file) => index.has(file)),
    skipped: walked.filter((file) => !index.has(file)),
  };
}

const LINK = /!?\[[^\]]*\]\(\s*(<[^>]*>|[^)\s]+)/g;
const HTML_IMAGE = /<img\b[^>]*\bsrc="([^"]+)"/gi;
const EXTERNAL = /^(#|[a-z][a-z0-9+.-]*:|\/\/)/i;

function lineAt(text, index) {
  return text.slice(0, index).split("\n").length;
}

/** A link destination, stripped of the wrappers markdown allows around it. */
function destination(raw) {
  const angle = raw.startsWith("<") && raw.endsWith(">");
  return (angle ? raw.slice(1, -1) : raw).split(" ")[0];
}

/** Placeholder and template text is not a path: `{slug}`, `<id>` and `$VAR` never resolve. */
function isPlaceholder(target) {
  return target === "" || /[{}<>$]/.test(target);
}

/** Resolve a relative destination the way a reader's browser would, then ask the disk. */
function resolves(root, file, target) {
  const path = target.split("#")[0];
  if (isPlaceholder(path)) return true;
  const fromRoot = path.startsWith("/");
  const base = fromRoot ? root : join(root, dirname(file));
  return existsSync(resolve(base, fromRoot ? path.slice(1) : path));
}

function checkLinks(root, files, problems) {
  let links = 0;
  let images = 0;
  for (const file of files) {
    const text = readFileSync(join(root, file), "utf8");
    for (const match of text.matchAll(LINK)) {
      const target = destination(match[1]);
      if (EXTERNAL.test(target) || isPlaceholder(target.split("#")[0])) continue;
      links += 1;
      const isImage = match[0].startsWith("!");
      if (isImage) images += 1;
      if (!resolves(root, file, target)) {
        problems.push(
          `${file}:${lineAt(text, match.index)}: ${isImage ? "image" : "link"} \`${target}\` does not resolve`,
        );
      }
    }
    for (const match of text.matchAll(HTML_IMAGE)) {
      const target = match[1];
      if (EXTERNAL.test(target) || isPlaceholder(target)) continue;
      images += 1;
      if (!resolves(root, file, target)) {
        problems.push(`${file}:${lineAt(text, match.index)}: image \`${target}\` does not resolve`);
      }
    }
  }
  return { links, images };
}

/** The rows the hub's generated region carries, in file order. */
function hubRows(text) {
  const start = text.indexOf(HUB_BEGIN);
  const end = text.indexOf(HUB_END);
  if (start === -1 || end === -1 || end < start) return null;
  const region = text.slice(start, end);
  const rows = [];
  for (const match of region.matchAll(/^- \[`([^`]+)`\]\(\s*([^)\s]+)\s*\)/gm)) {
    rows.push({ listed: match[1], target: match[2], line: lineAt(text, start + match.index) });
  }
  return rows;
}

function checkHub(root, pages, problems) {
  const target = join(root, HUB);
  if (!existsSync(target)) {
    problems.push(`${HUB}: the hub is missing — a page nothing lists is a page nobody finds`);
    return { rows: 0 };
  }
  const text = readFileSync(target, "utf8");
  const rows = hubRows(text);
  if (rows === null) {
    problems.push(`${HUB}: no ${HUB_BEGIN} / ${HUB_END} region — the contents cannot be read`);
    return { rows: 0 };
  }

  const counted = new Map();
  for (const row of rows) {
    const full = `docs/${row.listed}`;
    counted.set(full, (counted.get(full) ?? 0) + 1);
    if (!existsSync(join(root, full))) {
      problems.push(`${HUB}:${row.line}: lists \`${row.listed}\` and no such document exists`);
    }
    const normalised = row.target.replace(/^\.\//, "");
    if (normalised !== row.listed) {
      problems.push(
        `${HUB}:${row.line}: the row for \`${row.listed}\` links to \`${row.target}\` instead`,
      );
    }
  }

  for (const file of pages) {
    const count = counted.get(file) ?? 0;
    if (count === 0) {
      problems.push(`${file}: not listed in ${HUB} — an orphan page (add it to ${MANIFEST})`);
    } else if (count > 1) {
      problems.push(`${file}: listed ${count} times in ${HUB} — once is the rule`);
    }
  }

  // Freshness of the region is `navProblems()`' job — it compares the whole generated block.
  return { rows: rows.length };
}

function checkManifest(root, state, pages, problems) {
  // The manifest → disk direction is untouched by the skip: a row `docs.json` carries must name a
  // file, and a row pointing at nothing is still the failure it always was.
  for (const entry of state.entries) {
    if (!existsSync(join(root, entry.full))) {
      problems.push(`${MANIFEST}: lists \`${entry.path}\` and the document does not exist`);
    }
  }
  for (const file of pages) {
    if (!state.listed.has(file)) {
      problems.push(
        `${MANIFEST}: \`${file.replace(/^docs\//, "")}\` is missing — the hub cannot reach it`,
      );
    }
  }
  return { entries: state.entries.length };
}

function main(argv) {
  const rootFlag = argv.indexOf("--root");
  const root = rootFlag === -1 ? ROOT : resolve(argv[rootFlag + 1] ?? "");
  if (rootFlag !== -1 && !argv[rootFlag + 1]) {
    process.stderr.write("✗ --root needs a directory\n");
    return 2;
  }

  const state = loadManifest(root);
  const problems = [];
  const files = walkMarkdown(root);
  const { links, images } = checkLinks(root, files, problems);
  const { pages, skipped } = docsPages(root);
  const hub = checkHub(root, pages, problems);
  const manifest = checkManifest(root, state, pages, problems);
  problems.push(...navProblems(root));

  if (problems.length > 0) {
    const unique = [...new Set(problems)];
    process.stderr.write(
      `✗ docs:check — ${unique.length} problem${unique.length === 1 ? "" : "s"}:\n`,
    );
    for (const problem of unique) process.stderr.write(`  ✗ ${problem}\n`);
    return 1;
  }

  process.stdout.write(
    `  ${manifest.entries} document(s), ${hub.rows} hub row(s), ${links} link(s), ${images} image(s) — ` +
      `every link resolves, every page is listed once, every nav block is current` +
      (skipped.length === 0
        ? ""
        : ` (${skipped.length} file(s) under docs/ are not in the index — not pages, not checked)`) +
      "\n",
  );
  return 0;
}

try {
  process.exit(main(process.argv.slice(2)));
} catch (error) {
  process.stderr.write(`✗ ${error.message}\n`);
  process.exit(2);
}
