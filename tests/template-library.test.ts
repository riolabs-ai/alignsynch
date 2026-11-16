/**
 * The template library's rules — the half that outlived its screens (#794, #1109).
 *
 * `/templates/relationship`, its authoring form and its read-only detail page were retired in
 * #1109: every action they carried lives on `/dashboard/templates[?tab=mine]` and
 * `/dashboard/templates/<id>`, and the three addresses answer a 308. So the cases here are the ones
 * whose subjects are still live code:
 *
 *   the author rule   `authorshipOf` / `canUseTemplate` — what `lib/flow/templates.ts` asks before
 *                     a status write, and what every member read filters on.
 *   the filters       `filterLibrary` / `libraryStateOf` / `parseLibrary*` — pure functions in
 *                     `lib/flow/template-library.ts`, and `archiveTargetOf` beside them.
 *
 * **What went with the pages, and where it is covered now.** The rendered-library cases, the
 * detail page's 307 canonicalisation and the per-row archive/duplicate/delete controls were that
 * page's; the two writes they exercised are the dashboard's copy band and retire band now — the
 * card and the tab are pinned by `tests/member-templates-tabs.test.ts`, and the retire refusals by
 * `archiveMyTemplate` / `deleteMyTemplate` in `lib/member/templates.ts` (live-checked by
 * `pnpm db:verify`).
 */
import { describe, expect, it } from "vitest";

import {
  authorshipOf,
  archiveTargetOf,
  canUseTemplate,
  filterLibrary,
  libraryStateOf,
  parseLibraryStatus,
  parseLibraryView,
  type LibraryTemplate,
} from "@/lib/flow/template-library";

const ACCOUNT_A = "account-a-avery";
const ACCOUNT_B = "account-b-rowan";

/** A built-in: no author, so the platform's. */
const builtIn: LibraryTemplate = {
  id: "assessment-relationship-basics",
  slug: "relationship-basics",
  title: "Relationship Basics",
  summary: "Relationship Type: Personal — Time, housework, money, conflict, affection.",
  status: "published",
  createdAt: "2026-10-01T09:00:00.000Z",
  aspectCount: 5,
  instanceCount: 2,
  authorship: "built-in",
};

/** A template account A wrote. */
const authoredByA: LibraryTemplate = {
  id: "assessment-6f1d-authored",
  slug: "our-quarterly-check-in",
  title: "Our Quarterly Check-In",
  summary: "Written in the app: 3 Aspects, each with a Left and a Right Value.",
  status: "published",
  createdAt: "2026-10-20T11:30:00.000Z",
  aspectCount: 3,
  instanceCount: 1,
  authorship: "mine",
};

/** The same row, archived — the state the archive action produces and unarchive reverses. */
const archivedByA: LibraryTemplate = {
  ...authoredByA,
  id: "assessment-archived-authored",
  slug: "last-years-check-in",
  title: "Last Year's Check-In",
  status: "archived",
  instanceCount: 4,
};

describe("the author rule", () => {
  it("reads a NULL author as the platform's, and a missing one the same way", () => {
    expect(authorshipOf(null, ACCOUNT_A)).toBe("built-in");
    expect(authorshipOf(undefined, ACCOUNT_A)).toBe("built-in");
    expect(authorshipOf("", ACCOUNT_A)).toBe("built-in");
    expect(authorshipOf(null, null)).toBe("built-in");
  });

  it("reads the viewer's own id as mine, and another account's as other", () => {
    expect(authorshipOf(ACCOUNT_A, ACCOUNT_A)).toBe("mine");
    expect(authorshipOf(ACCOUNT_A, ACCOUNT_B)).toBe("other");
    expect(authorshipOf(ACCOUNT_A, null)).toBe("other");
  });

  it("lets every account use a built-in and only its author use an authored template", () => {
    expect(canUseTemplate(null, ACCOUNT_A)).toBe(true);
    expect(canUseTemplate(null, null)).toBe(true);
    expect(canUseTemplate(ACCOUNT_A, ACCOUNT_A)).toBe(true);
    expect(canUseTemplate(ACCOUNT_A, ACCOUNT_B)).toBe(false);
    // Signed out is nobody: an authored template is not a public one.
    expect(canUseTemplate(ACCOUNT_A, null)).toBe(false);
  });
});

describe("the tabs are filters over the rows the account may use", () => {
  const rows = [builtIn, authoredByA, archivedByA];
  const all = { view: "all", status: "all", query: "" } as const;

  it("leaves exactly the account's own under Mine", () => {
    expect(filterLibrary(rows, { ...all, view: "mine" }).map((row) => row.id)).toEqual([
      authoredByA.id,
      archivedByA.id,
    ]);
  });

  it("leaves exactly the platform's under Built-in", () => {
    expect(filterLibrary(rows, { ...all, view: "built-in" }).map((row) => row.id)).toEqual([
      builtIn.id,
    ]);
  });

  it("narrows by status and by a case-insensitive title search", () => {
    expect(filterLibrary(rows, { ...all, status: "archived" }).map((row) => row.id)).toEqual([
      archivedByA.id,
    ]);
    expect(filterLibrary(rows, { ...all, query: "QUARTERLY" }).map((row) => row.id)).toEqual([
      authoredByA.id,
    ]);
    expect(filterLibrary(rows, { ...all, query: "  check-in  " })).toHaveLength(2);
  });

  it("never draws a row belonging to another account, whatever the tab", () => {
    const theirs: LibraryTemplate = { ...authoredByA, authorship: "other" };
    expect(filterLibrary([theirs], { ...all, view: "all" })).toHaveLength(0);
    expect(filterLibrary([theirs], { ...all, view: "mine" })).toHaveLength(0);
  });

  it("tells an empty library apart from a filter that matched nothing", () => {
    expect(libraryStateOf([], [])).toBe("empty");
    expect(libraryStateOf(rows, [])).toBe("no-match");
    expect(libraryStateOf(rows, rows)).toBe("list");
  });

  it("asks a row's archive control for the state the row is not in", () => {
    expect(archiveTargetOf("published")).toBe("archived");
    expect(archiveTargetOf("archived")).toBe("published");
    expect(archiveTargetOf("draft")).toBe("archived");
  });

  it("falls back to `all` for a query parameter it does not know", () => {
    expect(parseLibraryView("mine")).toBe("mine");
    expect(parseLibraryView("built-in")).toBe("built-in");
    expect(parseLibraryView("theirs")).toBe("all");
    expect(parseLibraryView(undefined)).toBe("all");
    expect(parseLibraryStatus("archived")).toBe("archived");
    expect(parseLibraryStatus("draft")).toBe("all");
  });
});
