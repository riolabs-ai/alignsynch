#!/usr/bin/env node
/**
 * `pnpm demo:reset` — the demo branch, back to the demo dataset (#185).
 *
 * The demo is one Neon branch (`demo`) restored from the **schema-only base** `demo-base`, never
 * the project's default branch. The source is `DEMO_SOURCE_BRANCH` when that is set and the
 * branch's parent otherwise, and it is resolved by name through the API before anything is
 * written. Three operations, in this order, and nothing else:
 *
 *   1. **Migrate the source** (`demo-base`) through its own unpooled connection string. The base
 *      holds the schema and no rows, so it is only as current as the last migration applied to it;
 *      a migration added after it was cut would otherwise be missing from the demo for good.
 *      `db:migrate` is idempotent and ledgered (`schema_migrations`), so this is one connection
 *      and a printed ledger when there is something to apply, and a no-op when there is not.
 *      `--skip-migrate` is the manual/offline opt-out, and the step is skipped entirely on
 *      `--skip-reset`.
 *
 *   2. **Reset the branch from the source.** One API call — `POST …/branches/<id>/restore`
 *      with `source_branch_id` = the resolved source. `neon branches reset <branch> ^parent` is
 *      the same call with the parent as the source; naming the source explicitly is what lets a
 *      branch whose parent is `production` restore from the base instead. It is atomic on the
 *      storage side, so there is no window where half the data is gone; a script of `DELETE`s
 *      has as many half-finished states as it has statements, and one of them always looks like
 *      a valid demo until you read it.
 *
 *      The source is the base, and the base holds no rows, so the restore lands on an empty
 *      branch: this is what makes production data structurally unable to appear on the branch the
 *      demo serves. `assertSourceResettable` refuses a source that is the project's default
 *      branch, by id, so a mis-pointed source is a refusal and not a silent copy of the live data.
 *      The branch's own parent is *not* the rule: Neon does not allow re-parenting a branch
 *      through the API, so for a demo cut before the base existed that parent is a historical
 *      accident, and the source is what decides where the rows come from.
 *
 *   3. **Reseed from the bundle.** `scripts/db-seed.mjs` with `DEMO_AUTH=1`, pointed at *this
 *      branch's* connection string and *this branch's* auth host. The seed reads
 *      `data/bundles/demo-dataset.alignsynch.json` as the bundle it is (asserting it is still
 *      the canonical export), writes the six content tables, and creates the three demo
 *      accounts through the branch's own sign-up endpoint. None of that logic is copied here:
 *      a second writer would be a second definition of "seeded".
 *
 * A `--skip-reset` run (reseed only) still empties the branch first (`resetContent`): it cannot
 * use the restore, so without that the branch would keep whatever the previous reseed left. The
 * normal path empties nothing — the restore already landed on an empty branch. The emptying is
 * the reseed-only guard, not a step of the reset, and the SQL is unchanged.
 *
 * The reset is the only bound on the demo (Jaden's decision on #185): there is no session
 * expiry and no TTL. `scripts/demo-reset.mjs` is the whole lifecycle.
 *
 * ## What it refuses
 *
 * - **The default branch** (`production`). The demo reset never touches it, by id and by name.
 * - **A source that is the default branch.** The source is the demo's whole supply of data, so a
 *   source of `production` would copy live rows and real accounts onto the branch a public URL
 *   serves. That is a refusal (`demo-source-guard.mjs`) rather than a warning, by id from the
 *   API's own `default` flag, so a renamed default is still refused.
 * - **A named source that does not exist.** Resolving the source is a lookup before the first
 *   write: an unknown name is a refusal listing the branches that do exist, never a silent fall
 *   back to the parent.
 * - **A branch with no parent and no `DEMO_SOURCE_BRANCH`.** A root branch *is* a default branch;
 *   with nothing named there is nothing to restore it from, and guessing would mean a second code
 *   path.
 * - **A source with no read-write compute.** The migrate step writes to the base, so a base
 *   without an endpoint is named and refused instead of half-run.
 * - **A missing branch.** Creating infrastructure is a decision, not a retry: the script says
 *   how to create it and exits.
 * - **A connection string from `.env.local`.** The URL and the auth host are derived from the
 *   branch id through the API, never read from the environment, so a shell that exported the
 *   production `DATABASE_URL` cannot aim this script at production. `NEON_AUTH_BASE_URL` from
 *   the environment is deliberately *overwritten*, not inherited, for the same reason.
 *
 * ## What it prints
 *
 * Row counts before the reset, after the reset, and after the reseed; then the same six counts
 * derived from the bundle and compared; then the two rules #185 asks about — the write made
 * between two resets is gone, and two consecutive runs converge. With a schema-only source the
 * after-reset block reads **zeros**, and that block is the evidence the source carries no rows.
 * On a failure it prints the branch's state *after* the failure and exits non-zero: a failed
 * reset leaves a branch that still serves, and saying what it holds is part of the job.
 *
 * Usage:
 *   NEON_API_KEY=… node scripts/demo-reset.mjs                 # migrate, reset + reseed `demo`
 *   NEON_API_KEY=… node scripts/demo-reset.mjs --dry-run       # resolve and print, change nothing
 *   NEON_API_KEY=… node scripts/demo-reset.mjs --skip-migrate  # trust the base's ledger
 *   NEON_API_KEY=… node scripts/demo-reset.mjs --skip-seed     # migrate + reset only
 *   NEON_API_KEY=… node scripts/demo-reset.mjs --skip-reset    # reseed only (empties first)
 *
 * Flags: --branch <name> (default `demo`), --source <name> (default `$DEMO_SOURCE_BRANCH`, else
 * the branch's parent), --project <id> (default: the only project the key can see), --dry-run,
 * --skip-migrate, --skip-reset, --skip-seed, --help.
 *
 * `DEMO_SOURCE_BRANCH` is how the demo restores from `demo-base` while its own parent is still
 * `production`: Neon does not allow a branch to be re-parented, so the source is named instead of
 * inherited. Pointing it at `production` is refused, by id.
 *
 * Exit: 0 the demo is reset and seeded · 1 a step failed (the state is reported) · 2 usage or
 * a refused target · 3 `NEON_API_KEY` is not set.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import { Client } from "pg";
import { repoRoot } from "./load-env.mjs";
import { sourceRefusal } from "./demo-source-guard.mjs";

const API = (process.env.NEON_API_BASE ?? "https://console.neon.tech/api/v2").replace(/\/+$/, "");
const BUNDLE = "data/bundles/demo-dataset.alignsynch.json";
const SEED = "scripts/db-seed.mjs";
const MIGRATE = "scripts/db-migrate.mjs";

/** Names that are never a demo, whatever the API says about them. */
const FORBIDDEN_BRANCH_NAMES = ["production", "main", "master", "default"];

/** How long to wait for the branch to accept connections after a reset. */
const CONNECT_TIMEOUT_MS = 90_000;
const OPERATION_TIMEOUT_MS = 5 * 60_000;

/* ------------------------------------------------------------------ *\
 * Output
 * ------------------------------------------------------------------ */

const say = (line = "") => console.log(line);
const step = (line) => console.log(`\n▶ ${line}`);
const warn = (line) => console.error(`  ! ${line}`);

/** The module-resolution hook is registered once per process (see `bundleCounts`). */
let resolverRegistered = false;

class Refused extends Error {
  constructor(message) {
    super(message);
    this.exitCode = 2;
  }
}

/* ------------------------------------------------------------------ *\
 * Arguments
 * ------------------------------------------------------------------ */

const USAGE = `usage: node scripts/demo-reset.mjs [--branch <name>] [--source <name>] [--project <id>]
                                [--dry-run] [--skip-migrate] [--skip-reset] [--skip-seed]

  --branch <name>   the branch to reset (default: demo)
  --source <name>   the branch to restore from (default: $DEMO_SOURCE_BRANCH, else the branch's parent)
  --project <id>    the Neon project (default: $NEON_PROJECT_ID, else the only project the key sees)
  --dry-run         resolve the branch and print the plan; change nothing
  --skip-migrate    do not apply db/migrations to the source branch first
  --skip-reset      reseed without resetting (the branch is emptied first)
  --skip-seed       reset without reseeding

The source is a branch name — \`DEMO_SOURCE_BRANCH=demo-base\`, or \`--source demo-base\` — and it
must be the schema-only base: a source that is the project's default branch is refused, because a
restore would copy live data onto the branch a public URL serves. With nothing named the branch's
own parent is used.

requires NEON_API_KEY (a Neon API key, or a CLI OAuth token). The key is never printed.`;

function parseArgs(argv) {
  const options = {
    branch: process.env.DEMO_BRANCH?.trim() || "demo",
    source: process.env.DEMO_SOURCE_BRANCH?.trim() || null,
    project: process.env.NEON_PROJECT_ID?.trim() || null,
    dryRun: false,
    skipMigrate: false,
    skipReset: false,
    skipSeed: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      const value = argv[index + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Refused(`${arg} needs a value\n\n${USAGE}`);
      }
      index += 1;
      return value;
    };
    switch (arg) {
      case "--branch":
        options.branch = next();
        break;
      case "--source":
        options.source = next();
        break;
      case "--project":
        options.project = next();
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--skip-migrate":
        options.skipMigrate = true;
        break;
      case "--skip-reset":
        options.skipReset = true;
        break;
      case "--skip-seed":
        options.skipSeed = true;
        break;
      case "-h":
      case "--help":
        say(USAGE);
        process.exit(0);
        break;
      default:
        throw new Refused(`unknown argument ${arg}\n\n${USAGE}`);
    }
  }
  if (options.skipReset && options.skipSeed) {
    throw new Refused("--skip-reset and --skip-seed together are a no-op");
  }
  return options;
}

/* ------------------------------------------------------------------ *\
 * The Neon API — fetch, no SDK, no CLI
 * ------------------------------------------------------------------ */

/**
 * One request. `NEON_API_KEY` goes in the header and nowhere else: never in a message, never in
 * a URL, never in a log line (an error from the API echoes the request, not the credential).
 */
async function neon(method, path, body) {
  const key = process.env.NEON_API_KEY?.trim() ?? "";
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${key}`,
      accept: "application/json",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  const text = await response.text();
  let payload = null;
  try {
    payload = text === "" ? null : JSON.parse(text);
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const detail = payload?.message ?? (text === "" ? "" : text.slice(0, 200));
    throw new Error(
      `${method} ${path.split("?")[0]} answered HTTP ${response.status}${detail ? ` — ${detail}` : ""}`,
    );
  }
  return payload;
}

/** The project: `--project`, `$NEON_PROJECT_ID`, or the only one the key can see. */
async function resolveProject(requested) {
  if (requested !== null) {
    const project = await neon("GET", `/projects/${encodeURIComponent(requested)}`);
    return { id: project.project?.id ?? requested, name: project.project?.name ?? requested };
  }

  const list = await neon("GET", "/projects");
  const projects = list?.projects ?? [];
  if (projects.length === 1) return { id: projects[0].id, name: projects[0].name };
  if (projects.length === 0) {
    throw new Refused("this key can see no Neon project — pass --project <id>");
  }
  throw new Refused(
    `this key can see ${projects.length} projects (${projects.map((p) => `${p.name}=${p.id}`).join(", ")}) — pass --project <id> or set NEON_PROJECT_ID`,
  );
}

/**
 * The branch, by name, plus everything the two steps need: its id, its parent, its endpoint
 * host, and whether the project considers it the default.
 *
 * Re-resolved after the reset because the endpoint host is what the connection string points
 * at: if Neon moved the compute, a URL resolved before the reset addresses a host that is gone.
 */
async function resolveBranch(projectId, name) {
  const list = await neon("GET", `/projects/${projectId}/branches?limit=1000`);
  const branches = list?.branches ?? [];
  const branch = branches.find((candidate) => candidate.name === name);
  if (branch === undefined) {
    throw new Refused(
      `project ${projectId} has no branch named "${name}" (it has: ${branches.map((b) => b.name).join(", ") || "none"}). The reset only resets an existing branch — create it once (\`POST /projects/${projectId}/branches\` with "parent_id" of the default branch, or \`neon branches create\`) and re-run.`,
    );
  }

  const defaultBranch = branches.find((candidate) => candidate.default === true) ?? null;
  const siblings = branches.filter((candidate) => candidate.parent_id === branch.id);
  const endpoints = await neon("GET", `/projects/${projectId}/branches/${branch.id}/endpoints`);
  const rw =
    (endpoints?.endpoints ?? []).find((endpoint) => endpoint.type === "read_write") ?? null;
  if (rw === null) {
    throw new Refused(
      `branch "${name}" (${branch.id}) has no read-write compute endpoint — the reseed needs one (create one in the console, or \`neon endpoints create\`)`,
    );
  }

  return {
    id: branch.id,
    name: branch.name,
    parentId: branch.parent_id ?? null,
    parentName: branches.find((candidate) => candidate.id === branch.parent_id)?.name ?? null,
    isDefault: branch.default === true,
    protected: branch.protected === true,
    childCount: siblings.length,
    endpointId: rw.id,
    endpointHost: rw.host,
    defaultBranchId: defaultBranch?.id ?? null,
    defaultBranchName: defaultBranch?.name ?? null,
  };
}

/**
 * The branch the demo is restored from: `DEMO_SOURCE_BRANCH` (or `--source`) when it is named,
 * else the branch's own parent.
 *
 * The parent is the default because it is what `neon branches reset <branch> ^parent` means, so a
 * demo cut under the old topology keeps working unchanged. Naming the source is what lets a demo
 * that cannot be re-parented — Neon's `PATCH …/branches/{id}` refuses `parent_id` — still restore
 * from the schema-only base instead of the default branch its parent happens to be.
 *
 * A named source is resolved here, by name, **before** anything is written: an unknown name is a
 * refusal that lists the branches the project does have. The alternative — restoring from
 * `undefined`, or quietly falling back to the parent — is exactly the behaviour this change
 * exists to remove, because the parent is the thing nobody can vouch for.
 */
async function resolveSource(projectId, branch, requested) {
  const branches =
    (await neon("GET", `/projects/${projectId}/branches?limit=1000`))?.branches ?? [];
  const defaultBranch = branches.find((candidate) => candidate.default === true) ?? null;

  if (requested === null && branch.parentId === null) {
    throw new Refused(
      `"${branch.name}" has no parent and DEMO_SOURCE_BRANCH is not set, so there is nothing to reset it from (a root branch is a default branch). Nothing was changed.`,
    );
  }

  const found =
    requested === null
      ? branches.find((candidate) => candidate.id === branch.parentId)
      : branches.find((candidate) => candidate.name === requested);
  if (found === undefined) {
    throw new Refused(
      `project ${projectId} has no branch named "${requested}" to reset "${branch.name}" from — DEMO_SOURCE_BRANCH must name an existing branch (it has: ${branches.map((b) => b.name).join(", ") || "none"}). Nothing was changed.`,
    );
  }
  if (found.id === branch.id) {
    throw new Refused(
      `"${branch.name}" names itself as its source — restoring a branch from itself needs a timestamp and a backup branch, which this script never does. Nothing was changed.`,
    );
  }

  return {
    id: found.id,
    name: found.name,
    requested: requested !== null,
    defaultBranchId: defaultBranch?.id ?? null,
  };
}

/**
 * The target checks: every one of these must pass before a single byte is written.
 *
 * These are about the branch being *written*, and stay separate from the source rule below so
 * that `--branch production` is refused for being production rather than for having no source.
 */
function assertTargetResettable(branch) {
  if (branch.isDefault || branch.id === branch.defaultBranchId) {
    throw new Refused(
      `"${branch.name}" (${branch.id}) is the project's default branch — the demo reset never touches it. Nothing was changed.`,
    );
  }
  if (FORBIDDEN_BRANCH_NAMES.includes(branch.name.toLowerCase())) {
    throw new Refused(
      `"${branch.name}" is a name this script refuses on sight — the reset target is the demo branch, never production. Nothing was changed.`,
    );
  }
  if (branch.protected) {
    throw new Refused(
      `"${branch.name}" is protected — unprotected it first if this is really the demo`,
    );
  }
}

/**
 * The source rule (#185 follow-up): the demo's whole supply of data is the branch it is restored
 * from, so *that* is what must not be the default branch — a source of `production` copies live
 * rows and real accounts onto the branch a public URL serves for as long as the
 * restore-to-reseed window lasts. The comparison is pure and lives in `demo-source-guard.mjs` so
 * `tests/demo-reset.test.ts` can prove it without a Neon key.
 */
function assertSourceResettable(branch, source) {
  const refusal = sourceRefusal(branch, source);
  if (refusal !== null) throw new Refused(refusal);
}

/**
 * A source that carries content rows is harmless; a source that carries none of the auth
 * *configuration* is not.
 *
 * The restore copies the source's `neon_auth` schema along with its content tables, and the demo's
 * auth server reads its settings from `neon_auth.project_config` and its signing key from
 * `neon_auth.jwks`. A source emptied by deleting every `neon_auth` row restores a demo whose
 * `sign-up/email` answers `{"message":"Project config not found"}`: the restore lands on zeros and
 * the reseed cannot create the three accounts, so the public URL serves an empty demo until
 * someone notices. That failure is silent at the API level and only shows up one step later, which
 * is why it is checked **before** the restore rather than discovered by the seed.
 */
async function assertSourceSuppliesAuth(source, connectionString, branchName) {
  const client = await connect(connectionString, "demo-reset:source-auth");
  try {
    const counts = {};
    for (const table of ["project_config", "jwks"]) {
      const present = (
        await client.query("SELECT to_regclass($1) IS NOT NULL AS present", [
          `neon_auth."${table}"`,
        ])
      ).rows[0].present;
      counts[table] = present
        ? (await client.query(`SELECT count(*)::int AS n FROM neon_auth."${table}"`)).rows[0].n
        : 0;
    }
    const missing = Object.entries(counts)
      .filter(([, count]) => count === 0)
      .map(([table]) => `neon_auth.${table}`);
    if (missing.length > 0) {
      throw new Refused(
        `the source branch "${source.name}" (${source.id}) cannot supply a working demo: ${missing.join(" and ")} ${missing.length === 1 ? "is" : "are"} empty or absent, so a restore would leave "${branchName}" with an auth server that answers "Project config not found" and a reseed that cannot create the demo accounts. The source must carry the auth configuration (\`neon_auth.project_config\` and \`neon_auth.jwks\`) and no users — see docs/DEMO.md. Nothing was changed.`,
      );
    }
    return counts;
  } finally {
    await client.end();
  }
}

/**
 * Everything the migrate step and the source check need, resolved once: the endpoint, the
 * database and role, the two connection strings, and the assertion that the source can supply a
 * working demo. Resolving here (and not inside the migrate step) keeps one resolution per run, and
 * lets the check run on `--skip-migrate` too, where the migrate step never executes.
 */
async function prepareSource(projectId, source, branchName) {
  const enriched = await resolveSourceEndpoint(projectId, source);
  const { database, role } = await resolveDatabaseAndRole(projectId, enriched);
  const connectionStrings = await resolveConnectionStrings(projectId, enriched, database, role);

  // Same identity check the demo gets: the URI we hand the migration must address the source's own
  // compute. Migrating the wrong branch is a write to production's schema, so it stops here.
  if (!connectionStrings.direct.includes(enriched.endpointHost)) {
    throw new Error(
      `the connection string the API returned for ${enriched.name} does not address ${enriched.endpointHost} — refusing to migrate`,
    );
  }

  await assertSourceSuppliesAuth(enriched, connectionStrings.direct, branchName);
  return { ...enriched, database, role, connectionStrings };
}

/** The database and role inside the branch: the app's own names when the branch has them. */
async function resolveDatabaseAndRole(projectId, branch) {
  const databases =
    (await neon("GET", `/projects/${projectId}/branches/${branch.id}/databases`))?.databases ?? [];
  const roles =
    (await neon("GET", `/projects/${projectId}/branches/${branch.id}/roles`))?.roles ?? [];

  const database = databases.find((row) => row.name === "neondb") ?? databases[0] ?? null;
  const role =
    roles.find((row) => row.name === "neondb_owner") ??
    roles.find((row) => !row.protected) ??
    roles[0] ??
    null;
  if (database === null || role === null) {
    throw new Error(
      `branch ${branch.id} has no ${database === null ? "database" : "role"} the API can see`,
    );
  }
  return { database: database.name, role: role.name };
}

/** The two connection strings: pooled for the app's shape, direct for a script that writes. */
async function resolveConnectionStrings(projectId, branch, database, role) {
  const query = `branch_id=${encodeURIComponent(branch.id)}&database_name=${encodeURIComponent(database)}&role_name=${encodeURIComponent(role)}`;
  const pooled = await neon("GET", `/projects/${projectId}/connection_uri?${query}&pooled=true`);
  const direct = await neon("GET", `/projects/${projectId}/connection_uri?${query}&pooled=false`);
  return { pooled: pooled.uri, direct: direct.uri };
}

/**
 * The source branch's read-write endpoint — the migrate step writes to it, so it needs one.
 *
 * A base with no compute cannot be migrated, and the refusal names it: half-running the reset and
 * discovering that at the restore would leave the demo on a source whose ledger nobody advanced.
 */
async function resolveSourceEndpoint(projectId, source) {
  const endpoints = await neon("GET", `/projects/${projectId}/branches/${source.id}/endpoints`);
  const rw =
    (endpoints?.endpoints ?? []).find((endpoint) => endpoint.type === "read_write") ?? null;
  if (rw === null) {
    throw new Refused(
      `the source branch "${source.name}" (${source.id}) has no read-write compute endpoint — the reset migrates it before restoring, so create one in the console (or \`neon endpoints create\`) and re-run. Nothing was changed.`,
    );
  }
  return { ...source, endpointHost: rw.host };
}

/**
 * Neon Auth's host for a branch, derived from the branch's *own* compute host.
 *
 * `neon env pull` writes `https://ep-winter-block-b4bkk1xc.neonauth.c-6.us-east-2.aws.neon.tech/neondb/auth`
 * for a compute host `ep-winter-block-b4bkk1xc.c-6.us-east-2.aws.neon.tech`: the endpoint id
 * stays, `.neonauth` replaces the region's first label, and the auth endpoints hang off
 * `/<database>/auth`. Deriving it from the endpoint of the branch we just reset is what keeps a
 * shell that exported the production `NEON_AUTH_BASE_URL` from creating demo accounts in
 * production — the value in the environment is overwritten, never inherited.
 */
function authBaseUrlFor(endpointHost, database) {
  const [endpointId, ...region] = endpointHost.split(".");
  if (endpointId === undefined || region.length === 0) {
    throw new Error(`cannot derive an auth host from endpoint "${endpointHost}"`);
  }
  return `https://${endpointId}.neonauth.${region.join(".")}/${database}/auth`;
}

/**
 * Resets the branch to the source's head — the single operation.
 *
 * `POST /projects/{p}/branches/{b}/restore` with `source_branch_id` = the resolved source and no
 * LSN or timestamp is "restore to the source's head", i.e. `neon branches restore <branch>
 * <source>`. The source does not have to be the branch's parent: the API restores from any branch
 * in the project, which is what lets a demo whose parent cannot be changed restore from the
 * schema-only base. The API answers with operations; the reset is not done until the last one
 * reports `finished`, which is why this waits instead of returning on a 200.
 */
async function restoreFromSource(projectId, branch, source) {
  const started = await neon("POST", `/projects/${projectId}/branches/${branch.id}/restore`, {
    source_branch_id: source.id,
  });

  const operations = started?.operations ?? [];
  if (operations.length === 0) {
    return { operations: 0, waitedMs: 0 };
  }

  const deadline = Date.now() + OPERATION_TIMEOUT_MS;
  const t0 = Date.now();
  const pending = new Map(operations.map((operation) => [operation.id, operation.action]));
  let lastError = null;

  while (pending.size > 0) {
    if (Date.now() > deadline) {
      throw new Error(
        `the reset is still running after ${Math.round(OPERATION_TIMEOUT_MS / 1000)}s (${[...pending.entries()].map(([id, action]) => `${action}:${id}`).join(", ")}) — it will finish on its own; re-run to confirm`,
      );
    }
    await delay(500);
    for (const [id, action] of [...pending]) {
      const operation = (await neon("GET", `/projects/${projectId}/operations/${id}`)).operation;
      if (operation?.status === "finished") {
        pending.delete(id);
      } else if (
        operation?.status === "failed" ||
        operation?.status === "error" ||
        operation?.status === "cancelled"
      ) {
        pending.delete(id);
        lastError = `${action} ${operation.status}${operation.error ? ` — ${operation.error}` : ""}`;
      }
    }
  }

  if (lastError !== null) throw new Error(`the reset failed: ${lastError}`);
  return { operations: operations.length, waitedMs: Date.now() - t0 };
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ------------------------------------------------------------------ *\
 * Counts — read from the branch, never assumed
 * ------------------------------------------------------------------ */
/**
 * The counts #185 reports on. Each one is optional: a branch that diverged before a migration
 * (the demo branch itself was three migrations behind when this card started) has no
 * `demo_account` table, and the before/after report must survive that rather than fail on it.
 */
function countQueries() {
  return [
    ["record", "SELECT count(*)::int AS n FROM record"],
    ["assessment record", "SELECT count(*)::int AS n FROM record WHERE record_type = 'assessment'"],
    ["item", "SELECT count(*)::int AS n FROM item"],
    ["response_option", "SELECT count(*)::int AS n FROM response_option"],
    ["session", "SELECT count(*)::int AS n FROM session"],
    ["relationship", "SELECT count(*)::int AS n FROM relationship"],
    ["party", "SELECT count(*)::int AS n FROM party"],
    ["party (bound to a user)", "SELECT count(*)::int AS n FROM party WHERE user_id IS NOT NULL"],
    ["opinion", "SELECT count(*)::int AS n FROM opinion"],
    ["user_profile", "SELECT count(*)::int AS n FROM user_profile"],
    ["demo_account", "SELECT count(*)::int AS n FROM demo_account"],
    [
      "platform admin",
      "SELECT count(*)::int AS n FROM user_profile WHERE role = 'admin' AND user_id NOT IN (SELECT user_id FROM demo_account)",
    ],
    ["neon_auth user", 'SELECT count(*)::int AS n FROM neon_auth."user"'],
  ];
}

/** The six tables the seed writes, in the bundle's own terms — the comparison that matters. */
const BUNDLE_KEYS = {
  record: (payload) => payload.templates.length + payload.instances.length,
  item: (payload) =>
    [...payload.templates, ...payload.instances].reduce(
      (total, record) => total + record.items.length,
      0,
    ),
  response_option: (payload) =>
    [...payload.templates, ...payload.instances].reduce(
      (total, record) =>
        total +
        record.items.reduce(
          (count, item) => count + (item.scale.kind === "options" ? item.scale.options.length : 0),
          0,
        ),
      0,
    ),
  session: (payload) => payload.instances.length,
  relationship: (payload) => payload.instances.length,
  party: (payload) =>
    payload.instances.reduce((total, instance) => total + instance.parties.length, 0),
  opinion: (payload) =>
    payload.instances.reduce(
      (total, instance) =>
        total + instance.parties.reduce((count, party) => count + party.opinions.length, 0),
      0,
    ),
};

/** Label in the report → key in `BUNDLE_KEYS` and in the DB count map. */
const COMPARED = [
  ["record", "record"],
  ["item", "item"],
  ["response_option", "response_option"],
  ["session", "session"],
  ["relationship", "relationship"],
  ["party", "party"],
  ["opinion", "opinion"],
];

/** Connects, retrying: after a reset the compute may be starting, and a refusal is not a result. */
async function connect(connectionString, applicationName) {
  const deadline = Date.now() + CONNECT_TIMEOUT_MS;
  let lastError = null;
  while (Date.now() < deadline) {
    const client = new Client({ connectionString, application_name: applicationName });
    try {
      await client.connect();
      return client;
    } catch (error) {
      lastError = error;
      await client.end().catch(() => {});
      await delay(2000);
    }
  }
  throw new Error(
    `could not connect within ${Math.round(CONNECT_TIMEOUT_MS / 1000)}s: ${lastError?.message ?? "no error"}`,
  );
}

async function counts(connectionString) {
  const client = await connect(connectionString, "demo-reset");
  try {
    const values = {};
    for (const [label, sql] of countQueries()) {
      try {
        values[label] = (await client.query(sql)).rows[0].n;
      } catch (error) {
        values[label] = `n/a (${error.message.split("\n")[0]})`;
      }
    }
    return values;
  } finally {
    await client.end();
  }
}

/** The demo bundle's own numbers, read through the importer's reader (B1–B6). */
async function bundleCounts() {
  // `content/bundle.ts` imports its siblings extensionless (`./assessment`), which the app, the
  // gate and vitest all resolve and node's own ESM resolver does not. `scripts/ts-resolver.mjs`
  // supplies exactly that rule; registering it here is what lets `node scripts/demo-reset.mjs` —
  // the invocation the issue, the workflow and the docs use — run without a `--import` flag.
  if (!resolverRegistered) {
    register("./ts-resolver.mjs", import.meta.url);
    resolverRegistered = true;
  }

  const { parseBundle, formatBundleIssue } = await import("../content/bundle.ts");
  const parsed = parseBundle(readFileSync(new URL(`../${BUNDLE}`, import.meta.url), "utf8"));
  if (!parsed.ok) {
    throw new Error(
      `${BUNDLE} does not parse as a bundle:\n  ${parsed.issues.map(formatBundleIssue).join("\n  ")}`,
    );
  }
  if (parsed.bundle.kind !== "dataset") {
    throw new Error(
      `${BUNDLE} is a "${parsed.bundle.kind}" bundle; the demo dataset must be a dataset`,
    );
  }
  const payload = parsed.bundle.payload;
  const expected = {};
  for (const [key, count] of Object.entries(BUNDLE_KEYS)) expected[key] = count(payload);
  return { expected, appVersion: parsed.bundle.appVersion, path: BUNDLE };
}

/* ------------------------------------------------------------------ *\
 * The demo's content: the bundle, and nothing else
 * ------------------------------------------------------------------ */

/**
 * Empties the demo branch's content and its accounts, in **one transaction**, so a reseed-only run
 * installs the bundle into a branch that holds nothing else.
 *
 * This used to run on every reset, because the restore brought the live parent's rows with it.
 * Since the source became the schema-only base (`demo-base`), the restore lands on a branch with no
 * rows at all — production data can no longer enter the demo, so the normal path empties nothing.
 * The function survives for the one path that cannot use the restore: `--skip-reset` (reseed only)
 * leaves whatever the previous reseed wrote in place, and a reseed on top of a branch that already
 * holds rows is not the demo's content contract ("the bundle and the three accounts, nothing
 * else"). The SQL is unchanged: this is the reseed-only guard, not a step of the reset.
 *
 * Why it is here and not in `db-seed`: `db-seed` refuses rows it does not author ("record holds
 * assessment row(s) this seed does not author"), and on the **production** branch that refusal is
 * the right rule — a row someone meant is not silently deleted. On the demo branch the contract is
 * the opposite one, so the removal belongs to the demo script, never to the seed.
 *
 * Nothing is truncated: `DELETE` in dependency order, inside one `BEGIN … COMMIT`, so the schema
 * and every foreign key stay exactly as the migration left them, and a failure rolls back to the
 * state the branch was in when the run started.
 */
async function resetContent(connectionString) {
  const client = await connect(connectionString, "demo-reset:content");
  const removed = {};
  try {
    await client.query("BEGIN");

    const tableExists = async (qualified) =>
      (await client.query("SELECT to_regclass($1) IS NOT NULL AS present", [qualified])).rows[0]
        .present;

    // Dependency order: opinion → party → session_invite → session → relationship_member /
    // coach_invite → relationship → item (cascades response_option) → record.
    // `session.template_record_id` and `relationship.template_id` have no ON DELETE CASCADE, so
    // the session and relationship rows have to go before the records they name — and the session
    // before the relationship it belongs to (`session.relationship_id` is NOT NULL with an FK).
    // Membership and coach invites reference `relationship` (CASCADE), so they go before it.
    const statements = [
      ["opinion", "public.opinion", "DELETE FROM opinion"],
      ["party", "public.party", "DELETE FROM party"],
      ["session_invite", "public.session_invite", "DELETE FROM session_invite"],
      ["session", "public.session", "DELETE FROM session"],
      ["relationship_member", "public.relationship_member", "DELETE FROM relationship_member"],
      ["coach_invite", "public.coach_invite", "DELETE FROM coach_invite"],
      ["relationship", "public.relationship", "DELETE FROM relationship"],
      ["item", "public.item", "DELETE FROM item"],
      ["response_option", "public.response_option", "DELETE FROM response_option"],
      ["record", "public.record", "DELETE FROM record"],
      ["user_profile", "public.user_profile", "DELETE FROM user_profile"],
      ["demo_account", "public.demo_account", "DELETE FROM demo_account"],
    ];

    for (const [label, qualified, sql] of statements) {
      if (!(await tableExists(qualified))) {
        removed[label] = "n/a (table absent)";
        continue;
      }
      removed[label] = (await client.query(sql)).rowCount ?? 0;
    }

    // Neon Auth's own rows (`neon_auth`), so the demo's accounts are the three the seed creates
    // and no other sign-in survives. `session`, `account`, `member` and `invitation` cascade
    // from `user`.
    const authUsers = (
      await client.query(
        `SELECT table_name FROM information_schema.tables
          WHERE table_schema = 'neon_auth' AND table_name IN ('user', 'users')`,
      )
    ).rows[0]?.table_name;
    removed["auth user"] =
      authUsers === undefined
        ? "n/a (schema absent)"
        : ((await client.query(`DELETE FROM neon_auth."${authUsers}"`)).rowCount ?? 0);

    await client.query("COMMIT");
    return removed;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

/* ------------------------------------------------------------------ *\
 * Reporting
 * ------------------------------------------------------------------ */

function printCounts(title, values) {
  step(title);
  for (const [label] of countQueries()) {
    const value = values?.[label];
    say(`  ${label.padEnd(28)} ${value === undefined ? "?" : String(value)}`);
  }
}

/**
 * The bundle is the file the demo claims to be; the branch is what it actually holds. Comparing
 * the two is the only way "the reseed worked" is a fact rather than a feeling — and it is a
 * comparison against the authored file, not against the numbers the seed just printed.
 */
function printBundleComparison(afterSeed, expected) {
  step(`the seeded rows against ${BUNDLE}`);
  let mismatches = 0;
  for (const [label, key] of COMPARED) {
    const actual = afterSeed[label];
    const want = expected[key];
    const ok = actual === want;
    if (!ok) mismatches += 1;
    say(
      `  ${label.padEnd(28)} ${String(actual).padEnd(6)} bundle says ${want}${ok ? "" : "   ← MISMATCH"}`,
    );
  }
  return mismatches;
}

/* ------------------------------------------------------------------ *\
 * Steps
 * ------------------------------------------------------------------ */

/**
 * Applies `db/migrations` to the source branch, before anything is restored from it.
 *
 * The base is schema-only by contract, and a schema-only branch still drifts: every later
 * migration is a table or column the demo would silently lack, because the restore copies
 * whatever schema the base had at the moment it was cut. `db:migrate` is idempotent and ledgered
 * (`schema_migrations`), so running it on every reset is the cheap fix and the ledger in the run
 * log is the evidence it ran.
 *
 * `DATABASE_URL_UNPOOLED` is set to the *source's* direct URI (resolved and checked by
 * `prepareSource`) and inherited by the child process; `scripts/load-env.mjs` does not override an
 * already-set variable, so a `.env.local` pointing at production cannot win here. A failed
 * migration throws before the restore, which is what leaves the demo untouched.
 */
async function migrateSource({ branch, source }) {
  step(`migrate ${source.name} (${source.id}) — db:migrate is idempotent and ledgered`);
  say(`  database  ${source.database} on ${source.endpointHost}`);
  say(`  migrate   node ${MIGRATE}`);

  const result = spawnSync(
    process.execPath,
    ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", MIGRATE],
    {
      cwd: repoRoot,
      env: { ...process.env, DATABASE_URL_UNPOOLED: source.connectionStrings.direct },
      stdio: "inherit",
    },
  );

  if (result.error) throw new Error(`could not run ${MIGRATE}: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(
      `${MIGRATE} exited ${result.status ?? result.signal} on ${source.name} — the restore has not run, so ${branch.name} is untouched; fix the failing migration and re-run`,
    );
  }
  return source;
}

function reseed({ branch, connectionStrings, authBaseUrl, database, resetRan }) {
  step(`reseed ${branch.name} from ${BUNDLE}`);
  say(`  database  ${database} on ${branch.endpointHost}`);
  say(`  auth      ${authBaseUrl}`);
  say(`  seed      node ${SEED} (DEMO_AUTH=1)`);

  const environment = {
    ...process.env,
    // The branch this script resolved, not the branch a shell happened to export.
    DATABASE_URL: connectionStrings.pooled,
    DATABASE_URL_UNPOOLED: connectionStrings.direct,
    NEON_AUTH_BASE_URL: authBaseUrl,
    NEON_BRANCH: branch.name,
    DEMO_AUTH: "1",
  };

  const result = spawnSync(
    process.execPath,
    [
      "--import",
      "./scripts/ts-modules.mjs",
      "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
      SEED,
    ],
    {
      cwd: repoRoot,
      env: environment,
      stdio: "inherit",
    },
  );

  if (result.error) throw new Error(`could not run ${SEED}: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(
      resetRan
        ? `${SEED} exited ${result.status ?? result.signal} — the reset landed, the reseed did not`
        : `${SEED} exited ${result.status ?? result.signal} — the branch was not reset; re-run with the reset to rebuild it from its source`,
    );
  }
}

async function main() {
  // Arguments first, so `--help` and a usage error work without a credential: the help text is
  // documentation, and a script that hides it behind a secret is a script people stop reading.
  const options = parseArgs(process.argv.slice(2));

  if ((process.env.NEON_API_KEY ?? "").trim() === "") {
    say("demo:reset — NEON_API_KEY is not set.");
    say("");
    say("  Create a project-scoped API key (Neon console → Project settings → API keys) and run:");
    say("    NEON_API_KEY=napi_… node scripts/demo-reset.mjs");
    say("");
    say("  In CI the key is the repository secret of the same name; the workflow skips, green,");
    say("  while it is absent (see .github/workflows/demo-reset.yml).");
    process.exit(3);
  }

  const t0 = Date.now();

  const project = await resolveProject(options.project);
  progress.projectId = project.id;
  progress.branchName = options.branch;

  let branch = await resolveBranch(project.id, options.branch);
  assertTargetResettable(branch);
  let source = await resolveSource(project.id, branch, options.source);
  assertSourceResettable(branch, source);

  // The source is resolved and checked once, before anything is written: the migrate step writes
  // to it, the restore copies it, and a source that cannot supply a working demo (no auth
  // configuration) must be a refusal rather than an empty branch discovered one step later. A
  // `--skip-reset` run never reads the source, so it has nothing to check.
  let prepared = null;
  if (!options.skipReset) {
    prepared = await prepareSource(project.id, source, branch.name);
  }

  const { database, role } = await resolveDatabaseAndRole(project.id, branch);
  progress.database = database;
  progress.role = role;
  let connectionStrings = await resolveConnectionStrings(project.id, branch, database, role);
  let authBaseUrl = authBaseUrlFor(branch.endpointHost, database);

  // The one identity check that matters: the URL we will write through is the branch we
  // resolved, by host. A typo in a name cannot silently land on another branch's compute.
  if (!connectionStrings.direct.includes(branch.endpointHost)) {
    throw new Error(
      `the connection string the API returned does not address ${branch.endpointHost} — refusing to write`,
    );
  }

  say(`demo:reset — project ${project.name} (${project.id})`);
  say(`  branch    ${branch.name} (${branch.id})`);
  say(
    `  source    ${source.name} (${source.id}) — ${source.requested ? "DEMO_SOURCE_BRANCH" : "the branch's parent"}`,
  );
  say(`  compute   ${branch.endpointHost}`);
  say(
    `  steps     ${
      options.skipReset
        ? "reseed only (the branch is emptied first)"
        : `migrate ${source.name}${options.skipMigrate ? " (--skip-migrate)" : ""} → restore from source`
    } → ${options.skipSeed ? "nothing" : "reseed from the bundle"}`,
  );

  if (options.dryRun) {
    const before = await counts(connectionStrings.direct);
    printCounts("counts now (--dry-run: nothing will change)", before);
    say("\n✓ demo:reset — dry run, nothing was changed");
    return;
  }

  const before = await counts(connectionStrings.direct);
  printCounts("before", before);

  if (!options.skipReset) {
    // The source first: a base that is three migrations behind restores a schema the app no
    // longer matches, and the reseed would fail on tables the base does not have. This writes to
    // the source, never to the demo, so it cannot touch what visitors see — and if it fails the
    // restore below never runs, which is why a failed migration leaves the demo exactly as it was.
    if (options.skipMigrate) {
      step(`migrate ${source.name} — skipped (--skip-migrate: the source's ledger is trusted)`);
    } else {
      await migrateSource({ branch, source: prepared });
    }

    step(`reset ${branch.name} from ${source.name} (one restore, not a delete)`);
    const reset = await restoreFromSource(project.id, branch, source);
    say(
      `  reset ${reset.operations === 0 ? "accepted with no operations" : `finished after ${(reset.waitedMs / 1000).toFixed(1)}s (${reset.operations} operation(s))`}`,
    );

    // The endpoint can be replaced by the reset; everything after this point re-resolves it.
    const after = await resolveBranch(project.id, branch.name);
    if (after.id !== branch.id) {
      warn(
        `the branch id changed across the reset: ${branch.id} → ${after.id} (re-point the deployment at the new host)`,
      );
    }
    if (after.endpointHost !== branch.endpointHost) {
      warn(
        `the compute host changed across the reset: ${branch.endpointHost} → ${after.endpointHost}`,
      );
    }
    branch = after;
    assertTargetResettable(branch);
    source = await resolveSource(project.id, branch, options.source);
    assertSourceResettable(branch, source);
    progress.branchId = branch.id;
    connectionStrings = await resolveConnectionStrings(project.id, branch, database, role);
    authBaseUrl = authBaseUrlFor(branch.endpointHost, database);
  }

  const afterReset = await counts(connectionStrings.direct);
  printCounts(
    options.skipReset
      ? "unchanged (--skip-reset)"
      : "after the reset (the schema-only source holds no rows — zeros are the point)",
    afterReset,
  );

  if (!options.skipSeed) {
    // The normal path needs no emptying: the restore landed on the base, which holds no rows, so
    // the branch is already the bundle-and-nothing-else shape before the reseed. Only the
    // reseed-only path has to clear the branch, because it never restores it.
    if (options.skipReset) {
      step(
        `empty ${branch.name} — reseed only, so the branch must hold the bundle and nothing else`,
      );
      const removed = await resetContent(connectionStrings.direct);
      for (const [label, count] of Object.entries(removed)) {
        say(`  ${label.padEnd(28)} ${String(count)} removed`);
      }
      printCounts("after emptying (before the reseed)", await counts(connectionStrings.direct));
    }

    reseed({
      branch,
      connectionStrings,
      authBaseUrl,
      database,
      resetRan: !options.skipReset,
    });
  }

  const afterSeed = await counts(connectionStrings.direct);
  printCounts("after the reseed", afterSeed);

  const bundle = await bundleCounts();
  let mismatches = printBundleComparison(afterSeed, bundle.expected);

  // The accounts are the seed's own half of the demo; the bundle says nothing about them. The
  // invariant that holds them to the file is structural: one credential, one profile, one auth
  // user per demo account — no more (a leftover copy of the source's users) and no fewer — plus
  // the platform admins the seed adds from `ADMIN_*`, which are the difference between the demo
  // row count and the profile/auth-user counts.
  const accountsAgree =
    typeof afterSeed.demo_account === "number" &&
    afterSeed.demo_account > 0 &&
    typeof afterSeed["platform admin"] === "number" &&
    afterSeed["neon_auth user"] === afterSeed.user_profile &&
    afterSeed.user_profile === afterSeed.demo_account + afterSeed["platform admin"];
  if (!accountsAgree) mismatches += 1;

  step("verdict");
  say(`  bundle      ${bundle.path} (appVersion ${bundle.appVersion})`);
  say(
    `  source      ${
      options.skipReset
        ? "unchanged (--skip-reset: nothing was restored)"
        : `${source.name}${source.requested ? " (DEMO_SOURCE_BRANCH)" : " (the branch's parent)"}${options.skipMigrate ? " — ledger trusted, --skip-migrate" : " — migrated, then restored"}`
    }`,
  );
  say(`  reset       ${options.skipReset ? "skipped" : `restore from source ${source.name}`}`);
  say(
    `  emptied     ${
      options.skipSeed
        ? "skipped (--skip-seed)"
        : options.skipReset
          ? "the reseed-only path, in one transaction"
          : "not needed — the source holds no rows"
    }`,
  );
  say(
    `  row-set     ${mismatches === 0 ? "matches the bundle" : `${mismatches} count(s) do not match the bundle`}`,
  );
  say(
    `  accounts    ${afterSeed.demo_account} demo account(s) + ${afterSeed["platform admin"]} platform admin(s) — ${accountsAgree ? "one profile and one auth user each" : "INCONSISTENT with the seed's accounts"}`,
  );
  say(`  elapsed     ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  if (mismatches > 0) {
    throw new Error(`${mismatches} table(s) do not match ${BUNDLE} after the reseed`);
  }
  say(`\n✓ demo:reset — ${branch.name} reset and reseeded from ${BUNDLE}`);
}

/* ------------------------------------------------------------------ *\
 * Entry
 * ------------------------------------------------------------------ */

/**
 * What has been resolved so far, so the failure path can report the branch's state without
 * re-deriving it from the environment (a `--branch` flag is not an environment variable).
 */
const progress = { projectId: null, branchName: null, branchId: null, database: null, role: null };

main().catch(async (error) => {
  console.error(`\n✗ demo:reset failed: ${error.message}`);

  // A failed reset is not a dead branch: say what it holds now, so the next person does not
  // have to guess whether the demo is serving something valid. A refusal never touched the
  // branch — it is raised before the first write — so there is nothing to report.
  if (!(error instanceof Refused) && progress.projectId !== null && progress.branchName !== null) {
    try {
      const branch = await resolveBranch(progress.projectId, progress.branchName);
      const { database, role } = await resolveDatabaseAndRole(progress.projectId, branch);
      const strings = await resolveConnectionStrings(progress.projectId, branch, database, role);
      const state = await counts(strings.direct);
      printCounts("the branch after the failure (still serving, reported not repaired)", state);
    } catch (reportError) {
      console.error(`  (the branch state could not be read: ${reportError.message})`);
    }
  }

  process.exit(error.exitCode ?? 1);
});
