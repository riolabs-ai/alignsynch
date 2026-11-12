/**
 * `/admin/review` (#665) — the shelf that groups artifacts by release, and the route that serves one.
 *
 * Three things are pinned here, and each is a claim the screen makes:
 *
 * 1. **The manifest and the catalogue agree.** Every published artifact carries a release and a
 *    `lookFor` line, every manifest row names an artifact that exists, and every catalogue path is
 *    a file in this tree. A missing release is not "a row without a heading" — it is a shelf that
 *    cannot be built, and `.ts` refusing the manifest is the assertion.
 * 2. **A group is archived or active as one.** Membership comes from the release, the state from
 *    the changelog's newest version; one group cannot hold an active and an archived row.
 * 3. **A path outside the catalogue cannot be rendered.** `/review-artifacts/<id>` answers 404 for
 *    an unknown id, for a traversal attempt, and for a URL-shaped id — the id is resolved against
 *    the authored catalogue and never joined into a path.
 *
 * The store's own behaviour (ticking a to-do, closing an issue, the SQL) is #667's suite. The gate
 * and `pnpm data:check` own the rest: the artifact pages appear in `content/pages.ts`, the row copy
 * in `data/pages/admin-review.ts`.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// The screen is a client component under `renderToStaticMarkup`, so the two Next hooks it reaches
// are stubbed — this is a render of the layout, not a test of the framework.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: unknown }) =>
    createElement("a", { href, ...rest }, children as never),
}));

import { ReviewArtifacts } from "../components/admin/review-artifacts";
import { adminReviewPageCopy } from "../data/pages/admin-review";
import { reviewArtifacts } from "../data/review-artifacts";
import type { ReviewArtifactSummary } from "../lib/db/review-artifacts";
import {
  compareVersions,
  readReleaseVersions,
  readReviewManifest,
  ReviewManifestUnreadable,
  reviewFilePath,
  shelfOf,
} from "../lib/review/artifacts";

vi.mock("@/lib/auth/session", () => ({
  currentUser: async () => ({ id: "u1", role: "admin" }),
}));
vi.mock("@/lib/db/user-profiles", () => ({
  readProfileByUserId: async () => ({ handle: "jaden", displayName: "Jaden" }),
}));
vi.mock("@/lib/auth/require-role", () => ({
  requireAdmin: async () => ({ id: "u1", role: "admin" }),
}));

const root = join(__dirname, "..");

/** A summary with no to-dos and no issues — the shape, not the store. */
function summaryOf(id: string, version: string): ReviewArtifactSummary {
  const artifact = reviewArtifacts.find((row) => row.id === id);
  if (artifact === undefined) throw new Error(`no catalogue row ${id}`);
  return {
    artifact: { ...artifact, version, id },
    progress: { todosDone: 0, todosTotal: 0, issuesOpen: 0, issuesClosed: 0 },
  } as ReviewArtifactSummary;
}

describe("the review manifest", () => {
  it("describes every published artifact, and only those", () => {
    const manifest = readReviewManifest(join(root, "docs/review/artifacts.json"), reviewArtifacts);
    expect([...manifest.keys()].sort()).toEqual(reviewArtifacts.map((row) => row.id).sort());
  });

  it("carries a release that the changelog records", () => {
    const versions = readReleaseVersions(join(root, "docs/changelog/releases.json"));
    const manifest = readReviewManifest(join(root, "docs/review/artifacts.json"), reviewArtifacts);
    for (const entry of manifest.values()) {
      expect(versions).toContain(entry.release);
    }
  });

  it("refuses a catalogue row with no release, rather than dropping it silently", () => {
    const catalogue = [
      ...reviewArtifacts,
      {
        ...reviewArtifacts[0],
        id: "review-unlisted",
        slug: "prototype-unlisted",
      },
    ];
    expect(() => readReviewManifest(join(root, "docs/review/artifacts.json"), catalogue)).toThrow(
      ReviewManifestUnreadable,
    );
  });

  it("refuses a manifest row that names no published artifact", () => {
    const catalogue = reviewArtifacts.filter((row) => row.id !== reviewArtifacts[0].id);
    expect(() => readReviewManifest(join(root, "docs/review/artifacts.json"), catalogue)).toThrow(
      ReviewManifestUnreadable,
    );
  });

  it("refuses a manifest that is not the shape it claims", () => {
    const text = readFileSync(join(root, "docs/review/artifacts.json"), "utf8");
    const broken = join(tmpdir(), `review-manifest-${process.pid}.json`);
    mkdirSync(tmpdir(), { recursive: true });
    const shapes = [
      JSON.stringify({ schemaVersion: 2, artifacts: JSON.parse(text).artifacts }),
      JSON.stringify({ schemaVersion: 1, artifacts: [] }),
      JSON.stringify({ schemaVersion: 1, artifacts: [{ id: "x", release: "1.6.0" }] }),
      "{ not json",
    ];
    for (const shape of shapes) {
      writeFileSync(broken, shape);
      expect(() => readReviewManifest(broken, reviewArtifacts), shape.slice(0, 40)).toThrow(
        ReviewManifestUnreadable,
      );
    }
  });

  it("refuses a manifest that lists one artifact twice", () => {
    const text = readFileSync(join(root, "docs/review/artifacts.json"), "utf8");
    const parsed = JSON.parse(text) as { artifacts: { id: string }[] };
    const broken = join(tmpdir(), `review-manifest-dup-${process.pid}.json`);
    mkdirSync(tmpdir(), { recursive: true });
    writeFileSync(
      broken,
      JSON.stringify({ schemaVersion: 1, artifacts: [parsed.artifacts[0], parsed.artifacts[0]] }),
    );
    expect(() => readReviewManifest(broken, [reviewArtifacts[0]])).toThrow(
      ReviewManifestUnreadable,
    );
  });
});

describe("every artifact renders a real file", () => {
  it("resolves a committed document for each catalogue path", () => {
    for (const artifact of reviewArtifacts) {
      const path = reviewFilePath(artifact, root);
      expect(path.startsWith(join(root, "docs/review/artifacts"))).toBe(true);
      expect(readFileSync(path, "utf8").toLowerCase()).toContain("<!doctype html");
    }
  });

  it("reports a path the tree does not have as an unreadable shelf, not an empty frame", () => {
    expect(() =>
      reviewFilePath({ path: "docs/review/artifacts/does-not-exist.html" }, root),
    ).toThrow(ReviewManifestUnreadable);
  });
});

/**
 * #914 — the reference the build is measured against has to be *on the shelf*, in every registry.
 *
 * The failure this pins is not a 404 on a page that does not exist: `prototype-relationship-lifecycle-v9.html`
 * has been committed since #826 while the catalogue, the manifest and the `review_artifact` table all stopped
 * at v7, so the owner's link to the approved drawing answered 404 and the card that builds against it had
 * nothing to point at. Three assertions, one per registry half: the catalogue carries both revisions, the
 * manifest resolves them into a group, and the route serves the file.
 */
describe("the approved reference is registered (#914)", () => {
  const referenceId = "review-relationship-lifecycle-v9";
  const historyId = "review-relationship-lifecycle-v8";

  it("publishes v9 as the approved reference and v8 beside it as history", () => {
    const reference = reviewArtifacts.find((row) => row.id === referenceId);
    const history = reviewArtifacts.find((row) => row.id === historyId);

    expect(reference?.slug).toBe("prototype-relationship-lifecycle-v9");
    expect(reference?.path).toBe(
      "docs/review/artifacts/prototype-relationship-lifecycle-v9.html",
    );
    expect(history?.slug).toBe("prototype-relationship-lifecycle-v8");
    expect(history?.path).toBe(
      "docs/review/artifacts/prototype-relationship-lifecycle-v8.html",
    );

    /* The row is the reference, not a draft: the shelf's title says so, so a reviewer reading the
       list cannot mistake the older drawing for the approved one. */
    expect(reference?.title.toLowerCase()).toContain("approved");
    expect(reference?.title.toLowerCase()).not.toContain("draft");

    /* The shelf keeps its history: registering the reference must not replace the v1–v7 record. */
    for (const version of ["v7", "v6", "v5", "v4", "v3", "v2", "v1"]) {
      expect(
        reviewArtifacts.some((row) => row.version === version),
        version,
      ).toBe(true);
    }
  });

  it("serves both documents from the artifact route", async () => {
    const { GET } = await import("../app/review-artifacts/[id]/route");
    for (const slug of ["prototype-relationship-lifecycle-v9", "prototype-relationship-lifecycle-v8"]) {
      const response = await GET(new Request("http://localhost/review-artifacts/x"), {
        params: Promise.resolve({ id: slug }),
      });
      expect(response.status, slug).toBe(200);
    }
  });

  it("groups both rows under a release the changelog records, and finds v9 by its slug", () => {
    const manifest = readReviewManifest(join(root, "docs/review/artifacts.json"), reviewArtifacts);
    const versions = readReleaseVersions(join(root, "docs/changelog/releases.json"));
    const summaries = reviewArtifacts.map((row) => summaryOf(row.id, row.version));
    const shelf = shelfOf(summaries, manifest, versions);

    for (const id of [referenceId, historyId]) {
      expect(shelf.byId.get(id)?.lookFor.length ?? 0, id).toBeGreaterThan(0);
    }
    /* `?artifact=` resolves by slug, which is the address the owner's link uses. */
    expect(shelf.bySlug.get("prototype-relationship-lifecycle-v9")?.summary.artifact.id).toBe(
      referenceId,
    );

    const listed = shelf.groups.flatMap((group) => group.entries.map((entry) => entry.summary.artifact.id));
    expect(listed.filter((id) => id === referenceId || id === historyId)).toHaveLength(2);
  });
});

describe("grouping by release", () => {
  const manifest = readReviewManifest(join(root, "docs/review/artifacts.json"), reviewArtifacts);

  it("groups by the release the manifest names, newest first, and a group is one state", () => {
    const summaries = reviewArtifacts.map((row) => summaryOf(row.id, row.version));
    const shelf = shelfOf(summaries, manifest, ["1.7.0", "1.6.0"]);
    expect(shelf.groups.map((group) => group.label)).toEqual(["v1.7.0"]);
    expect(shelf.groups[0].status).toBe("active");
    for (const entry of shelf.groups[0].entries) {
      expect(entry.lookFor.length).toBeGreaterThan(0);
    }
  });

  it("renders an older release as archived as a whole", () => {
    const summaries = reviewArtifacts.map((row) => summaryOf(row.id, row.version));
    const withPrev = new Map(manifest);
    withPrev.set(reviewArtifacts[0].id, {
      ...withPrev.get(reviewArtifacts[0].id)!,
      release: "1.6.0",
    });
    const shelf = shelfOf(summaries, withPrev, ["1.7.0", "1.6.0"]);
    expect(shelf.groups.map((group) => `${group.label}:${group.status}`)).toEqual([
      "v1.7.0:active",
      "v1.6.0:archived",
    ]);
    expect(shelf.groups[1].entries).toHaveLength(1);
  });

  it("orders the rows inside a group by version, newest first", () => {
    const summaries = reviewArtifacts.map((row) => summaryOf(row.id, row.version));
    const shelf = shelfOf(summaries, manifest, ["1.7.0"]);
    /* the rule is newest-first, so the expectation is every published version in descending order —
       adding a row is a data change, and this must keep proving the order rather than a fixed list */
    expect(shelf.groups[0].entries.map((entry) => entry.summary.artifact.version)).toEqual([
      "v7",
      "v6",
      "v5",
      "v4",
      "v3",
      "v2",
      "v1",
    ]);
  });

  it("keeps the latest capture at the head of its group", () => {
    const a = summaryOf(reviewArtifacts[0].id, "v4");
    const b = { ...summaryOf(reviewArtifacts[1].id, "v3") };
    const shelf = shelfOf([b, a], manifest, ["1.7.0"]);
    expect(shelf.groups[0].entries[0].summary.artifact.id).toBe(a.artifact.id);
  });

  it("resolves the same entry by id and by slug", () => {
    const summaries = reviewArtifacts.map((row) => summaryOf(row.id, row.version));
    const shelf = shelfOf(summaries, manifest, ["1.7.0"]);
    const artifact = reviewArtifacts[0];
    expect(shelf.byId.get(artifact.id)?.summary.artifact.slug).toBe(artifact.slug);
    expect(shelf.bySlug.get(artifact.slug)?.summary.artifact.id).toBe(artifact.id);
  });

  it("compares dot versions numerically, and a prerelease below its release", () => {
    expect(compareVersions("1.10.0", "1.9.0")).toBeLessThan(0);
    expect(compareVersions("1.6.0", "1.6.0-rc.1")).toBeLessThan(0);
    expect(compareVersions("1.6.0", "1.6.0")).toBe(0);
  });
});

describe("the screen with rows in it (#665 follow-up)", () => {
  /**
   * The composed screen, rendered server-side with one artifact and its two lists. `renderTo`,
   * `next/link` and the client controls all draw for real, so this is what catches a pane that
   * throws when a shelf finally has rows — the failure the empty-state-only renders never see.
   */
  const manifest = readReviewManifest(join(root, "docs/review/artifacts.json"), reviewArtifacts);
  const artifact = reviewArtifacts[0];
  const summary = summaryOf(artifact.id, artifact.version);
  const detail = {
    ...summary,
    progress: {
      ...summary.progress,
      todosDone: 1,
      todosTotal: 2,
      issuesOpen: 1,
      issuesClosed: 1,
      updatedAt: "2026-11-07T10:00:00.000Z",
    },
    todos: [
      {
        id: "todo-1",
        artifactId: artifact.id,
        body: "The invite step names the sender",
        doneAt: "2026-11-07T10:00:00.000Z",
        authorUserId: "user-avery",
        createdAt: "2026-11-06T10:00:00.000Z",
      },
      {
        id: "todo-2",
        artifactId: artifact.id,
        body: "The conversion CTA is one button",
        doneAt: null,
        authorUserId: "user-avery",
        createdAt: "2026-11-06T10:00:00.000Z",
      },
    ],
    issues: [
      {
        id: "issue-1",
        artifactId: artifact.id,
        number: 1,
        title: "The second aspect has no right-hand label",
        body: "",
        state: "open" as const,
        labels: ["copy"],
        authorUserId: "user-rowan",
        openedAt: "2026-11-06T11:00:00.000Z",
        closedAt: null,
      },
    ],
  };
  const shelf = shelfOf([summary], manifest, ["1.7.0", "1.6.0"]);
  const noop = async () => ({ ok: true }) as const;

  const render = (thread: { issue: (typeof detail.issues)[number]; comments: [] } | null) =>
    renderToStaticMarkup(
      createElement(ReviewArtifacts, {
        copy: adminReviewPageCopy,
        shelf,
        selected: detail,
        thread,
        unreadable: null,
        onToggleTodo: noop,
        onCommentOnIssue: noop,
        onSetIssueState: noop,
      }),
    );

  it("draws a live checkbox per to-do and the reply/close controls on the thread", () => {
    const checklist = render(null);
    expect(checklist).toContain(`data-todo="todo-1"`);
    expect(checklist).toContain(`data-done="true"`);
    expect(checklist).toContain(`data-done="false"`);
    expect(checklist).toContain('role="checkbox"');
    expect(checklist).toContain("Mark done: The conversion CTA is one button");
    // The card's third requirement: a screen that writes must not say it does not.
    expect(checklist.toLowerCase()).not.toContain("read-only");
    expect(checklist).not.toContain('disabled=""');

    const thread = render({ issue: detail.issues[0], comments: [] });
    expect(thread).toContain(`data-issue-thread="1"`);
    expect(thread).toContain(`data-issue-action="close"`);
    expect(thread).toContain("Close issue");
    expect(thread).toContain("Comment");
    expect(thread).not.toContain('disabled=""');
    expect(thread.toLowerCase()).not.toContain("read-only");
  });
});

describe("the artifact route", () => {
  it("serves a catalogued artifact as a sandboxed document", async () => {
    const { GET } = await import("../app/review-artifacts/[id]/route");
    const artifact = reviewArtifacts[0];
    const response = await GET(new Request("http://localhost/review-artifacts/x"), {
      params: Promise.resolve({ id: artifact.slug }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(response.headers.get("content-security-policy")).toBe("sandbox allow-scripts");
    expect((await response.text()).toLowerCase()).toContain("<!doctype html");
  });

  it("answers 404 for an id the catalogue does not name", async () => {
    const { GET } = await import("../app/review-artifacts/[id]/route");
    for (const id of [
      "not-an-artifact",
      "prototype-relationship-lifecycle-v10",
      "..%2F..%2Fpackage.json",
      "docs/review/artifacts/prototype-relationship-lifecycle-v4.html",
      "/etc/passwd",
    ]) {
      const response = await GET(new Request("http://localhost/review-artifacts/x"), {
        params: Promise.resolve({ id }),
      });
      expect(response.status, id).toBe(404);
    }
  });
});
