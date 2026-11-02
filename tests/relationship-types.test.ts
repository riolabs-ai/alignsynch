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

import {
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
