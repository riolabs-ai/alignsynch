// @vitest-environment jsdom
/**
 * The tour's scripted example (#457) — the four claims the card is accepted on, driven through
 * the component the page mounts rather than through its helpers:
 *
 *   1. **it fills the real sheet** — the answers land on the actual `<input type="radio">`
 *      controls `AnswerForm` renders, so the DOM's own checked state is the proof, not a state
 *      variable this test could read back;
 *   2. **it stops on touch** — a keypress mid-script cancels the remaining ticks, keeps what was
 *      already answered, and hands the sheet over (a later manual click still works);
 *   3. **reduced motion fills instantly** — with the preference set, one dispatch puts every
 *      answer in and no timer runs;
 *   4. **it writes nothing** — the form's submit event is cancelled on the form itself, so the
 *      only writer in the example cannot navigate.
 *
 * Plus the coupling the card asks for between the copy and the answers: step 4's sentence quotes
 * the same values the script clicks, and every scripted answer is one the sheet's mode asks.
 *
 * `tests/tour-steps.test.ts` covers the join from fixture to markup; this file is the one that
 * needs a DOM because the whole point of the demo is that a person's control starts it.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DemoFill } from "@/components/tour/demo-fill";
import { opinionKindsFor } from "@/content/assessment";
import { SCORE_MAX, SCORE_MIN } from "@/content/record";
import { assessments } from "@/data/assessments";
import { assessmentInstancePageCopy } from "@/data/pages/assessment-instance";
import { tourDemoAnswers, tourPageCopy } from "@/data/pages/tour";
import {
  demoAspectsOf,
  TOUR_DEMO_MODE,
  TOUR_DEMO_STEP,
  TOUR_DEMO_TEMPLATE_ID,
  TOUR_STEP_EVENT,
} from "@/lib/tour/demo-script";

declare global {
  // React reads this to know it is inside `act()`; without it every update is unmocked.
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const template = assessments.find((record) => record.id === TOUR_DEMO_TEMPLATE_ID);
if (template === undefined) throw new Error("the example's template is not in the fixture");
const aspects = demoAspectsOf(template);
/** The first scripted answer's own control — the one the first tick must check. */
const first = tourDemoAnswers[0];

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Mount the example as `/dashboard` mounts it. */
function mount(): void {
  act(() => {
    root.render(
      <DemoFill
        copy={tourPageCopy}
        sheetCopy={assessmentInstancePageCopy}
        aspects={aspects}
        answers={tourDemoAnswers}
        exampleTitle={template?.title ?? ""}
        mode={TOUR_DEMO_MODE}
      />,
    );
  });
}

/** The tour arrives at step 4. */
function arriveAtStep4(): void {
  act(() => {
    document.dispatchEvent(new CustomEvent(TOUR_STEP_EVENT, { detail: TOUR_DEMO_STEP }));
  });
}

/** Advance the script's clock inside `act`, so every state update is flushed. */
function tick(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/** The real radio for one scripted answer, as the sheet rendered it. */
function radio(itemId: string, kind: string, score: number): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>(
    `input[name="${kind}:${itemId}"][value="${score}"]`,
  );
  expect(input, `the sheet rendered no ${kind}:${itemId} radio for ${score}`).not.toBeNull();
  return input as HTMLInputElement;
}

/** The answers actually checked in the document, in the fixture's order. */
function checkedAnswers(): string[] {
  return tourDemoAnswers
    .filter((answer) => {
      const aspect = aspects[answer.aspect];
      if (aspect === undefined) return false;
      return radio(aspect.itemId, answer.kind, answer.you).checked;
    })
    .map((answer) => `${answer.kind}:${answer.you}`);
}

describe("the scripted example fills the real sheet", () => {
  it("clicks the sheet's own radios when the tour reaches step 4", () => {
    mount();
    expect(checkedAnswers()).toEqual([]);

    arriveAtStep4();
    tick(10_000);

    expect(checkedAnswers()).toEqual(
      tourDemoAnswers.map((answer) => `${answer.kind}:${answer.you}`),
    );
    expect(container.querySelector("[data-demo-phase]")?.getAttribute("data-demo-phase")).toBe(
      "done",
    );
  });

  it("fills progressively, so a mid-script capture is a real intermediate state", () => {
    mount();
    arriveAtStep4();

    tick(600);
    expect(checkedAnswers()).toHaveLength(1);
    expect(container.querySelector("[data-demo-phase]")?.getAttribute("data-demo-phase")).toBe(
      "filling",
    );

    tick(10_000);
    expect(checkedAnswers()).toHaveLength(tourDemoAnswers.length);
  });

  it("reveals the two answers and the Gap between them once it finishes", () => {
    mount();
    arriveAtStep4();
    tick(10_000);

    const gaps = [...container.querySelectorAll("[data-demo-gap-value]")].map((node) =>
      node.getAttribute("data-demo-gap-value"),
    );
    expect(gaps).toEqual(
      tourDemoAnswers.map((answer) => String(Math.abs(answer.you - answer.theirs))),
    );
  });

  it("never lets the sheet's submit leave the page", () => {
    mount();
    const form = container.querySelector("form");
    expect(form, "the example rendered no form").not.toBeNull();

    const submit = new Event("submit", { bubbles: true, cancelable: true });
    act(() => {
      form?.dispatchEvent(submit);
    });

    expect(submit.defaultPrevented).toBe(true);
    expect(container.querySelector("[data-demo-submitted]")).not.toBeNull();
  });
});

describe("the example stops on touch", () => {
  it("cancels the remaining answers on a keypress and hands the sheet over", () => {
    mount();
    arriveAtStep4();
    tick(600);
    expect(checkedAnswers()).toHaveLength(1);

    const sheet = radio(aspects[0]?.itemId ?? "", first?.kind ?? "feel", first?.you ?? 5);
    act(() => {
      sheet.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });

    tick(10_000);
    expect(checkedAnswers()).toHaveLength(1);
    expect(container.querySelector("[data-demo-phase]")?.getAttribute("data-demo-phase")).toBe(
      "cancelled",
    );

    // Control is handed over, not taken away: a person's own click still answers the sheet.
    const second = radio(
      aspects[1]?.itemId ?? "",
      tourDemoAnswers[2]?.kind ?? "feel",
      tourDemoAnswers[2]?.you ?? 5,
    );
    act(() => {
      second.click();
    });
    expect(second.checked).toBe(true);
  });

  it("ignores the script's own clicks, so filling does not cancel itself", () => {
    mount();
    arriveAtStep4();
    tick(10_000);

    expect(container.querySelector("[data-demo-phase]")?.getAttribute("data-demo-phase")).toBe(
      "done",
    );
    expect(checkedAnswers()).toHaveLength(tourDemoAnswers.length);
  });
});

describe("reduced motion", () => {
  it("fills every answer in one pass and starts no timer", () => {
    vi.stubGlobal(
      "matchMedia",
      () =>
        ({
          matches: true,
          media: "(prefers-reduced-motion: reduce)",
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        }) as MediaQueryList,
    );

    mount();
    arriveAtStep4();

    // No clock advanced: the answers are in the document already.
    expect(checkedAnswers()).toHaveLength(tourDemoAnswers.length);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("one export feeds the copy and the script", () => {
  it("quotes the scripted numbers in step 4's sentence", () => {
    const step = tourPageCopy.sections?.find((section) => section.id === TOUR_DEMO_STEP);
    expect(step?.body).toBeDefined();
    expect(step?.body).toContain(String(first?.you));
    expect(step?.body).toContain(String(first?.theirs));
  });

  it("answers only the Opinions the example's mode asks, inside the 1..5 band", () => {
    const asked = opinionKindsFor(TOUR_DEMO_MODE);
    for (const answer of tourDemoAnswers) {
      expect(asked).toContain(answer.kind);
      expect(answer.you).toBeGreaterThanOrEqual(SCORE_MIN);
      expect(answer.you).toBeLessThanOrEqual(SCORE_MAX);
      expect(answer.theirs).toBeGreaterThanOrEqual(SCORE_MIN);
      expect(answer.theirs).toBeLessThanOrEqual(SCORE_MAX);
    }
  });

  it("names an Aspect the example's own two-Aspect sheet renders", () => {
    for (const answer of tourDemoAnswers) {
      expect(aspects[answer.aspect], `answer for aspect ${answer.aspect}`).toBeDefined();
    }
  });
});
