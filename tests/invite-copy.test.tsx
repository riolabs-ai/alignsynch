// @vitest-environment jsdom
/**
 * The invitation link's copy control (#257) — the claims, as DOM.
 *
 * The screen's call to action used to be "select this URL with your mouse", so the control is
 * behaviour, not markup: a handler that writes to the clipboard, a refusal that still gets the
 * reader somewhere, and a live region that says which of the two happened. A test that only
 * read static markup would pass on a button wired to nothing, so this file mounts the component
 * in jsdom, stubs `navigator.clipboard` the way a browser denying the write does, and reads the
 * DOM back — the same shape `tests/media-fallback.test.tsx` uses for the media `onError`.
 *
 * Six claims:
 *
 *   markup        the URL stays a `<code>` of selectable text and the control sits beside it;
 *   exact         the string handed to `writeText` is the screen's own `invite.link`, byte for
 *                 byte — nothing prefixed, truncated, or given a query parameter;
 *   announced     the confirmation is visible text in a `role="status" aria-live="polite"`
 *                 region that exists (empty) before anything is clicked;
 *   denied        a rejecting `writeText` selects the link's text and says so;
 *   no api        `navigator.clipboard` absent takes the same branch;
 *   no selection  when even the selection cannot be made, the sentence does not claim one;
 *   on load       mounting writes nothing — no gesture, no clipboard call.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AssessmentInstanceView } from "@/components/assessment-flow/instance-view";
import { InviteLink } from "@/components/assessment-flow/invite-link";
import type { Assessment } from "@/content/assessment";
import { assessmentInstancePageCopy } from "@/data/pages/assessment-instance";
import { assessments } from "@/data/assessments";
import type { ItemRow, PartyRow } from "@/lib/db/rows";
import { invitationLink } from "@/lib/flow/email";
import { projectScreen, type FlowInstanceRows } from "@/lib/flow/screen";
import { itemLabel, sectionOf } from "@/lib/page-copy";

declare global {
  // React reads this to know it is inside `act()`; without it every update is unmocked.
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

/* ------------------------------------------------------------------ *
 * A real screen to read the link off — the invitation, unclaimed
 * ------------------------------------------------------------------ */

const template: Assessment = (() => {
  const found = assessments.find((entry) => entry.id === "assessment-relationship-basics");
  if (found === undefined) throw new Error("the test's template fixture is missing");
  return found;
})();

const INSTANCE_ID = "instance-invite-copy-test";
/** The token width the store issues (43 characters) — long enough for a truncation to show. */
const TOKEN = "k".repeat(43);
const LINK = invitationLink(TOKEN, "http://localhost:3000");

const items: ItemRow[] = template.items.map((item, position) => ({
  record_id: INSTANCE_ID,
  item_id: item.id,
  position,
  prompt: item.prompt,
  scale_kind: "score",
  left_value: item.leftValue,
  right_value: item.rightValue,
}));

const parties: PartyRow[] = [
  { instance_record_id: INSTANCE_ID, role: "initiator", name: "Avery" },
  { instance_record_id: INSTANCE_ID, role: "counterparty", name: "Rowan" },
];

const rows: FlowInstanceRows = {
  record: {
    id: INSTANCE_ID,
    slug: "invite-copy-test",
    record_type: "assessment",
    status: "draft",
    date: new Date("2026-10-30T12:00:00.000Z"),
    title: template.title,
    summary: "invited by Avery",
  },
  items,
  options: [],
  instance: { record_id: INSTANCE_ID, template_record_id: template.id, mode: "basic" },
  parties,
  opinions: [],
  answerCounts: { initiator: 0, counterparty: 0 },
};

/** The Initiator's screen while the invitation has not been claimed: the one with the link. */
const screen = projectScreen({
  rows,
  template,
  viewerRole: "initiator",
  invite: { email: "rowan@example.com", counterpartyName: "Rowan", claimed: false, link: LINK },
});

const inviteCopy = sectionOf(assessmentInstancePageCopy, "invite");
const COPY_LABEL = itemLabel(inviteCopy, "copy");
const DONE_SENTENCE = "Link copied — paste it into a message to Rowan.";
const MANUAL_SENTENCE =
  "Your browser would not let the page copy the link, so it is selected above — press Ctrl+C or ⌘C to copy it.";
const UNAVAILABLE_SENTENCE =
  "Your browser would not copy the link, and it could not be selected for you — select it above and copy it yourself.";

/* ------------------------------------------------------------------ *
 * A browser, and the three ways its clipboard answers
 * ------------------------------------------------------------------ */

/** Replace `navigator.clipboard` for the length of one test; `undefined` = the API is absent. */
function stubClipboard(clipboard: unknown): void {
  Object.defineProperty(navigator, "clipboard", { value: clipboard, configurable: true });
}

/** jsdom has no clipboard at all, so every test starts from "absent" and opts in. */
afterEach(() => {
  Reflect.deleteProperty(navigator, "clipboard");
  vi.restoreAllMocks();
});

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  window.getSelection()?.removeAllRanges();
});

/** Mount the control alone, and hand back the button the reader would press. */
const mountControl = async (): Promise<HTMLButtonElement> => {
  await act(async () => {
    root.render(
      createElement(InviteLink, { link: LINK, copy: inviteCopy, counterpartyName: "Rowan" }),
    );
  });
  const button = container.querySelector<HTMLButtonElement>("[data-copy-control]");
  expect(button, "the control rendered no button").not.toBeNull();
  return button as HTMLButtonElement;
};

/** Press it, and let the handler's promise settle inside `act`. */
const press = async (button: HTMLButtonElement): Promise<void> => {
  await act(async () => {
    button.click();
    await Promise.resolve();
  });
};

const status = () => container.querySelector<HTMLElement>('[role="status"]');
const code = () => container.querySelector<HTMLElement>("code");

/* ------------------------------------------------------------------ *
 * Markup: the link, and the control beside it
 * ------------------------------------------------------------------ */

describe("the invite link's copy control — what is drawn", () => {
  it("renders the selectable link and the copy control in the instance screen", () => {
    // The screen is a server component: its static markup is what the page ships, and the
    // client control renders inside it.
    const html = renderToStaticMarkup(
      createElement(AssessmentInstanceView, { screen, copy: assessmentInstancePageCopy }),
    );

    // The link, unchanged from #220: the same `<code>` a reader can select with a mouse.
    expect(html).toContain(`<code class="break-all text-xs text-primary">${LINK}</code>`);
    expect(html).toContain('data-invite-link="true"');
    // …and a button beside it, drawn only inside the invite panel that has a link.
    expect(html).toContain('data-copy-control="true"');
    expect(html).toContain(`>${COPY_LABEL}</button>`);
    // The live region exists before anything is clicked, and is empty until then.
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('data-copy-outcome="idle"');
    expect(html).not.toContain(DONE_SENTENCE);
  });

  it("keeps the whole URL as one selectable text node", async () => {
    await mountControl();
    // `textContent` is the link the reader drags across — no clip, no mid-URL element.
    expect(code()?.textContent).toBe(LINK);
    expect(LINK.length).toBe("http://localhost:3000/invite/".length + TOKEN.length);
  });
});

/* ------------------------------------------------------------------ *
 * A successful copy
 * ------------------------------------------------------------------ */

describe("the invite link's copy control — a copy that works", () => {
  it("writes the exact URL, and announces it in the live region", async () => {
    const writeText = vi.fn(async (_text: string) => undefined);
    stubClipboard({ writeText });

    const button = await mountControl();
    await press(button);

    expect(writeText).toHaveBeenCalledTimes(1);
    const [written] = writeText.mock.calls[0] ?? [];

    // Exact, by three independent comparisons rather than one: the string the screen drew,
    // the string the reader can select, and its length (a prefix or a truncation fails here
    // even if a sloppy `toContain` would pass).
    expect(written).toBe(screen.invite?.link);
    expect(written).toBe(code()?.textContent);
    expect(written).toHaveLength(LINK.length);
    // Nothing appended: no tracking parameter, no fragment, and the path is the token itself.
    const url = new URL(written);
    expect(url.search).toBe("");
    expect(url.hash).toBe("");
    expect(url.pathname).toBe(`/invite/${TOKEN}`);

    const region = status();
    expect(region?.getAttribute("aria-live")).toBe("polite");
    expect(region?.getAttribute("data-copy-outcome")).toBe("copied");
    expect(region?.textContent).toBe(DONE_SENTENCE);
  });
});

/* ------------------------------------------------------------------ *
 * A refused copy
 * ------------------------------------------------------------------ */

describe("the invite link's copy control — a copy that is refused", () => {
  it("selects the link's text and says so when the clipboard rejects", async () => {
    // What a browser does when the document is not focused or the permission is denied.
    stubClipboard({ writeText: async () => Promise.reject(new Error("NotAllowedError")) });

    const button = await mountControl();
    await press(button);

    // The fallback is a real selection over the link the screen drew, not a message.
    expect(window.getSelection()?.toString()).toBe(LINK);

    const region = status();
    expect(region?.getAttribute("data-copy-outcome")).toBe("selected");
    expect(region?.textContent).toBe(MANUAL_SENTENCE);
    expect(region?.getAttribute("aria-live")).toBe("polite");
  });

  it("takes the same branch when the clipboard API is missing altogether", async () => {
    // served over plain HTTP, or a browser that predates the API: `navigator.clipboard` is
    // `undefined`, so a handler that only catches a rejected promise would throw here.
    stubClipboard(undefined);

    const button = await mountControl();
    await press(button);

    expect(window.getSelection()?.toString()).toBe(LINK);
    expect(status()?.getAttribute("data-copy-outcome")).toBe("selected");
    expect(status()?.textContent).toBe(MANUAL_SENTENCE);
  });

  it("does not claim a selection it could not make", async () => {
    stubClipboard({ writeText: async () => Promise.reject(new Error("NotAllowedError")) });
    vi.spyOn(window, "getSelection").mockReturnValue(null);

    const button = await mountControl();
    await press(button);

    const region = status();
    expect(region?.getAttribute("data-copy-outcome")).toBe("select-it-yourself");
    expect(region?.textContent).toBe(UNAVAILABLE_SENTENCE);
    // The reader is pointed at the link above, not told the page already selected it.
    expect(region?.textContent).not.toContain("so it is selected above");
  });
});

/* ------------------------------------------------------------------ *
 * No gesture, no write
 * ------------------------------------------------------------------ */

describe("the invite link's copy control — on load", () => {
  it("never touches the clipboard until the button is clicked", async () => {
    const writeText = vi.fn(async () => undefined);
    stubClipboard({ writeText });

    const button = await mountControl();
    // Let effects, timers and microtasks run before asserting: an auto-copy would land here.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 25));
    });

    expect(writeText).not.toHaveBeenCalled();
    expect(status()?.getAttribute("data-copy-outcome")).toBe("idle");
    expect(status()?.textContent).toBe("");

    // …and the same stub does see the click, so this is not a stub that could never fire.
    await press(button);
    expect(writeText).toHaveBeenCalledTimes(1);
  });
});
