#!/usr/bin/env node
/**
 * `scripts/deploy-check.mjs` — is production serving the commit it should be, and how much of the
 * deployment allowance is left?
 *
 * Two questions, one run, two lines on stdout:
 *
 *   production: STALE (expected 03a678b1abc, serving b8fdf53a424) — the deployed build is not this commit
 *   deploys:    23 / 100 in the last 24h — 77 remaining
 *
 * Why this exists. `bash scripts/verify.sh` is network-free by contract — `AGENTS.md` says the gate
 * "never opens a connection" — so no local check can ever see a deployment. `alignsynch.com` then
 * served a stale build three times in one day (frozen for hours while merges landed; silently stale
 * until someone compared the deploy list with `main`; then `● Blocked` deployments with five merges
 * unshipped) while every gate run was green and honest. A green gate and a current production are
 * two different claims, and only the gate was being made.
 *
 * Why it is NOT in the gate. Not in `scripts/verify.sh`, not in `.github/workflows/ci.yml`: the gate
 * must keep passing with no network and no credentials, and CI must keep running exactly one script.
 * This is an out-of-band check — run it by hand after a merge, or from a scheduled job.
 *
 * Why it needs no secret. The served commit is read from `GET <url>/api/version`, which the build
 * itself answers from values baked in by `next.config.mjs` (`APP_COMMIT`). Nothing is authenticated
 * and nothing is inferred, so the check runs anywhere. The deployment count is the one part that
 * needs the Vercel CLI, and it is deliberately allowed to answer `UNKNOWN` instead.
 *
 * The three states, and what each one means:
 *
 *   OK       production reports exactly the expected commit.
 *   STALE    production reports a different commit — the deploy is behind (or ahead of) what you
 *            asked about. This is the failure the script exists for; exit code 1.
 *   UNKNOWN  it cannot be determined: no `/api/version` (an older build, or a URL that is not this
 *            app), a redirect, a non-JSON answer, a `commit` that is not a SHA, or no expected SHA
 *            to compare against. Exit code 2. **UNKNOWN is never reported as OK.** A check that
 *            guesses is worse than no check: the one reading that would say "fine" while
 *            production is three merges behind is exactly the reading that cost a day.
 *
 * The deployment count is the early warning, not the verdict: it is printed even when production is
 * `OK`, because exhausting the allowance is what turns a healthy deploy into `● Blocked`. It is
 * counted over a **rolling 86,400 s** window (Vercel's limit is rolling, not per calendar day), and
 * every deployment record counts — including one whose build was skipped — so the number is an
 * upper bound on what was spent. An upper bound is the safe direction; a false zero is not, so a
 * count that cannot be taken prints `deploys: UNKNOWN` and never `0 / 100`.
 *
 * Usage:
 *   node scripts/deploy-check.mjs [url] [options]
 *
 *   node scripts/deploy-check.mjs                                  # https://alignsynch.com vs HEAD
 *   node scripts/deploy-check.mjs --expect "$(git rev-parse origin/main)"
 *   node scripts/deploy-check.mjs http://localhost:3131 --no-quota  # a local `next start`
 *   node scripts/deploy-check.mjs --json                           # one JSON object, same verdict
 *
 * Options:
 *   --expect <sha>   the commit production should be serving (default: `git rev-parse HEAD`)
 *   --limit <n>      the allowance to measure against (default: 100 — Hobby's rolling 24 h limit)
 *   --project-dir <path>  the checkout `vercel link` was run in (default: this repository)
 *   --no-quota       skip the deployment count entirely (no Vercel CLI needed)
 *   --json           print one JSON object instead of the two-line report
 *   --help           this text
 *
 * Exit codes: 0 OK · 1 STALE · 2 UNKNOWN · 3 bad usage.
 */
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** The repository root — `vercel ls` has to run where the checkout is linked to the project. */
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Where the build reports its own commit (`app/api/version/route.ts`). */
const VERSION_PATH = "/api/version";

/** Production, unless a URL is given. */
const DEFAULT_URL = "https://alignsynch.com";

/** Hobby's allowance: 100 deployments per rolling 24 h (`api-deployments-free-per-day`). */
const HOBBY_DEPLOY_LIMIT = 100;

/** Rolling, not calendar: Vercel's counter is a window, so this one is too. */
const ROLLING_WINDOW_MS = 86_400_000;

/** `vercel ls` pages at 100. Ten pages is 1,000 deployments — far more than the allowance. */
const MAX_PAGES = 10;

const PAGE_SIZE = 100;

/** A commit, abbreviated or full. Anything else is not a SHA and is never compared as one. */
const SHA = /^[0-9a-f]{7,40}$/;

const USAGE =
  "usage: node scripts/deploy-check.mjs [url] [--expect <sha>] [--limit <n>] " +
  "[--project-dir <path>] [--no-quota] [--json]";

/** The first 12 characters: enough to recognise a commit, short enough for one line. */
function short(sha) {
  return sha.slice(0, 12);
}

/** The message of an error, without the stack, for a one-line reason. */
function reasonOf(error) {
  if (error instanceof Error) {
    const stderr = typeof error.stderr === "string" ? error.stderr.trim() : "";
    return stderr.length > 0 ? `${error.message}: ${stderr.split("\n")[0]}` : error.message;
  }
  return String(error);
}

function parseArgs(argv) {
  const options = {
    url: DEFAULT_URL,
    expect: null,
    limit: HOBBY_DEPLOY_LIMIT,
    projectDir: process.env.VERCEL_PROJECT_DIR ?? REPO,
    quota: true,
    json: false,
    help: false,
  };
  const rest = [];

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith("--")) {
      rest.push(argument);
      continue;
    }

    const equals = argument.indexOf("=");
    const flag = equals === -1 ? argument : argument.slice(0, equals);
    const inline = equals === -1 ? null : argument.slice(equals + 1);
    const value = () => {
      if (inline !== null) return inline;
      const next = argv[index + 1];
      if (next === undefined || next.startsWith("--")) return null;
      index += 1;
      return next;
    };

    switch (flag) {
      case "--expect": {
        const given = value();
        if (given === null) throw new Error(`${flag} needs a commit SHA`);
        options.expect = given;
        break;
      }
      case "--limit": {
        const given = value();
        const limit = Number(given);
        if (!Number.isInteger(limit) || limit < 1 || limit > 10_000) {
          throw new Error(
            `${flag} needs a whole number of deployments, got ${JSON.stringify(given)}`,
          );
        }
        options.limit = limit;
        break;
      }
      case "--project-dir": {
        const given = value();
        if (given === null) throw new Error(`${flag} needs a path`);
        options.projectDir = resolve(given);
        break;
      }
      case "--no-quota":
        options.quota = false;
        break;
      case "--json":
        options.json = true;
        break;
      case "--help":
        options.help = true;
        break;
      default:
        throw new Error(`unknown option ${flag}\n${USAGE}`);
    }
  }

  if (rest.length > 1) throw new Error(`one URL at most, got ${rest.length}\n${USAGE}`);
  if (rest.length === 1) options.url = rest[0];

  return options;
}

/**
 * The commit production should be serving.
 *
 * `HEAD` by default, because the workflow is "merge, then check": the person running it is on the
 * branch they just landed. An explicit `--expect` takes any SHA, including one from history — which
 * is how a stale deploy is demonstrated without inventing a failure.
 */
async function resolveExpected(explicit) {
  if (explicit !== null) {
    const value = explicit.trim().toLowerCase();
    return SHA.test(value)
      ? { sha: value, source: "--expect" }
      : { sha: null, source: `--expect ${JSON.stringify(explicit)} is not a commit SHA` };
  }

  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: REPO });
    const value = stdout.trim().toLowerCase();
    return SHA.test(value)
      ? { sha: value, source: "git rev-parse HEAD" }
      : { sha: null, source: `git rev-parse HEAD printed ${JSON.stringify(stdout.trim())}` };
  } catch (error) {
    return { sha: null, source: `no --expect given and no git checkout here (${reasonOf(error)})` };
  }
}

/**
 * Which commit the URL is actually serving, asked of the deployment itself.
 *
 * Redirects are not followed: a `307` to a sign-in page would turn every answer into a `200` from
 * somewhere else, so the redirect is reported as the reason it cannot be told. `no-store` on the
 * request and on the route's answer keep a CDN copy from describing the previous deployment.
 */
async function probeServed(url) {
  let target;
  try {
    target = new URL(VERSION_PATH, url);
  } catch {
    return { sha: null, reason: `${JSON.stringify(url)} is not a URL` };
  }

  let response;
  try {
    response = await fetch(target, {
      redirect: "manual",
      headers: { "cache-control": "no-cache", pragma: "no-cache" },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    return { sha: null, reason: `could not reach ${target.href} (${reasonOf(error)})` };
  }

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location") ?? "elsewhere";
    return {
      sha: null,
      reason: `${VERSION_PATH} answers HTTP ${response.status} to ${location} — pass the final URL`,
    };
  }

  if (!response.ok) {
    return { sha: null, reason: `${VERSION_PATH} answers HTTP ${response.status}` };
  }

  let body;
  try {
    body = await response.json();
  } catch {
    return { sha: null, reason: `${VERSION_PATH} did not answer JSON` };
  }

  const reported = typeof body?.commit === "string" ? body.commit.trim().toLowerCase() : "";
  if (!SHA.test(reported)) {
    return {
      sha: null,
      reason: `${VERSION_PATH} reports commit ${JSON.stringify(body?.commit ?? null)}, which is not a commit SHA`,
    };
  }

  return { sha: reported, reason: null };
}

/** The verdict. Never a guess: a missing expected SHA or a missing served SHA is `UNKNOWN`. */
function decide(expected, served) {
  if (expected.sha === null) return { state: "UNKNOWN", reason: expected.source };
  if (served.sha === null) return { state: "UNKNOWN", reason: served.reason };

  const matches = expected.sha.startsWith(served.sha) || served.sha.startsWith(expected.sha);
  return matches
    ? { state: "OK", reason: null }
    : { state: "STALE", reason: "the deployed build is not this commit" };
}

/** `vercel ls --json` prints a banner before the JSON on some versions; take the object itself. */
function parseDeploymentList(stdout) {
  const start = stdout.indexOf("{");
  const end = stdout.lastIndexOf("}");
  if (start === -1 || end < start) throw new Error("no JSON object in the output");
  return JSON.parse(stdout.slice(start, end + 1));
}

/**
 * How many deployments were created in the last rolling 24 h, from `vercel ls`.
 *
 * Local-only by design: it needs the CLI and a linked checkout, and uses neither a token from the
 * repo nor an API key. Anywhere it cannot answer, the answer is `UNKNOWN` — never `0`.
 *
 * Paging stops one of two ways, and both prove the count: a page that reaches a deployment older
 * than the window (everything inside is then in hand), or a last page with no cursor. A run that
 * hits the page cap without either is `UNKNOWN`, because a partial count would understate spend.
 */
async function countDeployments(limit, projectDir) {
  if (!existsSync(join(projectDir, ".vercel", "project.json"))) {
    return {
      status: "unknown",
      reason:
        `no .vercel/project.json in ${projectDir} — run this from the linked checkout, ` +
        "or point --project-dir at the one that was `vercel link`ed",
    };
  }

  const cutoff = Date.now() - ROLLING_WINDOW_MS;
  const deployments = [];
  let cursor = null;
  let complete = false;

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const args = ["ls", "--json", "--yes", "--limit", String(PAGE_SIZE)];
    if (cursor !== null) args.push("--next", String(cursor));

    let stdout;
    try {
      ({ stdout } = await execFileAsync("vercel", args, {
        cwd: projectDir,
        maxBuffer: 32 * 1024 * 1024,
        timeout: 60_000,
      }));
    } catch (error) {
      return { status: "unknown", reason: `\`vercel ls\` failed (${reasonOf(error)})` };
    }

    let parsed;
    try {
      parsed = parseDeploymentList(stdout);
    } catch (error) {
      return {
        status: "unknown",
        reason: `\`vercel ls --json\` printed something that is not JSON (${reasonOf(error)})`,
      };
    }

    const batch = Array.isArray(parsed.deployments) ? parsed.deployments : [];
    deployments.push(...batch);

    const anchored = batch.some((deployment) => Number(deployment?.createdAt) < cutoff);
    const next = parsed?.pagination?.next ?? null;
    cursor = next === null || next === undefined ? null : next;

    if (anchored || cursor === null || batch.length === 0) {
      complete = true;
      break;
    }
  }

  if (!complete) {
    return {
      status: "unknown",
      reason: `more than ${MAX_PAGES * PAGE_SIZE} deployments — the rolling window was not anchored`,
    };
  }

  const count = deployments.filter((deployment) => Number(deployment?.createdAt) >= cutoff).length;
  return { status: "counted", count, limit, remaining: Math.max(limit - count, 0) };
}

/** `production: …` — the three things the card asks for, on one line, plus the reason when any. */
function productionLine(expected, served, verdict) {
  const expectedText = expected.sha === null ? "unknown" : short(expected.sha);
  const servedText = served.sha === null ? "unknown" : short(served.sha);
  const reason = verdict.reason === null ? "" : ` — ${verdict.reason}`;
  return `production: ${verdict.state} (expected ${expectedText}, serving ${servedText})${reason}`;
}

/** `deploys: …` — the consumption. `UNKNOWN` when it could not be counted, never a stand-in zero. */
function deploysLine(quota) {
  if (quota.status === "counted") {
    return `deploys:    ${quota.count} / ${quota.limit} in the last 24h — ${quota.remaining} remaining`;
  }
  if (quota.status === "skipped") return "deploys:    not checked (--no-quota)";
  return `deploys:    UNKNOWN (${quota.reason})`;
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${reasonOf(error)}\n`);
    return 3;
  }

  if (options.help) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }

  const expected = await resolveExpected(options.expect);
  const served = await probeServed(options.url);
  const verdict = decide(expected, served);
  const quota = options.quota
    ? await countDeployments(options.limit, options.projectDir)
    : { status: "skipped", reason: "asked not to" };

  if (options.json) {
    process.stdout.write(
      `${JSON.stringify(
        {
          url: options.url,
          expected,
          served,
          verdict,
          quota,
          checkedAt: new Date().toISOString(),
        },
        null,
        2,
      )}\n`,
    );
  } else {
    process.stdout.write(`${productionLine(expected, served, verdict)}\n`);
    process.stdout.write(`${deploysLine(quota)}\n`);
  }

  if (verdict.state === "OK") return 0;
  if (verdict.state === "STALE") return 1;
  return 2;
}

process.exitCode = await main();
