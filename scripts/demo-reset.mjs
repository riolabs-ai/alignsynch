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
 *      **A branch with children needs `preserve_under_name`, and that is a defect this script had.**
 *      The API refuses a restore of a branch that has children unless the body says where to
 *      preserve its state (`422 — Branch has children, preserve_under_name is required`), which is
 *      what the nightly run answered until `demo-restore-plan.mjs` supplied it. The parameter
 *      creates a preserved branch holding this branch's pre-reset state and moves every child under
 *      it, so the branch this run restores comes out with no children and the next run sends the
 *      plain body. The preserved branch is a real branch — one against the project's limit and the
 *      storage its rows occupy, no compute — and it is a **recovery point**, so the reset never
 *      deletes the newest one. It does bound the set: `scripts/demo-branch-prune.mjs` keeps the
 *      newest preserved state per parent plus anything younger than
 *      `DEMO_PRESERVED_MAX_AGE_DAYS` (7) and retires the rest **before** the restore is sent
 *      (#909). Without that bound the reset's own recovery points filled the project's ten
 *      branches and the plain restore died on `422 — branches limit exceeded` on two consecutive
 *      nights (`99eedaba`, `7a531b43`): a restore needs one free branch slot even when it preserves
 *      nothing, which run 43263203497 measured (`children none — the body carries no
 *      preserve_under_name`) and a raw 422 never said.
 *
 *   3. **Re-apply the branch's trusted origin.** Neon implements a restore as a branch *creation*
 *      (`scripts/demo-branch-prune.mjs` records the same fact about the branch slot), and the
 *      branch's Managed Auth **integration survives that while its trusted-domain list does not**.
 *      Measured on 2026-11-15 against the live project: `GET …/branches/<demo>/auth` answered 200
 *      with a `created_at` from 2026-10-30 both before and after a reset, and in the same window
 *      `GET …/branches/<demo>/auth/domains` went from
 *      `[{"domain":"https://demo.alignsynch.com",…}]` to `{"domains":[]}`. The restore hands back a
 *      branch that is correct in every other way and whose auth server trusts no site, so every
 *      sign-in answers `403 INVALID_ORIGIN` — the origin is refused *before* any password is
 *      compared, which means no identity can enter the demo, admin seats included, while
 *      `/api/version` reads 200 and every gate stays green.
 *
 *      **So the origin is re-applied, not assumed**: one `GET` of the list, and one `POST` of
 *      `{domain, auth_provider: "better_auth"}` only when the origin is not already in it. The
 *      origin is `DEMO_ORIGIN` (default `https://demo.alignsynch.com`) and it is validated before
 *      anything is written — a bare `https` origin, no wildcard, no path
 *      (`scripts/demo-auth-domains.mjs`). The list is never widened, never replaced and never
 *      trimmed: an auth server that trusts any origin is a phishing surface wearing a test badge,
 *      and a repair that rewrites somebody else's entry is a second defect.
 *
 *      This step runs **before** the reseed on purpose. The seed creates its accounts through the
 *      branch's own sign-up endpoint with `Origin: $DEMO_ORIGIN`, so on a branch whose list was
 *      just emptied it would be creating them from an untrusted origin. (Loopback is implicitly
 *      trusted, which is why a local run has never shown this.)
 *
 *      **Because it runs after the restore, it is also the step that can destroy the demo**, and it
 *      has done: measured twice on 2026-11-15, `demo:reset` restored the branch from `demo-base`,
 *      answered `500 AUTH_FAILURE` on this call, and left the demo **empty** behind a deployment
 *      still answering 200. The `500` is the branch's auth server not being ready for the
 *      integration call in the seconds after a restore — a manual `GET` twenty seconds later
 *      answered 200 — so two things follow, and both are this step's:
 *
 *      3a. **It is retried.** `ORIGIN_ATTEMPTS` (5) attempts, `2s → 4s → 8s → 16s` backoff, a
 *          45s ceiling for the whole step, and only a `5xx` or a fetch that never answered is
 *          retried. A `4xx` — a bad shape, a refused key, a branch with no integration — is a fact
 *          and fails at once. Every attempt is printed with its status and elapsed time.
 *      3b. **A failure no longer leaves the branch empty.** The run takes a **recovery point** (a
 *          `<branch>-preserved-<stamp>` branch holding exactly the pre-reset state) immediately
 *          before the restore; if every attempt fails, it restores the branch from that point, reads
 *          the counts back against the pre-reset census, and exits non-zero. A failed reset ends
 *          where it started. The point is deleted once the run converges, and the preserved-branch
 *          policy (`scripts/demo-branch-prune.mjs`) retires one that was not.
 *
 *   4. **Reseed from the bundle.** `scripts/db-seed.mjs` with `DEMO_AUTH=1`, pointed at *this
 *      branch's* connection string and *this branch's* auth host. The seed reads
 *      `data/bundles/demo-dataset.alignsynch.json` as the bundle it is (asserting it is still
 *      the canonical export), writes the six content tables, and creates the three demo
 *      accounts through the branch's own sign-up endpoint. None of that logic is copied here:
 *      a second writer would be a second definition of "seeded".
 *
 *   5. **Prove sign-in works, and fail if it does not.** One probe, in this run's own output: a
 *      `POST` to the branch's `/sign-in/email` with `Origin: $DEMO_ORIGIN` and a **deliberately
 *      wrong** credential for an address that cannot exist (`origin-probe@…invalid`). Only
 *      `401 INVALID_EMAIL_OR_PASSWORD` passes: the origin has been accepted by the time the server
 *      compares a credential, so a 401 proves the site is trusted without any real credential ever
 *      being handled — and no seat is the subject of a failed sign-in. A `403` **fails the run**
 *      with a named error, because "the branch came back" is not a reset: a branch that answers
 *      403 on sign-in is not a working demo, whatever the row counts say. A `429`/`5xx` is retried
 *      once and then fails too — an inconclusive probe is not a pass, and the nightly job must not
 *      report success for something it could not establish.
 *
 *      A probe from a **loopback** `DEMO_ORIGIN` proves nothing, because Neon Auth trusts
 *      `http://localhost:*` implicitly on a branch whose list is empty (measured: an empty list
 *      answers 401 for `http://localhost:3000` and 403 for the demo origin). The run says so
 *      rather than banking the 401.
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
 * - **A project with no free branch slot.** A restore spends one, so a project at its ceiling is
 *   refused *before* `db:migrate` writes anything, in words that name the branches holding the
 *   slots — never with the API's raw `422 — branches limit exceeded`. The pre-flight runs the
 *   preserved-branch policy first (`demo-branch-prune.mjs`), so the refusal is what is left after
 *   everything the policy sanctions has been retired.
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
 * - **A `DEMO_ORIGIN` that is not one exact origin.** A wildcard, a path, a query, a credential in
 *   the URL, or plain `http` on a public host is refused before anything is written, because the
 *   trusted-domain list is a phishing surface the moment it is wider than the demo's own site.
 * - **A branch with no Managed Auth integration.** The origin list hangs off the integration, so a
 *   branch without one is named (`GET …/auth/domains` answered 404) rather than repaired by
 *   inventing configuration — enabling Neon Auth is a decision, not a retry.
 *
 * ## What it prints
 *
 * Row counts before the reset, after the reset, and after the reseed; then the same six counts
 * derived from the bundle and compared; then the two rules #185 asks about — the write made
 * between two resets is gone, and two consecutive runs converge. With a schema-only source the
 * after-reset block reads **zeros**, and that block is the evidence the source carries no rows.
 * The re-applied origin is printed with the list it found and the list it now carries, and the
 * sign-in probe is printed with its status — `○` 401 proved, `!` 403 refused, `?` unproven — so
 * "the demo is enterable" is a line in the log rather than an assumption behind the row counts.
 * On a failure it prints the branch's state *after* the failure and exits non-zero: a failed
 * reset leaves a branch that still serves, and saying what it holds is part of the job.
 *
 * Usage:
 *   NEON_API_KEY=… node scripts/demo-reset.mjs                 # migrate, reset + reseed `demo`
 *   NEON_API_KEY=… node scripts/demo-reset.mjs --dry-run       # resolve and print, change nothing
 *   NEON_API_KEY=… node scripts/demo-reset.mjs --skip-migrate  # trust the base's ledger
 *   NEON_API_KEY=… node scripts/demo-reset.mjs --skip-seed     # migrate + reset only
 *   NEON_API_KEY=… node scripts/demo-reset.mjs --skip-reset    # reseed only (empties first)
 *   NEON_API_KEY=… node scripts/demo-reset.mjs --verify-origin # re-apply + prove, reset nothing
 *   NEON_API_KEY=… node scripts/demo-reset.mjs --probe-origin https://alignsynch.com  # probe only
 *   NEON_API_KEY=… node scripts/demo-reset.mjs --fail-origin-once    # prove the retry (test only)
 *   NEON_API_KEY=… node scripts/demo-reset.mjs --fail-origin-always  # prove the restore-back (test only)
 *
 * Flags: --branch <name> (default `demo`), --source <name> (default `$DEMO_SOURCE_BRANCH`, else
 * the branch's parent), --project <id> (default: the only project the key can see), --dry-run,
 * --skip-migrate, --skip-reset, --skip-seed, --verify-origin, --probe-origin <origin>,
 * --fail-origin-once, --fail-origin-always, --help.
 *
 * `--fail-origin-once` and `--fail-origin-always` are **test-only**: they answer the trusted-origin
 * step with the synthetic `500 AUTH_FAILURE` the live API answered in the seconds after a restore,
 * so the retry and the restore-back are both provable without waiting for an outage. They are
 * switches and not environment variables because an environment variable is a production knob.
 *
 * `--verify-origin` is the maintenance run: it re-applies the origin and probes it, and touches
 * nothing else, so the repair after a hand-made reset is one command instead of a remembered curl.
 * `--probe-origin <origin>` changes nothing at all — it asks the branch whether it trusts a given
 * origin, which is how the `403` failure path is demonstrated without breaking the live demo.
 *
 * `DEMO_SOURCE_BRANCH` is how the demo restores from `demo-base` while its own parent is still
 * `production`: Neon does not allow a branch to be re-parented, so the source is named instead of
 * inherited. Pointing it at `production` is refused, by id.
 *
 * `DEMO_BRANCH_LIMIT` (default 10, the project's plan), `DEMO_PRESERVED_MAX_AGE_DAYS` (default 7)
 * and `DEMO_KEEP_BRANCHES` (comma- or space-separated names the prune must never delete) tune the
 * branch-ceiling pre-flight; the policy itself is in `scripts/demo-branch-prune.mjs`.
 *
 * Exit: 0 the demo is reset and seeded · 1 a step failed (the state is reported) · 2 usage or
 * a refused target · 3 `NEON_API_KEY` is not set.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { register } from "node:module";
import { Client } from "pg";
import { repoRoot } from "./load-env.mjs";
import {
  branchLimit,
  capacityRefusal,
  KIND,
  keepList,
  preservedMaxAgeDays,
  prunePlan,
  prunePreservedBranches,
} from "./demo-branch-prune.mjs";
import { sourceRefusal } from "./demo-source-guard.mjs";
import { preservedUnderName, restoreRequest } from "./demo-restore-plan.mjs";
import {
  AUTH_PROVIDER,
  attemptTrace,
  authDomainsPath,
  DEFAULT_DEMO_ORIGIN,
  domainPlan,
  isLoopbackOrigin,
  ORIGIN_ATTEMPTS,
  ORIGIN_RETRY_CEILING_MS,
  originRefusal,
  PROBE_EMAIL,
  PROBE_PASSWORD,
  probeFailure,
  probeLine,
  retryOriginStep,
  trustedOrigins,
} from "./demo-auth-domains.mjs";

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
                                [--verify-origin] [--probe-origin <origin>]
                                [--fail-origin-once | --fail-origin-always]

  --branch <name>   the branch to reset (default: demo)
  --source <name>   the branch to restore from (default: $DEMO_SOURCE_BRANCH, else the branch's parent)
  --project <id>    the Neon project (default: $NEON_PROJECT_ID, else the only project the key sees)
  --dry-run         resolve the branch and print the plan; change nothing
  --skip-migrate    do not apply db/migrations to the source branch first
  --skip-reset      reseed without resetting (the branch is emptied first)
  --skip-seed       reset without reseeding
  --verify-origin   re-apply the branch's trusted origin and prove sign-in; reset and reseed nothing
  --probe-origin    ask the branch whether it trusts <origin>; change nothing at all

  --fail-origin-once    TEST ONLY — answer the first trusted-origin attempt with a synthetic 500
  --fail-origin-always  TEST ONLY — answer every trusted-origin attempt with a synthetic 500

The branch's trusted-domain list is branch configuration that a restore does not preserve, so a
completed reset re-applies DEMO_ORIGIN (default https://demo.alignsynch.com) to it and then proves
sign-in from that origin with a deliberately wrong credential. A 403 fails the run: a branch that
refuses the site is not a reset demo, whatever its row counts say.

That re-apply runs *after* the restore, so a failure in it would leave an emptied branch. It is
therefore attempted ${ORIGIN_ATTEMPTS} times with a 2s → 4s → 8s → 16s backoff inside a
${ORIGIN_RETRY_CEILING_MS / 1000}s ceiling, retrying only a 5xx or a fetch that never answered — a
4xx is a fact about the request and fails at once. If every attempt fails, the run restores the
branch from the recovery point it took before the restore (a <branch>-preserved-<stamp> branch
holding exactly the pre-reset state) and exits non-zero: a failed reset ends where it started, never
emptier than it began.

--fail-origin-once and --fail-origin-always inject the 500 the live API answered in the seconds
after a restore, so both paths are provable without an outage. They are switches rather than
environment variables on purpose: the nightly workflow never sets them.

The source is a branch name — \`DEMO_SOURCE_BRANCH=demo-base\`, or \`--source demo-base\` — and it
must be the schema-only base: a source that is the project's default branch is refused, because a
restore would copy live data onto the branch a public URL serves. With nothing named the branch's
own parent is used.

Before anything is written the project's branch ceiling is checked: a preserved branch that is not
the newest for its parent, or older than DEMO_PRESERVED_MAX_AGE_DAYS (7), is retired first; a
project still at its DEMO_BRANCH_LIMIT (10) is refused by name, listing the branches that hold the
slots. DEMO_KEEP_BRANCHES names branches the prune must never delete.

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
    verifyOrigin: false,
    probeOrigin: null,
    // Test-only: inject the 500 the live API answered in the seconds after a restore, so both the
    // retry and the restore-back are provable without waiting for an outage to happen again. A
    // switch rather than an environment variable, deliberately — the nightly workflow cannot set it
    // by accident, and a production run has no way to reach it.
    failOrigin: null,
  };
  /** Both switches name a different fault, so asking for both is a mistake rather than a last-win. */
  const failFlags = [];
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
      case "--verify-origin":
        options.verifyOrigin = true;
        break;
      case "--probe-origin":
        options.probeOrigin = next();
        break;
      case "--fail-origin-once":
        options.failOrigin = "once";
        failFlags.push(arg);
        break;
      case "--fail-origin-always":
        options.failOrigin = "always";
        failFlags.push(arg);
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
  if (failFlags.length > 1) {
    throw new Refused(
      "--fail-origin-once and --fail-origin-always inject two different faults — ask for one",
    );
  }
  // The injection lands in the trusted-origin step, so a run that does not write that step has
  // nothing for it to prove — and a `--dry-run` that fails on a simulated outage is a worse answer
  // than the plan it was asked for.
  if (options.failOrigin !== null && (options.dryRun || options.probeOrigin !== null)) {
    throw new Refused(
      "--fail-origin-once and --fail-origin-always inject a failure into the trusted-origin step, which --dry-run and --probe-origin do not run — use them on a reset, or with --verify-origin",
    );
  }
  if (options.skipReset && options.skipSeed) {
    throw new Refused("--skip-reset and --skip-seed together are a no-op");
  }
  // The two origin commands are their own runs: one repairs and proves, the other only asks.
  if (options.verifyOrigin && options.probeOrigin !== null) {
    throw new Refused("--verify-origin and --probe-origin are one command each, not a pair");
  }
  if (
    (options.verifyOrigin || options.probeOrigin !== null) &&
    (options.skipMigrate || options.skipReset || options.skipSeed)
  ) {
    throw new Refused(
      "--verify-origin and --probe-origin reset and reseed nothing, so --skip-migrate, --skip-reset and --skip-seed do not apply to them",
    );
  }
  return options;
}

/* ------------------------------------------------------------------ *\
 * The Neon API — fetch, no SDK, no CLI
 * ------------------------------------------------------------------ */

/**
 * One request. `NEON_API_KEY` goes in the header and nowhere else: never in a message, never in
 * a URL, never in a log line (an error from the API echoes the request, not the credential).
 *
 * `allow` is the set of statuses the caller reads for its meaning instead of as a failure — the
 * trusted-domain route answers `404` on a branch with no Neon Auth integration, and that is an
 * answer ("this branch has no integration") rather than a transport error. It is a list of numbers
 * rather than a boolean so a caller cannot accidentally accept a `500`.
 *
 * Every failure carries `status`: the number the server sent, or **`0` for a fetch that never
 * answered at all**. That one field is what lets the trusted-origin step tell a service that is not
 * ready (`5xx`, `0` — worth another attempt) from a request that is wrong (`4xx` — a fact, and the
 * retry loop in `demo-auth-domains.mjs` refuses to touch it).
 */
async function request(method, path, body, allow = []) {
  const key = process.env.NEON_API_KEY?.trim() ?? "";
  let response;
  try {
    response = await fetch(`${API}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${key}`,
        accept: "application/json",
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch (error) {
    const transport = new Error(
      `${method} ${path.split("?")[0]} got no HTTP answer — ${error.message}`,
    );
    transport.status = 0;
    transport.cause = error;
    throw transport;
  }

  const text = await response.text();
  let payload = null;
  try {
    payload = text === "" ? null : JSON.parse(text);
  } catch {
    payload = null;
  }

  if (!response.ok && !allow.includes(response.status)) {
    const detail = payload?.message ?? (text === "" ? "" : text.slice(0, 200));
    const failure = new Error(
      `${method} ${path.split("?")[0]} answered HTTP ${response.status}${detail ? ` — ${detail}` : ""}`,
    );
    failure.status = response.status;
    throw failure;
  }
  return { status: response.status, payload };
}

/** The body of one request, for every caller that only cares about a 2xx. */
async function neon(method, path, body) {
  return (await request(method, path, body)).payload;
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
  const branches = await listBranches(projectId);
  const branch = branches.find((candidate) => candidate.name === name);
  if (branch === undefined) {
    throw new Refused(
      `project ${projectId} has no branch named "${name}" (it has: ${branches.map((b) => b.name).join(", ") || "none"}). The reset only resets an existing branch — create it once (\`POST /projects/${projectId}/branches\` with "parent_id" of the default branch, or \`neon branches create\`) and re-run.`,
    );
  }

  const defaultBranch = branches.find((candidate) => candidate.default === true) ?? null;
  const children = branches.filter((candidate) => candidate.parent_id === branch.id);
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
    childCount: children.length,
    // Named, not counted: when the branch has children the restore has to preserve its state under
    // a name (see `demo-restore-plan.mjs`), and the run log should say which branches move.
    children: children.map(({ id, name: childName }) => ({ id, name: childName })),
    // Every branch name in the project — the preserved branch is a new branch, so the name picked
    // for it must not already be taken.
    allNames: branches.map((candidate) => candidate.name),
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

/** Every branch in the project — one page, the same read `resolveBranch` and the pre-flight do. */
async function listBranches(projectId) {
  return (await neon("GET", `/projects/${projectId}/branches?limit=1000`))?.branches ?? [];
}

/**
 * The refusal for a ceiling the pre-flight already predicted — computed from a *fresh* read, so a
 * slot that filled up between the two calls is described with the branches that hold it.
 */
async function capacityRefusalNow(projectId, branchName) {
  const plan = prunePlan({
    branches: await listBranches(projectId),
    now: new Date(),
    branchName,
    keep: keepList(),
    maxAgeDays: preservedMaxAgeDays(),
    ceiling: branchLimit(),
  });
  return capacityRefusal({
    branchName,
    count: plan.count,
    ceiling: plan.ceiling,
    prunable: plan.candidates,
    kept: plan.kept,
  });
}

/**
 * The branch-ceiling pre-flight, and the prune that keeps the reset's own recovery points from
 * filling the project (#909).
 *
 * A restore creates a branch, so it needs one free slot **even when it preserves nothing** — the
 * nightly run at ten of ten was answered `422 — branches limit exceeded` with a body that carried
 * no `preserve_under_name` at all (run 43263203497's log: `children none — the body carries no
 * preserve_under_name`). Two things follow, and this does both before anything is written: the
 * preserved-branch policy (`demo-branch-prune.mjs`) retires what it sanctions — a preserved state
 * that is not the newest for its branch, and any older than `DEMO_PRESERVED_MAX_AGE_DAYS` — and a
 * project that is still full is a **named** refusal: the count, the ceiling, the branches holding
 * the slots and why each was kept, never the API's raw 422 after `db:migrate` has already run.
 *
 * `--dry-run` deletes nothing: it prints the same plan and the count it would remove, then decides
 * capacity as if the deletes had happened, so a dry run answers "is tomorrow's run wedged?".
 *
 * `needed` is what this run has to fit, and the demo reset needs **two** free slots since #1090: one
 * for the restore itself and one for the pre-reset recovery point the restore is preceded by. A run
 * refused here has written nothing, which is the whole point of deciding it before `db:migrate`.
 */
async function preflightCapacity({ projectId, branch, dryRun, needed = 1 }) {
  const ceiling = branchLimit();
  const maxAgeDays = preservedMaxAgeDays();
  const plan = prunePlan({
    branches: await listBranches(projectId),
    now: new Date(),
    branchName: branch.name,
    keep: keepList(),
    maxAgeDays,
    ceiling,
  });

  step(
    `branch capacity — ${plan.count} branch(es), limit ${plan.ceiling}; this run needs ${needed} free slot(s)${
      needed > 1 ? " (the restore, and the pre-reset recovery point before it)" : ""
    }`,
  );
  for (const candidate of plan.candidates) {
    say(`  prune     ${candidate.name} — ${candidate.reason}`);
  }
  const keptBy = (kind) => plan.kept.filter((row) => row.kind === kind);
  for (const row of keptBy(KIND.newestPreserved)) {
    say(`  keep      ${row.name} — ${row.reason}`);
  }
  const core = [...keptBy(KIND.default), ...keptBy(KIND.core)];
  if (core.length > 0) {
    say(
      `  keep      ${core.length} core branch(es): ${core.map((row) => row.name).join(", ")} — never pruned`,
    );
  }
  const experiments = keptBy(KIND.experiment);
  if (experiments.length > 0) {
    say(
      `  keep      ${experiments.length} experiment branch(es): ${experiments.map((row) => row.name).join(", ")} — the owner's call, never this job's`,
    );
  }
  const listed = keptBy(KIND.keepList);
  say(
    `  keep      ${
      listed.length === 0
        ? "DEMO_KEEP_BRANCHES is empty — nothing else is kept by hand"
        : `${listed.length} named in DEMO_KEEP_BRANCHES: ${listed.map((row) => row.name).join(", ")}`
    }`,
  );
  const others = keptBy(KIND.notPreserved);
  if (others.length > 0) {
    say(
      `  keep      ${others.length} branch(es) the policy does not own: ${others
        .map((row) => row.name)
        .join(", ")}`,
    );
  }

  const result = await prunePreservedBranches({ projectId, plan, call: neon, dryRun });
  for (const failure of result.failed) {
    warn(`could not delete ${failure.name}: ${failure.error}`);
  }
  if (dryRun) {
    say(
      `  would prune ${plan.candidates.length} of ${plan.count} branch(es) — --dry-run, nothing is deleted`,
    );
  } else if (result.deleted.length > 0) {
    say(
      `  pruned    ${result.deleted.length} branch(es): ${result.deleted.map((row) => row.name).join(", ")}`,
    );
  } else {
    say("  prune     nothing — no preserved branch is superseded or past the age limit");
  }

  // The number the restore has to fit in is the one that is true *after* the prune — the dry run
  // decides on the same arithmetic, so it can say whether tomorrow's run would be refused.
  const remaining = dryRun
    ? plan.count - plan.candidates.length
    : (await listBranches(projectId)).length;
  const refusal = capacityRefusal({
    branchName: branch.name,
    count: remaining,
    ceiling,
    needed,
    prunable: result.failed.map((failure) => ({
      name: failure.name,
      reason: `the DELETE failed: ${failure.error}`,
    })),
    kept: plan.kept,
  });
  if (refusal !== null) throw new Refused(refusal);

  say(`  capacity  ${remaining} of ${ceiling} — ${ceiling - remaining} free`);
  // The old warning here ("this restore also creates a preserved branch, N free slots may not be
  // enough") was a guess made after the fact. `needed` is now 2 on every reset path, so a run that
  // could not fit the restore *and* the recovery point is refused above, by name, before the first
  // write — a warning that the next step will fail is not a pre-flight.
  return { count: remaining, ceiling, pruned: plan.candidates.length };
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
        `the source branch "${source.name}" (${source.id}) cannot supply a working demo: ${missing.join(" and ")} ${missing.length === 1 ? "is" : "are"} empty or absent, so a restore would leave "${branchName}" with an auth server that answers "Project config not found" and a reseed that cannot create the demo accounts. The source must carry the auth configuration (\`neon_auth.project_config\` and \`neon_auth.jwks\`) and no users — see docs/getting-started/demo.md. Nothing was changed.`,
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
 * Waits for the operations a Neon call started.
 *
 * A `200` is not the work being done: the restore is finished when the last operation reports
 * `finished`, which is why this polls rather than returning on the response. `label` names the
 * operation in the two failures this can raise, so a failure reads as what actually stopped.
 */
async function awaitOperations(projectId, operations, label) {
  if (operations.length === 0) return { operations: 0, waitedMs: 0 };

  const deadline = Date.now() + OPERATION_TIMEOUT_MS;
  const t0 = Date.now();
  const pending = new Map(operations.map((operation) => [operation.id, operation.action]));
  let lastError = null;

  while (pending.size > 0) {
    if (Date.now() > deadline) {
      throw new Error(
        `the ${label} is still running after ${Math.round(OPERATION_TIMEOUT_MS / 1000)}s (${[...pending.entries()].map(([id, action]) => `${action}:${id}`).join(", ")}) — it will finish on its own; re-run to confirm`,
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

  if (lastError !== null) throw new Error(`the ${label} failed: ${lastError}`);
  return { operations: operations.length, waitedMs: Date.now() - t0 };
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
 *
 * The body is not built here: `restoreRequest()` in `demo-restore-plan.mjs` decides whether the
 * branch's children force a `preserve_under_name` (the API answers `422 — Branch has children,
 * preserve_under_name is required` without one) and which name to use, and
 * `tests/demo-restore-plan.test.ts` proves both bodies without a key. The children move under the
 * preserved branch, so the branch this restores comes out with none — that is checked after the
 * reset in `main()`, not assumed here.
 *
 * The same call is what restores the branch **back** to its pre-reset state when the trusted-origin
 * step fails (`restorePreResetState`), with the recovery point as the source and the timestamped
 * preserve left out: two callers, one shape.
 */
async function restoreFromSource(projectId, branch, plan) {
  let started;
  try {
    started = await neon("POST", `/projects/${projectId}/branches/${branch.id}/restore`, plan.body);
  } catch (error) {
    // The pre-flight ran seconds ago, so this is a slot that filled up between the two calls (a
    // sibling job, a preview branch). The API's `422 — branches limit exceeded` names nothing;
    // the policy's sentence names the branches, and a refusal is the honest shape for it.
    if (!/branches limit/i.test(error?.message ?? "")) throw error;
    const refusal = await capacityRefusalNow(projectId, branch.name);
    throw refusal === null ? error : new Refused(refusal);
  }

  const waited = await awaitOperations(projectId, started?.operations ?? [], "reset");
  return { ...waited, preservedUnder: plan.preservedUnder };
}

/**
 * Says what the restore will do with the branch's children before it is sent, and — when one is
 * created — what the preserved branch is and what it costs. A restore that quietly re-parents
 * somebody's preview branch is a surprise; the run log is the only place that can say it first.
 */
function printRestorePlan(plan, branchName) {
  if (plan.preservedUnder === null) {
    say("  children  none — the body carries no preserve_under_name, so nothing is preserved");
    return;
  }
  say(
    `  children  ${plan.children.length} (${plan.children.map((child) => child.name).join(", ")}) — moved under the preserved branch`,
  );
  say(`  preserved ${plan.preservedUnder}`);
  say(
    `            the state ${branchName} holds right now, kept as its own branch: one branch against the project's limit and the storage its rows occupy, no compute — kept while it is the newest for ${branchName} and younger than DEMO_PRESERVED_MAX_AGE_DAYS, retired after that by the pre-flight`,
  );
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ------------------------------------------------------------------ *\
 * Trusted origins — re-applied after a restore, then proved
 * ------------------------------------------------------------------ */

/** How long the sign-in probe waits for an answer before it is "no HTTP answer" (status 0). */
const PROBE_TIMEOUT_MS = 20_000;

/**
 * The one origin this branch must trust: `DEMO_ORIGIN`, or the demo's own site.
 *
 * The default is `https://demo.alignsynch.com` rather than `http://localhost:3000` **because a
 * loopback origin is not evidence**. Neon Auth trusts `http://localhost:*` implicitly on a branch
 * whose trusted-domain list is empty — measured on 2026-11-15: an empty list answered `401` for
 * `Origin: http://localhost:3000` and `403` for `https://demo.alignsynch.com` in the same window —
 * so a nightly run that trusted loopback would print a green probe every night on a demo nobody
 * can enter. Validated before the first API call, so a refusal about the origin cannot arrive after
 * a restore has already emptied the branch.
 */
function resolveOrigin(raw) {
  const value = (raw ?? DEFAULT_DEMO_ORIGIN).trim();
  const refusal = originRefusal(value);
  if (refusal !== null) throw new Refused(`${refusal}\n\nNothing was changed.`);
  return value;
}

/**
 * The synthetic 500 the live API answered in the seconds after a restore.
 *
 * Test-only, and reachable only from `--fail-origin-once` / `--fail-origin-always`: it has the same
 * shape as a real failure (`status: 500`, a message that reads like the API's), so the retry and the
 * restore-back are exercised by exactly the code that runs in production. There is no environment
 * variable for this, because an environment variable is a production knob.
 *
 * @param {string} path the domain-list route
 * @param {number} attempt which attempt is being simulated
 * @param {"once" | "always"} mode
 */
function injectedOriginFailure(path, attempt, mode) {
  const failure = new Error(
    `GET ${path} answered HTTP 500 — AUTH_FAILURE (injected by --fail-origin-${mode}, attempt ${attempt})`,
  );
  failure.status = 500;
  failure.injected = true;
  return failure;
}

/**
 * Re-applies the branch's trusted origin — the step a restore makes necessary.
 *
 * One `GET` of the list, and one `POST` only when the origin is not already in it, then a `GET`
 * again to read back what the branch actually carries. Nothing else is written: no entry is
 * removed, none is replaced, and the list is never written wholesale, because a repair that widens
 * the allowlist — or deletes somebody else's entry — is a second defect wearing the first one's
 * clothes.
 *
 * The whole sequence is attempted `ORIGIN_ATTEMPTS` (5) times with a `2s → 4s → 8s → 16s` backoff
 * inside a 45s ceiling, because it runs **after** the restore: measured on 2026-11-15, `GET
 * …/auth/domains` answered `500 AUTH_FAILURE` for a window of a few seconds after a restore and
 * `200` twenty seconds later, and a step with no retry turned that window into a demo with zero
 * rows. Only a `5xx` and a fetch that never answered are retried
 * (`demo-auth-domains.mjs::isRetryableOriginFailure`); a `4xx` — a bad shape, a key the project
 * refuses, a branch with no integration — fails at once, because retrying a fact is how a refusal
 * becomes a timeout.
 *
 * Each attempt is printed with its status and elapsed time, and the step ends with the whole trace,
 * so the next person reads `attempt 1: 500 → attempt 2: 200` instead of guessing what happened.
 *
 * A branch with no Managed Auth integration answers `404` rather than an empty list, and that is a
 * refusal: there is no list to re-apply, and enabling Neon Auth on a branch is a decision rather
 * than a retry. (The demo branch keeps its integration across a restore — measured — so this is the
 * case a `--branch` on some other branch hits, not the nightly one.)
 */
async function ensureTrustedOrigin({
  projectId,
  branch,
  origin,
  dryRun,
  failOrigin = null,
  attempts = ORIGIN_ATTEMPTS,
}) {
  const path = authDomainsPath(projectId, branch.id);
  step(`trusted origin — ${origin} on ${branch.name}${dryRun ? " (--dry-run)" : ""}`);

  const run = async ({ attempt }) => {
    // The injected fault lands where the live one did: before the list is read.
    if (failOrigin === "always" || (failOrigin === "once" && attempt === 1)) {
      throw injectedOriginFailure(path, attempt, failOrigin);
    }

    const lines = [];
    const before = await request("GET", path, undefined, [404]);
    if (before.status === 404) {
      throw new Refused(
        `branch "${branch.name}" (${branch.id}) has no Neon Auth integration — GET ${path} answered 404 (${before.payload?.message ?? "not found"}), so there is no trusted-domain list to re-apply. Enabling Neon Auth on a branch is a decision, not a retry. Nothing was changed.`,
      );
    }

    const trusted = trustedOrigins(before.payload);
    lines.push(
      `  before    ${
        trusted.length === 0
          ? "no origin is trusted — every sign-in from a site answers 403 INVALID_ORIGIN"
          : trusted.join(", ")
      }`,
    );

    const plan = domainPlan({ trusted, origin });
    if (plan.action === "present") {
      lines.push(`  applied   nothing — ${plan.reason}`);
      return { status: before.status, value: { added: false, trusted }, lines };
    }
    if (dryRun) {
      lines.push(`  would add ${origin} — --dry-run, nothing is written`);
      return { status: before.status, value: { added: false, trusted, wouldAdd: true }, lines };
    }

    const posted = await request(
      "POST",
      path,
      { domain: origin, auth_provider: AUTH_PROVIDER },
      [404],
    );
    if (posted.status === 404) {
      throw Object.assign(
        new Error(
          `POST ${path} answered 404 for ${origin} — the branch has no Managed Auth integration after the operation, so the origin could not be re-applied`,
        ),
        { status: 404 },
      );
    }

    // Read back rather than trust the POST's own answer: the question is what the branch carries.
    const afterReply = await request("GET", path);
    const after = trustedOrigins(afterReply.payload);
    if (!after.some((domain) => domain.toLowerCase() === origin.toLowerCase())) {
      // The API accepted the write and the list does not carry it yet: the one non-HTTP lag that is
      // worth another attempt rather than a failure, because the next read usually has it.
      throw Object.assign(
        new Error(
          `the API accepted ${origin} on "${branch.name}" but the list it now reports does not carry it (${after.join(", ") || "empty"}) — the origin is still untrusted, so sign-in would answer 403 INVALID_ORIGIN`,
        ),
        { status: afterReply.status, transient: true },
      );
    }
    lines.push(`  applied   added ${origin} — the branch now trusts ${after.join(", ")}`);
    return { status: afterReply.status, value: { added: true, trusted: after }, lines };
  };

  let result;
  try {
    result = await retryOriginStep(run, {
      attempts,
      onAttempt: ({ entry, retryInMs }) => {
        const status = entry.status === 0 ? "no answer" : String(entry.status ?? "ok");
        say(
          `  attempt ${String(entry.attempt).padEnd(2)} ${status} in ${(entry.ms / 1000).toFixed(1)}s${
            retryInMs === null ? "" : ` — retrying in ${(retryInMs / 1000).toFixed(0)}s`
          }`,
        );
      },
    });
  } catch (error) {
    const entries = error.attempts ?? [];
    say(`  attempts  ${attemptTrace(entries)}`);
    throw error;
  }

  for (const line of result.lines) say(line);
  const trace = attemptTrace(result.entries);
  say(`  attempts  ${trace}`);
  return { ...result.value, attempts: result.entries.length, trace };
}

/* ------------------------------------------------------------------ *\
 * The pre-reset state — taken before the restore, put back if the origin step cannot converge
 * ------------------------------------------------------------------ */

/**
 * The branch that holds the state this run is about to destroy.
 *
 * The origin step runs **after** the restore, and the restore is what empties the branch, so a
 * failure there is not a no-op: measured twice on 2026-11-15, `pnpm demo:reset` restored `demo` from
 * `demo-base`, answered `500 AUTH_FAILURE` on the trusted-origin call, and left the demo with zero
 * rows behind a deployment that still answered `200`. Retrying closes the window
 * (`ensureTrustedOrigin`); this closes the consequence, because a retry can still be exhausted.
 *
 * The recovery point is a plain branch created from `demo`'s own head before the restore — copy on
 * write, no compute, exactly the rows, the auth configuration and the trusted list the demo holds at
 * that instant. It is named with the preserved-branch convention (`<branch>-preserved-<UTC stamp>`,
 * `demo-restore-plan.mjs::preservedUnderName`, checked against the project's existing names so a
 * collision cannot fail the run), which is what makes the existing policy
 * (`demo-branch-prune.mjs`) the thing that retires one this script failed to delete.
 *
 * It is deleted on the path where the run converged (`deleteRecoveryPoint`), so a healthy nightly
 * does not spend a branch slot permanently; the capacity pre-flight counts it while the run is live.
 *
 * @param {{ projectId: string, branch: { id: string, name: string, allNames?: string[] }, dryRun: boolean }} input
 * @returns {Promise<{ id: string, name: string } | null>} `null` on `--dry-run`
 */
async function createRecoveryPoint({ projectId, branch, dryRun }) {
  const name = preservedUnderName(branch.name, new Date(), branch.allNames ?? []);
  step(`recovery point — the state ${branch.name} holds now, kept as ${name}`);
  if (dryRun) {
    say(`  would create ${name} — --dry-run, nothing is written`);
    return null;
  }

  const created = await neon("POST", `/projects/${projectId}/branches`, {
    branch: { name, parent_id: branch.id },
    endpoints: [],
  });
  await awaitOperations(projectId, created?.operations ?? [], "recovery point");

  // Read back: the state has to exist before the restore destroys what it holds, and a branch list
  // that does not carry it is a reason to stop rather than to restore onto nothing.
  const found = (await listBranches(projectId)).find((candidate) => candidate.name === name);
  if (found === undefined) {
    throw new Refused(
      `the API accepted the recovery point "${name}" but the project's branch list does not carry it, so ${branch.name}'s current state was not preserved — refusing to restore over a state there is no way back from. Nothing was changed.`,
    );
  }
  say(
    `  recovery  ${name} (${found.id}) — the pre-reset state, restorable until the run converges`,
  );
  return { id: found.id, name };
}

/**
 * Deletes the recovery point once the run has converged.
 *
 * A failure to delete is a warning, never a failure: the branch is a valid preserved snapshot and
 * `demo-branch-prune.mjs` retires it on a later run. What would be wrong is failing a green reset
 * over the cleanup of a recovery point nobody needed.
 */
async function deleteRecoveryPoint({ projectId, recovery }) {
  try {
    await neon("DELETE", `/projects/${projectId}/branches/${recovery.id}`);
    say(
      `  recovery  ${recovery.name} deleted — the run converged, so the pre-reset state is not needed`,
    );
  } catch (error) {
    warn(
      `could not delete the recovery branch ${recovery.name} (${recovery.id}): ${error.message} — the preserved-branch policy retires it on a later run`,
    );
  }
}

/**
 * Puts the branch back to the state `before` describes, from the recovery point.
 *
 * This is the promise the card makes: **a failed reset ends where it started, not emptier than it
 * began.** The restore is the same call the reset used, with the recovery point as its source, and
 * the counts are read back and compared with the pre-reset census rather than assumed — a restore
 * that landed on the wrong state is worth saying out loud, not worth a green line.
 *
 * The restored branch's trusted-origin list is empty again (a restore does not preserve it, which is
 * the whole reason this step can fail in the first place), so the origin is re-applied best-effort
 * afterwards. It is expected to fail — the auth service is why we are here — and that is reported as
 * `originProven: false` rather than thrown, so the data recovery is not reported as a data loss.
 *
 * @param {{
 *   projectId: string,
 *   branch: { id: string, name: string },
 *   recovery: { id: string, name: string },
 *   before: Record<string, number | string>,
 *   database: string,
 *   role: string,
 *   origin: string,
 * }} input
 */
async function restorePreResetState({
  projectId,
  branch,
  recovery,
  before,
  database,
  role,
  origin,
}) {
  step(
    `restore ${branch.name} back to its pre-reset state — from ${recovery.name} (${recovery.id})`,
  );

  try {
    const restored = await restoreFromSource(projectId, branch, {
      body: { source_branch_id: recovery.id },
      preservedUnder: null,
      children: [],
    });
    say(
      `  restored  finished after ${(restored.waitedMs / 1000).toFixed(1)}s (${restored.operations} operation(s))`,
    );
  } catch (error) {
    throw new Error(
      [
        `the trusted-origin step failed AND the branch could not be put back: ${error.message}`,
        `  · "${branch.name}" is EMPTY. The pre-reset state is held by "${recovery.name}" (${recovery.id}) — restore it by hand:`,
        `    POST /projects/${projectId}/branches/${branch.id}/restore  {"source_branch_id":"${recovery.id}"}`,
      ].join("\n"),
    );
  }

  const after = await resolveBranch(projectId, branch.name);
  const strings = await resolveConnectionStrings(projectId, after, database, role);
  const state = await counts(strings.direct);
  printCounts("after restoring the pre-reset state", state);

  const drifted = Object.entries(before).filter(([label, value]) => state[label] !== value);
  if (drifted.length === 0) {
    say(
      `  verified  ${branch.name} holds exactly the row counts it held before this run — a failed reset ended where it started`,
    );
  } else {
    warn(
      `${drifted.length} count(s) differ from the pre-reset census: ${drifted
        .map(([label, value]) => `${label} ${value} → ${state[label]}`)
        .join(", ")} — the restore landed, but this is not the state the run began with`,
    );
  }

  let originProven = false;
  try {
    await ensureTrustedOrigin({ projectId, branch: after, origin, dryRun: false });
    originProven = true;
  } catch (error) {
    warn(
      `the trusted origin could not be re-applied after the restore-back (${error.message.split("\n")[0]}) — the rows are back, but sign-in from ${origin} is unproven; fix the auth service and run --verify-origin`,
    );
  }

  return { state, drifted, originProven };
}

/**
 * One sign-in POST to the branch's own auth host, from a given origin, with a deliberately wrong
 * credential. No real seat is involved and no credential is read: `PROBE_EMAIL` cannot exist and
 * `PROBE_PASSWORD` cannot be anybody's.
 *
 * A `429` or a `5xx` is retried once, because a run that has just created thirty accounts is
 * entitled to a rate-limit and that is not an answer about the origin. A network failure is
 * reported as status `0` — "no HTTP answer" — and is not read as a pass either.
 */
async function probeSignIn(authBaseUrl, origin) {
  const url = `${authBaseUrl.replace(/\/+$/, "")}/sign-in/email`;

  const attempt = async () => {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", origin },
        body: JSON.stringify({ email: PROBE_EMAIL, password: PROBE_PASSWORD }),
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });
      const text = await response.text();
      let payload = null;
      try {
        payload = text === "" ? null : JSON.parse(text);
      } catch {
        payload = null;
      }
      return { status: response.status, code: payload?.code ?? null };
    } catch (error) {
      return { status: 0, code: null, error: error.message };
    }
  };

  let reply = await attempt();
  if (reply.status === 429 || reply.status >= 500 || reply.status === 0) {
    await delay(2000);
    reply = await attempt();
  }
  return reply;
}

/**
 * Proves the demo is enterable: `401` or the run fails.
 *
 * This is the check the card exists for, and it is deliberately not "the branch came back" — a
 * branch that answers `403 INVALID_ORIGIN` is a demo nobody can enter, whatever the row counts say
 * and whatever `/api/version` answers. The credential is a deliberate wrong one, so a
 * `401 INVALID_EMAIL_OR_PASSWORD` is the origin being accepted and nothing else.
 */
async function probeOrigin({ authBaseUrl, origin }) {
  step(`sign-in probe — Origin: ${origin}`);
  say(`  auth      ${authBaseUrl}`);
  if (isLoopbackOrigin(origin)) {
    warn(
      `${origin} is a loopback origin — Neon Auth trusts it implicitly on any branch, so a 401 here is NOT evidence that the demo's public origin is trusted. Set DEMO_ORIGIN to the site visitors use for a probe that proves something.`,
    );
  }
  const reply = await probeSignIn(authBaseUrl, origin);
  say(probeLine({ status: reply.status, origin }));
  const failure = probeFailure({ status: reply.status, origin, authBaseUrl });
  if (failure !== null) throw new Error(failure);
  return reply.status;
}

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

/**
 * The tables the seed writes, in the bundle's own terms — the comparison that matters.
 *
 * A function of `seededRowTotals` rather than a constant, because two of these counts are not a
 * property of the file: `party` and `opinion` count the rows a **seed** installs, which the
 * authored bundle's own arrays over-count (62/310 authored against 56/205 written). Reading them
 * from `content/assessment.ts` keeps this report and the writer on one derivation.
 */
function bundleKeys(seededRowTotals) {
  return {
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
            (count, item) =>
              count + (item.scale.kind === "options" ? item.scale.options.length : 0),
            0,
          ),
        0,
      ),
    session: (payload) => payload.instances.length,
    relationship: (payload) => payload.instances.length,
    party: (payload) =>
      payload.instances.reduce((total, instance) => total + seededRowTotals(instance).parties, 0),
    opinion: (payload) =>
      payload.instances.reduce((total, instance) => total + seededRowTotals(instance).opinions, 0),
  };
}

/** Label in the report → key in `bundleKeys()` and in the DB count map. */
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
  // The seed-vs-bundle comparison for `party`/`opinion` is the seed's own rule, not the file's
  // arrays — see `bundleKeys`. `seededRowTotals` is the same derivation `db-seed.mjs` writes by.
  const { seededRowTotals } = await import("../content/assessment.ts");
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
  for (const [key, count] of Object.entries(bundleKeys(seededRowTotals)))
    expected[key] = count(payload);
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
    // coach_invite → relationship → template_version (a relationship names a version) → item
    // (cascades response_option) → record.
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
      /* #1081 — the two billing rows that hang off a relationship. `relationship_payment` has no
       * `ON DELETE CASCADE` (0036 says why: the obligation is the record of a charge), so it has to
       * go before the relationship it names; `plan_grant` cascades, and deleting it explicitly is
       * what puts the count in the report instead of leaving it to the FK. */
      ["relationship_payment", "public.relationship_payment", "DELETE FROM relationship_payment"],
      ["plan_grant", "public.plan_grant", "DELETE FROM plan_grant"],
      ["relationship", "public.relationship", "DELETE FROM relationship"],
      ["template_version", "public.template_version", "DELETE FROM template_version"],
      ["item", "public.item", "DELETE FROM item"],
      ["response_option", "public.response_option", "DELETE FROM response_option"],
      ["record", "public.record", "DELETE FROM record"],
      ["user_profile", "public.user_profile", "DELETE FROM user_profile"],
      ["demo_account", "public.demo_account", "DELETE FROM demo_account"],
      /* #1081 — the console's half. These tables cascade from nothing above and the seed upserts
       * into them, so a reseed-only run would otherwise keep a walkthrough's extra inbox reply, an
       * extra audit row or a reviewer's own to-do beside the seeded ones, and `pnpm demo:verify`
       * would then diff the branch against an expectation file that cannot be true again. The
       * demo's contract is the bundle, this console half and the three accounts — nothing else —
       * and children before parents in each pair, for the FKs that do cascade. */
      ["broadcast_recipient", "public.broadcast_recipient", "DELETE FROM broadcast_recipient"],
      ["broadcast_send", "public.broadcast_send", "DELETE FROM broadcast_send"],
      ["contact_reply", "public.contact_reply", "DELETE FROM contact_reply"],
      ["contact_message", "public.contact_message", "DELETE FROM contact_message"],
      ["email_event", "public.email_event", "DELETE FROM email_event"],
      ["news_signup", "public.news_signup", "DELETE FROM news_signup"],
      ["admin_action", "public.admin_action", "DELETE FROM admin_action"],
      ["billing_event", "public.billing_event", "DELETE FROM billing_event"],
      ["review_issue_comment", "public.review_issue_comment", "DELETE FROM review_issue_comment"],
      ["review_issue", "public.review_issue", "DELETE FROM review_issue"],
      ["review_todo", "public.review_todo", "DELETE FROM review_todo"],
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

  // The origin is resolved and validated before the first API call: a refusal about it must not
  // arrive after a restore has already emptied the branch.
  const origin = resolveOrigin(options.probeOrigin ?? process.env.DEMO_ORIGIN);
  progress.origin = origin;

  const project = await resolveProject(options.project);
  progress.projectId = project.id;
  progress.branchName = options.branch;

  let branch = await resolveBranch(project.id, options.branch);
  assertTargetResettable(branch);
  progress.branchId = branch.id;
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

  // The two origin commands are their own runs — they prove a door and change no content — so they
  // are handled before the reset banner and before the capacity pre-flight, neither of which
  // applies to them.
  if (options.probeOrigin !== null || options.verifyOrigin) {
    progress.originOnly = true;
    say(`demo:reset — project ${project.name} (${project.id})`);
    say(`  branch    ${branch.name} (${branch.id})`);
    say(`  compute   ${branch.endpointHost}`);
    if (options.verifyOrigin) {
      // `--verify-origin` re-applies and then proves; `--probe-origin` only asks, and changes
      // nothing, which is what makes it usable to demonstrate a refused origin on a live branch.
      await ensureTrustedOrigin({
        projectId: project.id,
        branch,
        origin,
        dryRun: options.dryRun,
        failOrigin: options.failOrigin,
      });
    }
    const status = await probeOrigin({ authBaseUrl, origin });
    say(
      `\n✓ demo:reset — ${options.verifyOrigin ? `${branch.name} trusts ${origin}` : `${branch.name} was asked about ${origin}`} and sign-in from it answered ${status}`,
    );
    return;
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

  // Capacity, before the first write (#909): a restore spends a branch slot, so a project at its
  // ceiling is refused here — with the branches named — rather than by a raw 422 after the source
  // has already been migrated.
  if (!options.skipReset) {
    await preflightCapacity({ projectId: project.id, branch, dryRun: options.dryRun, needed: 2 });
  }

  if (options.dryRun) {
    if (!options.skipReset) {
      step("the restore this run would send");
      printRestorePlan(restoreRequest(branch, source, new Date()), branch.name);
      // The recovery point is planned too: a dry run has to answer "could tomorrow's run put the
      // branch back if the origin step failed after the restore?".
      await createRecoveryPoint({ projectId: project.id, branch, dryRun: true });
    }
    // The origin step is planned too: "--dry-run" has to answer "would tomorrow's run leave the
    // demo enterable?", and that answer is the list it would write.
    await ensureTrustedOrigin({ projectId: project.id, branch, origin, dryRun: true });
    const before = await counts(connectionStrings.direct);
    printCounts("counts now (--dry-run: nothing will change)", before);
    say("\n✓ demo:reset — dry run, nothing was changed");
    return;
  }

  const before = await counts(connectionStrings.direct);
  printCounts("before", before);

  // The state this run is about to destroy. It has to be taken **before** the restore, because the
  // trusted-origin step runs after it: a failure there is not a no-op on a branch the restore has
  // already emptied, and without this there would be nothing to put back.
  let recovery = null;

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

    // The way back, taken while the current state still exists (#1090).
    recovery = await createRecoveryPoint({ projectId: project.id, branch, dryRun: false });
    progress.recovery = recovery;

    step(`reset ${branch.name} from ${source.name} (one restore, not a delete)`);
    // The body comes from `restoreRequest()`: with children the API refuses a restore that does
    // not say where to preserve them (`422 — Branch has children, preserve_under_name is
    // required`), so the plan is decided and printed before the call, not discovered by it.
    const plan = restoreRequest(branch, source, new Date());
    printRestorePlan(plan, branch.name);
    const reset = await restoreFromSource(project.id, branch, plan);
    say(
      `  reset ${reset.operations === 0 ? "accepted with no operations" : `finished after ${(reset.waitedMs / 1000).toFixed(1)}s (${reset.operations} operation(s))`}${reset.preservedUnder === null ? "" : ` — children now under ${reset.preservedUnder}`}`,
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
    // The state the job claims, read back rather than assumed: the children moved under the
    // preserved branch, so the branch this run reset has none left. A restore that left them in
    // place would fail the same way tomorrow, which is worth saying tonight.
    if (after.childCount > 0) {
      warn(
        `${after.name} still has ${after.childCount} child branch(es) after the restore (${after.children.map((child) => child.name).join(", ")})${reset.preservedUnder === null ? " — the restore was sent without preserve_under_name" : ` — the API was asked to move them under ${reset.preservedUnder}`}`,
      );
    } else {
      say(`  children  none — ${after.name} has nothing under it after the reset`);
    }
    branch = after;
    assertTargetResettable(branch);
    source = await resolveSource(project.id, branch, options.source);
    assertSourceResettable(branch, source);
    progress.branchId = branch.id;
    connectionStrings = await resolveConnectionStrings(project.id, branch, database, role);
    authBaseUrl = authBaseUrlFor(branch.endpointHost, database);
  }

  // The trusted-domain list is branch configuration a restore does not preserve, so a completed
  // reset **writes it back** rather than assuming it survived (`demo-auth-domains.mjs` carries the
  // measurement). It runs after the restore and before the reseed on purpose: the seed creates its
  // accounts through this branch's own sign-up endpoint with `Origin: $DEMO_ORIGIN`, so on a branch
  // whose list was just emptied it would be creating them from an origin the branch refuses.
  //
  // Because the restore has already emptied the branch by this point, failing here is not a no-op —
  // so this is where the run puts the branch back (#1090). Retries first: the measured failure was
  // a few-second window of `500 AUTH_FAILURE` after a restore, which a second attempt usually
  // clears. If every attempt fails, the branch is restored from the recovery point taken above and
  // the run exits non-zero having ended where it started.
  let originOutcome;
  try {
    originOutcome = await ensureTrustedOrigin({
      projectId: project.id,
      branch,
      origin,
      dryRun: false,
      failOrigin: options.failOrigin,
    });
  } catch (error) {
    // `--skip-reset` never emptied the branch, so there is nothing to put back and the failure
    // stands on its own.
    if (recovery === null) throw error;

    const putBack = await restorePreResetState({
      projectId: project.id,
      branch,
      recovery,
      before,
      database,
      role,
      origin,
    });
    const failedAttempts = error.attempts ?? [];
    throw new Error(
      [
        `the trusted-origin step failed after ${failedAttempts.length} attempt(s) (${attemptTrace(failedAttempts)}) on "${branch.name}", after the restore had already emptied it.`,
        `"${branch.name}" was put back from the recovery point ${recovery.name} (${recovery.id}) and now holds its pre-reset row counts${
          putBack.drifted.length === 0
            ? " exactly"
            : ` apart from ${putBack.drifted.length} count(s) — see the report above`
        }, so a failed reset ended where it started instead of leaving the demo empty.`,
        `It is NOT reseeded, and sign-in from ${origin} is ${putBack.originProven ? "proved" : "NOT proved"} — fix the auth service for this branch and re-run; nothing has to be un-done first.`,
        `The underlying failure: ${error.message.split("\n").join("\n  ")}`,
      ].join("\n"),
    );
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

  // The door, proved in this run's own output: 401 from the demo origin or the reset failed. It
  // runs on every path that touched the branch, `--skip-seed` included, because the question is
  // whether the site is trusted and not whether rows were written.
  const proofStatus = await probeOrigin({ authBaseUrl, origin });

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
  say(
    `  origin      ${origin} — trusted, sign-in from it answered ${proofStatus} (trusted on attempt ${originOutcome.attempts} of ${ORIGIN_ATTEMPTS}; ${originOutcome.trace})`,
  );
  say(`  elapsed     ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  if (mismatches > 0) {
    throw new Error(`${mismatches} table(s) do not match ${BUNDLE} after the reseed`);
  }

  // Converged: the pre-reset state is not needed any more, and the next run takes its own. Deleted
  // here rather than on the failure paths, so a failed reset keeps the way back it was given.
  if (recovery !== null) await deleteRecoveryPoint({ projectId: project.id, recovery });

  say(`\n✓ demo:reset — ${branch.name} reset and reseeded from ${BUNDLE}`);
}

/* ------------------------------------------------------------------ *\
 * Entry
 * ------------------------------------------------------------------ */

/**
 * What has been resolved so far, so the failure path can report the branch's state without
 * re-deriving it from the environment (a `--branch` flag is not an environment variable).
 */
const progress = {
  projectId: null,
  branchName: null,
  branchId: null,
  database: null,
  role: null,
  origin: null,
  // The branch holding the state this run took before the restore, when one was taken: a failure
  // anywhere after it can name the way back instead of leaving the reader with an empty branch.
  recovery: null,
  // `--verify-origin` and `--probe-origin` change no content, so a failure there has no branch
  // state to report: nothing was reset, nothing was seeded, and reading the counts would dress a
  // one-line refusal up as a partial reset.
  originOnly: false,
};

main().catch(async (error) => {
  console.error(`\n✗ demo:reset failed: ${error.message}`);

  // A failed reset is not a dead branch: say what it holds now, so the next person does not
  // have to guess whether the demo is serving something valid. A refusal never touched the
  // branch — it is raised before the first write — so there is nothing to report.
  if (
    !(error instanceof Refused) &&
    !progress.originOnly &&
    progress.projectId !== null &&
    progress.branchName !== null
  ) {
    try {
      const branch = await resolveBranch(progress.projectId, progress.branchName);
      const { database, role } = await resolveDatabaseAndRole(progress.projectId, branch);
      const strings = await resolveConnectionStrings(progress.projectId, branch, database, role);
      const state = await counts(strings.direct);
      printCounts("the branch after the failure (still serving, reported not repaired)", state);
    } catch (reportError) {
      console.error(`  (the branch state could not be read: ${reportError.message})`);
    }
    // A branch emptied by a restore that then failed has a way back, and the person reading this
    // log is the only one who can find it — so the last line names it rather than leaving them with
    // zeros and no next step.
    if (progress.recovery !== null) {
      console.error(
        `  · the pre-reset state is held by "${progress.recovery.name}" (${progress.recovery.id}) — put it back with: POST /projects/${progress.projectId}/branches/${progress.branchId ?? "<branch id>"}/restore {"source_branch_id":"${progress.recovery.id}"}`,
      );
    }
  }

  process.exit(error.exitCode ?? 1);
});
