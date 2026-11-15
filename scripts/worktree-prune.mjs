#!/usr/bin/env node
/**
 * `scripts/worktree-prune.mjs` — reclaim the worktrees cards leave behind, by rule rather than by
 * sweep.
 *
 * Why this exists: every card gets a worktree (`.worktrees/t_<id>`) and nothing ever reclaims one, so
 * the registered list only grows — 151 on 2026-11-08, 73 measured again on 2026-11-14 — and a
 * `git worktree list` that lists shipped work cannot be used as a signal. A worktree left on `main`
 * also pins the branch: `AGENTS.md` records that refusal costing a release. The sweep that fixed the
 * count by hand fixed it once and left no tool, which is why the count came back.
 *
 * A worktree is removed only when **all three** hold, and the rules live in
 * `scripts/worktree-prune-rules.ts` where they are tested:
 *
 *   1. the card that owns the path is `done` or `archived`;
 *   2. the branch is on `origin/main`;
 *   3. the tree is clean — `git status --short`, untracked included.
 *
 * Everything else is kept, with the failing condition printed as a sentence. That list is the real
 * deliverable: a dirty tree, an unmerged branch and a running card are the crash-recovery path, and
 * "it looked stale" is not a condition.
 *
 * ## Condition 2 needs two witnesses, because this repo squash-merges
 *
 * `git merge-base --is-ancestor <branch> origin/main` is the first witness and it is necessary, but on
 * its own it sees almost nothing here: a squash-merged branch **is never an ancestor of `main`** —
 * `docs/operations/branch-triage.md` says so in as many words, calling such a branch "the residue a
 * squash leaves behind". Judged by ancestry alone, every card that actually shipped keeps its
 * worktree forever and the tool reclaims only branches that never carried a change.
 *
 * So when the branch is not an ancestor, its **aggregate patch** (`git diff <fork>..<branch>`, where
 * `<fork>` is `merge-base origin/main <branch>`) is compared by `git patch-id` against the commits of
 * `origin/main` since that fork point, restricted to the paths the branch touched. A match proves the
 * squash that landed the work is on `main`, and the printed proof names it.
 *
 * Both witnesses fail closed. Anything that makes the patch differ — a conflict resolved at squash
 * time, a commit pushed after the merge, work that landed across several commits — leaves the
 * worktree **kept**, and the survivor list says so. A false "keep" costs a directory; a false
 * "remove" costs work.
 *
 * ## What it will not touch, whatever the flags say
 *
 *   - **`.worktrees/t_3eb17cf8`** — the archived v1.20.0 prep, preserved by path in `EXCLUDED_PATHS`
 *     because its uncommitted files *are* the artifact.
 *   - the **primary checkout**, and the **worktree the command is running in**.
 *   - a **detached HEAD**: no branch, so no merge to prove.
 *   - anything registered **outside `<repo>/.worktrees/`**.
 *   - a **locked** registration, or one whose directory is already gone (`git worktree prune`'s job).
 *
 * It deletes **no branch, local or remote**. `git worktree remove` deregisters a working directory
 * and leaves `refs/heads` alone — that is the whole reason to prefer it to `rm -rf`.
 *
 *   node scripts/worktree-prune.mjs                       # the plan, nothing removed (the default)
 *   node scripts/worktree-prune.mjs --apply               # remove the provable ones
 *   node scripts/worktree-prune.mjs --exclude .worktrees/t_1234abcd --apply
 *   node scripts/worktree-prune.mjs --json                # the same rows, for a capture file
 *
 * Card states are read from the Hermes kanban database, in this order: `--kanban-db`, then
 * `$HERMES_KANBAN_DB`, then `~/.hermes/kanban/boards/$HERMES_KANBAN_BOARD/kanban.db`, then the board
 * in `~/.hermes/kanban/current`, then `~/.hermes/kanban.db`. With no readable database every
 * worktree is kept and the run says why — a machine without the board cannot prove a card is done.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { basenameOf, decideWorktree, EXCLUDED_PATHS } from "./worktree-prune-rules.ts";

/** `node:sqlite` is optional for this script: it is loaded through require() so a runtime without it
 * still runs the prune, keeping every worktree because no card's state can be read. */
const require = createRequire(import.meta.url);

const USAGE = [
  "usage: node scripts/worktree-prune.mjs [options]",
  "",
  "  --apply                 remove the worktrees this run proves; default is a dry run",
  "  --exclude <path>        preserve another worktree, repo-relative (repeatable)",
  "  --kanban-db <path>      the kanban database to read card states from",
  "  --json                  print the rows as JSON instead of a table",
  "  --help                  this text",
  "",
  "Removed only when the card is done/archived, the branch is on origin/main, and the tree is clean.",
  "No branch is ever deleted — `git worktree remove` leaves refs/heads alone.",
].join("\n");

const argv = process.argv.slice(2);
if (argv.includes("--help") || argv.includes("-h")) {
  console.log(USAGE);
  process.exit(0);
}

const apply = argv.includes("--apply");
const asJson = argv.includes("--json");

/** A single-valued flag, or undefined. */
function flagValue(name) {
  const i = argv.indexOf(name);
  if (i === -1) return undefined;
  const value = argv[i + 1];
  if (typeof value !== "string" || value.trim() === "" || value.startsWith("--")) {
    throw new Error(`${name} wants a value`);
  }
  return value.trim();
}

/** Every `--exclude <path>` on the command line, normalised to repo-relative. */
function extraExclusions() {
  const out = [];
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] !== "--exclude") continue;
    const value = argv[i + 1];
    if (typeof value !== "string" || value.trim() === "") throw new Error("--exclude wants a path");
    out.push(value.trim());
  }
  return out;
}

/** Run git, returning `{ ok, out }` rather than throwing — a failed read is a fact, not a crash. */
function git(args, cwd, input) {
  try {
    const out = execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      input,
      maxBuffer: 512 * 1024 * 1024,
      stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    });
    return { ok: true, out: out.replace(/\r\n/g, "\n") };
  } catch (error) {
    const stderr =
      typeof error?.stderr === "string" ? error.stderr : String(error?.message ?? error);
    return { ok: false, out: "", why: stderr.trim().split("\n")[0] ?? "" };
  }
}

/** `git patch-id --stable` over a diff. Empty when the diff is empty or unreadable. */
function patchId(diffText) {
  if (diffText.trim() === "") return "";
  const out = git(["patch-id", "--stable"], undefined, diffText);
  if (!out.ok) return "";
  return out.out.trim().split("\n")[0]?.split(" ")[0] ?? "";
}

/** The registered worktrees, as `git worktree list --porcelain` describes them. */
function worktreeBlocks(primary) {
  const listed = git(["worktree", "list", "--porcelain"], primary);
  if (!listed.ok) throw new Error(`git worktree list failed: ${listed.why}`);
  return listed.out
    .split("\n\n")
    .map((block) => block.split("\n").filter((line) => line !== ""))
    .filter((lines) => lines.length > 0)
    .map((lines) => {
      const facts = { path: "", headSha: "", branch: null, locked: false, prunable: false };
      for (const line of lines) {
        const space = line.indexOf(" ");
        const key = space === -1 ? line : line.slice(0, space);
        const value = space === -1 ? "" : line.slice(space + 1);
        if (key === "worktree") facts.path = value;
        else if (key === "HEAD") facts.headSha = value;
        else if (key === "branch") facts.branch = value.replace(/^refs\/heads\//, "");
        else if (key === "locked") facts.locked = true;
        else if (key === "prunable") facts.prunable = true;
      }
      return facts;
    });
}

/**
 * The kanban database, first candidate that opens. `undefined` is a real answer: the caller keeps
 * every worktree rather than guessing that an unknown card is finished.
 */
function kanbanDatabasePath(primary) {
  const explicit = flagValue("--kanban-db");
  if (explicit !== undefined) return isAbsolute(explicit) ? explicit : join(primary, explicit);

  const fromEnv = process.env.HERMES_KANBAN_DB;
  if (fromEnv !== undefined && fromEnv !== "") return fromEnv;

  const home = homedir();
  const boards = join(home, ".hermes", "kanban", "boards");
  const named = process.env.HERMES_KANBAN_BOARD;
  if (named !== undefined && named !== "") return join(boards, named, "kanban.db");

  try {
    const current = readFileSync(join(home, ".hermes", "kanban", "current"), "utf8").trim();
    if (current !== "" && existsSync(join(boards, current, "kanban.db"))) {
      return join(boards, current, "kanban.db");
    }
  } catch {
    // No `current` pointer is not an error; the legacy single-database path is next.
  }
  return join(home, ".hermes", "kanban.db");
}

/** Cards by workspace path, and by id. Both maps are empty when there is no readable database. */
function loadCards(path) {
  const byPath = new Map();
  const byId = new Map();
  if (path === undefined || !existsSync(path)) return { byPath, byId, source: null };

  let DatabaseSync;
  try {
    ({ DatabaseSync } = require("node:sqlite"));
  } catch {
    return { byPath, byId, source: null };
  }

  try {
    const db = new DatabaseSync(path, { readOnly: true });
    const rows = db.prepare("select id, status, workspace_path from tasks").all();
    db.close();
    for (const row of rows) {
      const card = { id: String(row.id), status: String(row.status) };
      byId.set(card.id, card);
      if (typeof row.workspace_path === "string" && row.workspace_path !== "") {
        const list = byPath.get(row.workspace_path) ?? [];
        list.push(card);
        byPath.set(row.workspace_path, list);
      }
    }
    return { byPath, byId, source: path };
  } catch {
    return { byPath, byId, source: null };
  }
}

/** Cards claiming one worktree path: the exact workspace match first, then the `t_<id>` folder name. */
function cardsAt(path, cards) {
  const exact = cards.byPath.get(path);
  if (exact !== undefined) return exact;
  const id = basenameOf(path).match(/^t_[0-9a-f]{8}/)?.[0];
  const byId = id === undefined ? undefined : cards.byId.get(id);
  return byId === undefined ? [] : [byId];
}

/**
 * Is the branch on `origin/main`? Ancestry first, then the squashed patch.
 *
 * The per-fork map of `origin/main` patch ids is memoised, because a sweep asks the same fork
 * hundreds of times and the recomputation is the only slow part of the run.
 */
function mergedWitness(branch, primary, cache) {
  if (git(["merge-base", "--is-ancestor", branch, "origin/main"], primary).ok) {
    return { witness: "ancestor", mergedAs: null };
  }

  const fork = git(["merge-base", "origin/main", branch], primary);
  if (!fork.ok || fork.out.trim() === "") return { witness: "unknown", mergedAs: null };
  const forkSha = fork.out.trim();

  const changed = git(["diff", "--name-only", `${forkSha}..${branch}`], primary);
  if (!changed.ok) return { witness: "unknown", mergedAs: null };
  const paths = changed.out.split("\n").filter((line) => line !== "");
  if (paths.length === 0) return { witness: "no-delta", mergedAs: null };

  const diff = git(["diff", "--binary", `${forkSha}..${branch}`], primary);
  if (!diff.ok) return { witness: "unknown", mergedAs: null };
  const wanted = patchId(diff.out);
  if (wanted === "") return { witness: "unknown", mergedAs: null };

  const cacheKey = `${forkSha}\u0000${[...paths].sort().join(",")}`;
  let onMain = cache.get(cacheKey);
  if (onMain === undefined) {
    onMain = new Map();
    const log = git(
      ["log", "--format=@@@%H %s", "-p", `${forkSha}..origin/main`, "--", ...paths],
      primary,
    );
    if (log.ok) {
      for (const chunk of log.out.split("@@@")) {
        if (chunk.trim() === "") continue;
        const newline = chunk.indexOf("\n");
        const header = (newline === -1 ? chunk : chunk.slice(0, newline)).trim();
        const body = newline === -1 ? "" : chunk.slice(newline + 1);
        const id = patchId(body);
        if (id !== "" && !onMain.has(id)) onMain.set(id, header);
      }
    }
    cache.set(cacheKey, onMain);
  }

  const carrier = onMain.get(wanted);
  return carrier === undefined
    ? { witness: "none", mergedAs: null }
    : { witness: "patch", mergedAs: carrier };
}

// Nothing below needs `node:sqlite` to be present; `loadCards` degrades to "no card state".
function main() {
  const cwd = process.cwd();
  const top = git(["rev-parse", "--show-toplevel"], cwd);
  if (!top.ok) {
    console.error(`worktree-prune: ${cwd} is not inside a git worktree`);
    process.exit(2);
  }
  const blocks = worktreeBlocks(cwd);
  const primary = blocks[0]?.path ?? top.out.trim();

  const originMain = git(["rev-parse", "--verify", "origin/main"], primary);
  if (!originMain.ok) {
    console.error("worktree-prune: no origin/main — run `git fetch origin` first");
    process.exit(2);
  }
  const originMainSha = originMain.out.trim();

  const exclusions = [...EXCLUDED_PATHS, ...extraExclusions()];
  const cards = loadCards(kanbanDatabasePath(primary));
  const cache = new Map();
  const cwdResolved = resolve(cwd);

  const rows = blocks.map((block) => {
    const path = block.path;
    const status = git(["status", "--short", "--untracked-files=all"], path);
    const facts = {
      path,
      relativePath: relative(primary, path).split("\\").join("/"),
      branch: block.branch,
      headSha: block.headSha,
      isPrimary: resolve(path) === resolve(primary),
      isCwd: resolve(path) === cwdResolved,
      underWorktreesDir: path.startsWith(`${primary}/.worktrees/`),
      locked: block.locked,
      prunable: block.prunable,
      cards: cardsAt(path, cards),
      dirtyFiles: status.ok ? status.out.split("\n").filter((line) => line !== "").length : null,
      witness: "none",
      mergedAs: null,
    };
    // The merge test is the expensive one; skip it when an earlier condition already decides.
    if (facts.branch !== null && !facts.locked && !facts.prunable && facts.underWorktreesDir) {
      const merged = mergedWitness(facts.branch, primary, cache);
      facts.witness = merged.witness;
      facts.mergedAs = merged.mergedAs;
    }
    return { facts, decision: decideWorktree(facts, exclusions) };
  });

  const removals = rows.filter((row) => row.decision.action === "remove");
  const keeps = rows.filter((row) => row.decision.action === "keep");

  /** A row's name: repo-relative when it sits inside the repository, absolute when it does not. */
  const label = (row) => {
    const rel = row.facts.relativePath;
    if (rel === "") return "(repository root)";
    return rel.startsWith("../") ? row.facts.path : rel;
  };

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          originMain: originMainSha,
          kanban: cards.source,
          registered: rows.length,
          remove: removals.map((row) => ({
            path: row.facts.relativePath,
            branch: row.facts.branch,
            card: row.facts.cards.map((card) => card.id),
            witness: row.facts.witness,
            mergedAs: row.facts.mergedAs,
          })),
          keep: keeps.map((row) => ({ path: row.facts.relativePath, reason: row.decision.reason })),
        },
        null,
        2,
      ),
    );
  } else {
    console.log(`worktree-prune: ${primary}`);
    console.log(`  origin/main        ${originMainSha.slice(0, 8)}`);
    console.log(`  registered         ${rows.length}`);
    console.log(
      `  kanban             ${cards.source ?? "not readable — every card's state is unknown"}`,
    );
    console.log(`  excluded           ${exclusions.join(", ")}`);
    console.log("");
    console.log(`to remove (${removals.length})`);
    if (removals.length === 0) console.log("  none");
    for (const row of removals) {
      console.log(`  ${label(row).padEnd(38)} ${row.decision.reason}`);
    }
    console.log("");
    console.log(`kept (${keeps.length})`);
    for (const row of keeps) {
      console.log(`  ${label(row).padEnd(38)} ${row.decision.reason}`);
    }
  }

  if (!apply) {
    if (!asJson) {
      console.log("");
      console.log("  dry run — nothing removed. Re-run with --apply to remove the list above.");
    }
    return 0;
  }

  let removed = 0;
  const failures = [];
  for (const row of removals) {
    const result = git(["worktree", "remove", row.facts.path], primary);
    if (result.ok) removed += 1;
    else failures.push({ path: row.facts.relativePath, why: result.why ?? "unknown" });
  }

  // Registrations whose directory is already gone are git's business, and only after the removals —
  // `git worktree prune` before a move is what loses an entry.
  const swept = git(["worktree", "prune"], primary);
  const after = git(["worktree", "list", "--porcelain"], primary);
  const countOf = (result) =>
    result.ok ? result.out.split("\n\n").filter((block) => block.trim() !== "").length : null;

  if (!asJson) {
    console.log("");
    console.log(`  removed            ${removed}/${removals.length}`);
    if (failures.length > 0) {
      console.log(`  failed             ${failures.length}`);
      for (const failure of failures) console.log(`    ${failure.path} — ${failure.why}`);
    }
    console.log(`  worktree prune     ${swept.ok ? "ok" : (swept.why ?? "failed")}`);
    const now = countOf(after);
    const otherWorkers = now === null ? 0 : now - (rows.length - removed);
    console.log(
      `  registered now     ${now ?? "?"} (was ${rows.length}, ${removed} removed${otherWorkers > 0 ? `, ${otherWorkers} created elsewhere during the run` : ""})`,
    );
    console.log(
      "  branches           none deleted — `git worktree remove` leaves refs/heads alone",
    );
  }
  return failures.length === 0 ? 0 : 1;
}

try {
  process.exit(main());
} catch (error) {
  console.error(`worktree-prune: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
