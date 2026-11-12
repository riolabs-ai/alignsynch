#!/usr/bin/env node
/**
 * `scripts/vercel-prune.mjs` — delete stale Vercel deployments, so Function Storage stops
 * filling with builds nobody will roll back to.
 *
 * Why this exists: Vercel's Function Storage is the **sum of every retained deployment's
 * serverless functions**, for the project's production deployments and its one preview branch
 * alike. It is not traffic, not runtime memory and not bandwidth — nothing the running app does
 * moves it. Deployments do, and Vercel prunes none of them on the free tier. Measured on
 * 2026-11-08: **454 deployments in 9.6 days** (360 of them on `main`), which is 100 % of the
 * 10 GB free allowance, and a full quota is a release that cannot deploy.
 *
 * What it protects, and it protects rather than guesses:
 *
 *   - **every deployment a domain is aliased to** — `alignsynch.com`, `demo.alignsynch.com` and
 *     the per-branch preview aliases. Deleting one of those takes a live URL down, so the alias
 *     table is read first and wins over every other rule.
 *   - **the newest `--keep-latest` deployments** (default 3), which is the rollback buffer.
 *   - **anything younger than `--keep-days`** (default 1), so a cut made an hour ago is still
 *     there to roll back to.
 *
 * Everything else is a candidate. Dry run by default: it prints the plan and deletes nothing
 * until `--apply` is passed, because this is the one script here that destroys things.
 *
 *   node scripts/vercel-prune.mjs                       # the plan, no writes
 *   node scripts/vercel-prune.mjs --apply               # delete the candidates
 *   node scripts/vercel-prune.mjs --apply --keep-days 7 # a week of rollbacks
 *
 * Credentials: `VERCEL_TOKEN`, or the Vercel CLI's own `auth.json` (the file `vercel login`
 * writes) at `$XDG_DATA_HOME/com.vercel.cli/auth.json`, defaulting to the Linux path. Neither is
 * printed, logged or put in an error message — a refusal names the variable to set instead.
 *
 * No dependencies: `fetch` is global on Node 24, which `.nvmrc` pins.
 */
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const API = "https://api.vercel.com";

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

/** A number flag, or the default when absent or not a number. `Infinity` is never a sensible age. */
function numberFlag(argv, name, fallback) {
  const i = argv.indexOf(name);
  if (i === -1) return fallback;
  const raw = argv[i + 1];
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} wants a number of days or deployments, got "${raw ?? ""}"`);
  }
  return value;
}

/** A string flag, or the default. */
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
      "usage: node scripts/vercel-prune.mjs [options]",
      "",
      "  --apply                 delete the candidates (default is a dry run)",
      "  --keep-days <n>         never delete a deployment younger than n days (default 1)",
      "  --keep-latest <n>       always keep the n newest deployments (default 3)",
      "  --project <name>        Vercel project (default alignsynch)",
      "  --team <slug>           Vercel team slug (default riolabs-ais-projects)",
      "",
      "Protected, whatever the flags say: every deployment a domain is aliased to.",
    ].join("\n"),
  );
  process.exit(0);
}

const apply = argv.includes("--apply");
const keepDays = numberFlag(argv, "--keep-days", 1);
const keepLatest = numberFlag(argv, "--keep-latest", 3);
const projectName = stringFlag(argv, "--project", "alignsynch");
const teamSlug = stringFlag(argv, "--team", "riolabs-ais-projects");

const token = readToken();
if (token === "") {
  console.error(
    "vercel-prune: no credential — set VERCEL_TOKEN, or run `vercel login` so the CLI's auth.json exists",
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
    throw new Error(`${init.method ?? "GET"} ${path} — ${response.status} ${response.statusText}`);
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

/** Every deployment on the project, newest first, across pages of 100. */
async function allDeployments(projectId, teamId) {
  const deployments = [];
  let until;
  for (;;) {
    const query = new URLSearchParams({ projectId, teamId, limit: "100" });
    if (until !== undefined) query.set("until", String(until));
    const page = await api(`/v6/deployments?${query.toString()}`);
    const batch = page.deployments ?? [];
    deployments.push(...batch);
    if (batch.length < 100) break;
    until = batch[batch.length - 1].createdAt;
  }
  return deployments;
}

/** Deployments a domain points at. These are the ones a delete would break. */
async function aliasedDeploymentIds(projectId, teamId) {
  const body = await api(`/v4/aliases?projectId=${projectId}&teamId=${teamId}&limit=100`);
  const ids = new Set();
  for (const alias of body.aliases ?? []) {
    if (typeof alias.deploymentId === "string") ids.add(alias.deploymentId);
  }
  return ids;
}

async function main() {
  const teamId = await teamIdOf(teamSlug);
  const project = await api(`/v9/projects/${encodeURIComponent(projectName)}?teamId=${teamId}`);
  const projectId = project.id;

  const deployments = await allDeployments(projectId, teamId);
  deployments.sort((a, b) => b.createdAt - a.createdAt);
  const aliased = await aliasedDeploymentIds(projectId, teamId);

  const now = Date.now();
  const protectedIds = new Set(aliased);
  for (const deployment of deployments.slice(0, keepLatest)) protectedIds.add(deployment.uid);

  const candidates = deployments.filter((deployment) => {
    if (protectedIds.has(deployment.uid)) return false;
    if (deployment.alias !== undefined && deployment.aliasError === undefined) return false;
    const ageDays = (now - deployment.createdAt) / 86_400_000;
    return ageDays > keepDays;
  });

  const oldest = candidates.at(-1);
  const newest = candidates[0];
  console.log(`vercel-prune: ${projectName} on ${teamSlug}`);
  console.log(`  deployments        ${deployments.length}`);
  console.log(
    `  protected          ${protectedIds.size} (${aliased.size} aliased, +${keepLatest} newest)`,
  );
  console.log(`  younger than ${keepDays}d  kept`);
  console.log(`  candidates         ${candidates.length}`);
  if (oldest !== undefined && newest !== undefined) {
    const ageOf = (d) => ((now - d.createdAt) / 86_400_000).toFixed(1);
    console.log(`  candidate span     ${ageOf(oldest)}d old → ${ageOf(newest)}d old`);
  }

  if (!apply) {
    console.log("\n  dry run — nothing deleted. Re-run with --apply to delete the candidates.");
    return;
  }

  let deleted = 0;
  const failures = [];
  for (const deployment of candidates) {
    let done = false;
    for (let attempt = 0; attempt < 4 && !done; attempt += 1) {
      try {
        await api(`/v13/deployments/${deployment.uid}?teamId=${teamId}`, { method: "DELETE" });
        done = true;
      } catch (error) {
        // The API rate-limits a bulk delete; that is a wait, not a failure.
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes(" 429 ")) {
          await new Promise((resolve) => setTimeout(resolve, 2_000 * (attempt + 1)));
          continue;
        }
        failures.push({ url: deployment.url, message });
        break;
      }
    }
    if (done) deleted += 1;
  }

  console.log(`\n  deleted            ${deleted}/${candidates.length}`);
  if (failures.length > 0) {
    console.log(`  failed             ${failures.length}`);
    for (const failure of failures.slice(0, 10))
      console.log(`    ${failure.url} — ${failure.message}`);
  }
}

try {
  await main();
} catch (error) {
  console.error(`vercel-prune: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
