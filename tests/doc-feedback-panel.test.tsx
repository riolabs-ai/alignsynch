// @vitest-environment jsdom
/**
 * The panel, driven (#894) — the claim this feature is accepted on, in a browser-shaped DOM.
 *
 * `tests/docs-feedback.test.ts` proves the pure rules and the writer; this file proves the screen.
 * The distinction matters here more than usual: "a failed submit still shows a thank-you" is not
 * visible to a unit test of `feedbackNoticeOf()`, because the defect would be in the component
 * choosing which sentence to draw. So the component is mounted, the button is clicked, the textarea
 * is typed into, the form is submitted, and the **rendered** notice is read back with its role.
 *
 * Four cases, all against a stubbed `fetch` — no network, no token, no server:
 *
 *   1. a `failed` answer draws an `alert` saying nothing was recorded, keeps the form open and
 *      keeps the note in the box;
 *   2. a `filed` answer draws a `status` naming the issue number, and closes the form;
 *   3. a `filed` answer **without** a number is an `alert` — the shape a broken deployment would
 *      send, and the exact defect the acceptance clause names;
 *   4. an HTML error page (a proxy's 502) is an `alert`, because the body cannot be parsed;
 *   5. nothing is drawn before an attempt at all.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DocFeedback } from "@/components/admin/docs/doc-feedback";
import { adminDocPageCopy } from "@/data/pages/admin-docs-document";
import { sectionOf } from "@/lib/page-copy";

declare global {
  // React reads this to know it is inside `act()`.
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const copy = sectionOf(adminDocPageCopy, "feedback");

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  // Radix's radio group measures itself with a ResizeObserver, which jsdom does not implement.
  // The measurement is layout the test does not assert; the stub keeps the group renderable.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Stub the route's answer: a status and whatever body the real route could send. */
function answerWith(status: number, body: unknown) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** Type into the controlled textarea the way a browser does — through the native value setter. */
function type(text: string) {
  const box = container.querySelector("textarea");
  expect(box, "the panel drew no message box").not.toBeNull();
  if (box === null) return;
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    "value",
  )?.set;
  setter?.call(box, text);
  box.dispatchEvent(new Event("input", { bubbles: true }));
}

/** Open the panel, type a note and submit it — everything a reader does with a mouse and a keyboard. */
async function fileNote(text = "The measured window here is from the last release.") {
  const open = container.querySelector("button");
  expect(open, "the panel drew no way to open it").not.toBeNull();
  act(() => {
    open?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });

  const form = container.querySelector("form");
  expect(form, "the panel drew no form").not.toBeNull();
  if (form === null) return;

  act(() => type(text));
  await act(async () => {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

const notice = () => container.querySelector("[data-doc-feedback-notice]");

describe("DocFeedback", () => {
  it("draws no notice before an attempt", () => {
    act(() => root.render(<DocFeedback copy={copy} path="GATE.md" title="The gate" />));
    expect(notice()).toBeNull();
    expect(container.textContent).toContain("Report a problem");
  });

  it("says nothing was recorded when the note failed, and keeps the note on screen", async () => {
    const fetchMock = answerWith(502, { state: "failed" });
    act(() => root.render(<DocFeedback copy={copy} path="GATE.md" title="The gate" />));
    await fileNote();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = (fetchMock.mock.calls[0] as unknown[])[1] as RequestInit;
    const sent = JSON.parse(String(init.body));
    expect(sent).toEqual({
      kind: "correction",
      path: "GATE.md",
      heading: "The gate",
      message: "The measured window here is from the last release.",
    });

    const shown = notice();
    expect(shown, "a failed submit drew no notice at all").not.toBeNull();
    expect(shown?.getAttribute("role")).toBe("alert");
    expect(shown?.textContent).toContain("Nothing was recorded");
    expect(container.textContent).not.toContain("Filed as issue");

    // The form stays open with the words still in it, so "try again" is a press.
    expect(container.querySelector("form")).not.toBeNull();
    expect(container.querySelector("textarea")?.value).toBe(sent.message);
  });

  it("names the issue number when the note was filed, and closes the form", async () => {
    answerWith(200, { state: "filed", issueNumber: 42 });
    act(() => root.render(<DocFeedback copy={copy} path="GATE.md" title="The gate" />));
    await fileNote();

    const shown = notice();
    expect(shown?.getAttribute("role")).toBe("status");
    expect(shown?.textContent).toContain("#42");
    expect(container.querySelector("form")).toBeNull();
  });

  it("reads a filed answer with no number as a failure", async () => {
    answerWith(200, { state: "filed" });
    act(() => root.render(<DocFeedback copy={copy} path="GATE.md" title="The gate" />));
    await fileNote();

    const shown = notice();
    expect(shown?.getAttribute("role")).toBe("alert");
    expect(shown?.textContent).toContain("Nothing was recorded");
    expect(shown?.textContent).not.toContain("Filed as issue");
  });

  it("reads a proxy's HTML error page as a failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html><body>502 Bad Gateway</body></html>", { status: 502 })),
    );
    act(() => root.render(<DocFeedback copy={copy} path="GATE.md" title="The gate" />));
    await fileNote();

    expect(notice()?.getAttribute("role")).toBe("alert");
    expect(collectionText()).toContain("Nothing was recorded");
  });

  it("says plainly that nothing was sent when the deployment has no token", async () => {
    answerWith(503, { state: "not-configured" });
    act(() => root.render(<DocFeedback copy={copy} path="GATE.md" title="The gate" />));
    await fileNote();

    expect(notice()?.getAttribute("role")).toBe("alert");
    expect(collectionText()).toContain("Nothing was sent");
    expect(collectionText()).not.toContain("Filed as issue");
  });

  it("sends the heading the reader was looking at, not the page top", async () => {
    const fetchMock = answerWith(200, { state: "filed", issueNumber: 7 });
    act(() => root.render(<DocFeedback copy={copy} path="GATE.md" title="The gate" />));

    // The article the panel sits under: a heading scrolled above the fold, then the panel.
    const article = document.createElement("article");
    const above = document.createElement("h2");
    above.textContent = "Install";
    const below = document.createElement("h2");
    below.textContent = "Numbers";
    article.append(above, below);
    document.body.prepend(article);
    vi.spyOn(above, "getBoundingClientRect").mockReturnValue({ top: -400 } as DOMRect);
    vi.spyOn(below, "getBoundingClientRect").mockReturnValue({ top: 120 } as DOMRect);

    await fileNote();
    article.remove();

    const init = (fetchMock.mock.calls[0] as unknown[])[1] as RequestInit;
    expect(JSON.parse(String(init.body)).heading).toBe("Install");
  });
});

/** Every notice's text, whether or not it is the first one in the tree. */
function collectionText(): string {
  return Array.from(container.querySelectorAll("[data-doc-feedback-notice]"))
    .map((node) => node.textContent ?? "")
    .join(" ");
}
