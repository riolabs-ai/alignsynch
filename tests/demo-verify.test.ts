/**
 * `pnpm demo:verify`'s rules, proved with no database, no server and no Neon key.
 *
 * The command's job is to turn "does the app still behave on demo data?" into a diff, and the
 * three ways that can go wrong are all pure: seeding the live branch, comparing a rendered page to
 * the wrong expectation, and `--update` quietly rewriting something it should not. Each rule is a
 * function in `scripts/demo-verify-rules.mjs` for exactly that reason — the script is orchestration
 * (spawn, seed, fetch), so the parts that decide an answer can be tested here.
 *
 * The case worth reading first is the last one: `--update` on an unchanged app must produce **no
 * diff**, because that is what makes `data/verify/demo-expectations.json` a baseline instead of a
 * transcript. It is asserted on the bytes, not on a promise.
 */
import { describe, expect, it } from "vitest";

import {
  DEFAULT_WAIT_SECONDS,
  SEED_LOCK_ID,
  SEED_LOCK_NAMESPACE,
  holderDescription,
  lockAcquiredNotice,
  lockTimeoutMessage,
  lockWaitNotice,
  waitBudgetMs,
} from "../scripts/db-seed-lock.mjs";
import {
  BRAND_NAMES,
  brandMismatch,
  endpointMismatch,
  endpointOf,
  locationPath,
  productionRefusal,
  reviseExpectations,
  routeKey,
  routeProblems,
  serializeExpectations,
} from "../scripts/demo-verify-rules.mjs";

const DEMO_URL =
  "postgresql://user:pw@ep-crimson-truth-b4ppwxrp.c-6.us-east-2.aws.neon.tech/neondb";

/** One line of the expectations file, as much of it as these cases read. */
type RouteLine = {
  path?: string;
  session?: string;
  status?: number;
  redirect?: string;
  mustContain?: string[];
  mustNotContain?: string[];
  mustNameRelationship?: boolean;
};

describe("productionRefusal", () => {
  it("refuses NEON_BRANCH=production", () => {
    const message = productionRefusal({ databaseUrls: [DEMO_URL], neonBranch: "production" });
    expect(message).not.toBeNull();
    expect(message).toContain("Nothing was changed.");
  });

  it("reads NEON_BRANCH the way an operator types it", () => {
    expect(
      productionRefusal({ databaseUrls: [DEMO_URL], neonBranch: "  PRODUCTION " }),
    ).not.toBeNull();
  });

  it("refuses the production host even when NEON_BRANCH is absent or stale", () => {
    for (const neonBranch of [undefined, "", "demo"]) {
      const message = productionRefusal({
        databaseUrls: ["postgresql://u:pw@ep-winter-block-123456.us-east-2.aws.neon.tech/neondb"],
        neonBranch,
      });
      expect(message, `NEON_BRANCH=${String(neonBranch)}`).not.toBeNull();
      expect(message).toContain("ep-winter-block");
    }
  });

  it("refuses when **any** connection string is production, not just the one the seed uses", () => {
    // The failure this case exists for: `DATABASE_URL_UNPOOLED` on the demo, `DATABASE_URL` —
    // the one the running app reads — on the live branch.
    const message = productionRefusal({
      databaseUrls: [DEMO_URL, "postgresql://u:pw@ep-winter-block-b4bkk1xc-pooler.x.neon.tech/n"],
      neonBranch: "demo",
    });
    expect(message).not.toBeNull();
    expect(message).toContain("ep-winter-block");
  });

  it("allows the demo branch", () => {
    expect(productionRefusal({ databaseUrls: [DEMO_URL], neonBranch: "demo" })).toBeNull();
  });

  it("does not decide the 'no database' case — that answer belongs to the script", () => {
    expect(productionRefusal({ databaseUrls: [], neonBranch: undefined })).toBeNull();
    expect(productionRefusal({ databaseUrls: ["not a url"], neonBranch: "demo" })).toBeNull();
  });
});

describe("endpointMismatch", () => {
  const direct = "postgresql://u:pw@ep-crimson-truth-b4ppwxrp.c-6.us-east-2.aws.neon.tech/neondb";
  const pooled =
    "postgresql://u:pw@ep-crimson-truth-b4ppwxrp-pooler.c-6.us-east-2.aws.neon.tech/neondb";

  it("treats the pooler and the direct host of one branch as one branch", () => {
    expect(endpointOf(pooled)).toBe(endpointOf(direct));
    expect(endpointMismatch({ appUrl: pooled, seedUrl: direct })).toBeNull();
  });

  it("refuses an app pointed at a branch this run did not seed", () => {
    const message = endpointMismatch({
      appUrl: "postgresql://u:pw@ep-winter-block-b4bkk1xc-pooler.x.neon.tech/neondb",
      seedUrl: direct,
    });
    expect(message).toContain("ep-winter-block-b4bkk1xc");
    expect(message).toContain("ep-crimson-truth-b4ppwxrp");
  });

  it("says nothing when the app's URL is not in this shell", () => {
    expect(endpointMismatch({ appUrl: undefined, seedUrl: direct })).toBeNull();
    expect(endpointMismatch({ appUrl: "", seedUrl: direct })).toBeNull();
  });
});

describe("brandMismatch", () => {
  it("accepts the page the file was recorded against", () => {
    expect(brandMismatch({ expected: "alignsynch", html: "<h1>AlignSynch</h1>" })).toBeNull();
  });

  it("names the build that actually answered", () => {
    const message = brandMismatch({ expected: "alignsynch", html: "<h1>QuizHub</h1>" });
    expect(message).toContain("quizhub");
    expect(message).toContain("QuizHub");
  });

  it("says so when the page names no brand at all", () => {
    const message = brandMismatch({ expected: "alignsynch", html: "<h1>Internal error</h1>" });
    expect(message).toContain("neither brand");
  });

  it("refuses a brand id this check does not know", () => {
    const message = brandMismatch({ expected: "acme", html: "<h1>AlignSynch</h1>" });
    expect(message).toContain("not a brand this check knows");
    expect(message).toContain(Object.keys(BRAND_NAMES).join(", "));
  });
});

describe("locationPath", () => {
  it("keeps the path and drops the origin and the query", () => {
    expect(locationPath("/login?next=%2Fdashboard")).toBe("/login");
    expect(locationPath("http://localhost:3000/login?next=%2F")).toBe("/login");
  });

  it("is null when there is no Location header", () => {
    expect(locationPath("")).toBeNull();
    expect(locationPath(undefined)).toBeNull();
  });
});

describe("routeProblems", () => {
  const publicPage = {
    path: "/pricing",
    status: 200,
    mustContain: ["$8.95", "$16.95"],
    mustNotContain: ["captcha"],
  };

  it("passes when the page carries every string and nothing forbidden", () => {
    expect(
      routeProblems(publicPage, { status: 200, location: "", html: "<p>$8.95 $16.95</p>" }),
    ).toEqual([]);
  });

  it("reports a wrong status first and says nothing about strings", () => {
    expect(routeProblems(publicPage, { status: 500, location: "", html: "boom" })).toEqual([
      "expected 200 got 500",
    ]);
  });

  it("names the first missing string", () => {
    expect(routeProblems(publicPage, { status: 200, location: "", html: "<p>$8.95</p>" })).toEqual([
      'missing "$16.95"',
    ]);
  });

  it("names the first forbidden string it found", () => {
    expect(
      routeProblems(publicPage, {
        status: 200,
        location: "",
        html: "<p>$8.95 $16.95</p><p>captcha</p>",
      }),
    ).toEqual(['found "captcha", which this page must not carry']);
  });

  it("matches a redirect by path, so the boundary contract is not a query string", () => {
    const gated = { path: "/dashboard", status: 307, redirect: "/login" };
    expect(
      routeProblems(gated, { status: 307, location: "/login?next=%2Fdashboard", html: "" }),
    ).toEqual([]);
    expect(routeProblems(gated, { status: 307, location: "/pricing", html: "" })).toEqual([
      "expected a redirect to /login got /pricing",
    ]);
    expect(routeProblems(gated, { status: 307, location: "", html: "" })).toEqual([
      "expected a redirect to /login and got no Location header",
    ]);
  });
});

describe("reviseExpectations", () => {
  /** The file `data/verify/demo-expectations.json` carries, in miniature. */
  const file = {
    dataset: "demo-dataset.alignsynch.json",
    brand: "alignsynch",
    rows: { record: 8, relationship: 4 },
    routes: [
      { path: "/pricing", status: 200, mustContain: ["$8.95"], mustNotContain: ["captcha"] },
      {
        path: "/assessment/instances",
        session: "initiator",
        status: 200,
        mustNameRelationship: true,
      },
    ],
  };

  const observed = {
    rows: { record: 8, relationship: 4 },
    routes: [
      { key: "/pricing", status: 200, redirect: undefined },
      { key: "/assessment/instances@initiator", status: 200, redirect: undefined },
    ],
  };

  it("produces the file's own bytes when nothing changed", () => {
    const { next, changes } = reviseExpectations(file, observed);
    expect(changes).toEqual([]);
    expect(serializeExpectations(next)).toBe(serializeExpectations(file));
  });

  it("keeps authored assertions — an update may not delete what a person asked for", () => {
    const { next } = reviseExpectations(file, {
      ...observed,
      routes: [{ key: "/pricing", status: 503, redirect: undefined }],
    });
    const pricing = (next.routes as RouteLine[]).find((route) => route.path === "/pricing");
    expect(pricing?.status).toBe(503);
    expect(pricing?.mustContain).toEqual(["$8.95"]);
    expect(pricing?.mustNotContain).toEqual(["captcha"]);
    expect((next.routes as RouteLine[])[1]?.mustNameRelationship).toBe(true);
  });

  it("reports every change, so the PR shows a diff instead of a silent rewrite", () => {
    const { changes } = reviseExpectations(file, {
      rows: { record: 9, relationship: 4 },
      routes: [
        { key: "/pricing", status: 200, redirect: undefined },
        { key: "/assessment/instances@initiator", status: 307, redirect: "/login" },
      ],
    });
    expect(changes).toEqual([
      "rows.record 8 → 9",
      "/assessment/instances@initiator status 200 → 307",
      "/assessment/instances@initiator redirect none → /login",
    ]);
  });

  it("keeps a route the run did not observe", () => {
    const { next, changes } = reviseExpectations(file, {
      rows: {},
      routes: [{ key: "/pricing", status: 200, redirect: undefined }],
    });
    expect(next.routes).toHaveLength(2);
    expect(next.routes[1]?.status).toBe(200);
    expect(changes).toEqual([]);
  });

  it("keys a route by its path and its account, so two visits are two lines", () => {
    expect(routeKey({ path: "/pricing" })).toBe("/pricing");
    expect(routeKey({ path: "/assessment/instances", session: "initiator" })).toBe(
      "/assessment/instances@initiator",
    );
  });

  it("ends the file with exactly one newline", () => {
    expect(serializeExpectations(file).endsWith("}\n")).toBe(true);
  });
});

/**
 * The seed lock lives here because `pnpm demo:verify`'s first step *is* `pnpm db:seed`: on the
 * shared demo branch the two runs used to interleave into `422 USER_ALREADY_EXISTS`, so the
 * command's own answer depended on a lock it never took. The cases below pin the parts that
 * decide that answer — the key two worktrees must agree on, the bounded wait, and the two
 * sentences a waiting or a timed-out seeder prints. `scripts/db-seed.mjs` runs its seed at import
 * and can never be imported by a test, which is why the rules are their own module.
 */
describe("the seed lock", () => {
  it("is one key, and it never moves", () => {
    // Two versions of the script run side by side in this fleet (an old worktree, a new one). They
    // only serialise if they take the same lock, so the key is pinned rather than derived.
    expect(SEED_LOCK_NAMESPACE).toBe(0x616c676e); // "algn"
    expect(SEED_LOCK_ID).toBe(1); // 1 = db:seed
    // `pg_advisory_lock(int, int)` takes two int4 keys; a key outside that range would throw at
    // the very moment the seed needs the lock, which is worse than not having one.
    for (const key of [SEED_LOCK_NAMESPACE, SEED_LOCK_ID]) {
      expect(Number.isInteger(key)).toBe(true);
      expect(key).toBeGreaterThanOrEqual(0);
      expect(key).toBeLessThanOrEqual(2_147_483_647);
    }
  });

  it("waits five minutes by default, because a seed on this branch takes tens of seconds", () => {
    expect(DEFAULT_WAIT_SECONDS).toBe(300);
    expect(waitBudgetMs({})).toBe(300_000);
  });

  it("reads SEED_LOCK_WAIT_SECONDS, and refuses to read a typo as zero", () => {
    expect(waitBudgetMs({ SEED_LOCK_WAIT_SECONDS: "30" })).toBe(30_000);
    expect(waitBudgetMs({ SEED_LOCK_WAIT_SECONDS: " 2.5 " })).toBe(2500);
    // A typo must not turn "wait for the other seed" into "fail immediately" — that is the race
    // this lock exists to remove, re-introduced by configuration.
    for (const raw of ["", "  ", "soon", "-5", "0", "Infinity", undefined]) {
      expect(waitBudgetMs({ SEED_LOCK_WAIT_SECONDS: raw }), String(raw)).toBe(300_000);
    }
  });

  it("names the holder of the lock and how long it will wait", () => {
    const line = lockWaitNotice({
      holder: {
        pid: 4242,
        application_name: "db:seed",
        datname: "neondb",
        state: "active",
      },
      budgetMs: 300_000,
    });
    expect(line).toContain("algn/1");
    expect(line).toContain("pid 4242");
    expect(line).toContain('"db:seed"');
    expect(line).toContain("neondb");
    expect(line).toContain("300s");
    expect(line).toContain("waiting");
  });

  it("says when the wait paid off, so the delay is not mistaken for slowness", () => {
    expect(lockAcquiredNotice({ waitedMs: 4200 })).toContain("acquired after 4.2s");
  });

  it("never sends a timed-out seeder after NEON_AUTH_BASE_URL or the tree", () => {
    // The defect's whole cost was a message that blamed the auth server for another process's
    // work. The timeout must name the lock, the holder and the recovery, and nothing else.
    const message = lockTimeoutMessage({
      holder: { pid: 99, application_name: "demo:verify", datname: "neondb", state: "idle" },
      budgetMs: 300_000,
    });
    expect(message).toContain("algn/1");
    expect(message).toContain("pid 99");
    expect(message).toContain("after 300s");
    expect(message).toContain("not");
    expect(message).toContain("credentials problem");
    expect(message).toContain("Re-run");
    expect(message).toContain("SEED_LOCK_WAIT_SECONDS");
    expect(message).not.toContain("NEON_AUTH_BASE_URL");
    expect(message).not.toContain("USER_ALREADY_EXISTS");
  });

  it("reports a holder it cannot read as unseen rather than guessing", () => {
    // A role without `pg_read_all_stats` sees a `pg_locks` row with no matching `pg_stat_activity`
    // row; the message must still be true.
    expect(holderDescription(null)).toContain("cannot see");
    expect(holderDescription({})).toContain("cannot see");
    expect(holderDescription({ pid: 7, application_name: "", datname: "" })).toBe(
      "pid 7 (an unnamed session)",
    );
  });
});
