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
 *   node … scripts/health-record.mjs --probe <name> --db --proves "…"
 *                                                    record **evidence** into data/health/probes/<name>.json
 *
 * **Two artifacts, two writers, and a probe cannot reach the platform record (#680).** The platform
 * record is written from the demo branch only — `platformDatabaseRefusal()` in
 * `scripts/health-record-rules.mjs` refuses every other endpoint, and since a copy of `demo` gets its
 * own Neon endpoint, that refusal is what a probe run cannot pass. Evidence goes to
 * `data/health/probes/` through `--probe`, which never opens `OUT` at all. `--database-label` is
 * therefore **probe-only**: the platform record's label is derived from the facts the check just
 * read, because a typed label is exactly how a scratch branch once recorded itself as platform
 * status (#599).
 *
 * **The recorder asserts its own postcondition.** After writing, it reads the bytes back and
 * requires a fresh `recordedAt`, `tree.packageVersion == package.json`, and a `dbVerify.database`
 * that names the demo branch — and fails the command when any of them is wrong (R-29: assert the
 * postcondition, not the exit code of the thing that ran). `--probe` is exempt by construction: its
 * output is evidence, and evidence is allowed to be red.
 *
 * **A record has an age, and the gate holds it to one (#599).** `tests/platform-health.test.ts`
 * fails when `data/health/platform-health.json` is older than `PLATFORM_HEALTH_FRESHNESS_HOURS`
 * (72 h by default), so re-recording is the fix for a red freshness step, not an edit to the file.
 * The `--gate` run sets `HEALTH_RECORD_REFRESH=1` for its own gate invocation, because that run
 * happens *before* the new record is written and would otherwise be judged against the stale file it
 * is replacing. Nothing else sets that variable.
 *
 * The script is the only writer. The page reads; `lib/admin/platform-health.ts` validates the file
 * through the same zod schema this script parses before writing, so a record that would fail the
 * screen fails here first, by name.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import { zPlatformHealthRecord } from "@/content/platform-health";
import {
  demoDatabaseLabel,
  platformDatabaseRefusal,
  postconditionProblems,
} from "./health-record-rules.mjs";
import { loadEnv, repoRoot } from "./load-env.mjs";

const OUT = join(repoRoot, "data", "health", "platform-health.json");
const PROBES = join(repoRoot, "data", "health", "probes");
const PRODUCTION_URL = "https://alignsynch.com/api/version";

/** Why a probe run is not platform status, written into every probe file it produces. */
const NOT_PLATFORM_HEALTH =
  "A deliberately broken database — or a copy of it — is evidence about the checker, never about " +
  "the platform. `/admin/health` reads data/health/platform-health.json as status, and that record " +
  "is written from the demo branch only (#599, #680).";

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
const probeName = flagValue("--probe");
const proves = flagValue("--proves");

const isProbe = probeName !== undefined;
if (isProbe && !/^[a-z0-9][a-z0-9-]*$/.test(probeName)) {
  throw new Error(
    `--probe ${JSON.stringify(probeName)} is not a file name: lowercase letters, digits and hyphens`,
  );
}
if (isProbe && !wantDb) {
  throw new Error(
    "--probe records a measurement, so it needs --db — evidence without a run proves nothing",
  );
}
if (isProbe && (proves === undefined || proves.trim() === "")) {
  throw new Error(
    '--probe needs --proves "<what this run proves>" — a file in data/health/probes/ is read by a person, later',
  );
}
if (isProbe && wantGate) {
  throw new Error(
    "--probe records the db:verify evidence only; the gate belongs to the platform record, and this run must not write one",
  );
}

// The checkout's `.env.local` / `.env` supply DATABASE_URL for `--db`, and nothing else is read
// from them: the probe is over https and the tree is read from git.
loadEnv();

/* ------------------------------------------------------------------ *
 * Which database, and is this even a platform record? (#680)
 * ------------------------------------------------------------------ */

const databaseUrl = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "";

if (!isProbe) {
  const typed = flagValue("--database-label");
  if (typed !== undefined) {
    throw new Error(
      [
        "--database-label is probe-only. The platform record's database label is derived from the",
        "branch this run read (endpoint, NEON_BRANCH and host) and then asserted, because a label",
        "somebody types is how a scratch branch recorded itself as platform status (#599).",
        "",
        `  evidence instead: pnpm health:record --probe <name> --db --database-label ${JSON.stringify(typed)} --proves "…"`,
      ].join("\n"),
    );
  }
  if (wantDb) {
    const refusal = platformDatabaseRefusal({
      databaseUrl,
      neonBranch: process.env.NEON_BRANCH,
    });
    if (refusal !== null) throw new Error(refusal);
  }
}

const now = () => new Date().toISOString();

/* ------------------------------------------------------------------ *
 * Probe mode — evidence, written into data/health/probes/, then out (#680)
 *
 * This run never touches `OUT`: the path is a different constant, and it exits before the tree,
 * the production probe and the gate are measured, because none of them belong in evidence. That is
 * the structural half of the guarantee — a proof run cannot write platform status because the only
 * writer of platform status is the code path this branch returns before reaching.
 * ------------------------------------------------------------------ */

if (isProbe) {
  const block = dbVerifyBlock();
  const path = join(PROBES, `${probeName}.json`);
  const probeRecord = {
    schemaVersion: 1,
    ...(flagValue("--issue") === undefined ? {} : { issue: flagValue("--issue") }),
    proves: proves.trim(),
    whyNotPlatformHealth: NOT_PLATFORM_HEALTH,
    probe: {
      kind: flagValue("--kind") ?? "db:verify against a database that was broken on purpose",
      database: block.database,
    },
    dbVerify: block,
  };

  mkdirSync(PROBES, { recursive: true });
  writeFileSync(path, `${JSON.stringify(probeRecord, null, 2)}\n`);

  console.log(`wrote ${path}`);
  console.log(
    `  evidence   ${block.result} · ${block.violations.length} violation(s) · ${block.ranAt} · exit ${block.exitCode}`,
  );
  console.log(`  proves     ${probeRecord.proves}`);
  console.log(`  not platform health — ${OUT} was not written by this run`);
  process.exit(0);
}

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
    database: isProbe
      ? // Evidence describes itself; a probe may name the branch it broke on purpose.
        (flagValue("--database-label") ?? databaseLabel(databaseUrl))
      : // Platform status does not: the label is derived from the branch this run read, then the
        // postcondition below requires it to name demo (#680).
        demoDatabaseLabel({ databaseUrl, neonBranch: process.env.NEON_BRANCH }),
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
    // The gate enforces that the committed record is fresh (#599), and this run *is* the refresh:
    // the file it will write does not exist yet, so a run that enforced freshness here would
    // deadlock on the very artifact it is replacing. Every other gate run enforces it.
    "HEALTH_RECORD_REFRESH=1",
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
    command: "env -i HOME… PATH… CI=1 HEALTH_RECORD_REFRESH=1 bash scripts/verify.sh",
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

/* ------------------------------------------------------------------ *
 * The postcondition — the bytes on disk, held to what they claim (#680, R-29)
 *
 * R-29: assert the postcondition, not the exit code of the thing that ran. `db:verify` exiting 0
 * says the database is clean; it does not say this file says so, from this version, about the demo
 * branch. So the check re-reads what was written — and `package.json`, again — and fails the
 * command when the record describes a tree, a database or an instant that is not this run's.
 * ------------------------------------------------------------------ */

const written = JSON.parse(readFileSync(OUT, "utf8"));
const packageVersionOnDisk = JSON.parse(
  readFileSync(join(repoRoot, "package.json"), "utf8"),
).version;
const problems = postconditionProblems(written, {
  packageVersion: packageVersionOnDisk,
  now: new Date(),
});

if (problems.length > 0) {
  console.error(`\n✗ ${OUT} does not satisfy the recorder's own postconditions:`);
  for (const problem of problems) console.error(`  · ${problem}`);
  console.error(
    "\nThe artefact on disk is wrong, so this command fails instead of exiting 0 over it.",
  );
  console.error(
    "Do not commit that record: fix the cause above and run `pnpm health:record` again.",
  );
  process.exitCode = 1;
} else {
  console.log(
    `  postcheck  recordedAt fresh · ${packageVersionOnDisk} == package.json · dbVerify on the demo branch`,
  );
}
