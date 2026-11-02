/**
 * The rules `pnpm demo:verify` applies, as pure functions.
 *
 * The command itself (`scripts/demo-verify.mjs`) is orchestration: refuse, check the bundle, seed,
 * count, fetch. Everything that can be *wrong* about an answer lives here, so it can be proved
 * without a database, a server or a Neon key — the same split `scripts/demo-source-guard.mjs` uses
 * for the demo reset, and for the same reason: a rule that only exists inside a script nobody can
 * run offline is a rule nobody can test.
 *
 * Three rules, each with one job:
 *
 *   productionRefusal()      may this command touch this database at all? A demo seeder pointed at
 *                            the live branch writes fake relationships next to real ones, so this
 *                            is a **refusal** with its own sentence, never a warning.
 *   routeProblems()          does one rendered answer match one line of the expectations file?
 *                            Status first, then the redirect's path, then the first missing and the
 *                            first forbidden string — the first of each, because that is the line a
 *                            reader can act on, and a wall of 40 misses hides the one that matters.
 *   reviseExpectations()     what `--update` may rewrite: the **observed** half (row counts,
 *                            statuses, redirect targets) and nothing else. `mustContain` /
 *                            `mustNotContain` are authored expectations, so an update that quietly
 *                            erased them would turn a red run green by forgetting what was asked.
 *
 * `serializeExpectations()` is here too, because "`--update` on an unchanged app produces no diff"
 * is a property of the *bytes* this module writes, not of a promise in a comment.
 */

/** The one branch name that is never a demo. */
export const PRODUCTION_NEON_BRANCH = "production";

/**
 * The production endpoint's own prefix. `NEON_BRANCH` is a label somebody typed into `.env.local`
 * and can be stale or absent; the host is what the connection actually opens, so the check needs
 * both and refuses on either.
 */
export const PRODUCTION_HOST_MARKER = "ep-winter-block";

/** The host of a connection string, or `null` when it does not parse. Never the URL itself. */
export function hostOf(databaseUrl) {
  if (typeof databaseUrl !== "string" || databaseUrl.trim() === "") return null;
  try {
    return new URL(databaseUrl.trim()).hostname;
  } catch {
    return null;
  }
}

/**
 * Why this run must not proceed, or `null` when it may.
 *
 * Deliberately a message rather than a boolean: the operator needs to know *which* of the two
 * facts refused them — a stale `NEON_BRANCH=production` in a shell that is actually pointed at the
 * demo, or a `DATABASE_URL` that really is the live endpoint — because the fixes are different.
 * Both sentences end with "Nothing was changed.", so nobody goes looking for a half-written demo.
 *
 * An unparseable or absent URL is not refused here: "no database" is a different state with its
 * own answer (`demo-verify.mjs` skips in `--gate` mode and fails with a named message otherwise),
 * and two rules for one case can disagree.
 *
 * @param {{ databaseUrls?: string[], neonBranch?: string }} [options]
 */
export function productionRefusal({ databaseUrls = [], neonBranch } = {}) {
  const branch = typeof neonBranch === "string" ? neonBranch.trim().toLowerCase() : "";
  if (branch === PRODUCTION_NEON_BRANCH) {
    return [
      `NEON_BRANCH=${PRODUCTION_NEON_BRANCH} names the live branch. This command seeds the demo dataset`,
      "— fake relationships, fake parties and three demo accounts — and against production those rows",
      "land next to real ones. Nothing was changed.",
      "",
      "Point the shell at the demo branch (unset NEON_BRANCH, or set it to the branch DATABASE_URL",
      "opens) and re-run.",
    ].join("\n");
  }

  // **Every** connection string in this shell, not just the one the seed uses. The app reads its
  // own `DATABASE_URL`; a run that seeded the demo through `DATABASE_URL_UNPOOLED` while the server
  // it drives read `DATABASE_URL` on the live branch would write demo rows nowhere and then diff
  // production's pages against a dataset it never saw.
  for (const url of databaseUrls) {
    const host = hostOf(url);
    if (host?.toLowerCase().includes(PRODUCTION_HOST_MARKER)) {
      return [
        `A connection string in this shell opens ${host}, the production endpoint (it carries`,
        `"${PRODUCTION_HOST_MARKER}"). This command seeds the demo dataset and would write fake`,
        "relationships and fake accounts next to real rows — or diff a live page against a demo it",
        "never seeded. Nothing was changed.",
        "",
        "Run `neon env pull` for the demo branch, or export that branch's connection string, and re-run.",
      ].join("\n");
    }
  }

  return null;
}

/**
 * The Neon endpoint a connection string opens, without the `-pooler` suffix: two URLs that pool and
 * bypass the pooler for the same branch share it, and two different branches never do.
 */
export function endpointOf(databaseUrl) {
  const host = hostOf(databaseUrl);
  if (host === null) return null;
  return host.split(".")[0].replace(/-pooler$/, "");
}

/**
 * Does the app read the branch this command seeds? `null` when it does, a sentence when it does not.
 *
 * This is the one mismatch a seeder can create for itself: `db:seed` honours
 * `DATABASE_URL_UNPOOLED || DATABASE_URL` (the `db:*` scripts' own order), while the running app
 * reads `DATABASE_URL` alone. Point those at two branches and every page is "empty" — a green-looking
 * run that proves nothing, or a red one that blames the app for the shell. A pooler URL and a direct
 * URL for the same branch are the same branch, which is why the endpoint id is compared, not the host.
 */
export function endpointMismatch({ appUrl, seedUrl }) {
  const seed = endpointOf(seedUrl);
  if (seed === null || typeof appUrl !== "string" || appUrl.trim() === "") return null;
  const app = endpointOf(appUrl);
  if (app === null || app === seed) return null;
  return [
    `the app at BASE_URL reads DATABASE_URL on ${app}, but this command seeded ${seed}.`,
    "Every signed-in page would be reading a branch that never saw these rows, so the diff below",
    "would describe a database this check did not seed.",
    "",
    "  DATABASE_URL=$(the demo branch's connection string) pnpm demo:verify",
  ].join("\n");
}

/**
 * The one brand name each build renders in its chrome. Two ids, two wordmarks, and the reason the
 * check reads the **page** rather than the environment: `BRAND` describes how a build was compiled,
 * and the server that answers a request may have been built by a different shell.
 */
export const BRAND_NAMES = { quizhub: "QuizHub", alignsynch: "AlignSynch" };

/** Is this page the one the expectations file was recorded against? `null` when it is. */
export function brandMismatch({ expected, html }) {
  if (typeof expected !== "string" || expected.trim() === "") return null;
  const wanted = expected.trim().toLowerCase();
  const name = BRAND_NAMES[wanted];
  if (name === undefined) {
    return `"${expected}" is not a brand this check knows (${Object.keys(BRAND_NAMES).join(", ")})`;
  }
  if (typeof html === "string" && html.includes(name)) return null;

  const other = Object.entries(BRAND_NAMES).find(
    ([id, otherName]) => id !== wanted && typeof html === "string" && html.includes(otherName),
  );
  return other === undefined
    ? `the page at BASE_URL names neither brand, so it is not the "${wanted}" build this file describes`
    : `the app at BASE_URL is the "${other[0]}" build (its page carries "${other[1]}"), not "${wanted}"`;
}

/** The path of a `Location` header, without the origin or the query. `null` when there is none. */
export function locationPath(location) {
  if (typeof location !== "string" || location.trim() === "") return null;
  const value = location.trim();
  // A relative Location is a path already; an absolute one is parsed so a redirect to another host
  // is compared by path too, which is what the boundary contract in the expectations file says.
  try {
    return new URL(value, "http://localhost").pathname;
  } catch {
    return null;
  }
}

/**
 * Does one rendered answer match one expectation? Returns human-readable problems, `[]` when not.
 *
 * A wrong status short-circuits: when `/pricing` answers 500, "missing `$8.95`" is noise about a
 * page that never rendered, and the one line the reader needs is the status. The redirect's path
 * is compared by prefix, so `/login` matches `/login?next=%2Fdashboard` — the `next` parameter is
 * the boundary working, not drift.
 *
 * `mustContain` and `mustNotContain` report the **first** offender each: the first missing string is
 * the one a copy change removed, and every further miss is the same fact.
 */
export function routeProblems(expected, observed) {
  const problems = [];
  if (expected.status !== observed.status) {
    problems.push(`expected ${expected.status} got ${observed.status}`);
    return problems;
  }

  if (expected.redirect !== undefined) {
    const path = locationPath(observed.location);
    if (path === null) {
      problems.push(`expected a redirect to ${expected.redirect} and got no Location header`);
    } else if (!path.startsWith(expected.redirect)) {
      problems.push(`expected a redirect to ${expected.redirect} got ${path}`);
    }
  }

  const html = typeof observed.html === "string" ? observed.html : "";
  for (const needle of expected.mustContain ?? []) {
    if (!html.includes(needle)) {
      problems.push(`missing ${JSON.stringify(needle)}`);
      break;
    }
  }
  for (const needle of expected.mustNotContain ?? []) {
    if (html.includes(needle)) {
      problems.push(`found ${JSON.stringify(needle)}, which this page must not carry`);
      break;
    }
  }
  return problems;
}

/**
 * The next expectations file, given this run's observations — and what changed, one line per change.
 *
 * `observations` is keyed the way the file is: `{ rows, routes: [{ key, status, redirect }] }`,
 * where `key` is the route's stable identity (`path`, plus `@session` when a route is fetched as a
 * signed-in visitor). A route the file has and the run did not observe keeps its previous values:
 * a run that skipped a route must not silently drop it.
 *
 * The shape of the written file is fixed here — key order included — because `--update`'s whole
 * contract is "no diff when nothing changed", and `JSON.stringify` of an object built in a
 * different order would produce one every time.
 */
export function reviseExpectations(previous, observations) {
  const changes = [];
  const rows = {};
  for (const [table, expected] of Object.entries(previous.rows ?? {})) {
    const observed = observations.rows?.[table];
    if (observed === undefined) {
      rows[table] = expected;
      continue;
    }
    rows[table] = observed;
    if (observed !== expected) changes.push(`rows.${table} ${expected} → ${observed}`);
  }

  const byKey = new Map((observations.routes ?? []).map((route) => [route.key, route]));
  const routes = (previous.routes ?? []).map((route) => {
    const key = routeKey(route);
    const observed = byKey.get(key);
    if (observed === undefined) return route;

    const next = routeForFile(route, observed);
    if (next.status !== route.status)
      changes.push(`${key} status ${route.status} → ${next.status}`);
    if ((route.redirect ?? null) !== (next.redirect ?? null)) {
      changes.push(`${key} redirect ${route.redirect ?? "none"} → ${next.redirect ?? "none"}`);
    }
    return next;
  });

  return {
    next: {
      dataset: previous.dataset,
      brand: previous.brand,
      rows,
      routes,
    },
    changes,
  };
}

/** A route's stable identity: the path, and the account it is fetched as when it has one. */
export function routeKey(route) {
  return route.session === undefined ? route.path : `${route.path}@${route.session}`;
}

/**
 * One route, written the way the file spells it: the authored fields kept in place, and the two
 * observed fields (`status`, `redirect`) taken from the run. `mustNameRelationship` and the string
 * lists are passed through untouched — see this module's header.
 */
export function routeForFile(route, observed) {
  const next = { path: route.path };
  if (route.session !== undefined) next.session = route.session;
  next.status = observed.status;
  if (observed.redirect !== undefined) next.redirect = observed.redirect;
  if (route.mustContain !== undefined) next.mustContain = route.mustContain;
  if (route.mustNotContain !== undefined) next.mustNotContain = route.mustNotContain;
  if (route.mustNameRelationship !== undefined)
    next.mustNameRelationship = route.mustNameRelationship;
  return next;
}

/**
 * The bytes of the file. Two-space JSON, sorted-by-construction key order, one trailing newline —
 * so `--update` on an unchanged app rewrites the same bytes and `git diff` stays empty.
 */
export function serializeExpectations(expectations) {
  return `${JSON.stringify(expectations, null, 2)}\n`;
}
