/**
 * A note about a documentation page, from the page (#894).
 *
 * Four claims, and each one is a defect that has shipped somewhere before:
 *
 *   1. **the rules**: what the route may accept, and the one reason it refuses. A path that is not
 *      a manifest row is refused — otherwise an issue could be filed that reads as an address and
 *      names a document the tree does not have.
 *   2. **the record**: the issue's body carries the doc path, the heading the reader had in view
 *      and the build version, because the issue *is* the record (this feature keeps no table).
 *   3. **the answer**: `filed` is the only branch that carries an issue number, it is the only
 *      branch whose notice is a `role="status"`, and every non-2xx is refused rather than filed.
 *      `feedbackPhaseOf()` reads an answer it cannot parse as `failed`, which is what stops a
 *      proxy's HTML error page becoming a thank-you.
 *   4. **the writer**: one `fetch`, no dependency, a missing token is `not-configured`, and no
 *      failure path puts the token or the note in a log.
 *
 * The panel's own rendering is `tests/doc-feedback-panel.test.tsx` (jsdom): it drives the real
 * component, because the claim "a failed submit never shows a thank-you" is about what is on the
 * screen, not about what a pure function returned.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { adminDocPageCopy } from "@/data/pages/admin-docs-document";
import {
  FEEDBACK_KINDS,
  FEEDBACK_LABEL_OF,
  FEEDBACK_MESSAGE_MAX,
  FEEDBACK_MESSAGE_MIN,
  activeHeadingOf,
  composeFeedbackIssue,
  feedbackNoticeOf,
  feedbackPhaseOf,
  readFeedbackDraft,
} from "@/lib/docs/feedback";
import { fileFeedbackIssue } from "@/lib/docs/feedback-github";
import {
  FEEDBACK_RATE_MAX,
  FEEDBACK_RATE_WINDOW_MS,
  decideFeedbackWindow,
  feedbackBucketOf,
  resetFeedbackWindows,
  windowCountOf,
} from "@/lib/docs/feedback-limit";
import { sectionOf } from "@/lib/page-copy";

/** The paths the manifest carries, as the route computes them. */
const PATHS = new Set(["GATE.md", "specs/flow-stages.md", "README.md"]);

const GOOD = {
  kind: "correction" as const,
  path: "GATE.md",
  heading: "The gate",
  message: "The measured window in this section is from v1.16.",
};

describe("readFeedbackDraft", () => {
  it("accepts a note about a manifest row, trimmed", () => {
    const check = readFeedbackDraft({ ...GOOD, message: `  ${GOOD.message}  ` }, PATHS);
    expect(check.ok).toBe(true);
    if (!check.ok) return;
    expect(check.draft).toEqual({ ...GOOD, message: GOOD.message });
  });

  it("refuses a path that is not a manifest row", () => {
    for (const path of ["", "  ", "nope.md", "../etc/passwd", "/GATE.md", 42, undefined]) {
      const check = readFeedbackDraft({ ...GOOD, path }, PATHS);
      expect(check).toEqual({ ok: false, reason: "path" });
    }
  });

  it("refuses a kind outside the two labels that exist", () => {
    for (const kind of ["bug", "", "Correction", null, undefined]) {
      expect(readFeedbackDraft({ ...GOOD, kind }, PATHS)).toEqual({ ok: false, reason: "kind" });
    }
    for (const kind of FEEDBACK_KINDS) {
      expect(readFeedbackDraft({ ...GOOD, kind }, PATHS).ok).toBe(true);
    }
  });

  it("bounds the message at both ends", () => {
    const short = "a".repeat(FEEDBACK_MESSAGE_MIN - 1);
    const long = "a".repeat(FEEDBACK_MESSAGE_MAX + 1);
    expect(readFeedbackDraft({ ...GOOD, message: short }, PATHS)).toEqual({
      ok: false,
      reason: "message",
    });
    expect(readFeedbackDraft({ ...GOOD, message: long }, PATHS)).toEqual({
      ok: false,
      reason: "message",
    });
    expect(
      readFeedbackDraft({ ...GOOD, message: "a".repeat(FEEDBACK_MESSAGE_MIN) }, PATHS).ok,
    ).toBe(true);
    expect(
      readFeedbackDraft({ ...GOOD, message: "a".repeat(FEEDBACK_MESSAGE_MAX) }, PATHS).ok,
    ).toBe(true);
  });

  it("is not fooled by a body that is not an object", () => {
    for (const raw of [null, undefined, "GATE.md", 7, ["GATE.md"]]) {
      expect(readFeedbackDraft(raw, PATHS).ok).toBe(false);
    }
  });

  it("flattens an echoed heading and keeps it out of the refusal path", () => {
    const check = readFeedbackDraft({ ...GOOD, heading: "  The\n\n  gate  " }, PATHS);
    expect(check.ok).toBe(true);
    if (!check.ok) return;
    expect(check.draft.heading).toBe("The gate");
  });
});

describe("composeFeedbackIssue", () => {
  it("carries the path, the heading and the build version", () => {
    const check = readFeedbackDraft(GOOD, PATHS);
    if (!check.ok) throw new Error("the fixture note was refused");
    const issue = composeFeedbackIssue(check.draft, "1.17.1");

    expect(issue.body).toContain("GATE.md");
    expect(issue.body).toContain("The gate");
    expect(issue.body).toContain("1.17.1");
    expect(issue.body).toContain(GOOD.message);
    expect(issue.title).toContain("GATE.md".length > 0 ? "The gate" : "GATE.md");
    expect(issue.title).not.toContain("\n");
    expect(issue.title.length).toBeLessThanOrEqual(120);
  });

  it("files a correction under `documentation` and a missing feature under `enhancement`", () => {
    expect(FEEDBACK_LABEL_OF.correction).toBe("documentation");
    expect(FEEDBACK_LABEL_OF.missing).toBe("enhancement");

    const check = readFeedbackDraft({ ...GOOD, kind: "missing" }, PATHS);
    if (!check.ok) throw new Error("the fixture note was refused");
    expect(composeFeedbackIssue(check.draft, "1.17.1").labels).toEqual(["enhancement"]);
  });

  it("names the page top when no heading was in view, and never invents a version", () => {
    const check = readFeedbackDraft({ ...GOOD, heading: "" }, PATHS);
    if (!check.ok) throw new Error("the fixture note was refused");
    const issue = composeFeedbackIssue(check.draft, "");
    expect(issue.body).toContain("(none — the page top)");
    expect(issue.body).toContain("- **Build:** unknown");
  });
});

describe("activeHeadingOf", () => {
  const headings = [
    { text: "Install", top: -400 },
    { text: "The gate", top: -120 },
    { text: "Numbers", top: 240 },
  ];

  it("answers the last heading above the line", () => {
    expect(activeHeadingOf(headings)).toBe("The gate");
    expect(activeHeadingOf(headings, -200)).toBe("Install");
    expect(activeHeadingOf(headings, 400)).toBe("Numbers");
  });

  it("answers an empty string when nothing is above the line", () => {
    expect(activeHeadingOf([{ text: "Numbers", top: 40 }])).toBe("");
    expect(activeHeadingOf([])).toBe("");
  });
});

describe("feedbackPhaseOf — nothing unreadable is a success", () => {
  it("keeps a filed answer and its number", () => {
    expect(feedbackPhaseOf({ state: "filed", issueNumber: 42 })).toEqual({
      kind: "filed",
      issueNumber: 42,
    });
  });

  it("reads everything else as a failure", () => {
    const unreadable = [
      null,
      undefined,
      "<!doctype html><h1>502 Bad Gateway</h1>",
      {},
      { state: "ok" },
      { state: "filed" },
      { state: "filed", issueNumber: "42" },
      { state: "filed", issueNumber: 0 },
      { state: "filed", issueNumber: 4.5 },
      { state: "success" },
    ];
    for (const answer of unreadable) {
      expect(feedbackPhaseOf(answer)).toEqual({ kind: "failed" });
    }
  });

  it("keeps the three named refusals", () => {
    expect(feedbackPhaseOf({ state: "not-configured" })).toEqual({ kind: "not-configured" });
    expect(feedbackPhaseOf({ state: "limited" })).toEqual({ kind: "limited" });
    expect(feedbackPhaseOf({ state: "invalid", reason: "path" })).toEqual({
      kind: "invalid",
      reason: "path",
    });
  });
});

describe("feedbackNoticeOf — only a filed note is a status", () => {
  it("is a status with the number for a filed note", () => {
    const notice = feedbackNoticeOf({ kind: "filed", issueNumber: 42 });
    expect(notice.tone).toBe("status");
    expect(notice.id).toBe("filed");
    expect(notice.values.number).toBe(42);
  });

  it("is an alert, naming a sentence other than `filed`, for every failure", () => {
    const failures = [
      { kind: "failed" } as const,
      { kind: "not-configured" } as const,
      { kind: "limited" } as const,
      { kind: "invalid", reason: "path" } as const,
      { kind: "invalid", reason: "kind" } as const,
      { kind: "invalid", reason: "message" } as const,
    ];
    for (const phase of failures) {
      const notice = feedbackNoticeOf(phase);
      expect(notice.tone).toBe("alert");
      expect(notice.id).not.toBe("filed");
    }
  });

  it("points at sentences the page fixture actually carries, and states the failure plainly", () => {
    const band = sectionOf(adminDocPageCopy, "feedback");
    const ids = (band.items ?? []).map((item) => item.id);
    const phases = [
      { kind: "filed", issueNumber: 7 } as const,
      { kind: "failed" } as const,
      { kind: "not-configured" } as const,
      { kind: "limited" } as const,
      { kind: "invalid", reason: "message" } as const,
      { kind: "invalid", reason: "path" } as const,
    ];
    for (const phase of phases) {
      expect(ids).toContain(feedbackNoticeOf(phase).id);
    }

    const sentence = (id: string) => band.items?.find((item) => item.id === id)?.label ?? "";
    expect(sentence("failed")).toContain("Nothing was recorded");
    expect(sentence("not-configured")).toContain("Nothing was sent");
    // The env name stays out of reader copy: `git grep GH_FEEDBACK_TOKEN` must name one module.
    for (const id of ids) expect(sentence(id)).not.toContain("GH_FEEDBACK_TOKEN");
  });
});

describe("fileFeedbackIssue — one fetch, four answers", () => {
  /** A `fetch` that answers one status and body, and records what it was asked. */
  const responder = (status: number, body: unknown) => {
    const calls: RequestInit[] = [];
    const impl = (async (_url: string, init: RequestInit) => {
      calls.push(init);
      return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
    }) as unknown as typeof fetch;
    return { impl, calls };
  };

  let logs: string[];
  beforeEach(() => {
    logs = [];
    vi.spyOn(console, "error").mockImplementation((...parts: unknown[]) => {
      logs.push(parts.map(String).join(" "));
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const ISSUE = { title: "docs: Correction — The gate", body: "body", labels: ["documentation"] };

  it("answers not-configured when the deployment carries no token", async () => {
    const previous = process.env.GH_FEEDBACK_TOKEN;
    delete process.env.GH_FEEDBACK_TOKEN;
    try {
      const { impl, calls } = responder(201, { number: 42 });
      expect(await fileFeedbackIssue(ISSUE, { fetchImpl: impl })).toEqual({
        kind: "not-configured",
      });
      expect(calls).toHaveLength(0);
    } finally {
      if (previous !== undefined) process.env.GH_FEEDBACK_TOKEN = previous;
    }
  });

  it("treats a blank token as absent", async () => {
    const { impl } = responder(201, { number: 42 });
    expect(await fileFeedbackIssue(ISSUE, { token: "   ", fetchImpl: impl })).toEqual({
      kind: "not-configured",
    });
  });

  it("answers filed with the number GitHub created, and posts the label", async () => {
    const { impl, calls } = responder(201, { number: 42 });
    expect(await fileFeedbackIssue(ISSUE, { token: "test-token", fetchImpl: impl })).toEqual({
      kind: "filed",
      issueNumber: 42,
    });
    const body = JSON.parse(String(calls[0]?.body));
    expect(body).toEqual({
      title: ISSUE.title,
      body: ISSUE.body,
      labels: ["documentation"],
    });
    const headers = (calls[0]?.headers ?? {}) as Record<string, string>;
    expect(headers.authorization).toBe("Bearer test-token");
  });

  it("never answers filed on a non-2xx", async () => {
    for (const status of [400, 401, 403, 404, 422, 429, 500, 502]) {
      const { impl } = responder(status, { message: "nope" });
      expect(await fileFeedbackIssue(ISSUE, { token: "test-token", fetchImpl: impl })).toEqual({
        kind: "refused",
        status,
      });
    }
  });

  it("answers failed when the call never reached GitHub", async () => {
    const impl = (async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    expect(await fileFeedbackIssue(ISSUE, { token: "test-token", fetchImpl: impl })).toEqual({
      kind: "failed",
      errorName: "TypeError",
    });
  });

  it("answers failed for a 2xx whose body names no issue", async () => {
    for (const body of [{}, { number: null }, "<html>ok</html>", { number: "42" }]) {
      const { impl } = responder(201, body);
      const result = await fileFeedbackIssue(ISSUE, { token: "test-token", fetchImpl: impl });
      expect(result.kind).toBe("failed");
    }
  });

  it("logs neither the token nor the note on a failure", async () => {
    const { impl } = responder(422, { message: "validation failed" });
    await fileFeedbackIssue(ISSUE, { token: "secret-token-value", fetchImpl: impl });
    expect(logs.length).toBeGreaterThan(0);
    for (const line of logs) {
      expect(line).not.toContain("secret-token-value");
      expect(line).not.toContain(ISSUE.body);
      expect(line).not.toContain("validation failed");
    }
  });
});

describe("the per-admin window", () => {
  beforeEach(() => resetFeedbackWindows());

  it("admits the budget and refuses the next note", () => {
    const bucket = feedbackBucketOf("admin-1");
    const now = 1_700_000_000_000;
    for (let attempt = 0; attempt < FEEDBACK_RATE_MAX; attempt += 1) {
      expect(decideFeedbackWindow({ bucket, now }).allowed).toBe(true);
    }
    expect(decideFeedbackWindow({ bucket, now })).toEqual({
      allowed: false,
      recent: FEEDBACK_RATE_MAX,
    });
  });

  it("does not share a window between two admins", () => {
    const now = 1_700_000_000_000;
    for (let attempt = 0; attempt < FEEDBACK_RATE_MAX; attempt += 1) {
      decideFeedbackWindow({ bucket: feedbackBucketOf("admin-1"), now });
    }
    expect(decideFeedbackWindow({ bucket: feedbackBucketOf("admin-2"), now }).allowed).toBe(true);
  });

  it("counts only the window, and the key is a digest rather than an id", () => {
    const now = 1_700_000_000_000;
    const stale = now - FEEDBACK_RATE_WINDOW_MS - 1;
    expect(windowCountOf([stale, now - 10, now], now, FEEDBACK_RATE_WINDOW_MS)).toBe(2);

    const bucket = feedbackBucketOf("admin-1");
    expect(bucket).toHaveLength(32);
    expect(bucket).not.toContain("admin-1");
    expect(bucket).toBe(feedbackBucketOf("admin-1"));
  });
});
