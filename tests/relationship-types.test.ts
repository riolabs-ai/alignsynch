/**
 * The relationship catalogue's gate (#385) — a `purchasable` field is not enough.
 *
 * The card's rule is "no dating type reaches the catalogue, the shop or the review list", and it
 * is proven as the *negative* case, not assumed: a dating row whose flag is seeded back to
 * `true` must still be blocked. The gate is `isPurchasable`, which is `purchasable` **and** not
 * in `EXCLUDED_TYPE_IDS` — the deny-list is what makes a flipped flag harmless. Every surface
 * (the catalogue, the shop's type picker, the review list) reads `purchasableRelationshipTypes`,
 * which is `relationshipTypes.filter(isPurchasable)`, so one gate covers all three.
 */
import { describe, expect, it } from "vitest";

import { zOpinions, type Opinions } from "@/content/assessment";
import { gapKindsIn, gapKindsOf } from "@/content/gaps";
import {
  demoAnswersByType,
  isPurchasable,
  purchasableRelationshipTypes,
  purchasableTypesByRealm,
  relationshipTypes,
  type RelationshipType,
} from "@/data/v1/relationship-types";

const DATING_IDS = ["girlfriend-boyfriend", "dating", "committed-significant-others"] as const;

describe("the relationship catalogue (#385)", () => {
  it("carries the 29 source rows plus the kept co-founders", () => {
    // 29 rows from §1 (26 purchasable + 3 dating) plus `co-founders`, kept per §4.
    expect(relationshipTypes).toHaveLength(30);
  });

  it("marks 26 source rows purchasable and the three dating rows not", () => {
    const purchasable = relationshipTypes.filter((type) => type.purchasable);
    // 26 source "yes" rows + the kept co-founders.
    expect(purchasable).toHaveLength(27);

    const excluded = relationshipTypes.filter((type) => !type.purchasable);
    expect(excluded.map((type) => type.id).sort()).toEqual([...DATING_IDS].sort());
    for (const type of excluded) {
      expect(type.aspects).toHaveLength(0);
    }
  });

  it("reconciles without duplicating — the six shipped keys map onto the source, never beside it", () => {
    const ids = new Set(relationshipTypes.map((type) => type.id));
    // partners → business-partners; coworkers → colleagues; project-teammates → team; family →
    // parent-child plus variants. The pre-reconciliation keys must be gone.
    for (const gone of ["partners", "coworkers", "project-teammates", "family"]) {
      expect(ids.has(gone), `"${gone}" should be reconciled away`).toBe(false);
    }
    for (const kept of ["business-partners", "colleagues", "team", "co-founders", "friends"]) {
      expect(ids.has(kept), `"${kept}" should be kept`).toBe(true);
    }
  });

  it("keeps the dating set out of the catalogue, the shop and the review list", () => {
    const purchasableIds = new Set(purchasableRelationshipTypes.map((type) => type.id));
    for (const id of DATING_IDS) {
      expect(purchasableIds.has(id)).toBe(false);
    }
  });

  it("blocks a dating type even when its purchasable flag is seeded true — the negative case", () => {
    const dating = relationshipTypes.find((type) => type.id === "dating");
    expect(dating).toBeDefined();
    // A dating row that somehow flips its flag still cannot pass the gate.
    const seeded: RelationshipType = { ...(dating as RelationshipType), purchasable: true };
    expect(seeded.purchasable).toBe(true);
    expect(isPurchasable(seeded)).toBe(false);
    // And the gate excludes all three, not just the one seeded.
    for (const id of DATING_IDS) {
      const row = relationshipTypes.find((type) => type.id === id);
      expect(isPurchasable({ ...(row as RelationshipType), purchasable: true })).toBe(false);
    }
  });

  it("groups purchasable types into the seven realms, in order, with no dating entry", () => {
    const groups = purchasableTypesByRealm();
    expect(groups.map((group) => group.realm)).toEqual([
      "Office",
      "Business",
      "Property",
      "School",
      "Medical",
      "Home",
      "Social",
    ]);

    const ids = groups.flatMap((group) => group.types.map((type) => type.id));
    expect(ids).toHaveLength(purchasableRelationshipTypes.length);
    for (const id of DATING_IDS) {
      expect(ids).not.toContain(id);
    }
  });
});

/**
 * The demo sheets — sample content, held to the same bar as the catalogue.
 *
 * A demo report is only worth showing if the numbers behind it are someone's authored answers.
 * `demoAnswersByType` is a literal record — no generator, no clock, no random — and these tests
 * pin the two properties a future edit could quietly destroy: every Aspect the type asks is
 * answered by both parties on all four Opinions, and the `staff-manager` sheet produces the Gap
 * spread a real pair produces (In Synch somewhere, ≥2 somewhere) instead of the all-zero sheet
 * that would make the report look like a marketing score.
 */
describe("the demo sheets", () => {
  it("only names types that exist and are purchasable", () => {
    for (const id of Object.keys(demoAnswersByType)) {
      const type = relationshipTypes.find((candidate) => candidate.id === id);
      expect(type, `"${id}" has a demo but no type`).toBeDefined();
      expect(isPurchasable(type as RelationshipType)).toBe(true);
    }
  });

  it("answers every Aspect on all four Opinions, both parties, 1..5", () => {
    for (const [id, demo] of Object.entries(demoAnswersByType)) {
      const type = relationshipTypes.find((candidate) => candidate.id === id);
      if (type === undefined) continue;
      const aspects = type.aspects.map((item) => item.id).sort();
      for (const party of ["you", "them"] as const) {
        const answers = demo[party];
        expect(Object.keys(answers).sort()).toEqual(aspects);
        for (const itemId of aspects) {
          const parsed = zOpinions.parse(answers[itemId]);
          // All four, not merely the two Basic requires: the demo is an Advanced sheet.
          expect(Object.keys(parsed).sort()).toEqual(["feel", "guess", "think", "wish"]);
          for (const value of Object.values(parsed)) {
            expect(value).toBeGreaterThanOrEqual(1);
            expect(value).toBeLessThanOrEqual(5);
          }
        }
      }
    }
  });

  it("staff-manager spans the Gaps a real pair produces — never a perfect score", () => {
    const type = relationshipTypes.find((candidate) => candidate.id === "staff-manager");
    const demo = demoAnswersByType["staff-manager"];
    expect(type).toBeDefined();
    expect(demo).toBeDefined();
    if (type === undefined || demo === undefined) return;

    const gaps = type.aspects.flatMap((item) => {
      const perAspect = gapKindsOf(demo.you[item.id] as Opinions, demo.them[item.id] as Opinions);
      return gapKindsIn(perAspect).map((kind) => perAspect[kind] as number);
    });

    // Eight Gaps per Aspect on an Advanced sheet, all present when both parties answer all four.
    expect(gaps).toHaveLength(type.aspects.length * 8);
    // At least one Aspect where the two answers agree — In Synch has to exist to be reportable.
    expect(gaps).toContain(0);
    // And at least one that a real pair would feel as a distance.
    expect(Math.max(...gaps)).toBeGreaterThanOrEqual(2);
    // The sheet is authored on a 1..5 scale, so a Gap above 3 would mean a score off the scale.
    expect(Math.max(...gaps)).toBeLessThanOrEqual(3);
    // The report says "Not yet aligned" because some Gaps exceed Soft — not because every Gap does.
    expect(gaps.filter((gap) => gap === 0).length).toBeGreaterThan(0);
    expect(gaps.filter((gap) => gap > 1).length).toBeGreaterThan(0);
  });
});
