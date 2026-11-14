#!/usr/bin/env node
/**
 * scripts/capture-retention.mjs — how long `docs/qa/` may keep a capture, in one place (#1024).
 *
 * `docs/qa/` is the pre-atlas evidence shelf: one directory per measurement, 81 of them, 118.85 MB
 * — 84 % of `docs/`. `docs:check`'s only invariant is *every `.md` is indexed*, and a capture
 * directory with no page is outside that invariant by construction, so nothing counted it, nothing
 * aged it out, and it could only grow. 51 of the directories carried no page at all; 49 of those are
 * gone as of this rule. `docs/qa-atlas/` is the shelf that replaced them and it already has a window
 * (`qa-atlas-retention.mjs`); this module is the same rule for the shelf the atlas replaced.
 *
 * ## The rule, in the order it is applied
 *
 * 1. **an open issue** — the directory is named for an issue that is still open. This is the one
 *    fact the tree cannot answer offline (no network, no `gh` in the gate), so it is a *claim in the
 *    register*: a row whose reason opens `open issue #975`. The check verifies the shape (the row
 *    exists, the directory exists, the number is the one its name carries); a reader verifies the
 *    state in one click. That is why the register carries a date.
 * 2. **a live pointer** — a tracked file outside the capture names it, as `docs/qa/<name>` or the
 *    retired flat spelling `docs/qa-<name>`. Code, a config trace, a test, a changelog figure and a
 *    style comment all count: each one is a reader that stops resolving the day the directory goes.
 *    Generated regions (`docs-nav` / `docs-hub`), the manifest itself, the markdown-hash snapshot
 *    and the register are excluded — they are derived from the tree, not readers of it.
 * 3. **the current or previous release** — `release-1.19.0`, `v1-18-0`, `v1.18.0`. `KEEP_RELEASES`
 *    is 2 and the releases come from the atlas's newest cuts, because the atlas *is* the release
 *    capture now. A release cut that nothing points at yet is still the record of a shipped build.
 *
 * Everything else is archived — the directory and its `docs/docs.json` row in the same commit, so
 * `docs:check` stays the arbiter of the two halves.
 *
 * ## Two callers, because a rule with one caller is a comment
 *
 *   `pnpm docs:check`             the assertion, inside the step the gate already runs. It fails
 *                                 naming the directory and the three ways to justify it, and it is
 *                                 the reason a new 3 MB screenshot dump cannot land again.
 *   `pnpm qa:retention:prune`     the deletion: every row the register marks `archived`, with its
 *                                 `docs.json` row, refusing to touch anything the rule still keeps.
 *
 * A capture directory the tree cannot justify **fails the gate**. Adding one therefore has three
 * honest answers — point at it, name it after an open issue and register that, or delete it — and
 * "commit another 90 screenshots" is no longer one of them.
 *
 * ## What is pure and what is not
 *
 * `classify()` is pure: no `fs`, no clock, no network, facts in and a verdict out, so the window is
 * testable without a tree and the two callers cannot disagree about it — the same split
 * `qa-atlas-retention.mjs` makes. Everything that reads a disk or the index is below it.
 *
 * NO CLOCK, NO NETWORK, NO DEPENDENCY.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { gitEnv, indexedPaths } from "./git-index.mjs";
import { pruneDocsManifest } from "./qa-atlas-retention.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_ROOT = resolve(HERE, "..");

/** The shelf this rule governs. */
export const CAPTURE_ROOT = "docs/qa";

/** The register: every directory, its weight, its fate and a reason in words. */
export const REGISTER = `${CAPTURE_ROOT}/RETENTION.md`;

/**
 * Is the open-issue rule on? An open issue named by the directory is the only reason a capture may
 * stay with nothing in the tree pointing at it, and it is a claim in the register, never a guess.
 */
export const KEEP_OPEN_ISSUE = true;

/** A tracked file outside the capture names it. */
export const KEEP_POINTERED = true;

/** How many release cuts the window keeps — the current one and the previous one. */
export const KEEP_RELEASES = 2;

/** The window, as one object a caller can narrow (a dry run, a test). */
export const WINDOW = Object.freeze({
  openIssue: KEEP_OPEN_ISSUE,
  pointered: KEEP_POINTERED,
  releases: KEEP_RELEASES,
});

/**
 * A directory name as a release, or `null`. Three spellings have been used on this shelf and a rule
 * that recognised one of them would silently archive the others:
 *
 *   `release-1.17.0`   the release-capture naming
 *   `v1-15-0`          the pre-move naming
 *   `v1.18.0`          the atlas spelling, for the day a cut lands here
 *
 * @param {string} name
 * @returns {string | null} `major.minor.patch`
 */
export function releaseVersion(name) {
  const match =
    /^release-(\d+\.\d+\.\d+)$/.exec(name) ??
    /^v(\d+)-(\d+)-(\d+)$/.exec(name) ??
    /^v(\d+\.\d+\.\d+)$/.exec(name);
  if (match === null) return null;
  return match.length === 4 ? `${match[1]}.${match[2]}.${match[3]}` : `${match[1]}`;
}

/** The issue number a directory name carries, or `null` — `975`, `975-d12`, `979-flow-entries`. */
export function issueOf(name) {
  const before = /^(\d{3,4})(?:-|$)/.exec(name);
  if (before !== null) return Number(before[1]);
  const after = /-(\d{3,4})$/.exec(name);
  return after === null ? null : Number(after[1]);
}

/**
 * @typedef {{
 *   name: string,
 *   bytes?: number,
 *   files?: number,
 *   pointers?: string[],
 * }} Capture
 *
 * @typedef {{
 *   openIssue?: number | null,
 *   pointers?: string[],
 *   releases?: string[],
 * }} Facts
 *
 * @typedef {"open-issue" | "pointer" | "release" | "archive"} Rule
 *
 * @typedef {{
 *   name: string,
 *   fate: "keep" | "archive",
 *   rule: Rule,
 *   reason: string,
 * }} Verdict
 */

/**
 * The window applied to one directory: `keep` with the rule that saved it, or `archive` with the
 * reason it did not. Pure, and it **orders the rules** rather than reporting the strongest match —
 * a capture kept because an issue is open says so even when a comment also names it, because the
 * issue is the reason a person has to look at before deleting anything.
 *
 * `facts` is evidence, never a verdict: the open-issue claim comes from the register, the pointers
 * from the index, the releases from the atlas. A caller that hands over nothing gets `archive`,
 * which is the correct answer for a directory nobody can name.
 *
 * @param {string} name
 * @param {Facts} [facts]
 * @param {{ openIssue?: boolean, pointered?: boolean, releases?: number }} [window]
 * @returns {Verdict}
 */
export function classify(name, facts = {}, window = WINDOW) {
  const rules = { ...WINDOW, ...window };

  if (rules.openIssue && facts.openIssue) {
    return {
      name,
      fate: "keep",
      rule: "open-issue",
      reason: `open issue #${facts.openIssue}`,
    };
  }

  const pointers = [...new Set(facts.pointers ?? [])].filter((path) => path !== "");
  if (rules.pointered && pointers.length > 0) {
    const [first] = pointers;
    const more = pointers.length - 1;
    return {
      name,
      fate: "keep",
      rule: "pointer",
      reason: `named by \`${first}\`${more > 0 ? ` and ${more} other file${more === 1 ? "" : "s"}` : ""}`,
    };
  }

  const version = releaseVersion(name);
  const window_ = (facts.releases ?? []).slice(0, Math.max(0, rules.releases));
  if (version !== null && window_.includes(version)) {
    const rank = window_.indexOf(version);
    return {
      name,
      fate: "keep",
      rule: "release",
      reason: rank === 0 ? `the current release (${version})` : `the previous release (${version})`,
    };
  }

  const why =
    version !== null
      ? `release ${version} is outside the ${rules.releases}-cut window`
      : "no open issue, nothing in the tree names it, and it is not a release cut";
  return { name, fate: "archive", rule: "archive", reason: why };
}

/** Two places of MB, the unit the register and the failure text both print. */
export const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

/**
 * The register's rows, parsed. The table is the machine-readable half of `RETENTION.md` and the
 * prose around it is for the reader, so only the four columns are read:
 *
 *   | directory | weight | fate | why it stays (or went) |
 *
 * `fate` is `keep` or `archived`. A `why` that opens `open issue #<n>` is the open-issue claim —
 * the one fact the gate cannot derive, recorded here so it is auditable rather than remembered.
 *
 * @param {string} markdown
 * @returns {Array<{ name: string, weight: string, fate: "keep" | "archived", why: string, openIssue: number | null }>}
 */
export function registerRows(markdown) {
  const rows = [];
  for (const line of markdown.split("\n")) {
    const cells = line.split("|").map((cell) => cell.trim());
    // `["", directory, weight, fate, why, ""]` — a four-column table row and nothing else. The
    // directory may be written as a code span, which is how the register reads best.
    if (cells.length !== 6) continue;
    const [, label, weight, fate, why] = cells;
    const name = label.replace(/^`/, "").replace(/`$/, "");
    if (!/^[a-z0-9][a-z0-9._-]*$/.test(name)) continue;
    if (fate !== "keep" && fate !== "archived") continue;
    const claim = /^open issue #(\d+)/.exec(why);
    rows.push({ name, weight, fate, why, openIssue: claim === null ? null : Number(claim[1]) });
  }
  return rows;
}

/**
 * Everything wrong with the shelf, as named problems — `docs:check` prints these and exits 1.
 *
 * Five rules, and the fourth and fifth are what stop the drift returning rather than only clearing
 * it once:
 *
 *   registered   every directory on disk has a row. An unregistered capture is the failure this
 *                whole file exists to prevent: nothing names it, nothing ages it, and it accumulates
 *   kept         a `keep` row's directory is on disk — a row for a directory that was deleted is
 *                a register that has stopped describing the tree
 *   archived     an `archived` row's directory is **not** on disk. The row is the record; the bytes
 *                are supposed to be gone, and a half-applied prune is exactly the state that reads
 *                as finished
 *   justified    a `keep` row the rule cannot justify (no pointer, no release, no open-issue claim)
 *                fails by name. A keep with no reason in the tree is a keep somebody typed
 *   measured     a `keep` row's weight is the directory's weight. A capture that grew has to be
 *                re-measured and re-justified, which is the point of recording the number
 *
 * @param {{ captures: Capture[], rows: ReturnType<typeof registerRows>, pointers: Map<string, string[]>, releases: string[], window?: object }} input
 * @returns {string[]}
 */
export function captureProblems({ captures, rows, pointers, releases, window = WINDOW }) {
  const problems = [];
  const rules = { ...WINDOW, ...window };
  const byName = new Map();
  for (const row of rows) {
    if (byName.has(row.name)) {
      problems.push(`${REGISTER}: \`${row.name}\` has two rows — once is the rule`);
      continue;
    }
    byName.set(row.name, row);
  }

  const onDisk = new Set(captures.map((capture) => capture.name));
  for (const capture of captures) {
    const row = byName.get(capture.name);
    if (row === undefined) {
      problems.push(
        `${CAPTURE_ROOT}/${capture.name}: no row in ${REGISTER} and nothing names it — a capture ` +
          "nobody registers is the drift this rule exists to stop. Point at it, register an open " +
          "issue for it, or remove it with `pnpm qa:retention:prune`",
      );
      continue;
    }
    if (row.fate === "archived") {
      problems.push(
        `${CAPTURE_ROOT}/${capture.name}: ${REGISTER} says it was archived and the directory is ` +
          "still here — `pnpm qa:retention:prune` removes it with its `docs.json` row",
      );
      continue;
    }
    const verdict = classify(
      capture.name,
      { openIssue: row.openIssue, pointers: pointers.get(capture.name) ?? [], releases },
      rules,
    );
    if (verdict.fate === "archive") {
      problems.push(
        `${CAPTURE_ROOT}/${capture.name}: kept in ${REGISTER} and unjustified — ${verdict.reason}. ` +
          "A capture stays for an open issue (register the claim), a pointer in the tree, or a " +
          "release cut; otherwise it goes",
      );
    }
    if (capture.bytes !== undefined && mb(capture.bytes) !== row.weight) {
      problems.push(
        `${REGISTER}: \`${capture.name}\` is ${mb(capture.bytes)} on disk and the row says ` +
          `${row.weight} — re-measure the row, so the shelf's weight is a number somebody took`,
      );
    }
  }

  for (const row of byName.values()) {
    if (row.fate === "keep" && !onDisk.has(row.name)) {
      problems.push(
        `${REGISTER}: \`${row.name}\` is registered as kept and ${CAPTURE_ROOT}/${row.name} is not ` +
          "on disk — restore the capture or delete the row",
      );
    }
    if (row.fate === "keep" && row.openIssue !== null && issueOf(row.name) !== row.openIssue) {
      problems.push(
        `${REGISTER}: \`${row.name}\` claims open issue #${row.openIssue}, which is not the issue ` +
          "its name carries — a claim about the wrong directory keeps the wrong capture",
      );
    }
    if (row.fate === "archived" && onDisk.has(row.name)) {
    }
  }
  return problems;
}

/* ------------------------------------------------------------------ *
 * The disk, and the index that decides what counts as a reader
 * ------------------------------------------------------------------ */

/** Every byte under a directory — the measure the register records. */
export function bytesUnder(dir) {
  if (!existsSync(dir)) return 0;
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    total += entry.isDirectory() ? bytesUnder(full) : statSync(full).size;
  }
  return total;
}

/** Every file under a directory, counted the same way. */
function filesUnder(dir) {
  if (!existsSync(dir)) return 0;
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    total += entry.isDirectory() ? filesUnder(join(dir, entry.name)) : 1;
  }
  return total;
}

/** The capture directories on disk, with their weight. */
export function captureDirs(root = DEFAULT_ROOT) {
  const base = join(root, CAPTURE_ROOT);
  if (!existsSync(base)) return [];
  return readdirSync(base, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      bytes: bytesUnder(join(base, entry.name)),
      files: filesUnder(join(base, entry.name)),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

/** Text files worth reading. A pointer lives in source, config, prose or a stylesheet. */
const READABLE =
  /\.(ts|tsx|mts|cts|js|mjs|cjs|json|jsonc|md|mdx|css|scss|sh|bash|yml|yaml|txt|sql|html)$/;

/**
 * Files that are *derived* from the tree rather than readers of it: the manifest's own rows, the
 * markdown-hash snapshot, and the register (which names every capture by definition, so counting it
 * would keep everything forever). A generated docs region — the hub's rows, every page's nav line —
 * is stripped out of a file before it is read, for the same reason.
 */
const DERIVED = new Set(["docs/docs.json", "tests/fixtures/md-normalised.json", REGISTER]);
const REGION = /<!--\s*docs-(?:nav|hub):begin\s*-->[\s\S]*?<!--\s*docs-(?:nav|hub):end\s*-->/g;

/** Files a walk never descends into: other checkouts, build output, the vendored template. */
const SKIP_DIRS = new Set([
  ".git",
  ".next",
  ".datacheck",
  ".migration",
  ".turbo",
  ".vercel",
  ".worktrees",
  "node_modules",
]);

/**
 * The tracked files a pointer may live in, repo-relative POSIX paths.
 *
 * The index decides, not the disk (#1020): an ignored file is on somebody's machine, not in the
 * tree. When git cannot answer for the root — a `--root` copy with no work tree of its own — the
 * walk keeps everything it finds, because a check that cannot read the index must never silently
 * stop checking.
 */
export function readableFiles(root, index = null) {
  const listed = index ?? indexedPathsFor(root);
  if (listed !== null) {
    return [...listed].filter(
      (path) => READABLE.test(path) && !DERIVED.has(path) && !path.startsWith("lib/quizhub/"),
    );
  }
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (SKIP_DIRS.has(entry.name)) continue;
      const full = join(dir, entry.name);
      const rel = relative(root, full).split("\\").join("/");
      if (entry.isDirectory()) {
        if (rel === "lib/quizhub") continue;
        walk(full);
      } else if (READABLE.test(entry.name) && !DERIVED.has(rel)) {
        found.push(rel);
      }
    }
  };
  walk(root);
  return found;
}

/**
 * `indexedPaths(root, ".")` as a whole-tree index, or `null` when git cannot answer. Wrapped so a
 * caller that already read the index can hand it in instead of shelling out twice.
 */
export function indexedPathsFor(root) {
  try {
    return indexedPaths(root, ".");
  } catch {
    return null;
  }
}

/**
 * Who names which capture: `Map<name, repo-relative path[]>`, from every tracked file outside the
 * capture directory itself.
 *
 * `ignored` holds the directories a prune is about to remove: a capture that cites a sibling is one
 * archive citing another, so a citation from a directory the register has already retired is not a
 * reader. That is what makes the classification a fixpoint rather than a single pass — deleting
 * `comments-mockup` is what makes its citation of `873` stop counting.
 *
 * @param {{ root?: string, names: string[], ignored?: Iterable<string>, files?: string[] }} input
 * @returns {Map<string, string[]>}
 */
export function pointerMap({ root = DEFAULT_ROOT, names, ignored = [], files = null }) {
  const ignoredSet = new Set(ignored);
  const known = new Set(names);
  const pointers = new Map(names.map((name) => [name, []]));
  // Every spelling that has ever named a capture: the absolute `docs/qa/payment`, the relative
  // `../qa/payment` a docs page or a changelog figure writes, and the pre-#965 flat `docs/qa-971-tiles`
  // that a comment beside a script still carries. A citation counts however it is spelled — it is
  // the same file, and it stops resolving the day the directory goes.
  const pattern = /(^|[^A-Za-z0-9._-])qa(?:-|\/)([A-Za-z0-9._-]+)/g;
  for (const path of files ?? readableFiles(root)) {
    // A file inside *a* capture counts for its siblings, never for itself — and not at all when the
    // capture that holds it is one the rule has already archived.
    const inside = /^docs\/qa\/([^/]+)\//.exec(path);
    if (inside !== null && ignoredSet.has(inside[1])) continue;
    const text = readFileSync(join(root, path), "utf8").replace(REGION, " ");
    for (const match of text.matchAll(pattern)) {
      const name = match[2];
      if (!known.has(name)) continue;
      if (inside !== null && inside[1] === name) continue;
      if (pointers.get(name).includes(path)) continue;
      pointers.get(name).push(path);
    }
  }
  return pointers;
}

/**
 * The release cuts the window counts, newest first: the atlas's own cuts, because the atlas is the
 * release capture now. A tree with no atlas falls back to `package.json`'s version, so the rule
 * still has a current release to offer.
 */
export function releasesUnder(root = DEFAULT_ROOT) {
  const base = join(root, "docs/qa-atlas");
  const cuts = existsSync(base)
    ? readdirSync(base, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) => releaseVersion(entry.name))
        .filter((version) => version !== null)
        .sort((left, right) => {
          const a = left.split(".").map(Number);
          const b = right.split(".").map(Number);
          return b[0] - a[0] || b[1] - a[1] || b[2] - a[2];
        })
    : [];
  if (cuts.length > 0) return cuts;
  try {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    return typeof pkg.version === "string" ? [pkg.version] : [];
  } catch {
    return [];
  }
}

/**
 * The classification of the tree, as a fixpoint: pointers are gathered, the window is applied, and
 * the directories it archives stop counting as readers — then again, until nothing moves. One pass
 * would keep a capture whose only citation is another capture that is itself going.
 *
 * @param {{ root?: string, window?: object, files?: string[] }} input
 * @returns {{ captures: Capture[], verdicts: Map<string, Verdict>, pointers: Map<string, string[]> }}
 */
export function classifyTree({ root = DEFAULT_ROOT, window = WINDOW, files = null } = {}) {
  const captures = captureDirs(root);
  const names = captures.map((capture) => capture.name);
  const releases = releasesUnder(root);
  const read = files ?? readableFiles(root);
  const claims = registerOf(root);

  let ignored = [];
  let verdicts = new Map();
  for (let pass = 0; pass < 4; pass += 1) {
    const pointers = pointerMap({ root, names, ignored, files: read });
    verdicts = new Map(
      captures.map((capture) => [
        capture.name,
        classify(
          capture.name,
          {
            openIssue: claims.get(capture.name)?.openIssue ?? null,
            pointers: pointers.get(capture.name) ?? [],
            releases,
          },
          window,
        ),
      ]),
    );
    const next = [...verdicts.values()]
      .filter((verdict) => verdict.fate === "archive")
      .map((verdict) => verdict.name);
    if (next.length === ignored.length && next.every((name) => ignored.includes(name))) {
      const pointersNow = pointerMap({ root, names, ignored, files: read });
      return { captures, verdicts, pointers: pointersNow, releases };
    }
    ignored = next;
  }
  return {
    captures,
    verdicts,
    pointers: pointerMap({ root, names, ignored, files: read }),
    releases,
  };
}

/** The register on disk, keyed by directory name. Absent is an empty register, not an error. */
function registerOf(root = DEFAULT_ROOT) {
  const target = join(root, REGISTER);
  if (!existsSync(target)) return new Map();
  return new Map(registerRows(readFileSync(target, "utf8")).map((row) => [row.name, row]));
}

/**
 * The assertion `docs:check` runs: the shelf is whole, or these problems name what is wrong.
 *
 * @param {string} root
 * @returns {{ problems: string[], summary: { captures: number, kept: number, archived: number } }}
 */
export function retentionState(root = DEFAULT_ROOT) {
  const captures = captureDirs(root);
  if (captures.length === 0)
    return { problems: [], summary: { captures: 0, kept: 0, archived: 0 } };
  const { verdicts, pointers, releases } = classifyTree({ root });
  const problems = [];
  if (!existsSync(join(root, REGISTER))) {
    problems.push(
      `${REGISTER}: missing — every capture directory needs a row (weight, reason, fate), and a ` +
        "shelf with no register is the state this rule replaced",
    );
  }
  problems.push(
    ...captureProblems({
      captures,
      rows: [...registerOf(root).values()],
      pointers,
      releases,
    }),
  );
  const kept = [...verdicts.values()].filter((verdict) => verdict.fate === "keep").length;
  return {
    problems,
    summary: { captures: captures.length, kept, archived: captures.length - kept },
  };
}

/* ------------------------------------------------------------------ *
 * `docs/docs.json` — the rows a prune drops
 * ------------------------------------------------------------------ */

/** Read the manifest, apply `mutate`, write it back with the formatting the repo commits. */
function editManifest(root, mutate) {
  const target = join(root, "docs/docs.json");
  const manifest = JSON.parse(readFileSync(target, "utf8"));
  const result = mutate(manifest);
  writeFileSync(target, `${JSON.stringify(manifest, null, 2)}\n`);
  return result;
}

/**
 * Remove the archived captures: their directories, then their `docs.json` rows, in one run.
 *
 * It refuses to touch a directory the rule still keeps. That refusal is the whole safety of the
 * command — a prune that deletes what the check would have kept is worse than no prune at all,
 * because `docs:check` fails only *after* the push.
 *
 * @param {{ root?: string, dryRun?: boolean }} input
 * @returns {{ removed: string[], dropped: number, refused: string[] }}
 */
export function pruneCaptures({ root = DEFAULT_ROOT, dryRun = false } = {}) {
  const { captures, verdicts } = classifyTree({ root });
  const rows = registerOf(root);
  const refused = [];
  const removed = [];
  for (const capture of captures) {
    const row = rows.get(capture.name);
    const verdict = verdicts.get(capture.name);
    // Two ways to be told to go: the register says archived, or the rule cannot justify it. A
    // directory the rule keeps is never a candidate, whatever the register says.
    const asked = row?.fate === "archived" || row === undefined;
    if (!asked || verdict?.fate === "keep") {
      if (row?.fate === "archived" && verdict?.fate === "keep") refused.push(capture.name);
      continue;
    }
    removed.push(`${CAPTURE_ROOT}/${capture.name}`);
  }
  if (removed.length === 0) return { removed, dropped: 0, refused };

  if (!dryRun) {
    execFileSync("git", ["-C", root, "rm", "-r", "-q", "--", ...removed], {
      stdio: ["ignore", "pipe", "inherit"],
      env: gitEnv(),
    });
    for (const dir of removed) rmSync(join(root, dir), { recursive: true, force: true });
  }
  const dropped = dryRun
    ? 0
    : editManifest(root, (manifest) => pruneDocsManifest(manifest, removed).dropped);
  return { removed, dropped, refused };
}

/* ------------------------------------------------------------------ *
 * CLI
 * ------------------------------------------------------------------ */

function report(root) {
  const { captures, verdicts, pointers } = classifyTree({ root });
  const releases = releasesUnder(root);
  const width = Math.max(...captures.map((capture) => capture.name.length), "directory".length);
  process.stdout.write(
    `${CAPTURE_ROOT}: ${captures.length} capture(s) · releases in the window: ${releases.slice(0, KEEP_RELEASES).join(", ") || "none"}\n`,
  );
  for (const capture of captures) {
    const verdict = verdicts.get(capture.name);
    const who = (pointers.get(capture.name) ?? []).length;
    process.stdout.write(
      `  ${capture.name.padEnd(width)}  ${mb(capture.bytes).padStart(9)}  ${verdict.fate.padEnd(7)}  ` +
        `${verdict.reason}${who > 1 ? ` (${who} pointers)` : ""}\n`,
    );
  }
}

function main(argv) {
  const rootFlag = argv.indexOf("--root");
  const root = rootFlag === -1 ? DEFAULT_ROOT : resolve(argv[rootFlag + 1] ?? "");
  if (rootFlag !== -1 && !argv[rootFlag + 1]) {
    process.stderr.write("✗ --root needs a directory\n");
    return 2;
  }

  if (argv.includes("--report")) {
    report(root);
    return 0;
  }

  if (argv.includes("--prune")) {
    const dryRun = argv.includes("--dry-run");
    const { removed, dropped, refused } = pruneCaptures({ root, dryRun });
    for (const name of refused) {
      process.stderr.write(
        `  ! ${name}: the register says archived and the rule still keeps it — left alone\n`,
      );
    }
    process.stdout.write(
      dryRun
        ? `  would remove ${removed.length} capture(s):\n${removed.map((dir) => `    ${dir}\n`).join("")}`
        : `  removed ${removed.length} capture(s), dropped ${dropped} docs.json row(s)${
            refused.length > 0 ? `, refused ${refused.length}` : ""
          }\n`,
    );
    return 0;
  }

  const { problems, summary } = retentionState(root);
  if (problems.length > 0) {
    process.stderr.write(`✗ qa:retention — ${problems.length} problem(s):\n`);
    for (const problem of problems) process.stderr.write(`  ✗ ${problem}\n`);
    return 1;
  }
  process.stdout.write(
    `  ${summary.captures} capture(s) in ${CAPTURE_ROOT}: ${summary.kept} kept, ` +
      `${summary.archived} to remove — every kept capture names an open issue, a pointer or a ` +
      `release cut (${REGISTER})\n`,
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
