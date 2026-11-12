#!/usr/bin/env node
/**
 * `scripts/deploy-demo.mjs` — create the deployment `demo.alignsynch.com` resolves to.
 *
 * Why this exists. `vercel.json` names exactly one branch besides `main` that may build — `demo` —
 * and `docs/DEPLOYING.md` §1 reads that literal as "the branch that serves the public demo". The
 * literal is a **policy**, not a mechanism: creation is disabled at the project level
 * (`previewDeploymentsDisabled: true`, `gitProviderOptions.createDeployments: "disabled"`), so a
 * push to `demo` produces no deployment record at all and the `ignoreCommand` is never consulted
 * for it. Measured 2026-11-12: `origin/demo` existed at `43c0a645`, `GET
 * /v6/deployments?meta-githubCommitRef=demo` answered **0**, and the domain — attached, verified,
 * `gitBranch: demo` — answered `404 DEPLOYMENT_NOT_FOUND`. A branch domain with no deployment for
 * its ref has nothing to point at.
 *
 * What it does, and why in this shape. It asks the API to build the **git ref**, not this tree:
 * `POST /v13/deployments` with `gitSource.ref` is the request the GitHub integration would have
 * made. Three consequences, and each one is the reason for the choice:
 *
 *   - the deployment carries `meta.githubCommitRef: demo`, which is what a branch domain
 *     (`gitBranch: demo`) follows — so the alias moves on its own, with no `vercel alias` call;
 *   - the build resolves the **Preview** environment scoped to `demo` (the variables
 *     `pnpm env:sync --target preview --branch demo` writes), which is the whole point of a demo
 *     deployment: it talks to the demo Neon branch, not production;
 *   - the code built is the branch on GitHub, so an uncommitted tree can never be published by
 *     this command.
 *
 * Usage:
 *
 *   pnpm deploy:demo                # build ref `demo`, wait for READY, print the deployment URL
 *   pnpm deploy:demo -- --verify    # …and print the alias's own /api/version as the proof
 *   pnpm deploy:demo -- --no-wait   # create it and return the id, without waiting for the build
 *   pnpm deploy:demo -- --json      # one object, for a PR body or a script
 *   pnpm deploy:demo -- --ref demo --project alignsynch --team riolabs-ais-projects
 *
 * Exit codes: 0 created (and READY, when it waited) · 1 the build failed or the alias never moved ·
 * 2 no credential.
 *
 * Credential: `VERCEL_TOKEN`, or the Vercel CLI's own `auth.json` — the same pair
 * `scripts/vercel-prune.mjs` reads, and neither is printed, logged or put in an error message.
 *
 * No dependencies: `fetch` is global on Node 24, which `.nvmrc` pins.
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const API = "https://api.vercel.com";

/** The project this repository builds, its team, the branch that serves the demo, and the alias. */
const DEFAULT_PROJECT = "alignsynch";
const DEFAULT_TEAM = "riolabs-ais-projects";
const DEFAULT_REF = "demo";
const DEFAULT_DOMAIN = "demo.alignsynch.com";

/** A cold build is ~40 s and a cold cache is minutes; the ceiling is the CLI's own for a deploy. */
const SETTLE_TIMEOUT_MS = 20 * 60_000;
const POLL_INTERVAL_MS = 5_000;

/** How long the alias may lag the deployment it should be pointing at. */
const ALIAS_TIMEOUT_MS = 3 * 60_000;

/** The CLI's auth file, in the order the platform writes it. */
function authFileCandidates() {
  const data = process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share");
  return [
    join(data, "com.vercel.cli", "auth.json"),
    join(homedir(), ".vercel", "auth.json"),
    join(homedir(), "Library", "Application Support", "com.vercel.cli", "auth.json"),
  ];
}

/** The token, from the environment first, then the CLI's file. Never returned to a caller's log. */
function readToken() {
  const fromEnv = (process.env.VERCEL_TOKEN ?? "").trim();
  if (fromEnv !== "") return fromEnv;
  for (const path of authFileCandidates()) {
    try {
      const parsed = JSON.parse(readFileSync(path, "utf8"));
      const token = typeof parsed?.token === "string" ? parsed.token.trim() : "";
      if (token !== "") return token;
    } catch {
      // Absent or unreadable is not an error: the next candidate may exist.
    }
  }
  return "";
}

/** A string flag, or the default when absent. */
function stringFlag(argv, name, fallback) {
  const i = argv.indexOf(name);
  if (i === -1) return fallback;
  const value = argv[i + 1];
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${name} wants a value`);
  return value.trim();
}

const argv = process.argv.slice(2);

if (argv.includes("--help") || argv.includes("-h")) {
  console.log(
    [
      "usage: node scripts/deploy-demo.mjs [options]",
      "",
      "  --ref <branch>          git ref to build (default demo)",
      "  --project <name>        Vercel project (default alignsynch)",
      "  --team <slug>           Vercel team slug (default riolabs-ais-projects)",
      "  --domain <host>         the alias to read back with --verify (default demo.alignsynch.com)",
      "  --verify                read the alias's /api/version and fail if it is another commit",
      "  --no-wait               create the deployment and return, without waiting for the build",
      "  --json                  print one object instead of the report",
      "",
      "Builds the ref on GitHub, never this tree: the branch domain follows meta.githubCommitRef.",
    ].join("\n"),
  );
  process.exit(0);
}

const json = argv.includes("--json");
const wait = !argv.includes("--no-wait");
const verify = argv.includes("--verify");
const ref = stringFlag(argv, "--ref", DEFAULT_REF);
const projectName = stringFlag(argv, "--project", DEFAULT_PROJECT);
const teamSlug = stringFlag(argv, "--team", DEFAULT_TEAM);
const domain = stringFlag(argv, "--domain", DEFAULT_DOMAIN);

const token = readToken();
if (token === "") {
  console.error(
    "deploy-demo: no credential — set VERCEL_TOKEN, or run `vercel login` so the CLI's auth.json exists",
  );
  process.exit(2);
}

/** One authenticated JSON call. A non-2xx answer becomes a sentence naming the path. */
async function api(path, init = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`${init.method ?? "GET"} ${path} — ${response.status} ${detail}`);
  }
  return response.status === 204 ? null : response.json();
}

/** The team id, from its slug. A slug this token cannot see is the real refusal to report. */
async function teamIdOf(slug) {
  const body = await api("/v2/teams");
  const team = (body.teams ?? []).find((candidate) => candidate.slug === slug);
  if (team === undefined) {
    const known = (body.teams ?? []).map((candidate) => candidate.slug).join(", ");
    throw new Error(`no team "${slug}" for this token (it can see: ${known})`);
  }
  return team.id;
}

/** The deployment out of the create call: its id, its URL and the commit it will build. */
async function createDeployment(project, teamId) {
  const repoId = Number(project?.link?.repoId);
  if (project?.link?.type !== "github" || !Number.isFinite(repoId)) {
    throw new Error(
      `project "${projectName}" has no GitHub link — there is no ref to build (link.type: ${project?.link?.type ?? "absent"})`,
    );
  }
  const body = await api(`/v13/deployments?teamId=${teamId}&forceNew=1`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: projectName,
      project: project.id,
      gitSource: { type: "github", repoId, ref },
    }),
  });
  return {
    id: body.id,
    url: `https://${body.url}`,
    commit: body?.meta?.githubCommitSha ?? null,
  };
}

/** Poll until the build settles. `ERROR`/`CANCELED` is an answer, not a timeout. */
async function waitForReady(id, teamId) {
  const deadline = Date.now() + SETTLE_TIMEOUT_MS;
  for (;;) {
    const body = await api(`/v13/deployments/${id}?teamId=${teamId}`);
    const state = body.readyState ?? body.state ?? "UNKNOWN";
    if (state === "READY") return { state, error: null };
    if (state === "ERROR" || state === "CANCELED") {
      return { state, error: body.errorMessage ?? `the build ended ${state}` };
    }
    if (Date.now() > deadline) {
      return { state, error: `still ${state} after ${SETTLE_TIMEOUT_MS / 60_000} minutes` };
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

/** What the alias answers. `commit` is the sha the alias serves, which is the whole question. */
async function readAlias() {
  const response = await fetch(`https://${domain}/api/version`, {
    headers: { "cache-control": "no-cache" },
  });
  if (!response.ok) return { status: response.status, version: null, commit: null };
  const body = await response.json().catch(() => null);
  return {
    status: response.status,
    version: typeof body?.version === "string" ? body.version : null,
    commit: typeof body?.commit === "string" ? body.commit : null,
  };
}

/**
 * The alias moves a few seconds after the build is READY, so this waits for it rather than reading
 * once and reporting whatever the edge had cached.
 */
async function waitForAlias(commit) {
  const deadline = Date.now() + ALIAS_TIMEOUT_MS;
  for (;;) {
    const serving = await readAlias();
    if (commit === null || serving.commit === commit) return serving;
    if (Date.now() > deadline) return serving;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

async function main() {
  const teamId = await teamIdOf(teamSlug);
  const project = await api(`/v9/projects/${encodeURIComponent(projectName)}?teamId=${teamId}`);

  const deployment = await createDeployment(project, teamId);
  const settled = wait
    ? await waitForReady(deployment.id, teamId)
    : { state: "QUEUED", error: null };
  const serving = verify ? await waitForAlias(deployment.commit) : null;

  const aliasMoved =
    serving === null || deployment.commit === null || serving.commit === deployment.commit;

  if (json) {
    console.log(
      JSON.stringify(
        { project: projectName, ref, deployment, state: settled.state, serving },
        null,
        2,
      ),
    );
  } else {
    console.log(`deploy-demo: ${projectName} · ref ${ref}`);
    console.log(`  repository  ${project.link.repo ?? "alignsynch"} (${ref})`);
    console.log(`  commit      ${deployment.commit ?? "unknown"}`);
    console.log(`  deployment  ${deployment.url}`);
    console.log(`  state       ${settled.state}`);
    if (serving !== null) {
      console.log(`  alias       https://${domain}/api/version`);
      console.log(
        `  serving     ${serving.commit === null ? `HTTP ${serving.status}` : JSON.stringify({ version: serving.version, commit: serving.commit })}`,
      );
    }
  }

  if (settled.error !== null) {
    console.error(`deploy-demo: the build did not settle — ${settled.error}`);
    process.exit(1);
  }
  if (!aliasMoved) {
    console.error(
      `deploy-demo: the alias is not serving this build — https://${domain}/api/version answers ${serving.commit}, expected ${deployment.commit}`,
    );
    process.exit(1);
  }
}

try {
  await main();
} catch (error) {
  console.error(`deploy-demo: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
