// @vitest-environment jsdom
/**
 * The dialog's live behaviours (#979 B), walked in a DOM rather than asserted in source.
 *
 * Four facts, and all four are facts about the running component rather than about its text:
 *
 *   1. **The mounting is a portalled modal with a name.** `role="dialog"`, `aria-modal`, the stage's
 *      own heading as the accessible name, and the panel in `document.body` — over the page, not
 *      instead of it.
 *   2. **`Esc` is wired to the shell's dismissal.** Radix answers the key with `onOpenChange(false)`;
 *      the frame must route that to `onDismiss` rather than to a `closeHref` navigation, or a
 *      dismissal inside the dialog would leave the origin page.
 *   3. **The dismissal hands the origin back.** `takeFlowOrigin` is the one read of "the page the
 *      trigger was pressed on, and the control that pressed it", and it is the same function `Esc`,
 *      the X and the overlay all reach. It deliberately does **not** focus: while the panel stands,
 *      its focus trap pulls an outside focus back in, so the trigger is focused by the shell in the
 *      render where the panel has left (`tests/flow-dialog-keyboard.test.tsx`, which measures it).
 *   4. **Advancing is a soft navigation.** The stage's form is a native POST; inside the dialog it is
 *      intercepted, sent with `fetch`, and the answer's address is handed to `router.push` — so the
 *      dashboard underneath survives the advance.
 *
 * Fact 3 is tested on the function and not through the mounted dialog on purpose: the push that
 * ends a dismissal is what unmounts the panel, and a test cannot unmount a panel a stubbed router
 * never navigated away from. Testing the unit that owns the order is honest; asserting focus inside
 * a still-mounted modal would be asserting Radix's focus trap instead.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RelationshipFlowShell } from "@/components/assessment-flow/relationship-flow-shell";
import { StageShell } from "@/components/assessment-flow/stage-shell";
import { assessmentCreatePageCopy } from "@/data/pages/assessment-create";
import { clearFlowOrigin, rememberFlowOrigin, takeFlowOrigin } from "@/lib/flow/dialog-origin";
import { RELATIONSHIPS_PATH, TEMPLATE_LIBRARY_PATH } from "@/lib/flow/paths";

declare global {
  // React reads this to know it is inside `act()`; without it every update is unmocked.
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const STAGE_PATH = "/templates/relationship/relationship-basics/create/mode";
const NEXT_STAGE =
  "http://localhost:3000/templates/relationship/relationship-basics/create/aspects";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => STAGE_PATH,
  useRouter: () => ({ push, refresh: () => undefined }),
}));

let container: HTMLDivElement;
let root: Root;
let trigger: HTMLButtonElement;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  push.mockClear();
  clearFlowOrigin();

  // The control on `/dashboard/relationships` that a person actually pressed.
  trigger = document.createElement("button");
  trigger.type = "button";
  trigger.textContent = "Create relationship";
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
  vi.unstubAllGlobals();
});

const dialog = () => document.querySelector('[data-stage-shell="true"]');

/** One stage's own form, the way `CreateRelationship` draws it: a native POST to a route handler. */
const STAGE_FORM = (
  <form action="/assessment/new/mode" method="post">
    <input name="mode" defaultValue="fixed" />
    <button type="submit">Continue to Stage 3</button>
  </form>
);

const mountDialog = (children: React.ReactNode = STAGE_FORM) =>
  act(() => {
    root.render(
      <RelationshipFlowShell
        mount="dialog"
        stage={2}
        copy={assessmentCreatePageCopy}
        title={assessmentCreatePageCopy.heading}
        closeLabel="Close"
        closeHref={TEMPLATE_LIBRARY_PATH}
      >
        {children}
      </RelationshipFlowShell>,
    );
  });

const mountStageShell = (onDismiss: () => void) =>
  act(() => {
    root.render(
      <StageShell
        title={assessmentCreatePageCopy.heading}
        closeLabel="Close"
        closeHref={TEMPLATE_LIBRARY_PATH}
        presentation="dialog"
        onDismiss={onDismiss}
      >
        {STAGE_FORM}
      </StageShell>,
    );
  });

describe("the dialog over the page it was opened from", () => {
  it("is a portalled modal named after the stage, drawn over the page rather than instead of it", () => {
    mountDialog();

    const panel = dialog();
    expect(panel, "the shell rendered no dialog").not.toBeNull();
    expect(panel?.getAttribute("role")).toBe("dialog");
    expect(panel?.getAttribute("aria-modal")).toBe("true");
    // The accessible name is the stage's own heading, from the caller's fixture.
    expect(panel?.textContent).toContain(assessmentCreatePageCopy.heading ?? "");
    // The rail and the stage body came with it — the dialog is the flow, not a second rendering.
    expect(panel?.textContent).toContain("Stage 2 of 5");
    // Portalled: the panel is in `document.body`, outside the page's own subtree, so the dashboard
    // page underneath keeps its markup and its scroll position.
    expect(document.body.contains(panel)).toBe(true);
    expect(container.contains(panel)).toBe(false);
  });

  it("routes Escape to the shell's dismissal, not to a closeHref navigation", () => {
    const onDismiss = vi.fn();
    mountStageShell(onDismiss);

    expect(dialog(), "the frame rendered no panel").not.toBeNull();
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
    // The frame never navigates on its own when it has a dismissal to call: that is the difference
    // between closing onto the origin page and closing onto the template library.
    expect(push).not.toHaveBeenCalled();
  });
});

describe("closing the flow", () => {
  it("hands back the page it was opened from and how to focus the control that opened it", () => {
    rememberFlowOrigin(RELATIONSHIPS_PATH, trigger);

    const origin = takeFlowOrigin();

    // The two facts the shell needs to close and to give focus back, and nothing else: this module
    // does not navigate and does not focus (see the docstring — the trap would undo the focus).
    expect(origin.path).toBe(RELATIONSHIPS_PATH);
    expect(origin.focus()).toBe(trigger);
    // And the origin is spent — the next entry states its own page.
    expect(takeFlowOrigin().path).toBe(RELATIONSHIPS_PATH);
    expect(takeFlowOrigin().focus()).toBeNull();
  });

  it("falls back to the relationship list when the flow was reached without a trigger", () => {
    clearFlowOrigin();
    const origin = takeFlowOrigin();
    expect(origin.path).toBe(RELATIONSHIPS_PATH);
    expect(origin.focus()).toBeNull();
  });

  it("falls back to the nominated control once the trigger has left the document", () => {
    const toggle = document.createElement("button");
    toggle.setAttribute("data-relationships-start-toggle", "true");
    document.body.append(toggle);
    rememberFlowOrigin("/dashboard/relationships", trigger, "[data-relationships-start-toggle]");

    // The trigger re-rendered away — the measured case — so the resolution moves to the fallback,
    // and it re-resolves on each call rather than hoarding the element.
    trigger.remove();
    const origin = takeFlowOrigin();
    expect(origin.focus()).toBe(toggle);
    toggle.remove();
    expect(takeFlowOrigin().focus()).toBeNull();
  });
});

describe("advancing inside the dialog", () => {
  it("posts the stage's own form and follows the answer with the router, never the document", async () => {
    // `response.url` is what the shell reads, so the stub answers with the address a 303 lands on.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ url: NEXT_STAGE, ok: true })) as unknown as typeof fetch,
    );
    mountDialog();

    const form = dialog()?.querySelector("form");
    expect(form, "the stage's form did not render inside the dialog").not.toBeNull();
    if (!form) return;

    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    const calls = (globalThis.fetch as unknown as { mock: { calls: [string, RequestInit][] } }).mock
      .calls;
    expect(calls).toHaveLength(1);
    const [target, init] = calls[0] as [string, RequestInit];
    // The same body the browser would have posted — the endpoint learns no second input shape.
    // (`form.action` is a resolved URL in a DOM, so the path is what is compared.)
    expect(new URL(target, "http://localhost").pathname).toBe("/assessment/new/mode");
    expect(init.method).toBe("POST");
    expect(String(init.body)).toContain("mode=fixed");
    // The answer's address is pushed: a soft navigation keeps the page underneath the dialog.
    expect(push).toHaveBeenCalledWith("/templates/relationship/relationship-basics/create/aspects");
  });
});
