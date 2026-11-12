#!/usr/bin/env node
/**
 * scripts/docs-nav.mjs — the one generator behind "get anywhere from anywhere" (#651).
 *
 * `docs/` is 91 documents deep and only the ones `AGENTS.md` happened to name were reachable,
 * so two things are derived from one manifest (`docs/docs.json`) instead of being typed per page:
 *
 *   1. **the hub** — `docs/README.md`, every document exactly once, grouped by section, each row
 *      a link and the question the page answers. The authored preamble above the generated region
 *      is the only prose a human writes here;
 *   2. **the nav block** — every page carries the same block above and below the body: the hub, the
 *      section, the page and its prev/next neighbours inside that section. A new document cannot
 *      forget it, because a document that is not in the manifest has no block and `docs:check`
 *      names it.
 *
 * Two pages are written whole by their own generators (`docs/glossary.md`, `docs/ui-registry.md`),
 * so those two import `navRegion()` and emit the block themselves — the nav still has exactly one
 * author, and regenerating the glossary cannot drop it.
 *
 * The nav is not free text: `--check` compares every committed block and the whole hub region byte
 * for byte against what this script would write, and `scripts/docs-check.mjs` runs that comparison
 * as one of its named rules. `--write` is how a human fixes any of them.
 *
 *   node scripts/docs-nav.mjs --write          # rewrite the hub + every nav block
 *   node scripts/docs-nav.mjs --check          # 0 = current, 1 = named failure per stale page
 *   node scripts/docs-nav.mjs --check --root . # same, against another tree
 *
 * NO CLOCK, NO NETWORK, NO DEPENDENCY: the output is a pure function of `docs/docs.json` and the
 * manifest paths, so a run today and a run next week produce the same bytes.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, posix, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/** Repository root of this checkout — the default for every path below. */
export const DEFAULT_ROOT = resolve(HERE, "..");
export const MANIFEST = "docs/docs.json";
export const HUB = "docs/README.md";
export const NAV_BEGIN = "<!-- docs-nav:begin -->";
export const NAV_END = "<!-- docs-nav:end -->";
export const HUB_BEGIN = "<!-- docs-hub:begin -->";
export const HUB_END = "<!-- docs-hub:end -->";

/** Pages another generator owns whole; they emit the nav themselves through `navRegion()`. */
export const GENERATED_PAGES = new Set(["docs/glossary.md", "docs/ui-registry.md"]);

function readJson(target) {
  return JSON.parse(readFileSync(target, "utf8"));
}

/**
 * The manifest, flattened: one entry per document, in hub order, each carrying the section it
 * belongs to and the neighbours the nav block links to.
 */
export function loadManifest(root = DEFAULT_ROOT) {
  const manifest = readJson(join(root, MANIFEST));
  if (!Array.isArray(manifest.sections)) {
    throw new Error(`${MANIFEST}: "sections" must be an array`);
  }
  const entries = [];
  const seen = new Map();
  for (const section of manifest.sections) {
    if (!section.id || !section.title) {
      throw new Error(`${MANIFEST}: every section needs an "id" and a "title"`);
    }
    const docs = Array.isArray(section.docs) ? section.docs : [];
    const siblings = [];
    for (const doc of docs) {
      if (!doc.path || !doc.title || !doc.question) {
        throw new Error(`${MANIFEST}: every document needs "path", "title" and "question"`);
      }
      const full = `docs/${doc.path}`;
      if (seen.has(full)) {
        throw new Error(
          `${MANIFEST}: ${full} is listed twice (sections "${seen.get(full)}" and "${section.id}")`,
        );
      }
      seen.set(full, section.id);
      const entry = { ...doc, section, full };
      siblings.push(entry);
      entries.push(entry);
    }
    siblings.forEach((entry, index) => {
      entry.index = index;
      entry.prev = siblings[index - 1] ?? null;
      entry.next = siblings[index + 1] ?? null;
    });
  }
  return { manifest, entries, listed: new Set(entries.map((entry) => entry.full)) };
}

/** Every markdown file under `docs/`, as repo-relative POSIX paths. */
export function walkDocs(root = DEFAULT_ROOT) {
  const found = [];
  const base = join(root, "docs");
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".md")) found.push(relative(root, full).split("\\").join("/"));
    }
  };
  if (existsSync(base)) walk(base);
  return found.sort();
}

/** The manifest row for one document, for the generators that write a page whole. */
export function entryFor(full, root = DEFAULT_ROOT) {
  const { entries } = loadManifest(root);
  const entry = entries.find((candidate) => candidate.full === full);
  if (!entry) {
    throw new Error(`${full} is not listed in ${MANIFEST} — the hub cannot reach it`);
  }
  return entry;
}

/** The link from one repo-relative path to another, both POSIX. */
export function linkBetween(from, to) {
  return posix.relative(posix.dirname(from), to);
}

/** The breadcrumb line: hub › section › page, then prev and next inside the section. */
export function navLine(entry) {
  const hub = linkBetween(entry.full, HUB);
  const parts = [`[Docs hub](${hub}) › **${entry.section.title}** › ${entry.title}`];
  if (entry.prev)
    parts.push(`prev [${entry.prev.title}](${linkBetween(entry.full, entry.prev.full)})`);
  if (entry.next)
    parts.push(`next [${entry.next.title}](${linkBetween(entry.full, entry.next.full)})`);
  return parts.join(" · ");
}

/**
 * The block itself, without the blank lines a caller has to place around it. Both copies — the one
 * above the body and the one below it — are identical on purpose: a reader who finishes a page is
 * looking at the bottom of it.
 */
export function navRegion(entry) {
  return [NAV_BEGIN, "", navLine(entry), "", NAV_END];
}

/** Remove every nav block (and the blank line that led into it) from a document. */
export function stripNav(text) {
  const lines = text.split("\n");
  const out = [];
  for (let at = 0; at < lines.length; at += 1) {
    if (lines[at].trim() !== NAV_BEGIN) {
      out.push(lines[at]);
      continue;
    }
    let end = at;
    while (end < lines.length && lines[end].trim() !== NAV_END) end += 1;
    at = end;
    if (out.length > 0 && out[out.length - 1].trim() === "") out.pop();
  }
  return out.join("\n");
}

/** A whole document with the two nav blocks in their canonical place. */
export function withNav(text, entry) {
  const body = stripNav(text).replace(/\s+$/, "");
  const lines = body.split("\n");
  const heading = lines.findIndex((line) => /^#\s/.test(line));
  const at = heading === -1 ? 0 : heading + 1;
  const region = navRegion(entry);
  lines.splice(at, 0, "", ...region);
  const withBottom = `${lines.join("\n")}\n\n${region.join("\n")}\n`;
  return withBottom;
}

/** GitHub's own heading slug, so a contents link lands on the section it names. */
export function slugOf(title) {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");
}

/** The hub's generated region: a contents list, then one section of rows per group. */
export function renderHub({ manifest, entries }) {
  const total = entries.length;
  const groups = manifest.sections.length;
  const out = [
    `**${total} documents in ${groups} sections.** Every page carries the same nav block, generated`,
    "from `docs/docs.json` by `scripts/docs-nav.mjs`; `pnpm docs:check` fails by name when a page is",
    "missing from this hub, a link does not resolve, or a nav block is stale.",
    "",
    "## Contents",
    "",
  ];
  for (const section of manifest.sections) {
    out.push(`- [${section.title}](#${slugOf(section.title)}) — ${section.docs.length} documents`);
  }
  for (const section of manifest.sections) {
    out.push("", `## ${section.title}`, "", section.blurb ?? "", "");
    for (const entry of entries.filter((candidate) => candidate.section.id === section.id)) {
      const row = `- [\`${entry.full.replace(/^docs\//, "")}\`](${entry.path}) — **${entry.title}** — ${entry.question}`;
      out.push(row);
    }
  }
  return `${out.join("\n").replace(/\s+$/, "")}\n`;
}

/** Splice the rendered region between the hub markers, leaving the authored preamble alone. */
export function withHubRegion(text, region) {
  const start = text.indexOf(HUB_BEGIN);
  const end = text.indexOf(HUB_END);
  if (start === -1 || end === -1 || end < start) return null;
  return `${text.slice(0, start + HUB_BEGIN.length)}\n\n${region}\n${text.slice(end)}`;
}

/**
 * Every way the committed tree disagrees with what this script would write. Each string is a
 * complete, named failure — the caller prints them and returns 1.
 */
export function navProblems(root = DEFAULT_ROOT) {
  const state = loadManifest(root);
  const problems = [];

  for (const entry of state.entries) {
    const target = join(root, entry.full);
    if (!existsSync(target)) {
      problems.push(`${entry.full}: listed in ${MANIFEST} and is not on disk`);
      continue;
    }
    if (GENERATED_PAGES.has(entry.full)) continue; // its own generator emits the block
    const committed = readFileSync(target, "utf8");
    const want = withNav(committed, entry);
    if (committed !== want) {
      const blocks = committed.split(NAV_BEGIN).length - 1;
      problems.push(
        blocks === 0
          ? `${entry.full}: no nav block — run \`pnpm docs:nav\``
          : blocks === 1
            ? `${entry.full}: one nav block, two expected (above and below the body) — run \`pnpm docs:nav\``
            : `${entry.full}: nav block is stale — run \`pnpm docs:nav\``,
      );
    }
  }

  const hubTarget = join(root, HUB);
  if (!existsSync(hubTarget)) {
    problems.push(`${HUB}: the hub is missing — run \`pnpm docs:nav\``);
  } else {
    const committed = readFileSync(hubTarget, "utf8");
    const want = withHubRegion(committed, renderHub(state));
    if (want === null) {
      problems.push(`${HUB}: no ${HUB_BEGIN} / ${HUB_END} region — the hub cannot be regenerated`);
    } else if (committed !== want) {
      problems.push(`${HUB}: the contents region is stale — run \`pnpm docs:nav\``);
    }
  }

  return problems;
}

function main(argv) {
  const check = argv.includes("--check");
  const write = argv.includes("--write");
  const rootFlag = argv.indexOf("--root");
  const root = rootFlag === -1 ? DEFAULT_ROOT : resolve(argv[rootFlag + 1] ?? "");
  if (!check && !write) {
    process.stderr.write("✗ pass --check (verify) or --write (regenerate)\n");
    return 2;
  }
  if (rootFlag !== -1 && !argv[rootFlag + 1]) {
    process.stderr.write("✗ --root needs a directory\n");
    return 2;
  }

  const state = loadManifest(root);
  if (check) {
    const problems = navProblems(root);
    if (problems.length > 0) {
      process.stderr.write(
        `✗ docs nav is stale (${problems.length} problem${problems.length === 1 ? "" : "s"}):\n`,
      );
      for (const problem of problems) process.stderr.write(`  ✗ ${problem}\n`);
      return 1;
    }
    process.stdout.write(
      `  ${state.entries.length} document(s) carry the current nav, ${HUB} is current\n`,
    );
    return 0;
  }

  let written = 0;
  for (const entry of state.entries) {
    const target = join(root, entry.full);
    if (!existsSync(target) || GENERATED_PAGES.has(entry.full)) continue;
    const committed = readFileSync(target, "utf8");
    const want = withNav(committed, entry);
    if (committed !== want) {
      writeFileSync(target, want);
      written += 1;
    }
  }
  const hubTarget = join(root, HUB);
  if (!existsSync(hubTarget)) {
    process.stderr.write(`✗ ${HUB} does not exist — the hub is authored once, then generated\n`);
    return 1;
  }
  const hubCommitted = readFileSync(hubTarget, "utf8");
  const hubWant = withHubRegion(hubCommitted, renderHub(state));
  if (hubWant === null) {
    process.stderr.write(`✗ ${HUB}: no ${HUB_BEGIN} / ${HUB_END} region\n`);
    return 1;
  }
  if (hubWant !== hubCommitted) {
    writeFileSync(hubTarget, hubWant);
    written += 1;
  }
  process.stdout.write(
    `✓ docs nav — ${state.entries.length} documents, ${state.manifest.sections.length} sections, ${written} file(s) rewritten\n`,
  );
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (error) {
    process.stderr.write(`✗ ${error.message}\n`);
    process.exit(2);
  }
}
