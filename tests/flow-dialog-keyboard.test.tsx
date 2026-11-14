// @vitest-environment jsdom
/**
 * The dialog behaves like a route (#979 B): the keyboard walk, and the history the walk writes.
 *
 * `tests/flow-dialog-escape.test.tsx` proves the frame's wiring — `Esc` reaches the shell's
 * dismissal — and `tests/flow-dialog-shell.test.tsx` proves the two mountings draw one tree. Neither
 * can see what the running panel does to a keyboard, because both stop short of the render where
 * the dialog leaves the document. This file takes that half of the card:
 *
 *   1. focus is inside the panel on mount, and the page underneath is out of the accessibility tree;
 *   2. focus cannot leave the panel — a focus that lands on the page is pulled back in;
 *   3. the page behind the dialog cannot scroll, and the lock is released when the dialog leaves;
 *   4. `Esc` closes it and returns focus to the control that opened it — **after** the panel has
 *      left, which is the only moment the return can survive.
 *
 * Fact 4 is why `lib/flow/dialog-origin.ts` hands the trigger back instead of focusing it: while the
 * panel stands, the trap pulls focus back in, and the following navigation drops it on `<body>`.
 * This file is the measurement that found that — the previous owner of the focus call was a unit
 * test that could not see it, because a stubbed router never unmounts anything.
 *
 * The history fact is checked against the shell's own source, because a soft navigation is a router
 * call and not a DOM event: an advance must be a `push` (a history entry, so Back is the previous
 * stage) and must never be a `replace` (one entry for the whole flow — Back would leave the
 * product, which is the fake the card names).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  FLOW_MOUNT_DIALOG,
  RelationshipFlowShell,
  isFlowStagePath,
} from "@/components/assessment-flow/relationship-flow-shell";
import { assessmentCreatePageCopy } from "@/data/pages/assessment-create";
import { clearFlowOrigin, rememberFlowOrigin } from "@/lib/flow/dialog-origin";
import { RELATIONSHIPS_PATH, TEMPLATE_LIBRARY_PATH } from "@/lib/flow/paths";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const STAGE_PATH = "/templates/relationship/relationship-basics/create/mode";

/** The address the mocked router is "on" — a stage while the dialog stands, the page after it. */
let pathname = STAGE_PATH;
const push = vi.fn();
const back = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push, back, refresh: () => undefined }),
}));

let container: HTMLDivElement;
let page: HTMLDivElement;
let trigger: HTMLButtonElement;
let outside: HTMLAnchorElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  pathname = STAGE_PATH;
  push.mockClear();
  clearFlowOrigin();

  // The page the flow was opened over: the control that opened it, and a link that a stray Tab
  // (or a pointer) can reach while the dialog is up.
  page = document.createElement("div");
  page.id = "the-page-underneath";
  trigger = document.createElement("button");
  trigger.type = "button";
  trigger.textContent = "Create relationship";
  outside = document.createElement("a");
  outside.href = "/somewhere-else";
  outside.textContent = "a link on the page";
  page.append(trigger, outside);
  document.body.append(page);

  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  page.remove();
  clearFlowOrigin();
});

const panel = () => document.querySelector('[data-stage-shell="true"]');

const STAGE_BODY = (
  <form action="/assessment/new/mode" method="post">
    <input name="mode" defaultValue="fixed" />
    <button type="submit">Continue to Aspects</button>
  </form>
);

/**
 * Render the shipped shell in its dialog mounting — the component the dashboard's Create control
 * mounts through the intercepted route, not a stand-in for it.
 */
const mountDialog = () =>
  act(() => {
    root.render(
      <RelationshipFlowShell
        mount={FLOW_MOUNT_DIALOG}
        stage={2}
        copy={assessmentCreatePageCopy}
        title={assessmentCreatePageCopy.heading}
        closeLabel="Close"
        closeHref={TEMPLATE_LIBRARY_PATH}
      >
        {STAGE_BODY}
      </RelationshipFlowShell>,
    );
  });

/**
 * What the router does after a dismissal: the intercepted subpage is discarded — the slot renders
 * its default — so the dialog does not re-render with a new address, it **unmounts**. This is the
 * model of that: the shell leaves the tree and the page underneath stays.
 */
const routerLandsOnOriginPage = () => {
  pathname = RELATIONSHIPS_PATH;
  act(() => root.render(null));
};

describe("the dialog owns the screen while it is open", () => {
  it("puts focus inside the panel and takes the page underneath out of the accessibility tree", () => {
    mountDialog();

    const dialog = panel();
    expect(dialog, "the shell rendered no panel").not.toBeNull();
    // Fact 1: focus is in the dialog, not still on the page behind it.
    expect(dialog?.contains(document.activeElement)).toBe(true);
    // …and the page is not merely covered — it is hidden from assistive technology.
    expect(page.getAttribute("aria-hidden")).toBe("true");
  });

  it("pulls a focus that lands on the page back into the panel", () => {
    mountDialog();

    act(() => outside.focus());

    // Fact 2: the trap is the modal's own, and it answers a focus that leaves by taking it back.
    // If this stops being true the dialog is a card over a live page, not a modal.
    expect(panel()?.contains(document.activeElement)).toBe(true);
  });

  it("locks the page's scroll while it stands, and releases it when it leaves", () => {
    expect(getComputedStyle(document.body).overflow, "the page started locked").not.toBe("hidden");

    mountDialog();
    // Fact 3: the page underneath cannot scroll behind the panel.
    expect(getComputedStyle(document.body).overflow).toBe("hidden");

    act(() => root.unmount());
    // …and a closed flow hands the page back: a lock that outlives the dialog freezes the app.
    expect(getComputedStyle(document.body).overflow).not.toBe("hidden");
  });
});

describe("Escape returns the person to where they were", () => {
  it("closes by going back — not by pushing the page it is already standing over", () => {
    rememberFlowOrigin(RELATIONSHIPS_PATH, trigger);
    mountDialog();

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    /*
     * A `push` back to the page underneath is a no-op while the interception is active (measured in
     * the browser: the address and the panel both stayed). Going back is what ends it, and each
     * stage advance was a history entry, so one pop per entry lands on the origin page. jsdom has
     * no Navigation API, which is the fallback path: a single `router.back()`.
     */
    expect(back).toHaveBeenCalledTimes(1);
    expect(push).not.toHaveBeenCalled();
  });

  it("gives the trigger its focus back once the panel has left", () => {
    rememberFlowOrigin(RELATIONSHIPS_PATH, trigger);
    mountDialog();
    expect(panel()?.contains(document.activeElement)).toBe(true);

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    routerLandsOnOriginPage();

    // Fact 4, and the one the ORDER decides: the panel is gone, the person is on the page they
    // started on, and the keyboard is on the control that opened the flow.
    expect(panel()).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("falls back to the always-mounted control when the trigger was re-rendered away", () => {
    /*
     * The measured case: the intercepted render closes the chooser, so the Create control is not in
     * the document while the dialog stands. The origin carries a fallback selector, and focus goes
     * to the first of the two that is still mounted — never silently to `<body>`.
     */
    const toggle = document.createElement("button");
    toggle.setAttribute("data-relationships-start-toggle", "true");
    page.prepend(toggle);
    rememberFlowOrigin(RELATIONSHIPS_PATH, trigger, "[data-relationships-start-toggle]");
    mountDialog();
    trigger.remove();

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });
    routerLandsOnOriginPage();

    expect(document.activeElement).toBe(toggle);
  });
});

describe("an advance is a history entry, so Back is the previous stage", () => {
  const shell = () =>
    readFileSync(
      join(process.cwd(), "components/assessment-flow/relationship-flow-shell.tsx"),
      "utf8",
    );

  it("pushes every stage the wizard reaches, and never replaces one", () => {
    const source = shell();
    // A stage advance lands as an entry in the history: Back walks the wizard, it does not leave it.
    expect(source).toContain("router.push(`");
    // `replace` would collapse the whole flow into one entry, and Back would exit the product —
    // the exact fake the card names. There is not one in this component.
    expect(source).not.toMatch(/router\.replace/);
  });

  it("keeps the dialog mounted on every stage address a Back can land on", () => {
    // The five addresses the flow advances through, in order. All five are intercepted routes, so
    // a Back to any of them re-renders that stage in the dialog rather than in the page.
    for (const path of [
      "/templates/relationship/brother-sister/create",
      "/templates/relationship/brother-sister/create/mode",
      "/templates/relationship/brother-sister/create/aspects",
      "/templates/relationship/brother-sister/create/commit",
      "/templates/relationship/brother-sister/create/invite",
      "/templates/relationship/brother-sister/create/aspects/",
    ]) {
      expect(isFlowStagePath(path), `${path} would close the dialog`).toBe(true);
    }
    // One entry below stage 1 is the page the flow was opened from — where Back closes it, and the
    // only address in the walk that is not the flow.
    expect(isFlowStagePath(RELATIONSHIPS_PATH)).toBe(false);
  });

  it("draws the stage the address names, rather than stage 1 or nothing", () => {
    // The mounting is keyed by the address, not by a step counter, so a Back (or a reload) into a
    // stage draws that stage; anything else is the page underneath taking over.
    expect(shell()).toContain("if (!isFlowStagePath(pathname)) return null;");
  });
});
