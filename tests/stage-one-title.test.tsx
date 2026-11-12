/** @vitest-environment jsdom */

/**
 * The title **derives, and then it holds** (#825, v9 artifact `s4Who`) — proven by typing into
 * the real component, not by re-deriving the rule in a second place.
 *
 * `docs/specs/flow-stages.md` → *Stage 1, Details* says the title "reads `First L – First L`
 * from fields 2–5, recomputed on every keystroke, and stops the moment someone types in the
 * title itself". That is a keystroke behaviour, and a rendered-string test cannot see it: the
 * server-rendered form only ever shows the *first* state. So this file mounts
 * `StageOneFields` in jsdom and drives it the way a person does.
 *
 * Three claims, and the third is the card's "doomed if":
 *
 *   1. typing the four names derives `Daniel V – Rowan M`;
 *   2. a missing last name drops the initial rather than the person;
 *   3. **typing in the title stops the derivation** — a later name change leaves the title where
 *      the person put it — and the state that makes it stop is component state, not storage. A
 *      stored title still wins after a reload, because the draft the flow already owns carries
 *      it (`values.title`), which is the only persistence this file asserts.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  StageOneFields,
  type StageOneCopy,
  type StageOneValues,
} from "@/components/assessment-flow/stage-one-fields";
import { assessmentCreatePageCopy } from "@/data/pages/assessment-create";
import { itemLabel, sectionOf } from "@/lib/page-copy";

const WHO = sectionOf(assessmentCreatePageCopy, "who");

/** The copy object the page composes — resolved from the fixture, so no word is typed here. */
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

const EMPTY_VALUES: StageOneValues = {
  initiatorFirst: "",
  initiatorLast: "",
  counterpartyFirst: "",
  counterpartyLast: "",
  title: "",
  email: "",
  description: "",
};

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

/** Type into a controlled input the way the browser does: set the value, then fire `input`. */
function type(id: string, value: string): void {
  const element = document.getElementById(id) as HTMLInputElement | null;
  if (element === null) throw new Error(`no input #${id} on the form`);
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  act(() => {
    setter?.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function render(values: StageOneValues = EMPTY_VALUES): void {
  act(() =>
    root.render(
      <StageOneFields
        copy={COPY}
        values={values}
        descriptionDefault="Ten Aspects about how a working relationship feels."
      />,
    ),
  );
}

/** The title input's current value. */
function title(): string {
  return (document.getElementById("create-title") as HTMLInputElement).value;
}

describe("the title derives from the names", () => {
  it("reads `First L – First L` as the four names are typed", () => {
    render();
    expect(title()).toBe("");
    type("create-initiator-first", "Daniel");
    expect(title()).toBe("Daniel");
    type("create-initiator-last", "Vance");
    expect(title()).toBe("Daniel V");
    type("create-counterparty-first", "Rowan");
    expect(title()).toBe("Daniel V \u2013 Rowan");
    type("create-counterparty-last", "Mercer");
    expect(title()).toBe("Daniel V \u2013 Rowan M");
  });

  it("drops the initial when a last name is missing, and never dangles a dash", () => {
    render();
    type("create-initiator-first", "Daniel");
    type("create-counterparty-first", "Rowan");
    // The Counterparty's last name is the optional one; two first names still make a title.
    expect(title()).toBe("Daniel \u2013 Rowan");
    type("create-initiator-last", "Vance");
    expect(title()).toBe("Daniel V \u2013 Rowan");
  });
});

describe("the title holds once somebody types in it", () => {
  it("stops following the names after the first keystroke in the title", () => {
    render();
    type("create-initiator-first", "Daniel");
    type("create-initiator-last", "Vance");
    type("create-counterparty-first", "Rowan");
    type("create-counterparty-last", "Mercer");
    expect(title()).toBe("Daniel V \u2013 Rowan M");

    type("create-title", "Our house, not the dishes");
    expect(title()).toBe("Our house, not the dishes");

    // The names move; the answer does not. This is the whole behaviour in one assertion.
    type("create-counterparty-first", "Robin");
    type("create-initiator-last", "Vaughn");
    expect(title()).toBe("Our house, not the dishes");
  });

  it("holds a stored title after a reload, and derives again when there is none", () => {
    // The draft the flow already owns carries the title: that is the only persistence involved.
    render({ ...EMPTY_VALUES, initiatorFirst: "Daniel", initiatorLast: "Vance", title: "Ours" });
    expect(title()).toBe("Ours");
    type("create-counterparty-first", "Rowan");
    expect(title()).toBe("Ours");
  });
});

describe("the derivation owns no storage", () => {
  it("writes nothing to the browser: no localStorage, no sessionStorage, no document.cookie", async () => {
    const raw = await import("node:fs/promises").then((fs) =>
      fs.readFile("components/assessment-flow/stage-one-fields.tsx", "utf8"),
    );
    // Comments are provenance, not code: the docstring explains *why* there is no storage, and
    // naming the APIs it does not use is the point of it.
    const source = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const forbidden of ["localStorage", "sessionStorage", "document.cookie", "indexedDB"]) {
      expect(source, `the title must not survive by writing ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("leaves storage untouched while it is typed into", () => {
    render();
    type("create-initiator-first", "Daniel");
    type("create-title", "Ours");
    expect(window.localStorage.length).toBe(0);
    expect(document.cookie).toBe("");
  });
});

/* ------------------------------------------------------------------ *\
 * The controls fill their cell (local review of Stage 1, 2026-11-12)
 * ------------------------------------------------------------------ */

/**
 * The two-column name pair overflowed its cell because a bare `<input>` keeps its intrinsic
 * `size="20"` width: fine on a full-width row, wider than half a column. The fix is a class on the
 * shared control shape, so the guard belongs here — rendered, not grepped — and it covers the
 * textarea and every input the stage draws, because they share one constant.
 */
describe("Stage 1 controls fit the cell they are in", () => {
  it("gives every control full width and lets the grid shrink below its intrinsic width", () => {
    render();

    const controls = [
      ...container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea"),
    ];
    expect(controls.length).toBeGreaterThanOrEqual(7);

    for (const control of controls) {
      expect(control.className).toContain("w-full");
      expect(control.className).toContain("min-w-0");
    }
  });

  it("keeps each name half in a grid that may shrink, and the pair at one column when narrow", () => {
    render();

    for (const pair of ["initiator", "counterparty"]) {
      const wrapper = container.querySelector<HTMLElement>(`[data-pair="${pair}"]`);
      expect(wrapper).not.toBeNull();
      expect(wrapper?.className).toContain("min-w-0");

      const halves = wrapper?.querySelector<HTMLElement>("div");
      // `grid-cols-2` only at >=720px; one column below it, and `min-w-0` so neither track can be
      // widened by its child's intrinsic width.
      expect(halves?.className).toContain("min-[720px]:grid-cols-2");
      expect(halves?.className).toContain("min-w-0");
    }
  });
});
