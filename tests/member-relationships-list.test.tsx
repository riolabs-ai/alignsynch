/**
 * `/dashboard/relationships` as the record list — the shell #841 part 2 adds (#841 part 2).
 *
 * What this file holds is the shell's promises, and they are the ones a reader notices when they
 * break: the six tabs and **the counts that match the rows behind them**, the default view being
 * `All` so a draft is visible without a click (the assertion #850's `flow:e2e` took green — a
 * default that hid a draft would break it silently), the heading with its create action, and the
 * toolbar's search matching the relationship's own title **and** the other party's name.
 *
 * Two things are deliberately *not* asserted here. The per-row menu's items render in a Radix
 * portal, so they are absent from a static render — `tests/member-relationship-cards.test.ts` owns
 * the card and pins the reason the trigger carries. And the filter/search behaviour is asserted
 * through `visibleRelationships`, the pure function the component calls, because this tree has no
 * interaction-testing dependency and a DOM rig for one search field would be the wrong trade.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: React.ReactNode }) =>
    createElement("a", { href, ...rest }, children),
}));

import {
  RelationshipsList,
  statusCount,
  visibleRelationships,
  type StatusFilter,
} from "@/components/dashboard/relationships-list";
import { dashboardRelationshipsPageCopy } from "@/data/pages/dashboard-relationships";
import type { MemberRelationshipRow } from "@/lib/member/relationships";
import { itemLabel, sectionOf } from "@/lib/page-copy";

const copy = dashboardRelationshipsPageCopy;

/** One row, in the shape `listMyRelationships()` hands the page. */
function row(overrides: Partial<MemberRelationshipRow> & { id: string }): MemberRelationshipRow {
  return {
    status: "draft",
    viewerRole: "initiator",
    isInitiator: true,
    templateId: "member-config-abc123",
    templateSlug: "member-config-abc123",
    title: "The template this was copied from",
    summary: "",
    createdAt: "2026-11-10T12:00:00.000Z",
    publishedAt: null,
    sessionRecordId: null,
    aspectCount: 6,
    invite: null,
    counterpartyName: null,
    initiatorName: null,
    view: "not-published",
    membership: { state: "open", reason: null, endedAt: null, writable: true },
    ...overrides,
  };
}

/**
 * Five stored states the six tabs filter, plus a `pending` row that has **no tab of its own** —
 * it must still appear under `All`, which is what proves a tab is never invented for a state the
 * artifact does not name.
 */
const rows: MemberRelationshipRow[] = [
  row({
    id: "rel-draft",
    relationshipTitle: "Weekly check-in",
    createdAt: "2026-11-10T12:00:00.000Z",
  }),
  row({
    id: "rel-published",
    status: "published",
    relationshipTitle: "Quarterly reset",
    counterpartyName: "Rowan Ellis",
    createdAt: "2026-11-11T12:00:00.000Z",
    publishedAt: "2026-11-11T13:00:00.000Z",
    sessionRecordId: "session-published",
    view: "invite-live",
    invite: { claimed: false, revoked: false, expiresAt: new Date("2026-12-01T12:00:00.000Z") },
  }),
  row({
    id: "rel-running",
    status: "active",
    viewerRole: "counterparty",
    isInitiator: false,
    relationshipTitle: "Team offsite",
    initiatorName: "Daniel Park",
    counterpartyName: null,
    createdAt: "2026-11-09T12:00:00.000Z",
    publishedAt: "2026-11-09T13:00:00.000Z",
    sessionRecordId: "session-running",
    view: "invite-claimed",
  }),
  row({
    id: "rel-complete",
    status: "complete",
    relationshipTitle: "Onboarding plan",
    counterpartyName: "Ada Okafor",
    createdAt: "2026-11-08T12:00:00.000Z",
    publishedAt: "2026-11-08T13:00:00.000Z",
    sessionRecordId: "session-complete",
    view: "invite-claimed",
  }),
  row({
    id: "rel-expired",
    status: "expired",
    relationshipTitle: "Family budget",
    counterpartyName: "Rowan Ellis",
    createdAt: "2026-11-05T12:00:00.000Z",
    publishedAt: "2026-11-05T13:00:00.000Z",
    sessionRecordId: "session-expired",
    view: "invite-expired",
    membership: { state: "lapsed", reason: "trial-ended", endedAt: null, writable: false },
  }),
  row({
    id: "rel-pending",
    status: "pending",
    relationshipTitle: "Ready to publish",
    createdAt: "2026-11-07T12:00:00.000Z",
  }),
];

function render(list: readonly MemberRelationshipRow[] = rows): string {
  return renderToStaticMarkup(
    createElement(RelationshipsList, {
      copy,
      rows: list,
      templates: [],
      onCreate: () => Promise.resolve({ ok: false, code: "failed" } as never),
      unreadable: null,
    }),
  );
}

/** The markup of one tab, split on the attribute Radix puts on every trigger. */
function tabChunks(html: string): string[] {
  return html.split('role="tab"').slice(1);
}

describe("the relationships list", () => {
  it("draws the six tabs the owner approved, each with the number of rows behind it", () => {
    const chunks = tabChunks(render());
    expect(chunks).toHaveLength(6);

    const expected: { label: string; count: number }[] = [
      { label: "All", count: 6 },
      { label: "Drafts", count: 1 },
      { label: "Published", count: 1 },
      { label: "Running", count: 1 },
      { label: "Complete", count: 1 },
      { label: "Expired", count: 1 },
    ];
    chunks.forEach((chunk, index) => {
      const tab = expected[index];
      expect(chunk).toContain(tab.label);
      expect(chunk).toMatch(
        new RegExp(`<span class="[^"]*tabular-nums[^"]*">${String(tab.count)}</span>`),
      );
    });
  });

  it("defaults to All, so a draft is on the page without a click (#850's assertion)", () => {
    const html = render();
    expect(html).toContain("Weekly check-in");
    expect(html).toContain('data-relationship-card="rel-draft"');
    // Every row is drawn on the default view — including the `pending` one no tab names.
    for (const one of rows) expect(html).toContain(`data-relationship-card="${one.id}"`);
    // …and the tab that is selected is `All`, not a filter that happens to include it.
    expect(tabChunks(html)[0]).toContain('aria-selected="true"');
  });

  it("carries the create action in the header, the search field and the view toggle", () => {
    const html = render();
    expect(html).toContain("Start a relationship");
    expect(html).toContain('placeholder="Search your relationships…"');
    expect(html).toContain("Grid view");
    expect(html).toContain("List view");
    expect(html).toContain("All statuses");
  });

  it("draws the no-relationships sentence when the read returned nothing", () => {
    const html = render([]);
    expect(html).toContain("No relationships yet");
    expect(html).not.toContain("data-relationship-card=");
  });

  it("counts a tab as the rows that carry that stored status", () => {
    const cases: [StatusFilter, number][] = [
      ["all", 6],
      ["draft", 1],
      ["published", 1],
      ["active", 1],
      ["complete", 1],
      ["expired", 1],
    ];
    for (const [status, count] of cases) expect(statusCount(rows, status)).toBe(count);
  });
});

describe("the kind a relationship card names (#874)", () => {
  /**
   * The card's kind chip — the tone-`tint` label that says what the row *is*. Read off its own
   * hook rather than off the whole render, because the card carries five chips and the defect
   * was specifically the first one's word.
   */
  function kindChip(html: string): string {
    const match = html.match(/<span[^>]*data-relationship-kind="([^"]+)"[^>]*>([\s\S]*?)<\/span>/);
    if (match === null) throw new Error("a card drew no chip carrying the kind hook");
    return match[2];
  }

  it("says Relationship on every card, on both seats", () => {
    const html = render();
    expect(kindChip(html)).toBe("Relationship");
    // Every row's own card, not just the first: the chip is the card's, so a row that drew a
    // different word would be a second defect behind the same assertion.
    for (const one of rows) {
      const from = html.slice(html.indexOf(`data-relationship-card="${one.id}"`));
      expect(kindChip(from), one.id).toBe("Relationship");
    }
  });

  it("never prints the word Template as a kind", () => {
    const html = render();
    expect(kindChip(html)).not.toBe("Template");
    // The old defect in full: the word appeared as a chip on every card in the list.
    expect(html).not.toContain(">Template<");
  });

  it("resolves the word from the fixture's kind table, not from a copy key on the card", () => {
    // The chip's word is the **value** of the kind the list lists, spelled once in `data/pages`.
    expect(itemLabel(sectionOf(copy, "kind"), "relationship")).toBe("Relationship");
    // …and the `card` section no longer carries an item naming the concept the chip borrowed —
    // the item that shipped as `{ id: "template", label: "Template" }` is what read as a kind.
    const cardItemIds = (sectionOf(copy, "card").items ?? []).map((item) => item.id);
    expect(cardItemIds).not.toContain("template");
  });
});

describe("what the toolbar and the tabs select", () => {
  const ids = (list: readonly MemberRelationshipRow[]) => list.map((one) => one.id);

  it("searches the relationship's own title, not the template it was copied from", () => {
    expect(
      ids(visibleRelationships(rows, { status: "all", query: "weekly", order: "newest" })),
    ).toEqual(["rel-draft"]);
    // The template title every row was copied from is on none of the cards' headings.
    expect(
      visibleRelationships(rows, { status: "all", query: "copied from", order: "newest" }),
    ).toEqual([]);
  });

  it("searches the other party's name, on both seats", () => {
    // An initiator's row knows its counterparty; a counterparty's row knows the initiator.
    // Two rows name Rowan, newest first.
    expect(
      ids(visibleRelationships(rows, { status: "all", query: "rowan", order: "newest" })),
    ).toEqual(["rel-published", "rel-expired"]);
    expect(
      ids(visibleRelationships(rows, { status: "all", query: "daniel", order: "newest" })),
    ).toEqual(["rel-running"]);
  });

  it("filters on the stored status, and All keeps the states no tab names", () => {
    expect(
      ids(visibleRelationships(rows, { status: "published", query: "", order: "newest" })),
    ).toEqual(["rel-published"]);
    expect(
      ids(visibleRelationships(rows, { status: "all", query: "", order: "newest" })),
    ).toContain("rel-pending");
    for (const status of [
      "draft",
      "published",
      "active",
      "complete",
      "expired",
    ] as StatusFilter[]) {
      expect(
        visibleRelationships(rows, { status, query: "", order: "newest" }).every(
          (one) => one.status === status,
        ),
      ).toBe(true);
    }
  });

  it("orders by the instant the row was started, newest first unless asked otherwise", () => {
    const newest = ids(visibleRelationships(rows, { status: "all", query: "", order: "newest" }));
    const oldest = ids(visibleRelationships(rows, { status: "all", query: "", order: "oldest" }));
    expect(newest[0]).toBe("rel-published");
    expect(newest.at(-1)).toBe("rel-expired");
    expect(oldest).toEqual([...newest].reverse());
  });
});
