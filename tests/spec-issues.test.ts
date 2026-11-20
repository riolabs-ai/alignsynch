/**
 * The spec register's GitHub pull (#1296) — the marker mapping, the pills, the cache's three
 * answers, the fetch's four, and the absence of any write path.
 *
 * **What these cases are for.** The card's acceptance names five behaviours a screenshot cannot
 * check: the marker decides the row, a body without one is skipped *and counted*, a label decides
 * each pill, a failed read degrades to the last copy or to no column, and nothing under the spec
 * surface can write. Each is a case below, and the rendering cases assert the **rendered markup** —
 * the `target`/`rel`/aria-label triple on the issue link, the two pills as words, and the em dash
 * on a row nobody filed — because those are the four facts the screenshot is meant to prove and a
 * static read of the source cannot.
 *
 * **No network.** `fetchSpecIssues` takes its `fetch`, its token, its API root and its timeout, so
 * every branch — a 403 from a grant that lost its scope, a socket that never answered, a 200 whose
 * body is an HTML page — is exercised against a stub. `unstable_cache` is never imported here: the
 * policy it wraps is `specIssuesAnswerOf`, which is pure.
 *
 * **The stills.** The rendered proof — a filed row with its number, state, tier and both pills, a
 * row nobody filed drawing the em dash, and the page with a broken token — lives in
 * `docs/qa/spec-issues/` with the asserts each frame was taken under, because these cases can prove
 * the markup and only a browser can prove the picture.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { StoryPage } from "@/components/admin/spec/story-page";
import { ValidationMatrix } from "@/components/admin/spec/validation-matrix";
import { SPEC_STORY_GROUPS, type SpecValidation } from "@/content/spec";
import { adminSpecPageCopy } from "@/data/pages/admin-spec";
import { readSpecValidation } from "@/lib/spec/file";
import { fetchSpecIssues, specIssuesHeaders } from "@/lib/spec/issues-github";
import {
  SPEC_APPROVED_LABEL,
  SPEC_ISSUES_QUERY,
  SPEC_REVIEWED_LABEL,
  specIssueFor,
  specIssueOf,
  specIssuesAnswerOf,
  specIssuesOf,
  specRowMarkerOf,
  type SpecIssuesReady,
} from "@/lib/spec/issues";

const copy = adminSpecPageCopy;

/** The committed register, through the same reader the page uses. */
function register(): SpecValidation {
  return readSpecValidation();
}

/** One issue as GitHub serves it, already filed by the release. */
function issueOf(
  number: number,
  rowId: string,
  overrides: {
    state?: "open" | "closed";
    labels?: string[];
    milestone?: string | null;
    body?: string | null;
  } = {},
) {
  return {
    number,
    state: overrides.state ?? "open",
    body: overrides.body === undefined ? `<!-- spec-row:${rowId} -->\n\nthe brief` : overrides.body,
    html_url: `https://github.com/riolabs-ai/alignsynch-web/issues/${number}`,
    milestone:
      overrides.milestone === undefined
        ? { title: "v2.0.0 — the official release" }
        : overrides.milestone === null
          ? null
          : { title: overrides.milestone },
    labels: (overrides.labels ?? ["spec", "tier/R1", "area/flow"]).map((name) => ({ name })),
  };
}

/** A ready read over the given entries. Throws rather than returning `null` — a test's payload. */
function readOf(entries: unknown[]): SpecIssuesReady {
  const read = specIssuesOf(entries);
  if (read === null) throw new Error("the fixture payload did not parse as a collection");
  return read;
}

describe("the marker decides the row", () => {
  it("reads the row id out of the HTML comment, whatever the spacing", () => {
    expect(specRowMarkerOf("<!-- spec-row:APP-05 -->")).toBe("APP-05");
    expect(specRowMarkerOf("<!--spec-row:WEB-06-->")).toBe("WEB-06");
    expect(specRowMarkerOf("intro\n\n<!--   spec-row:   OPS-01   -->\n\nmore")).toBe("OPS-01");
  });

  it("answers null for a body with no marker, an empty body, or no body at all", () => {
    expect(specRowMarkerOf("APP-05 in a title is not a marker")).toBeNull();
    expect(specRowMarkerOf("")).toBeNull();
    expect(specRowMarkerOf(null)).toBeNull();
    expect(specRowMarkerOf(undefined)).toBeNull();
  });

  it("takes the row from the marker and never from a title or another label", () => {
    const issue = specIssueOf({
      ...issueOf(1268, "APP-05"),
      title: "WEB-08 something entirely different",
      labels: [{ name: "spec" }, { name: "WEB-08" }, { name: "tier/R1" }],
    });
    expect(issue?.rowId).toBe("APP-05");
  });
});

describe("one entry, as a row", () => {
  it("carries the number, the state, the milestone, the tier and the two labels", () => {
    const issue = specIssueOf(
      issueOf(1288, "WEB-06", {
        state: "closed",
        labels: ["spec", "tier/R2", SPEC_REVIEWED_LABEL, SPEC_APPROVED_LABEL],
      }),
    );
    expect(issue).toMatchObject({
      rowId: "WEB-06",
      number: 1288,
      state: "closed",
      milestone: "v2.0.0 — the official release",
      tier: "tier/R2",
      reviewed: true,
      approved: true,
    });
    expect(issue?.url).toBe("https://github.com/riolabs-ai/alignsynch-web/issues/1288");
  });

  it("reads a missing label as a real 'no', and a missing milestone or tier as absent", () => {
    const issue = specIssueOf(issueOf(1269, "APP-09", { labels: ["spec"], milestone: null }));
    expect(issue).toMatchObject({ reviewed: false, approved: false, tier: null, milestone: null });
  });

  it("is not a row when it is a pull request, has no marker, or has no usable number", () => {
    expect(specIssueOf({ ...issueOf(1, "APP-05"), pull_request: { url: "x" } })).toBeNull();
    expect(specIssueOf({ ...issueOf(2, "APP-05"), body: "no marker here" })).toBeNull();
    expect(specIssueOf({ ...issueOf(3, "APP-05"), number: "1270" })).toBeNull();
    expect(specIssueOf(null)).toBeNull();
  });
});

describe("the whole set", () => {
  it("counts what it mapped, and counts what it skipped", () => {
    const read = readOf([
      issueOf(1268, "APP-05"),
      issueOf(1269, "APP-09"),
      // A second issue claiming a row that is already taken: counted, not drawn.
      issueOf(1300, "APP-05"),
      // A body with no marker: the one shape the card names explicitly.
      { ...issueOf(1301, "APP-11"), body: "filed without the marker" },
      // A pull request carrying the label.
      { ...issueOf(1302, "APP-14"), pull_request: { url: "x" } },
    ]);
    expect(read.count).toBe(2);
    expect(read.skipped).toBe(3);
    expect(Object.keys(read.issues).sort()).toEqual(["APP-05", "APP-09"]);
  });

  it("refuses a payload that is not a collection, rather than reading it as empty", () => {
    expect(specIssuesOf({ message: "Not Found" })).toBeNull();
    expect(specIssuesOf("<html>rate limited</html>")).toBeNull();
    expect(specIssuesOf(null)).toBeNull();
  });

  it("answers null for a row with no issue — the em dash, never a false", () => {
    const read = readOf([issueOf(1268, "APP-05")]);
    expect(specIssueFor(read, "APP-05")?.number).toBe(1268);
    expect(specIssueFor(read, "WEB-99")).toBeNull();
    expect(specIssueFor(null, "APP-05")).toBeNull();
    expect(specIssueFor({ kind: "unavailable", reason: "refused" }, "APP-05")).toBeNull();
  });
});

describe("the cache's three answers", () => {
  const fresh = readOf([issueOf(1268, "APP-05")]);
  const older = readOf([issueOf(1268, "APP-05"), issueOf(1269, "APP-09")]);

  it("serves a live read as it is, never marked stale", () => {
    expect(specIssuesAnswerOf(fresh, older)).toBe(fresh);
    expect(specIssuesAnswerOf(fresh, null)).toBe(fresh);
  });

  it("falls back to the last copy, marked stale, when GitHub does not answer", () => {
    const answer = specIssuesAnswerOf(
      { kind: "unavailable", reason: "refused", status: 403 },
      older,
    );
    expect(answer).toMatchObject({ kind: "ready", count: 2, stale: true });
  });

  it("with nothing to fall back on, returns the failure — no column, and a reason", () => {
    const answer = specIssuesAnswerOf({ kind: "unavailable", reason: "failed" }, null);
    expect(answer).toEqual({ kind: "unavailable", reason: "failed" });
  });
});

describe("the one request", () => {
  /** A stub `fetch`, and a record of what it was asked for. */
  function stub(answer: () => Promise<Response> | Response) {
    const calls: { url: string; init?: RequestInit }[] = [];
    const impl = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return answer();
    }) as unknown as typeof fetch;
    return { impl, calls };
  }

  it("asks for the label, both states, and one page — with the token when there is one", async () => {
    const { impl, calls } = stub(() => Response.json([issueOf(1268, "APP-05")]));
    const read = await fetchSpecIssues({ fetchImpl: impl, token: "abc123" });
    expect(read.kind).toBe("ready");
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain(SPEC_ISSUES_QUERY);
    expect(calls[0].init?.method).toBe("GET");
    const sent = (calls[0].init?.headers ?? {}) as Record<string, string>;
    expect(sent.authorization).toBe("Bearer abc123");
  });

  it("sends no authorization header when the deployment has no token", async () => {
    const { impl, calls } = stub(() => Response.json([]));
    await fetchSpecIssues({ fetchImpl: impl, token: "" });
    const sent = (calls[0].init?.headers ?? {}) as Record<string, string>;
    expect(sent.authorization).toBeUndefined();
    expect(specIssuesHeaders("").authorization).toBeUndefined();
  });

  it("degrades on a refused grant — and does not retry anonymously behind it", async () => {
    const { impl, calls } = stub(() => new Response("forbidden", { status: 403 }));
    const read = await fetchSpecIssues({ fetchImpl: impl, token: "expired" });
    expect(read).toEqual({ kind: "unavailable", reason: "refused", status: 403 });
    // One call: a broken grant is reported, not hidden by spending the anonymous quota.
    expect(calls).toHaveLength(1);
  });

  it("degrades when the call never lands, and when the body is not a collection", async () => {
    const thrown = stub(() => Promise.reject(new Error("ENOTFOUND")));
    expect(await fetchSpecIssues({ fetchImpl: thrown.impl, token: "" })).toEqual({
      kind: "unavailable",
      reason: "failed",
    });

    const html = stub(() => new Response("<html>too many requests</html>", { status: 200 }));
    expect(await fetchSpecIssues({ fetchImpl: html.impl, token: "" })).toEqual({
      kind: "unavailable",
      reason: "unreadable",
    });
  });
});

describe("there is no write path", () => {
  /** Every module that touches GitHub on the spec surface. */
  const files = [
    "lib/spec/issues.ts",
    "lib/spec/issues-github.ts",
    "lib/spec/issues-cache.ts",
    "app/api/admin/spec-issues/refresh/route.ts",
  ];
  /** The three spec routes, and every module under them. */
  function specRouteFiles(
    dir = join(process.cwd(), "app", "(mainlayout)", "admin", "spec"),
  ): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) return specRouteFiles(full);
      return [`${full.slice(process.cwd().length + 1)}`];
    });
  }

  it("carries no write verb, no server action and no mutation export", () => {
    for (const path of [...files, ...specRouteFiles()]) {
      const source = readFileSync(join(process.cwd(), path), "utf8");
      expect(source, `${path} names a write verb`).not.toMatch(/"(POST|PUT|PATCH|DELETE)"/);
      expect(source, `${path} declares a server action`).not.toMatch(/["']use server["']/);
      // The only `method:` this surface may declare is a GET — a URL that names an issue is not a
      // write, so the check is on the verb rather than on the word "issues".
      for (const method of source.matchAll(/method:\s*"(\w+)"/g)) {
        expect(method[1], `${path} sends ${method[1]}`).toBe("GET");
      }
      expect(source, `${path} toggles a label`).not.toMatch(/\/labels$/m);
    }
  });

  it("exposes exactly one handler, and it is a GET", () => {
    const source = readFileSync(
      join(process.cwd(), "app/api/admin/spec-issues/refresh/route.ts"),
      "utf8",
    );
    const handlers = [...source.matchAll(/export async function (\w+)\(/g)].map((m) => m[1]);
    expect(handlers).toEqual(["GET"]);
  });

  it("never lets the token reach a client component or a log line", () => {
    for (const path of files) {
      const source = readFileSync(join(process.cwd(), path), "utf8");
      expect(source, `${path} is a client module`).not.toContain('"use client"');
      expect(source, `${path} exposes a NEXT_PUBLIC name`).not.toContain("NEXT_PUBLIC_");
      // The token is dereferenced by name and never printed: the only console line that could
      // carry it is one that interpolates it, and there is none.
      expect(source, `${path} logs the token`).not.toMatch(/console\.\w+\([^)]*token[^)]*\)/i);
    }
  });
});

describe("the column, rendered", () => {
  const read = readOf([
    issueOf(1268, "APP-05", { labels: ["spec", "tier/R1", SPEC_REVIEWED_LABEL] }),
    issueOf(1269, "APP-09", { state: "closed", labels: ["spec", "tier/R2", SPEC_APPROVED_LABEL] }),
  ]);

  it("links the issue out of the app: a new tab, no opener, and a name that says so", () => {
    const markup = renderToStaticMarkup(
      createElement(ValidationMatrix, { copy, doc: register(), issues: read }),
    );
    const link = markup.slice(
      markup.indexOf("https://github.com/riolabs-ai/alignsynch-web/issues"),
    );
    expect(link).toContain('target="_blank"');
    expect(link).toContain('rel="noopener noreferrer"');
    expect(markup).toMatch(/aria-label="#1268 — opens in a new tab"/);
  });

  it("draws the state, the milestone, the tier and both pills for a filed row", () => {
    const markup = renderToStaticMarkup(
      createElement(ValidationMatrix, { copy, doc: register(), issues: read }),
    );
    expect(markup).toContain('data-spec-issue="APP-05"');
    expect(markup).toContain('data-spec-issue-state="open"');
    expect(markup).toContain('data-spec-issue-tier="tier/R1"');
    expect(markup).toContain("v2.0.0 — the official release");
    // The pills are words, and they disagree with each other on purpose: APP-05 is reviewed and
    // not approved, APP-09 the other way round, and both are read off the labels.
    expect(markup).toContain('data-spec-pill="reviewed" data-spec-pill-on="yes"');
    expect(markup).toContain('data-spec-pill="approved" data-spec-pill-on="no"');
    expect(markup).toContain("Not approved");
    expect(markup).toContain('data-spec-issue-state="closed"');
  });

  it("draws the em dash for a row nobody filed, and the count the API returned", () => {
    const markup = renderToStaticMarkup(
      createElement(ValidationMatrix, { copy, doc: register(), issues: read }),
    );
    // 88 rows, 2 filed: everything else is a dash under its own caption.
    expect(markup.match(/data-spec-issue="none"/g)?.length).toBe(register().rows.length - 2);
    expect(markup).toContain('data-spec-issues-count="2"');
    expect(markup).toContain("2 issues read from GitHub");
  });

  it("renders the register and says so when GitHub could not be reached", () => {
    const markup = renderToStaticMarkup(
      createElement(ValidationMatrix, {
        copy,
        doc: register(),
        issues: { kind: "unavailable", reason: "refused", status: 403 },
      }),
    );
    // No issue block at all…
    expect(markup).not.toContain("data-spec-issue=");
    // …the honest notice, and the register exactly as it renders today.
    expect(markup).toContain('data-spec-issues-notice="degraded"');
    expect(markup).toContain("GitHub could not be reached");
    expect(markup.match(/data-spec-row="/g)?.length).toBe(register().rows.length);
    // The one control is still there, and it is a link — not a form, not a button.
    expect(markup).toContain("Refresh from GitHub");
    expect(markup).not.toContain("<button");
  });

  it("draws the issue column on a story page, with a dash for an unfiled row", () => {
    const story = SPEC_STORY_GROUPS.find((group) => group.name === "Play with Aspects");
    expect(story).toBeDefined();
    const markup = renderToStaticMarkup(
      createElement(StoryPage, {
        copy,
        doc: register(),
        story: story ?? null,
        issues: read,
        path: "/admin/spec/01-play-with-aspects",
      }),
    );
    // The Status band's own header gained the column; the other three bands kept their shape.
    expect(markup.match(/>Issue</g)?.length).toBe(1);
    expect(markup).toContain('data-spec-issue="APP-05"');
    expect(markup).toContain('data-spec-issue="APP-09"');
    // The refresh control comes back to this story, not to the matrix.
    expect(markup).toContain("next=%2Fadmin%2Fspec%2F01-play-with-aspects");
  });

  it("draws no issue column on a story page when the read produced nothing", () => {
    const story = SPEC_STORY_GROUPS[0];
    const markup = renderToStaticMarkup(
      createElement(StoryPage, {
        copy,
        doc: register(),
        story,
        issues: { kind: "unavailable", reason: "failed" },
      }),
    );
    expect(markup).not.toContain(">Issue<");
    expect(markup).toContain('data-spec-issues-notice="degraded"');
  });
});
