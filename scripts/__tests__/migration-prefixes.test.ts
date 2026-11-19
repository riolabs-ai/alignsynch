/**
 * #1249 — a migration number identifies one step, and two files sharing one is refused by the
 * runner's own preflight.
 *
 * Two of the cases below spawn `scripts/db-migrate.mjs` against a `mkdtemp` directory, because
 * the acceptance is an **exit code**: a rule that only returns a violation from a pure function
 * is not the thing that stops a run, and a repository cannot be arranged into two `0043`s on
 * demand. The child is given no `DATABASE_URL` at all, and the passing cases assert the run never
 * printed a `target:` line — which is only printed after `loadEnv()` and before the connection, so
 * its absence is proof the check ran before either.
 *
 * The grandfathered side is asserted against the real tree, so "the check passes on main" is a
 * measured claim rather than a fixture that agrees with itself.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";

import {
  findMigrationPrefixFindings,
  formatPrefixFindings,
  grandfatheredPrefixes,
  LEGACY_DUPLICATE_PREFIXES,
} from "../migration-prefixes-rules";

const ROOT = process.cwd();
const MIGRATE = join(ROOT, "scripts", "db-migrate.mjs");
const MIGRATIONS = join(ROOT, "db", "migrations");

/** No `DATABASE_URL`: a run that needed one would exit 1 for the wrong reason. */
const CHILD_ENV: NodeJS.ProcessEnv = { ...process.env };
delete CHILD_ENV.DATABASE_URL;
delete CHILD_ENV.DATABASE_URL_UNPOOLED;

const fixtures: string[] = [];

/** A throwaway directory of migration files, cleaned up at the end of the file. */
function fixture(files: Record<string, string>): string {
  const directory = mkdtempSync(join(tmpdir(), "alignsynch-migrations-"));
  fixtures.push(directory);
  for (const [name, body] of Object.entries(files)) writeFileSync(join(directory, name), body);
  return directory;
}

after(() => {
  for (const directory of fixtures) rmSync(directory, { recursive: true, force: true });
});

function run(args: string[]) {
  const result = spawnSync(
    process.execPath,
    ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", MIGRATE, ...args],
    { cwd: ROOT, env: CHILD_ENV, encoding: "utf8" },
  );
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

describe("migration prefixes: two files, one number", () => {
  it("exits non-zero and names both files", () => {
    const directory = fixture({
      "0043_first_step.sql": "SELECT 1;\n",
      "0043_second_step.sql": "SELECT 2;\n",
    });
    const { status, output } = run(["--dir", directory, "--check-prefixes"]);

    assert.notEqual(status, 0, `expected a refusal, got exit 0:\n${output}`);
    assert.equal(status, 1, `expected exit 1, got ${status}:\n${output}`);
    assert.match(output, /0043 is shared by 0043_first_step\.sql and 0043_second_step\.sql/);
    assert.match(output, /a migration number identifies one step/);
    assert.match(output, /Never renumber a file that is already applied/);
  });

  it("refuses before any env or connection work — no `target:` line is printed", () => {
    const directory = fixture({ "0007_a.sql": "SELECT 1;\n", "0007_b.sql": "SELECT 2;\n" });
    const { status, output } = run(["--dir", directory]);

    assert.equal(status, 1, `expected exit 1, got ${status}:\n${output}`);
    assert.doesNotMatch(output, /· target:/);
  });

  it("names every file in a three-way collision, not just the first pair", () => {
    const directory = fixture({
      "0012_one.sql": "SELECT 1;\n",
      "0012_two.sql": "SELECT 2;\n",
      "0012_three.sql": "SELECT 3;\n",
    });
    const { status, output } = run(["--dir", directory, "--check-prefixes"]);

    assert.equal(status, 1, `expected exit 1, got ${status}:\n${output}`);
    for (const file of ["0012_one.sql", "0012_two.sql", "0012_three.sql"]) {
      assert.ok(output.includes(file), `the refusal does not name ${file}:\n${output}`);
    }
  });

  it("refuses a file that carries no number at all", () => {
    const directory = fixture({ "fix-the-thing.sql": "SELECT 1;\n" });
    const { status, output } = run(["--dir", directory, "--check-prefixes"]);

    assert.equal(status, 1, `expected exit 1, got ${status}:\n${output}`);
    assert.match(output, /fix-the-thing\.sql is not named <number>_<slug>\.sql/);
  });
});

describe("migration prefixes: the freeze is per pair, not per number", () => {
  it("accepts the exact pair that already exists on main, and refuses a third file joining it", () => {
    const pair = ["0042_billing_plan_prices.sql", "0042_email_template_version.sql"];
    assert.deepEqual(findMigrationPrefixFindings(pair), [], "the frozen pair must pass");

    const withThird = [...pair, "0042_a_third_step.sql"];
    const findings = findMigrationPrefixFindings(withThird);
    assert.equal(findings.length, 1, "a third file must be a finding");
    assert.equal(findings[0].kind, "shared");
    assert.match(formatPrefixFindings(findings), /0042_a_third_step\.sql/);
  });

  it("freezes four pairs, and that is the whole list — a fifth is a red preflight", () => {
    assert.deepEqual(
      LEGACY_DUPLICATE_PREFIXES.map((row) => row.prefix),
      [8, 26, 28, 42],
    );
    for (const row of LEGACY_DUPLICATE_PREFIXES) {
      assert.equal(row.files.length, 2, `${row.prefix} must freeze exactly two files`);
      assert.ok(row.why.length > 20, `${row.prefix} must say why it exists`);
    }
  });
});

describe("migration prefixes: the current tree", () => {
  const files = readdirSync(MIGRATIONS).filter((name) => name.endsWith(".sql"));

  it("passes, with the four legacy pairs grandfathered by name", () => {
    assert.deepEqual(findMigrationPrefixFindings(files), []);
    assert.deepEqual(grandfatheredPrefixes(files), ["0008", "0026", "0028", "0042"]);
  });

  it("`--check-prefixes` exits 0 and says which pairs it grandfathered", () => {
    const { status, output } = run(["--check-prefixes"]);

    assert.equal(status, 0, `expected exit 0, got ${status}:\n${output}`);
    assert.match(
      output,
      /every number one step — 4 grandfathered pair\(s\): 0008, 0026, 0028, 0042/,
    );
    assert.doesNotMatch(output, /· target:/);
  });

  it("is not a gate step — `verify.sh` never runs the migration runner", () => {
    const gate = readFileSync(join(ROOT, "scripts", "verify.sh"), "utf8");
    assert.doesNotMatch(gate, /db:migrate/);
    assert.doesNotMatch(gate, /check-prefixes/);
  });
});
