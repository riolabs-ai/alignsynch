/**
 * The ten-step demo walkthrough is a **claim about ten screens**, and both halves of that claim can
 * rot without a red build: the manifest can stop being ten steps with two captures each, and the
 * committed report can stop describing the manifest. `pnpm demo:walkthrough` needs a browser, a live
 * demo branch and a PIN, so it is not a gate step — which is exactly why everything about it that
 * *can* be checked offline is checked here, inside `pnpm test`.
 *
 * Four groups:
 *
 *   1. **the shape the card asks for** — ten steps numbered 1..10, two widths (390 and 1280), one
 *      capture name per width per step, at least one expected string per step. A step with no
 *      assertion is a printout, and this is where that stops being possible.
 *   2. **the counterparty boundary** — the run is one session, so a step that needs a second identity
 *      belongs in `BLOCKED` and never in `STEPS`. The step that would breach it is the one that
 *      quietly scores a counterparty screen as captured.
 *   3. **the committed report is the manifest's render** — `docs/operations/demo-walkthrough.md`
 *      carries the rows between two markers, and `renderRegion()` is the only author of them. Editing
 *      a step without regenerating the page fails here, not in a reader's browser.
 *   4. **the report names what it does not cover** — every blocked step, with what it would prove, is
 *      printed in the page. A walkthrough that silently omits the two-party half reads as complete.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  BLOCKED,
  REPORT_BEGIN,
  REPORT_END,
  REPORT_PAGE,
  STEPS as RAW_STEPS,
  WIDTHS,
  committedRegion,
  manifestProblems,
  renderRegion,
} from "../scripts/demo-walkthrough.mjs";

/** The step shape this file holds the script to — a second reader of the same contract. */
interface Step {
  n: number;
  id: string;
  title: string;
  needs: "visitor" | "initiator";
  route: string;
  acts: unknown[];
  expect: string[];
  absent?: string[];
  selectors?: string[];
  roles?: string[];
  field?: { selector: string; value: string };
  routePattern?: string;
}

const STEPS = RAW_STEPS as unknown as Step[];
const ROOT = process.cwd();

/** The page as committed, read once. */
const PAGE = readFileSync(join(ROOT, REPORT_PAGE), "utf8");

describe("the walk is ten steps, two widths, one assertion each", () => {
  it("holds the shape the card asks for, and says so by name when it does not", () => {
    expect(manifestProblems()).toEqual([]);
    expect(STEPS).toHaveLength(10);
    expect(WIDTHS).toEqual([390, 1280]);
  });

  it("numbers the steps contiguously and names each one once", () => {
    expect(STEPS.map((step) => step.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(new Set(STEPS.map((step) => step.id)).size).toBe(STEPS.length);
  });

  it("asserts text on every step — a capture with no assertion is a printout", () => {
    for (const step of STEPS) {
      expect(step.expect.length, `${step.id} asserts nothing`).toBeGreaterThan(0);
      for (const needle of step.expect) expect(needle.trim().length).toBeGreaterThan(3);
    }
  });

  it("gives every step a capture at each width, with no two steps sharing a name", () => {
    const names = STEPS.flatMap((step) =>
      WIDTHS.map((width) => `${String(step.n).padStart(2, "0")}-${step.id}-${width}.png`),
    );
    expect(names).toHaveLength(20);
    expect(new Set(names).size).toBe(20);
  });

  it("declares a route, and a shape for the one route it cannot know in advance", () => {
    for (const step of STEPS) expect(step.route.startsWith("/")).toBe(true);
    const chosen = STEPS.filter((step) => step.route.includes("<"));
    expect(chosen).toHaveLength(1);
    // The placeholder route is only honest with a pattern the observed path is matched against.
    expect(chosen[0]?.routePattern).toBeTypeOf("string");
  });
});

describe("the counterparty boundary", () => {
  it("keeps every walked step in one session", () => {
    for (const step of STEPS) expect(["visitor", "initiator"]).toContain(step.needs);
  });

  it("declares the two-party screens it does not walk", () => {
    expect(BLOCKED.length).toBeGreaterThan(0);
    for (const blocked of BLOCKED) {
      // Declared and walked at once would be a step scored as proved that nobody took.
      expect(STEPS.some((step) => step.id === blocked.id)).toBe(false);
      expect(blocked.wouldProve.trim().length).toBeGreaterThan(10);
    }
  });
});

describe("the committed report is the manifest's own words", () => {
  it("carries both markers, so the generated region has a home", () => {
    expect(PAGE).toContain(REPORT_BEGIN);
    expect(PAGE).toContain(REPORT_END);
  });

  it("says exactly what renderRegion() writes — regenerate with --write, never by hand", () => {
    expect(committedRegion(PAGE)?.trim()).toBe(renderRegion().trim());
  });

  it("names every step's route, both capture files and every expected string", () => {
    const region = committedRegion(PAGE) ?? "";
    for (const step of STEPS) {
      expect(region).toContain(step.route);
      for (const width of WIDTHS) {
        expect(region).toContain(`${String(step.n).padStart(2, "0")}-${step.id}-${width}.png`);
      }
      for (const needle of step.expect) expect(region).toContain(needle);
    }
  });

  it("prints what it does not cover, so the walk never reads as complete", () => {
    const region = committedRegion(PAGE) ?? "";
    for (const blocked of BLOCKED) expect(region).toContain(blocked.title);
  });
});
