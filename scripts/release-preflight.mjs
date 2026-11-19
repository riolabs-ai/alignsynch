#!/usr/bin/env node
/**
 * scripts/release-preflight.mjs — `pnpm release:preflight <version>`: the ten facts a cut must be
 * true before `scripts/release.sh --tag-only` writes a byte, as one command with a ✗ per failure.
 *
 * The requirement is card t_3c37542f; no GitHub issue carries it, so the card is cited rather than
 * an invented number.
 *
 * Every cut so far has failed in one of these ways, and each one was invisible until the cut was
 * already running:
 *
 *   a stale checkout        8 commits behind, `package.json` on the previous version;
 *   a stale build cache     `.next/dev/types` on disk making `typecheck` red on a clean tree;
 *   two cuts at once        two `release.sh --tag-only` runs sharing one `.next` and one gate slot;
 *   a local check that disagreed with CI, because the commit had never been read by a run;
 *   a `record` step that silently skipped because the shell had no `DATABASE_URL` — on both rc1
 *                           and rc1.1, each leaving `/admin/health` naming the previous release.
 *
 * Each of those is a fact that can be checked in about a second, so each is a check here, numbered
 * and printed with a remedy. The checks live in the cut and nowhere else: `tag is free` and `no
 * concurrent cut` are false mid-development, so this script is deliberately **not** a step in
 * `scripts/verify.sh` or in CI — a check that only lived in CI would be a red push, and this one
 * lives where it is read, which is the cut.
 *
 * ## The ten checks
 *
 *   1  no concurrent cut          another `release.sh` / `release-cut` on this repository, by
 *                                 scanning the process table (this process, its ancestor chain and
 *                                 cuts of other repositories excluded)
 *   2  checkout current           after `git fetch origin --prune`, `HEAD === origin/main`
 *   3  tree clean                 `git status --porcelain` prints nothing
 *   4  version matches            `package.json` names the version being cut
 *   5  tag is free                `v<version>` is absent locally **and** on the remote
 *   6  entry exists, and honest   `docs/changelog/v<version>.md` exists and `release.sh --check`
 *                                 is green
 *   7  no stale build cache       `.next/dev` and `.next/types` are absent (a `next dev` ran here)
 *   8  record step can run        a database URL is in the environment, or `--no-record` was passed
 *   9  CI green at this sha       `gh run list --commit HEAD` shows a success and no failure
 *  10  no merges in flight        no open pull request, or `--allow-open-prs` was passed
 *
 * ## Two flags, each covering exactly one check
 *
 *   `--no-record`       check 8 — print the record command and publish; the record is then owed
 *   `--allow-open-prs`  check 10 — the open queue is known and the operator accepts it
 *
 * Both print a warning line naming what was waved through, so a cut that proceeds anyway says so
 * in its own output. **An unverifiable check is always ✗**: a missing or unauthenticated `gh` fails
 * checks 9 and 10 rather than degrading to a warning, because an unverified cut is the failure this
 * script exists to prevent. The flags wave through a check that ran and failed, never one that could
 * not run — which is why `--allow-open-prs` does not make an unreadable queue green.
 *
 * ## What this script does not do
 *
 * It fixes nothing. It fetches remote-tracking refs (which never moves `HEAD`), reads, prints and
 * exits — no `git pull`, no `git switch`, no `rm -rf .next`, no `--force`. Every failure is a line
 * with the command that clears it, and running that command is the operator's act. It also weakens
 * no existing refusal: `scripts/release.sh` keeps its own dirty-tree, contains-origin/main, tag-exists
 * and red-gate refusals, and runs them after this.
 *
 * ## Exit
 *
 *   0  all ten pass (a warned-through check still passes)
 *   1  at least one check failed — the ✗ lines say which, and each prints its remedy
 *   2  usage: no version, a version that is not semver, or an unknown flag
 *
 * Colour is printed only to a terminal, so a transcript captured to a file is plain text.
 *
 * Usage:
 *   pnpm release:preflight <version>                    the ten checks for a cut of <version>
 *   pnpm release:preflight <version> --no-record        check 8 waved through, with a warning
 *   pnpm release:preflight <version> --allow-open-prs   check 10 waved through, with a warning
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, readlinkSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { normalizeVersion } from "./release-version.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/** The ten checks, in order. `rows[n - 1].key` is the name printed for check `n`. */
export const CHECK_NAMES = [
  "no concurrent cut",
  "checkout current",
  "tree clean",
  "version matches",
  "tag is free",
  "entry exists and is honest",
  "no stale build cache",
  "record step can run",
  "CI green at this sha",
  "no merges in flight",
];

/**
 * Every remedy this script prints, in one place so a failure and its instruction can never drift.
 * Wording is the card's, because the operator has read the card.
 */
export const REMEDY = {
  concurrent: (pid) =>
    `another cut is running (pid ${pid}) — wait for it or kill it; two cuts corrupt \`.next\` and the gate slots`,
  checkout: "git switch main && git pull --ff-only",
  dirty: "the cut refuses a dirty tree — commit it, or park it",
  version: (have, want) =>
    `package.json is ${have ?? "(unreadable)"} and the cut is ${want} — prepare the bump, merge it, then cut again`,
  tag: "a published tag is immutable — the next attempt is the next version",
  entry: (path) =>
    `write ${path} — the release's own page — then \`pnpm changelog\` and \`pnpm docs:nav\``,
  entryCheck:
    "fix the CHANGELOG entry, not the check — `bash scripts/release.sh --check` names the disagreement",
  cache:
    "remove `.next` before the gate: dev types poison `typecheck` on a clean tree (`rm -rf .next`)",
  record:
    "run under `bin/withenv.sh`, or pass `--no-record` and record separately — a silent skip leaves `/admin/health` stale",
  prs: "a merge moves main mid-cut; land or park them first (or pass --allow-open-prs)",
};

const PALETTE = {
  bold: "\u001b[1m",
  dim: "\u001b[2m",
  off: "\u001b[0m",
  green: "\u001b[32m",
  red: "\u001b[31m",
  yellow: "\u001b[33m",
};
const NO_COLOUR = {
  bold: "",
  dim: "",
  off: "",
  green: "",
  red: "",
  yellow: "",
};

/* ------------------------------------------------------------------ *
 * Pure predicates — every one of them a case in tests/release-preflight.test.ts
 * ------------------------------------------------------------------ */

/**
 * Is this a process that is *cutting*? Two shapes exist: `bash scripts/release.sh <mode>` and
 * `node scripts/release-cut.mjs <mode>`, and both have read-only modes that write nothing.
 *
 * The read-only mode is excluded on purpose, and it is not a loophole: `scripts/verify.sh` runs
 * `bash scripts/release.sh --check` as a gate step in every lane, so counting it would make a cut
 * refuse whenever any other shell was running the gate — a guard red on every healthy tree is a
 * guard everyone learns to ignore. `release-cut.mjs` is the same shape: its default mode is `plan`,
 * and only `--prepare` and `--execute` write.
 *
 * An interpreter must be named, so `vim scripts/release.sh` and `grep release.sh` are not cuts.
 */
export function isCutCommand(argv) {
  const words = (argv ?? []).map(String);
  const text = words.join(" ");
  const match =
    /(?:^|[\s/])(?:bash|sh|dash|zsh|node)\s+\S*?(scripts\/)?(release\.sh|release-cut\.mjs)\b/.exec(
      text,
    );
  if (!match) return false;
  const flags = new Set(words.filter((word) => word.startsWith("-")));
  if (match[2] === "release.sh") {
    for (const readOnly of ["--check", "--check-limits", "--dry-run", "--help", "-h"]) {
      if (flags.has(readOnly)) return false;
    }
    return true;
  }
  return flags.has("--prepare") || flags.has("--execute");
}

/**
 * The first cutting process in an injected process list, or `null`.
 *
 * Self and the whole **ancestor chain** are excluded, not just the direct parent. This script is
 * *started by* the cut it checks — `release.sh --tag-only` → `node release-preflight.mjs` — so the
 * cut is an ancestor, and counting it would refuse every cut that runs the guard. The chain rather
 * than the parent alone because a wrapper shell is the usual shape in a scripted or agent-run
 * session: `bash -c "… bash scripts/release.sh --tag-only 2.0.0 "` carries the whole command line as
 * its own `argv`, is an ancestor, and is not a second cut. A sibling (`pid` beside `pid`) is.
 *
 * A cut in a **different repository** is not this cut's business: `sameRepo(entry)` is injected by
 * the caller (`gather()` compares git's common dir and the worktree path) so the rule stays pure and
 * testable, and so two scratch trees cutting at once — the shape of a test suite, or two unrelated
 * projects on one machine — do not refuse each other. The default counts every candidate, because
 * an entry whose working directory is unreadable is unknown rather than foreign, and unknown is
 * counted.
 *
 * @param {Array<{ pid: number, argv?: string[], command?: string, cwd?: string | null }>} processes
 * @param {{ selfPid?: number, parentPid?: number, ancestors?: number[], sameRepo?: (entry: any) => boolean }} [options]
 */
export function findConcurrentCut(
  processes,
  { selfPid, parentPid, ancestors = [], sameRepo = () => true } = {},
) {
  const excluded = new Set([selfPid, parentPid, ...ancestors].filter(Boolean));
  for (const entry of processes ?? []) {
    if (!entry) continue;
    if (excluded.has(entry.pid)) continue;
    if (!isCutCommand(entry.argv ?? String(entry.command ?? "").split(/\s+/))) continue;
    if (!sameRepo(entry)) continue;
    return entry;
  }
  return null;
}

/**
 * The parent of a pid, from `/proc`'s `stat` or `ps`. The `comm` field may contain spaces and
 * parentheses, so the fields are read from the last `)` rather than by splitting from the start.
 */
function parentOf(pid) {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
    const close = stat.lastIndexOf(")");
    if (close > 0) {
      const fields = stat.slice(close + 2).split(" ");
      const ppid = Number(fields[1]);
      if (Number.isInteger(ppid) && ppid > 0) return ppid;
    }
  } catch {
    // No /proc for this pid — fall through to ps.
  }
  const run = spawnSync("ps", ["-o", "ppid=", "-p", String(pid)], { encoding: "utf8" });
  const ppid = Number(String(run.stdout ?? "").trim());
  return Number.isInteger(ppid) && ppid > 0 ? ppid : null;
}

/**
 * This process's ancestors, nearest first, up to `depth` links — the pids check 1 must not count.
 *
 * @param {number} [startPid]
 * @param {number} [depth]
 * @returns {number[]}
 */
export function ancestorPids(startPid = process.ppid, depth = 8) {
  const chain = [];
  let pid = Number(startPid);
  while (pid > 1 && chain.length < depth) {
    chain.push(pid);
    const next = parentOf(pid);
    if (!next || next === pid) break;
    pid = next;
  }
  return chain;
}

/** Where a release's own page lives: `2.0.0-rc1.1` → `docs/changelog/v2-0-0-rc1-1.md`. */
export function entryPathFor(version) {
  return `docs/changelog/v${String(version).replace(/\./g, "-")}.md`;
}

/**
 * `git status --porcelain` → the paths it names, status letters stripped so the line an operator
 * reads is a filename and not `?? scratch.txt`; `null` when the command itself could not run.
 */
export function statusPaths(status) {
  if (status === null || status === undefined) return null;
  return String(status)
    .split("\n")
    .map((line) => line.replace(/\r$/, ""))
    .filter((line) => line.length > 0)
    .map((line) => {
      const match = /^.{2}\s+(.*)$/.exec(line);
      return (match ? match[1] : line).trim();
    })
    .filter((path) => path.length > 0);
}

const short = (sha) => (sha ? String(sha).slice(0, 7) : "(none)");

function describe(entry) {
  const argv = entry.argv ?? String(entry.command ?? "").split(/\s+/);
  const text = argv.join(" ");
  return text.length > 68 ? `${text.slice(0, 65)}…` : text;
}

/**
 * The verdict. Pure: `gather()` reads git, the files, `gh` and the process table; this decides. So
 * every check is a case in `tests/release-preflight.test.ts` — including ten cases where exactly one
 * check fails, which is what proves no check is shadowed by another.
 *
 * Every other check reports `bad` when its evidence could not be read at all (`status: null`, an
 * unreadable process table, an unauthenticated `gh`): "I could not look" is not "it is fine".
 */
export function evaluate(evidence) {
  const version = evidence.version ?? "(no version)";
  const rows = [];
  const row = (n, ok, value, extra = {}) =>
    rows.push({ n, key: CHECK_NAMES[n - 1], status: ok ? "ok" : "bad", value, ...extra });

  /* 1 — no concurrent cut --------------------------------------------------- */
  if (evidence.processes == null) {
    row(1, false, "the process table could not be read", {
      remedy: "cannot verify that no other cut is running — `ps -eo pid=,args=` must work first",
    });
  } else {
    const offender = findConcurrentCut(evidence.processes, {
      selfPid: evidence.selfPid,
      parentPid: evidence.parentPid,
      ancestors: evidence.ancestors ?? [],
      sameRepo: evidence.sameRepo,
    });
    if (offender) {
      row(1, false, `pid ${offender.pid} — ${describe(offender)}`, {
        remedy: REMEDY.concurrent(offender.pid),
      });
    } else {
      row(1, true, "no other release.sh / release-cut process");
    }
  }

  /* 2 — checkout current ---------------------------------------------------- */
  const head = typeof evidence.head === "string" ? evidence.head.trim() : "";
  const originMain = typeof evidence.originMain === "string" ? evidence.originMain.trim() : "";
  if (!head) {
    row(2, false, "HEAD could not be read", { remedy: REMEDY.checkout });
  } else if (!originMain) {
    row(2, false, `${short(head)} is not comparable — origin/main could not be read`, {
      remedy: REMEDY.checkout,
    });
  } else if (head !== originMain) {
    row(2, false, `HEAD ${short(head)} is not origin/main ${short(originMain)}`, {
      remedy: REMEDY.checkout,
    });
  } else {
    row(2, true, `HEAD ${short(head)} is origin/main`);
  }

  /* 3 — tree clean ---------------------------------------------------------- */
  const paths = statusPaths(evidence.status);
  if (paths === null) {
    row(3, false, "git status could not be read", { remedy: REMEDY.dirty });
  } else if (paths.length > 0) {
    const shown = paths.slice(0, 5).join(", ");
    const more = paths.length > 5 ? ` (+${paths.length - 5} more)` : "";
    row(3, false, `${paths.length} path(s): ${shown}${more}`, { paths, remedy: REMEDY.dirty });
  } else {
    row(3, true, "git status --porcelain prints nothing");
  }

  /* 4 — version matches ----------------------------------------------------- */
  const packageVersion = evidence.packageVersion ?? null;
  if (packageVersion !== version) {
    row(4, false, `package.json is ${packageVersion ?? "(unreadable)"}, cutting ${version}`, {
      remedy: REMEDY.version(packageVersion, version),
    });
  } else {
    row(4, true, `package.json is ${version}`);
  }

  /* 5 — tag is free --------------------------------------------------------- */
  if (evidence.tagLocal || evidence.tagRemote) {
    const where =
      evidence.tagLocal && evidence.tagRemote
        ? "locally and on the remote"
        : evidence.tagLocal
          ? "locally"
          : "on the remote";
    row(5, false, `v${version} exists ${where}`, { remedy: REMEDY.tag });
  } else {
    row(5, true, `v${version} is absent, locally and on the remote`);
  }

  /* 6 — entry exists and is honest ------------------------------------------ */
  const entryPath = evidence.entryPath ?? entryPathFor(version);
  if (!evidence.entryExists) {
    row(6, false, `no ${entryPath}`, { remedy: REMEDY.entry(entryPath) });
  } else if (evidence.releaseCheckStatus !== 0) {
    row(
      6,
      false,
      `${entryPath} exists, but \`release.sh --check\` exited ${evidence.releaseCheckStatus}`,
      {
        remedy: REMEDY.entryCheck,
      },
    );
  } else {
    row(6, true, `${entryPath} exists and \`release.sh --check\` is green`);
  }

  /* 7 — no stale build cache ------------------------------------------------ */
  const cache = evidence.buildCache ?? [];
  if (cache.length > 0) {
    row(7, false, `found ${cache.join(", ")}`, { remedy: REMEDY.cache });
  } else {
    row(7, true, "no .next/dev and no .next/types in this checkout");
  }

  /* 8 — record step can run ------------------------------------------------- */
  if (evidence.databaseUrl) {
    row(8, true, "a database URL is set — the record step can run");
  } else if (evidence.noRecord) {
    row(8, true, "--no-record: the record step is skipped", {
      warning: "--no-record — the cut publishes the tag and owes the record",
    });
  } else {
    row(8, false, "DATABASE_URL is unset and --no-record was not passed", {
      remedy: REMEDY.record,
    });
  }

  /* 9 — CI green at this sha ------------------------------------------------ */
  const ci = evidence.ci;
  const sha = short(ci?.sha ?? head);
  if (!ci?.available) {
    row(9, false, `cannot verify CI at ${sha}`, {
      remedy:
        `cannot verify CI at ${sha} — gh is missing or unauthenticated` +
        `${ci?.reason ? ` (${ci.reason})` : ""}; no flag skips this check, because an unverified ` +
        "cut is the failure this preflight exists to prevent. Fix the cause (`gh auth login`), then cut again",
    });
  } else {
    const runs = ci.runs ?? [];
    const green = runs.filter((run) => run.conclusion === "success");
    const red = runs.filter(
      (run) => run.conclusion && !["success", "skipped", "neutral"].includes(run.conclusion),
    );
    const pending = runs.filter((run) => !run.conclusion);
    const value = `${green.length} green · ${red.length} red · ${pending.length} pending`;
    if (red.length > 0) {
      row(9, false, `${value} — ${red[0].url ?? "the first red run"}`, {
        runs: red,
        remedy:
          `a run at ${sha} did not succeed — read ${red[0].url ?? "the run"} and fix it; ` +
          "a release ships a commit CI has read",
      });
    } else if (green.length === 0) {
      row(9, false, `${value} — no run has succeeded at ${sha}`, {
        remedy:
          `no CI run has completed at ${sha} — push the commit and wait for ` +
          `\`typecheck / lint / build\`, then cut again (\`gh run list --commit ${sha}\`)`,
      });
    } else {
      row(9, true, `${value} at ${sha}`);
    }
  }

  /* 10 — no merges in flight ------------------------------------------------ */
  const prs = evidence.prs;
  if (!prs?.available) {
    row(10, false, "cannot verify open pull requests", {
      remedy:
        `cannot verify the queue — gh is missing or unauthenticated${prs?.reason ? ` (${prs.reason})` : ""}; ` +
        "--allow-open-prs waves through a known queue, never an unknown one. Fix the cause, then cut again",
    });
  } else {
    const open = prs.rows ?? [];
    if (open.length === 0) {
      row(10, true, "no open pull requests");
    } else if (evidence.allowOpenPrs) {
      row(10, true, `${open.length} open pull request(s), waved through`, {
        warning: `--allow-open-prs — ${open.map((pr) => `#${pr.number}`).join(", ")} stay open across the cut`,
        prs: open,
      });
    } else {
      const named = open
        .slice(0, 5)
        .map((pr) => `#${pr.number} ${String(pr.title ?? "").slice(0, 48)}`.trim())
        .join(", ");
      row(10, false, `${open.length} open: ${named}`, { prs: open, remedy: REMEDY.prs });
    }
  }

  const failures = rows.filter((entry) => entry.status === "bad");
  const warnings = rows.filter((entry) => entry.warning);
  return { ok: failures.length === 0, rows, failures, warnings };
}

/**
 * The transcript, as lines. Pure, so a test can assert on the line an operator will read — a guard
 * nobody has seen print a ✗ is a guard nobody trusts.
 *
 * @param {{ rows: Array<Record<string, any>>, ok: boolean, failures: Array<Record<string, any>>, warnings: Array<Record<string, any>> }} result
 * @param {{ version?: string, colour?: boolean }} [options]
 */
export function render(result, { version = "(no version)", colour = false } = {}) {
  const c = colour ? PALETTE : NO_COLOUR;
  const lines = [];
  lines.push(
    `${c.bold}release:preflight${c.off}${c.dim} — v${version}, the ten facts a cut must be true${c.off}`,
  );
  lines.push("");
  for (const entry of result.rows) {
    const glyph = entry.status === "ok" ? `${c.green}✓${c.off}` : `${c.red}✗${c.off}`;
    lines.push(`  ${glyph} ${String(entry.n).padStart(2)} ${entry.key.padEnd(28)} ${entry.value}`);
    for (const line of String(entry.remedy ?? "")
      .split("\n")
      .filter(Boolean)) {
      lines.push(`  ${c.yellow}   fix:${c.off} ${line}`);
    }
    if (entry.warning) lines.push(`  ${c.yellow}       ! ${entry.warning}${c.off}`);
  }
  lines.push("");
  if (result.ok) {
    const flagged = result.warnings.length;
    lines.push(
      `  ${c.green}all ten checks pass${c.off}` +
        (flagged > 0
          ? ` — ${flagged} waved through, named above; the cut carries them into its output`
          : " — the cut may proceed"),
    );
  } else {
    const failed = result.failures.map((entry) => entry.n).join(", ");
    lines.push(
      `  ${c.red}${result.failures.length} of 10 checks failed (${failed}) — the cut refuses${c.off}`,
    );
    lines.push(`  ${c.dim}fix the ✗ lines above, then run this again; nothing was changed${c.off}`);
  }
  return lines;
}

/* ------------------------------------------------------------------ *
 * Gathering the evidence — I/O only, no decisions
 * ------------------------------------------------------------------ */

function git(...args) {
  const run = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
  if (run.status !== 0 || typeof run.stdout !== "string") return null;
  return run.stdout.trim();
}

/**
 * Remote-tracking refs only. `git fetch` never moves `HEAD`, and this script never runs `pull`,
 * `switch` or `checkout`: the remedy for a stale checkout is printed, not executed.
 */
function fetchRefs() {
  spawnSync("git", ["fetch", "--quiet", "--prune", "origin"], { cwd: ROOT, encoding: "utf8" });
}

function readPackageVersion() {
  try {
    return JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).version ?? null;
  } catch {
    return null;
  }
}

function remoteTagExists(version) {
  const run = spawnSync("git", ["ls-remote", "--tags", "origin", `refs/tags/v${version}`], {
    cwd: ROOT,
    encoding: "utf8",
  });
  return run.status === 0 && typeof run.stdout === "string" && run.stdout.trim().length > 0;
}

function releaseCheckStatus() {
  const run = spawnSync("bash", [join(ROOT, "scripts/release.sh"), "--check"], {
    cwd: ROOT,
    stdio: "ignore",
  });
  return run.status ?? 1;
}

/** Which of the two cache directories poison `typecheck` when left behind by `next dev`. */
function staleBuildCache() {
  return [".next/dev", ".next/types"].filter((path) => existsSync(join(ROOT, path)));
}

/**
 * The process table, for check 1. `/proc` on Linux, `ps` everywhere else; `null` when neither can
 * be read, which the check reports as a failure rather than as "no other cut". Each entry carries
 * its working directory where the kernel will give it up, so a cut in another repository can be
 * told apart from a cut of this one.
 */
export function readProcesses() {
  try {
    const entries = readdirSync("/proc", { withFileTypes: true });
    const processes = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || !/^\d+$/.test(entry.name)) continue;
      try {
        const argv = readFileSync(`/proc/${entry.name}/cmdline`, "utf8")
          .split("\0")
          .filter(Boolean);
        if (argv.length === 0) continue;
        let cwd = null;
        try {
          cwd = readlinkSync(`/proc/${entry.name}/cwd`);
        } catch {
          // Another user's process: the link is not readable, and `null` means "unknown", which the
          // foreign-repository test treats as *not* foreign.
        }
        processes.push({ pid: Number(entry.name), argv, cwd });
      } catch {
        // A process that exited between the listing and the read is not evidence of anything.
      }
    }
    if (processes.length > 0) return processes;
  } catch {
    // No /proc — fall through to ps.
  }

  const run = spawnSync("ps", ["-eo", "pid=,args="], { encoding: "utf8" });
  if (run.status !== 0 || typeof run.stdout !== "string") return null;
  const processes = [];
  for (const line of run.stdout.split("\n")) {
    const match = /^\s*(\d+)\s+(.*)$/.exec(line);
    if (!match) continue;
    processes.push({ pid: Number(match[1]), argv: match[2].trim().split(/\s+/), cwd: null });
  }
  return processes.length > 0 ? processes : null;
}

/** Git's common directory for a path — the identity two worktrees of one repository share. */
function repoIdentity(path) {
  const run = spawnSync("git", ["-C", path, "rev-parse", "--git-common-dir"], {
    encoding: "utf8",
  });
  const out = String(run.stdout ?? "").trim();
  if (run.status !== 0 || out.length === 0) return null;
  return resolve(path, out);
}

function ghFailure(run) {
  const stderr = String(run.stderr ?? "")
    .trim()
    .split("\n")[0];
  if (run.error?.code === "ENOENT") return "gh is not installed";
  return stderr.length > 0 ? stderr : `gh exited ${run.status ?? "without a status"}`;
}

function ghAuthenticated() {
  const run = spawnSync("gh", ["auth", "status"], { cwd: ROOT, encoding: "utf8" });
  if (run.status === 0) return { available: true };
  return { available: false, reason: ghFailure(run) };
}

function ciEvidence(sha) {
  const auth = ghAuthenticated();
  if (!auth.available) return { available: false, reason: auth.reason };
  const run = spawnSync(
    "gh",
    [
      "run",
      "list",
      "--commit",
      sha ?? "HEAD",
      "--limit",
      "50",
      "--json",
      "status,conclusion,url,workflowName",
    ],
    { cwd: ROOT, encoding: "utf8" },
  );
  if (run.status !== 0) return { available: false, reason: ghFailure(run) };
  try {
    const runs = JSON.parse(run.stdout);
    if (!Array.isArray(runs)) return { available: false, reason: "gh returned no run list" };
    return { available: true, sha, runs };
  } catch {
    return { available: false, reason: "gh returned a run list this script cannot read" };
  }
}

function prEvidence() {
  const auth = ghAuthenticated();
  if (!auth.available) return { available: false, reason: auth.reason };
  const run = spawnSync(
    "gh",
    ["pr", "list", "--state", "open", "--limit", "100", "--json", "number,title,headRefName"],
    { cwd: ROOT, encoding: "utf8" },
  );
  if (run.status !== 0) return { available: false, reason: ghFailure(run) };
  try {
    const rows = JSON.parse(run.stdout);
    if (!Array.isArray(rows))
      return { available: false, reason: "gh returned no pull request list" };
    return { available: true, rows };
  } catch {
    return { available: false, reason: "gh returned a pull request list this script cannot read" };
  }
}

function gather(opts) {
  const version = opts.version;
  fetchRefs();
  const head = git("rev-parse", "HEAD");
  const entryPath = entryPathFor(version);
  const here = repoIdentity(ROOT);

  return {
    version,
    selfPid: process.pid,
    parentPid: process.ppid,
    ancestors: ancestorPids(process.ppid),
    processes: readProcesses(),
    // Which candidates are cuts *of this repository*. `repoIdentity` is git's common directory, so
    // a sibling worktree of this repo counts and two scratch trees do not. A cwd that cannot be read
    // is unknown — counted; a cwd that git cannot place is a directory that is not this repository.
    sameRepo: (entry) => {
      if (!entry?.cwd) return true;
      if (entry.cwd === ROOT || entry.cwd.startsWith(`${ROOT}/`)) return true;
      const there = repoIdentity(entry.cwd);
      if (there && here) return there === here;
      return false;
    },
    head,
    originMain: git("rev-parse", "origin/main"),
    status: git("status", "--porcelain"),
    packageVersion: readPackageVersion(),
    tagLocal: Boolean(git("tag", "--list", `v${version}`)),
    tagRemote: remoteTagExists(version),
    entryPath,
    entryExists: existsSync(join(ROOT, entryPath)),
    releaseCheckStatus: releaseCheckStatus(),
    buildCache: staleBuildCache(),
    // Mirrors the record step's own test: `release.sh` accepts either URL, so a cut that can record
    // must not be refused here for holding the unpooled one.
    databaseUrl: process.env.DATABASE_URL || process.env.DATABASE_URL_UNPOOLED || null,
    noRecord: opts.noRecord,
    ci: ciEvidence(head),
    prs: prEvidence(),
    allowOpenPrs: opts.allowOpenPrs,
  };
}

/* ------------------------------------------------------------------ *
 * main
 * ------------------------------------------------------------------ */

const say = (line = "") => process.stdout.write(`${line}\n`);

const USAGE = `  release:preflight <version>                    the ten checks for a cut of <version>
  release:preflight <version> --no-record        check 8 waved through, with a warning
  release:preflight <version> --allow-open-prs   check 10 waved through, with a warning

Exit: 0 all ten pass · 1 a check failed (the ✗ lines name it) · 2 usage.`;

function usageDie(message) {
  process.stderr.write(`release:preflight: ${message}\n\n${USAGE}\n`);
  process.exit(2);
}

function parseArgs(argv) {
  const opts = {
    version: null,
    versionGiven: null,
    noRecord: false,
    allowOpenPrs: false,
    help: false,
  };
  for (const arg of argv) {
    switch (arg) {
      case "--no-record":
        opts.noRecord = true;
        break;
      case "--allow-open-prs":
        opts.allowOpenPrs = true;
        break;
      case "-h":
      case "--help":
        opts.help = true;
        break;
      default:
        if (arg.startsWith("-")) usageDie(`unknown option '${arg}'`);
        if (opts.versionGiven !== null) usageDie("one version per invocation");
        // Kept as given and normalised in one place below (#1248): the spelling is part of the
        // transcript, so it is not thrown away at the parse.
        opts.versionGiven = arg;
        opts.version = normalizeVersion(arg);
    }
  }
  return opts;
}

function main(argv) {
  const opts = parseArgs(argv);
  if (opts.help) {
    say(USAGE);
    return 0;
  }
  if (!opts.version) {
    if (opts.versionGiven !== null) {
      usageDie(
        `'${opts.versionGiven}' is not a semantic version (x.y.z, optionally -prerelease or +build)`,
      );
    }
    usageDie("a version is required");
  }
  // Either spelling is the same cut (#1248); the tag is `v<version>`, so the bare form is what every
  // check below compares against, and the line says which one arrived.
  if (opts.version !== opts.versionGiven) {
    say(`release:preflight — version ${opts.version} (given '${opts.versionGiven}')`);
  }

  const evidence = gather(opts);
  const result = evaluate(evidence);
  const colour = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
  for (const line of render(result, { version: opts.version, colour })) say(line);
  return result.ok ? 0 : 1;
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invokedDirectly) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (error) {
    process.stderr.write(`release:preflight: ${error?.stack ?? error}\n`);
    process.exit(1);
  }
}
