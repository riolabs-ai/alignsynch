#!/usr/bin/env node
/**
 * `scripts/install-guard.mjs` — may the gate skip `pnpm install --frozen-lockfile`?
 *
 * The gate installs on every run, in every lane, including a docs-only card that could not have
 * touched a dependency. On this box that step is cheap (measured 0.19–0.22 s warm; see
 * `docs/GATE.md` for the recorded figures) but it is never free: it is a second `pnpm` process,
 * it re-reads and re-validates a 260 KB lockfile, and it writes into `node_modules` while other
 * workers on the same host are doing the same thing in other worktrees.
 *
 * WHAT MAKES A SKIP SAFE — every one of these must hold, or the install runs:
 *
 *   1. a marker exists, parses, and records **this** worktree (`node_modules` is per-worktree, so
 *      the marker is keyed by the worktree's realpath even though it lives in the shared cache);
 *   2. the marker's fingerprint equals the current one — `sha256` over `pnpm-lock.yaml`,
 *      `package.json`, and `.npmrc` / `pnpm-workspace.yaml` when they exist, because each of them
 *      changes what `pnpm install` would do;
 *   3. the marker was written by the same pnpm version (the layout of `node_modules` is pnpm's,
 *      not ours);
 *   4. the marker is not older than either manifest on disk — a `git checkout` can restore an old
 *      file with its old hash and a new mtime, and "the hash matches" is not evidence that the
 *      install happened after it;
 *   5. `node_modules` is *usable*: the directory exists, pnpm's own `.modules.yaml` is there
 *      (written only by a completed install), `node_modules/.bin/next` resolves (the first thing
 *      every lane below the docs lane runs), and pnpm's copy of the lockfile at
 *      `node_modules/.pnpm/lock.yaml` still hashes to what the marker recorded — which is the one
 *      check that catches a `node_modules` swapped out from under us by an install of a different
 *      lockfile.
 *
 * WHAT DOES **NOT** COUNT AS A REASON TO SKIP:
 *
 *   - `CI` / `GITHUB_ACTIONS`. There is no shortcut for CI here, on purpose: the runner is
 *     ephemeral, so the marker is absent and the install runs — the fallback is the absence of the
 *     marker, not a branch that trusts a variable. A branch on `CI` would be a second thing to
 *     keep true.
 *   - a lockfile that disagrees with `package.json`. This guard never repairs or edits anything: a
 *     fingerprint mismatch means the real `pnpm install --frozen-lockfile` runs, and it fails
 *     exactly as it fails today.
 *
 * `QUIZHUB_FORCE_INSTALL=1` (or `--force`) bypasses the skip unconditionally, for the review that
 * wants to see the install run.
 *
 * Usage (from `scripts/verify.sh`):
 *
 *   node scripts/install-guard.mjs check  --pnpm "$pnpm_v"      # exit 0 = skip, exit 1 = install
 *   node scripts/install-guard.mjs record --pnpm "$pnpm_v" --ms 1180
 *
 * Both print what they decided and why. Silence is what makes a skip unprovable in a review.
 */

import { createHash } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

/** Bumping this invalidates every marker already on disk. */
export const MARKER_VERSION = 1;

/** The files whose contents decide what `pnpm install` would do. */
export const FINGERPRINT_FILES = [
  "pnpm-lock.yaml",
  "package.json",
  ".npmrc",
  "pnpm-workspace.yaml",
];

/** The two files that must exist for the skip to be considered at all. */
const REQUIRED_FILES = ["pnpm-lock.yaml", "package.json"];

export function shortHash(hash) {
  return typeof hash === "string" ? hash.slice(0, 8) : "????????";
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function readOrNull(path) {
  try {
    return readFileSync(path);
  } catch {
    return null;
  }
}

function statOrNull(path) {
  try {
    return statSync(path);
  } catch {
    return null;
  }
}

/** sha256 of a file's bytes, or null when it cannot be read. */
export function fileHash(path) {
  const bytes = readOrNull(path);
  return bytes === null ? null : sha256(bytes);
}

/**
 * The fingerprint of everything that would change an install, or null when a required manifest is
 * missing (in which case the caller must install — `pnpm` will fail with the reason).
 */
export function fingerprint(root) {
  const files = {};
  for (const name of FINGERPRINT_FILES) {
    const hash = fileHash(join(root, name));
    if (hash !== null) files[name] = hash;
  }
  for (const name of REQUIRED_FILES) {
    if (!files[name]) return null;
  }
  const input = Object.keys(files)
    .sort()
    .map((name) => `${name}:${files[name]}\n`)
    .join("");
  return { hash: sha256(input), files };
}

/** Where the marker lives: one per worktree, in the shared per-host cache directory. */
/**
 * @param {string} root
 * @param {string} [cacheDir]
 * @returns {string}
 */
export function markerPath(root, cacheDir = defaultCacheDir()) {
  let real = root;
  try {
    real = realpathSync(root);
  } catch {
    // `root` may not exist yet during a dry run; the literal path is still a fine key.
  }
  return join(cacheDir, "install", `${sha256(real).slice(0, 16)}.json`);
}

export function defaultCacheDir() {
  return process.env.QUIZHUB_CACHE_DIR || join(homedir(), ".cache", "quizhub");
}

/**
 * The decision, as a pure function of things already read off disk. Kept separate from the fs so
 * `tests/install-guard.test.ts` can state each rule as a case instead of staging a real install.
 *
 * @param {{force?: boolean, hash: string, pnpm?: string|null, marker?: object|null,
 *          files?: {newestMs?: number|null}, nodeModules?: {exists?: boolean, modulesYaml?: boolean,
 *          bin?: boolean, lockCopyHash?: string|null}}} input
 * @returns {{run: boolean, reason: string, savedMs?: number}}
 */
export function evaluate(input) {
  const { force = false, hash, pnpm = null, marker, files = {}, nodeModules = {} } = input;

  if (force) return { run: true, reason: "QUIZHUB_FORCE_INSTALL=1" };
  if (!marker) return { run: true, reason: "no marker for this worktree on this host" };
  if (marker.error) return { run: true, reason: `the marker is unreadable (${marker.error})` };
  if (marker.version !== MARKER_VERSION) {
    return {
      run: true,
      reason: `the marker is version ${marker.version}, this guard is ${MARKER_VERSION}`,
    };
  }
  if (typeof marker.hash !== "string" || marker.hash.length === 0) {
    return { run: true, reason: "the marker carries no fingerprint" };
  }

  if (!nodeModules.exists) return { run: true, reason: "node_modules is missing" };
  if (!nodeModules.modulesYaml) {
    return {
      run: true,
      reason: "node_modules has no .modules.yaml — the last install did not finish",
    };
  }
  if (!nodeModules.bin) {
    return { run: true, reason: "node_modules/.bin/next is missing — node_modules is partial" };
  }
  if (!nodeModules.lockCopyHash) {
    return {
      run: true,
      reason: "node_modules/.pnpm/lock.yaml is missing — node_modules is partial",
    };
  }

  if (marker.hash !== hash) {
    return {
      run: true,
      reason: `the manifests changed since the last install (${shortHash(marker.hash)} → ${shortHash(hash)})`,
    };
  }
  if (pnpm && marker.pnpm !== pnpm) {
    return { run: true, reason: `pnpm ${marker.pnpm} recorded, ${pnpm} on PATH now` };
  }
  if (
    typeof marker.nodeModulesLock !== "string" ||
    marker.nodeModulesLock !== nodeModules.lockCopyHash
  ) {
    return {
      run: true,
      reason: "node_modules was installed from a different lockfile than the one on disk now",
    };
  }
  const newestMs = files.newestMs;
  if (
    typeof newestMs === "number" &&
    typeof marker.recordedMs === "number" &&
    newestMs > marker.recordedMs
  ) {
    return { run: true, reason: "the marker is older than pnpm-lock.yaml / package.json" };
  }

  const decision = { run: false, reason: `lockfile unchanged, ${shortHash(hash)}` };
  if (typeof marker.installMs === "number" && marker.installMs > 0) {
    decision.savedMs = marker.installMs;
  }
  return decision;
}

/** Read the marker for `root`, distinguishing "absent" from "unreadable" so the reason is honest. */
export function readMarker(path) {
  const bytes = readOrNull(path);
  if (bytes === null) return null;
  try {
    const parsed = JSON.parse(bytes.toString("utf8"));
    if (!parsed || typeof parsed !== "object") return { error: "not an object" };
    return parsed;
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Everything the decision needs, read off disk.
 *
 * `newestMs` is floored to a whole millisecond on purpose: `statSync().mtimeMs` is fractional while
 * `Date.now()` is not, so a manifest written in the same millisecond the install finished can read
 * as *newer* than the marker and force an install that proved nothing. Sub-millisecond races are
 * caught by the fingerprint instead, which is the rule that actually matters.
 *
 * @param {string} root
 * @param {{pnpm?: string|null, force?: boolean, cacheDir?: string}} [options]
 */
export function inspect(root, { pnpm = null, force = false, cacheDir = defaultCacheDir() } = {}) {
  const fp = fingerprint(root);
  const path = markerPath(root, cacheDir);
  const marker = readMarker(path);

  const nodeModulesDir = join(root, "node_modules");
  const lockCopyHash = fileHash(join(nodeModulesDir, ".pnpm", "lock.yaml"));
  const nodeModules = {
    exists: Boolean(statOrNull(nodeModulesDir)?.isDirectory()),
    modulesYaml: Boolean(statOrNull(join(nodeModulesDir, ".modules.yaml"))),
    bin: Boolean(statOrNull(join(nodeModulesDir, ".bin", "next"))),
    lockCopyHash,
  };

  const mtimes = REQUIRED_FILES.map((name) => statOrNull(join(root, name))?.mtimeMs).filter(
    (ms) => typeof ms === "number",
  );
  const files = { newestMs: mtimes.length > 0 ? Math.floor(Math.max(...mtimes)) : null };

  return {
    hash: fp ? fp.hash : "",
    fingerprint: fp,
    marker,
    markerFile: path,
    files,
    nodeModules,
    pnpm,
  };
}

/** The single-line decision report. `savedMs` is the last successful install on this host. */
export function describe(decision, marker) {
  if (decision.run)
    return `install: not skipped (${decision.reason}) — running pnpm install --frozen-lockfile`;
  let line = `install: skipped (${decision.reason})`;
  if (typeof decision.savedMs === "number") {
    const saved = (decision.savedMs / 1000).toFixed(2);
    const when = typeof marker?.recordedAt === "string" ? `, ${marker.recordedAt}` : "";
    line += ` — saved ~${saved}s (this host's last install: ${saved}s${when})`;
  }
  return line;
}

/**
 * Write the marker for a successful install. Atomic, so a reader never sees a torn file.
 *
 * @param {string} root
 * @param {{pnpm?: string|null, installMs?: number, cacheDir?: string}} [options]
 */
export function record(root, { pnpm = null, installMs = 0, cacheDir = defaultCacheDir() } = {}) {
  const fp = fingerprint(root);
  if (!fp) throw new Error("pnpm-lock.yaml or package.json is missing — nothing to record");
  const lockCopyHash = fileHash(join(root, "node_modules", ".pnpm", "lock.yaml"));
  if (!lockCopyHash) {
    throw new Error("node_modules/.pnpm/lock.yaml is missing — the install did not complete");
  }
  const path = markerPath(root, cacheDir);
  const body = {
    version: MARKER_VERSION,
    hash: fp.hash,
    pnpm,
    root: resolve(root),
    nodeModulesLock: lockCopyHash,
    recordedAt: new Date().toISOString(),
    recordedMs: Date.now(),
    installMs,
  };
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(body, null, 2)}\n`);
  renameSync(tmp, path);
  return { path, marker: body };
}

function parseArgs(argv) {
  const args = {
    command: argv[0],
    root: process.cwd(),
    pnpm: null,
    force: false,
    ms: 0,
    cacheDir: null,
  };
  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--root") args.root = argv[++i];
    else if (arg === "--pnpm") args.pnpm = argv[++i];
    else if (arg === "--cache-dir") args.cacheDir = argv[++i];
    else if (arg === "--ms") args.ms = Number(argv[++i]) || 0;
    else if (arg === "--force") args.force = true;
  }
  args.root = resolve(args.root);
  args.cacheDir = args.cacheDir || defaultCacheDir();
  return args;
}

function main(argv) {
  const args = parseArgs(argv);
  const force = args.force || process.env.QUIZHUB_FORCE_INSTALL === "1";

  if (args.command === "check") {
    const state = inspect(args.root, { pnpm: args.pnpm, force, cacheDir: args.cacheDir });
    if (!state.fingerprint) {
      console.log("install: not skipped (pnpm-lock.yaml or package.json is missing)");
      return 1;
    }
    const decision = evaluate({ ...state, force });
    let line = describe(decision, state.marker);
    if (!decision.run) line += `; marker: ${state.markerFile}`;
    console.log(line);
    return decision.run ? 1 : 0;
  }

  if (args.command === "record") {
    const { path, marker } = record(args.root, {
      pnpm: args.pnpm,
      installMs: args.ms,
      cacheDir: args.cacheDir,
    });
    const seconds = args.ms > 0 ? ` in ${(args.ms / 1000).toFixed(2)}s` : "";
    console.log(
      `install: marker recorded (${shortHash(marker.hash)}${seconds}) — the next gate on this worktree skips the install (${path})`,
    );
    return 0;
  }

  console.error(
    "usage: install-guard.mjs check|record [--root DIR] [--pnpm VERSION] [--ms N] [--force]",
  );
  return 2;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  process.exit(main(process.argv.slice(2)));
}
