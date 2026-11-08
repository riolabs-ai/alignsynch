/**
 * #667 — the review store's model, its mappers, and the rule `V29` states.
 *
 * Every assertion here runs with no database: the row shapes are plain objects, the counts are a
 * pure function, and the V29 rule is exported from `scripts/db-verify.mjs` for exactly this
 * reason. What a real branch adds — that the number is handed out serially under the artifact's
 * lock — is `tests/review-store-live.test.ts`, because a fake `sql` cannot answer it.
 *
 * Three things this file is here to catch, and each one is a way the list could quietly lie:
 *
 *   1. a **fixture** that does not satisfy the model (`data/review-artifacts.ts` and the path
 *      rule are on the same page here, so a typo in the catalogue is a red gate and not a 404);
 *   2. a **row** the mapper would happily render — a `closed` issue with no instant, a fourth
 *      `kind`, a path that climbed out of `docs/review/` — because the mapper is the boundary the
 *      page trusts;
 *   3. a **count** that disagrees with the rows it is drawn from, which is the one thing the list
 *      surface and the viewer could report differently about the same artifact.
 */
import { describe, expect, it } from "vitest";

import {
  REVIEW_ISSUE_BODY_MAX,
  REVIEW_ISSUE_TITLE_MAX,
  REVIEW_LABELS_MAX,
  reviewArtifactProgressOf,
  reviewIssueLabelOf,
  reviewIssueSummaryOf,
  reviewTodoSummaryOf,
  zReviewArtifact,
  zReviewArtifactCatalogue,
  zReviewIssue,
} from "@/content/review";
import {
  isReviewIssueState,
  reviewIssueInputProblems,
  reviewTodoReasonOf,
} from "@/lib/admin/review-ops";
import { reviewArtifacts } from "@/data/review-artifacts";
import {
  reviewArtifactFromRow,
  reviewIssueFromRow,
  reviewTodoFromRow,
} from "@/lib/db/review-artifacts";
import { reviewIssueProblems } from "../scripts/db-verify.mjs";

/* ------------------------------------------------------------------ *
 * The authored catalogue
 * ------------------------------------------------------------------ */

describe("data/review-artifacts.ts", () => {
  it("parses through the catalogue schema", () => {
    const parsed = zReviewArtifactCatalogue.safeParse(reviewArtifacts);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
  });

  it("publishes the prototype the card names, with a docs/review path", () => {
    const prototype = reviewArtifacts.find(
      (artifact) => artifact.slug === "prototype-relationship-lifecycle-v4",
    );
    expect(prototype?.path).toBe("docs/review/artifacts/prototype-relationship-lifecycle-v4.html");
    expect(prototype?.kind).toBe("prototype");
    expect(prototype?.version).toBe("v4");
  });

  it("refuses two artifacts sharing an id or a slug", () => {
    const first = reviewArtifacts[0];
    expect(first).toBeDefined();
    if (first === undefined) return;
    const duplicateId = zReviewArtifactCatalogue.safeParse([first, { ...first, slug: "other" }]);
    const duplicateSlug = zReviewArtifactCatalogue.safeParse([first, { ...first, id: "other-id" }]);
    expect(duplicateId.success).toBe(false);
    expect(duplicateSlug.success).toBe(false);
  });
});

/* ------------------------------------------------------------------ *
 * The paths are relative or they do not exist
 * ------------------------------------------------------------------ */

describe("zReviewArtifact path rule", () => {
  const base = reviewArtifacts[0] as (typeof reviewArtifacts)[number];

  it("accepts a versioned file under docs/review", () => {
    expect(
      zReviewArtifact.safeParse({ ...base, path: "docs/review/artifacts/x-v2.html" }).success,
    ).toBe(true);
  });

  it.each([
    ["/etc/passwd.html", "an absolute path"],
    ["docs/review/../../data/assessments.html", "a traversal"],
    ["https://example.com/x.html", "a scheme"],
    ["docs/review/artifacts/x.png", "not an html page"],
    ["public/review/x.html", "outside docs/review"],
  ])("refuses %s (%s)", (path) => {
    expect(zReviewArtifact.safeParse({ ...base, path }).success).toBe(false);
  });
});

/* ------------------------------------------------------------------ *
 * The issue's impossible state
 * ------------------------------------------------------------------ */

describe("zReviewIssue", () => {
  const base = {
    id: "review-issue-1",
    artifactId: "review-relationship-lifecycle-v4",
    number: 12,
    title: "Invite copy still says 7 days",
    body: "",
    state: "open" as const,
    labels: ["copy"],
    authorUserId: "someone",
    openedAt: "2026-11-07T10:00:00.000Z",
    closedAt: null,
  };

  it("accepts an open issue with no instant and a closed one with one", () => {
    expect(zReviewIssue.safeParse(base).success).toBe(true);
    expect(
      zReviewIssue.safeParse({
        ...base,
        state: "closed",
        closedAt: "2026-11-07T11:00:00.000Z",
      }).success,
    ).toBe(true);
  });

  it("refuses closed without an instant, and open with one", () => {
    expect(zReviewIssue.safeParse({ ...base, state: "closed" }).success).toBe(false);
    expect(zReviewIssue.safeParse({ ...base, closedAt: "2026-11-07T11:00:00.000Z" }).success).toBe(
      false,
    );
  });
});

/* ------------------------------------------------------------------ *
 * The mappers — the boundary the page trusts
 * ------------------------------------------------------------------ */

describe("review row mappers", () => {
  it("map a row the database would answer", () => {
    const artifact = reviewArtifactFromRow({
      id: "review-relationship-lifecycle-v4",
      slug: "prototype-relationship-lifecycle-v4",
      title: "Relationship lifecycle prototype",
      kind: "prototype",
      version: "v4",
      path: "docs/review/artifacts/prototype-relationship-lifecycle-v4.html",
      captured_at: new Date("2026-11-07T00:00:00.000Z"),
      created_at: new Date("2026-11-07T00:00:01.000Z"),
    });
    expect(artifact.capturedAt).toBe("2026-11-07T00:00:00.000Z");

    const todo = reviewTodoFromRow({
      id: "review-todo-1",
      artifact_id: artifact.id,
      body: "Invite copy still says 7 days",
      done_at: null,
      author_user_id: "someone",
      created_at: "2026-11-07T09:00:00.000Z",
    });
    expect(todo.doneAt).toBeNull();

    const issue = reviewIssueFromRow({
      id: "review-issue-1",
      artifact_id: artifact.id,
      number: 1,
      title: "Invite copy still says 7 days",
      body: "",
      state: "closed",
      labels: null,
      author_user_id: "someone",
      opened_at: "2026-11-07T09:00:00.000Z",
      closed_at: "2026-11-07T10:00:00.000Z",
    });
    // A `NULL` `labels` column is "no labels", not a row the model refuses.
    expect(issue.labels).toEqual([]);
    expect(issue.state).toBe("closed");
  });

  it("refuse a drifted row by naming the field", () => {
    expect(() =>
      reviewArtifactFromRow({
        id: "review-x",
        slug: "x",
        title: "X",
        kind: "screenshot",
        version: "v1",
        path: "docs/review/x.html",
        captured_at: "2026-11-07T00:00:00.000Z",
        created_at: "2026-11-07T00:00:00.000Z",
      }),
    ).toThrow(/review_artifact "review-x".*kind/);

    expect(() =>
      reviewIssueFromRow({
        id: "review-issue-1",
        artifact_id: "review-x",
        number: 1,
        title: "X",
        body: "",
        state: "closed",
        labels: [],
        author_user_id: "someone",
        opened_at: "2026-11-07T09:00:00.000Z",
        closed_at: null,
      }),
    ).toThrow(/closed.*closed_at|closed_at.*closed/);
  });
});

/* ------------------------------------------------------------------ *
 * The counts
 * ------------------------------------------------------------------ */

describe("reviewArtifactProgressOf", () => {
  it("counts both lists and takes the newest instant", () => {
    const progress = reviewArtifactProgressOf(
      [
        { doneAt: "2026-11-07T10:00:00.000Z", createdAt: "2026-11-06T10:00:00.000Z" },
        { doneAt: null, createdAt: "2026-11-06T11:00:00.000Z" },
        { doneAt: "2026-11-08T10:00:00.000Z", createdAt: "2026-11-06T12:00:00.000Z" },
      ],
      [
        { state: "open", openedAt: "2026-11-07T10:00:00.000Z", closedAt: null },
        {
          state: "closed",
          openedAt: "2026-11-07T11:00:00.000Z",
          closedAt: "2026-11-07T12:00:00.000Z",
        },
      ],
      "2026-11-07T00:00:00.000Z",
    );
    expect(progress.todosDone).toBe(2);
    expect(progress.todosTotal).toBe(3);
    expect(progress.issuesOpen).toBe(1);
    expect(progress.issuesClosed).toBe(1);
    // The newest fact wins, and it is the tick — not the capture, and not the newest open.
    expect(progress.updatedAt).toBe("2026-11-08T10:00:00.000Z");
  });

  it("falls back to the capture when neither list has moved", () => {
    const progress = reviewArtifactProgressOf([], [], "2026-11-07T00:00:00.000Z");
    expect(progress).toEqual({
      todosDone: 0,
      todosTotal: 0,
      issuesOpen: 0,
      issuesClosed: 0,
      updatedAt: "2026-11-07T00:00:00.000Z",
    });
  });

  it("renders the two summary strings the list draws", () => {
    expect(reviewTodoSummaryOf({ todosDone: 3, todosTotal: 7 })).toBe("3 / 7 done");
    expect(reviewIssueSummaryOf({ issuesOpen: 5, issuesClosed: 2 })).toBe("5 open · 2 closed");
    expect(reviewIssueLabelOf({ number: 12, state: "open" })).toBe("#12 open");
  });
});

/* ------------------------------------------------------------------ *
 * V29 — the rule, over rows
 * ------------------------------------------------------------------ */

describe("reviewIssueProblems (V29)", () => {
  const row = (overrides: Record<string, unknown> = {}) => ({
    id: "review-issue-1",
    artifact_id: "review-a",
    number: 1,
    state: "open",
    closed_at: null,
    ...overrides,
  });

  it("passes a well-formed store", () => {
    expect(reviewIssueProblems([])).toEqual([]);
    expect(reviewIssueProblems([row()])).toEqual([]);
    expect(
      reviewIssueProblems([
        row({ number: 1, state: "closed", closed_at: "2026-11-07T10:00:00.000Z" }),
        row({ id: "review-issue-2", number: 2 }),
      ]),
    ).toEqual([]);
  });

  it("names a closed issue with no instant", () => {
    const problems = reviewIssueProblems([row({ state: "closed" })]);
    expect(problems).toHaveLength(1);
    expect(problems[0].code).toBe("V29");
    expect(problems[0].message).toMatch(/closed with no closed_at/);
  });

  it("names an open issue that kept its instant", () => {
    const problems = reviewIssueProblems([row({ closed_at: "2026-11-07T10:00:00.000Z" })]);
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toMatch(/open and carries closed_at/);
  });

  it("names a state outside the vocabulary", () => {
    const problems = reviewIssueProblems([row({ state: "reopened" })]);
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toMatch(/vocabulary is open\|closed/);
  });

  it("names a duplicated number inside one artifact, and not across two", () => {
    const duplicated = reviewIssueProblems([
      row({ number: 12 }),
      row({ id: "review-issue-2", number: 12 }),
    ]);
    expect(duplicated).toHaveLength(1);
    expect(duplicated[0].message).toMatch(/two rows with the same number/);

    const acrossArtifacts = reviewIssueProblems([
      row({ number: 12 }),
      row({ id: "review-issue-2", artifact_id: "review-b", number: 12 }),
    ]);
    expect(acrossArtifacts).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * The write path's validation, before any statement runs
 * ------------------------------------------------------------------ */

describe("reviewIssueInputProblems", () => {
  it("accepts a title with no body and no labels", () => {
    expect(reviewIssueInputProblems({ title: "Copy", body: "", labels: [] })).toBeNull();
  });

  it("refuses an empty title, an over-long one, and too many labels", () => {
    expect(reviewIssueInputProblems({ title: "   ", body: "", labels: [] })).toBe("empty-title");
    expect(
      reviewIssueInputProblems({
        title: "x".repeat(REVIEW_ISSUE_TITLE_MAX + 1),
        body: "",
        labels: [],
      }),
    ).toBe("title-too-long");
    expect(
      reviewIssueInputProblems({
        title: "Copy",
        body: "",
        labels: Array.from({ length: REVIEW_LABELS_MAX + 1 }, (_, index) => `l${index}`),
      }),
    ).toBe("too-many-labels");
    expect(
      reviewIssueInputProblems({
        title: "Copy",
        body: "x".repeat(REVIEW_ISSUE_BODY_MAX + 1),
        labels: [],
      }),
    ).toBe("body-too-long");
  });
});

describe("the rest of the write path's values", () => {
  it("knows the two states and nothing else", () => {
    expect(isReviewIssueState("open")).toBe(true);
    expect(isReviewIssueState("closed")).toBe(true);
    expect(isReviewIssueState("done")).toBe(false);
  });

  it("derives a checkbox reason that is long enough for act(), and quotes the item", () => {
    const reason = reviewTodoReasonOf("Invite copy still says 7 days", true);
    expect(reason).toBe("mark todo done: Invite copy still says 7 days");
    expect(reason.length).toBeGreaterThanOrEqual(8);
    expect(reviewTodoReasonOf("", false)).toBe("mark todo open");
  });
});
