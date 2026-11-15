/** @vitest-environment jsdom */

/**
 * **Stage 1 refuses in words, not in silence (#975 D8).**
 *
 * The inventory measured the defect as two facts that arrive together: the five `required` facts
 * were enforced **by the browser**, so a press with the form empty never fired `submit`, drew no
 * sentence and left no band — `form.checkValidity() === false` was the only evidence anything had
 * happened. To the person, **Continue to Stage 2** simply did not work. Stage 2 shipped the same
 * defect and was fixed the same way (#984, `tests/stage2-refusal.test.tsx`); this is its stage-1
 * twin, mounted for the same reason: a server-rendered string can only ever show the first state.
 *
 * The claims, and the second is the card's acceptance line:
 *
 *   1. the stage arrives quiet, with all five controls still `required` and `checkValidity()` still
 *      `false` — the must-not is making a field optional to make the advance work, and
 *      `form.checkValidity()` staying `false` is the card's own wording;
 *   2. pressing with the form empty leaves the person on stage 1 and prints **the fixture's own
 *      `{field} is required.` sentence at each field**, with `role="alert"`, the control's
 *      `aria-describedby`/`aria-invalid`, and the cursor on the first control that refused;
 *   3. typing into a field clears that field's sentence and leaves the others standing;
 *   4. an address that is present but not an address draws the `email` sentence, not `required`;
 *   5. with every required fact answered the press is no longer refused — no sentence, no
 *      `preventDefault`, the form is valid.
 *
 * Every expected sentence is composed by `lib/flow/create-copy.ts::fieldSentence`, the same
 * function the page hands down and the same one the server's refusal band uses — so a renamed
 * fixture row renames the expectation, and nothing here is retyped copy.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  StageOneForm,
  type StageOneRequirement,
} from "@/components/assessment-flow/stage-one-form";
import type { StageOneCopy } from "@/components/assessment-flow/stage-one-fields";
import { assessmentCreatePageCopy } from "@/data/pages/assessment-create";
import { fieldSentence } from "@/lib/flow/create-copy";
import { itemLabel, sectionOf } from "@/lib/page-copy";

const WHO = sectionOf(assessmentCreatePageCopy, "who");

/** Stage 1's copy exactly as `create-relationship.tsx` builds it: every word from the fixture. */
const COPY: StageOneCopy = {
  titleLabel: itemLabel(WHO, "title-label"),
  titleHelp: itemLabel(WHO, "title-help"),
  initiatorFirstLabel: itemLabel(WHO, "initiator-first-label"),
  initiatorLastLabel: itemLabel(WHO, "initiator-last-label"),
  initiatorLastPlaceholder: itemLabel(WHO, "initiator-last-placeholder"),
  initiatorHelp: itemLabel(WHO, "initiator-help"),
  counterpartyFirstLabel: itemLabel(WHO, "counterparty-first-label"),
  counterpartyFirstPlaceholder: itemLabel(WHO, "counterparty-first-placeholder"),
  counterpartyLastLabel: itemLabel(WHO, "counterparty-last-label"),
  counterpartyLastPlaceholder: itemLabel(WHO, "counterparty-last-placeholder"),
  counterpartyHelp: itemLabel(WHO, "counterparty-help"),
  emailLabel: itemLabel(WHO, "email-label"),
  emailPlaceholder: itemLabel(WHO, "email-placeholder"),
  descriptionLabel: itemLabel(WHO, "description-label"),
  descriptionPlaceholder: itemLabel(WHO, "description-placeholder"),
  descriptionHelp: itemLabel(WHO, "description-help"),
  requiredNote: itemLabel(WHO, "required-note"),
};

/** The five requirements exactly as the page composes them — one source, no retyped sentence. */
const REQUIREMENTS: readonly StageOneRequirement[] = [
  { field: "initiator-first", sentence: fieldSentence("initiator-first", "required") ?? "" },
  { field: "initiator-last", sentence: fieldSentence("initiator-last", "required") ?? "" },
  {
    field: "counterparty-first",
    sentence: fieldSentence("counterparty-first", "required") ?? "",
  },
  {
    field: "email",
    sentence: fieldSentence("email", "required") ?? "",
    invalidSentence: fieldSentence("email", "email") ?? "",
  },
  { field: "title", sentence: fieldSentence("title", "required") ?? "" },
];

/** The five sentences, in the order the stage draws them. */
const SENTENCES = REQUIREMENTS.map((requirement) => requirement.sentence);

/**
 * **The order the sentences appear on screen, which is not the order that refuses.**
 *
 * `requirements` lists the five controls in the order `whoDraft()` reports them, so the cursor
 * lands on a name rather than on the title — the title derives itself from the two name pairs
 * (`derivedTitle()`), and a cursor parked in it would invite a person to overtype the derivation.
 * The title's *control* is drawn first, though (row 1, beside the Initiator pair), so its sentence
 * is the first alert in the document. Both orders are real; this constant states the mapping
 * instead of leaving a reader to work it out from an index.
 */
const DRAWN = [SENTENCES[4], SENTENCES[0], SENTENCES[1], SENTENCES[2], SENTENCES[3]];

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

function render(): HTMLFormElement {
  act(() =>
    root.render(
      <StageOneForm
        action="/assessment/new/who"
        templateRecordId="template-relationship-basics"
        copy={COPY}
        values={{
          initiatorFirst: "",
          initiatorLast: "",
          counterpartyFirst: "",
          counterpartyLast: "",
          title: "",
          email: "",
          description: "",
        }}
        descriptionDefault="A relationship template's summary."
        requirements={REQUIREMENTS}
        foot={
          <button type="submit" id="advance">
            {itemLabel(WHO, "submit")}
          </button>
        }
      />,
    ),
  );
  const form = container.querySelector("form");
  if (form === null) throw new Error("no form rendered");
  return form;
}

/** The control a field id names — the same lookup handle `stage-one-form.tsx` uses. */
function control(field: string): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>(`[data-field="${field}"] input`);
  if (input === null) throw new Error(`no control for ${field}`);
  return input;
}

/** The sentences on screen, in document order. */
function sentences(): string[] {
  return [...container.querySelectorAll<HTMLElement>('[role="alert"]')].map((el) =>
    (el.textContent ?? "").trim(),
  );
}

/** The sentence attached to one field, read through the id the control points at. */
function message(field: string): string | null {
  const node = container.querySelector<HTMLElement>(`#${field}-problem`);
  return node === null ? null : (node.textContent ?? "").trim();
}

/**
 * Type into a controlled input the way a keyboard does: React's own value setter is bypassed, the
 * native one writes the DOM, and the `input` event is what `onChange` listens for. Setting
 * `.value` alone would be overwritten by the next render's `value` prop.
 */
function type(field: string, value: string): void {
  const input = control(field);
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  act(() => {
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
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

/** Answer the four name fields — the title then derives itself, as it does for a real person. */
function answerNames(): void {
  type("initiator-first", "Avery");
  type("initiator-last", "Rowan");
  type("counterparty-first", "Sam");
}

describe("stage 1's refusal is legible", () => {
  it("arrives quiet, and keeps every required mark and the browser contract", () => {
    const form = render();

    // Nothing has been pressed, so nothing is being refused yet.
    expect(sentences()).toEqual([]);
    for (const requirement of REQUIREMENTS) {
      expect(control(requirement.field).required).toBe(true);
      expect(control(requirement.field).getAttribute("aria-invalid")).toBeNull();
    }
    // The must-not: a `noValidate` form still *is* invalid — the marks and the contract stay.
    expect(form.checkValidity()).toBe(false);
  });

  it("names each field when the press is refused, and stays on the stage", () => {
    render();
    expect(press().prevented).toBe(true);

    // The acceptance line: visible, field-attached sentences — not merely checkValidity() === false.
    expect(sentences()).toEqual(DRAWN);
    // …each one is the fixture's own word for its field, and really is the node the field names.
    for (const requirement of REQUIREMENTS) {
      expect(message(requirement.field)).toBe(requirement.sentence);
    }

    for (const requirement of REQUIREMENTS) {
      const input = control(requirement.field);
      expect(input.getAttribute("aria-describedby")).toBe(`${requirement.field}-problem`);
      expect(input.getAttribute("aria-invalid")).toBe("true");
    }

    // …and the cursor lands on the first field that refused — a name, not the derived title.
    expect(document.activeElement).toBe(control("initiator-first"));
  });

  it("clears each sentence as its field is answered, and leaves the rest standing", () => {
    render();
    press();
    expect(sentences()).toEqual(DRAWN);

    type("initiator-first", "Avery");
    expect(message("initiator-first")).toBeNull();
    expect(control("initiator-first").getAttribute("aria-describedby")).toBeNull();
    // The other four still stand.
    expect(sentences()).toEqual([DRAWN[0], DRAWN[2], DRAWN[3], DRAWN[4]]);

    type("initiator-last", "Rowan");
    type("counterparty-first", "Sam");
    // Three answered — and the title, which nobody typed into, has derived itself from those
    // names, so it is no longer refused. Only the address is still missing.
    expect(sentences()).toEqual([DRAWN[4]]);
  });

  it("draws the address's own sentence when the value is not an address", () => {
    render();
    type("initiator-first", "Avery");
    type("initiator-last", "Rowan");
    type("counterparty-first", "Sam");
    type("email", "not-an-address");
    press();

    // Present but refused: the `email` sentence, never `required`. The title has derived itself
    // from the three names typed above, so it is not refused and draws nothing.
    expect(sentences()).toEqual([fieldSentence("email", "email")]);
    expect(message("email")).toBe(fieldSentence("email", "email"));
    expect(control("email").getAttribute("aria-invalid")).toBe("true");
  });

  it("lets the advance through once every required fact is answered", () => {
    const form = render();
    answerNames();
    type("email", "sam@example.com");

    // The title derives itself from the names — nothing was typed into it, and it is not blank.
    expect(control("title").value).not.toBe("");
    expect(form.checkValidity()).toBe(true);
    expect(press().prevented).toBe(false);
    expect(sentences()).toEqual([]);
  });

  it("draws a return visit's answers and refuses nothing until it is pressed", () => {
    act(() =>
      root.render(
        <StageOneForm
          action="/assessment/new/who"
          templateRecordId="template-relationship-basics"
          copy={COPY}
          values={{
            initiatorFirst: "Avery",
            initiatorLast: "Rowan",
            counterpartyFirst: "Sam",
            counterpartyLast: "",
            title: "Avery and Sam",
            email: "sam@example.com",
            description: "",
          }}
          descriptionDefault="A template summary."
          requirements={REQUIREMENTS}
          foot={
            <button type="submit" id="advance">
              {itemLabel(WHO, "submit")}
            </button>
          }
        />,
      ),
    );
    expect(control("title").value).toBe("Avery and Sam");
    expect(control("email").value).toBe("sam@example.com");
    expect(sentences()).toEqual([]);
  });
});
