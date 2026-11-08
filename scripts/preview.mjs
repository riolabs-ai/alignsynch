#!/usr/bin/env node
/**
 * `scripts/preview.mjs` — one command, one shareable preview URL, toolbar included.
 *
 * Why this exists. `docs/DEPLOYING.md` §1 records a deliberate policy: a push builds production
 * (and the branch `demo`) and nothing else, because a preview per push would spend a deployment per
 * push out of Hobby's rolling 100. The cost of that policy is named in the same section — "there is
 * no shareable preview URL for someone who is not on this machine" — which is exactly what makes
 * feedback impossible for anyone who is not sitting at this checkout. The Vercel project already
 * answers that: its own Ignored Build Step string ends "Run `vercel deploy` by hand if you need a
 * preview." This script is that sentence, deterministic.
 *
 * What it does NOT do, and why:
 *
 * - **It never installs `@vercel/toolbar`.** The Vercel Toolbar is available by default on every
 *   preview deployment (measured: `enablePreviewFeedback: true` on the project, and
 *   `vercel.live/_next-live/feedback/feedback.js` present in a preview's rendered DOM). The package
 *   is the production/localhost path, where the toolbar is *not* injected — mounting it in this tree
 *   would ship toolbar code into the production bundle to duplicate something already there.
 * - **It never deploys production.** `--prod` is refused outright: production is the merge to `main`
 *   (`docs/RELEASING.md`), not a local command.
 * - **It changes no setting.** Preview creation is still off at the project level
 *   (`previewDeploymentsDisabled: true`), so a branch push creates no preview record; this script is
 *   the opt-in route and it spends exactly one deployment each time it is run.
 *
 * Usage:
 *
 *   node scripts/preview.mjs                     # deploy this tree as a preview, print the URL
 *   node scripts/preview.mjs --json              # the same, as one JSON object
 *   node scripts/preview.mjs --project other     # a different Vercel project
 *
 * Options:
 *   --project <name>   Vercel project name (default: alignsynch)
 *   --scope <slug>     team scope for `vercel link`, when the CLI cannot resolve it
 *   --json             print one JSON object instead of the report
 *   --help             this text
 *
 * Exit codes: 0 deployed · 1 deploy failed · 2 no CLI or not linked · 3 bad usage.
 *
 * Node ≥ 20 (the repo's floor). The Vercel CLI must be on PATH and logged in; in this environment
 * that means the node 24 wrapper: `~/.hermes/profiles/alignsynch/bin/node24.sh node scripts/preview.mjs`.
 */
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** The repository root — the tree that gets uploaded, and where `vercel link` writes `.vercel/`. */
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** The project this repository builds (`docs/DEPLOYING.md` §1). */
const DEFAULT_PROJECT = "alignsynch";

/** A deployment URL, whole. Used to validate what the parser found, never to search with. */
const DEPLOYMENT_URL = /^https:\/\/[A-Za-z0-9][A-Za-z0-9.-]*\.vercel\.app$/;

/** Any `*.vercel.app` URL in a line of CLI output — the text fallback, when there is no JSON. */
const DEPLOYMENT_URL_IN_TEXT = /https:\/\/[A-Za-z0-9][A-Za-z0-9.-]*\.vercel\.app/g;

/**
 * The CLI colours its output; a URL wrapped in escape sequences would not match anything. The
 * escape is built from its code point so no control character appears in the source, which is what
 * biome's `noControlCharactersInRegex` (rightly) rejects.
 */
const ESCAPE = String.fromCharCode(27);
const ANSI = new RegExp(`${ESCAPE}\\[[0-9;]*[A-Za-z]`, "g");

/** A deploy can need minutes on a cold build cache; the CLI streams until the build settles. */
const DEPLOY_TIMEOUT_MS = 15 * 60_000;

const USAGE = "usage: node scripts/preview.mjs [--project <name>] [--scope <slug>] [--json]";

function reasonOf(error) {
  if (error instanceof Error) {
    const stderr = typeof error.stderr === "string" ? error.stderr.trim() : "";
    return stderr.length > 0 ? `${error.message}: ${stderr.split("\n")[0]}` : error.message;
  }
  return String(error);
}

function parseArgs(argv) {
  const options = { project: DEFAULT_PROJECT, scope: null, json: false, help: false };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--json") options.json = true;
    else if (arg === "--project" || arg === "--scope") {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("-")) {
        throw new Error(`${arg} needs a value`);
      }
      if (arg === "--project") options.project = value;
      else options.scope = value;
      index += 1;
    } else if (arg === "--prod" || arg === "--production") {
      throw new Error(
        "this script deploys previews only — production is the merge to `main` (docs/RELEASING.md)",
      );
    } else {
      throw new Error(`unknown argument ${JSON.stringify(arg)}`);
    }
  }

  return options;
}

/**
 * The deployment out of `vercel deploy`'s output.
 *
 * Two shapes, both real: the CLI prints `Inspect`/`Preview` lines and then the deployment as JSON
 * (`--yes` turns the JSON on), and older or quieter invocations print only the lines. So the JSON's
 * `deployment.url` is read first — it is a field, not a guess — and the text form is the fallback.
 * `target` comes back with it, which is how a production deployment can be refused rather than
 * announced as a preview.
 */
export function parseDeployment(stdout) {
  const text = String(stdout).replace(ANSI, "");

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      const parsed = JSON.parse(text.slice(start, end + 1));
      const url = parsed?.deployment?.url;
      if (typeof url === "string" && DEPLOYMENT_URL.test(url)) {
        return { url, target: parsed?.deployment?.target ?? null };
      }
    } catch {
      // Not JSON after all: fall through to the text form below.
    }
  }

  const matches = text.match(DEPLOYMENT_URL_IN_TEXT) ?? [];
  return matches.length > 0 ? { url: matches[matches.length - 1], target: null } : null;
}

/** Is the CLI there at all? A missing binary is an environment problem, not a failed deploy. */
async function cliVersion() {
  try {
    const { stdout } = await execFileAsync("vercel", ["--version"], { timeout: 60_000 });
    return { version: stdout.trim().split("\n").pop() ?? "unknown", reason: null };
  } catch (error) {
    return { version: null, reason: reasonOf(error) };
  }
}

/** `vercel link` is idempotent and writes the gitignored `.vercel/`; a missing link fails a deploy. */
async function ensureLinked(project, scope) {
  if (existsSync(join(REPO, ".vercel", "project.json"))) return { linked: true, reason: null };

  const args = ["link", "--yes", "--project", project];
  if (scope !== null) args.push("--scope", scope);

  try {
    await execFileAsync("vercel", args, {
      cwd: REPO,
      timeout: 5 * 60_000,
      maxBuffer: 32 * 1024 * 1024,
    });
    return { linked: true, reason: null };
  } catch (error) {
    return { linked: false, reason: reasonOf(error) };
  }
}

/** The allowance, through the same instrument `deploy-check` uses. `UNKNOWN` is never a zero. */
async function deploymentAllowance(url) {
  try {
    const { stdout } = await execFileAsync(
      process.execPath,
      [join(REPO, "scripts", "deploy-check.mjs"), url, "--json"],
      { cwd: REPO, timeout: 3 * 60_000, maxBuffer: 32 * 1024 * 1024 },
    );
    const start = stdout.indexOf("{");
    const parsed = start === -1 ? null : JSON.parse(stdout.slice(start));
    const quota = parsed?.quota ?? null;
    if (quota?.status !== "counted")
      return { status: "unknown", reason: quota?.reason ?? "no quota block" };
    return {
      status: "counted",
      count: quota.count,
      limit: quota.limit,
      remaining: quota.remaining,
    };
  } catch (error) {
    // `deploy-check` exits 2 for an UNKNOWN verdict (a CLI deploy carries no commit), which is not
    // an error here — only a run that printed no JSON at all is.
    const stdout = typeof error?.stdout === "string" ? error.stdout : "";
    const start = stdout.indexOf("{");
    if (start !== -1) {
      try {
        const quota = JSON.parse(stdout.slice(start))?.quota ?? null;
        if (quota?.status === "counted") {
          return {
            status: "counted",
            count: quota.count,
            limit: quota.limit,
            remaining: quota.remaining,
          };
        }
        return { status: "unknown", reason: quota?.reason ?? "no quota block" };
      } catch {
        return { status: "unknown", reason: "deploy-check printed something that is not JSON" };
      }
    }
    return { status: "unknown", reason: reasonOf(error) };
  }
}

/** The branch and the commit this preview shows, so a reader can tell it from a stale URL. */
async function treeIdentity() {
  const read = async (args) => {
    try {
      const { stdout } = await execFileAsync("git", args, { cwd: REPO });
      return stdout.trim();
    } catch {
      return null;
    }
  };
  const ref = await read(["rev-parse", "--abbrev-ref", "HEAD"]);
  const sha = await read(["rev-parse", "HEAD"]);
  const dirty = await read(["status", "--porcelain"]);
  return { ref, sha, dirty: dirty !== null && dirty.length > 0 };
}

function allowanceLine(allowance) {
  if (allowance.status === "counted") {
    return `${allowance.count} / ${allowance.limit} in the last 24h — ${allowance.remaining} remaining`;
  }
  return `UNKNOWN (${allowance.reason})`;
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${reasonOf(error)}\n${USAGE}\n`);
    return 3;
  }

  if (options.help) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }

  const cli = await cliVersion();
  if (cli.version === null) {
    process.stderr.write(
      `\`vercel\` is not usable here (${cli.reason}).\n` +
        "Install it, or run this through the node 24 wrapper that has it on PATH:\n" +
        "  ~/.hermes/profiles/alignsynch/bin/node24.sh node scripts/preview.mjs\n",
    );
    return 2;
  }

  const link = await ensureLinked(options.project, options.scope);
  if (!link.linked) {
    process.stderr.write(`could not link ${options.project} (${link.reason})\n`);
    return 2;
  }

  const tree = await treeIdentity();
  if (tree.dirty) {
    process.stderr.write(
      "note: the working tree has uncommitted changes — the preview shows the tree, not a PR head\n",
    );
  }

  let deployment;
  try {
    const { stdout } = await execFileAsync("vercel", ["deploy", "--yes"], {
      cwd: REPO,
      timeout: DEPLOY_TIMEOUT_MS,
      maxBuffer: 64 * 1024 * 1024,
    });
    deployment = parseDeployment(stdout);
  } catch (error) {
    process.stderr.write(`vercel deploy failed (${reasonOf(error)})\n`);
    return 1;
  }

  if (deployment === null) {
    process.stderr.write("vercel deploy printed no deployment URL — it did not build a preview\n");
    return 1;
  }

  if (deployment.target === "production") {
    process.stderr.write(
      `vercel deploy built a PRODUCTION deployment (${deployment.url}) — this script makes previews only\n`,
    );
    return 1;
  }

  const url = deployment.url;

  const allowance = await deploymentAllowance(url);

  if (options.json) {
    process.stdout.write(
      `${JSON.stringify(
        {
          url,
          project: options.project,
          ref: tree.ref,
          commit: tree.sha,
          dirty: tree.dirty,
          toolbar: "injected by Vercel on preview deployments; sign in to Vercel to comment",
          deploys: allowance,
          deployedAt: new Date().toISOString(),
        },
        null,
        2,
      )}\n`,
    );
    return 0;
  }

  process.stdout.write(`preview:  ${url}\n`);
  process.stdout.write(
    `tree:     ${tree.ref ?? "unknown ref"} @ ${tree.sha === null ? "unknown" : tree.sha.slice(0, 12)}` +
      `${tree.dirty ? " (with uncommitted changes)" : ""}\n`,
  );
  process.stdout.write(
    "toolbar:  on — Vercel injects it on preview deployments; sign in to Vercel to comment\n",
  );
  process.stdout.write(`deploys:  ${allowanceLine(allowance)}\n`);
  process.stdout.write(`\nPR body line:\n  Preview: ${url}\n`);
  return 0;
}

/** Only run when executed as a script: importing it (a test) must not deploy anything. */
const isEntry =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntry) process.exitCode = await main();
