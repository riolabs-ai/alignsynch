/**
 * `/admin/health` — the record, the four derivations, the gate and the render (#508).
 *
 * The screen's claim is "no number without a source", and that is only worth something if the
 * things the claim rests on are pinned:
 *
 *   1. **The committed artifact parses.** `data/health/platform-health.json` is hand-editable and
 *      committed, so a shape the page would refuse has to fail here first — and a rule code the
 *      script never prints (`V-11`) is refused by name, because the panel's whole point is printing
 *      the code `db:verify` printed.
 *   2. **The three release agreements are pure functions of the facts.** A tag ahead of
 *      `package.json`, a production build that is not this tree's version, a commit that is not
 *      `origin/main` — each is one sentence, and `unknown` is cannot-say rather than a mismatch.
 *   3. **The drift alarm is a comparison, not a heuristic.** Six behind with a limit of five fires;
 *      five behind with a limit of five does not; `PLATFORM_HEALTH_DRIFT_LIMIT=0` is legal.
 *   4. **`support` gets the 404 and the record is never read.** The page is driven through the real
 *      role policy with the read spied, the way `tests/admin-audit-page.test.ts` drives `/admin/audit`.
 *   5. **The screen's own source is read-only and clock-free.** No `lib/admin/act` import and no
 *      `new Date()`/`Date.now()` in the component or the module — the `#418` rule. The page takes
 *      **one** clock per request, and only for the record's age (#599), which a test pins.
 *   6. **A stale committed record fails the gate.** The record is committed, so its age is part of
 *      what it says: `data/health/platform-health.json` outside the declared freshness window is a
 *      red suite, not a screen an operator reads as current (#599).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

import { zPlatformHealthRecord, type PlatformHealthRecord } from "@/content/platform-health";
import {
  deployDriftOf,
  driftLimitFromEnv,
  FRESHNESS_VARIABLE,
  freshnessOf,
  freshnessWindowFromEnv,
  HealthRecordUnreadable,
  normaliseVersion,
  readTreeFacts,
  releaseTruthOf,
  type Measured,
  type TreeFacts,
} from "@/lib/admin/platform-health";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/**
 * Two hours before the test run: the fixture has to be *inside* the freshness window whenever the
 * suite runs, or a test about a fresh record would start failing on a calendar date instead of a
 * regression (#599).
 */
const FRESH_AT = new Date(Date.now() - 2 * 3_600_000).toISOString();

/**
 * `pnpm health:record` runs the gate **before** it writes the record, so during that one run the
 * committed record is by definition the stale one it is replacing (#599). The recorder — and
 * nothing else — sets this for its own gate run; every other gate run enforces freshness, and a
 * test that could not be satisfied on the path that fixes it would be a deadlock, not a check.
 */
const REFRESHING = process.env.HEALTH_RECORD_REFRESH === "1";

/** A record shaped like the committed one, with the two codes the card names. */
function record(overrides: Record<string, unknown> = {}): PlatformHealthRecord {
  return zPlatformHealthRecord.parse({
    dbVerify: {
      command: "pnpm db:verify",
      database: "host ep-example-000000.us-east-2.aws.neon.tech",
      exitCode: 1,
      ranAt: "2026-11-03T17:58:00.000Z",
      result: "fail",
      summary: "✗ db:verify — 2 violation(s)",
      violations: [
        {
          code: "V11",
          message:
            'instance "avery-rowan" (answering): the initiator\'s unlock_seen_at is set, but the instance is not complete — the marker would never show',
        },
        {
          code: "V21",
          message:
            'seeded instance "avery-rowan" reads "answering" — db:seed writes a finished session, and the counterparty answered 4 of 5 Aspect(s)',
        },
      ],
    },
    gate: {
      command: "env -i HOME… PATH… CI=1 bash scripts/verify.sh",
      lane: "code",
      measuredAt: "2026-11-03T18:01:00.000Z",
      seconds: 148.2,
      yield: {
        command: "python3 docs/gate-baseline.py --window 2026-11-02",
        measuredAt: "2026-11-03T18:02:00.000Z",
        percent: 97.4,
        runP50Seconds: 144,
        runP95Seconds: 176,
        runs: 190,
        successes: 185,
        window: "2026-11-02",
      },
    },
    production: {
      behindMain: 0,
      commit: "639d55e96079b82798debd8e288a998517bd5039",
      measuredAt: "2026-11-03T18:03:00.000Z",
      source: "GET https://alignsynch.com/api/version",
      state: "answering",
      status: 200,
      version: "1.3.0",
    },
    recordedAt: FRESH_AT,
    recorder: "pnpm health:record",
    schemaVersion: 1,
    tree: {
      headSha: "639d55e96079b82798debd8e288a998517bd5039",
      latestTag: "v1.3.0",
      mainSha: "639d55e96079b82798debd8e288a998517bd5039",
      measuredAt: FRESH_AT,
      packageVersion: "1.3.0",
    },
    ...overrides,
  });
}

/** Comments out, code left: the docstrings name `new Date()` and `act()` without calling them. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("the committed record", () => {
  /** The *real* reader: the page's mock below replaces the module export for the whole file. */
  const realReader = () =>
    vi.importActual<typeof import("@/lib/admin/platform-health")>("@/lib/admin/platform-health");

  it("parses through the schema the page reads it with", async () => {
    const actual = (await realReader()).readPlatformHealthRecord();
    expect(actual.schemaVersion).toBe(1);
    expect(actual.dbVerify.ranAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    for (const violation of actual.dbVerify.violations) {
      expect(violation.code).toMatch(/^V\d+$/);
    }
  });

  it("refuses a rule code the script never prints", () => {
    const broken = record();
    const result = zPlatformHealthRecord.safeParse({
      ...broken,
      dbVerify: { ...broken.dbVerify, violations: [{ code: "V-11", message: "x" }] },
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path.join(".")).toBe("dbVerify.violations.0.code");
  });

  it("carries a reason when the record cannot be read at all", async () => {
    const real = await realReader();
    expect(() => real.readPlatformHealthRecord("/nonexistent/platform-health.json")).toThrow(
      real.HealthRecordUnreadable,
    );
  });
});

describe("release truth (#443)", () => {
  const live = <T>(value: T, command: string): Measured<T> => ({ command, origin: "live", value });
  const tree = (packageVersion: string, latestTag = "v1.3.0"): TreeFacts => ({
    headSha: live("639d55e96079b82798debd8e288a998517bd5039", "git rev-parse HEAD"),
    latestTag: live(latestTag, "git describe --tags --abbrev=0"),
    mainSha: live("639d55e96079b82798debd8e288a998517bd5039", "git rev-parse origin/main"),
    packageVersion: live(packageVersion, "package.json"),
  });
  const at = { origin: "recorded" as const, recordedAt: "2026-11-03T18:03:00.000Z" };

  it("reads this checkout live, with the commands that answered", () => {
    const facts = readTreeFacts(record());
    const version = JSON.parse(readFileSync(`${ROOT}package.json`, "utf8")).version;
    expect(facts.packageVersion).toMatchObject({ origin: "live", value: version });
    expect(facts.latestTag.origin).toBe("live");
  });

  it("treats `v1.3.0` and `1.3.0` as one release", () => {
    expect(normaliseVersion("v1.3.0")).toBe("1.3.0");
    const truth = releaseTruthOf({
      productionCommit: { ...at, value: "639d55e9" },
      productionVersion: { ...at, value: "1.3.0" },
      tree: tree("1.3.0"),
    });
    expect(truth.mismatches).not.toContain("version-tag");
    expect(truth.mismatches).not.toContain("production-version");
  });

  it("fires on a tag ahead of package.json, which is the state #443 describes", () => {
    const truth = releaseTruthOf({
      productionCommit: { ...at, value: "639d55e9" },
      productionVersion: { ...at, value: "1.1.0" },
      tree: tree("1.2.0"),
    });
    expect(truth.mismatches).toContain("version-tag");
    expect(truth.mismatches).toContain("production-version");
  });

  it("does not invent a mismatch from `unknown`", () => {
    const truth = releaseTruthOf({
      productionCommit: { ...at, value: "unknown" },
      productionVersion: { ...at, value: "unknown" },
      tree: tree("1.3.0"),
    });
    expect(truth.mismatches).toEqual([]);
  });
});

describe("deploy drift", () => {
  const at = { origin: "recorded" as const, recordedAt: "2026-11-03T18:03:00.000Z" };

  it("fires only past the limit", () => {
    const limit = { limit: 5, origin: "default" as const, problem: null, variable: "X" };
    expect(deployDriftOf({ behind: { ...at, value: 6 }, limit }).exceeded).toBe(true);
    expect(deployDriftOf({ behind: { ...at, value: 5 }, limit }).exceeded).toBe(false);
    expect(deployDriftOf({ behind: { ...at, value: 0 }, limit }).exceeded).toBe(false);
  });

  it("defaults to five, accepts zero, and refuses a value that is not a count", () => {
    expect(driftLimitFromEnv({}).limit).toBe(5);
    expect(driftLimitFromEnv({}).origin).toBe("default");
    expect(driftLimitFromEnv({ PLATFORM_HEALTH_DRIFT_LIMIT: "0" })).toMatchObject({
      limit: 0,
      origin: "env",
      problem: null,
    });
    const bad = driftLimitFromEnv({ PLATFORM_HEALTH_DRIFT_LIMIT: "five" });
    expect(bad.limit).toBe(5);
    expect(bad.problem).not.toBeNull();
  });
});

/* ------------------------------------------------------------------ *
 * Freshness — a record older than its window is history, not status (#599)
 * ------------------------------------------------------------------ */

describe("record freshness (#599)", () => {
  const window = (hours: number) => ({
    hours,
    origin: "default" as const,
    problem: null,
    variable: FRESHNESS_VARIABLE,
  });

  it("is fresh inside the window, stale past it, and measured from the instant it is given", () => {
    const at = record().recordedAt;
    const plus = (hours: number) => new Date(Date.parse(at) + hours * 3_600_000).toISOString();

    expect(freshnessOf(record(), plus(0), window(72)).stale).toBe(false);
    expect(freshnessOf(record(), plus(71), window(72)).stale).toBe(false);
    // The boundary is inclusive: at exactly the window the record is still current.
    expect(freshnessOf(record(), plus(72), window(72)).stale).toBe(false);
    expect(freshnessOf(record(), plus(72.5), window(72)).stale).toBe(true);
    expect(freshnessOf(record(), plus(96), window(72))).toMatchObject({
      ageHours: 96,
      recordedAt: at,
      stale: true,
    });
  });

  it("reads a stamp in the future as age 0, not as fresh forever", () => {
    const ahead = new Date(Date.now() + 6 * 3_600_000).toISOString();
    expect(freshnessOf(record({ recordedAt: ahead }), new Date().toISOString())).toMatchObject({
      ageHours: 0,
      stale: false,
    });
  });

  it("defaults to 72 hours, accepts zero, and reports a value that is not a count", () => {
    expect(freshnessWindowFromEnv({})).toMatchObject({ hours: 72, origin: "default" });
    expect(freshnessWindowFromEnv({ [FRESHNESS_VARIABLE]: "0" })).toMatchObject({
      hours: 0,
      origin: "env",
    });
    const bad = freshnessWindowFromEnv({ [FRESHNESS_VARIABLE]: "two days" });
    expect(bad.hours).toBe(72);
    expect(bad.problem).not.toBeNull();
  });

  it.skipIf(REFRESHING)("holds the committed record inside its window", async () => {
    const real = await vi.importActual<typeof import("@/lib/admin/platform-health")>(
      "@/lib/admin/platform-health",
    );
    const actual = real.readPlatformHealthRecord();
    const freshness = real.freshnessOf(actual, new Date().toISOString());
    expect(
      freshness.stale,
      `data/health/platform-health.json recordedAt=${actual.recordedAt} is ${freshness.ageHours} h old, ` +
        `past the ${freshness.window.hours} h freshness window — re-record it: \`pnpm health:record --db --gate --carry\` (#599)`,
    ).toBe(false);
  });
});

/* ------------------------------------------------------------------ *
 * The page
 * ------------------------------------------------------------------ */

const gate = vi.hoisted(() => ({ role: "support" as "support" | "admin" | "owner" | "member" }));
const read = vi.hoisted(() => vi.fn());

vi.mock("@/lib/admin/platform-health", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/admin/platform-health")>();
  return { ...real, readPlatformHealthRecord: () => read() };
});

vi.mock("@/lib/auth/session", () => ({ currentUser: async () => null }));
vi.mock("@/lib/db/user-profiles", () => ({
  readUserProfileByHandle: async () => null,
  readUserProfileByUserId: async () => null,
}));

vi.mock("@/lib/auth/require-role", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/auth/require-role")>();
  const { notFound } = await import("next/navigation");
  return {
    ...real,
    requireAdmin: async () => {
      const answer = real.roleAnswerFor({ needed: "admin", signedIn: true, role: gate.role });
      if (answer.kind === "redirect") throw new Error(`an unexpected redirect to ${answer.to}`);
      if (answer.kind === "not-found") {
        notFound();
        throw new Error("notFound() did not throw");
      }
      return {
        role: answer.role,
        user: { email: "a@b.c", name: "", sessionId: null, userId: "auth-1" },
      };
    },
  };
});

describe("/admin/health — the gate", () => {
  it("answers a support session with the 404 an unknown URL gets, and reads nothing", async () => {
    gate.role = "support";
    read.mockClear();
    const { default: AdminHealthPage } = await import("@/app/(mainlayout)/admin/health/page");

    let digest: string | undefined;
    try {
      await AdminHealthPage();
    } catch (error) {
      digest = (error as { digest?: string }).digest;
    }

    expect(digest).toBe("NEXT_HTTP_ERROR_FALLBACK;404");
    expect(read).not.toHaveBeenCalled();
  });
});

describe("/admin/health — what the page renders", () => {
  it("draws the failing rule codes exactly as the record carries them, each with a source", async () => {
    gate.role = "admin";
    read.mockClear();
    read.mockImplementation(() => record());
    const { default: AdminHealthPage } = await import("@/app/(mainlayout)/admin/health/page");
    const { renderToStaticMarkup } = await import("react-dom/server");

    const html = renderToStaticMarkup((await AdminHealthPage()) as ReactElement);

    expect(html).toContain("Rule V11");
    expect(html).toContain("Rule V21");
    expect(html).toContain("unlock_seen_at is set, but the instance is not complete");
    expect(html).toContain("4 of 5 Aspect(s)");
    // Every card's numbers are followed by a provenance line: a live command or a recorded instant.
    expect(html).toContain("· this checkout");
    expect(html).toContain("recorded ");
    // Gate and yield are measurements with their window and their command.
    expect(html).toContain("185 of 190 head SHAs green on their first run (97.4%)");
    expect(html).toContain("python3 docs/gate-baseline.py --window 2026-11-02");
  });

  it("draws a stale record as a failure above the panels it invalidates (#599)", async () => {
    gate.role = "admin";
    read.mockClear();
    read.mockImplementation(() =>
      record({ recordedAt: new Date(Date.now() - 96 * 3_600_000).toISOString() }),
    );
    const { default: AdminHealthPage } = await import("@/app/(mainlayout)/admin/health/page");
    const { renderToStaticMarkup } = await import("react-dom/server");

    const html = renderToStaticMarkup((await AdminHealthPage()) as ReactElement);
    expect(html).toContain("The record is stale — nothing below is current");
    expect(html).toContain("past the 72 h freshness window");
    expect(html).toContain("pnpm health:record --db --gate --carry");
    // ...and the sentence that says which environment can run it (#696).
    expect(html).toContain("written from the demo branch and nothing else");
    // Above the panels it invalidates, not below them in the sources card.
    expect(html.indexOf("The record is stale")).toBeLessThan(html.indexOf("Database checks"));
  });

  it("says a fresh record is inside its window, in one muted line (#599)", async () => {
    gate.role = "admin";
    read.mockClear();
    read.mockImplementation(() => record());
    const { default: AdminHealthPage } = await import("@/app/(mainlayout)/admin/health/page");
    const { renderToStaticMarkup } = await import("react-dom/server");

    const html = renderToStaticMarkup((await AdminHealthPage()) as ReactElement);
    expect(html).toContain("inside the 72 h freshness window");
    expect(html).not.toContain("The record is stale");
  });

  it("fires the release alarm on a production build that is not this tree", async () => {
    gate.role = "admin";
    read.mockClear();
    read.mockImplementation(() =>
      record({
        production: {
          ...record().production,
          commit: "0000000000000000000000000000000000000000",
          version: "1.2.0",
        },
      }),
    );
    const { default: AdminHealthPage } = await import("@/app/(mainlayout)/admin/health/page");
    const { renderToStaticMarkup } = await import("react-dom/server");

    const html = renderToStaticMarkup((await AdminHealthPage()) as ReactElement);
    expect(html).toContain("This is not one release");
    expect(html).toContain("Production serves 1.2.0 while package.json says");
    expect(html).toContain("not origin/main");
  });

  it("draws the unreadable record as a panel, never as zeroes", async () => {
    gate.role = "admin";
    read.mockClear();
    read.mockImplementation(() => {
      throw new HealthRecordUnreadable(
        "data/health/platform-health.json is not readable in this tree",
      );
    });
    const { default: AdminHealthPage } = await import("@/app/(mainlayout)/admin/health/page");
    const { renderToStaticMarkup } = await import("react-dom/server");

    const html = renderToStaticMarkup((await AdminHealthPage()) as ReactElement);
    expect(html).toContain("The health record could not be read");
    expect(html).toContain("is not readable in this tree");
    expect(html).not.toContain("No violation was recorded");
  });
});

describe("the screen's own source", () => {
  const page = "app/(mainlayout)/admin/health/page.tsx";
  const component = "components/admin/platform-health.tsx";
  const pure = "lib/admin/platform-health.ts";

  it("never imports or calls the write path", () => {
    for (const file of [page, component, pure]) {
      const source = code(readFileSync(`${ROOT}${file}`, "utf8"));
      expect(source, `${file} must not reach lib/admin/act`).not.toMatch(/admin\/act/);
      expect(source, `${file} must not call act()`).not.toMatch(/\bact\s*\(/);
    }
  });

  it("holds no clock of its own: the instant is taken once, in the page (#599)", () => {
    for (const file of [component, pure]) {
      const source = code(readFileSync(`${ROOT}${file}`, "utf8"));
      expect(source, `${file} must not call new Date(`).not.toMatch(/new Date\(/);
      expect(source, `${file} must not call Date.now()`).not.toMatch(/Date\.now\(/);
    }
    // The record's age needs one instant (#599). It is taken on the request path, exactly once, and
    // handed to a pure derivation — a server component with no client bundle has no second render
    // to disagree with, which is what #418 was about.
    const pageSource = code(readFileSync(`${ROOT}${page}`, "utf8"));
    expect(pageSource.match(/new Date\(/g)?.length).toBe(1);
    expect(pageSource, `${page} must not call Date.now()`).not.toMatch(/Date\.now\(/);
  });
});
