/**
 * `/admin/health` — the stale record's remedy is a command that runs (#696).
 *
 * The stale state is the one place this screen hands an operator a command, and since #961
 * `release.sh --tag-only` re-records the platform health and **refuses the cut** on a record naming
 * the wrong version — so the line is the documented remedy for exactly the failure the release path
 * refuses on. A remedy that names a command which stops is the worst answer to a stuck operator,
 * and the copy had already drifted: it printed `pnpm health:record --db --gate`, and `--gate`
 * without `--carry` (or a `--ci` window) throws
 * `gate: this run did not measure it and --carry was not given` at `scripts/health-record.mjs:346`.
 *
 * Four claims, each pinned against the thing that would make it false — never against a copy of the
 * string this file also spells out:
 *
 *   1. **The command exists.** Its script is a real `package.json` script and that script runs the
 *      recorder; every flag it carries is a flag `scripts/health-record.mjs` parses. An invented
 *      command name or an invented flag fails here instead of on an operator's terminal.
 *   2. **The command runs.** `--gate` needs a yield block for its own run, so the flags must carry
 *      `--carry` or a `--ci` window. The requirement is read from the recorder's source, and the
 *      rule is exercised against the string that shipped before #696 so the check is known to catch
 *      it rather than merely agreeing with the new one.
 *   3. **The environment is named.** The record is written from the demo branch and no other, so the
 *      copy says so and says where the credentials come from — and that claim is proved against
 *      `platformDatabaseRefusal()`, which is the rule, not against the sentence that describes it.
 *   4. **The page renders it.** The label and the body both reach the stale card
 *      (`tests/platform-health.test.ts` drives the render; this file pins the words it must carry).
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { adminHealthPageCopy } from "@/data/pages/admin-health";
import { itemBody, itemLabel, sectionOf } from "@/lib/page-copy";

import { DEMO_ENDPOINT, platformDatabaseRefusal } from "../scripts/health-record-rules.mjs";

const RECORDER = readFileSync(new URL("../scripts/health-record.mjs", import.meta.url), "utf8");
const PACKAGE = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
  scripts: Record<string, string>;
};

const SECTION = sectionOf(adminHealthPageCopy, "freshness");
const LABEL = itemLabel(SECTION, "stale-action");
const BODY = itemBody(SECTION, "stale-action");

/** The one command the copy hands an operator, without the backticks that mark it as code. */
function commandOf(label: string): string {
  const spans = [...label.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
  expect(spans, `stale-action must name exactly one command, found ${spans.length}`).toHaveLength(
    1,
  );
  return spans[0] ?? "";
}

const COMMAND = commandOf(LABEL);
const [BINARY, SCRIPT, ...FLAGS] = COMMAND.split(/\s+/);

/** The flags `scripts/health-record.mjs` itself reads: `has("--x")` and `flagValue("--x")`. */
const PARSED_FLAGS = new Set(
  [...RECORDER.matchAll(/(?:has|flagValue)\("(--[a-z-]+)"\)/g)].map((match) => match[1]),
);

/**
 * The recorder's yield rule: `--gate` measures a timed gate run but not the CI first-pass yield, so
 * the run either carries the previous block (`--carry`) or re-derives it for a window (`--ci`).
 * Without one of the two, `carried("gate")` throws and the command stops.
 */
const satisfiesYieldRule = (flags: string[]): boolean =>
  flags.some((flag) => flag === "--carry" || flag === "--ci");

describe("/admin/health — the stale record's remedy names a command that runs (#696)", () => {
  it("names a real package.json script, and that script runs the recorder", () => {
    expect(BINARY).toBe("pnpm");
    expect(Object.keys(PACKAGE.scripts)).toContain(SCRIPT);
    expect(PACKAGE.scripts[SCRIPT ?? ""]).toContain("scripts/health-record.mjs");
  });

  it("carries only flags the recorder parses, so no flag is invented", () => {
    expect(FLAGS.length).toBeGreaterThan(0);
    for (const flag of FLAGS) {
      expect([...PARSED_FLAGS], `${flag} is not a flag scripts/health-record.mjs reads`).toContain(
        flag,
      );
    }
  });

  it("carries the flag that keeps the yield block, so the command does not stop", () => {
    // The recorder still refuses to carry a block silently. If that requirement is ever removed,
    // this fails and the reason is read rather than a stale rule being pinned unnoticed.
    expect(
      RECORDER,
      "scripts/health-record.mjs no longer throws `--carry was not given` — re-read #696's remedy, " +
        "its command was chosen to satisfy that rule",
    ).toContain("--carry was not given");
    expect(satisfiesYieldRule(FLAGS)).toBe(true);
  });

  it("would have caught the string this line shipped before #696", () => {
    // What the copy said: `pnpm health:record --db --gate` — real script, real flags, and it stops.
    expect(satisfiesYieldRule(["--db", "--gate"])).toBe(false);
    expect(satisfiesYieldRule(FLAGS)).toBe(true);
  });

  it("names the environment, and that claim is the recorder's own refusal", () => {
    const copy = `${LABEL} ${BODY}`;
    expect(copy).toContain("demo");
    expect(copy).toContain(".env.local");

    const demo = `postgresql://neondb_owner:***@${DEMO_ENDPOINT}-pooler.c-6.us-east-2.aws.neon.tech/neondb`;
    const production =
      "postgresql://neondb_owner:***@ep-winter-block-12345678.c-6.us-east-2.aws.neon.tech/neondb";
    const probe =
      "postgresql://neondb_owner:***@ep-hidden-moon-a1b2c3d4.c-6.us-east-2.aws.neon.tech/neondb";

    // What the copy promises the operator: demo is accepted, and everything else is stopped by name.
    expect(platformDatabaseRefusal({ databaseUrl: demo, neonBranch: "demo" })).toBeNull();
    expect(platformDatabaseRefusal({ databaseUrl: production })).toContain("demo branch");
    expect(platformDatabaseRefusal({ databaseUrl: probe })).toContain("evidence");
    expect(platformDatabaseRefusal({})).toContain("no DATABASE_URL");
    expect(platformDatabaseRefusal({ neonBranch: "production" })).toContain("demo branch");
  });

  it("hands the operator one command, and the body explains rather than offering a second", () => {
    expect(LABEL).toContain(COMMAND);
    expect(BODY).not.toContain("pnpm ");
  });
});
