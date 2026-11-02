/**
 * The surface registry's negative cases (`data/surface-registry.ts`, issue #409).
 *
 * A registry that cannot fail is decoration: it would say four surfaces are live because four
 * rows were typed, and nothing would notice a fifth, a duplicate, or a pending row that never
 * says what it needs. So every rule below is asserted against a violating input — not against a
 * grep — and then against the real tree, which must stay clean.
 *
 * Two halves, matching the two ways the registry can lie:
 *
 *   - **the schema** (`zSurface`) refuses a shape: a `status` outside the three literals, an
 *     unknown key (`.strict()`), a `needs` list that is empty or holds an empty string;
 *   - **the invariants** (`surfaceRegistryProblems`) refuse a row that parses and is still false:
 *     the same route declared twice, a pending surface with no reason or no `needs`, a live
 *     surface carrying an excuse, or a live surface whose route `content/routes.ts` does not
 *     carry.
 *
 * The last case is the one that makes `live` a claim rather than a mood: `E7` already holds the
 * manifest and `app/` to each other, so a live entry that names a manifest route is an entry
 * whose page exists.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ROUTE_PATTERNS } from "../../content/routes";
import {
  type Surface,
  requireSurface,
  surfaceFor,
  surfaceRegistry,
  surfaceRegistryProblems,
  zSurface,
} from "../../data/surface-registry";

/** The predicate `data:check` supplies (E36). */
const inManifest = (route: string) => ROUTE_PATTERNS.includes(route);

/** A valid pending row, so each invariant case mutates exactly the one field it is about. */
const pendingRow = (overrides: Partial<Surface> = {}): Surface => ({
  route: "/shop",
  label: "Shop",
  area: "comms",
  status: "pending",
  reason: "No shop surface exists in the app yet.",
  needs: ["needs authenticated writes"],
  ...overrides,
});

const liveRow = (overrides: Partial<Surface> = {}): Surface => ({
  route: "/assessment/templates",
  label: "Template catalogue",
  area: "relationships",
  status: "live",
  ...overrides,
});

describe("the real surface registry", () => {
  it("passes every invariant, against the real route manifest", () => {
    assert.deepEqual(surfaceRegistryProblems(surfaceRegistry, inManifest), []);
  });

  it("declares the five read surfaces live, and only those", () => {
    const live = surfaceRegistry.filter((row) => row.status === "live").map((row) => row.route);
    assert.deepEqual(live.sort(), [
      "/assessment/instances",
      "/assessment/instances/[instanceId]",
      "/assessment/instances/[instanceId]/report",
      "/assessment/templates",
      "/assessment/templates/[templateId]",
    ]);
  });

  it("declares the three shipped-but-unwired screens as preview, never live", () => {
    const preview = surfaceRegistry
      .filter((row) => row.status === "preview")
      .map((row) => row.route);
    assert.deepEqual(preview.sort(), [
      "/assessment/instances/[instanceId]/accept",
      "/assessment/instances/[instanceId]/answer",
      "/assessment/templates/[templateId]/create",
    ]);
  });

  it("gives every surface that is not live a reason and at least one need", () => {
    const notLive = surfaceRegistry.filter((row) => row.status !== "live");
    assert.ok(notLive.length > 0, "a registry with nothing pending proves nothing about greying");
    for (const row of notLive) {
      assert.ok(row.reason !== undefined && row.reason.length > 0, `${row.route} has no reason`);
      assert.ok(
        row.needs !== undefined && row.needs.length > 0,
        `${row.route} has no needs — the page could not say what is missing`,
      );
    }
  });

  it("has one row per route", () => {
    const routes = surfaceRegistry.map((row) => row.route);
    assert.equal(new Set(routes).size, routes.length);
  });
});

describe("the schema refuses a status the product does not have", () => {
  it('rejects status: "done"', () => {
    const result = zSurface.safeParse({ ...pendingRow(), status: "done" });
    assert.equal(result.success, false);
    assert.deepEqual(
      result.success ? [] : result.error.issues.map((issue) => issue.path.join(".")),
      ["status"],
    );
  });

  it("accepts the three literals and nothing else", () => {
    for (const status of ["live", "preview", "pending"]) {
      assert.equal(zSurface.safeParse({ ...pendingRow(), status }).success, true, status);
    }
    assert.equal(zSurface.safeParse({ ...pendingRow(), status: "shipped" }).success, false);
  });

  it("rejects an unknown key (.strict())", () => {
    assert.equal(zSurface.safeParse({ ...pendingRow(), wired: true }).success, false);
  });

  it("rejects an empty needs list and an empty need", () => {
    assert.equal(zSurface.safeParse({ ...pendingRow(), needs: [] }).success, false);
    assert.equal(zSurface.safeParse({ ...pendingRow(), needs: [""] }).success, false);
  });

  it("rejects a route that is not absolute", () => {
    assert.equal(zSurface.safeParse({ ...pendingRow(), route: "shop" }).success, false);
  });
});

describe("the invariants refuse a row that parses but cannot be true", () => {
  it("rejects two rows for one route", () => {
    const problems = surfaceRegistryProblems(
      [pendingRow(), pendingRow({ label: "Shop again" })],
      inManifest,
    );
    assert.equal(problems.length, 1);
    assert.match(problems[0], /route declared twice/);
  });

  it("rejects a pending surface with no reason", () => {
    const { reason: _reason, ...row } = pendingRow();
    const problems = surfaceRegistryProblems([row as Surface], inManifest);
    assert.equal(problems.length, 1);
    assert.match(problems[0], /pending without a reason/);
  });

  it("rejects a pending surface with no needs", () => {
    const { needs: _needs, ...row } = pendingRow();
    const problems = surfaceRegistryProblems([row as Surface], inManifest);
    assert.equal(problems.length, 1);
    assert.match(problems[0], /pending without needs/);
  });

  it("rejects a live surface carrying a reason", () => {
    const problems = surfaceRegistryProblems(
      [liveRow({ reason: "it reads a stub", needs: ["needs nothing, actually"] })],
      inManifest,
    );
    assert.equal(problems.length, 1);
    assert.match(problems[0], /live surface carries a reason or needs/);
  });

  it("rejects a live route the manifest does not carry", () => {
    const problems = surfaceRegistryProblems(
      [liveRow({ route: "/assessment/instances/[instanceId]/nowhere" })],
      inManifest,
    );
    assert.equal(problems.length, 1);
    assert.match(problems[0], /content\/routes\.ts does not carry it/);
  });

  it("rejects an empty registry", () => {
    assert.match(surfaceRegistryProblems([], inManifest)[0], /registry is empty/);
  });
});

describe("the lookups the nav and a pending page use", () => {
  it("finds a surface by its route pattern", () => {
    assert.equal(surfaceFor("/shop")?.status, "pending");
    assert.equal(surfaceFor("/assessment/templates")?.status, "live");
    assert.equal(surfaceFor("/nowhere"), undefined);
  });

  it("refuses a route the registry does not declare, naming it", () => {
    assert.throws(() => requireSurface("/nowhere"), /no surface registered for "\/nowhere"/);
    assert.equal(requireSurface("/shop").label, "Shop");
  });
});
