/**
 * `/admin/docs/features` and `/admin/docs/releases` — the two derived views (#893).
 *
 * Five claims, and the fifth is the card's own success test:
 *
 *   1. **One parser.** `lib/docs/changelog.ts` is what `scripts/changelog-view.mjs` imports, so the
 *      generated pages and these screens cannot disagree about what an entry is. The cases below
 *      drive the parser directly (an entry, its sections, the link footer, the PR count) and then
 *      assert the generator imports this module rather than keeping a copy.
 *   2. **The areas are derived, never listed.** `featureAreas()` groups `feat(<area>)` scopes out of
 *      real text; there is no area name in this file, in the component or in the fixture.
 *   3. **The join is a rule, not a guess.** The releases a row reports are the record's rows; the
 *      pages it reports are the manifest rows whose title or path names every token of the area,
 *      with `changelog/` excluded — so `db-verify` needs both tokens and an undocumented area
 *      reports zero rather than a fuzzy neighbour.
 *   4. **An unknown version is `notFound()`,** and a broken source is a panel with the reason —
 *      never an empty shelf and never the newest release wearing somebody else's name.
 *   5. **A new release needs no edit to this feature.** A synthetic entry plus a synthetic record
 *      row produces a new area card and a new shelf row through the real functions, which is the
 *      only form of "auto-updating" that a reviewer can run.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  type ChangelogEntry,
  pageOf,
  parseChangelog,
  releasePathOf,
  scopedCommits,
  tagUrl,
} from "@/lib/docs/changelog";
import { featureAreaAnchor, featureAreas, releaseFeatureCommits } from "@/lib/docs/features";
import {
  parseDocsManifest,
  parseReleaseRecord,
  ReleaseRecordUnreadable,
} from "@/lib/docs/manifest";
import {
  type ReleaseRow,
  findRelease,
  releaseHref,
  releaseRows,
  withManifestPresence,
} from "@/lib/docs/releases";
import { docsRows } from "@/lib/docs/rows";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** What the mocked role gate answers with — the *policy* underneath it stays real. */
const gate = vi.hoisted(() => ({ role: "admin" as "support" | "admin" | "owner" | "member" }));

/** Whether the template claims the console. Flipped by the capability case, reset by every other. */
const capability = vi.hoisted(() => ({ adminProduct: true }));

/** A spy, so "the capability gate closed before anything was read" is a claim about a call. */
const requireAdminSpy = vi.hoisted(() => vi.fn());

vi.mock("@/lib/brand-boundary", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/brand-boundary")>();
  const { notFound } = await import("next/navigation");
  return {
    ...real,
    requireAdminProduct: () => {
      if (!capability.adminProduct) notFound();
    },
  };
});

/** The auth module the policy needs, stubbed: a node worker cannot resolve `next/headers`. */
vi.mock("@/lib/auth/session", () => ({
  currentUser: async () => null,
}));

vi.mock("@/lib/db/user-profiles", () => ({
  readUserProfileByUserId: async () => null,
  readUserProfileByHandle: async () => null,
}));

vi.mock("@/lib/auth/require-role", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/auth/require-role")>();
  const { notFound } = await import("next/navigation");
  return {
    ...real,
    requireAdmin: async (options: { next?: string } = {}) => {
      requireAdminSpy(options);
      const answer = real.roleAnswerFor({ needed: "admin", signedIn: true, role: gate.role });
      if (answer.kind === "redirect") throw new Error(`an unexpected redirect to ${answer.to}`);
      if (answer.kind === "not-found") {
        notFound();
        throw new Error("notFound() did not throw");
      }
      return {
        user: { userId: "auth-1", email: "a@b.c", name: "", sessionId: null },
        role: answer.role,
      };
    },
  };
});

/** Comments out, code left: these docstrings name `new Date(` and `node:fs` without importing them. */
function code(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function sourceOf(relative: string): string {
  return code(readFileSync(`${ROOT}${relative}`, "utf8"));
}

/** The three sources as the tree actually holds them. */
function realEntries() {
  return parseChangelog(readFileSync(`${ROOT}CHANGELOG.md`, "utf8"));
}

function realRecord() {
  return parseReleaseRecord(
    JSON.parse(readFileSync(`${ROOT}docs/changelog/releases.json`, "utf8")),
  );
}

function realDocs() {
  return docsRows(parseDocsManifest(JSON.parse(readFileSync(`${ROOT}docs/docs.json`, "utf8"))));
}

/** The entry the scoped-commit cases work over. Throws rather than asserting, so a broken fixture
 *  fails as a sentence instead of a non-null assertion the linter has to tolerate. */
function firstEntry(): ChangelogEntry {
  const entry = parseChangelog(ENTRY)[0];
  if (entry === undefined) throw new Error("the fixture carries no entry");
  return entry;
}

/** The newest row, for the render cases. */
function newestRow(): ReleaseRow {
  const row = releaseRows(realEntries(), realRecord())[0];
  if (row === undefined) throw new Error("the record carries no release");
  return row;
}

/** One entry, spelled the way `scripts/release.sh` writes one. */
const ENTRY = [
  "## [9.9.9] - 2026-11-13",
  "",
  "The intro paragraph.",
  "",
  "### Added",
  "",
  "- `feat(flow)` — a stage that walks itself (#900) ([#901](https://github.com/riolabs-ai/alignsynch/pull/901))",
  "- `feat(flow)` — the second half of it (#902) ([#903](https://github.com/riolabs-ai/alignsynch/pull/903))",
  "- `feat(db-verify)` — a check that reads two columns",
  "- a bullet with no scope at all",
  "",
  "### Fixed",
  "",
  "- `fix(flow)` — a wrapped commit subject that continues",
  "  onto a second line (#904)",
  "",
  "### Known limits",
  "",
  "- **One limit.** It is a limit.",
  "",
  "## [9.9.8] - 2026-11-12",
  "",
  "### Added",
  "",
  "- `feat(ui)` — a button that says what it does (#800) ([#801](https://github.com/riolabs-ai/alignsynch/pull/801))",
  "",
  "### Known limits",
  "",
  "- **Another limit.**",
  "",
  "[9.9.9]: https://github.com/riolabs-ai/alignsynch/compare/v9.9.8...v9.9.9",
].join("\n");

const RECORD = {
  releases: [
    { version: "9.9.9", theme: "the theme of it", headline: "`feat(flow)` — the headline" },
    { version: "9.9.8", theme: "the earlier theme", headline: "`feat(ui)` — an earlier headline" },
  ],
};

describe("the changelog parse — one module, both callers", () => {
  it("classifies entries, sections, limits and the pull requests an entry names", () => {
    const entries = parseChangelog(ENTRY);

    expect(entries.map((entry) => entry.version)).toEqual(["9.9.9", "9.9.8"]);
    expect(entries[0]?.date).toBe("2026-11-13");
    expect(entries[0]?.intro).toEqual(["The intro paragraph."]);
    expect(entries[0]?.sections.map((section) => section.title)).toEqual([
      "Added",
      "Fixed",
      "Known limits",
    ]);
    // Verbatim: the bullet is the file's bytes, backticks and all.
    expect(entries[0]?.sections[0]?.lines[0]).toContain("`feat(flow)` — a stage that walks itself");
    expect(entries[0]?.hasLimits).toBe(true);
    // Three distinct PR links: #901, #903 and #801 is the *other* entry's, so this is 2.
    expect(entries[0]?.pullRequests).toBe(2);
    expect(entries[1]?.pullRequests).toBe(1);
  });

  it("stops an entry at the link footer, so the footer is not a section's prose", () => {
    const entries = parseChangelog(ENTRY);
    const last = entries.at(-1);
    expect(last?.version).toBe("9.9.8");
    for (const section of last?.sections ?? []) {
      expect(section.lines.join("\n")).not.toContain("compare/v9.9.8");
    }
  });

  it("returns nothing for text with no entry heading rather than throwing", () => {
    expect(parseChangelog("# Changelog\n\nProse only.\n")).toEqual([]);
  });

  it("derives the tag and the page path from the version, never from a stored filename", () => {
    expect(pageOf("1.17.1")).toBe("v1-17-1.md");
    expect(releasePathOf("1.17.1")).toBe("changelog/v1-17-1.md");
    expect(tagUrl("1.17.1")).toBe("https://github.com/riolabs-ai/alignsynch/releases/tag/v1.17.1");
  });

  it("is imported by the generator, not copied into it", () => {
    const generator = sourceOf("scripts/changelog-view.mjs");
    expect(generator).toContain('from "../lib/docs/changelog.ts"');
    // The parser and the two addressing helpers are the module's, so the script has no second copy.
    expect(generator).not.toMatch(/function parseChangelog/);
    expect(generator).not.toMatch(/const pageOf\s*=/);
    expect(generator).not.toMatch(/const tagOf\s*=/);
  });
});

describe("the scoped commits — the unit the features index groups", () => {
  it("reads the type, the scope, the summary, the issue and the pull request", () => {
    const commits = scopedCommits(firstEntry());
    const first = commits[0];

    expect(first).toEqual({
      version: "9.9.9",
      date: "2026-11-13",
      type: "feat",
      scope: "flow",
      summary: "a stage that walks itself",
      issue: "900",
      pullRequest: "901",
    });
  });

  it("skips a bullet that opens with no scope instead of inventing one", () => {
    const commits = scopedCommits(firstEntry());
    expect(commits.map((commit) => commit.summary)).not.toContain("a bullet with no scope at all");
    // Every commit it *does* report has a scope, because that is what it grouped on.
    expect(commits.every((commit) => commit.scope !== "")).toBe(true);
  });

  it("joins a wrapped bullet so the summary is the whole sentence", () => {
    const commits = scopedCommits(firstEntry());
    const wrapped = commits.find((commit) => commit.type === "fix");
    expect(wrapped?.summary).toBe("a wrapped commit subject that continues onto a second line");
    expect(wrapped?.issue).toBe("904");
    expect(wrapped?.pullRequest).toBeNull();
  });

  it("never classifies a Known limits bullet as a commit", () => {
    const commits = scopedCommits(firstEntry());
    expect(commits.some((commit) => commit.summary.includes("One limit"))).toBe(false);
  });
});

describe("the release rows — the record joined to the entry", () => {
  it("answers newest first, with every address derived", () => {
    const rows = releaseRows(parseChangelog(ENTRY), parseReleaseRecord(RECORD));

    expect(rows.map((row) => row.version)).toEqual(["9.9.9", "9.9.8"]);
    expect(rows[0]?.path).toBe("changelog/v9-9-9.md");
    expect(rows[0]?.href).toBe("/admin/docs/changelog/v9-9-9.md");
    expect(rows[0]?.shelfHref).toBe("/admin/docs/releases?release=9.9.9");
    expect(rows[0]?.theme).toBe("the theme of it");
    expect(rows[0]?.headline).toBe("`feat(flow)` — the headline");
    expect(rows[0]?.featureAreas).toEqual(["flow", "db-verify"]);
    expect(rows[0]?.sections).toEqual(["Added", "Fixed", "Known limits"]);
    expect(rows[0]?.hasLimits).toBe(true);
  });

  it("throws, naming the version, when the record has no row for an entry", () => {
    const record = parseReleaseRecord({ releases: [RECORD.releases[1]] });
    expect(() => releaseRows(parseChangelog(ENTRY), record)).toThrow(/9\.9\.9/);
  });

  it("marks a page the manifest does not carry, instead of linking it", () => {
    const rows = withManifestPresence(
      releaseRows(parseChangelog(ENTRY), parseReleaseRecord(RECORD)),
      [{ path: "changelog/v9-9-9.md" } as never],
    );
    expect(rows[0]?.inManifest).toBe(true);
    expect(rows[1]?.inManifest).toBe(false);
  });

  it("resolves ?release=, defaulting to the newest and answering null for a version it lacks", () => {
    const rows = releaseRows(parseChangelog(ENTRY), parseReleaseRecord(RECORD));
    expect(findRelease(rows, null)?.version).toBe("9.9.9");
    expect(findRelease(rows, "9.9.8")?.version).toBe("9.9.8");
    expect(findRelease(rows, "9.9.9")).not.toBeNull();
    expect(findRelease(rows, "1.0.0")).toBeNull();
    expect(releaseHref("1.17.1")).toBe("/admin/docs/releases?release=1.17.1");
  });

  it("refuses a record that lost a theme, or carries one version twice", () => {
    expect(() => parseReleaseRecord({ releases: [{ version: "9.9.9", headline: "x" }] })).toThrow(
      ReleaseRecordUnreadable,
    );
    expect(() =>
      parseReleaseRecord({
        releases: [
          { version: "9.9.9", theme: "a", headline: "b" },
          { version: "9.9.9", theme: "c", headline: "d" },
        ],
      }),
    ).toThrow(/two rows/);
  });
});

describe("the feature areas — grouped from the file, never listed", () => {
  it("groups feat scopes only, and counts their commits", () => {
    const areas = featureAreas(parseChangelog(ENTRY), parseReleaseRecord(RECORD), []);

    expect(areas.map((area) => area.scope)).toEqual(["flow", "db-verify", "ui"]);
    expect(areas[0]?.commits).toBe(2);
    expect(areas[0]?.releases.map((release) => release.version)).toEqual(["9.9.9"]);
    expect(areas[0]?.releases[0]?.commits).toEqual([
      "a stage that walks itself",
      "the second half of it",
    ]);
    // `fix(flow)` is not a feature, so it contributes no area of its own and no commit to flow's.
    expect(areas.find((area) => area.scope === "fix")).toBeUndefined();
  });

  it("is ordered heaviest first, with the scope as a stable tie-break", () => {
    const areas = featureAreas(parseChangelog(ENTRY), parseReleaseRecord(RECORD), []);
    expect(areas.map((area) => area.commits)).toEqual([2, 1, 1]);
    expect(areas.slice(1).map((area) => area.scope)).toEqual(["db-verify", "ui"]);
  });

  it("joins a page that names every token of the area, and excludes the changelog pages", () => {
    const docs = [
      {
        path: "specs/flow-stages.md",
        title: "Flow stages",
        question: "How many stages?",
        sectionTitle: "Specs",
      },
      {
        path: "wiki/modules/lib-flow.md",
        title: "The flow module",
        question: "Where is the flow?",
        sectionTitle: "Wiki",
      },
      {
        path: "changelog/v9-9-8.md",
        title: "v9.9.8",
        question: "What shipped?",
        sectionTitle: "Changelog",
      },
      {
        path: "operations/gate.md",
        title: "Gate",
        question: "What is the gate?",
        sectionTitle: "Operations",
      },
      {
        path: "wiki/modules/lib-db.md",
        title: "Database",
        question: "What does it store?",
        sectionTitle: "Wiki",
      },
    ].map((row) => ({ ...row, sectionId: "s", href: `/admin/docs/${row.path}` }));

    const areas = featureAreas(parseChangelog(ENTRY), parseReleaseRecord(RECORD), docs);
    const flow = areas.find((area) => area.scope === "flow");
    const dbVerify = areas.find((area) => area.scope === "db-verify");

    expect(flow?.docs.map((doc) => doc.path)).toEqual([
      "specs/flow-stages.md",
      "wiki/modules/lib-flow.md",
    ]);
    // `db-verify` needs *both* tokens: a page naming only `db` is not the page about it.
    expect(dbVerify?.docs).toEqual([]);
    // An area with no page says so rather than borrowing one.
    expect(areas.find((area) => area.scope === "ui")?.docs).toEqual([]);
  });

  it("does not match a token inside another word", () => {
    const docs = [
      {
        path: "guides/getting-started.md",
        title: "Getting started",
        question: "Where do I begin?",
        sectionTitle: "Guides",
      },
    ].map((row) => ({ ...row, sectionId: "s", href: `/admin/docs/${row.path}` }));
    const areas = featureAreas(parseChangelog(ENTRY), parseReleaseRecord(RECORD), docs);
    // `ui` is inside "guides" as a substring; it is not the word `ui`.
    expect(areas.find((area) => area.scope === "ui")?.docs).toEqual([]);
  });

  it("anchors a card at a slug the heading can carry", () => {
    expect(featureAreaAnchor("flow")).toBe("area-flow");
    expect(featureAreaAnchor("db-verify")).toBe("area-db-verify");
  });

  it("reports a release's feat commits for the shelf's area pane", () => {
    const commits = releaseFeatureCommits(parseChangelog(ENTRY), "9.9.9");
    expect(commits.map((commit) => commit.scope)).toEqual(["flow", "flow", "db-verify"]);
    expect(releaseFeatureCommits(parseChangelog(ENTRY), "0.0.1")).toEqual([]);
  });
});

describe("the tree is the source — the real files", () => {
  it("every entry in CHANGELOG.md has a row in the record, and every row a page", () => {
    const entries = realEntries();
    const rows = releaseRows(entries, realRecord());
    const manifestPaths = new Set(realDocs().map((row) => row.path));

    expect(rows.length).toBe(entries.length);
    for (const row of rows) {
      expect(manifestPaths.has(row.path), `${row.version} has no page at ${row.path}`).toBe(true);
    }
    // Newest first is the file's own order, not a sort this module invented.
    expect(rows[0]?.version).toBe(entries[0]?.version);
  });

  it("derives areas from the real file, and every area has at least one release", () => {
    const areas = featureAreas(realEntries(), realRecord(), realDocs());
    expect(areas.length).toBeGreaterThan(20);
    for (const area of areas) {
      expect(area.releases.length).toBeGreaterThan(0);
      expect(area.commits).toBe(
        area.releases.reduce((total, release) => total + release.commits.length, 0),
      );
    }
    // The heavy areas lead; the ordering is the page's, computed once.
    const counts = areas.map((area) => area.commits);
    expect([...counts].sort((a, b) => b - a)).toEqual(counts);
  });
});

describe("a release needs no edit to this feature", () => {
  it("gains an area and a shelf row from the two files alone", () => {
    const before = featureAreas(realEntries(), realRecord(), realDocs());
    expect(before.some((area) => area.scope === "zebra")).toBe(false);

    // A throwaway entry and its record row — nothing else. No component, fixture or constant moves.
    const extra = parseChangelog(
      [
        "## [99.0.0] - 2026-11-13",
        "",
        "### Added",
        "",
        "- `feat(zebra)` — a feature nobody wrote a card for (#9999)",
        "",
        "### Known limits",
        "",
        "- **None worth naming.**",
      ].join("\n"),
    );
    const record = parseReleaseRecord({
      releases: [{ version: "99.0.0", theme: "the zebra", headline: "`feat(zebra)` — stripes" }],
    });

    const after = featureAreas(
      [...extra, ...realEntries()],
      { releases: [...record.releases, ...realRecord().releases] },
      realDocs(),
    );

    const zebra = after.find((area) => area.scope === "zebra");
    expect(zebra?.commits).toBe(1);
    expect(zebra?.releases[0]?.version).toBe("99.0.0");
    // And the shelf would render it, with its derived page path.
    const rows = releaseRows([...extra, ...realEntries()], {
      releases: [...record.releases, ...realRecord().releases],
    });
    expect(rows[0]?.path).toBe("changelog/v99-0-0.md");
  });
});

describe("the pages — the gates, the selection and what renders", () => {
  it("closes on the capability before it reads a session, on both routes", async () => {
    capability.adminProduct = false;
    requireAdminSpy.mockClear();

    const { default: FeaturesPage } = await import("@/app/(mainlayout)/admin/docs/features/page");
    const { default: ReleasesPage } = await import("@/app/(mainlayout)/admin/docs/releases/page");

    const digestOf = async (run: () => Promise<unknown>): Promise<string | undefined> => {
      try {
        await run();
      } catch (error) {
        return (error as { digest?: string }).digest;
      }
      return undefined;
    };

    expect(await digestOf(async () => FeaturesPage())).toBe("NEXT_HTTP_ERROR_FALLBACK;404");
    expect(await digestOf(async () => ReleasesPage({}))).toBe("NEXT_HTTP_ERROR_FALLBACK;404");
    expect(requireAdminSpy).not.toHaveBeenCalled();
    capability.adminProduct = true;
  });

  it("answers a member with the same 404 on both routes", async () => {
    gate.role = "member";
    const { default: FeaturesPage } = await import("@/app/(mainlayout)/admin/docs/features/page");
    const { default: ReleasesPage } = await import("@/app/(mainlayout)/admin/docs/releases/page");

    const digestOf = async (run: () => Promise<unknown>): Promise<string | undefined> => {
      try {
        await run();
      } catch (error) {
        return (error as { digest?: string }).digest;
      }
      return undefined;
    };

    expect(await digestOf(async () => FeaturesPage())).toBe("NEXT_HTTP_ERROR_FALLBACK;404");
    expect(await digestOf(async () => ReleasesPage({}))).toBe("NEXT_HTTP_ERROR_FALLBACK;404");
    gate.role = "admin";
  });

  it("renders every area the record carries, with its releases and its rule", async () => {
    gate.role = "admin";
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { default: FeaturesPage } = await import("@/app/(mainlayout)/admin/docs/features/page");

    const html = renderToStaticMarkup((await FeaturesPage()) as ReactElement);
    const areas = featureAreas(realEntries(), realRecord(), realDocs());

    for (const area of areas) {
      expect(html, `${area.scope} is missing from the index`).toContain(
        `data-area="${area.scope}"`,
      );
    }
    // A release a card names links to the shelf's own address for it. `1.17.0` is a `feat` release —
    // `1.17.1` is a patch and correctly has no card, which is the derivation working.
    expect(html).toContain(`href="${releaseHref("1.17.0")}"`);
    // The derivation rule is printed, so a reader can audit the list instead of trusting it.
    expect(html).toContain("names every token of the area");
  });

  it("renders the newest release when no version is asked for, and the asked-for one otherwise", async () => {
    gate.role = "admin";
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { default: ReleasesPage } = await import("@/app/(mainlayout)/admin/docs/releases/page");

    const newest = newestRow();

    const plain = renderToStaticMarkup((await ReleasesPage({})) as ReactElement);
    expect(plain).toContain(`data-selected="true"`);
    expect(plain).toContain(`data-release-row="${newest.version}"`);

    const older = renderToStaticMarkup(
      (await ReleasesPage({
        searchParams: Promise.resolve({ release: "1.15.0" }),
      })) as ReactElement,
    );
    expect(older).toContain("1.15.0");
    expect(older).toContain(`href="${releaseHref("1.15.0")}"`);
    // The build pane is on the page: the one fact the release note cannot state.
    expect(older).toContain('data-build="true"');
  });

  it("answers notFound() for a version the record does not carry, never a fallback", async () => {
    gate.role = "admin";
    const { default: ReleasesPage } = await import("@/app/(mainlayout)/admin/docs/releases/page");

    let digest: string | undefined;
    try {
      await ReleasesPage({ searchParams: Promise.resolve({ release: "9.9.9" }) });
    } catch (error) {
      digest = (error as { digest?: string }).digest;
    }
    expect(digest).toBe("NEXT_HTTP_ERROR_FALLBACK;404");
  });
});

describe("the screens keep their promises in source", () => {
  it("reads no clock in either render path", () => {
    for (const path of [
      "app/(mainlayout)/admin/docs/features/page.tsx",
      "app/(mainlayout)/admin/docs/releases/page.tsx",
      "components/admin/docs/features-index.tsx",
      "components/admin/docs/releases-shelf.tsx",
      "lib/docs/features.ts",
      "lib/docs/releases.ts",
      "lib/docs/changelog.ts",
    ]) {
      expect(sourceOf(path), `${path} reads a clock`).not.toMatch(/new Date\(|Date\.now\(/);
    }
  });

  it("keeps the two derivations pure — no filesystem, no network", () => {
    for (const path of ["lib/docs/features.ts", "lib/docs/releases.ts", "lib/docs/changelog.ts"]) {
      const source = sourceOf(path);
      expect(source, `${path} imports node:fs`).not.toMatch(/from "node:fs"/);
      expect(source, `${path} fetches`).not.toMatch(/\bfetch\(/);
    }
  });

  it("is the only reader of the two files", () => {
    // One parser, one record: the module the script imports and the module the tree reads.
    const tree = sourceOf("lib/docs/tree.ts");
    expect(tree).toContain('from "@/lib/docs/changelog"');
    expect(tree).toContain("parseReleaseRecord");

    const features = sourceOf("lib/docs/features.ts");
    // No second copy of the CHANGELOG regexes: the derivations import the parser's output.
    expect(features).not.toMatch(/ENTRY_HEADING|## \\\[/);
    expect(features).toContain('from "@/lib/docs/changelog"');
  });
});
