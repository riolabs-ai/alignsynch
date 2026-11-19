/**
 * `/dashboard/relationships` as the v2 list — the second screen of the shell (#1129, bundle 05).
 *
 * What this file holds is the shell's promises, and they are the ones a reader notices when they
 * break: the five filter chips and **the counts that match the rows behind them**, the default view
 * being `All` so a draft is visible without a click (the assertion #850's `flow:e2e` took green — a
 * default that hid a draft would break it silently), the heading with its create action, the toolbar's
 * search matching the relationship's own title **and** the other party's name, and every card
 * carrying one of the four state words rather than a stored lifecycle value.
 *
 * **The vocabulary changed with #1129 and the counts moved with it.** The six stored-lifecycle tabs
 * are now the bundle's five filter handles — All · Live · Waiting · Drafts · Paused — so `active`
 * and `complete` share a filter, `draft` and `pending` share one, and `expired` prints `Paused`.
 * `All` counts what the grid can draw, which is every row except a `void` one.
 *
 * **The filter row and the card chip do not print the same words, deliberately.** Bundle 05 draws
 * `Live · Waiting · Drafts · Paused` in the row and `Stage 6 Live · Waiting on Invite · Draft ·
 * Paused` on the card, and the correction of 2026-11-19 moved this screen's row onto the bundle's
 * handles. So the chip assertions below (`rel-running` reads `Stage 6 Live`) and the filter
 * assertions (the second chip reads `Live`) are two different strings on purpose; a reader who
 * "fixed" one of them to match the other would undo the rectification.
 *
 * Two things are deliberately *not* asserted here. The card's own states are pinned by
 * `tests/start-next-steps.test.ts` (the mapping) and `tests/member-relationship-cards.test.ts` (the
 * chrome). And the filter/search behaviour is asserted through `visibleRelationships`, the pure
 * function the component calls, because this tree has no interaction-testing dependency and a DOM
 * rig for one search field would be the wrong trade.
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
  stateCount,
  stateFilterOf,
  visibleRelationships,
  type StateFilter,
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
  } as MemberRelationshipRow;
}

/**
 * Every stored state the five chips cover, plus a `pending` row — it has no chip of its own and
 * prints as **Draft**, which is the mapping #1129 introduced.
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
      summaries: {},
      templates: [],
      unreadable: null,
    }),
  );
}

/** The markup of one chip, split on the attribute every filter button carries. */
function chipChunks(html: string): string[] {
  return html.split('role="tab"').slice(1);
}

describe("the relationships list", () => {
  it("draws the five filter chips the bundle draws, each with the number of rows behind it", () => {
    const chunks = chipChunks(render());
    expect(chunks).toHaveLength(5);

    const expected: { label: string; count: number }[] = [
      { label: "All", count: 6 },
      // `active` and `complete` are one filter — bundle 05's handle, `Live`, over the card's
      // `Stage 6 Live`.
      { label: "Live", count: 2 },
      { label: "Waiting", count: 1 },
      // `draft` and `pending` are one filter, and the bundle pluralises it.
      { label: "Drafts", count: 2 },
      { label: "Paused", count: 1 },
    ];
    chunks.forEach((chunk, index) => {
      const chip = expected[index];
      expect(chunk).toContain(chip.label);
      expect(chunk).toMatch(
        new RegExp(`<span class="[^"]*tabular-nums[^"]*">${String(chip.count)}</span>`),
      );
    });
  });

  it("defaults to All, so a draft is on the page without a click (#850's assertion)", () => {
    const html = render();
    expect(html).toContain("Weekly check-in");
    expect(html).toContain('data-relationship-card="rel-draft"');
    // Every drawable row is on the default view — including the `pending` one, which is a Draft.
    for (const one of rows) expect(html).toContain(`data-relationship-card="${one.id}"`);
    // …and the chip that is selected is `All`, not a filter that happens to include it.
    expect(chipChunks(html)[0]).toContain('aria-selected="true"');
  });

  it("carries the create action in the header, the search field and the sort select", () => {
    const html = render();
    expect(html).toContain("Start a relationship");
    expect(html).toContain('placeholder="Search your relationships…"');
    expect(html).toContain("Newest");
  });

  it("draws the no-relationships empty state and sends the reader to the Library (#1129)", () => {
    const html = render([]);
    expect(html).toContain("No Relationships Yet");
    expect(html).toContain("Pick a template, invite one person, and see where you agree.");
    expect(html).toContain("Browse Templates");
    expect(html).toContain('href="/dashboard/templates?tab=library"');
    expect(html).toContain('data-relationships-empty-action="browse"');
    expect(html).not.toContain('data-relationships-empty-action="reset"');
    expect(html).not.toContain("data-relationship-card=");
  });

  it("draws Nothing Matches with Show All when rows exist but the filter hides them", () => {
    // `?filter=paused` over a list with no paused row: the bundle's second empty state.
    const html = renderToStaticMarkup(
      createElement(RelationshipsList, {
        copy,
        rows: rows.filter((one) => one.status !== "expired"),
        summaries: {},
        templates: [],
        unreadable: null,
        initialFilter: "paused",
      }),
    );
    expect(html).toContain("Nothing Matches");
    expect(html).toContain("Try another filter or search.");
    expect(html).toContain("Show All");
    expect(html).toContain('data-relationships-empty-action="reset"');
    expect(html).toContain('href="/dashboard/relationships"');
    expect(html).toContain('data-relationships-empty="filter"');
    expect(html).not.toContain("Browse Templates");
  });

  it("reads ?filter= as a chip, and anything else as All", () => {
    expect(stateFilterOf("paused")).toBe("paused");
    expect(stateFilterOf(["draft", "live"])).toBe("draft");
    expect(stateFilterOf(undefined)).toBe("all");
    expect(stateFilterOf("rubber")).toBe("all");
    // The deep link lands on the chip, not on a second default.
    const html = renderToStaticMarkup(
      createElement(RelationshipsList, {
        copy,
        rows,
        summaries: {},
        templates: [],
        unreadable: null,
        initialFilter: stateFilterOf("paused"),
      }),
    );
    const paused = chipChunks(html).find((chunk) =>
      chunk.includes('data-relationships-state="paused"'),
    );
    expect(paused).toContain('aria-selected="true"');
    expect(chipChunks(html)[0]).toContain('aria-selected="false"');
  });

  it("counts a chip as the rows that draw as that state", () => {
    const cases: [StateFilter, number][] = [
      ["all", 6],
      ["live", 2],
      ["waiting", 1],
      ["draft", 2],
      ["paused", 1],
    ];
    for (const [state, count] of cases) expect(stateCount(rows, state)).toBe(count);
  });

  it("draws the failure panel, and no figure, when the read did not answer", () => {
    const html = renderToStaticMarkup(
      createElement(RelationshipsList, {
        copy,
        rows: [],
        summaries: {},
        templates: [],
        unreadable: "connection refused",
      }),
    );
    expect(html).toContain("Your relationships could not be read");
    expect(html).toContain("connection refused");
    expect(html).not.toContain('role="tab"');
  });
});

describe("the word a relationship card carries (#1129)", () => {
  /** The slice of the render that belongs to one row's card. */
  function cardOf(html: string, id: string): string {
    const from = html.indexOf(`data-relationship-card="${id}"`);
    if (from < 0) throw new Error(`${id} drew no card`);
    return html.slice(from);
  }

  it("prints one of the four state words on every card, never a stored lifecycle value", () => {
    const html = render();
    const expected: Record<string, string> = {
      "rel-draft": "Draft",
      "rel-published": "Waiting on Invite",
      "rel-running": "Stage 6 Live",
      "rel-complete": "Stage 6 Live",
      "rel-expired": "Paused",
      "rel-pending": "Draft",
    };
    for (const [id, word] of Object.entries(expected)) {
      const card = cardOf(html, id);
      expect(card, id).toContain(word);
      // The stored value is never what the reader sees.
      for (const stored of ["published", "expired", "pending", "complete", "active"]) {
        expect(card, `${id} prints the stored value "${stored}"`).not.toMatch(
          new RegExp(`>${stored}<`, "i"),
        );
      }
    }
  });

  it("resolves the four words from this screen's own fixture, not from a copy key on the card", () => {
    const words = sectionOf(copy, "card-v2");
    expect(itemLabel(words, "live")).toBe("Stage 6 Live");
    expect(itemLabel(words, "waiting")).toBe("Waiting on Invite");
    expect(itemLabel(words, "draft")).toBe("Draft");
    expect(itemLabel(words, "paused")).toBe("Paused");
    // The old card's kind table is still published, and the v2 card does not read it.
    const cardItemIds = (sectionOf(copy, "card").items ?? []).map((item) => item.id);
    expect(cardItemIds).not.toContain("template");
  });
});

describe("what the toolbar and the chips select", () => {
  const ids = (list: readonly MemberRelationshipRow[]) => list.map((one) => one.id);

  it("searches the relationship's own title, not the template it was copied from", () => {
    expect(
      ids(visibleRelationships(rows, { state: "all", query: "weekly", order: "newest" })),
    ).toEqual(["rel-draft"]);
    // The template title every row was copied from is on none of the cards' headings.
    expect(
      visibleRelationships(rows, { state: "all", query: "copied from", order: "newest" }),
    ).toEqual([]);
  });

  it("searches the other party's name, on both seats", () => {
    // An initiator's row knows its counterparty; a counterparty's row knows the initiator.
    // Two rows name Rowan, newest first.
    expect(
      ids(visibleRelationships(rows, { state: "all", query: "rowan", order: "newest" })),
    ).toEqual(["rel-published", "rel-expired"]);
    expect(
      ids(visibleRelationships(rows, { state: "all", query: "daniel", order: "newest" })),
    ).toEqual(["rel-running"]);
  });

  it("filters on the state a row draws as, and All keeps every drawable row", () => {
    expect(
      ids(visibleRelationships(rows, { state: "waiting", query: "", order: "newest" })),
    ).toEqual(["rel-published"]);
    // `pending` has no chip of its own and is a Draft, so the Draft chip holds both.
    expect(ids(visibleRelationships(rows, { state: "draft", query: "", order: "newest" }))).toEqual(
      ["rel-draft", "rel-pending"],
    );
    expect(ids(visibleRelationships(rows, { state: "all", query: "", order: "newest" }))).toContain(
      "rel-pending",
    );
  });

  it("orders by the instant the row was started, newest first unless asked otherwise", () => {
    const newest = ids(visibleRelationships(rows, { state: "all", query: "", order: "newest" }));
    const oldest = ids(visibleRelationships(rows, { state: "all", query: "", order: "oldest" }));
    expect(newest[0]).toBe("rel-published");
    expect(newest.at(-1)).toBe("rel-expired");
    expect(oldest).toEqual([...newest].reverse());
  });
});
