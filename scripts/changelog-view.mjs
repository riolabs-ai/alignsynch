#!/usr/bin/env node
/**
 * changelog-view — `docs/changelog/` as a **view** of `CHANGELOG.md` (#652).
 *
 * THE RULE THIS SCRIPT ENFORCES. `CHANGELOG.md` is the source of truth: `scripts/release.sh`
 * generates it from the conventional commits, `pnpm release:check` owns it, and each
 * `## [x.y.z] - <date>` block is also the body of its GitHub Release, byte for byte. A release
 * blog that retyped those facts would be a second opinion, and the day the two disagreed nobody
 * could tell which one was wrong. So the blog may not retype anything that is already in the
 * entry: the date, the tag, the count of pull requests the entry names, **the entry's own sections
 * and bullets**, and the whole Known limits block are copied here from the entry by this script,
 * between markers, and `--check` fails when a copy has drifted.
 *
 * WHAT IS AUTHORED AND WHAT IS DERIVED — the same split `scripts/gen-ui-registry.mjs` makes, for
 * the same reason. Derived: every fact above. Authored: the prose that makes the entry readable as
 * a story — what was painful before, what it does now, the diagram, the screenshots, and the two
 * one-line judgements in `docs/changelog/releases.json` (`theme`, `headline`). A generator that
 * wrote "what was painful before" would be writing history it cannot read, and a hand-typed date
 * would be a fact that drifts. Neither half may fill in the other, and `--check` fails when either
 * moves alone.
 *
 * THE BIJECTION, BOTH DIRECTIONS. Every `## [version] - date` block in `CHANGELOG.md` has exactly
 * one page under `docs/changelog/` and exactly one row in `releases.json`; a row for a version the
 * entry does not carry, and an entry with no page, are both red. The page name is derived from the
 * version (`1.6.0` → `v1-6-0.md`), never stored, so the two cannot disagree about a filename.
 *
 * VERBATIM MEANS THE ENTRY'S BYTES. A section is copied as the lines the entry holds, character
 * for character — no re-wrapping, no emphasis rewrite, no bullet re-ordering. The only edit is the
 * heading level: the entry's `### Added` becomes `### Added` under this page's `##` section, which
 * is why the copy is compared line by line rather than by rendered text.
 *
 * THE MARKERS. Each generated block is delimited by
 * `<!-- changelog-view:begin <name> -->` … `<!-- changelog-view:end -->`. Two names appear on a
 * release page (`entry`, `limits`) and one in the index (`index`); a missing, duplicated or
 * unknown marker is a failure, not something to append to, because "regenerate the page" must
 * never mean "drop the paragraph a person wrote".
 *
 * WHAT A PAGE MUST ALSO CARRY, because the card says so and a checklist nobody runs is a wish: at
 * least one Mermaid diagram, at least one screenshot, and every screenshot path resolving to a real
 * file. The gate's own `links` step resolves relative links in changed markdown; this script
 * resolves the images whether or not the gate's lane reached that step.
 *
 * NO NEW DEPENDENCY, NO CLOCK, NO NETWORK. Node's own `fs` and regular expressions; the tag URL is
 * built from the version; the dates come only from the entry.
 *
 * Usage:
 *   node scripts/changelog-view.mjs             # rewrite every generated block in place
 *   node scripts/changelog-view.mjs --check     # exit 1 and name each drift, write nothing
 *   node scripts/changelog-view.mjs --root DIR  # read/write under DIR (tests)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
let ROOT = DEFAULT_ROOT;

const CHANGELOG = "CHANGELOG.md";
const DIR = "docs/changelog";
const MANIFEST = `${DIR}/releases.json`;
const INDEX = `${DIR}/README.md`;
const REPO_URL = "https://github.com/riolabs-ai/alignsynch";

/** The block each release page must carry, and the index's one block. */
const PAGE_REGIONS = ["entry", "limits"];
const INDEX_REGIONS = ["index"];

const LIMITS_SECTION = "Known limits";
const BEGIN = (name) => `<!-- changelog-view:begin ${name} -->`;
const END = "<!-- changelog-view:end -->";
const PROVENANCE =
  "<!-- generated from CHANGELOG.md by scripts/changelog-view.mjs — edit the entry, not this block -->";

/** `## [1.6.0] - 2026-11-07` — the one heading shape `scripts/release.sh` emits. */
const ENTRY_HEADING = /^## \[([0-9][^\]]*)\] - (\d{4}-\d{2}-\d{2})$/;
/** `[1.6.0]: https://github.com/...` — the link footer after the last entry, not an entry. */
const LINK_FOOTER = /^\[[^\]]+\]: \S+$/;
const SECTION_HEADING = /^### (.+)$/;
/** A full-width PR link, as `release.sh` writes one: `([#634](https://…/pull/634))`. */
const PR_LINK = /\(\[#(\d+)\]\(https:\/\/github\.com\/[^)]+\/pull\/\1\)\)/g;

class ViewError extends Error {}

/* ------------------------------------------------------------------ *
 * The entry
 * ------------------------------------------------------------------ */

/**
 * Every release entry in `CHANGELOG.md`, newest first — the order the file holds.
 *
 * A section's `lines` are the entry's own lines, verbatim, with trailing blank lines trimmed.
 * Sections therefore keep their prose, their bullets and their wrapping exactly as published; this
 * function classifies nothing but where one section ends and the next begins.
 */
function parseChangelog(text) {
  const entries = [];
  let current = null;
  let section = null;

  const closeSection = () => {
    if (current && section) {
      // A section's body is the entry's own lines verbatim; only the blank line the heading is
      // written with is layout, so both ends are trimmed and nothing inside is touched.
      while (section.lines.length > 0 && section.lines.at(-1).trim() === "") section.lines.pop();
      while (section.lines.length > 0 && section.lines[0].trim() === "") section.lines.shift();
      current.sections.push(section);
    }
    section = null;
  };

  for (const line of text.split("\n")) {
    const heading = ENTRY_HEADING.exec(line);
    if (heading) {
      closeSection();
      current = { version: heading[1], date: heading[2], intro: [], sections: [] };
      entries.push(current);
      continue;
    }
    if (!current) continue;
    if (LINK_FOOTER.test(line)) {
      closeSection();
      current = null;
      continue;
    }
    const sub = SECTION_HEADING.exec(line);
    if (sub) {
      closeSection();
      section = { title: sub[1].trim(), lines: [] };
      continue;
    }
    if (section) section.lines.push(line);
    else current.intro.push(line);
  }
  closeSection();

  for (const entry of entries) {
    while (entry.intro.length > 0 && entry.intro.at(-1).trim() === "") entry.intro.pop();
    while (entry.intro.length > 0 && entry.intro[0].trim() === "") entry.intro.shift();
    const limits = entry.sections.find((s) => s.title === LIMITS_SECTION.trim());
    entry.hasLimits = Boolean(limits) && limits.lines.length > 0;
    const prs = new Set();
    for (const s of entry.sections) {
      for (const line of s.lines) for (const m of line.matchAll(PR_LINK)) prs.add(m[1]);
    }
    entry.pullRequests = prs.size;
  }

  return entries;
}

/* ------------------------------------------------------------------ *
 * Rendering — deterministic, and the only writer of a generated block
 * ------------------------------------------------------------------ */

const tagOf = (version) => `v${version}`;
const pageOf = (version) => `v${version.replaceAll(".", "-")}.md`;
const tagUrl = (version) => `${REPO_URL}/releases/tag/${tagOf(version)}`;

function renderEntry(entry) {
  const out = [PROVENANCE, ""];
  out.push(`- **Released** ${entry.date}`);
  out.push(`- **Tag** [\`${tagOf(entry.version)}\`](${tagUrl(entry.version)})`);
  out.push(`- **Pull requests named** ${entry.pullRequests}`);
  out.push(`- **The entry** [\`${CHANGELOG}\`](../../${CHANGELOG})`);
  out.push("");

  if (entry.intro.length > 0) {
    out.push(...entry.intro);
    out.push("");
  }

  for (const section of entry.sections) {
    if (section.title === LIMITS_SECTION) continue;
    out.push(`### ${section.title}`);
    out.push("");
    out.push(...section.lines);
    out.push("");
  }

  while (out.length > 0 && out.at(-1) === "") out.pop();
  return out.join("\n");
}

function renderLimits(entry) {
  const limits = entry.sections.find((s) => s.title === LIMITS_SECTION);
  const out = [PROVENANCE, ""];
  if (!limits || limits.lines.length === 0) {
    // `release:check` already refuses an entry with no Known limits block; this is the second
    // reader of the same rule, and it fails rather than printing "none" — a page that says a
    // release has no limits is a claim the entry never made.
    throw new ViewError(
      `${CHANGELOG}: [${entry.version}] has no ${LIMITS_SECTION} block to copy — the entry is the source, so repair it there`,
    );
  }
  out.push(...limits.lines);
  return out.join("\n");
}

function renderIndex(entries, rows) {
  const out = [PROVENANCE, ""];
  for (const entry of entries) {
    const row = rows.get(entry.version);
    out.push(`### [${tagOf(entry.version)}](${pageOf(entry.version)})`);
    out.push("");
    out.push(`- **Released** ${entry.date}`);
    out.push(`- **Tag** [\`${tagOf(entry.version)}\`](${tagUrl(entry.version)})`);
    out.push(`- **Pull requests named** ${entry.pullRequests}`);
    out.push(`- **Theme:** ${row.theme}`);
    out.push(`- **Headline:** ${row.headline}`);
    out.push("");
  }
  while (out.length > 0 && out.at(-1) === "") out.pop();
  return out.join("\n");
}

/* ------------------------------------------------------------------ *
 * Reading and writing the tree
 * ------------------------------------------------------------------ */

const abs = (rel) => join(ROOT, rel);
const read = (rel) => readFileSync(abs(rel), "utf8");

function readManifest() {
  let parsed;
  try {
    parsed = JSON.parse(read(MANIFEST));
  } catch (error) {
    throw new ViewError(`${MANIFEST}: ${error.message}`);
  }
  const list = Array.isArray(parsed?.releases) ? parsed.releases : null;
  if (!list) throw new ViewError(`${MANIFEST}: expected an object with a "releases" array`);
  const rows = new Map();
  for (const [i, row] of list.entries()) {
    const where = `${MANIFEST}: releases[${i}]`;
    if (typeof row?.version !== "string" || row.version.trim() === "")
      throw new ViewError(`${where}: "version" must be a non-empty string`);
    if (typeof row?.theme !== "string" || row.theme.trim() === "")
      throw new ViewError(`${where} (${row.version}): "theme" must be a one-sentence string`);
    if (typeof row?.headline !== "string" || row.headline.trim() === "")
      throw new ViewError(`${where} (${row.version}): "headline" must be a non-empty string`);
    if (rows.has(row.version))
      throw new ViewError(`${where}: version "${row.version}" appears twice`);
    rows.set(row.version, { theme: row.theme.trim(), headline: row.headline.trim() });
  }
  return rows;
}

/** The bijection: every entry has a row, every row has an entry. */
function checkBijection(entries, rows) {
  const problems = [];
  const versions = new Set(entries.map((e) => e.version));
  for (const entry of entries) {
    if (!rows.has(entry.version))
      problems.push(
        `✗ ${MANIFEST}: no row for [${entry.version}] — add one with its theme and headline`,
      );
  }
  for (const version of rows.keys()) {
    if (!versions.has(version))
      problems.push(
        `✗ ${MANIFEST}: row for "${version}" names a version ${CHANGELOG} does not carry`,
      );
  }
  return problems;
}

/** Every `<!-- changelog-view:begin NAME -->` … `<!-- changelog-view:end -->` block, in order. */
function findRegions(text) {
  const regions = [];
  const opener = /<!-- changelog-view:begin ([A-Za-z]+) -->/g;
  let match = opener.exec(text);
  while (match !== null) {
    const name = match[1];
    const bodyStart = match.index + match[0].length;
    const endAt = text.indexOf(END, bodyStart);
    if (endAt === -1) {
      regions.push({ name, malformed: "no closing <!-- changelog-view:end -->" });
      break;
    }
    const body = text.slice(bodyStart, endAt).replace(/^\n/, "").replace(/\n$/, "");
    regions.push({ name, start: match.index, end: endAt + END.length, body });
    opener.lastIndex = endAt + END.length;
    match = opener.exec(text);
  }
  return regions;
}

function spliceRegions(text, bodies) {
  const regions = findRegions(text);
  let out = "";
  let cursor = 0;
  for (const region of regions) {
    out += text.slice(cursor, region.start);
    // A block with no body for this page is left exactly as it was: it is already reported as an
    // unknown marker, and writing `undefined` into it would destroy the paragraph it wraps.
    out += bodies.has(region.name)
      ? `${BEGIN(region.name)}\n${bodies.get(region.name)}\n${END}`
      : text.slice(region.start, region.end);
    cursor = region.end;
  }
  return out + text.slice(cursor);
}

function images(text) {
  const found = [];
  for (const m of text.matchAll(/!\[[^\]]*\]\(([^)\s]+)(?:\s[^)]*)?\)/g)) found.push(m[1]);
  return found;
}

/** What a release page must carry besides its generated blocks. */
function checkPageShape(rel, text) {
  const problems = [];
  const diagramCount = (text.match(/^```mermaid$/gm) ?? []).length;
  if (diagramCount < 1) problems.push(`✗ ${rel}: no Mermaid diagram (need at least one)`);

  const fences = (text.match(/^```/gm) ?? []).length;
  if (fences % 2 !== 0) problems.push(`✗ ${rel}: unbalanced \`\`\` code fence`);

  const shots = images(text);
  if (shots.length < 1) problems.push(`✗ ${rel}: no screenshot (need at least one)`);
  for (const shot of shots) {
    const target = shot.replace(/^\.\//, "");
    if (/^[a-z]+:\/\//.test(target)) {
      problems.push(`✗ ${rel}: ${shot} is a remote image — the file belongs in docs/assets/`);
      continue;
    }
    if (!existsSync(join(abs(DIR), target)))
      problems.push(`✗ ${rel}: ${shot} does not resolve to a file`);
  }
  return problems;
}

/* ------------------------------------------------------------------ *
 * Main
 * ------------------------------------------------------------------ */

function main(argv) {
  const check = argv.includes("--check");
  const rootFlag = argv.indexOf("--root");
  if (rootFlag !== -1) ROOT = argv[rootFlag + 1];

  const problems = [];
  const entries = parseChangelog(read(CHANGELOG));
  if (entries.length === 0) throw new ViewError(`${CHANGELOG}: no "## [x.y.z] - date" entries`);

  const rows = readManifest();
  // The bijection is checked first and alone: with a row missing, `renderIndex` has no theme to
  // print, and a stack trace would hide the one sentence that says which version lost its row.
  const bijection = checkBijection(entries, rows);
  if (bijection.length > 0) {
    for (const problem of bijection) console.error(problem);
    console.error(`✗ changelog view: ${bijection.length} problem(s)`);
    return 1;
  }
  // The index, then one page per entry.
  const targets = [
    {
      rel: INDEX,
      regions: INDEX_REGIONS,
      bodies: new Map([["index", renderIndex(entries, rows)]]),
    },
  ];
  for (const entry of entries) {
    const rel = `${DIR}/${pageOf(entry.version)}`;
    targets.push({
      rel,
      regions: PAGE_REGIONS,
      bodies: new Map([
        ["entry", renderEntry(entry)],
        ["limits", renderLimits(entry)],
      ]),
    });
  }

  let written = 0;
  for (const target of targets) {
    if (!existsSync(abs(target.rel))) {
      problems.push(`✗ ${target.rel}: missing — every ${CHANGELOG} entry needs a page`);
      continue;
    }
    const text = read(target.rel);
    const regions = findRegions(text);

    for (const region of regions) {
      if (region.malformed) {
        problems.push(`✗ ${target.rel}: ${BEGIN(region.name)} ${region.malformed}`);
      } else if (!target.regions.includes(region.name)) {
        problems.push(
          `✗ ${target.rel}: unknown block "${region.name}" — expected ${target.regions.join(", ")}`,
        );
      }
    }
    for (const name of target.regions) {
      const found = regions.filter((r) => r.name === name);
      if (found.length === 0) problems.push(`✗ ${target.rel}: no ${BEGIN(name)} block to fill`);
      else if (found.length > 1)
        problems.push(
          `✗ ${target.rel}: ${BEGIN(name)} appears ${found.length} times, expected once`,
        );
    }

    if (target.rel !== INDEX) problems.push(...checkPageShape(target.rel, text));

    const fresh = spliceRegions(text, target.bodies);
    if (fresh !== text) {
      const firstDrift = firstDifference(text, fresh);
      if (check) {
        problems.push(
          `✗ ${target.rel}: ${firstDrift} — run \`pnpm changelog\` to regenerate from the entry`,
        );
      } else {
        writeFileSync(abs(target.rel), fresh);
        written += 1;
      }
    }
  }

  if (problems.length > 0) {
    for (const problem of problems) console.error(problem);
    console.error(`✗ changelog view: ${problems.length} problem(s)`);
    return 1;
  }

  const pages = entries.length;
  if (check) {
    console.log(
      `  changelog view: ${pages} release(s) · ${pages + 1} page(s) · ${pages * PAGE_REGIONS.length + INDEX_REGIONS.length} generated block(s) match ${CHANGELOG}`,
    );
  } else {
    console.log(
      `  changelog view: ${pages} release(s) · ${written} file(s) rewritten · every page carries a diagram and a screenshot`,
    );
  }
  return 0;
}

/** The first line that differs, named by its number — a diff a reader can act on. */
function firstDifference(a, b) {
  const left = a.split("\n");
  const right = b.split("\n");
  const limit = Math.max(left.length, right.length);
  for (let i = 0; i < limit; i += 1) {
    if (left[i] !== right[i]) return `line ${i + 1} ${describePair(left[i], right[i])}`;
  }
  return "content differs";
}

/**
 * Both sides of the first difference, cut to a window that starts a little before it — the reason
 * the two lines differ is usually one word, and a `slice(0, 60)` of each prints two identical
 * prefixes and tells the reader nothing.
 */
function describePair(pageLine, entryLine) {
  const left = pageLine ?? "";
  const right = entryLine ?? "";
  let at = 0;
  while (at < left.length && at < right.length && left[at] === right[at]) at += 1;
  const window = (line) => {
    const start = Math.max(0, at - 40);
    const cut = line.slice(start, start + 80);
    return `${start > 0 ? "…" : ""}${cut}${start + 80 < line.length ? "…" : ""}`;
  };
  if (pageLine === undefined)
    return `(the page has no line ${at}, the entry renders "${window(right)}")`;
  if (entryLine === undefined)
    return `("${window(left)}" is in the page and the entry has no such line)`;
  return `— the page says "${window(left)}", the entry says "${window(right)}"`;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  if (error instanceof ViewError) {
    console.error(`✗ ${error.message}`);
    process.exitCode = 1;
  } else throw error;
}

export { parseChangelog, renderEntry, renderLimits, pageOf };
