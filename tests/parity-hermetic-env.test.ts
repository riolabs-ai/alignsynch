/**
 * The parity child's environment is the gate's, not the developer's (#1066) — the sibling of
 * `tests/db-client.test.ts`.
 *
 * `tests/db-client.test.ts` pins what the app does when there is no `DATABASE_URL`: the read
 * becomes `DatabaseUnavailableError` and the screen prints its sentence instead of a digest. That
 * is only the *gate's* behaviour if the harness really runs without one, and until #1066 it did
 * not — `pnpm parity` handed its two render processes `...process.env`, so a shell that had
 * sourced `.env.local` rendered the brand boundary's `/admin/billing` from the demo branch's live
 * rows (four of them, measured) while CI, which has no connection string by design, rendered the
 * page's own "could not be read" band. One harness, two renders, and the one a developer saw was
 * a fact about their laptop.
 *
 * So these cases pin the seam rather than a route: what the helper removes, what it must leave,
 * that it never mutates the caller, and the anchors that stop it becoming a substring filter —
 * because a strip list that widened would take `PATH` out of the child env and a strip list that
 * narrowed would quietly stop stripping the one name that matters.
 */
import { describe, expect, it } from "vitest";

import { hermeticEnv, isStripped, strippedKeys } from "../scripts/parity-env.mjs";

/** A developer shell that has sourced the checkout's `.env.local`, values deliberately fake. */
const DEVELOPER_ENV = {
  PATH: "/usr/local/bin:/usr/bin",
  HOME: "/home/tester",
  TZ: "UTC",
  LANG: "en_US.UTF-8",
  LC_ALL: "en_US.UTF-8",
  BRAND: "quizhub",
  PARITY_BRAND: "quizhub",
  APP_VERSION: "1.20.0",
  // The families the render must not read.
  DATABASE_URL: "postgres://ignored/db",
  DATABASE_URL_UNPOOLED: "postgres://ignored/db",
  PGHOST: "ignored.example",
  PGPASSWORD: "ignored",
  POSTGRES_URL: "postgres://ignored/db",
  NEON_AUTH_BASE_URL: "https://ignored.example",
  NEON_AUTH_COOKIE_SECRET: "ignored",
  NEON_AUTH_JWKS_URL: "https://ignored.example/jwks",
  NEON_BRANCH: "demo",
  NEON_API_KEY: "ignored",
  NEON_OBJSTORE_BUCKET: "ignored",
  // Anchored in both directions: these mention a family without being part of one.
  DATABASE_URL_LEGACY: "postgres://ignored/db",
  SOMETHING_NEON: "kept",
};

describe("the parity child env", () => {
  it("keeps everything that is part of the measurement and drops the rest", () => {
    expect(Object.keys(hermeticEnv(DEVELOPER_ENV)).sort()).toEqual(
      [
        "APP_VERSION",
        "BRAND",
        "DATABASE_URL_LEGACY",
        "HOME",
        "LANG",
        "LC_ALL",
        "PARITY_BRAND",
        "PATH",
        "SOMETHING_NEON",
        "TZ",
      ].sort(),
    );
  });

  it("names what it dropped, and names are all it carries", () => {
    expect(strippedKeys(DEVELOPER_ENV)).toEqual(
      [
        "DATABASE_URL",
        "DATABASE_URL_UNPOOLED",
        "NEON_API_KEY",
        "NEON_AUTH_BASE_URL",
        "NEON_AUTH_COOKIE_SECRET",
        "NEON_AUTH_JWKS_URL",
        "NEON_BRANCH",
        "NEON_OBJSTORE_BUCKET",
        "PGHOST",
        "PGPASSWORD",
        "POSTGRES_URL",
      ].sort(),
    );

    // The point of `strippedKeys` is a gate log line: it must never be able to carry a value.
    const line = `dropped: ${strippedKeys(DEVELOPER_ENV).join(", ")}`;
    expect(line).not.toContain("postgres://");
    expect(line).not.toContain("ignored.example");
  });

  it("leaves the caller's environment alone, so the next gate step still has its credentials", () => {
    const before = { ...DEVELOPER_ENV };
    hermeticEnv(DEVELOPER_ENV);
    expect(DEVELOPER_ENV).toEqual(before);
  });

  it("strips a variable this process really carries, without deleting it from process.env", () => {
    const key = "DATABASE_URL";
    const had = Object.hasOwn(process.env, key);
    const previous = process.env[key];

    process.env[key] = "postgres://ignored/db";
    try {
      expect(hermeticEnv(process.env)[key]).toBeUndefined();
      expect(Object.hasOwn(process.env, key)).toBe(true);
    } finally {
      if (had) process.env[key] = previous;
      else delete process.env[key];
    }
  });

  it("anchors both ends, so a similar name is neither stripped nor missed", () => {
    expect(isStripped("NEON_AUTH_BASE_URL")).toBe(true);
    expect(isStripped("POSTGRES_URL")).toBe(true);
    expect(isStripped("PGDATABASE")).toBe(true);
    expect(isStripped("DATABASE_URL_LEGACY")).toBe(false);
    expect(isStripped("SOMETHING_NEON")).toBe(false);
    expect(isStripped("PATH")).toBe(false);
  });
});
