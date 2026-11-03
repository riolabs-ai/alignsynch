#!/usr/bin/env node
/**
 * `pnpm health:record` — write `data/health/platform-health.json`, the artifact `/admin/health`
 * renders (#508).
 *
 * The screen's rule is that no number exists without a source, and the corollary is that no number
 * is typed by hand: this script takes the four measurements and refuses to write a record it could
 * not take. Each block carries its own `measuredAt`, so a block carried forward by `--carry` is
 * visible as old rather than presented as new.
 *
 *   node … scripts/health-record.mjs                 tree + production probe
 *   node … scripts/health-record.mjs --db            also run `pnpm db:verify` and record its lines
 *   node … scripts/health-record.mjs --gate          also run the gate in a clean env and time it
 *   node … scripts/health-record.mjs --ci 2026-11-02 also run docs/gate-baseline.py for that window
 *   node … scripts/health-record.mjs --carry         keep blocks this run did not measure
 *
 * `--database-label` names the database the `db:verify` run was pointed at (never the URL — the
 * record is committed and a URL carries a password).
 *
 * The script is the only writer. The page reads; `lib/admin/platform-health.ts` validates the file
 * through the same zod schema this script parses before writing, so a record that would fail the
 * screen fails here first, by name.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { zPlatformHealthRecord } from "@/content/platform-health";
import { loadEnv, repoRoot } from "./load-env.mjs";

const OUT = join(repoRoot, "data", "health", "platform-health.json");
const PRODUCTION_URL = "https://alignsynch.com/api/version";

const argv = process.argv.slice(2);
const has = (flag) => argv.includes(flag);
const flagValue = (flag) => {
  const index = argv.indexOf(flag);
  return index === -1 ? undefined : argv[index + 1];
};

const wantDb = has("--db");
const wantGate = has("--gate");
const wantCarry = has("--carry");
const ciWindow = flagValue("--ci");

// The checkout's `.env.local` / `.env` supply DATABASE_URL for `--db`, and nothing else is read
// from them: the probe is over https and the tree is read from git.
loadEnv();

const now = () => new Date().toISOString();

function sh(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 32 * 1024 * 1024,
    ...options,
  });
  if (result.error) throw result.error;
  return {
    code: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function git(args) {
  try {
    return execFileSync("git", args, {
      cwd: repoRoot,
      encoding: "utf8",
      timeout: 10000,
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

const previous = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : null;
const carried = (key) => {
  if (!wantCarry) throw new Error(`${key}: this run did not measure it and --carry was not given`);
  if (!previous?.[key]) throw new Error(`${key}: no previous record to carry`);
  return previous[key];
};

/* ------------------------------------------------------------------ *
 * The tree
 * ------------------------------------------------------------------ */

const mainSha = git(["rev-parse", "origin/main"]) || git(["rev-parse", "main"]);
const headSha = git(["rev-parse", "HEAD"]);
const latestTag = git(["describe", "--tags", "--abbrev=0"]);
if (mainSha === "" || headSha === "" || latestTag === "") {
  throw new Error("the tree could not be measured: git did not answer for HEAD, main or the tag");
}
const packageVersion = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")).version;
const treeMeasuredAt = now();

/* ------------------------------------------------------------------ *
 * Production — one unauthenticated GET, which is what /api/version exists for
 * ------------------------------------------------------------------ */

let production;
try {
  const response = await fetch(PRODUCTION_URL, {
    signal: AbortSignal.timeout(15000),
    headers: { "cache-control": "no-cache" },
  });
  const body = await response.json();
  const commit = typeof body.commit === "string" ? body.commit : "unknown";
  const behind = /^[0-9a-f]{7,40}$/.test(commit)
    ? git(["rev-list", "--count", `${commit}..origin/main`])
    : "";
  if (behind === "" || !/^\d+$/.test(behind)) {
    throw new Error(
      `git cannot count ${commit}..origin/main in this checkout — cannot record drift`,
    );
  }
  production = {
    behindMain: Number.parseInt(behind, 10),
    commit,
    measuredAt: now(),
    source: `GET ${PRODUCTION_URL}`,
    state: "answering",
    status: response.status,
    version: typeof body.version === "string" && body.version !== "" ? body.version : "unknown",
  };
} catch (error) {
  // An unreachable production is a state, not a crash: the screen draws it, and the values are the
  // previous record's — labelled with their own instant, never as this run's measurement.
  const last = carried("production");
  production = {
    ...last,
    measuredAt: now(),
    source: `GET ${PRODUCTION_URL} — ${error instanceof Error ? error.message : String(error)}`,
    state: "unreachable",
    status: 0,
  };
}

/* ------------------------------------------------------------------ *
 * db:verify
 * ------------------------------------------------------------------ */

function databaseLabel(uri) {
  try {
    return `host ${new URL(uri).hostname}`;
  } catch {
    return "an unparseable DATABASE_URL";
  }
}

function dbVerifyBlock() {
  const startedAt = now();
  const run = sh("pnpm", ["db:verify"]);
  const text = `${run.stdout}\n${run.stderr}`;
  const lines = text.split(/\r?\n/);
  const violations = [];
  for (const line of lines) {
    const match = /^\s{2}(V\d+)\s{2}(.+)$/.exec(line);
    if (match) violations.push({ code: match[1], message: match[2].trim() });
  }
  const summary =
    lines.find((line) => /^[✓✗] db:verify/.test(line)) ??
    lines.find((line) => line.includes("db:verify failed")) ??
    "db:verify printed no summary line";

  const result = run.code === 0 ? "pass" : violations.length > 0 ? "fail" : "error";
  if (result === "error") {
    throw new Error(`db:verify failed without a rule code: ${summary}`);
  }

  return {
    command: "pnpm db:verify",
    database:
      flagValue("--database-label") ??
      databaseLabel(process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? ""),
    exitCode: run.code,
    ranAt: startedAt,
    result,
    summary: summary.trim(),
    violations,
  };
}

/* ------------------------------------------------------------------ *
 * The gate
 * ------------------------------------------------------------------ */

function gateBlock() {
  const startedAt = now();
  const started = Date.now();
  // A clean environment, the way CI has one: an inherited `.env` would make `demo:verify` refuse
  // for a reason that is not the diff (`docs/GATE.md`, `AGENTS.md`).
  const run = sh("env", [
    "-i",
    `HOME=${process.env.HOME}`,
    `PATH=${process.env.PATH}`,
    "CI=1",
    "bash",
    "scripts/verify.sh",
  ]);
  const seconds = Math.round((Date.now() - started) / 100) / 10;
  const lane = /lane=([a-z]+)/.exec(`${run.stdout}\n${run.stderr}`)?.[1];
  if (lane === undefined) {
    throw new Error(
      "the gate printed no lane= line — its output is not the shape this recorder reads",
    );
  }
  if (run.code !== 0) {
    const tail = `${run.stdout}\n${run.stderr}`.trim().split(/\r?\n/).slice(-20).join("\n");
    throw new Error(
      `the gate exited ${run.code} — fix the tree, then record: a health record carries a green run\n${tail}`,
    );
  }

  const yieldBlock = ciWindow === undefined ? carried("gate").yield : ciYieldBlock(ciWindow);

  return {
    command: "env -i HOME… PATH… CI=1 bash scripts/verify.sh",
    lane,
    measuredAt: startedAt,
    seconds,
    yield: yieldBlock,
  };
}

function ciYieldBlock(window) {
  const measuredAt = now();
  const command = `python3 docs/gate-baseline.py --window ${window}`;
  const run = sh("python3", ["docs/gate-baseline.py", "--window", window], { timeout: 900000 });
  if (run.code !== 0) {
    throw new Error(`gate-baseline exited ${run.code}: ${run.stderr.trim().split("\n")[0]}`);
  }
  const yieldMatch = /first-pass yield: (\d+)\/(\d+) = ([\d.]+)%/.exec(run.stdout);
  const runMatch = /CI run incl\. queue: p50 (\d+)s\s+p95 (\d+)s/.exec(run.stdout);
  if (!yieldMatch || !runMatch) {
    throw new Error("gate-baseline printed no yield or p50/p95 line");
  }
  const successes = Number.parseInt(yieldMatch[1], 10);
  const runs = Number.parseInt(yieldMatch[2], 10);
  return {
    command,
    measuredAt,
    percent: Number.parseFloat(yieldMatch[3]),
    runP50Seconds: Number.parseInt(runMatch[1], 10),
    runP95Seconds: Number.parseInt(runMatch[2], 10),
    runs,
    successes,
    window,
  };
}

/* ------------------------------------------------------------------ *
 * Write
 * ------------------------------------------------------------------ */

const gate = wantGate
  ? gateBlock()
  : (() => {
      const last = carried("gate");
      return ciWindow === undefined ? last : { ...last, yield: ciYieldBlock(ciWindow) };
    })();

const record = {
  dbVerify: wantDb ? dbVerifyBlock() : carried("dbVerify"),
  gate,
  production,
  recordedAt: now(),
  recorder: "pnpm health:record",
  schemaVersion: 1,
  tree: {
    headSha,
    latestTag,
    mainSha,
    measuredAt: treeMeasuredAt,
    packageVersion,
  },
};

const parsed = zPlatformHealthRecord.safeParse(record);
if (!parsed.success) {
  const issue = parsed.error.issues[0];
  throw new Error(
    `the record this run measured does not satisfy the schema: ${issue?.path.join(".")}: ${issue?.message}`,
  );
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(parsed.data, null, 2)}\n`);

console.log(`wrote ${OUT}`);
console.log(
  `  db:verify  ${parsed.data.dbVerify.result} · ${parsed.data.dbVerify.violations.length} violation(s) · ${parsed.data.dbVerify.ranAt}`,
);
console.log(
  `  gate       lane=${parsed.data.gate.lane} · ${parsed.data.gate.seconds}s · yield ${parsed.data.gate.yield.successes}/${parsed.data.gate.yield.runs}`,
);
console.log(
  `  production ${parsed.data.production.state} · ${parsed.data.production.version} @ ${parsed.data.production.commit} · ${parsed.data.production.behindMain} behind main`,
);
console.log(
  `  tree       ${parsed.data.tree.packageVersion} · ${parsed.data.tree.latestTag} · main ${parsed.data.tree.mainSha.slice(0, 7)}`,
);
