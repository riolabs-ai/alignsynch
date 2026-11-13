/**
 * `/assessments` — the member's assessment sessions, and they are the caller's own (#877).
 *
 * Five claims, each one a line of a card:
 *
 *   * signed out, the page redirects to `/login?next=/assessments` and the intended path survives
 *     the round trip (`loginPathFor` is shell-free, so it runs here);
 *   * signed in, the read is called with the session's own user id — the account the auth server
 *     resolved, never a name, a `searchParams` value or a header, and never a role;
 *   * the listing moved: `/assessments` is a static route in the manifest and
 *     `/assessment/instances` is not a route any more (it is the redirect `route-redirects.test.ts`
 *     asserts), while the session's own screen did not move;
 *   * a row is one session and its destinations are addresses that already exist — the session, the
 *     assessment it was copied from, the relationship, and its Gap **only** once both parties have
 *     accepted;
 *   * the shell's narrowings only narrow: the state tabs count the rows behind them, the search
 *     matches the session and its two parties, and a filter that keeps nothing says so in its own
 *     words rather than looking like an empty account.
 */
import { createElement } from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { matchRoute } from "@/content/route-manifest";
import { ROUTE_PATTERNS, routeManifest } from "@/content/routes";
import { assessmentsPageCopy } from "@/data/pages/assessments";
import type { RelationshipCard } from "@/lib/db/assessments";
import type { OverviewFilter } from "@/lib/flow/overview";
import { instancePath, MY_ASSESSMENTS_PATH, reportPath } from "@/lib/flow/paths";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: React.ReactNode }) =>
    createElement("a", { href, ...rest }, children),
}));

const { redirect, currentUser, listRelationshipCards } = vi.hoisted(() => ({
  redirect: vi.fn((to: string): never => {
    throw new Error(`NEXT_REDIRECT:${to}`);
  }),
  currentUser: vi.fn(
    async (): Promise<{ userId: string; email: string; name: string } | null> => null,
  ),
  listRelationshipCards: vi.fn(async (_userId: string): Promise<RelationshipCard[]> => []),
}));

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/lib/auth/session", () => ({ currentUser }));
vi.mock("@/lib/db/assessments", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db/assessments")>();
  // Only the read is stubbed: `relationshipCardFromRow` is the pure half and is driven directly,
  // which is the point of splitting them.
  return { ...actual, listRelationshipCards };
});

import MyAssessmentsPage from "@/app/(mainlayout)/assessments/page";
import {
  AssessmentsList,
  SESSION_STATES,
  stateCount,
  visibleAssessments,
} from "@/components/dashboard/assessments-list";

beforeEach(() => {
  vi.clearAllMocks();
  currentUser.mockResolvedValue(null);
  listRelationshipCards.mockResolvedValue([]);
});

/**
 * A card as the read produces it: every figure derived, none authored.
 *
 * `alignment` is the one field that can be `null` while the relationship is complete — a session
 * whose opinions do not parse measures nothing — so the default row carries a real mean Gap and
 * the awaiting case below carries none.
 */
function cardOf(overrides: Partial<RelationshipCard> = {}): RelationshipCard {
  return {
    relationshipId: "relationship-assessment-instance-avery-rowan",
    instanceRecordId: "assessment-instance-avery-rowan",
    slug: "avery-rowan",
    name: "Relationship Basics",
    templateTitle: "Relationship Basics",
    templateSlug: "spouses",
    mode: "basic",
    viewerRole: "initiator",
    initiatorName: "Avery",
    counterpartyName: "Rowan",
    stage: "sharing",
    state: "complete",
    unlock: "seen",
    inviteState: null,
    aspectCount: 5,
    sessionsOpened: 1,
    sessionsCompleted: 1,
    alignment: 1.4,
    paid: { plan: null, purchasedAt: null },
    lastSessionAt: "2026-10-28T18:30:00.000Z",
    ...overrides,
  };
}

const completeRow = cardOf();

/** The viewer has answered every Aspect, the session is not complete, so the other has not. */
const awaitingRow = cardOf({
  relationshipId: "relationship-assessment-instance-marco-priya",
  instanceRecordId: "assessment-instance-marco-priya",
  slug: "marco-priya-1a2b3c4d",
  name: "Staff & Manager",
  templateTitle: "Staff & Manager",
  templateSlug: "staff-manager",
  counterpartyName: "Priya",
  stage: "connected",
  state: "awaiting-other",
  sessionsCompleted: 0,
  alignment: null,
});

/** A session this reader still owes answers on — the third state. */
const askingRow = cardOf({
  relationshipId: "relationship-assessment-instance-jo-sam",
  instanceRecordId: "assessment-instance-jo-sam",
  slug: "jo-sam-9f8e7d",
  name: "Siblings",
  templateTitle: "Siblings",
  templateSlug: "siblings",
  counterpartyName: "Sam",
  stage: "connected",
  state: "yours-to-answer",
  sessionsCompleted: 0,
  alignment: null,
});

async function render(params: Record<string, string> = {}): Promise<string> {
  return renderToStaticMarkup(await MyAssessmentsPage({ searchParams: Promise.resolve(params) }));
}

function listOf(rows: readonly RelationshipCard[], filter: OverviewFilter | null = null) {
  return renderToStaticMarkup(
    createElement(AssessmentsList, { copy: assessmentsPageCopy, rows, filter, unreadable: null }),
  );
}

/** The rendered text: tags dropped, whitespace collapsed. Digits in a class name are not copy. */
function textOf(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

describe("the route is the plural listing, and the manifest agrees", () => {
  it("registers `/assessments`, so E10 may emit it and E7 agrees with app/", () => {
    expect(MY_ASSESSMENTS_PATH).toBe("/assessments");
    expect(matchRoute(routeManifest, MY_ASSESSMENTS_PATH)?.kind).toBe("static");
  });

  it("retires `/assessment/instances` as a page — the redirect owns that address now", () => {
    expect(ROUTE_PATTERNS).not.toContain("/assessment/instances");
    // The session's own screen did not move, and neither did its report.
    expect(ROUTE_PATTERNS).toContain("/assessment/instances/[instanceId]");
    expect(ROUTE_PATTERNS).toContain("/assessment/instances/[instanceId]/report");
  });
});

describe("signed out", () => {
  it("redirects to the login page with this path preserved", async () => {
    await expect(render()).rejects.toThrow("NEXT_REDIRECT:/login?next=%2Fassessments");
    expect(redirect).toHaveBeenCalledWith("/login?next=%2Fassessments");
    expect(listRelationshipCards).not.toHaveBeenCalled();
  });
});

describe("signed in", () => {
  it("reads with the session's own user id and nothing else", async () => {
    currentUser.mockResolvedValue({
      userId: "52dfe892-be03-421b-ac34-1b35d74633dc",
      email: "initiator@demo.alignsynch.test",
      name: "Avery",
    });
    listRelationshipCards.mockResolvedValue([completeRow]);

    const html = await render();

    expect(listRelationshipCards).toHaveBeenCalledTimes(1);
    expect(listRelationshipCards).toHaveBeenCalledWith("52dfe892-be03-421b-ac34-1b35d74633dc");
    expect(html).toContain('data-assessments-list="true"');
    expect(html).toContain(assessmentsPageCopy.heading ?? "");
  });

  it("names no role in the path — an admin sees their own sessions and no one else's", () => {
    const source = readFileSync("app/(mainlayout)/assessments/page.tsx", "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/[^\n]*/gm, "$1");
    for (const forbidden of ["user_profile", "role", "params.q", "params.stage"]) {
      expect(source, `the page reads ${forbidden}`).not.toContain(forbidden);
    }
  });
});

describe("a read that does not answer is a panel", () => {
  it("draws the failure panel with the layer's sentence, not a digest", async () => {
    currentUser.mockResolvedValue({
      userId: "52dfe892-be03-421b-ac34-1b35d74633dc",
      email: "initiator@demo.alignsynch.test",
      name: "Avery",
    });
    const { DatabaseUnavailableError } = await import("@/lib/db/client");
    listRelationshipCards.mockRejectedValueOnce(
      new DatabaseUnavailableError("the connection was closed"),
    );

    const html = await render();

    expect(html).toContain('data-assessments-unreadable="true"');
    expect(html).toContain("the connection was closed");
    expect(html).not.toContain('data-assessments-list="true"');
  });

  it("keeps throwing on anything else — a row that fails the model is a defect", async () => {
    currentUser.mockResolvedValue({
      userId: "52dfe892-be03-421b-ac34-1b35d74633dc",
      email: "initiator@demo.alignsynch.test",
      name: "Avery",
    });
    listRelationshipCards.mockRejectedValueOnce(new Error("schema drift"));

    await expect(render()).rejects.toThrow("schema drift");
  });
});

describe("the row's destinations are the ones that already exist", () => {
  it("links the session, the assessment, the relationship, and the Gap on a complete row", () => {
    const html = listOf([completeRow]);

    expect(html).toContain(`href="${instancePath(completeRow.instanceRecordId)}"`);
    expect(html).toContain(`data-assessment-template="${completeRow.templateSlug}"`);
    expect(html).toContain(`data-assessment-relationship-link="${completeRow.relationshipId}"`);
    expect(html).toContain(`data-assessment-gap="${completeRow.instanceRecordId}"`);
    expect(html).toContain(`href="${reportPath(completeRow.instanceRecordId)}"`);
  });

  it("draws no Gap door before both parties have accepted — the report is locked then", () => {
    const html = listOf([awaitingRow]);

    expect(html).not.toContain("data-assessment-gap");
    // The session screen is still the way in.
    expect(html).toContain(`data-assessment-session-link="${awaitingRow.instanceRecordId}"`);
  });

  it("links each row's own record, never its neighbour's", () => {
    const html = listOf([completeRow, awaitingRow]);

    for (const row of [completeRow, awaitingRow]) {
      expect(html).toContain(`data-assessment-session="${row.instanceRecordId}"`);
      expect(html).toContain(`data-assessment-relationship="${row.relationshipId}"`);
    }
    // Two rows, one Gap door.
    expect((html.match(/data-assessment-gap=/g) ?? []).length).toBe(1);
  });
});

describe("the shell's narrowings only narrow", () => {
  it("counts the rows behind each tab, and `all` counts every row", () => {
    const rows = [completeRow, awaitingRow, askingRow];

    expect(stateCount(rows, "all")).toBe(3);
    expect(stateCount(rows, "complete")).toBe(1);
    expect(stateCount(rows, "awaiting-other")).toBe(1);
    expect(stateCount(rows, "yours-to-answer")).toBe(1);
    expect(SESSION_STATES).toEqual(["yours-to-answer", "awaiting-other", "complete"]);
  });

  it("filters by state, searches the session and both parties, and orders by instant", () => {
    const rows = [completeRow, awaitingRow, askingRow];

    expect(
      visibleAssessments(rows, { state: "complete", query: "", order: "newest" }).map(
        (row) => row.instanceRecordId,
      ),
    ).toEqual([completeRow.instanceRecordId]);

    expect(
      visibleAssessments(rows, { state: "all", query: "priya", order: "newest" }).map(
        (row) => row.instanceRecordId,
      ),
    ).toEqual([awaitingRow.instanceRecordId]);

    expect(
      visibleAssessments(rows, { state: "all", query: "Siblings", order: "newest" }).map(
        (row) => row.instanceRecordId,
      ),
    ).toEqual([askingRow.instanceRecordId]);

    expect(
      visibleAssessments(rows, { state: "all", query: "", order: "oldest" }).map(
        (row) => row.instanceRecordId,
      ),
    ).toEqual([
      completeRow.instanceRecordId,
      awaitingRow.instanceRecordId,
      askingRow.instanceRecordId,
    ]);
  });

  it("prints a count per tab in the rendered list", () => {
    const html = listOf([completeRow, awaitingRow]);
    expect(textOf(html)).toContain("All assessments 2");
    expect(textOf(html)).toContain("Gap ready 1");
  });

  it("narrows to the console's one list, and says which list it is", async () => {
    currentUser.mockResolvedValue({
      userId: "52dfe892-be03-421b-ac34-1b35d74633dc",
      email: "initiator@demo.alignsynch.test",
      name: "Avery",
    });
    listRelationshipCards.mockResolvedValue([completeRow, awaitingRow]);

    const html = await render({ filter: "awaiting-other" });

    expect(html).toContain('data-assessments-filter="awaiting-other"');
    expect(html).toContain(`data-assessment-session="${awaitingRow.instanceRecordId}"`);
    expect(html).not.toContain(`data-assessment-session="${completeRow.instanceRecordId}"`);
  });

  it("treats an unknown filter as no narrowing, never as an empty page that claims one", async () => {
    currentUser.mockResolvedValue({
      userId: "52dfe892-be03-421b-ac34-1b35d74633dc",
      email: "initiator@demo.alignsynch.test",
      name: "Avery",
    });
    listRelationshipCards.mockResolvedValue([completeRow, awaitingRow]);

    const html = await render({ filter: "not-a-filter" });

    expect(html).not.toContain("data-assessments-filter");
    expect(html).toContain(`data-assessment-session="${completeRow.instanceRecordId}"`);
    expect(html).toContain(`data-assessment-session="${awaitingRow.instanceRecordId}"`);
  });
});

describe("two empty states, and they are different sentences", () => {
  it("says nobody has started one when the read returned no rows", () => {
    const html = listOf([]);
    const text = textOf(html);

    expect(html).toContain('data-assessments-empty="all"');
    expect(text).toContain("You are not in a relationship yet");
    expect(text).not.toContain("No session matches this view");
  });

  it("says the console's list is empty rather than claiming the account is", () => {
    // A reader who arrived from `?filter=reports-open` and has no such session has relationships;
    // "You are not in a relationship yet" would be false about them.
    const html = listOf([awaitingRow], "reports-open");
    const text = textOf(html);

    expect(html).toContain('data-assessments-empty="filter-list"');
    expect(text).toContain("Nothing in this list right now");
    expect(text).not.toContain("You are not in a relationship yet");
  });
});

describe("what a row may say", () => {
  it("draws the marker only on a complete row this reader has not opened since", () => {
    const unseen = cardOf({ unlock: "unseen" });

    expect(listOf([unseen])).toContain('data-assessment-marker="unseen"');
    expect(listOf([completeRow])).not.toContain("data-assessment-marker");
    expect(listOf([awaitingRow])).not.toContain("data-assessment-marker");
  });

  it("prints `—` for a relationship with no session open, never a division by zero", () => {
    const never = cardOf({ sessionsOpened: 0, sessionsCompleted: 0, alignment: null });
    const text = textOf(listOf([never]));

    expect(text).toContain("— Sessions");
    expect(text).toContain("No scored session yet");
    expect(text).not.toContain("NaN");
    expect(text).not.toContain("0.0");
  });
});
