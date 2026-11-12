// @vitest-environment jsdom
/**
 * #923 — the relationship's edit form is a dialog/sheet, never a permanent column.
 *
 * The issue's mechanism, in one sentence: the detail screen handed the whole
 * `RelationshipEditPanel` into its 320 px actions rail, so every fact the record carries was
 * rendered twice at once — read-only in the detail, editable beside it. The proof this file
 * owes is not "the form still works" (`tests/relationship-edit-panel.test.tsx` holds that, and
 * the panel is untouched): it is that **the form is absent until it is asked for, and then it
 * is the same form inside a modal**.
 *
 *   closed            the trigger is the only edit thing in the document; the panel is nowhere
 *   opens             one click, and the panel is inside a `role="dialog"` named by the fixture
 *   closes on Escape   the panel leaves the document and focus returns to the trigger it came from
 *
 * A DOM rather than static markup because all three claims are about what a click does. The
 * server snapshot of the breakpoint hook is deliberately the dialog, so jsdom — which has no
 * `matchMedia` — exercises the ≥1024 presentation. `tests/relationship-detail-funnel.test.tsx`
 * holds the rail order and the "no panel in the markup" half against a static render.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { RelationshipEditDialog } from "@/components/dashboard/relationship-edit-dialog";
import { dashboardRelationshipDetailPageCopy } from "@/data/pages/dashboard-relationship-detail";
import { itemLabel, sectionOf } from "@/lib/page-copy";

const EDIT = sectionOf(dashboardRelationshipDetailPageCopy, "edit");
const TRIGGER_LABEL = itemLabel(EDIT, "open");
const DIALOG_TITLE = EDIT.heading ?? "";

declare global {
  // React reads this to know it is inside `act()`; without it every update is unmocked.
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

let container: HTMLDivElement;
let root: Root | null = null;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
});

afterEach(async () => {
  if (root !== null) {
    const mounted = root;
    await act(async () => mounted.unmount());
    root = null;
  }
  container.remove();
  // Clear any portal Radix left behind; `replaceChildren` rather than innerHTML on purpose.
  document.body.replaceChildren();
});

function mount(): void {
  root = createRoot(container);
  act(() => {
    root?.render(
      createElement(RelationshipEditDialog, {
        label: TRIGGER_LABEL,
        title: DIALOG_TITLE,
        panel: createElement("div", { "data-edit-panel": "stand-in" }, "edit surface"),
      }),
    );
  });
}

function trigger(): HTMLButtonElement {
  const found = container.querySelector<HTMLButtonElement>("[data-relationship-edit-open]");
  if (found === null) throw new Error("the edit trigger is not on the screen");
  return found;
}

function panel(): Element | null {
  return document.querySelector('[data-edit-panel="stand-in"]');
}

async function press(element: HTMLButtonElement): Promise<void> {
  await act(async () => {
    element.click();
  });
}

describe("#923 · the edit form is asked for, not mounted", () => {
  it("closed — the trigger is the only edit affordance, and the panel is not in the document", () => {
    mount();
    expect(trigger().textContent?.trim()).toBe(TRIGGER_LABEL);
    expect(trigger().getAttribute("aria-haspopup")).toBe("dialog");
    expect(trigger().getAttribute("aria-expanded")).toBe("false");
    expect(panel()).toBeNull();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("opens — the same panel, inside a dialog named by the page's own heading", async () => {
    mount();
    await press(trigger());

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog).not.toBeNull();
    expect(dialog?.hasAttribute("data-relationship-edit-dialog")).toBe(true);
    // The form is inside the modal, not beside the page: one panel, one place.
    expect(dialog?.contains(panel())).toBe(true);
    // Radix names the dialog from the title, which is the fixture's heading, not a literal here.
    const labelledBy = dialog?.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy ?? "")?.textContent).toBe(DIALOG_TITLE);
    expect(trigger().getAttribute("aria-expanded")).toBe("true");
  });

  it("closes on Escape — the panel leaves the document and focus returns to the trigger", async () => {
    mount();
    const door = trigger();
    door.focus();
    await press(door);
    expect(panel()).not.toBeNull();

    await act(async () => {
      const target = document.activeElement ?? document.body;
      target.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
      );
    });

    expect(panel()).toBeNull();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(door);
    expect(door.getAttribute("aria-expanded")).toBe("false");
  });
});
