// @vitest-environment jsdom
/**
 * `/admin/review` writes as the screen draws them (#665 follow-up) — the controls, the payload, the
 * refusals and the highlight.
 *
 * `tests/review-store.test.ts` and `tests/review-store-live.test.ts` prove the *store* (#667): one
 * audited transaction per write, the refusal codes, `done_at` surviving a reload. This file proves
 * the half this card added, and it does it by mounting the components the page renders and clicking
 * them — not by reading the source for a `<Checkbox>`:
 *
 *   1. **Every control posts the store's own shape.** A checkbox hands `toggleReviewTodoAction`
 *      `{artifactId, todoId, body, done}`, the reply composer hands `commentOnReviewIssueAction`
 *      `{issueId, body, reason}`, and close/reopen hands `setReviewIssueStateAction`
 *      `{issueId, state, reason}` — the reason drawn from the screen's copy, never typed.
 *   2. **A refusal is drawn, not swallowed.** A `role-too-low` answer leaves the control where it
 *      was, reverts the optimistic state and prints the fixture's sentence; the same hold applies
 *      to a close.
 *   3. **The row that changed flashes, and the flash is not state.** `border-action bg-action/5`
 *      appears on the row or badge whose write landed and no value on the screen depends on it.
 *   4. **No surface says it cannot write.** The two `read-only` sentences #665 shipped are gone from
 *      the fixture and from the render — a screen that writes must not say it does not.
 *
 * `renderToStaticMarkup` cannot see any of this (every claim here is client state), so the view is
 * mounted in a DOM, as `tests/password-strength.test.tsx` mounts the sign-up form.
 */
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: unknown }) =>
    createElement("a", { href, ...rest }, children as never),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, refresh }),
}));

import { ReviewIssueThread } from "@/components/admin/review-thread";
import { ReviewTodos } from "@/components/admin/review-todos";
import { adminReviewPageCopy } from "@/data/pages/admin-review";
import type {
  ReviewActionOutcome,
  ReviewCommentInput,
  ReviewIssueStateInput,
  ReviewTodoInput,
} from "@/lib/admin/review-inputs";
import type { ReviewIssue, ReviewIssueComment, ReviewTodo } from "@/content/review";

declare global {
  // React reads this to know it is inside `act()`; without it every update is unmocked.
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const ARTIFACT_ID = "review-artifact-relationship-lifecycle";
const TODO_ID = "review-todo-1";
const ISSUE_ID = "review-issue-1";

const todo = (overrides: Partial<ReviewTodo> = {}): ReviewTodo => ({
  id: TODO_ID,
  artifactId: ARTIFACT_ID,
  body: "The invite step names the sender",
  doneAt: null,
  authorUserId: "user-avery",
  createdAt: "2026-11-01T10:00:00.000Z",
  ...overrides,
});

const issue = (overrides: Partial<ReviewIssue> = {}): ReviewIssue => ({
  id: ISSUE_ID,
  artifactId: ARTIFACT_ID,
  number: 3,
  title: "The second aspect has no right-hand label",
  body: "Both sides read the same word.",
  state: "open",
  labels: ["copy"],
  authorUserId: "user-rowan",
  openedAt: "2026-11-02T09:00:00.000Z",
  closedAt: null,
  ...overrides,
});

const comment = (overrides: Partial<ReviewIssueComment> = {}): ReviewIssueComment => ({
  id: "review-comment-1",
  issueId: ISSUE_ID,
  body: "Fixed in v4.",
  authorUserId: "user-jaden",
  createdAt: "2026-11-03T09:00:00.000Z",
  ...overrides,
});

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  refresh.mockClear();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

/** The refusal sentence the fixture holds for a code — the one the screen must print. */
const sentenceFor = (code: string): string =>
  adminReviewPageCopy.sections
    ?.find((section) => section.id === "refusals")
    ?.items?.find((item) => item.id === code)?.label ?? "";

/** A promise whose settlement this test decides, so the in-flight state can be inspected. */
function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

/** Mount the checklist over one item, with the page's own callback replaced by a spy. */
const mountTodos = (onToggle: (input: ReviewTodoInput) => Promise<ReviewActionOutcome>) => {
  act(() => {
    root.render(
      createElement(ReviewTodos, {
        copy: adminReviewPageCopy,
        artifactId: ARTIFACT_ID,
        todos: [todo()],
        progress: { todosDone: 0, todosTotal: 1, issuesOpen: 0, issuesClosed: 0, updatedAt: null },
        onToggle,
      }),
    );
  });
};

/** Mount the thread over one open issue, with both callbacks replaced by spies. */
const mountThread = (options: {
  onComment?: (input: ReviewCommentInput) => Promise<ReviewActionOutcome>;
  onSetState?: (input: ReviewIssueStateInput) => Promise<ReviewActionOutcome>;
  thread?: { issue: ReviewIssue; comments: readonly ReviewIssueComment[] };
}) => {
  const onComment = options.onComment ?? (async () => ({ ok: true }) as ReviewActionOutcome);
  const onSetState = options.onSetState ?? (async () => ({ ok: true }) as ReviewActionOutcome);
  act(() => {
    root.render(
      createElement(ReviewIssueThread, {
        copy: adminReviewPageCopy,
        thread: options.thread ?? { issue: issue(), comments: [comment()] },
        onComment,
        onSetState,
      }),
    );
  });
  return { onComment, onSetState };
};

describe("the review to-do checklist writes", () => {
  it("posts the store's own shape when a box is ticked, and flashes the row", async () => {
    const posted: ReviewTodoInput[] = [];
    const pending = deferred<ReviewActionOutcome>();
    mountTodos((input) => {
      posted.push(input);
      return pending.promise;
    });

    const box = container.querySelector<HTMLElement>('[role="checkbox"]');
    expect(box, "the checklist draws a checkbox per to-do").not.toBeNull();
    expect(box?.getAttribute("aria-checked")).toBe("false");
    expect(box?.getAttribute("aria-label")).toContain("The invite step names the sender");
    expect(box?.hasAttribute("disabled"), "a tick is not disabled into a no-op").toBe(false);

    await act(async () => {
      box?.click();
    });

    expect(posted).toEqual([
      {
        artifactId: ARTIFACT_ID,
        todoId: TODO_ID,
        body: "The invite step names the sender",
        done: true,
      },
    ]);
    // Optimistic: the row flips before the store answers.
    expect(container.querySelector(`[data-todo="${TODO_ID}"]`)?.getAttribute("data-done")).toBe(
      "true",
    );

    await act(async () => {
      pending.resolve({ ok: true });
    });
    // The write landed: the path is re-read and the row carries the highlight.
    expect(refresh).toHaveBeenCalled();
    const row = container.querySelector(`[data-todo="${TODO_ID}"]`);
    expect(row?.className).toContain("border-action");
    expect(row?.className).toContain("bg-action/5");
  });

  it("draws the sentence for a refused tick and puts the box back", async () => {
    mountTodos(async () => ({ ok: false, code: "role-too-low" }));

    const box = container.querySelector<HTMLElement>('[role="checkbox"]');
    await act(async () => {
      box?.click();
    });

    const refusal = container.querySelector(`[data-refusal="role-too-low"]`);
    expect(refusal, "a refused write is a visible sentence, not a silent no-op").not.toBeNull();
    expect(refusal?.textContent).toBe(sentenceFor("role-too-low"));
    expect(container.querySelector(`[data-todo="${TODO_ID}"]`)?.getAttribute("data-done")).toBe(
      "false",
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it("draws a failure the store never answered as a sentence too", async () => {
    mountTodos(async () => {
      throw new Error("connection reset");
    });

    await act(async () => {
      container.querySelector<HTMLElement>('[role="checkbox"]')?.click();
    });

    expect(container.querySelector('[data-refusal="failed"]')?.textContent).toBe(
      sentenceFor("failed"),
    );
  });
});

describe("the review issue thread writes", () => {
  it("comments with the screen's own reason, and holds the reply until the store answers", async () => {
    const posted: ReviewCommentInput[] = [];
    const pending = deferred<ReviewActionOutcome>();
    mountThread({
      onComment: (input) => {
        posted.push(input);
        return pending.promise;
      },
    });

    const textarea = container.querySelector<HTMLTextAreaElement>("#review-issue-reply");
    expect(textarea, "the thread draws a reply box").not.toBeNull();
    const setValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    act(() => {
      setValue?.call(textarea, "Fixed in v4.");
      textarea?.dispatchEvent(new Event("input", { bubbles: true }));
    });

    const form = container.querySelector("form");
    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(posted).toEqual([
      { issueId: ISSUE_ID, body: "Fixed in v4.", reason: "reply to issue #3" },
    ]);
    const optimistic = container.querySelector('[data-comment="pending"]');
    expect(optimistic, "the reply is drawn before it is committed").not.toBeNull();
    expect(optimistic?.className).toContain("border-action");
    expect(optimistic?.className).toContain("bg-action/5");

    await act(async () => {
      pending.resolve({ ok: true });
    });
    expect(refresh).toHaveBeenCalled();
    expect(container.querySelector('[data-comment="pending"]')).toBeNull();
    expect(container.querySelector<HTMLTextAreaElement>("#review-issue-reply")?.value).toBe("");
  });

  it("closes with the reason from the fixture, and does not commit an empty reply", async () => {
    const posted: ReviewCommentInput[] = [];
    const states: ReviewIssueStateInput[] = [];
    mountThread({
      onComment: (input) => {
        posted.push(input);
        return Promise.resolve({ ok: true });
      },
      onSetState: (input) => {
        states.push(input);
        return Promise.resolve({ ok: true });
      },
    });

    const close = container.querySelector<HTMLElement>('[data-issue-action="close"]');
    expect(close, "an open issue offers Close issue").not.toBeNull();
    expect(close?.hasAttribute("disabled"), "the close control is live").toBe(false);

    await act(async () => {
      close?.click();
    });

    expect(states).toEqual([{ issueId: ISSUE_ID, state: "closed", reason: "close issue #3" }]);
    expect(container.querySelector("[data-issue-state]")?.getAttribute("data-issue-state")).toBe(
      "closed",
    );
    // The control is now the other half of the same write.
    expect(container.querySelector('[data-issue-action="reopen"]')?.textContent).toBe(
      "Reopen issue",
    );

    // An empty reply is refused locally, with the same sentence the server would use.
    await act(async () => {
      container
        .querySelector("form")
        ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(posted).toEqual([]);
    expect(container.querySelector('[data-refusal="empty-body"]')?.textContent).toBe(
      sentenceFor("empty-body"),
    );
  });

  it("puts a refused close back on the row's real state", async () => {
    mountThread({ onSetState: async () => ({ ok: false, code: "role-too-low" }) });

    await act(async () => {
      container.querySelector<HTMLElement>('[data-issue-action="close"]')?.click();
    });

    expect(container.querySelector("[data-issue-state]")?.getAttribute("data-issue-state")).toBe(
      "open",
    );
    expect(container.querySelector('[data-refusal="role-too-low"]')?.textContent).toBe(
      sentenceFor("role-too-low"),
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it("closes an issue that is already closed back to open, and offers Reopen first", async () => {
    const states: ReviewIssueStateInput[] = [];
    mountThread({
      thread: {
        issue: issue({ state: "closed", closedAt: "2026-11-04T09:00:00.000Z" }),
        comments: [],
      },
      onSetState: (input) => {
        states.push(input);
        return Promise.resolve({ ok: true });
      },
    });

    await act(async () => {
      container.querySelector<HTMLElement>('[data-issue-action="reopen"]')?.click();
    });

    expect(states).toEqual([{ issueId: ISSUE_ID, state: "open", reason: "reopen issue #3" }]);
  });
});

describe("a screen that writes does not say it does not", () => {
  it("carries no read-only sentence in the fixture", () => {
    const ids = adminReviewPageCopy.sections?.flatMap(
      (section) => section.items?.map((item) => item.id) ?? [],
    );
    expect(ids).not.toContain("read-only");
    const sentences = adminReviewPageCopy.sections?.flatMap(
      (section) => section.items?.map((item) => item.label) ?? [],
    );
    expect(
      sentences?.filter((label) => /read-only/i.test(label)),
      "the copy a screen writes with cannot say it writes nothing",
    ).toEqual([]);
  });

  it("draws no read-only note beside the checklist or the thread", () => {
    mountTodos(async () => ({ ok: true }));
    expect(container.textContent?.toLowerCase()).not.toContain("read-only");
    expect(container.textContent?.toLowerCase()).not.toContain("writes nothing");

    mountThread({});
    expect(container.textContent?.toLowerCase()).not.toContain("read-only");
    expect(container.textContent?.toLowerCase()).not.toContain("writes nothing");
  });
});
