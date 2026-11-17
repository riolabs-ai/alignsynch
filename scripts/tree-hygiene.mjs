#!/usr/bin/env node
/**
 * `scripts/tree-hygiene.mjs` — for every changed path, **who wrote it** and the one command that
 * clears it (#1178).
 *
 * Why this exists: the primary checkout was dirty for days with two paths and neither of them was a
 * human's edit — `AGENTS.md`, rewritten by `next dev`, and `CLAUDE.md`, written by `gitnexus
 * analyze`. Committing them fixes the symptom for as long as neither tool runs again. What it does
 * not fix is the next occurrence, and the only thing that ever noticed was `scripts/release.sh`'s
 * dirty-tree refusal: the last step of a cut, reported as "the tree is dirty" with no remedy. A
 * refusal that names no culprit sends the operator to `git status`, then to guesswork, and the
 * guess on a tree somebody else's tool wrote is "stash it" — which is how work gets lost.
 *
 * So the reporter names the writer. Three callers, one table:
 *
 *   - **`scripts/release.sh`** (`require_cut_checkout`, `guard_restore`) prints it *before* the
 *     refusal, so the refusal arrives with a diagnosis. The refusal itself is unchanged: a cut is
 *     still made from a clean tree, and this script never clears anything.
 *   - **`scripts/release-cut.mjs`** prints it in every mode, before it reads or writes a byte.
 *   - **`scripts/verify.sh`** prints it as a **report and never a failure** — a worker's worktree is
 *     dirty by design in the middle of a card, and a gate that failed on dirt would fail every card
 *     it is meant to check. The step's own comment in `verify.sh` says so, in the same breath.
 *
 * ## It reports. It never repairs.
 *
 * There is deliberately no `--fix`, no `git checkout`, no `git stash` and no `rm` here. A changed
 * path is sometimes the intended work, and a tool that guesses which is which deletes the one thing
 * the operator wanted. The clearing command is *printed*, for a human to run.
 *
 * ## The table, and why `unknown` is a verdict rather than a gap
 *
 * A path that is not in `WRITER_RULES` prints **`unknown writer`**. It is never attributed by
 * resemblance — "it ends in `.md`, so a generator wrote it" is the guess that makes the whole report
 * untrustworthy, and one wrong row is enough for an operator to stop reading the rest.
 *
 * Two rows are worth their own note, because both were measured on the real tree rather than assumed:
 *
 *   - **`AGENTS.md` has two writers.** `next dev` owns the `nextjs-agent-rules` block
 *     (`node_modules/next/dist/server/lib/generate-agent-files.js`) *and* `gitnexus analyze`
 *     rewrites its own stats block there — `gitnexus/dist/storage/gitnexus-managed-paths.js` lists
 *     `AGENTS.md`, `CLAUDE.md`, `.claude`, `.cursor`, `.agents` and `.gitnexus` as the paths
 *     `analyze` writes. Naming only one of them would send the operator to the wrong tool.
 *   - **`data/health/platform-health.json`** is written by `scripts/release.sh`'s own record step,
 *     which leaves the file uncommitted **on purpose** ("the record lands as its own
 *     `chore(health): re-record …` PR after the cut"). That is a release leaving behind the exact
 *     dirt the next release refuses on, so the row says which one it is.
 *
 * ## `next dev` is idempotent — measured, not assumed
 *
 * `writeAgentFiles()` reads `AGENTS.md`, upserts the managed block, and returns `"unchanged"`
 * **without writing** when the text already matches (`upsertFile`: `if (updated === existing) return
 * "unchanged"`). Measured on this host against `next` as installed, on a copy of this repo's own
 * `AGENTS.md`:
 *
 *   | state of the copy                                  | `writeAgentFiles` | sha256       |
 *   | -------------------------------------------------- | ----------------- | ------------ |
 *   | this tree's committed `AGENTS.md`                  | `unchanged` twice | `39eca611…`  |
 *   | the same file with the managed block stripped      | `updated`, then `unchanged` | `6fe8e16f…` → `aad10f97…` |
 *
 * So `next dev` rewrites `AGENTS.md` **only when the block on disk differs from the one the
 * installed version would write** — once after a `next` upgrade changes that text, and never again.
 * Committing the block is therefore a real fix and not just a mitigation: the write stops happening.
 * What remains is the first run after an upgrade, in a tree that did not commit the block — and that
 * is exactly one `git checkout -- AGENTS.md` away from clean, which is the line the reporter prints.
 *
 * **`gitnexus analyze` is idempotent for the same two files**, by the same shape of guard:
 * `upsertGitNexusSection` (`gitnexus/dist/cli/ai-context.js`) masks the volatile counts, compares,
 * and returns `'preserved'` **without writing** when the only delta is them (#2907 — otherwise every
 * reindex would dirty a committed guide). Measured on the primary checkout, not argued: #1176 wrote
 * `AGENTS.md` and `CLAUDE.md` at 16:13:10, `gitnexus analyze` ran at 16:18:31 (it created `.agents/`
 * and `.gitnexus/`), and both files still hashed identical to `HEAD` afterwards — the only path that
 * run left dirty was `?? .agents/`, which `.gitignore` now covers.
 *
 * ## Usage
 *
 *   node scripts/tree-hygiene.mjs                 the table: one block per changed path
 *   node scripts/tree-hygiene.mjs --json          the same rows as JSON, one object per path
 *   node scripts/tree-hygiene.mjs --count         the number of changed paths, and nothing else
 *   node scripts/tree-hygiene.mjs --known-only    only the rows a *tool* wrote (the gate's form)
 *
 * Exit: **0 always** when the tree can be read (a dirty tree is data, not an error), 1 when git
 * itself fails — a report that cannot read the tree must not be mistaken for a clean one.
 */
import { execFileSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

export const UNKNOWN_WRITER = "unknown writer";

/**
 * @typedef {{ kind: "file" | "dir"; path: string; writer: string; why: string; clear: string }} PathRule
 * @typedef {{ kind: "glob"; path: RegExp; writer: string; why: string; clear: string }} GlobRule
 */

/**
 * One row per path this repo's tools write. `kind` decides how `path` is matched:
 *
 *   `file`  exact, root-relative — never `docs/AGENTS.md`, because gitnexus's own matcher is
 *           root-relative and a nested file is somebody's real work.
 *   `dir`   every path beneath it, at the root (`path` ends in `/`).
 *   `glob`  a small anchored pattern, for a family of generated pages.
 *
 * `clear` is the command printed for a human to run. It is chosen for the common case and says the
 * alternative where one exists — the reporter does not know whether the change was wanted.
 *
 * @type {readonly (PathRule | GlobRule)[]}
 */
export const WRITER_RULES = [
  {
    kind: "file",
    path: "AGENTS.md",
    writer: "`next dev` (the `nextjs-agent-rules` block) · `gitnexus analyze` (its stats block)",
    why: "next re-adds its managed block when the installed version's text differs; gitnexus rewrites its own block on every analyze",
    clear: "git checkout -- AGENTS.md   (or commit it, if the block is the one you want)",
  },
  {
    kind: "file",
    path: "CLAUDE.md",
    writer: "`gitnexus analyze`",
    why: "gitnexus writes its agent block at the repo root; nothing ignores it",
    clear: "rm CLAUDE.md   (or commit it)",
  },
  {
    kind: "dir",
    path: ".claude/",
    writer: "`gitnexus analyze`",
    why: "the gitnexus agent-skill mirrors (`GITNEXUS_MANAGED_PATHS`); not ignored, because a human may keep settings here",
    clear: "rm -r .claude",
  },
  {
    kind: "dir",
    path: ".cursor/",
    writer: "`gitnexus analyze`",
    why: "the same skill mirrors, for Cursor; not ignored for the same reason as `.claude/`",
    clear: "rm -r .cursor",
  },
  {
    kind: "dir",
    path: ".agents/",
    writer: "`gitnexus analyze` (`dist/cli/skill-gen.js` mirrors the generated skills here)",
    why: "a generator's working directory, gitignored since #1178 — it should not appear at all",
    clear: "rm -r .agents",
  },
  {
    kind: "dir",
    path: ".gitnexus/",
    writer: "`gitnexus analyze`",
    why: "the analysis index (already in `.git/info/exclude` in this clone)",
    clear: "rm -r .gitnexus",
  },
  {
    kind: "dir",
    path: ".next/",
    writer: "`next dev` / `next build`",
    why: "the build directory — gitignored, so it only appears here if it was committed by mistake",
    clear: "git checkout -- .next",
  },
  {
    kind: "file",
    path: "next-env.d.ts",
    writer: "`next dev` / `next build`",
    why: "Next rewrites the reference header when its types move — gitignored in this repo",
    clear: "git checkout -- next-env.d.ts",
  },
  {
    kind: "dir",
    path: "data/generated/",
    writer: "`pnpm gen`",
    why: "generated fixture modules; gitignored, and the active set when present",
    clear: "rm -r data/generated",
  },
  {
    kind: "file",
    path: "docs/glossary.md",
    writer: "`pnpm glossary` (`scripts/gen-glossary.mjs`)",
    why: "generated from the schema comments — never edit the page",
    clear: "git checkout -- docs/glossary.md   (or: pnpm glossary && commit it)",
  },
  {
    kind: "glob",
    path: /^docs\/changelog\/v[^/]+\.md$/,
    writer: "`scripts/changelog-view.mjs` (`pnpm changelog`)",
    why: "a view of `CHANGELOG.md` copied page by page",
    clear: "git checkout -- docs/changelog   (or: pnpm changelog && commit it)",
  },
  {
    kind: "file",
    path: "docs/ui-registry.md",
    writer: "`scripts/gen-ui-registry.mjs` (`pnpm ui:registry`)",
    why: "generated from `components/`, `app/` and `data/ui-registry.ts`",
    clear: "git checkout -- docs/ui-registry.md   (or: pnpm ui:registry && commit it)",
  },
  {
    kind: "file",
    path: "lib/email/bodies.generated.ts",
    writer: "`scripts/gen-email-bodies.mjs` (`pnpm email:bodies`)",
    why: "generated from `content/email-bodies.md`",
    clear: "git checkout -- lib/email/bodies.generated.ts   (or: pnpm email:bodies && commit it)",
  },
  {
    kind: "file",
    path: "data/health/platform-health.json",
    writer: "`scripts/release.sh`'s record step (`pnpm health:record --db --gate`)",
    why: "the record lands as its own `chore(health): re-record …` PR *after* the cut, so a release leaves this file uncommitted on purpose",
    clear:
      "git checkout -- data/health/platform-health.json   (or land it as its own `chore(health): re-record …` commit — the record is owed, not dirt)",
  },
];

/**
 * The status letters `git status --porcelain` prints, spelled out. `??` is untracked and `!!` is
 * ignored (only present when git was asked for ignored paths); the rest are the two columns of the
 * short format, index then worktree, which is why `M` alone is ambiguous and the pair is not.
 */
export const STATUS_WORDS = {
  M: "modified",
  A: "added",
  D: "deleted",
  R: "renamed",
  C: "copied",
  U: "unmerged",
  T: "type changed",
  "??": "untracked",
  "!!": "ignored",
};

/** The unmerged pairs from `git status`'s short format, which read as one state to a human. */
const UNMERGED = new Set(["DD", "AU", "UD", "UA", "DU", "AA", "UU"]);

/**
 * Read `git status --porcelain -z` into one record per changed path.
 *
 * `-z` is what makes this safe rather than clever: paths are NUL-separated, never quoted and never
 * escaped, so a path with a space, a quote or a newline in it survives intact — and a rename arrives
 * as a second record rather than as the ` -> ` arrow the non-NUL format invents, which would split
 * on a filename that legitimately contains that arrow.
 */
export function parsePorcelain(raw) {
  const records = String(raw ?? "")
    .split("\0")
    .filter((record) => record.length > 0);
  const entries = [];

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    // `XY PATH` — two status characters, one space, then the path.
    const code = record.slice(0, 2);
    const path = record.slice(3);
    if (path.length === 0) continue;
    const entry = { code, path };
    if (code.startsWith("R") || code.startsWith("C")) {
      // A rename/copy record is followed by the path it came from.
      const from = records[index + 1];
      if (from !== undefined && from.length > 0) {
        entry.from = from;
        index += 1;
      }
    }
    entries.push(entry);
  }

  return entries;
}

/** A status code as a word: `M ` and ` M` both read `modified`, `??` reads `untracked`. */
export function describeCode(code) {
  const pair = String(code ?? "");
  if (pair.length < 2) return STATUS_WORDS[pair] ?? "changed";
  if (UNMERGED.has(pair)) return "unmerged";
  if (STATUS_WORDS[pair] !== undefined) return STATUS_WORDS[pair];
  const worktree = pair[1];
  const index = pair[0];
  if (worktree !== " " && STATUS_WORDS[worktree] !== undefined) return STATUS_WORDS[worktree];
  if (index !== " " && STATUS_WORDS[index] !== undefined) return STATUS_WORDS[index];
  return "changed";
}

/** Root-relative, `/`-separated, no `./` prefix — the form the table is written in. */
export function normalisePath(path) {
  return String(path ?? "")
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/\/+$/, "");
}

/**
 * The rule for one path, or `null`.
 *
 * `null` is the honest answer for a path no tool owns, and every caller turns it into `unknown
 * writer` rather than into a guess. Order matters only in that `file` is checked before `dir`; the
 * table has no overlapping rows today and `tests/tree-hygiene.test.ts` holds that too.
 */
export function lookupWriter(path) {
  const target = normalisePath(path);
  if (target.length === 0) return null;
  for (const rule of WRITER_RULES) {
    if (rule.kind === "file" && target === rule.path) return rule;
    if (rule.kind === "dir" && `${target}/`.startsWith(rule.path)) return rule;
    if (rule.kind === "glob" && rule.path.test(target)) return rule;
  }
  return null;
}

/** One changed path, with its writer resolved or explicitly unknown. */
export function attribute(entry) {
  const path = normalisePath(entry.path);
  const rule = lookupWriter(path);
  return {
    path,
    status: describeCode(entry.code),
    code: entry.code,
    ...(entry.from ? { from: normalisePath(entry.from) } : {}),
    writer: rule ? rule.writer : UNKNOWN_WRITER,
    why: rule ? rule.why : "not in the writer table — nothing is assumed about it",
    clear: rule ? rule.clear : "(none printed — a human decides)",
    known: Boolean(rule),
  };
}

/** Every changed path in `root`, attributed. Throws only when git itself cannot be read. */
export function readChangedPaths(root = ROOT) {
  const raw = execFileSync("git", ["status", "--porcelain", "-z"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  return parsePorcelain(raw).map(attribute);
}

/** The table, as the block-per-path text a terminal shows. */
export function renderTable(rows) {
  if (rows.length === 0) return "tree hygiene: clean — no changed path to attribute";
  const known = rows.filter((row) => row.known).length;
  const lines = [
    `tree hygiene: ${rows.length} changed path(s) — ${known} written by a tool, ${
      rows.length - known
    } with ${UNKNOWN_WRITER}`,
    "",
  ];
  for (const row of rows) {
    const from = row.from ? `   (from ${row.from})` : "";
    lines.push(`  ${row.code}  ${row.path}${from}`);
    lines.push(`      status  ${row.status}`);
    lines.push(`      writer  ${row.writer}`);
    lines.push(`      why     ${row.why}`);
    lines.push(`      clear   ${row.clear}`);
    lines.push("");
  }
  lines.push("  These commands are printed, never run — a changed path is sometimes the work.");
  return lines.join("\n");
}

const USAGE =
  "usage: node scripts/tree-hygiene.mjs [--json | --count | --known-only]  (never fails on dirt)";

function main(argv) {
  const flags = new Set(argv);
  for (const flag of flags) {
    if (!["--json", "--count", "--known-only"].includes(flag)) {
      process.stderr.write(`${flag} is not a flag of this script\n${USAGE}\n`);
      return 2;
    }
  }

  let rows;
  try {
    rows = readChangedPaths(ROOT);
  } catch (error) {
    process.stderr.write(`tree-hygiene: git status could not be read — ${error.message}\n`);
    return 1;
  }

  if (flags.has("--count")) {
    process.stdout.write(`${rows.length}\n`);
    return 0;
  }

  const shown = flags.has("--known-only") ? rows.filter((row) => row.known) : rows;

  if (flags.has("--json")) {
    process.stdout.write(`${JSON.stringify(shown, null, 2)}\n`);
    return 0;
  }

  const other = rows.length - shown.length;
  if (flags.has("--known-only") && shown.length === 0) {
    process.stdout.write(
      rows.length === 0
        ? "tree hygiene: clean — no changed path to attribute\n"
        : `tree hygiene: 0 of ${rows.length} changed path(s) were written by a tool — nothing to attribute\n`,
    );
  } else {
    process.stdout.write(`${renderTable(shown)}\n`);
  }
  if (flags.has("--known-only") && other > 0) {
    process.stdout.write(
      `  ${other} changed path(s) with no known writer — assumed to be this branch's own work.\n`,
    );
  }
  return 0;
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  process.exit(main(process.argv.slice(2)));
}
