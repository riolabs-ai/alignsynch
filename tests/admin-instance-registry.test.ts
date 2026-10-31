/**
 * The admin registry's derivation and its four filters (console card 3/5), driven without a
 * request, a database or React.
 *
 * Two things are being pinned, and they are different kinds of claim:
 *
 *   1. **The filters filter.** Each axis is asserted by the row ids it keeps, not by a count that
 *      a second bug could satisfy — the failure this catches is a filter that renders but matches
 *      nothing, which is exactly what an operator would not notice on a quiet database.
 *   2. **A row cannot carry an opinion.** `AdminInstanceRow` is the whole of what crosses to the
 *      browser, and the assertion is over its *keys*: adding a `feel`, a `gap` or an
 *      `answered` field to that type fails this test, which is the cheap way to keep "admins see
 *      the stage, not the answers" from becoming a comment nobody reads.
 *
 * The stage cases go through `stageOf()` rather than restating its arithmetic: an aligned
 * instance is one whose Gaps meet its Setting (Soft tolerates 1, Full does not), so the two
 * assertions below are the same facts the report draws.
 */
import { describe, expect, it } from "vitest";

import { gapOf } from "@/content/record";
import type { AspectOpinions } from "@/lib/admin/instance-registry";
import {
  aspectGapsOf,
  filterRegistry,
  NO_FILTER,
  registryRowOf,
  seatStateOf,
  type AdminInstanceRow,
  type RegistryFacts,
} from "@/lib/admin/instance-registry";

const NOW = new Date("2026-10-31T12:00:00.000Z");
const YESTERDAY = new Date("2026-10-30T12:00:00.000Z");
const LAST_WEEK = new Date("2026-10-24T12:00:00.000Z");

/** A one-Aspect opinion pair whose Feel Gap is `left - right` in points. */
function pair(itemId: string, left: number, right: number): AspectOpinions {
  return {
    itemId,
    initiator: { feel: left, wish: left },
    counterparty: { feel: right, wish: right },
  };
}

const AGREED = aspectGapsOf([pair("aspect-trust", 4, 4)]);
const ONE_POINT = aspectGapsOf([pair("aspect-trust", 4, 5)]);

/** The facts of one instance, defaulted to a claimed, complete, Basic/Soft relationship. */
function facts(overrides: Partial<RegistryFacts> = {}): RegistryFacts {
  return {
    instanceRecordId: "assessment-instance-avery-rowan",
    slug: "avery-rowan",
    name: null,
    templateTitle: "Parent & Child",
    mode: "basic",
    setting: "soft",
    aspectCount: 1,
    initiatorAnswered: 1,
    counterpartyAnswered: 1,
    initiator: { name: "Avery", hasAccount: true },
    counterparty: { name: "Rowan", hasAccount: true },
    invite: null,
    created: LAST_WEEK,
    lastActivity: YESTERDAY,
    ...overrides,
  };
}

describe("a seat's identity state", () => {
  it("is `claimed` when an account holds the seat, and carries that seat's name", () => {
    expect(seatStateOf({ name: "Avery", hasAccount: true }, null, NOW)).toEqual({
      state: "claimed",
      name: "Avery",
    });
  });

  it("is `seat` for a party row with no account — the seeded dataset, not a claim", () => {
    expect(seatStateOf({ name: "Ruth", hasAccount: false }, null, NOW)).toEqual({
      state: "seat",
      name: "Ruth",
    });
  });

  it("is `invited` before the invitation's expiry and `expired` at it", () => {
    const invite = { claimed: false, expiresAt: new Date("2026-10-31T12:00:00.000Z") };
    expect(seatStateOf(null, invite, new Date("2026-10-31T11:59:59.000Z")).state).toBe("invited");
    // `<=`, the same instant `claimInvite` refuses: a screen never offers a dead link.
    expect(seatStateOf(null, invite, invite.expiresAt).state).toBe("expired");
  });

  it("is `none` when there is neither a seat nor an invitation", () => {
    expect(seatStateOf(null, null, NOW)).toEqual({ state: "none", name: null });
  });

  it("never prints the invitation's own name — an unclaimed seat draws no person", () => {
    const row = seatStateOf(
      null,
      { claimed: false, expiresAt: new Date("2026-10-31T13:00:00.000Z") },
      NOW,
    );
    expect(row.state).toBe("invited");
    expect(row.name).toBeNull();
  });
});

describe("the derived stage", () => {
  it("is `invited` with no counterparty seat, whatever the counts say", () => {
    const row = registryRowOf(facts({ counterparty: null, counterpartyAnswered: 0 }), [], NOW);
    expect(row.stage).toBe("invited");
    expect(row.status).toBe("awaiting_counterparty");
    expect(row.stalled).toBe(false);
  });

  it("is `connected` once the seat exists and the sheet is unfinished", () => {
    const row = registryRowOf(facts({ counterpartyAnswered: 0 }), [], NOW);
    expect(row.stage).toBe("connected");
    expect(row.status).toBe("answering");
  });

  it("is `aligned` when every Gap meets the Setting, and `sharing` when one does not", () => {
    expect(registryRowOf(facts(), AGREED, NOW).stage).toBe("aligned");
    // A 1-point Gap is within Soft and outside Full — the Setting is a lens, so the same
    // answers are two stages.
    expect(registryRowOf(facts({ setting: "soft" }), ONE_POINT, NOW).stage).toBe("aligned");
    expect(registryRowOf(facts({ setting: "full" }), ONE_POINT, NOW).stage).toBe("sharing");
  });

  it("is `stalled` only for a Counterparty invitation that expired unclaimed", () => {
    expect(registryRowOf(facts(), AGREED, NOW).stalled).toBe(false);
    const stalled = registryRowOf(
      facts({
        counterparty: null,
        counterpartyAnswered: 0,
        invite: { claimed: false, expiresAt: new Date("2026-10-25T12:00:00.000Z") },
      }),
      [],
      NOW,
    );
    expect(stalled.stage).toBe("invited");
    expect(stalled.invite).toBe("expired");
    expect(stalled.stalled).toBe(true);
  });

  it("names the relationship by its own name when it has one, the template's title when not", () => {
    expect(registryRowOf(facts({ name: "Avery & Rowan, October" }), AGREED, NOW).name).toBe(
      "Avery & Rowan, October",
    );
    expect(registryRowOf(facts({ name: null }), AGREED, NOW).name).toBe("Parent & Child");
  });
});

describe("the row is what an operator may see, and nothing else", () => {
  it("carries no opinion, score, Gap or answered count", () => {
    const row = registryRowOf(facts(), ONE_POINT, NOW);
    expect(Object.keys(row).sort()).toEqual(
      [
        "counterparty",
        "created",
        "initiator",
        "instanceRecordId",
        "invite",
        "lastActivity",
        "mode",
        "name",
        "setting",
        "slug",
        "stage",
        "stalled",
        "status",
        "templateTitle",
      ].sort(),
    );
    // The scores that produced the stage are not on the row anywhere: `gapOf(4, 5)` is 1, and
    // no field of a JSON-serialised row carries 1 as a score (the counts a complete row has are
    // not serialised either — `status` is the vocabulary, not the arithmetic).
    const serialised = JSON.stringify(row);
    expect(serialised).not.toContain('"feel"');
    expect(serialised).not.toContain('"guess"');
    expect(serialised).not.toContain('"gap"');
    expect(serialised).not.toContain('"answered"');
  });
});

describe("the four filters", () => {
  const rows: AdminInstanceRow[] = [
    registryRowOf(
      facts({
        instanceRecordId: "i1",
        slug: "invited-live",
        counterparty: null,
        counterpartyAnswered: 0,
        invite: { claimed: false, expiresAt: new Date("2026-11-05T12:00:00.000Z") },
      }),
      [],
      NOW,
    ),
    registryRowOf(
      facts({
        instanceRecordId: "i2",
        slug: "invited-stalled",
        counterparty: null,
        counterpartyAnswered: 0,
        invite: { claimed: false, expiresAt: new Date("2026-10-26T12:00:00.000Z") },
      }),
      [],
      NOW,
    ),
    registryRowOf(
      facts({
        instanceRecordId: "i3",
        slug: "connected-advanced",
        mode: "advanced",
        counterpartyAnswered: 0,
      }),
      [],
      NOW,
    ),
    registryRowOf(
      facts({ instanceRecordId: "i4", slug: "sharing-full", setting: "full" }),
      ONE_POINT,
      NOW,
    ),
    registryRowOf(facts({ instanceRecordId: "i5", slug: "aligned-soft" }), AGREED, NOW),
  ];

  const ids = (filter: Parameters<typeof filterRegistry>[1]) =>
    filterRegistry(rows, filter).map((row) => row.slug);

  it("keeps every row with no filter, in the read's own order", () => {
    expect(ids(NO_FILTER)).toEqual([
      "invited-live",
      "invited-stalled",
      "connected-advanced",
      "sharing-full",
      "aligned-soft",
    ]);
  });

  it("filters by stage, one stage at a time", () => {
    expect(ids({ ...NO_FILTER, stage: "invited" })).toEqual(["invited-live", "invited-stalled"]);
    expect(ids({ ...NO_FILTER, stage: "connected" })).toEqual(["connected-advanced"]);
    expect(ids({ ...NO_FILTER, stage: "sharing" })).toEqual(["sharing-full"]);
    expect(ids({ ...NO_FILTER, stage: "aligned" })).toEqual(["aligned-soft"]);
  });

  it("filters by mode and by Setting", () => {
    expect(ids({ ...NO_FILTER, mode: "advanced" })).toEqual(["connected-advanced"]);
    expect(ids({ ...NO_FILTER, mode: "basic" })).toHaveLength(4);
    expect(ids({ ...NO_FILTER, setting: "full" })).toEqual(["sharing-full"]);
    expect(ids({ ...NO_FILTER, setting: "soft" })).toHaveLength(4);
  });

  it("filters to the stalled invitation — the row no other axis singles out", () => {
    expect(ids({ ...NO_FILTER, stalled: true })).toEqual(["invited-stalled"]);
  });

  it("combines axes, so an impossible combination returns nothing rather than everything", () => {
    expect(ids({ ...NO_FILTER, stage: "aligned", mode: "advanced" })).toEqual([]);
    expect(ids({ ...NO_FILTER, stage: "connected", stalled: true })).toEqual([]);
  });

  it("has a Gap in one Aspect reported as a share, not as a score, in the stage", () => {
    // The same row under two Settings: `sharing` vs `aligned` is the only thing the screen can
    // say about `gapOf(4, 5) === 1`, and it says it without a number.
    expect(gapOf(4, 5)).toBe(1);
    expect(registryRowOf(facts({ setting: "full" }), ONE_POINT, NOW).stage).toBe("sharing");
  });
});
