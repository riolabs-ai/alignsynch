/**
 * `pnpm health:record`'s refusals and its postcondition, proved without a database or a clock (#680).
 *
 * The platform record is what `/admin/health` prints as status, so the two ways it has lied are
 * pinned here rather than in prose:
 *
 *   1. **A probe's `exitCode: 1` was recorded as platform health.** The record is written from the
 *      demo branch only, and the branch is identified by its Neon **endpoint** — a copy of `demo`
 *      gets its own, which is the fact a probe run cannot fake. `platformDatabaseRefusal()` is that
 *      rule, and every branch it refuses is a case below.
 *   2. **A record could describe a tree it was not written from.** `postconditionProblems()` reads
 *      the record back and compares `tree.packageVersion` to `package.json`, so a `1.5.0` record
 *      beside a `1.6.0` package is a red command rather than a footnote on a screen.
 *
 * The label matters as much as the refusal, and for a reason worth stating: the old record's
 * `dbVerify.database` read `"scratch branch platform-health-probe (copy of demo) …"` — a sentence
 * somebody typed. `demoDatabaseLabel()` derives its label from the connection string and the
 * shell, so the tempting text has nowhere to come from, and a test asserts the password-bearing
 * URL never reaches it.
 */
import { describe, expect, it } from "vitest";

import {
  DEMO_ENDPOINT,
  DEMO_LABEL_PREFIX,
  demoDatabaseLabel,
  platformDatabaseRefusal,
  postconditionProblems,
} from "../scripts/health-record-rules.mjs";

const DEMO_URL = `postgresql://neondb_owner:***@${DEMO_ENDPOINT}.c-6.us-east-2.aws.neon.tech/neondb`;
const DEMO_POOLED_URL = `postgresql://neondb_owner:***@${DEMO_ENDPOINT}-pooler.c-6.us-east-2.aws.neon.tech/neondb`;
const PROBE_URL =
  "postgresql://neondb_owner:***@ep-hidden-moon-a1b2c3d4.c-6.us-east-2.aws.neon.tech/neondb";
const PRODUCTION_URL =
  "postgresql://neondb_owner:***@ep-winter-block-12345678.c-6.us-east-2.aws.neon.tech/neondb";

/** A record shaped like the one the recorder writes, with the two fields the checks read. */
function record(overrides: Record<string, unknown> = {}) {
  return {
    dbVerify: {
      command: "pnpm db:verify",
      database: demoDatabaseLabel({ databaseUrl: DEMO_URL, neonBranch: "demo" }),
      exitCode: 0,
      ranAt: "2026-11-07T20:00:00.000Z",
      result: "pass",
      summary: "✓ db:verify — no drift",
      violations: [],
    },
    recordedAt: "2026-11-07T20:00:01.000Z",
    recorder: "pnpm health:record",
    schemaVersion: 1,
    tree: {
      headSha: "a".repeat(40),
      latestTag: "v1.6.0",
      mainSha: "a".repeat(40),
      measuredAt: "2026-11-07T20:00:00.000Z",
      packageVersion: "1.6.0",
    },
    ...overrides,
  };
}

const AT = (minutesAfterRecord: number) =>
  new Date(Date.parse("2026-11-07T20:00:01.000Z") + minutesAfterRecord * 60_000);

describe("which database may be recorded as platform status", () => {
  it("accepts the demo branch, direct or pooled, and refuses to be talked out of it", () => {
    expect(platformDatabaseRefusal({ databaseUrl: DEMO_URL, neonBranch: "demo" })).toBeNull();
    expect(
      platformDatabaseRefusal({ databaseUrl: DEMO_POOLED_URL, neonBranch: "demo" }),
    ).toBeNull();
    // `NEON_BRANCH` is a word somebody typed; its absence is not a refusal when the endpoint is demo's.
    expect(platformDatabaseRefusal({ databaseUrl: DEMO_URL })).toBeNull();
  });

  it("refuses a copy of demo, naming where that evidence belongs instead", () => {
    const refusal = platformDatabaseRefusal({ databaseUrl: PROBE_URL });
    expect(refusal).toContain(DEMO_ENDPOINT);
    expect(refusal).toContain("--probe");
    expect(refusal).toContain("data/health/probes/");
  });

  it("refuses production by host and by branch name, with the fact that refused it", () => {
    expect(platformDatabaseRefusal({ databaseUrl: PRODUCTION_URL })).toContain(
      "production endpoint",
    );
    expect(platformDatabaseRefusal({ databaseUrl: DEMO_URL, neonBranch: "production" })).toContain(
      "NEON_BRANCH=production",
    );
  });

  it("refuses a branch label that is not demo, even on a URL it cannot parse", () => {
    expect(platformDatabaseRefusal({ databaseUrl: DEMO_URL, neonBranch: "scratch" })).toContain(
      "NEON_BRANCH=scratch",
    );
    expect(platformDatabaseRefusal({ databaseUrl: "" })).toContain("no DATABASE_URL");
    expect(platformDatabaseRefusal({ databaseUrl: "not a url" })).toContain("no DATABASE_URL");
    expect(platformDatabaseRefusal()).toContain("no DATABASE_URL");
  });
});

describe("the database label is derived, never typed", () => {
  it("names demo, the branch as the shell spelled it, the database and the host", () => {
    const label = demoDatabaseLabel({ databaseUrl: DEMO_POOLED_URL, neonBranch: "demo" });
    expect(label).toBe(
      `demo branch (NEON_BRANCH=demo, neondb) · host ${DEMO_ENDPOINT}-pooler.c-6.us-east-2.aws.neon.tech`,
    );
    expect(label.startsWith(DEMO_LABEL_PREFIX)).toBe(true);
  });

  it("says `unset` rather than inventing a branch", () => {
    expect(demoDatabaseLabel({ databaseUrl: DEMO_URL })).toContain("NEON_BRANCH=unset");
  });

  it("carries no connection string — the record is committed", () => {
    const label = demoDatabaseLabel({ databaseUrl: DEMO_URL, neonBranch: "demo" });
    expect(label).not.toContain("postgresql://");
    expect(label).not.toContain("neondb_owner");
    expect(label).not.toContain("***");
  });
});

describe("the recorder's postcondition", () => {
  it("passes a record this run wrote, from this tree, about demo", () => {
    expect(postconditionProblems(record(), { packageVersion: "1.6.0", now: AT(0) })).toEqual([]);
  });

  it("fails a carried `recordedAt`, and a stamp from the future", () => {
    const stale = postconditionProblems(record(), { packageVersion: "1.6.0", now: AT(60) });
    expect(stale).toHaveLength(1);
    expect(stale[0]).toContain("recordedAt is 60.0 min old");

    const ahead = postconditionProblems(record(), { packageVersion: "1.6.0", now: AT(-30) });
    expect(ahead[0]).toContain("in the future");

    const unparseable = postconditionProblems(record({ recordedAt: "yesterday" }), {
      packageVersion: "1.6.0",
      now: AT(0),
    });
    expect(unparseable[0]).toContain("not an instant");
  });

  it("fails a record that describes a tree package.json does not name", () => {
    const problems = postconditionProblems(record(), { packageVersion: "1.7.0", now: AT(0) });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("tree.packageVersion");
    expect(problems[0]).toContain("1.7.0");
  });

  it("fails the probe sentence the old record carried — the exact defect (#680)", () => {
    const problems = postconditionProblems(
      record({
        dbVerify: {
          ...record().dbVerify,
          database:
            "scratch branch platform-health-probe (copy of demo), one instance deliberately broken for the #508 proof",
          exitCode: 1,
          result: "fail",
        },
      }),
      { packageVersion: "1.6.0", now: AT(0) },
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("dbVerify.database");
    expect(problems[0]).toContain("demo branch");
  });

  it("fails a `demo branch` label that names some other endpoint", () => {
    const problems = postconditionProblems(
      record({
        dbVerify: {
          ...record().dbVerify,
          database: `demo branch (NEON_BRANCH=demo, neondb) · host ${PROBE_URL.split("@")[1]}`,
        },
      }),
      { packageVersion: "1.6.0", now: AT(0) },
    );
    expect(problems[0]).toContain(DEMO_ENDPOINT);
  });

  it("reports every broken fact at once, not the first one", () => {
    const problems = postconditionProblems(
      record({
        recordedAt: "2020-01-01T00:00:00.000Z",
        dbVerify: { ...record().dbVerify, database: "somewhere else" },
      }),
      { packageVersion: "1.7.0", now: AT(0) },
    );
    expect(problems).toHaveLength(3);
  });

  it("does not throw on a record that is not an object at all", () => {
    expect(postconditionProblems(null, { packageVersion: "1.6.0", now: AT(0) }).length).toBe(3);
  });
});
