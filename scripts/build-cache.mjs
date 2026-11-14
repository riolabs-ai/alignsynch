#!/usr/bin/env node
/**
 * scripts/build-cache.mjs — one warm Turbopack cache and one warm `tsc` buildinfo,
 * shared by every worktree on this machine instead of one per tree.
 *
 * ## The problem this solves
 *
 * `next build` keeps its compilation cache in `<distDir>/cache/turbopack/<version>`
 * (`next/dist/lib/turbopack-cache-seed.js` names that path), and `distDir` is `.next`,
 * which is per-worktree. So every worktree starts from an empty cache and recompiles
 * all 34 routes: 70 worktrees held 64 separate `.next` caches totalling 27 GB, and a
 * cold `build` step measured 118.4 s against 18.7 s warm on the same tree (2026-11-12).
 * `tsconfig.json` has `incremental: true`, but the buildinfo it writes is also per
 * worktree, so `tsc --noEmit` is cold on every card too.
 *
 * ## What this does, and what it deliberately does not do
 *
 * `link` replaces `.next/cache` with a symlink into one directory under
 * `~/.cache/quizhub/next/<key>/`, so a worktree with nothing built yet reads the
 * compiled modules the last build left there. `unlink` puts an empty real
 * `.next/cache` back afterwards, because `.next` also backs `next dev` and a dev
 * server must never open the shared RocksDB store while a gate build holds it.
 *
 * `tsc` runs `tsc --noEmit` with `--tsBuildInfoFile` pointing at the **build's own**
 * `<distDir>/cache/.tsbuildinfo` — through the relative `.next/cache` path, which is
 * the form `next build` accepts — so `pnpm typecheck` fills the program the build's
 * type check then resumes from: the app is type-checked once, not twice (measured:
 * 63.9 s → 16.1 s wall for the build's check, docs/GATE.md). Inside the gate that
 * path is the shared store because `scripts/verify.sh` links `.next/cache` at the
 * held slot first; outside it, it is the tree's own `.next/cache` — still correct,
 * just not shared. The private `~/.cache/quizhub/tsc/<key>/` buildinfo stays as the
 * fallback for a tree whose `.next` cannot be written.
 *
 * It changes **nothing** about what the gate checks. It is not a flag on a check,
 * not a skipped step, and it needs no install step, daemon or dependency: it is
 * node's own `fs`, and the `flock` the build semaphore in `scripts/verify.sh`
 * already requires.
 *
 * ## Never let a stale cache change a verdict
 *
 * The key is a hash of the inputs a cache entry is only valid against — the
 * `next` version (the Turbopack cache directory is itself version-named), the
 * `typescript` version, the Node major, and the `pnpm-lock.yaml` digest — so a
 * dependency bump or a Next upgrade lands on a *different directory* and the next
 * build is a full miss rather than a partially valid hit. Every directory also
 * carries a `.cache-key` sentinel holding the key it was created under: a directory
 * whose sentinel does not match is not ours, and it is deleted before use, never
 * read. `QUIZHUB_CACHE_KEY` overrides the key outright, which is how a full miss is
 * proved on demand.
 *
 * ## Usage
 *
 *   node scripts/build-cache.mjs status        # key, paths, sizes — the evidence
 *   node scripts/build-cache.mjs link          # .next/cache -> the shared directory
 *   node scripts/build-cache.mjs unlink        # back to an empty in-tree .next/cache
 *   node scripts/build-cache.mjs tsc           # tsc --noEmit against the shared buildinfo
 *
 * Environment:
 *   QUIZHUB_CACHE_DIR    cache root, default `$XDG_CACHE_HOME/quizhub` or `~/.cache/quizhub`
 *   QUIZHUB_BUILD_SLOT   the build semaphore slot (`scripts/verify.sh` exports it). Slot 1
 *                        uses the key's own directory; slot N uses `<key>/slot-N/`, and an
 *                        unlocked build uses `<key>/slot-manual/`, so two concurrent builds
 *                        never open the same RocksDB store — which fails, it does not merge.
 *   QUIZHUB_CACHE_KEY    override the whole key (a deliberate full miss)
 *   QUIZHUB_CACHE=off    use the tree's own `.next/cache` and a tree-local buildinfo
 */

import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** The sentinel every cache directory carries: the key it was created under. */
const KEY_FILE = ".cache-key";

function readVersion(pkg) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, "node_modules", pkg, "package.json"), "utf8"))
      .version;
  } catch {
    return "unknown";
  }
}

function lockDigest() {
  try {
    return createHash("sha256")
      .update(fs.readFileSync(path.join(ROOT, "pnpm-lock.yaml")))
      .digest("hex");
  } catch {
    return "no-lockfile";
  }
}

/**
 * The cache key: what a cache entry is valid against, and nothing about the tree.
 *
 * Nothing here names a worktree, a branch or a commit — that is the whole point.
 * The content is what makes an entry reusable: Turbopack keys its own cells by
 * module content, and `tsc` validates its buildinfo against the files it read.
 */
function resolveKey() {
  const inputs = [
    "quizhub-build-cache-v1",
    `next ${readVersion("next")}`,
    `typescript ${readVersion("typescript")}`,
    `node ${process.versions.node.split(".")[0]}`,
    `lock ${lockDigest().slice(0, 32)}`,
  ].join(" ");
  const override = (process.env.QUIZHUB_CACHE_KEY ?? "").trim();
  const key = override || createHash("sha256").update(inputs).digest("hex").slice(0, 16);
  return { key, inputs, override: override || null };
}

function cacheRoot() {
  const explicit = (process.env.QUIZHUB_CACHE_DIR ?? "").trim();
  if (explicit) return path.resolve(explicit);
  const base = (process.env.XDG_CACHE_HOME ?? "").trim() || path.join(os.homedir(), ".cache");
  return path.join(base, "quizhub");
}

/** `slot-1` is the key's own directory; every other slot gets a sibling. */
function slotDir(base) {
  const slot = (process.env.QUIZHUB_BUILD_SLOT ?? "").trim();
  if (!slot) return path.join(base, "slot-manual");
  if (slot === "1") return base;
  return path.join(base, `slot-${slot.replace(/[^0-9]/g, "") || "manual"}`);
}

function layout() {
  const { key, inputs, override } = resolveKey();
  const base = path.join(cacheRoot(), "next", key);
  const tscDir = path.join(cacheRoot(), "tsc", key);
  const nextCache = path.join(slotDir(base), "cache");
  return {
    key,
    inputs,
    override,
    nextBase: base,
    nextCache,
    /**
     * The build's own type-check cache, as the build itself names it.
     *
     * `next/dist/lib/typescript/runTypeCheck.js` calls `createIncrementalProgram`
     * with `tsBuildInfoFile: path.join(cacheDir, '.tsbuildinfo')`, where `cacheDir`
     * is `<distDir>/cache` — the directory `link` points at the shared store. Writing
     * the standalone `tsc` buildinfo at that same path is what lets one pass pay for
     * both: the gate's `pnpm typecheck` fills it, and the build's check then resumes
     * from the program that was already checked.
     *
     * It is deliberately a **relative** path through `.next/cache`, resolved from the
     * repo root, and not the resolved real directory: the buildinfo records its file
     * list relative to the path it was written at, and TypeScript compares that
     * record against the file the build reads. Handing `tsc` the resolved cache
     * directory produces a buildinfo `next build` rejects (851,686 bytes, full
     * re-check); the same program written through `.next/cache` is accepted
     * (738,846 bytes, 29.3 s instead of 63.9 s for the build's check). Measured —
     * docs/GATE.md.
     *
     * It is a **cache path, not a saved check**: the build still runs its own type
     * check and still fails on a new error (proved with a planted error, same doc).
     * When the two file lists differ — a `next dev` has left `.next/dev/types`
     * behind, which `tsconfig.json` includes and the build filters out — the
     * buildinfo is simply stale and the check runs in full, exactly as on `main`.
     */
    buildTypeCheckArg: path.join(".next", "cache", ".tsbuildinfo"),
    buildTypeCheckFile: path.join(ROOT, ".next", "cache", ".tsbuildinfo"),
    tscDir,
    tscFile: path.join(tscDir, "tsconfig.tsbuildinfo"),
    tscLock: path.join(tscDir, "tsc.lock"),
    slot: (process.env.QUIZHUB_BUILD_SLOT ?? "").trim() || "manual",
  };
}

function du(target) {
  try {
    return execFileSync("du", ["-sh", target], { encoding: "utf8" }).split("\t")[0].trim();
  } catch {
    return "?";
  }
}

function stat(target) {
  try {
    return fs.lstatSync(target);
  } catch {
    return null;
  }
}

/**
 * Create `dir` under `key`, or wipe it when it belongs to a different one.
 *
 * A directory whose `.cache-key` does not match is not read at all: a partially
 * valid cache is the one way this could change a verdict, and a full miss costs
 * exactly one build.
 */
function ensureOwned(dir, key, inputs) {
  const sentinel = path.join(dir, KEY_FILE);
  const expected = `${key}\n${inputs}\n`;
  let actual = null;
  try {
    actual = fs.readFileSync(sentinel, "utf8");
  } catch {
    actual = null;
  }
  if (actual !== null && actual !== expected) {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(sentinel, expected);
    return "wiped";
  }
  fs.mkdirSync(dir, { recursive: true });
  if (actual === null) fs.writeFileSync(sentinel, expected);
  return actual === null ? "created" : "kept";
}

const CACHE_OFF = ["0", "off", "false", "no"].includes(
  (process.env.QUIZHUB_CACHE ?? "").toLowerCase(),
);

function nextCacheLink() {
  fs.mkdirSync(path.join(ROOT, ".next"), { recursive: true });
  return path.join(ROOT, ".next", "cache");
}

/**
 * Point `.next/cache` at the shared directory.
 *
 * An existing *real* `.next/cache` is deleted, not moved: it is derived data
 * inside a gitignored directory, it is what the sharing is meant to replace, and
 * this build would rebuild all of it in the shared directory anyway.
 */
function link() {
  const l = layout();
  const linkPath = nextCacheLink();
  const existing = stat(linkPath);

  if (CACHE_OFF) {
    if (existing?.isSymbolicLink()) {
      fs.unlinkSync(linkPath);
      fs.mkdirSync(linkPath, { recursive: true });
    }
    printf(`  build cache: off (QUIZHUB_CACHE) — this tree keeps its own .next/cache`);
    return 0;
  }

  const ownership = ensureOwned(l.nextCache, l.key, l.inputs);
  const warm = fs.readdirSync(l.nextCache).filter((name) => name !== KEY_FILE).length > 0;

  if (existing?.isSymbolicLink()) {
    const target = path.resolve(path.dirname(linkPath), fs.readlinkSync(linkPath));
    if (target === path.resolve(l.nextCache)) {
      printf(
        `  build cache: slot ${l.slot} · ${warm ? "warm" : "empty"} ${du(l.nextCache)} · ${l.nextCache}`,
      );
      return 0;
    }
    fs.unlinkSync(linkPath);
  } else if (existing?.isDirectory()) {
    fs.rmSync(linkPath, { recursive: true, force: true });
  } else if (existing) {
    fs.rmSync(linkPath, { force: true });
  }

  fs.symlinkSync(l.nextCache, linkPath, "dir");
  printf(
    `  build cache: slot ${l.slot} · key ${l.key}${l.override ? " (overridden)" : ""} · ` +
      `${ownership === "wiped" ? "poisoned, wiped" : warm ? `warm ${du(l.nextCache)}` : "empty — this build fills it"}`,
  );
  printf(`  build cache: .next/cache -> ${l.nextCache}`);
  return 0;
}

/**
 * Put an empty, real `.next/cache` back.
 *
 * `next dev` keeps its own cache under the same path, and opening the shared
 * RocksDB store from a dev server while a gate build holds it is a failure, not a
 * miss. Restoring the tree's own directory means a dev server never sees the
 * shared one; the build re-links on its next run.
 */
function unlink() {
  const linkPath = nextCacheLink();
  const existing = stat(linkPath);
  if (!existing?.isSymbolicLink()) return 0;
  fs.unlinkSync(linkPath);
  fs.mkdirSync(linkPath, { recursive: true });
  return 0;
}

/**
 * `tsc --noEmit` against the shared buildinfo.
 *
 * The buildinfo is written at the **build's** path when the gate has linked
 * `.next/cache` for this slot (`layout().buildTypeCheckFile`), because that is the
 * file `next build`'s own type check resumes from: one pass, two verdicts. Falling
 * back to the typechecker's private directory when that path is not there keeps
 * `pnpm typecheck` working outside the gate and on a tree with no `.next` at all.
 *
 * `flock` serializes two concurrent typechecks on the same key: `tsc` writes its
 * buildinfo with a plain write, so two writers would race. The wait is bounded and
 * a missing `flock` degrades to an unlocked run — the cache must never be able to
 * fail the gate.
 */
function tsc() {
  const tscBin = path.join(ROOT, "node_modules", "typescript", "bin", "tsc");
  const args = ["--noEmit"];

  if (CACHE_OFF) {
    printf("  typecheck cache: off (QUIZHUB_CACHE) — tree-local buildinfo");
    return run(process.execPath, [tscBin, ...args]);
  }

  const l = layout();
  let ownership;
  try {
    ownership = ensureOwned(l.tscDir, l.key, l.inputs);
  } catch (error) {
    printf(`  typecheck cache: unavailable (${error.message}) — tree-local buildinfo`);
    return run(process.execPath, [tscBin, ...args]);
  }

  // The build's own buildinfo wins whenever `.next/cache` can hold it: the build
  // reads that exact file, so filling it makes the build's check a resume, not a
  // re-run. `--tsBuildInfoFile` is passed as the relative path through `.next/cache`
  // (see `buildTypeCheckArg`) with the repo root as the cwd — the resolved directory
  // writes a buildinfo `next build` will not accept.
  let sharedWithBuild = true;
  try {
    fs.mkdirSync(path.dirname(l.buildTypeCheckFile), { recursive: true });
  } catch {
    sharedWithBuild = false;
  }
  const buildInfoArg = sharedWithBuild ? l.buildTypeCheckArg : l.tscFile;

  const warm = fs.existsSync(l.buildTypeCheckFile) && sharedWithBuild;
  const flock = spawnSync("flock", ["--version"], { stdio: "ignore" });
  if (flock.error) {
    printf("  typecheck cache: flock unavailable — tree-local buildinfo");
    return run(process.execPath, [tscBin, ...args]);
  }

  printf(
    `  typecheck cache: key ${l.key}${l.override ? " (overridden)" : ""} · ` +
      `${ownership === "wiped" ? "poisoned, wiped" : warm ? `warm ${du(l.buildTypeCheckFile)}` : "empty — this run fills it"} · ` +
      `${sharedWithBuild ? "shared with next build" : "typecheck only"}`,
  );
  const locked = spawnSync(
    "flock",
    ["-w", "600", l.tscLock, process.execPath, tscBin, ...args, "--tsBuildInfoFile", buildInfoArg],
    { stdio: "inherit", cwd: ROOT },
  );
  if (locked.error) {
    printf(`  typecheck cache: flock failed (${locked.error.message}) — tree-local buildinfo`);
    return run(process.execPath, [tscBin, ...args]);
  }
  return locked.status ?? 1;
}

function run(cmd, argv) {
  const result = spawnSync(cmd, argv, { stdio: "inherit" });
  return result.status ?? 1;
}

function status() {
  const l = layout();
  const lines = [
    `cache root     ${cacheRoot()}${CACHE_OFF ? "  (QUIZHUB_CACHE=off)" : ""}`,
    `key            ${l.key}${l.override ? `  (QUIZHUB_CACHE_KEY override)` : ""}`,
    `key inputs     ${l.inputs}`,
    `slot           ${l.slot}`,
    `next cache     ${l.nextCache}  ${stat(l.nextCache) ? du(l.nextCache) : "(absent)"}`,
    `build typecheck ${l.buildTypeCheckFile}  ${stat(l.buildTypeCheckFile) ? du(l.buildTypeCheckFile) : "(absent)"}`,
    `tsc buildinfo  ${l.tscFile}  ${stat(l.tscFile) ? du(l.tscFile) : "(absent)"}`,
    `tree .next/cache ${
      stat(path.join(ROOT, ".next", "cache"))?.isSymbolicLink()
        ? `-> ${path.resolve(path.join(ROOT, ".next"), fs.readlinkSync(path.join(ROOT, ".next", "cache")))}`
        : stat(path.join(ROOT, ".next", "cache"))
          ? "own directory"
          : "(absent)"
    }`,
  ];
  printf(lines.map((line) => `  ${line}`).join("\n"));
  return 0;
}

function printf(line) {
  process.stdout.write(`${line}\n`);
}

const command = process.argv[2] ?? "status";
const commands = { status, link, unlink, tsc };
if (!commands[command]) {
  process.stderr.write(
    `build-cache: unknown command "${command}" (status | link | unlink | tsc)\n`,
  );
  process.exit(2);
}
process.exit(commands[command]());
