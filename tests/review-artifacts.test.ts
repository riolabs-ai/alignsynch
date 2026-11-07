/**
 * `/admin/review` — the manifest is the catalogue, and nothing outside it can be rendered (#665).
 *
 * Four claims, one per block below:
 *
 *   1. **The committed manifest is valid and every file it names is in the tree.** A row that points
 *      at a file nobody published is the one failure a hash or a typecheck cannot see.
 *   2. **The list is grouped by release, and a group is archived or active as one.** The grouping is
 *      derived from the artifact's `release` and the changelog's release record; the case with a
 *      synthetic release table pins the archived side, which today's tree cannot show (every
 *      published artifact belongs to the release that is currently active).
 *   3. **A path outside the manifest cannot be rendered.** Three shapes of the same attempt: an id
 *      the manifest does not carry, a path spelled as an id, and a manifest row whose `file` tries to
 *      leave the artifact directory. The first two are 404s from the route; the third fails the
 *      schema, so it never reaches the filesystem at all.
 *   4. **The row's counts come from the record.** `TODO 3 / 7 done · 5 open · 2 closed` is the
 *      fixture's own tally rather than a second number authored beside it.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

/**
 * The two heavyweight reads behind the session, stubbed for the same reason
 * `tests/admin-audit-page.test.ts` stubs them: `@/lib/auth/session` pulls Neon's SDK in, whose
 * entry imports `next/headers` — a module a node worker cannot resolve. Neither function is called
 * here, because `requireAdmin` is replaced below; stubbing them buys the real module graph for free.
 */
vi.mock("@/lib/auth/session", () => ({
  currentUser: async () => null,
}));

vi.mock("@/lib/db/user-profiles", () => ({
  readUserProfileByUserId: async () => null,
  readUserProfileByHandle: async () => null,
}));

/**
 * The route's **role** gate is opened for this suite, the way `tests/parity/parity.check.ts` opens
 * it for the boundary case: the question here is the manifest — which ids resolve, which answer
 * 404, and what the response headers say — not the role ladder, which `tests/require-role.test.ts`
 * and the card's `curl` table own. Leaving it in the way would mean every case answers
 * `NEON_AUTH_BASE_URL is not set` and the assertions would pass over a route that never ran.
 */
vi.mock("@/lib/auth/require-role", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/require-role")>()),
  requireAdmin: async () => ({ kind: "allow", role: "admin" }),
}));

import { GET } from "@/app/review-artifacts/[id]/route";
import { zReviewManifest } from "@/content/review";
import {
  type ReviewCatalogue,
  groupsOf,
  readReviewCatalogue,
  reviewArtifactFile,
  reviewStatsOf,
} from "@/lib/review/artifacts";
import { reviewStore } from "@/lib/review/store";

const catalogue: ReviewCatalogue = readReviewCatalogue();

/** Ask the route handler for an id, the way Next would. */
async function fetchArtifact(id: string): Promise<Response> {
  return GET(new Request(`http://localhost/review-artifacts/${id}`), {
    params: Promise.resolve({ id }),
  });
}

describe("the review manifest", () => {
  it("parses, and every artifact it names is a file in docs/review/artifacts/", () => {
    expect(catalogue.manifest.artifacts.length).toBeGreaterThan(0);
    for (const artifact of catalogue.manifest.artifacts) {
      const body = readFileSync(reviewArtifactFile(artifact), "utf8");
      // A published artifact is a whole document, not a placeholder or an empty file.
      expect(body.toLowerCase(), `${artifact.id} is not HTML`).toContain("<!doctype html>");
      expect(body.length, `${artifact.id} is suspiciously small`).toBeGreaterThan(1000);
    }
  });

  it("names each artifact once, and every release it names is one the changelog records", () => {
    const ids = catalogue.manifest.artifacts.map((artifact) => artifact.id);
    expect(new Set(ids).size).toBe(ids.length);
    // `readReviewCatalogue()` throws on a release the release record does not carry, so reaching
    // here with a group means every artifact's release resolved.
    for (const group of catalogue.groups) {
      expect(group.artifacts.every((artifact) => artifact.release === group.version)).toBe(true);
    }
  });
});

describe("grouping by release", () => {
  it("groups today's artifacts under the release that is active, newest first", () => {
    expect(catalogue.groups.length).toBeGreaterThan(0);
    const [first] = catalogue.groups;
    expect(first?.status).toBe("active");
    // The prototypes were published during the release in flight, so they are that release's.
    expect(first?.artifacts.length).toBe(catalogue.manifest.artifacts.length);
    expect(catalogue.groups.filter((group) => group.status === "active")).toHaveLength(1);
  });

  it("marks an older release archived as one, whatever its artifacts are", () => {
    const manifest = zReviewManifest.parse({
      schemaVersion: 1,
      artifacts: [
        {
          id: "older-one",
          title: "An older artifact",
          kind: "prototype",
          version: "v1",
          date: "2026-10-01",
          release: "1.5.0",
          file: "prototype-relationship-lifecycle-v1.html",
          lookFor: "Whether the flow reads in order.",
        },
        {
          id: "older-two",
          title: "A second artifact from the same release",
          kind: "diagram",
          version: "v1",
          date: "2026-10-01",
          release: "1.5.0",
          file: "prototype-relationship-lifecycle-v2.html",
          lookFor: "Whether the stages match the ones above.",
        },
        {
          id: "newest-one",
          title: "The current artifact",
          kind: "report",
          version: "v1",
          date: "2026-11-07",
          release: "1.6.0",
          file: "prototype-relationship-lifecycle-v4.html",
          lookFor: "Whether the report matches the flow.",
        },
      ],
    });

    const groups = groupsOf(manifest, ["1.6.0", "1.5.0"]);
    expect(groups.map((group) => group.version)).toEqual(["1.6.0", "1.5.0"]);
    // The state is the release's, so both rows of 1.5.0 are archived together — a row never
    // carries a state of its own.
    expect(groups[1]?.status).toBe("archived");
    expect(groups[1]?.artifacts.every((artifact) => artifact.release === "1.5.0")).toBe(true);
  });
});

describe("a path outside the manifest cannot be rendered", () => {
  it("answers 404 for an id the manifest does not carry", async () => {
    const response = await fetchArtifact("no-such-artifact");
    expect(response.status).toBe(404);
  });

  it("answers 404 for a traversal spelled as an id", async () => {
    for (const id of ["../package.json", "..%2Fpackage.json", "../../docs/review/artifacts.json"]) {
      const response = await fetchArtifact(id);
      expect(response.status, `id ${id}`).toBe(404);
    }
  });

  it("refuses a manifest row whose file tries to leave the artifact directory", () => {
    const result = zReviewManifest.safeParse({
      schemaVersion: 1,
      artifacts: [
        {
          id: "escape",
          title: "An artifact that is not under the directory",
          kind: "report",
          version: "v1",
          date: "2026-11-07",
          release: "1.6.0",
          file: "../../package.json",
          lookFor: "Nothing: this row must not parse.",
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("serves the artifact it names as a sandboxed document", async () => {
    const first = catalogue.groups[0]?.artifacts[0];
    expect(first).toBeDefined();
    const response = await fetchArtifact(first?.id ?? "");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    // The document is sandboxed at the response as well as at the iframe: a direct visit cannot
    // reach this app's origin either.
    expect(response.headers.get("content-security-policy")).toContain("sandbox");
    expect((await response.text()).toLowerCase()).toContain("<!doctype html>");
  });
});

describe("the review record", () => {
  it("counts the to-dos and the issues from the rows, not from a second tally", () => {
    const record = reviewStore.recordFor("relationship-lifecycle-v4");
    expect(record).not.toBeNull();
    const stats = reviewStatsOf(record ?? { artifactId: "", todos: [], issues: [] });
    expect(stats).toEqual({ done: 3, total: 7, open: 5, closed: 2 });
  });

  it("has no record for an artifact it does not hold, rather than an empty one", () => {
    expect(reviewStore.recordFor("no-such-artifact")).toBeNull();
  });

  it("says on the page that it cannot write yet", () => {
    // A read-only cut that does not say so looks live and drops the write; the store answers this
    // sentence until the three tables land, and `null` afterwards.
    expect(reviewStore.readOnlyReason).toContain("sample rows");
  });
});
