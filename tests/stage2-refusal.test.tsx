/** @vitest-environment jsdom */

/**
 * **Stage 2 refuses in words, not in silence (#975 D7).**
 *
 * The inventory measured the defect as two facts that arrive together: `form.checkValidity() ===
 * false` on arrival (both `required` groups unchecked, by design), and **no sentence on screen**
 * after pressing `Continue to Stage 3` — the browser's own bubble is not the screen, so the person
 * cannot tell "I must choose" from "this page is broken".
 *
 * So the assertion is not "the form is invalid". It is the pair: the press is refused *and* a
 * sentence names the field it refused, at that field, with the group's own radios pointing at it.
 * That is why this file mounts the real client component in jsdom and presses the real button —
 * a server-rendered string can only ever show the first state.
 *
 * Four claims, and the second is the card's acceptance line:
 *
 *   1. the stage arrives with nothing selected and both groups still `required` (the must-not:
 *      the fix may not make the fields optional to make the button work);
 *   2. pressing with nothing selected leaves the person on stage 2 **and prints
 *      `Opinions Mode is required.` / `Alignment Setting is required.`** — the fixture's own
 *      `validation.required` sentence, not a string typed into the component;
 *   3. choosing one group clears that group's sentence and leaves the other's standing;
 *   4. with both answered the press is no longer refused: no sentence, no `preventDefault`, and
 *      the form is valid — the advance works.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type ChoiceGroup, StageChoiceForm } from "@/components/assessment-flow/stage-choice-form";
import { assessmentCreatePageCopy } from "@/data/pages/assessment-create";
import {
  ALIGNMENT_SETTINGS,
  ASSESSMENT_MODES,
  MODE_LABELS,
  SETTING_LABELS,
} from "@/content/assessment";
import { fieldSentence } from "@/lib/flow/create-copy";
import { itemLabel, sectionOf } from "@/lib/page-copy";

const MODE = sectionOf(assessmentCreatePageCopy, "mode");

/**
 * The two groups exactly as `create-relationship.tsx` builds them: labels from the fixture, the
 * refusal sentence composed by the same function the server's band uses. Nothing here is retyped
 * copy, so a renamed fixture row renames both states.
 */
const GROUPS: ChoiceGroup[] = [
  {
    name: "mode",
    legend: itemLabel(MODE, "mode-label"),
    badge: itemLabel(MODE, "mode-fixed"),
    options: ASSESSMENT_MODES.map((value) => ({
      value,
      label: MODE_LABELS[value],
      help: itemLabel(MODE, value === "basic" ? "mode-basic-help" : "mode-advanced-help"),
    })),
    requiredSentence: fieldSentence("mode", "required") ?? "",
  },
  {
    name: "alignmentSetting",
    legend: itemLabel(MODE, "setting-label"),
    intro: itemLabel(MODE, "setting-help"),
    note: itemLabel(MODE, "setting-note"),
    options: ALIGNMENT_SETTINGS.map((value) => ({
      value,
      label: SETTING_LABELS[value],
      help: value,
    })),
    requiredSentence: fieldSentence("setting", "required") ?? "",
  },
];

const MODE_REFUSAL = "Opinions Mode is required.";
const SETTING_REFUSAL = "Alignment Setting is required.";

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  // React 19 warns (and skips flushing) unless the environment says a test is driving it.
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/** The advance the foot draws — a plain submit, enabled, exactly as the page builds it. */
const ADVANCE = (
  <button type="submit" id="advance">
    {itemLabel(MODE, "submit")}
  </button>
);

function render(selected: Record<string, string | undefined> = {}): HTMLFormElement {
  act(() =>
    root.render(
      <StageChoiceForm
        action="/assessment/new/mode"
        heading={MODE.heading ?? ""}
        body={MODE.body ?? ""}
        templateRecordId="template-relationship-basics"
        groups={GROUPS}
        selected={selected}
        foot={ADVANCE}
      />,
    ),
  );
  const form = container.querySelector("form");
  if (form === null) throw new Error("no form rendered");
  return form;
}

function radios(name: string): HTMLInputElement[] {
  return [...container.querySelectorAll<HTMLInputElement>(`input[name="${name}"]`)];
}

function sentences(): string[] {
  return [...container.querySelectorAll<HTMLElement>('[role="alert"]')].map((el) =>
    (el.textContent ?? "").trim(),
  );
}

function choose(name: string, value: string): void {
  const radio = radios(name).find((input) => input.value === value);
  if (radio === undefined) throw new Error(`no radio ${name}=${value}`);
  act(() => {
    radio.click();
  });
}

/**
 * Press the advance. `preventDefault` is the refusal, so the test watches it directly — from a
 * listener on `document`, which runs **after** React's root-container handler has decided, so the
 * value read is the component's decision and not this harness's. (The harness prevents the default
 * afterwards: jsdom has no server to post to, and cancelling keeps the run quiet.)
 */
function press(): { prevented: boolean } {
  let prevented = false;
  const listener = (event: Event) => {
    prevented = event.defaultPrevented;
    event.preventDefault();
  };
  document.addEventListener("submit", listener, { once: true });
  act(() => {
    (document.getElementById("advance") as HTMLButtonElement).click();
  });
  document.removeEventListener("submit", listener);
  return { prevented };
}

describe("stage 2's refusal is legible", () => {
  it("arrives with nothing selected and keeps both groups required", () => {
    const form = render();
    expect(form.checkValidity()).toBe(false);
    expect(radios("mode").filter((input) => input.checked)).toHaveLength(0);
    expect(radios("alignmentSetting").filter((input) => input.checked)).toHaveLength(0);
    // The must-not: the fields are not made optional to make the advance work.
    expect(radios("mode").every((input) => input.required)).toBe(true);
    expect(radios("alignmentSetting").every((input) => input.required)).toBe(true);
    // Nothing has been pressed, so nothing is being refused yet — the stage is quiet on arrival.
    expect(sentences()).toEqual([]);
  });

  it("names the field when the press is refused, and stays on the stage", () => {
    const form = render();
    expect(press().prevented).toBe(true);

    // The acceptance line: a *visible message*, not merely `checkValidity() === false`.
    expect(sentences()).toEqual([MODE_REFUSAL, SETTING_REFUSAL]);
    // It is tied to the control it is about: the group's radios describe themselves with it.
    for (const input of radios("mode")) {
      expect(input.getAttribute("aria-describedby")).toBe("mode-problem");
      expect(input.getAttribute("aria-invalid")).toBe("true");
    }
    // …and the cursor lands on the field that has to be answered.
    expect(document.activeElement).toBe(radios("mode")[0]);
  });

  it("clears each sentence as its group is answered", () => {
    render();
    press();
    expect(sentences()).toEqual([MODE_REFUSAL, SETTING_REFUSAL]);

    choose("mode", "basic");
    // The Mode is answered: its sentence goes, and the Setting's stays standing.
    expect(sentences()).toEqual([SETTING_REFUSAL]);
    expect(radios("mode")[0].getAttribute("aria-describedby")).toBeNull();

    choose("alignmentSetting", "soft");
    expect(sentences()).toEqual([]);
  });

  it("lets the advance through once both are chosen", () => {
    const form = render();
    choose("mode", "advanced");
    choose("alignmentSetting", "full");
    expect(form.checkValidity()).toBe(true);
    expect(press().prevented).toBe(false);
    expect(sentences()).toEqual([]);
  });

  it("draws a return visit's answers, and refuses nothing until it is pressed", () => {
    render({ mode: "advanced", alignmentSetting: "full" });
    expect(radios("mode").find((input) => input.value === "advanced")?.checked).toBe(true);
    expect(radios("alignmentSetting").find((input) => input.value === "full")?.checked).toBe(true);
    expect(sentences()).toEqual([]);
  });
});
