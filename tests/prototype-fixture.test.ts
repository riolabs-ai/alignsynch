/**
 * The prototype fixture's own arithmetic (#console cohort 1) — the screen's numbers, proved against
 * the rows they claim to count.
 *
 * The card's rule is that every figure on `/prototype/admin` is a count of the fixture rows, never a
 * percentage and never a composite. A `PageCopy` sentence cannot prove that, and a screenshot cannot
 * either: both would show whatever the arrays happen to say. So the numbers are asserted here —
 * against hand-written filters, not against `countsOf` calling itself — and a row added to
 * `data/prototypes/console.ts` either moves the figures with it or fails this file.
 *
 * Three more things this pins, each of which would rot silently:
 *
 *   - **the ladder is the model's.** `PROTOTYPE_STAGES` is a local list (the fixture may not import
 *     the content module's graph), so it is compared with `content/stages.ts` — a fifth stage there
 *     and the fixture stops being a picture of this product.
 *   - **a stage agrees with its seats.** `invited` means the counterparty has not claimed; everything
 *     past it means both seats are accounts. A screen that showed "Aligned" beside an empty seat
 *     would be a defect the reviewer inherits.
 *   - **the attention band is 3 to 5 rows**, ordered quietest first, and every row in it satisfies
 *     one of the two stated reasons.
 */
import { describe, expect, it } from "vitest";

import { RELATIONSHIP_STAGES } from "@/content/stages";
import {
  attentionRows,
  awaitingInvitationSeats,
  countsOf,
  daysIdle,
  isComplete,
  needsAttention,
  PROTOTYPE_STAGES,
  prototypeAttentionRows,
  prototypeCounts,
  prototypeRelationships,
  prototypeTemplates,
  prototypeScreens,
  SEAT_STATES,
  STALE_DAYS,
  templateById,
  type PrototypeSeatState,
} from "@/data/prototypes/console";

describe("the population", () => {
  it("is six relationships across the four stages, and four templates", () => {
    expect(prototypeRelationships).toHaveLength(6);
    expect(prototypeTemplates).toHaveLength(4);
    expect(new Set(prototypeRelationships.map((row) => row.id)).size).toBe(6);
    expect(new Set(prototypeTemplates.map((row) => row.id)).size).toBe(4);
  });

  it("uses the model's ladder, in the model's order", () => {
    expect([...PROTOTYPE_STAGES]).toEqual([...RELATIONSHIP_STAGES]);
  });

  it("reaches every stage at least once", () => {
    for (const stage of PROTOTYPE_STAGES) {
      expect(
        prototypeRelationships.some((row) => row.stage === stage),
        `no prototype relationship is at "${stage}"`,
      ).toBe(true);
    }
  });

  it("joins every relationship to a template in the library", () => {
    for (const relationship of prototypeRelationships) {
      expect(templateById(relationship.templateId).id).toBe(relationship.templateId);
    }
    // The authored template is used by a relationship, so no library row is unreachable.
    const used = new Set(prototypeRelationships.map((row) => row.templateId));
    expect(prototypeTemplates.filter((template) => !used.has(template.id))).toEqual([]);
  });

  it("agrees with itself about seats: `invited` is the only stage with an unclaimed counterparty", () => {
    for (const relationship of prototypeRelationships) {
      expect(SEAT_STATES as readonly PrototypeSeatState[]).toContain(
        relationship.counterparty.state,
      );
      // A seat carries a name only when an account claimed it (`data/pages/admin-instances.ts`).
      for (const seat of [relationship.initiator, relationship.counterparty]) {
        expect(seat.name === null).toBe(seat.state !== "claimed");
      }
      if (relationship.stage === "invited") {
        expect(relationship.counterparty.state).not.toBe("claimed");
      } else {
        expect(relationship.counterparty.state).toBe("claimed");
      }
    }
  });

  it("dates every instant at or before the fixture clock", () => {
    for (const relationship of prototypeRelationships) {
      const idle = daysIdle(relationship.lastActivity);
      expect(Number.isInteger(idle)).toBe(true);
      expect(idle, `${relationship.id} is dated after DEMO_NOW_ISO`).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("the four figures", () => {
  it("are the lengths of filters over those rows — not a percentage, not a composite", () => {
    const relationships = prototypeRelationships;
    const templates = prototypeTemplates;

    expect(prototypeCounts.relationships).toBe(relationships.length);
    expect(prototypeCounts.byStage).toEqual({
      invited: relationships.filter((row) => row.stage === "invited").length,
      connected: relationships.filter((row) => row.stage === "connected").length,
      sharing: relationships.filter((row) => row.stage === "sharing").length,
      aligned: relationships.filter((row) => row.stage === "aligned").length,
    });
    // The split adds up to the population it claims to be a split of.
    expect(Object.values(prototypeCounts.byStage).reduce((sum, count) => sum + count, 0)).toBe(
      relationships.length,
    );

    expect(prototypeCounts.awaitingInvitation).toBe(
      relationships
        .flatMap((row) => [row.initiator, row.counterparty])
        .filter((seat) => seat.state === "unclaimed" || seat.state === "expired").length,
    );
    expect(prototypeCounts.awaitingInvitation).toBe(awaitingInvitationSeats(relationships).length);

    expect(prototypeCounts.templates).toBe(templates.length);
    expect(prototypeCounts.builtInTemplates).toBe(
      templates.filter((template) => template.builtIn).length,
    );
    expect(prototypeCounts.authoredTemplates).toBe(
      templates.filter((template) => !template.builtIn).length,
    );
    expect(prototypeCounts.builtInTemplates + prototypeCounts.authoredTemplates).toBe(
      prototypeCounts.templates,
    );

    // "Complete" is the model's own line: both parties submitted, which is Sharing and Aligned
    // (`content/stages.ts::STAGES_BEFORE_COMPLETE`), never a new threshold invented here.
    expect(prototypeCounts.complete).toBe(
      relationships.filter((row) => row.stage === "sharing" || row.stage === "aligned").length,
    );
    expect(prototypeCounts.complete).toBe(relationships.filter(isComplete).length);
  });

  it("computes the same figures for any input, so the screen is not reading a recording", () => {
    const one = prototypeRelationships.slice(0, 1);
    expect(countsOf(one, prototypeTemplates).relationships).toBe(1);
    expect(countsOf(one, []).templates).toBe(0);
    expect(countsOf([], []).byStage).toEqual({ invited: 0, connected: 0, sharing: 0, aligned: 0 });
  });
});

describe("the attention band", () => {
  it("holds three to five rows for this fixture", () => {
    expect(prototypeAttentionRows.length).toBeGreaterThanOrEqual(3);
    expect(prototypeAttentionRows.length).toBeLessThanOrEqual(5);
  });

  it("selects a row for one of the two stated reasons, and no other row", () => {
    for (const relationship of prototypeRelationships) {
      const seatWaiting = [relationship.initiator, relationship.counterparty].some(
        (seat) => seat.state === "unclaimed" || seat.state === "expired",
      );
      const quiet = daysIdle(relationship.lastActivity) >= STALE_DAYS;
      expect(needsAttention(relationship)).toBe(seatWaiting || quiet);
    }
  });

  it("orders the rows quietest first", () => {
    const idles = prototypeAttentionRows.map((row) => daysIdle(row.lastActivity));
    expect(idles).toEqual([...idles].sort((left, right) => right - left));
  });

  it("is a filter over the same array `countsOf` reads", () => {
    expect(attentionRows(prototypeRelationships)).toEqual(prototypeAttentionRows);
  });
});

describe("the index's records", () => {
  it("names the one screen that exists, with the route it stands in for", () => {
    expect(prototypeScreens).toEqual([
      { id: "admin", href: "/prototype/admin", eventualRoute: "/admin" },
    ]);
  });
});
