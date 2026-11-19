// @vitest-environment jsdom
/**
 * **#975 D10 (`t_90026133`) — `Cancel` inside the dialog leaves the flow, and it leaves it to the
 * page the flow was opened from, not to the template library.**
 *
 * The second half of the row. Stage 5 arrived as a dialog over
 * `/dashboard/relationships/<own draft>` — a dashboard surface, which is the shape the row asks for
 * — and then the foot's `Cancel`, one row under the shell's own close, navigated the reader out to
 * the template library. One modal, two exits, two different pages: `Esc`, the X and the overlay call
 * `onDismiss` and land on `takeFlowOrigin()`, while `Cancel` pushed `closeHref`.
 *
 * So this file presses the real control, in the real shell, in a DOM:
 *
 *   1. **In the dialog** the click is caught before the link acts, the default is prevented, and the
 *      dismissal runs — the router goes *back*, the library is never pushed, and the remembered
 *      origin is spent by the dismissal rather than left behind.
 *   2. **On the stage's own page** the same control is untouched: the link keeps its own address.
 *      A reader who followed a stage address (a refresh, a shared link) is on a page, and `Cancel`
 *      on that page is supposed to leave to the library.
 *   3. **A modified click is not a dismissal.** `⌘`/`Ctrl`-click opens a new tab on the stage's own
 *      address, which is a document, and a document is what `closeHref` is right for.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RelationshipFlowShell } from "@/components/assessment-flow/relationship-flow-shell";
import { StageFoot } from "@/components/assessment-flow/stage-foot";
import { assessmentCreatePageCopy } from "@/data/pages/assessment-create";
import { clearFlowOrigin, rememberFlowOrigin, takeFlowOrigin } from "@/lib/flow/dialog-origin";
import { RELATIONSHIPS_PATH, TEMPLATE_LIBRARY_PATH } from "@/lib/flow/paths";

declare global {
  // React reads this to know it is inside `act()`; without it every update is unmocked.
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

/** Stage 5's own address — a stage path, so the dialog has something to describe. */
const STAGE_PATH = "/dashboard/templates/relationship-basics/create/invite";
/** The relationship the payment was opened from: the relationship's own screen. */
const ORIGIN_PATH = "/dashboard/relationships/relationship-pay-door";

const push = vi.fn();
const back = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => STAGE_PATH,
  useRouter: () => ({ push, back, refresh: () => undefined }),
}));

let container: HTMLDivElement;
let root: Root;
let trigger: HTMLButtonElement;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  push.mockClear();
  back.mockClear();
  clearFlowOrigin();

  // The control on the relationship's screen that was pressed — it receives the focus back.
  trigger = document.createElement("button");
  trigger.type = "button";
  trigger.textContent = "Invite Members";
  document.body.append(trigger);

  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  trigger.remove();
  clearFlowOrigin();
});

/** The stage's own foot, exactly as `CreateRelationship` draws it on every stage. */
const STAGE_FOOT = (
  <StageFoot
    backHref="/dashboard/templates/relationship-basics/create/commit"
    backLabel="Back"
    cancelHref={TEMPLATE_LIBRARY_PATH}
    cancelLabel="Cancel"
  />
);

function mount(mount: "page" | "dialog"): void {
  act(() => {
    root.render(
      <RelationshipFlowShell
        mount={mount}
        stage={5}
        title={assessmentCreatePageCopy.heading}
        closeLabel="Close"
        closeHref={TEMPLATE_LIBRARY_PATH}
      >
        {STAGE_FOOT}
      </RelationshipFlowShell>,
    );
  });
}

/** The foot's `Cancel`, read out of the document it actually landed in. */
function cancelControl(): HTMLAnchorElement {
  const control = document.querySelector<HTMLAnchorElement>("[data-create-cancel]");
  if (control === null) throw new Error("the render drew no Cancel control");
  return control;
}

/** A plain left click, delivered the way a browser delivers one. */
function press(init: MouseEventInit = {}): MouseEvent {
  const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ...init });
  act(() => {
    cancelControl().dispatchEvent(event);
  });
  return event;
}

describe("Cancel, inside the dialog the payment opened", () => {
  it("closes onto the relationship the payment came from instead of the template library", () => {
    rememberFlowOrigin(ORIGIN_PATH, trigger);
    mount("dialog");

    // The control's own address is still the library — it is the same foot every stage draws, and
    // the page mounting depends on that href.
    expect(cancelControl().getAttribute("href")).toBe(TEMPLATE_LIBRARY_PATH);

    const event = press();

    // The link did not act…
    expect(event.defaultPrevented).toBe(true);
    // …the flow was left, and it was left backwards, onto the page underneath…
    expect(back).toHaveBeenCalledTimes(1);
    // …and the library was never pushed. That is the defect, asserted by absence.
    expect(push).not.toHaveBeenCalled();
    // The dismissal spent the remembered origin rather than leaving it for the next entry.
    expect(takeFlowOrigin().path).toBe(RELATIONSHIPS_PATH);
  });

  it("does not swallow a modified click, which opens the stage's own page in a new tab", () => {
    rememberFlowOrigin(ORIGIN_PATH, trigger);
    mount("dialog");

    const event = press({ metaKey: true });

    expect(event.defaultPrevented).toBe(false);
    expect(back).not.toHaveBeenCalled();
    // Untouched: the origin is still there for the close this reader may come back and use.
    expect(takeFlowOrigin().path).toBe(ORIGIN_PATH);
  });
});

describe("Cancel, on the stage's own page", () => {
  it("keeps its link, because a page's Cancel really does leave to the library", () => {
    rememberFlowOrigin(ORIGIN_PATH, trigger);
    mount("page");

    const event = press();

    expect(event.defaultPrevented).toBe(false);
    expect(back).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
});
