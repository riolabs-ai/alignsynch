/**
 * `/assessment/templates` — built-in vs authored, per account (#console 5/5).
 *
 * The card's four claims, each one a test:
 *
 *   * **the author rule is one function.** `authorshipOf` / `canUseTemplate`: `NULL` is a
 *     built-in, the viewer's id is "mine", anything else is somebody else's and usable by nobody.
 *     A template written before `0011_console_columns.sql` has `NULL` and is therefore a
 *     built-in — the third case the screen has to be honest about.
 *   * **the tab is a filter, not a second read.** `view=mine` over the rows the account may use
 *     leaves exactly its own; `view=built-in` leaves exactly the platform's.
 *   * **the three states render as themselves** — built-ins only, built-ins + own, and nothing at
 *     all — with distinct markers, so a state is assertable without reading prose.
 *   * **the detail page is read-only and 404s a stranger's template.**
 *
 * The page modules are driven directly (the same way `tests/my-instances.test.ts` drives its
 * route): `currentUser` and the two reads are mocked, so these cases prove the page's decisions
 * without a database, and the live proof against real rows is the acceptance run in the PR.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { matchRoute } from "@/content/route-manifest";
import { routeManifest } from "@/content/routes";
import { templateDetailPageCopy } from "@/data/pages/assessment-template-detail";
import { templateLibraryPageCopy } from "@/data/pages/assessment-templates";
import type { LibraryTemplateDetail } from "@/lib/db/template-library";
import { TEMPLATE_LIBRARY_PATH, templateDetailPath } from "@/lib/flow/paths";
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

const { redirect, notFound, currentUser, listLibraryTemplates, readLibraryTemplate } = vi.hoisted(
  () => ({
    redirect: vi.fn((to: string): never => {
      throw new Error(`NEXT_REDIRECT:${to}`);
    }),
    notFound: vi.fn((): never => {
      throw new Error("NEXT_NOT_FOUND");
    }),
    currentUser: vi.fn(
      async (): Promise<{ userId: string; email: string; name: string } | null> => null,
    ),
    listLibraryTemplates: vi.fn(async (_userId: string | null): Promise<LibraryTemplate[]> => []),
    readLibraryTemplate: vi.fn(
      async (_id: string, _userId: string | null): Promise<LibraryTemplateDetail | undefined> =>
        undefined,
    ),
  }),
);

vi.mock("next/navigation", () => ({ redirect, notFound }));
vi.mock("@/lib/auth/session", () => ({ currentUser }));
vi.mock("@/lib/db/template-library", () => ({ listLibraryTemplates, readLibraryTemplate }));

import TemplateLibraryPage from "@/app/(mainlayout)/assessment/templates/page";
import TemplateDetailPage from "@/app/(mainlayout)/assessment/templates/[templateId]/page";

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

function asSignedIn(userId: string): void {
  currentUser.mockResolvedValue({ userId, email: "avery@example.test", name: "Avery" });
}

async function renderLibrary(params: Record<string, string> = {}): Promise<string> {
  return renderToStaticMarkup(await TemplateLibraryPage({ searchParams: Promise.resolve(params) }));
}

async function renderDetail(templateId: string): Promise<string> {
  return renderToStaticMarkup(
    await TemplateDetailPage({ params: Promise.resolve({ templateId }) }),
  );
}

/** The rows the render drew, by the ids it stamped on them. */
function renderedRowIds(html: string): string[] {
  return [...html.matchAll(/data-template-row="([^"]+)"/g)].map((match) => match[1]);
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser.mockResolvedValue(null);
  listLibraryTemplates.mockResolvedValue([]);
  readLibraryTemplate.mockResolvedValue(undefined);
});

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

describe("the page", () => {
  it("registers a path the manifest can match, in both directions", () => {
    expect(TEMPLATE_LIBRARY_PATH).toBe("/assessment/templates");
    expect(matchRoute(routeManifest, TEMPLATE_LIBRARY_PATH)?.kind).toBe("static");
    expect(matchRoute(routeManifest, templateDetailPath("assessment-x"))?.kind).toBe("dynamic");
  });

  it("sends a signed-out visitor to /login with this path preserved", async () => {
    await expect(renderLibrary()).rejects.toThrow(
      "NEXT_REDIRECT:/login?next=%2Fassessment%2Ftemplates",
    );
    expect(listLibraryTemplates).not.toHaveBeenCalled();
  });

  it("reads with the session's own id and nothing else", async () => {
    asSignedIn(ACCOUNT_A);
    await renderLibrary();
    expect(listLibraryTemplates).toHaveBeenCalledWith(ACCOUNT_A);
  });

  it("draws the built-ins-only state: the four built-ins, no Mine row", async () => {
    asSignedIn(ACCOUNT_B);
    listLibraryTemplates.mockResolvedValue([builtIn]);
    const html = await renderLibrary();

    expect(renderedRowIds(html)).toEqual([builtIn.id]);
    expect(html).toContain('data-template-authorship="built-in"');
    expect(html).not.toContain('data-template-authorship="mine"');
    expect(html).not.toContain("data-template-library-empty");
  });

  it("draws the built-ins + own state, and Mine leaves only the account's rows", async () => {
    asSignedIn(ACCOUNT_A);
    listLibraryTemplates.mockResolvedValue([builtIn, authoredByA, archivedByA]);

    const all = await renderLibrary();
    expect(renderedRowIds(all)).toEqual([builtIn.id, authoredByA.id, archivedByA.id]);

    const mine = await renderLibrary({ view: "mine" });
    expect(renderedRowIds(mine)).toEqual([authoredByA.id, archivedByA.id]);

    const builtIns = await renderLibrary({ view: "built-in" });
    expect(renderedRowIds(builtIns)).toEqual([builtIn.id]);
  });

  it("offers archive on an own row and unarchive on an archived one, and neither on a built-in", async () => {
    asSignedIn(ACCOUNT_A);
    listLibraryTemplates.mockResolvedValue([builtIn, authoredByA, archivedByA]);
    const html = await renderLibrary();

    const rowOf = (id: string) => {
      const rows = html.match(/<tr[^>]*data-template-row="[^"]+"[\s\S]*?<\/tr>/g) ?? [];
      const found = rows.find((row) => row.includes(`data-template-row="${id}"`));
      if (found === undefined) throw new Error(`no rendered row ${id}`);
      return found.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
    };

    expect(rowOf(builtIn.id)).not.toContain("Archive");
    expect(rowOf(builtIn.id)).toContain("Duplicate");
    expect(rowOf(authoredByA.id)).toContain("Archive");
    expect(rowOf(archivedByA.id)).toContain("Unarchive");
  });

  it("draws the empty state when the account may use no template at all", async () => {
    asSignedIn(ACCOUNT_A);
    listLibraryTemplates.mockResolvedValue([]);
    const html = await renderLibrary();

    expect(html).toContain("data-template-library-empty");
    expect(renderedRowIds(html)).toEqual([]);
  });

  it("draws the no-match state when a search excludes everything", async () => {
    asSignedIn(ACCOUNT_A);
    listLibraryTemplates.mockResolvedValue([builtIn, authoredByA]);
    const html = await renderLibrary({ q: "nothing called this" });

    expect(html).toContain("data-template-library-no-match");
    expect(html).not.toContain("data-template-library-empty");
    expect(renderedRowIds(html)).toEqual([]);
  });

  it("names a write's notice from the record, never from the query string", async () => {
    asSignedIn(ACCOUNT_A);
    listLibraryTemplates.mockResolvedValue([builtIn, authoredByA]);

    const known = await renderLibrary({ archived: authoredByA.id });
    expect(known).toContain('data-template-library-notice="archived"');
    expect(known).toContain("Our Quarterly Check-In");

    const crafted = await renderLibrary({ archived: "<script>alert(1)</script>" });
    expect(crafted).not.toContain("data-template-library-notice");
    expect(crafted).not.toContain("<script>alert(1)</script>");
  });

  it("says that a template with no author reads as a built-in", async () => {
    asSignedIn(ACCOUNT_A);
    listLibraryTemplates.mockResolvedValue([builtIn]);
    const html = await renderLibrary();
    expect(html).toContain("data-template-library-legacy");
    expect(html).toContain("no author on its row");
  });
});

describe("the detail page", () => {
  const detail: LibraryTemplateDetail = {
    template: authoredByA,
    aspects: [
      {
        id: "aspect-1",
        position: 1,
        prompt: "How much of the load do I carry at home?",
        leftValue: "All of it",
        rightValue: "None of it",
      },
    ],
  };

  it("sends a signed-out visitor to /login, and 404s a template it may not read", async () => {
    await expect(renderDetail(authoredByA.id)).rejects.toThrow("NEXT_REDIRECT");

    asSignedIn(ACCOUNT_B);
    readLibraryTemplate.mockResolvedValue(undefined);
    await expect(renderDetail(authoredByA.id)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(readLibraryTemplate).toHaveBeenCalledWith(authoredByA.id, ACCOUNT_B);
  });

  it("draws a template's Aspects with their Values", async () => {
    asSignedIn(ACCOUNT_A);
    readLibraryTemplate.mockResolvedValue(detail);
    const html = await renderDetail(authoredByA.id);

    expect(html).toContain('data-template-aspect="aspect-1"');
    expect(html).toContain("How much of the load do I carry at home?");
    expect(html).toContain("Left Value: All of it");
    expect(html).toContain("Right Value: None of it");
    expect(html).not.toContain("data-template-detail-archived");
  });

  it("says what archiving did, and offers no way to start an instance from it", async () => {
    asSignedIn(ACCOUNT_A);
    readLibraryTemplate.mockResolvedValue({
      template: { ...authoredByA, status: "archived" },
      aspects: detail.aspects,
    });
    const html = await renderDetail(authoredByA.id);

    expect(html).toContain("data-template-detail-archived");
    expect(html).toContain("keeps its own copy of the Aspects");
    expect(html).not.toContain("Start an instance");
    expect(html).toContain("Unarchive");
  });
});

describe("the copy the two pages read", () => {
  it("carries every section and item the components ask for", () => {
    const librarySections = [
      "list",
      "tabs",
      "status",
      "search",
      "columns",
      "row",
      "legacy",
      "create",
      "empty",
      "no-match",
      "notice",
      "unavailable",
    ];
    for (const id of librarySections) {
      expect(
        templateLibraryPageCopy.sections?.some((section) => section.id === id),
        `library fixture is missing section ${id}`,
      ).toBe(true);
    }

    const detailSections = ["back", "facts", "aspects", "actions", "archive-note"];
    for (const id of detailSections) {
      expect(
        templateDetailPageCopy.sections?.some((section) => section.id === id),
        `detail fixture is missing section ${id}`,
      ).toBe(true);
    }
  });
});
