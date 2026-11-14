// @vitest-environment jsdom
/**
 * #975 D12 — **the Edit dialog names the Aspects and hands back the one editor.**
 *
 * The inventory measured the inverse of the owner's duplicate-aspects complaint: #935 removed the
 * stacked Aspect forms from the edit panel (and every mention of them with it), so the dialog that
 * says "everything here is written to the relationship itself" was silent about the one section the
 * page behind it edits. What is owed is not a second editor — a mounted `AspectList` inside a modal
 * is the drag list drawn over itself, with two saves for one fact — but a statement and one door.
 *
 * This file holds the note's own claims, in a real Radix `Dialog` root because `DialogClose` is what
 * makes the door close the modal:
 *
 *   names it        the heading and the sentence the page's fixture supplies, drawn as text
 *   not an editor   **no field at all, and exactly one control** — the door — so it cannot become
 *                   the stacked form #935 deleted
 *   the door        pressing it closes the dialog (its content leaves the document) and brings the
 *                   page's `[data-relationship-aspects]` section into view: one editor, reached
 *
 * The other half — that the panel draws the caller's note under the title and summary, and draws
 * nothing when a caller passes none — is markup, and lives in `tests/relationship-edit-panel.test.tsx`.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { RelationshipAspectsNote } from "@/components/dashboard/relationship-aspects-note";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { dashboardRelationshipDetailPageCopy } from "@/data/pages/dashboard-relationship-detail";
import { fillLabel, itemLabel, sectionOf } from "@/lib/page-copy";

const EDIT = sectionOf(dashboardRelationshipDetailPageCopy, "edit");
const COUNT = 5;
const NOTE = {
  heading: itemLabel(EDIT, "aspects"),
  note: fillLabel(itemLabel(EDIT, "aspects-note"), { count: COUNT }),
  door: itemLabel(EDIT, "aspects-open"),
};

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

/** The page's single editor, as the modal sees it: a landmark outside the portal. */
function mountPageSection(): { element: HTMLElement; revealed: () => boolean } {
  const element = document.createElement("section");
  element.setAttribute("data-relationship-aspects", "true");
  element.textContent = "the page's Aspects";
  let revealed = false;
  element.scrollIntoView = () => {
    revealed = true;
  };
  // Beside the React root, not inside it: `createRoot` owns its container's children and clears
  // anything already in them, so a page section parked there is unmounted by the first render.
  document.body.append(element);
  return { element, revealed: () => revealed };
}

function mount(note = NOTE): void {
  root = createRoot(container);
  act(() => {
    root?.render(
      createElement(
        Dialog,
        // Uncontrolled, so `DialogClose` can actually change the open state: a controlled root with
        // no `onOpenChange` keeps whatever `open` it was handed and the door proves nothing.
        { defaultOpen: true },
        createElement(
          DialogContent,
          null,
          createElement(DialogTitle, null, "Edit this relationship"),
          createElement(RelationshipAspectsNote, note),
        ),
      ),
    );
  });
}

function block(): Element | null {
  return document.querySelector("[data-relationship-aspects-note]");
}

async function press(element: HTMLButtonElement): Promise<void> {
  await act(async () => {
    element.click();
  });
}

/** One macrotask, so the door's post-close scroll timer gets its turn. */
async function settle(): Promise<void> {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("#975 D12 · the note names the Aspects and opens the door", () => {
  it("draws the page's own words: the heading, the count and the verb", () => {
    mount();
    expect(block()?.textContent).toContain(NOTE.heading);
    expect(block()?.textContent).toContain(NOTE.note);
    expect(block()?.textContent).toContain(NOTE.door);
    // The count is filled from the rows, not typed into the sentence.
    expect(block()?.textContent).toContain(String(COUNT));
  });

  it("is not an editor — no field, one control, and that control is the door", () => {
    mount();
    expect(block()?.querySelectorAll("input, textarea, select, form").length).toBe(0);
    const controls = Array.from(block()?.querySelectorAll("button") ?? []);
    expect(controls.length).toBe(1);
    expect(controls[0]?.hasAttribute("data-relationship-aspects-open")).toBe(true);
    expect(controls[0]?.textContent).toBe(NOTE.door);
  });

  it("the door closes the dialog and reveals the page's editor", async () => {
    const page = mountPageSection();
    mount();
    // The note is inside the modal it will close: its content is in the portal, the section is not.
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();

    const door = block()?.querySelector<HTMLButtonElement>("[data-relationship-aspects-open]");
    if (door === undefined || door === null) throw new Error("the door is not in the note");
    await press(door);
    await settle();

    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(block()).toBeNull();
    expect(page.element.isConnected).toBe(true);
    expect(page.revealed()).toBe(true);
  });

  it("a frozen list says so and offers the view, when the page passes that sentence", () => {
    mount({
      heading: NOTE.heading,
      note: fillLabel(itemLabel(EDIT, "aspects-note-locked"), { count: COUNT }),
      door: itemLabel(EDIT, "aspects-view"),
    });
    expect(block()?.textContent).toContain(itemLabel(EDIT, "aspects-view"));
    expect(block()?.textContent).not.toContain(NOTE.door);
  });
});
