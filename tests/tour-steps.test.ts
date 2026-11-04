/** @vitest-environment jsdom */
/**
 * The tour's step join (#455), pinned where a browser cannot reach: every combination of anchors
 * and steps at once.
 *
 * The three claims the issue makes are the three groups here:
 *
 *   1. **fixture order is tour order** — `data/pages/tour.ts`'s `sections` array is the list, so a
 *      reordered fixture reorders the tour with no code change;
 *   2. **a step whose target is absent is skipped, not faked** — whether the element is missing
 *      from the page or present-but-not-rendered, the step does not appear and is not counted;
 *   3. **the words come from the fixture, and a step with no paragraph is a fixture defect** — the
 *      reader throws at the join instead of rendering a title over an empty body.
 *
 * `runnableSteps` takes its root and its visibility predicate as arguments, so the first two
 * groups need no real layout. Group four is the one test about the DOM's own answer: jsdom has no
 * `checkVisibility`, so it is stubbed to prove `isRendered` reads it when the engine has it.
 */
import { describe, expect, it } from "vitest";

import { zPageCopy } from "@/content/pages";
import { tourPageCopy } from "@/data/pages/tour";
import { anchorSelector, isRendered, runnableSteps, stepTextOf } from "@/lib/tour/steps";

/** Every id the fixture declares, in fixture order — the expected tour. */
const FIXTURE_IDS = (tourPageCopy.sections ?? []).map((section) => section.id);

/** A document holding an anchor per id, in the given order. */
function documentWith(ids: readonly string[]): Document {
  const doc = document.implementation.createHTMLDocument("tour");
  for (const id of ids) {
    const element = doc.createElement("span");
    element.setAttribute("data-tour", id);
    doc.body.appendChild(element);
  }
  return doc;
}

/** The predicate the layout-free groups use: "the anchor is there" is the whole question. */
const present = () => true;

describe("the six steps, joined to the anchors on the page", () => {
  it("declares the six steps the issue names, in fixture order", () => {
    expect(FIXTURE_IDS).toEqual(["dashboard", "relationships", "start", "answer", "blind", "help"]);
  });

  it("returns every step when every anchor is on the page, in fixture order", () => {
    const steps = runnableSteps(tourPageCopy, documentWith(FIXTURE_IDS), present);

    expect(steps.map((step) => step.id)).toEqual(FIXTURE_IDS);
  });

  it("carries the element the anchor is on, not a copy of it", () => {
    const doc = documentWith(["dashboard"]);
    const anchor = doc.querySelector(anchorSelector("dashboard"));

    expect(runnableSteps(tourPageCopy, doc, present)[0]?.element).toBe(anchor);
  });

  it("takes each step's words from the fixture", () => {
    const doc = documentWith(FIXTURE_IDS);
    const steps = runnableSteps(tourPageCopy, doc, present);

    for (const step of steps) {
      expect(step.heading).toBe(stepTextOf(tourPageCopy, step.id).heading);
      expect(step.body.length).toBeGreaterThan(0);
    }
  });
});

describe("a step whose target is absent is skipped", () => {
  it("drops the steps with no anchor, and keeps the rest in order", () => {
    // A returning account: the console has no empty-state card, so the three steps that point
    // into it have nothing to highlight. The list, the template card and the rail remain.
    const doc = documentWith(["dashboard", "relationships", "start", "help"]);

    expect(runnableSteps(tourPageCopy, doc, present).map((step) => step.id)).toEqual([
      "dashboard",
      "relationships",
      "start",
      "help",
    ]);
  });

  it("drops a step whose element is on the page but not rendered", () => {
    // The rail is `invisible` under 768px: the Support row is in the DOM and would highlight as a
    // 250px panel that is off-canvas. "Rendered" is the second half of "present".
    const doc = documentWith(FIXTURE_IDS);
    const hidden = new Set(["help"]);

    const steps = runnableSteps(tourPageCopy, doc, (element) => {
      const id = element.getAttribute("data-tour");
      return id === null || !hidden.has(id);
    });

    expect(steps.map((step) => step.id)).not.toContain("help");
    expect(steps).toHaveLength(FIXTURE_IDS.length - 1);
  });

  it("runs no steps at all on a page with no anchor", () => {
    // The component treats this as "no tour", not as a tour with an empty callout.
    expect(runnableSteps(tourPageCopy, documentWith([]), present)).toEqual([]);
  });
});

describe("renderedness — the DOM answer when the engine has one", () => {
  it("reads checkVisibility, so a visibility:hidden anchor is not a target", () => {
    const doc = documentWith(["help"]);
    const element = doc.querySelector(anchorSelector("help"));
    expect(element).not.toBeNull();
    if (element === null) return;

    Object.defineProperty(element, "checkVisibility", {
      configurable: true,
      value: () => false,
    });

    expect(isRendered(element)).toBe(false);
    expect(runnableSteps(tourPageCopy, doc, isRendered)).toEqual([]);
  });

  it("answers true for an element the engine reports as visible", () => {
    const doc = documentWith(["help"]);
    const element = doc.querySelector(anchorSelector("help"));
    expect(element).not.toBeNull();
    if (element === null) return;

    Object.defineProperty(element, "checkVisibility", {
      configurable: true,
      value: () => true,
    });

    expect(isRendered(element)).toBe(true);
  });

  it("falls back to a box when the engine has no checkVisibility", () => {
    const doc = documentWith(["help"]);
    const element = doc.querySelector(anchorSelector("help"));
    expect(element).not.toBeNull();
    if (element === null) return;

    // jsdom's own shape: no `checkVisibility`, and a zero-size rect for everything.
    expect(isRendered(element)).toBe(false);
  });
});

describe("the fixture contract", () => {
  it("throws on a step with a heading and no paragraph", () => {
    const copy = zPageCopy.parse({
      heading: "A tour",
      sections: [{ id: "dashboard", heading: "Your console" }],
    });

    expect(() => stepTextOf(copy, "dashboard")).toThrow(/half-written/);
  });

  it("throws on a section id the fixture does not carry", () => {
    expect(() => stepTextOf(tourPageCopy, "nope")).toThrow(/no section "nope"/);
  });
});
