/**
 * #1088 — one table for every environment variable, held against the tree in both directions.
 *
 * The cases below are the ways this table has already been wrong or could become wrong, and they
 * are deliberately about the *rule* rather than about one row: a row nobody reads, a read nobody
 * declared, a boot flag the code does not back, an environment that contradicts itself, and a
 * live-mode credential. The last case walks the real tree, because a rule nobody can violate in a
 * fixture is a comment.
 */
import { describe, expect, it } from "vitest";

import {
  ENV_ROWS,
  OUT_OF_SCOPE,
  checkManifest,
  declaredNames,
  extractBootReads,
  extractReads,
  forbiddenIn,
  readTree,
  requiredRows,
  rowsFor,
  type EnvRow,
  type SourceFile,
} from "../scripts/env-manifest";
import { carriedFile, planRender } from "../scripts/env-render";

const row = (
  name: string,
  cells: readonly [
    EnvRow["environments"]["local"],
    EnvRow["environments"]["preview"],
    EnvRow["environments"]["production"],
  ],
  source?: EnvRow["source"],
  boot = false,
): EnvRow => ({
  name,
  boot,
  environments: { local: cells[0], preview: cells[1], production: cells[2] },
  source,
  why: "fixture row",
});

/** A boot module and a plain reader, so the boot rule has something real to agree with. */
const BOOT_FILE: SourceFile = {
  path: "lib/auth/server.ts",
  source: [
    'const AUTH_ENV_BASE_URL = "NEON_AUTH_BASE_URL";',
    "export function required(name: string): string {",
    "  throw new Error(`${name} is not set`);",
    "}",
    "export const boot = () => required(AUTH_ENV_BASE_URL);",
  ].join("\n"),
};

const READER_FILE: SourceFile = {
  path: "lib/mail.ts",
  source: [
    "export const key = process.env.RESEND_API_KEY;",
    'export const host = process.env["BILLING_HOST"];',
    "export const helper = (name: string) => process.env[name];",
  ].join("\n"),
};

const fixture = (rows: EnvRow[], files: SourceFile[] = [BOOT_FILE, READER_FILE]) => ({
  files,
  rows,
  outOfScope: [],
});

describe("extractReads", () => {
  it("finds a dotted read and a bracketed literal — and never a helper's parameter", () => {
    const reads = extractReads([
      { path: "a.ts", source: `${BOOT_FILE.source}\n${READER_FILE.source}` },
    ]);
    expect([...reads.keys()].sort()).toEqual(["BILLING_HOST", "RESEND_API_KEY"]);
    expect(reads.get("RESEND_API_KEY")).toEqual(new Set(["a.ts"]));
  });
});

describe("the boot set", () => {
  it("reads the boot modules through their constant table, and only the boot modules", () => {
    const boot = extractBootReads([BOOT_FILE, READER_FILE]);
    expect([...boot.keys()]).toEqual(["NEON_AUTH_BASE_URL"]);
  });
});

describe("checkManifest", () => {
  it("passes a table that agrees with the code", () => {
    const report = checkManifest(
      fixture([
        row("NEON_AUTH_BASE_URL", ["required", "required", "required"], { carried: true }, true),
        row("RESEND_API_KEY", ["optional", "optional", "optional"], { carried: true }),
        row("BILLING_HOST", ["required", "forbidden", "required"], { carried: true }),
      ]),
    );
    expect(report.problems).toEqual([]);
    expect(report.census).toMatchObject({ declared: 3, boot: 1, unresolved: 0, outOfScope: 0 });
  });

  it("fails a read no row declares", () => {
    const report = checkManifest(
      fixture([row("NEON_AUTH_BASE_URL", ["required", "required", "required"], undefined, true)]),
    );
    const undeclared = report.problems.filter((problem) => problem.rule === "undeclared");
    expect(undeclared.map((problem) => problem.name).sort()).toEqual([
      "BILLING_HOST",
      "RESEND_API_KEY",
    ]);
    expect(undeclared[0].message).toContain("add it to ENV_ROWS or OUT_OF_SCOPE");
    expect(report.census.unresolved).toBe(2);
  });

  it("fails a row the tree never names — the row a rename left behind", () => {
    const report = checkManifest(
      fixture([
        row("NEON_AUTH_BASE_URL", ["required", "required", "required"], undefined, true),
        row("RESEND_API_KEY", ["optional", "optional", "optional"], undefined),
        row("BILLING_HOST", ["required", "forbidden", "required"], undefined),
        row("STRIPE_LEGACY_KEY", ["optional", "optional", "optional"], undefined),
      ]),
    );
    expect(report.problems).toEqual([
      expect.objectContaining({ name: "STRIPE_LEGACY_KEY", rule: "rotted" }),
    ]);
  });

  it("fails a boot variable whose row does not say so, and a row that claims boot with no reader", () => {
    const report = checkManifest(
      fixture([
        row("NEON_AUTH_BASE_URL", ["required", "required", "required"], undefined, false),
        row("RESEND_API_KEY", ["optional", "optional", "optional"], undefined, true),
        row("BILLING_HOST", ["required", "forbidden", "required"], undefined, false),
      ]),
    );
    const boot = report.problems.filter((problem) => problem.rule === "boot");
    expect(boot.map((problem) => problem.name).sort()).toEqual([
      "NEON_AUTH_BASE_URL",
      "RESEND_API_KEY",
    ]);
    expect(boot.find((problem) => problem.name === "RESEND_API_KEY")?.message).toContain(
      "no boot module",
    );
  });

  it("fails a boot variable the demo could not hold, and a row forbidden everywhere", () => {
    const report = checkManifest(
      fixture([
        row("NEON_AUTH_BASE_URL", ["required", "forbidden", "required"], undefined, true),
        row("RESEND_API_KEY", ["optional", "optional", "optional"], undefined),
        row("BILLING_HOST", ["required", "forbidden", "required"], undefined),
        row("DEAD_ROW", ["forbidden", "forbidden", "forbidden"], undefined),
      ]),
    );
    const environments = report.problems.filter((problem) => problem.rule === "environments");
    expect(environments.map((problem) => problem.name)).toContain("NEON_AUTH_BASE_URL");
    expect(
      environments.find((problem) => problem.name === "NEON_AUTH_BASE_URL")?.message,
    ).toContain("that deployment could not start");
  });

  it("fails a live-mode credential, in a vault name or in a literal", () => {
    const report = checkManifest(
      fixture([
        row("NEON_AUTH_BASE_URL", ["required", "required", "required"], undefined, true),
        row("RESEND_API_KEY", ["optional", "optional", "optional"], {
          vault: "ALIGNSYNCH_STRIPE_LIVE_KEY",
        }),
        row("BILLING_HOST", ["required", "forbidden", "required"], {
          literal: "sk_live_not_a_test_key",
        }),
      ]),
    );
    const live = report.problems.filter((problem) => problem.rule === "live");
    expect(live.map((problem) => problem.name).sort()).toEqual(["BILLING_HOST", "RESEND_API_KEY"]);
  });

  it("fails one variable declared twice", () => {
    const report = checkManifest(
      fixture([
        row("NEON_AUTH_BASE_URL", ["required", "required", "required"], undefined, true),
        row("RESEND_API_KEY", ["optional", "optional", "optional"], undefined),
        row("RESEND_API_KEY", ["optional", "optional", "optional"], undefined),
        row("BILLING_HOST", ["required", "forbidden", "required"], undefined),
      ]),
    );
    expect(report.problems).toEqual([
      expect.objectContaining({ name: "RESEND_API_KEY", rule: "duplicate" }),
    ]);
  });
});

describe("the table's own policy", () => {
  it("forbids the operator allowlist on the demo, and names no live key set", () => {
    expect(forbiddenIn("preview").has("ADMIN_EMAILS")).toBe(true);
    const sources = ENV_ROWS.flatMap((entry) =>
      [entry.source, ...Object.values(entry.sources ?? {})].flatMap((source) =>
        source === undefined
          ? []
          : "vault" in source
            ? [source.vault]
            : "literal" in source
              ? [source.literal]
              : [],
      ),
    );
    expect(sources.filter((name) => /_live\b|sk_live_|alignsynch-live/i.test(name))).toEqual([]);
  });

  it("keeps forbidden rows out of an environment's file and its required set", () => {
    expect(rowsFor("preview").some((entry) => entry.name === "ADMIN_EMAILS")).toBe(false);
    expect(requiredRows("preview").some((entry) => entry.name === "ADMIN_EMAILS")).toBe(false);
    expect(declaredNames()).toContain("DATABASE_URL");
  });

  it("names every out-of-scope variable exactly once, with a reason", () => {
    const names = OUT_OF_SCOPE.map((entry) => entry.name);
    expect(new Set(names).size).toBe(names.length);
    expect(OUT_OF_SCOPE.every((entry) => entry.why.trim().length > 10)).toBe(true);
    expect(names.some((name) => name.includes("*"))).toBe(false);
  });
});

describe("the real tree", () => {
  it("agrees with the code in both directions, with nothing unresolved", () => {
    const report = checkManifest({ files: readTree(process.cwd()) });
    expect(report.problems).toEqual([]);
    expect(report.census).toMatchObject({ declared: ENV_ROWS.length, boot: 3, unresolved: 0 });
    expect(report.census.outOfScope).toBe(OUT_OF_SCOPE.length);
  });
});

describe("a render never crosses environments", () => {
  it("reads the production file for production and the demo file for the demo", () => {
    expect(carriedFile("production")).toBe(".env");
    expect(carriedFile("preview")).toBe(".env.demo");
    expect(carriedFile("local")).toBe(".env.local");
  });

  it("refuses a required row that does not resolve, and writes no partial body", () => {
    const plan = planRender({
      environment: "production",
      rows: [
        row(
          "DATABASE_URL",
          ["required", "required", "required"],
          { vault: "ALIGNSYNCH_PROD_DATABASE_URL" },
          true,
        ),
        row("BRAND", ["required", "required", "required"], { literal: "alignsynch" }),
      ],
      vault: new Map(),
    });
    expect(plan.body).toBeNull();
    expect(plan.missing.map((entry) => entry.name)).toEqual(["DATABASE_URL"]);
    expect(plan.missing[0].from).toBe("vault ALIGNSYNCH_PROD_DATABASE_URL");
  });

  it("resolves vault, literal, derived and carried sources without printing a value", () => {
    const plan = planRender({
      environment: "preview",
      rows: [
        row(
          "DATABASE_URL",
          ["required", "required", "required"],
          { vault: "ALIGNSYNCH_DEMO_DATABASE_URL" },
          true,
        ),
        row("BRAND", ["required", "required", "required"], { literal: "alignsynch" }),
        row("APP_VERSION", ["required", "required", "required"], {
          derived: "package.json:version",
        }),
        row("DEMO_PIN", ["required", "required", "forbidden"], { carried: true }),
        row("ADMIN_EMAILS", ["optional", "forbidden", "required"], { carried: true }),
        row("STRIPE_API_VERSION", ["optional", "optional", "optional"], undefined),
      ],
      vault: new Map([["ALIGNSYNCH_DEMO_DATABASE_URL", "postgres://demo"]]),
      carried: new Map([
        ["DEMO_PIN", "4321"],
        ["ADMIN_EMAILS", "someone@example.com"],
      ]),
      derived: new Map([["package.json:version", "1.20.1"]]),
    });
    expect(plan.body).toContain("DEMO_PIN=4321");
    expect(plan.body).toContain("APP_VERSION=1.20.1");
    expect(plan.body).not.toContain("ADMIN_EMAILS");
    expect(plan.body).not.toContain("STRIPE_API_VERSION");
    expect(plan.resolutions.map((entry) => entry.name)).not.toContain("ADMIN_EMAILS");
    expect(plan.resolutions.find((entry) => entry.name === "STRIPE_API_VERSION")?.status).toBe(
      "app-default",
    );
    // The plan says where a value came from, never what it is.
    expect(Object.keys(plan.resolutions[0]).sort()).toEqual(["from", "name", "status"]);
  });

  it("fails an optional row softly: reported missing, file still written", () => {
    const plan = planRender({
      environment: "local",
      rows: [row("RESEND_FROM", ["optional", "optional", "optional"], { carried: true })],
      carried: new Map(),
    });
    expect(plan.body).not.toBeNull();
    expect(plan.missing).toEqual([]);
    expect(plan.resolutions[0].status).toBe("missing");
  });
});
