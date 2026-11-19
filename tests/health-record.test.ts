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
  gateLaneProblems,
  gateLaneRequestRefusal,
  platformDatabaseRefusal,
  postconditionProblems,
  requestedGateLane,
} from "../scripts/health-record-rules.mjs";

const DEMO_URL = `postgresql://neondb_owner:***@${DEMO_ENDPOINT}.c-6.us-east-2.aws.neon.tech/neondb`;
const DEMO_POOLED_URL = `postgresql://neondb_owner:***@${DEMO_ENDPOINT}-pooler.c-6.us-east-2.aws.neon.tech/neondb`;
const PROBE_URL =
  "postgresql://neondb_owner:***@ep-hidden-moon-a1b2c3d4.c-6.us-east-2.aws.neon.tech/neondb";
const PRODUCTION_URL =
  "postgresql://neondb_owner:***@ep-winter-block-12345678.c-6.us-east-2.aws.neon.tech/neondb";

/** The `env -i` argv the recorder runs, as `gate.command` records it. */
const GATE_COMMAND = (request: string) =>
  `env -i HOME… PATH… CI=1 HEALTH_RECORD_REFRESH=1 GATE_LANE=${request} bash scripts/verify.sh`;

/** A record shaped like the one the recorder writes, with the fields the checks read. */
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
    gate: {
      command: GATE_COMMAND("auto"),
      lane: "code",
      measuredAt: "2026-11-07T20:00:00.000Z",
      seconds: 122.8,
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

describe("which lane the gate ran, held against the lane it was asked for", () => {
  it("reads the request out of the command transcript, and says `null` when there is none", () => {
    expect(requestedGateLane(GATE_COMMAND("full"))).toBe("full");
    expect(requestedGateLane(GATE_COMMAND("auto"))).toBe("auto");
    // The shape the recorder wrote before the lane was forwarded — the defect, in one string.
    expect(
      requestedGateLane("env -i HOME… PATH… CI=1 HEALTH_RECORD_REFRESH=1 bash scripts/verify.sh"),
    ).toBeNull();
    expect(requestedGateLane(undefined)).toBeNull();
  });

  it("accepts `auto` with whatever the classifier chose, and `full` with the code lane", () => {
    expect(gateLaneProblems({ command: GATE_COMMAND("auto"), lane: "docs" })).toEqual([]);
    expect(gateLaneProblems({ command: GATE_COMMAND("auto"), lane: "config" })).toEqual([]);
    // GATE_LANE=full *is* the code lane; that is resolve_lane's own sentence, not a second lane.
    expect(gateLaneProblems({ command: GATE_COMMAND("full"), lane: "code" })).toEqual([]);
  });

  it("fails a recorded lane that disagrees with the lane the gate was asked for", () => {
    // The reproduction: `GATE_LANE=full pnpm health:record --gate --carry` under the old recorder
    // produced exactly this pair — the request dropped by `env -i`, the record left saying `docs`,
    // 13 s and no build, as though somebody had chosen the cheapest lane.
    const problems = gateLaneProblems({ command: GATE_COMMAND("full"), lane: "docs" });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("GATE_LANE=full");
    expect(problems[0]).toContain('"docs"');
    expect(problems[0]).toContain("code lane");
  });

  it("fails a measured block whose command names no lane at all", () => {
    const problems = gateLaneProblems({
      command: "env -i HOME… PATH… CI=1 HEALTH_RECORD_REFRESH=1 bash scripts/verify.sh",
      lane: "code",
    });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("does not name GATE_LANE=auto|full");
  });

  it("does not hold a carried block to a request this run never made", () => {
    const carriedBlock = {
      command: "env -i HOME… PATH… CI=1 HEALTH_RECORD_REFRESH=1 bash scripts/verify.sh",
      lane: "code",
    };
    expect(gateLaneProblems(carriedBlock, { measured: false })).toEqual([]);
    // …but it is still held to agreement when its own command does name one.
    expect(
      gateLaneProblems({ command: GATE_COMMAND("full"), lane: "content" }, { measured: false }),
    ).toHaveLength(1);
  });

  it("refuses a request verify.sh would exit 2 on, instead of recording it", () => {
    expect(gateLaneRequestRefusal("auto")).toBeNull();
    expect(gateLaneRequestRefusal("full")).toBeNull();
    expect(gateLaneRequestRefusal("fast")).toContain("is not a lane");
    expect(gateLaneProblems({ command: GATE_COMMAND("fast"), lane: "code" })[0]).toContain(
      "is not a lane",
    );
  });

  it("reaches the recorder's postcondition, not only the rule", () => {
    const problems = postconditionProblems(
      record({ gate: { ...record().gate, command: GATE_COMMAND("full"), lane: "docs" } }),
      { packageVersion: "1.6.0", now: AT(0) },
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("GATE_LANE=full");
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
            "scratch branch platform-health-probe (copy of demo), one session deliberately broken for the #508 proof",
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
    // recordedAt, tree.packageVersion, dbVerify.database, and the gate lane nobody asked for.
    expect(postconditionProblems(null, { packageVersion: "1.6.0", now: AT(0) }).length).toBe(4);
  });
});
