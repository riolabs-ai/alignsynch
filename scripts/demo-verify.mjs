#!/usr/bin/env node
/**
 * `pnpm demo:verify` — does the app still behave on the demo dataset? One command, one answer,
 * and the answer is a **diff** against a committed file instead of an owner noticing it in a
 * browser.
 *
 *   pnpm demo:verify              seed the bundle, drive the app, diff against data/verify/
 *   pnpm demo:verify --update     rewrite the observed half of that file (the PR shows the diff)
 *   pnpm demo:verify --gate       the gate's shape: skip, with a reason, when it cannot run
 *
 * ## The two versioned halves
 *
 * **The input** is `data/bundles/demo-dataset.alignsynch.json`, committed, and already held equal
 * to the fixtures by `data:check` E32. This command does not trust that: it runs
 * `pnpm bundles export --dataset --check` first and **refuses** when the file is not the canonical
 * export, because a seed that installs a dataset the fixtures disagree with is drift no later
 * check would name.
 *
 * **The expected output** is `data/verify/demo-expectations.json`: the row counts the seed
 * produces, and nine rendered answers — five public pages, the three gated routes' `307 → /login`
 * boundary, and one signed-in read of `/assessments` that must name a real relationship.
 * It is deliberately small. A 40-route sweep nobody reads is worse than nine lines that catch a
 * 500, a missing price, or a list that drew its failure marker (`data-assessments-unreadable`)
 * instead of its rows (`data-assessments-list`) — a **marker**, because the failure and empty
 * states' copy is serialized into the RSC payload of a healthy render too, so a `mustNotContain`
 * on that copy fails on a page that is fine.
 *
 * The file is **authored, not generated**: a person writes the routes and the strings each page
 * must (and must not) carry. `--update` rewrites only the observed half — row counts, statuses and
 * redirect targets — so a reviewable diff can never quietly delete an assertion.
 *
 * ## What it reuses, and what it refuses to rebuild
 *
 * `pnpm db:seed` writes the rows (with `DEMO_AUTH=1`, because the signed-in read needs the three
 * demo accounts it creates); this script reads the counts back over `pg`; the HTTP half is
 * `node:fetch` with `redirect: "manual"`, so a `307` is observed rather than followed. No new
 * dependency, and no Playwright: the acceptance is on the **rendered HTML**, which is what a
 * `fetch` returns and what an assertion can read.
 *
 * **The activity feed is checked in both of its sources, differently on purpose** (t_6cc2b56a).
 * The `seed` rows are derived from the dataset and replaced by every seed, so their count is exact —
 * it is one of the row counts above. The `simulate` rows belong to an **explicit action**
 * (`pnpm demo:simulate-activity`), which this check *invokes* — the same way it invokes the seed,
 * and never on a schedule — and then presses twice: the count must land inside the band the
 * expectations file authors and must not move between the presses. An exact number there would be a
 * check that fails the first time somebody presses it on a different dataset.
 *
 * ## The branch lock (#1321)
 *
 * This run owns `algn/1` from just before its seed to its last read, and hands that lock's pid down
 * to the seed (`SEED_LOCK_HELD_BY_PID`) instead of letting the child take it again — an advisory
 * lock belongs to the session that took it, so the child's attempt could never be granted. The seed
 * proves the declaration against `pg_locks` before any `DELETE`. A concurrent `db:seed` therefore
 * waits for the whole run rather than deleting the demo accounts underneath its sign-ins.
 *
 *
 * ## The refusals
 *
 *   * `NEON_BRANCH=production`, or a `DATABASE_URL` on `ep-winter-block` — a demo seeder pointed
 *     at production writes fake relationships next to real ones (`productionRefusal()`, proved in
 *     `tests/demo-verify.test.ts`). Always a refusal, never a warning, and never softened by
 *     `--gate`.
 *   * A bundle that is not the canonical export — the seed would install a dataset the fixtures
 *     do not author.
 *   * A brand other than the one the file was recorded for: the dataset is **AlignSynch**'s, so
 *     the strings in the file are that build's. The brand is read from the page the server actually
 *     returns (`brandMismatch()`), not from this shell's `BRAND`, because the build that answers
 *     the request is the one the assertions are about. In `--gate` mode a brand mismatch is a
 *     printed skip, because a worktree that serves `quizhub` is not a failure — it is a tree this
 *     check cannot speak for.
 *
 * ## `--gate`, and why it exists
 *
 * The gate (`scripts/verify.sh`) runs on machines with no database and no server, so this command
 * cannot be a hard step there. `--gate` therefore *skips with a reason* when the environment
 * cannot run it — no `DATABASE_URL`, no `NEON_AUTH_BASE_URL`, the wrong brand, or nothing
 * listening at `BASE_URL` — and is a full, hard check when it can. Without `--gate` the command
 * fails instead, naming what is missing. Neither mode ever reports a green run it did not perform.
 *
 * ## Exit codes
 *
 *   0  the app behaves as the file says (or `--gate` skipped, with the reason printed)
 *   1  drift, or a step that could not run (seed, bundle, server, sign-in)
 *   2  refused — production, or the wrong brand for this file
 *
 * ## Usage
 *
 *   BASE_URL=http://localhost:3000 pnpm demo:verify
 *   pnpm demo:verify --update          # then read the diff: counts and statuses only
 *   bash scripts/verify.sh             # calls it with --gate
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";
import { ADMIN_SURFACE_COUNT_SQL } from "./db-seed-admin-surfaces.mjs";
import {
  SEED_LOCK_HELD_BY_ENV,
  SEED_LOCK_HELD_BY_PID_ENV,
  SEED_LOCK_ID,
  SEED_LOCK_NAMESPACE,
  SEED_LOCK_POLL_MS,
  lockAcquiredNotice,
  lockTimeoutMessage,
  lockWaitNotice,
  waitBudgetMs,
} from "./db-seed-lock.mjs";
import { loadEnv, repoRoot, writeDatabaseUrl } from "./load-env.mjs";
import {
  brandMismatch,
  endpointMismatch,
  locationPath,
  productionRefusal,
  reviseExpectations,
  routeKey,
  routeProblems,
  serializeExpectations,
  simulateBoundProblems,
} from "./demo-verify-rules.mjs";

const ARGS = process.argv.slice(2);
const UPDATE = ARGS.includes("--update");
const GATE = ARGS.includes("--gate");
const HELP = ARGS.includes("--help") || ARGS.includes("-h");

const EXPECTATIONS_FILE = join(repoRoot, "data", "verify", "demo-expectations.json");
const EXPECTATIONS_LABEL = "data/verify/demo-expectations.json";
const BUNDLE_PATH = join(repoRoot, "data", "bundles", "demo-dataset.alignsynch.json");
const BUNDLE_FILE = "data/bundles/demo-dataset.alignsynch.json";
const BASE_URL = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const REQUEST_TIMEOUT_MS = 20_000;

/**
 * The row counts the expectations file records — the eight content counts `scripts/db-seed.mjs`
 * prints, plus `demo_account`, which the seed creates under `DEMO_AUTH=1`. Spelled here rather
 * than imported because `db-seed.mjs` runs its seed at import; `db:verify` is the separate, deeper
 * check of these same rows and stays separate.
 *
 * **#1081's console half is imported, not re-spelled.** Those twelve tables are authored by
 * `scripts/db-seed-admin-surfaces.mjs`, which also owns the numbers
 * (`ADMIN_SURFACE_ROWS`); `tests/db-seed-admin-surfaces.test.ts` holds the expectation file equal to
 * them. A third copy here is exactly the drift this file's own docstring complains about.
 * `relationship_payment` is counted in the same file but authored elsewhere — the demo half writes
 * one fee row per complete relationship an account pays for (`scripts/db-seed-payments.mjs`), and
 * `tests/db-seed-payments.test.ts` holds that count equal to the dataset.
 */
const COUNT_SQL = {
  record: "SELECT count(*)::int AS n FROM record WHERE record_type = 'assessment'",
  item: "SELECT count(*)::int AS n FROM item",
  response_option: "SELECT count(*)::int AS n FROM response_option",
  relationship: "SELECT count(*)::int AS n FROM relationship",
  session: "SELECT count(*)::int AS n FROM session",
  // #1079 — the invitations and the subscription are counts now: a draft has no link (30
  // relationships, 27 sent) and an `active` relationship is read against a live subscription.
  session_invite: "SELECT count(*)::int AS n FROM session_invite",
  billing_subscription: "SELECT count(*)::int AS n FROM billing_subscription",
  party: "SELECT count(*)::int AS n FROM party",
  opinion: "SELECT count(*)::int AS n FROM opinion",
  billing_plan: "SELECT count(*)::int AS n FROM billing_plan",
  demo_account: "SELECT count(*)::int AS n FROM demo_account",
  // t_b9679354 — the fee a completed relationship carries is the demo half's now
  // (`scripts/db-seed-payments.mjs`), not the console's, so it is counted here beside the other
  // rows that half writes rather than in `ADMIN_SURFACE_COUNT_SQL`.
  relationship_payment: "SELECT count(*)::int AS n FROM relationship_payment",
  // t_6cc2b56a — the feed's **seed-owned** rows: an exact count, because the seed derives them from
  // the dataset's lifecycle (`lib/activity/events.ts::seedActivityEvents`) and replaces them every
  // run. Source 'simulate' is deliberately **not** here — it is the explicit action's, it may run
  // any number of times, and it is held to a bounded band below instead (`activity.simulate`).
  activity_event_seed: "SELECT count(*)::int AS n FROM activity_event WHERE source = 'seed'",
  ...ADMIN_SURFACE_COUNT_SQL,
};

let problems = 0;

function say(line = "") {
  console.log(line);
}

/** One labelled line: `  ✓ seed     …`. */
function step(mark, label, text) {
  console.log(`  ${mark} ${label.padEnd(8)} ${text}`);
}

/** A named problem, printed where it was found; the summary counts them. */
function problem(label, message) {
  problems += 1;
  console.log(`  ✗ ${label} ${message}`);
}

function refused(message) {
  console.error(`\n✗ demo:verify — refused.\n\n${message}\n`);
  process.exit(2);
}

function usage() {
  say(`Usage: pnpm demo:verify [--update] [--gate]

  (no flag)   seed the demo dataset, drive the app, diff against ${EXPECTATIONS_LABEL}
  --update    rewrite the observed half of that file (row counts, statuses, redirect targets) and
              print every change; the committed diff is the review
  --gate      skip with a reason when this environment cannot run the check (no DATABASE_URL or
              NEON_AUTH_BASE_URL, the wrong brand, or nothing listening at BASE_URL)

  BASE_URL    where the app is served (default http://localhost:3000). Start it first.

Exit: 0 matches the file · 1 drift or a step that could not run · 2 refused (production, brand).`);
}

function seconds(ms) {
  return `${(ms / 1000).toFixed(1)}s`;
}

/** Run a package.json script in the repo root; returns `{ ok, output, ms }`. */
function runScript(script, { env = {}, args = [] } = {}) {
  const started = Date.now();
  const result = spawnSync(process.platform === "win32" ? "pnpm.cmd" : "pnpm", [script, ...args], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  return {
    ok: result.status === 0,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
    ms: Date.now() - started,
  };
}

/** Format the expectations file with the repo's own formatter; `false` when biome is not installed. */
function formatExpectationsFile() {
  const biome = join(
    repoRoot,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "biome.cmd" : "biome",
  );
  if (!existsSync(biome)) return false;
  const result = spawnSync(biome, ["format", "--write", EXPECTATIONS_FILE], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  return result.status === 0;
}

/** The last `count` non-empty lines of a child's output, indented, for a failure. */
function tail(output, count = 12) {
  return output
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.trim() !== "")
    .slice(-count)
    .map((line) => `      ${line}`);
}

/** Every cookie a response set, as one `Cookie` header — the session `neon-auth` hands back. */
function cookieHeader(response) {
  const cookies =
    typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  return cookies.map((cookie) => cookie.split(";")[0]).join("; ");
}

/** Fetch one route, unfollowed, with the route's session cookies when it has any. */
async function fetchRoute(route, cookies) {
  const headers = {};
  if (cookies !== undefined && cookies !== "") headers.cookie = cookies;
  const response = await fetch(`${BASE_URL}${route.path}`, {
    redirect: "manual",
    headers,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const html = await response.text();
  return { status: response.status, location: response.headers.get("location") ?? "", html };
}

/** Does anything answer at `BASE_URL`, and what did its front page say? */
async function servedPage() {
  try {
    const response = await fetch(`${BASE_URL}/`, {
      redirect: "manual",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    return { answers: true, html: await response.text() };
  } catch {
    return { answers: false, html: "" };
  }
}

/**
 * Sign in as one of the three demo accounts, through the app's own auth proxy — the same door
 * `app/(auth)/login/demo-actions.ts` opens, with the same credential (`demo_account`), so the
 * session this run holds is a real one and not a fixture the app has never seen.
 *
 * The role button itself is not driven: it is a server action, and a server action's id is a build
 * artifact. The two facts the button depends on — the seeded credential and the branch's auth
 * server — are both honoured here.
 */
async function signIn(email, password) {
  const response = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/json", origin: BASE_URL },
    body: JSON.stringify({ email, password }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const cookies = cookieHeader(response);
  // Drain the body so the connection is released; the payload carries a token this script has no
  // business reading.
  await response.text().catch(() => "");
  return { status: response.status, cookies };
}

/**
 * The relationship the signed-in account is a party to, read from the rows the seed just wrote —
 * the same `coalesce(session.name, template.title)` and the same latest-session rule
 * `RELATIONSHIP_CARDS_SQL` uses (`lib/db/assessments.ts`), plus the other party's name. This is
 * the data half of the signed-in check: the page must *name* a real relationship, not merely
 * return 200.
 */
async function seededRelationship(client, userId) {
  const { rows } = await client.query(
    `WITH mine AS (
       SELECT rel.id AS relationship_id
         FROM relationship rel
        WHERE EXISTS (SELECT 1 FROM relationship_member rm
                       WHERE rm.relationship_id = rel.id AND rm.user_id = $1)
           OR EXISTS (SELECT 1 FROM session s0
                        JOIN party p0 ON p0.session_record_id = s0.record_id
                       WHERE s0.relationship_id = rel.id AND p0.user_id = $1)
     ),
     latest AS (
       SELECT DISTINCT ON (s.relationship_id)
              s.relationship_id, s.record_id, s.name, r.date, r.slug
         FROM session s
         JOIN record r ON r.id = s.record_id
        WHERE s.relationship_id IN (SELECT relationship_id FROM mine)
        ORDER BY s.relationship_id, r.date DESC, r.slug DESC
     )
     SELECT COALESCE(l.name, t.title) AS title, other.name AS counterparty
       FROM latest l
       JOIN relationship rel ON rel.id = l.relationship_id
       JOIN record t ON t.id = rel.template_id AND t.record_type = 'assessment'
       LEFT JOIN party other
         ON other.session_record_id = l.record_id
        AND other.role <> COALESCE((SELECT me.role FROM party me
                                     WHERE me.session_record_id = l.record_id
                                       AND me.user_id = $1), '')
      ORDER BY l.date DESC, l.slug DESC
      LIMIT 1`,
    [userId],
  );
  return rows[0] ?? null;
}

/** A route's label on the output: the path, and the account it was fetched as. */
function routeLabel(route) {
  return route.session === undefined ? route.path : `${route.path} (as ${route.session})`;
}

/** Does the route's redirect assertion still hold? Used only to know what `--update` repairs. */
function redirectHolds(route, observed) {
  if (route.redirect === undefined) return true;
  const path = locationPath(observed.location);
  return path?.startsWith(route.redirect) ?? false;
}

async function main() {
  const startedAt = Date.now();
  if (HELP) {
    usage();
    return 0;
  }
  loadEnv();

  const seedUrl =
    process.env.DATABASE_URL_UNPOOLED?.trim() || process.env.DATABASE_URL?.trim() || "";
  const databaseUrl = seedUrl;
  const connectionUrls = [process.env.DATABASE_URL, process.env.DATABASE_URL_UNPOOLED]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value !== "");
  const expectations = existsSync(EXPECTATIONS_FILE)
    ? JSON.parse(readFileSync(EXPECTATIONS_FILE, "utf8"))
    : null;

  // --- the refusals that are always a refusal ------------------------------------------------
  const refusal = productionRefusal({
    databaseUrls: connectionUrls,
    neonBranch: process.env.NEON_BRANCH,
  });
  if (refusal !== null) refused(refusal);

  // The app reads `DATABASE_URL` alone; a seed through `DATABASE_URL_UNPOOLED` leaves that at
  // whatever the shell had, which on this machine is a different branch. Diffing a page against a
  // database it never read is worse than refusing.
  const seedMismatch = endpointMismatch({ appUrl: process.env.DATABASE_URL, seedUrl });
  if (seedMismatch !== null) refused(seedMismatch);

  // --- what this environment can answer at all ------------------------------------------------
  if (databaseUrl === "") {
    if (GATE) {
      step("○", "skipped", "DATABASE_URL is not set");
      return 0;
    }
    console.error(
      [
        "",
        "✗ demo:verify — DATABASE_URL is not set.",
        "",
        "This command seeds the demo dataset and then reads the rows back, so it needs a branch to",
        "write to: `neon env pull` in the repo root, or export the demo branch's connection string.",
        "",
      ].join("\n"),
    );
    return 1;
  }
  if ((process.env.NEON_AUTH_BASE_URL ?? "").trim() === "") {
    if (GATE) {
      step("○", "skipped", "NEON_AUTH_BASE_URL is not set (the signed-in read needs a session)");
      return 0;
    }
    console.error(
      "\n✗ demo:verify — NEON_AUTH_BASE_URL is not set: the signed-in read cannot get a session.\n",
    );
    return 1;
  }
  if (expectations === null) {
    console.error(
      [
        "",
        `✗ demo:verify — there is no ${EXPECTATIONS_LABEL}.`,
        "",
        "The file is authored, not generated: it names the routes and the strings each page must and",
        "must not carry, which is the reviewable half. Create it with those, then run",
        "`pnpm demo:verify --update` to record the row counts and statuses this branch produces.",
        "",
      ].join("\n"),
    );
    return 1;
  }

  const served = await servedPage();
  if (!served.answers) {
    if (GATE) {
      step("○", "skipped", `nothing is listening at ${BASE_URL}`);
      return 0;
    }
    console.error(
      [
        "",
        `✗ demo:verify — nothing is listening at ${BASE_URL}.`,
        "",
        "Start the app against the demo branch, then point this command at it:",
        "",
        "  BRAND=alignsynch pnpm build && pnpm start        # or: pnpm dev",
        `  BASE_URL=${BASE_URL} pnpm demo:verify`,
        "",
      ].join("\n"),
    );
    return 1;
  }

  // The build that answers the request is the one the assertions are about, so the brand is read
  // from the page it returned — never from this shell's `BRAND`, which describes a build, not a
  // server, and can disagree with a perfectly good one.
  if (typeof expectations.brand === "string" && expectations.brand.trim() !== "") {
    const mismatch = brandMismatch({ expected: expectations.brand, html: served.html });
    if (mismatch !== null) {
      if (GATE) {
        step("○", "skipped", mismatch);
        return 0;
      }
      refused(
        [
          `${EXPECTATIONS_LABEL} was recorded for brand "${expectations.brand}", and ${mismatch}.`,
          "",
          "The demo dataset is AlignSynch's, so the strings in the file (the prices, the headings)",
          "are that build's. Serve the build the file describes, or record a second file.",
          "",
          `  BRAND=${expectations.brand} pnpm build && BRAND=${expectations.brand} pnpm start`,
        ].join("\n"),
      );
    }
  }

  const bundle = JSON.parse(readFileSync(BUNDLE_PATH, "utf8"));
  say(
    `demo:verify — ${BASE_URL} · brand ${expectations.brand ?? "(unstated)"} · ${expectations.dataset ?? BUNDLE_FILE}`,
  );
  if (UPDATE) say("             --update: the observed half of the file will be rewritten");

  // --- the input: the committed bundle must still be the canonical export ---------------------
  const bundleCheck = runScript("bundles", { args: ["export", "--dataset", "--check"] });
  if (!bundleCheck.ok) {
    refused(
      [
        `\`pnpm bundles export --dataset --check\` failed, so ${BUNDLE_FILE} is not the canonical`,
        "export of data/assessments.ts. The seed reads the bundle, so seeding it now would install a",
        "dataset the fixtures do not author. Nothing was changed.",
        "",
        "  pnpm bundles export --dataset --fix    # rewrite the committed bundle from the fixtures",
        "",
        ...tail(bundleCheck.output),
      ].join("\n"),
    );
  }
  step("✓", "bundle", `the committed bundle is the canonical export (${seconds(bundleCheck.ms)})`);

  /* --- the branch lock: this run holds it from its seed to its last read (#1321) --------------
   *
   * Taken here — after every refusal above, before the seed — and released in the `finally` below,
   * which every path after this point passes through (the row, session, property and problem
   * branches all return early). Refusals stay outside it on purpose: a run that refuses to proceed
   * has no reason to park every other seeder on the branch behind it.
   *
   * `demo:verify` used to be the thing that reported a missing demo account: the seed it spawns took
   * `algn/1` and released it when the child exited, so the counts, the sign-ins and the route reads
   * that follow ran with nothing held and a concurrent `pnpm db:seed` could delete the accounts
   * mid-run. The lock is now the *run's*, and the seed runs under it via `SEED_LOCK_HELD_BY_PID`. */
  let runLock;
  try {
    runLock = await holdRunLock(seedUrl);
  } catch (error) {
    const [first, ...rest] = error.message.split("\n");
    console.log(`  ✗ lock     ${first}`);
    for (const line of rest) console.log(`             ${line}`);
    return 1;
  }
  try {
    return await runVerification({
      expectations,
      bundle,
      seedUrl,
      startedAt,
      lockPid: runLock.pid,
    });
  } finally {
    await releaseRunLock(runLock);
  }
}

/** This run's label on its own lock connection — what a `pg_locks` reader sees holding `algn/1`. */
const LOCK_APPLICATION_NAME = "demo:verify";

/**
 * The session holding this branch's seed lock — the same `pg_locks` question `scripts/db-seed.mjs`
 * asks, spelled again here because that module runs its seed at import and can never be imported.
 * `l.pid` survives a role that cannot see the other session, and `holderDescription` turns the row
 * into the one phrase both commands use.
 */
async function seedLockHolder(client) {
  const { rows } = await client.query(
    `SELECT l.pid AS pid, a.application_name, a.datname, a.state
       FROM pg_locks l
       LEFT JOIN pg_stat_activity a ON a.pid = l.pid
      WHERE l.locktype  = 'advisory'
        AND l.objsubid  = 2
        AND l.classid   = $1::int::oid
        AND l.objid     = $2::int::oid
        AND l.granted
      ORDER BY l.pid
      LIMIT 1`,
    [SEED_LOCK_NAMESPACE, SEED_LOCK_ID],
  );
  return rows[0] ?? null;
}

/**
 * Takes `algn/1` on a connection of the run's own and returns `{ client, pid }` (#1321).
 *
 * **Why the run holds it.** The dataset this command diffs against is only true while it is what the
 * branch holds. When the lock lived inside the `db:seed` child, a concurrent seeder was free to
 * delete and re-create the demo accounts while this run counted rows and signed in — measured as a
 * false `demo_account has no row for initiator@demo.alignsynch.test`, on a branch with nothing wrong
 * with it. Holding the lock across the seed, the counts, the sign-ins and every route read makes the
 * second run **wait** for the first instead of walking over it.
 *
 * **Why a separate connection.** An advisory lock belongs to the session that takes it, so this is
 * its own `Client`, opened on `seedUrl` (the branch the seed writes and the counts read) with its own
 * `application_name`, and closed when the run ends. The read client further down stays a second
 * connection with a second owner: `pg_locks` names the run, never the read session, and a query on
 * the read client cannot drop a lock by accident.
 *
 * **Why the seed's words.** `waitBudgetMs`, `SEED_LOCK_POLL_MS`, `lockWaitNotice`,
 * `lockAcquiredNotice` and `lockTimeoutMessage` are the vocabulary an operator already reads from
 * `pnpm db:seed`; forking them here would be two dialects for one lock, and the line a waiting run
 * prints has to be recognisable to whoever is waiting on the other side of it.
 */
async function holdRunLock(connectionString) {
  const client = new Client({
    connectionString,
    application_name: LOCK_APPLICATION_NAME,
  });
  await client.connect();
  try {
    const budgetMs = waitBudgetMs();
    const startedAt = Date.now();
    const tryLock = async () =>
      (
        await client.query("SELECT pg_try_advisory_lock($1::int, $2::int) AS ok", [
          SEED_LOCK_NAMESPACE,
          SEED_LOCK_ID,
        ])
      ).rows[0].ok === true;

    if (!(await tryLock())) {
      console.log(lockWaitNotice({ holder: await seedLockHolder(client), budgetMs }));
      let held = false;
      while (Date.now() - startedAt < budgetMs) {
        await new Promise((resolve) => setTimeout(resolve, SEED_LOCK_POLL_MS));
        if (await tryLock()) {
          held = true;
          break;
        }
      }
      if (!held) {
        throw new Error(lockTimeoutMessage({ holder: await seedLockHolder(client), budgetMs }));
      }
      console.log(lockAcquiredNotice({ waitedMs: Date.now() - startedAt }));
    }

    // The pid the seed is handed: a *proved* declaration, which is why it is read back from this
    // connection rather than assumed.
    const { rows } = await client.query("SELECT pg_backend_pid() AS pid");
    return { client, pid: rows[0].pid };
  } catch (error) {
    await client.end().catch(() => {});
    throw error;
  }
}

/**
 * Releases the run's lock and closes its connection — on every path, including a step that failed or
 * a route that drifted. The unlock is best-effort (a dead connection has already released it);
 * `end()` is what guarantees the backend cannot leave the branch parked after this process exits.
 */
async function releaseRunLock(lock) {
  await lock.client
    .query("SELECT pg_advisory_unlock($1::int, $2::int)", [SEED_LOCK_NAMESPACE, SEED_LOCK_ID])
    .catch(() => {});
  await lock.client.end().catch(() => {});
}

/**
 * The run itself: seed under the run's own lock, count the rows, sign in, read the routes, diff.
 *
 * Extracted from `main` so that the lock wraps **all** of it (#1321) — one `try/finally` in `main`,
 * and no early `return 1` below can escape it. `lockPid` is the pid of the connection holding
 * `algn/1`; the seed proves it against `pg_locks` and refuses by name if it cannot.
 */
async function runVerification({ expectations, bundle, seedUrl, startedAt, lockPid }) {
  // --- seed ------------------------------------------------------------------------------------
  const seed = runScript("db:seed", {
    env: {
      DEMO_AUTH: "1",
      // Pin the seed to the branch this run counted and diffed, whatever the shell's two names say.
      DATABASE_URL: seedUrl,
      DATABASE_URL_UNPOOLED: seedUrl,
      // #1321 — the lock is this run's, not the child's. The seed proves the declaration against
      // `pg_locks` before any DELETE and refuses by name when that pid holds nothing, so this cannot
      // be used to skip the lock; the label is what its inherited-lock line names.
      [SEED_LOCK_HELD_BY_PID_ENV]: String(lockPid),
      [SEED_LOCK_HELD_BY_ENV]: LOCK_APPLICATION_NAME,
    },
  });
  if (!seed.ok) {
    console.log("  ✗ seed     `pnpm db:seed` failed — the branch is not in the state this dataset");
    console.log("             describes, so there is nothing honest to diff against:");
    for (const line of tail(seed.output)) console.log(line);
    console.log("");
    console.log(
      "      Read the failure line before this one: a held seed lock means another `pnpm db:seed`",
    );
    console.log(
      "      is working on this branch right now — re-run when it finishes; that is not this tree.",
    );
    console.log(
      "      Otherwise, a demo branch carrying records this dataset does not author is not the demo",
    );
    console.log(
      "      (another run's flow rows, an e2e's leftovers). `pnpm demo:reset` puts it back.",
    );
    return 1;
  }
  step(
    "✓",
    "seed",
    `${bundle.payload.templates.length} template(s) + ${bundle.payload.sessions.length} session(s) from ${BUNDLE_FILE} (${seconds(seed.ms)})`,
  );

  // --- the data half: the rows the seed just wrote, counted, never remembered -------------------
  const client = new Client({
    connectionString: writeDatabaseUrl(),
    application_name: "demo:verify",
  });
  await client.connect();
  const counts = {};
  /** `role → { cookies, facts }` for each account a route is fetched as. */
  const sessions = new Map();
  /** What each route actually answered, kept for the `--update` recomputation. */
  const observations = [];
  /** Problems that `--update` would repair (a moved status or redirect), not the authored half. */
  let repairedByUpdate = 0;

  try {
    for (const [table, sql] of Object.entries(COUNT_SQL)) {
      const { rows } = await client.query(sql);
      counts[table] = rows[0].n;
    }

    const rowKeys = Object.keys(expectations.rows ?? {});
    const unknown = rowKeys.filter((table) => counts[table] === undefined);
    if (unknown.length > 0) {
      console.log(
        `  ✗ rows     ${EXPECTATIONS_LABEL} counts table(s) this run does not know: ${unknown.join(", ")}`,
      );
      return 1;
    }
    if (!UPDATE) {
      for (const table of rowKeys) {
        if (counts[table] !== expectations.rows[table]) {
          problem(
            "rows",
            `${table}: ${counts[table]} row(s) in the database, ${expectations.rows[table]} expected — \`pnpm demo:verify --update\` if the dataset really changed`,
          );
        }
      }
    }
    if (problems === 0) {
      step(
        "✓",
        "rows",
        Object.keys(expectations.rows ?? counts)
          .map((table) => `${table} ${counts[table]}`)
          .join(" · "),
      );
    }

    /* t_6cc2b56a — the activity feed's two halves, checked the two different ways they deserve.
     *
     * `activity_event_seed` is already an exact count above (it is in `COUNT_SQL`), because the seed
     * derives that timeline from the dataset and replaces it on every run: a number that moves is
     * drift.
     *
     * The **simulate** source is the opposite fact — an explicit action a person presses, which
     * writes one row per seat on the relationships the branch happens to have live, stamped at the
     * instant it ran. Two things follow, and both are checked here rather than assumed:
     *
     *   * it is **pressed twice**, and the count must not move between the presses. That is the
     *     idempotency claim proved against a real database instead of against the derivation — the
     *     second press replaces the first's rows, and a writer that appended would double the band;
     *   * the count is held to a **band** (`activity.simulate` in the expectations file), never an
     *     exact number: the action writes as many rows as the branch has live relationships and
     *     stamps them at the instant it ran, so an exact assertion would fail the first time
     *     somebody pressed it on a different dataset. The band's ceiling is held to
     *     `SIMULATE_MAX_EVENTS` by `tests/activity-events.test.ts`, so it cannot be widened to hide
     *     a duplicate writer.
     *
     * This is the check **invoking** the action, the same way it invokes `pnpm db:seed` above — not
     * a scheduler. Nothing in this tree schedules either of them, and `vercel.json` has no `crons`
     * block (0044's header says why that matters). */
    const simulateEnv = { DATABASE_URL: seedUrl, DATABASE_URL_UNPOOLED: seedUrl };
    const simulateCount = async () => {
      const { rows } = await client.query(
        "SELECT count(*)::int AS n FROM activity_event WHERE source = 'simulate'",
      );
      return rows[0]?.n ?? 0;
    };

    const firstPress = runScript("demo:simulate-activity", { env: simulateEnv });
    if (!firstPress.ok) {
      console.log(`  ✗ activity \`pnpm demo:simulate-activity\` failed — the simulate path is a`);
      console.log(
        "             writer this check exists to hold, so a failure here is not a skip:",
      );
      for (const line of tail(firstPress.output)) console.log(line);
      return 1;
    }
    const afterFirst = await simulateCount();
    const secondPress = runScript("demo:simulate-activity", { env: simulateEnv });
    if (!secondPress.ok) {
      console.log(`  ✗ activity \`pnpm demo:simulate-activity\` failed on the second press:`);
      for (const line of tail(secondPress.output)) console.log(line);
      return 1;
    }
    const afterSecond = await simulateCount();

    const band = {
      min: expectations.activity?.simulate?.min,
      max: expectations.activity?.simulate?.max,
    };
    const bandProblems = simulateBoundProblems({ count: afterSecond, ...band });
    if (bandProblems.length > 0) {
      problem("activity", `${bandProblems[0]} (\`activity.simulate\` in ${EXPECTATIONS_LABEL})`);
    }
    if (afterFirst !== afterSecond) {
      problem(
        "activity",
        `a second simulate press moved the count from ${afterFirst} to ${afterSecond} — the writer appends where it must replace, and the feed would grow a duplicate timeline on every press`,
      );
    }
    if (bandProblems.length === 0 && afterFirst === afterSecond) {
      const bandText = `${band.min ?? 0}–${band.max ?? "∞"}`;
      step(
        "✓",
        "activity",
        `${counts.activity_event_seed} seeded event(s), exactly · ${afterSecond} simulated, inside the band ${bandText}, and unmoved by a second press (a replay replaces, it does not append) — written by an explicit action, never a schedule`,
      );
    }

    // --- the session the signed-in read runs under -------------------------------------------
    const { DEMO_ACCOUNT_EMAILS } = await import("@/lib/auth/demo-accounts.ts");
    const roles = [
      ...new Set(
        expectations.routes
          .filter((route) => route.session !== undefined)
          .map((route) => route.session),
      ),
    ];
    for (const role of roles) {
      const email = DEMO_ACCOUNT_EMAILS[role];
      if (email === undefined) {
        problem(
          "session",
          `"${role}" is not one of the demo accounts (${Object.keys(DEMO_ACCOUNT_EMAILS).join(", ")})`,
        );
        continue;
      }
      const { rows } = await client.query(
        "SELECT user_id, password FROM demo_account WHERE email = $1",
        [email],
      );
      const account = rows[0];
      if (account === undefined) {
        problem(
          "session",
          `demo_account has no row for ${email} — \`DEMO_AUTH=1 pnpm db:seed\` creates it`,
        );
        continue;
      }
      const signed = await signIn(email, account.password);
      if (signed.status !== 200) {
        problem("session", `${email} sign-in answered HTTP ${signed.status}`);
        continue;
      }
      const facts = await seededRelationship(client, account.user_id);
      if (facts === null) {
        problem(
          "session",
          `${email} is a party to no seeded relationship — the demo binding did not land`,
        );
        continue;
      }
      sessions.set(role, { cookies: signed.cookies, facts });
      step("✓", "session", `${email} signed in; the seeded relationship is "${facts.title}"`);
    }

    // --- the rendered half --------------------------------------------------------------------
    for (const route of expectations.routes) {
      const session = route.session === undefined ? undefined : sessions.get(route.session);
      if (route.session !== undefined && session === undefined) {
        // The sign-in above already named the problem; a route cannot be fetched without it.
        continue;
      }

      let observed;
      try {
        observed = await fetchRoute(route, session?.cookies);
      } catch (error) {
        problem(routeLabel(route), `request failed — ${error.message}`);
        continue;
      }
      observations.push({
        key: routeKey(route),
        status: observed.status,
        redirect:
          observed.status >= 300 && observed.status < 400
            ? (locationPath(observed.location) ?? undefined)
            : undefined,
        html: observed.html,
      });

      const misses = routeProblems(route, observed);
      if (route.mustNameRelationship === true && session !== undefined) {
        for (const needle of [session.facts.title, session.facts.counterparty]) {
          if (typeof needle === "string" && !observed.html.includes(needle)) {
            misses.push(`the rendered list does not name the seeded ${JSON.stringify(needle)}`);
          }
        }
      }

      const before = problems;
      if (misses.length > 0) {
        problem(routeLabel(route), misses[0]);
        for (const extra of misses.slice(1)) console.log(`      ${extra}`);
      }
      if (UPDATE && (route.status !== observed.status || !redirectHolds(route, observed))) {
        repairedByUpdate += problems - before;
      }
      if (misses.length === 0) {
        const detail = [String(observed.status)];
        if (route.redirect !== undefined) detail.push(`→ ${locationPath(observed.location)}`);
        if (route.mustContain !== undefined) {
          detail.push(`${route.mustContain.length} string(s) present`);
        }
        if (route.mustNameRelationship === true && session !== undefined) {
          detail.push(`names "${session.facts.title}"`);
        }
        console.log(`  ✓ ${routeLabel(route)} ${detail.join(" · ")}`);
      }
    }
  } finally {
    await client.end().catch(() => {});
  }

  // --- the verdict ---------------------------------------------------------------------------
  if (UPDATE) {
    const fatal = observations.filter(
      (observed) => observed.status === 0 || observed.status >= 500,
    );
    if (fatal.length > 0) {
      console.log(
        `\n✗ demo:verify --update — refusing to write ${fatal.length} server error(s) into the baseline:`,
      );
      for (const observed of fatal)
        console.log(`      ${observed.key} answered ${observed.status}`);
      return 1;
    }
    const { next, changes } = reviseExpectations(expectations, {
      rows: counts,
      routes: observations,
    });
    // Write, then let the repo's formatter settle the bytes: `biome check` owns JSON formatting in
    // this tree (inline short arrays), so a file this command wrote has to come out the same shape
    // or `format:check` fails on a baseline that is otherwise correct. The comparison is on what is
    // on disk *after* formatting, which is what makes "no diff when nothing changed" a property of
    // the file rather than of `JSON.stringify`.
    const before = readFileSync(EXPECTATIONS_FILE, "utf8");
    writeFileSync(EXPECTATIONS_FILE, serializeExpectations(next));
    const formatted = formatExpectationsFile();
    const after = readFileSync(EXPECTATIONS_FILE, "utf8");
    if (after === before) {
      step("·", "update", `${EXPECTATIONS_LABEL} already records this run — no diff`);
    } else {
      const summary =
        changes.length === 0
          ? "rewritten (no count or status changed — the file's formatting followed the run)"
          : `rewritten (${changes.length} change(s))`;
      step("✎", "update", `${EXPECTATIONS_LABEL} ${summary}`);
      for (const change of changes) console.log(`      ${change}`);
      if (!formatted) {
        console.log(
          "      (biome was not available, so the file carries JSON.stringify's own formatting)",
        );
      }
    }
    const remaining = problems - repairedByUpdate;
    if (remaining > 0) {
      console.log(
        `\n✗ demo:verify --update — the observed half is recorded, but ${remaining} authored assertion(s) still fail.`,
      );
      return 1;
    }
    say(
      `\n✓ demo:verify --update — ${observations.length} route(s), the file records this run (${seconds(Date.now() - startedAt)})`,
    );
    return 0;
  }

  if (problems > 0) {
    say(`\n✗ demo:verify — ${problems} problem(s) against ${EXPECTATIONS_LABEL}`);
    return 1;
  }
  say(
    `\n✓ demo:verify — ${observations.length} route(s), ${Object.keys(expectations.rows ?? {}).length} row count(s), no drift (${seconds(Date.now() - startedAt)})`,
  );
  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error(`\n✗ demo:verify failed: ${error.message}`);
    process.exitCode = 1;
  });
