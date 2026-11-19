/**
 * The catalogue behind the templates shelves — 27 purchasable types, seven realms (#794).
 *
 * The *public* catalogue of these types is `/relationship-templates` and the type pages under
 * `/relationship-types`; the signed-in shelf that sells them is `/dashboard/templates?tab=catalogue`
 * (`data/relationship-types.ts` over `lib/member/shelf.ts::catalogueCard`). What this file pins is
 * the fixture invariant all three depend on:
 *
 *   - **every purchasable type has exactly one template record**, and the record's Aspects are the
 *     type's own — derived, not retyped, so a question edited in the taxonomy cannot drift from the
 *     template that asks it;
 *   - **the realms keep their authored sizes**, which is what a realm filter counts.
 *
 * **The rendered-library cases went with the page** (#1109): `/templates/relationship` was deleted
 * and every action it drew is on `/dashboard/templates` now. The card those cases read is
 * `lib/member/shelf.ts::catalogueCard`, and `tests/member-templates-tabs.test.ts` is where its
 * rendering is asserted.
 */
import { describe, expect, it } from "vitest";

import { assessments } from "@/data/assessments";
import { REALMS, purchasableRelationshipTypes, relationshipType } from "@/data/relationship-types";

describe("every purchasable type has one template, built from the type", () => {
  it("covers all 27 purchasable types, each with exactly one record", () => {
    expect(purchasableRelationshipTypes).toHaveLength(27);

    const slugs = assessments.map((template) => template.slug);
    for (const type of purchasableRelationshipTypes) {
      expect(slugs.filter((slug) => slug === type.id)).toHaveLength(1);
    }
  });

  it("takes the type's own Aspects, in order, rather than a second copy of the questions", () => {
    // The two hand-authored templates keep the Aspects their sessions were copied from (E31
    // pins that), so they are the one deliberate exception; every other type is the source.
    const authored = new Set(["staff-manager", "parent-child"]);

    for (const type of purchasableRelationshipTypes) {
      if (authored.has(type.id)) continue;
      const template = assessments.find((record) => record.slug === type.id);
      if (template === undefined) throw new Error(`no template for "${type.id}"`);
      expect(template.items.map((item) => item.id)).toEqual(type.aspects.map((item) => item.id));
      expect(template.items.map((item) => item.prompt)).toEqual(
        type.aspects.map((item) => item.prompt),
      );
      expect(template.title).toBe(type.name);
    }
  });

  it("leaves the hand-authored starter out of the catalogue by naming no type", () => {
    const starter = assessments.find(
      (template) => template.id === "assessment-relationship-basics",
    );
    expect(starter).toBeDefined();
    expect(relationshipType(starter?.slug ?? "")).toBeUndefined();
  });

  it("keeps the seven realms at their authored sizes", () => {
    // The counts a realm filter shows: 5 · 4 · 1 · 2 · 1 · 10 · 4, in `REALMS` order.
    expect(REALMS).toEqual([
      "Office",
      "Business",
      "Property",
      "School",
      "Medical",
      "Home",
      "Social",
    ]);
    expect(
      REALMS.map((realm) => ({
        realm,
        count: purchasableRelationshipTypes.filter((type) => type.realm === realm).length,
      })),
    ).toEqual([
      { realm: "Office", count: 5 },
      { realm: "Business", count: 4 },
      { realm: "Property", count: 1 },
      { realm: "School", count: 2 },
      { realm: "Medical", count: 1 },
      { realm: "Home", count: 10 },
      { realm: "Social", count: 4 },
    ]);
  });
});
