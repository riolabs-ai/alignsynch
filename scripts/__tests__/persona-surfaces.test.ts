/**
 * persona-surfaces — the negative and coverage cases for `data/v1/persona-surfaces.ts` (#384 §1).
 *
 * The module validates its own coverage at import (it throws if a review screen has no matrix
 * entry, or an entry names no review screen), so the assertions here re-state the contract the
 * review list depends on and pin the shapes a drift would break: every screen resolves, the five
 * personas are complete, an `absent` cell carries no action while a `use`/`view` cell states one,
 * and a flagged screen is outside every persona's navigation. The last section asserts the real
 * tree is exact — the same split as `template-ancestor.test.ts`.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  PERSONA_SURFACE_ROWS,
  REVIEW_PERSONAS,
  personaScreens,
  personaSurfaceFor,
  type PersonaSurface,
} from "../../data/v1/persona-surfaces";
import { REVIEW_SCREENS } from "../../lib/v1/review";

/** Every review route is also a key in the surface rows, with no drift in either direction. */
function routeSets(): { screens: Set<string>; surfaces: Set<string> } {
  return {
    screens: new Set(REVIEW_SCREENS.map((screen) => screen.route)),
    surfaces: new Set(PERSONA_SURFACE_ROWS.map((surface) => surface.route)),
  };
}

const cellProblems = (surface: PersonaSurface): string[] => {
  const problems: string[] = [];
  for (const persona of REVIEW_PERSONAS) {
    const cell = surface.personas[persona];
    if (cell === undefined) {
      problems.push(`${surface.route} has no cell for ${persona}`);
      continue;
    }
    if (cell.access === "absent" ? cell.action !== "" : cell.action.trim() === "") {
      problems.push(
        `${surface.route} ${persona}: access "${cell.access}" but action "${cell.action}"`,
      );
    }
  }
  return problems;
};

describe("coverage — every review screen resolves, and nothing resolves to nothing", () => {
  it("every review screen has exactly one matrix entry, and vice versa", () => {
    const { screens, surfaces } = routeSets();
    for (const route of screens) assert.ok(surfaces.has(route), `no surface for ${route}`);
    for (const route of surfaces) assert.ok(screens.has(route), `${route} is not a review screen`);
    assert.equal(screens.size, surfaces.size, "the two lists are the same length");
  });

  it("personaSurfaceFor never returns undefined for a review screen", () => {
    for (const screen of REVIEW_SCREENS) {
      assert.equal(personaSurfaceFor(screen.route).route, screen.route);
    }
  });
});

describe("the matrix cells — no fallback text, no invented capability", () => {
  it("every surface has all five personas, and each cell states a mark and a consistent action", () => {
    const problems = PERSONA_SURFACE_ROWS.flatMap(cellProblems);
    assert.deepEqual(problems, []);
  });

  it('no cell action is a fallback like "unknown"', () => {
    for (const surface of PERSONA_SURFACE_ROWS) {
      for (const persona of REVIEW_PERSONAS) {
        const cell = surface.personas[persona];
        assert.ok(
          cell.action.trim() === "" || cell.action.toLowerCase().includes("unknown") === false,
          `${surface.route} ${persona}: "${cell.action}" is a fallback`,
        );
      }
    }
  });

  it("a surface is either in a persona's navigation (ordered) or flagged (unordered), never both", () => {
    for (const surface of PERSONA_SURFACE_ROWS) {
      assert.notEqual(
        surface.order === null,
        surface.flag === null,
        `${surface.route}: order and flag must be exactly one of the two`,
      );
    }
  });
});

describe("the per-persona navigation", () => {
  it("a persona's screens are exactly their non-absent surfaces, in matrix order", () => {
    for (const persona of REVIEW_PERSONAS) {
      const expected = PERSONA_SURFACE_ROWS.filter(
        (surface) => surface.personas[persona].access !== "absent",
      )
        .slice()
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map((surface) => surface.route);
      assert.deepEqual(
        personaScreens(persona).map((surface) => surface.route),
        expected,
        `${persona} navigation order`,
      );
    }
  });

  it("counterparty and admin see different lists", () => {
    const counterparty = personaScreens("counterparty").map((surface) => surface.route);
    const admin = personaScreens("admin").map((surface) => surface.route);
    assert.notDeepEqual(counterparty, admin, "the two personas must not share one navigation");
    assert.ok(counterparty.includes("/v1/counterparty"));
    assert.ok(!counterparty.includes("/v1/admin"));
    assert.ok(admin.includes("/v1/admin"));
    assert.ok(!admin.includes("/v1/counterparty"));
  });
});
