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
 * boundary, and one signed-in read of `/assessment/instances` that must name a real relationship.
 * It is deliberately small. A 40-route sweep nobody reads is worse than nine lines that catch a
 * 500, a missing price, or a list that renders "could not be read".
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
 */
const COUNT_SQL = {
  record: "SELECT count(*)::int AS n FROM record WHERE record_type = 'assessment'",
  item: "SELECT count(*)::int AS n FROM item",
  response_option: "SELECT count(*)::int AS n FROM response_option",
  relationship: "SELECT count(*)::int AS n FROM relationship",
  session: "SELECT count(*)::int AS n FROM session",
  party: "SELECT count(*)::int AS n FROM party",
  opinion: "SELECT count(*)::int AS n FROM opinion",
  billing_plan: "SELECT count(*)::int AS n FROM billing_plan",
  demo_account: "SELECT count(*)::int AS n FROM demo_account",
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

  // --- seed ------------------------------------------------------------------------------------
  const seed = runScript("db:seed", {
    env: {
      DEMO_AUTH: "1",
      // Pin the seed to the branch this run counted and diffed, whatever the shell's two names say.
      DATABASE_URL: seedUrl,
      DATABASE_URL_UNPOOLED: seedUrl,
    },
  });
  if (!seed.ok) {
    console.log("  ✗ seed     `pnpm db:seed` failed — the branch is not in the state this dataset");
    console.log("             describes, so there is nothing honest to diff against:");
    for (const line of tail(seed.output)) console.log(line);
    console.log("");
    console.log(
      "      A demo branch carrying records this dataset does not author is not the demo",
    );
    console.log(
      "      (another run's flow rows, an e2e's leftovers). `pnpm demo:reset` puts it back.",
    );
    return 1;
  }
  step(
    "✓",
    "seed",
    `${bundle.payload.templates.length} template(s) + ${bundle.payload.instances.length} instance(s) from ${BUNDLE_FILE} (${seconds(seed.ms)})`,
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
