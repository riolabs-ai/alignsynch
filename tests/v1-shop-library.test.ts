/**
 * The shop and the template library (#384) — the two claims this card makes, proven rather than
 * asserted in a comment.
 *
 * 1. **Browse and act are different permissions.** #384's matrix marks the template library `✓`
 *    for the counterparty and `view` for the coach, and the action row for the initiator and the
 *    admin only. The route gate (`sectionAllowedFor`) and the capability
 *    (`canTakeLibraryActions`) are two functions on purpose: gating the route on the action is
 *    the deviation the owner flagged, where a counterparty could not open the catalogue from
 *    their own dashboard at all. The shop is the opposite shape — the initiator's alone, both as
 *    a route and as a capability (`canManageBilling`).
 *
 * 2. **One price, and no invented one.** `data/v1/plans.ts` is the only place a figure lives:
 *    quarterly is three months at the monthly rate with **no discount**, and every payment the
 *    fixtures record is the plan's own price. A payment that does not match its plan is a
 *    fabricated amount, which is exactly what the card forbids — so it is a failing test, not a
 *    review note. Nothing here derives a total: the history lists purchases one per period.
 */
import { describe, expect, it } from "vitest";

import { seedRelationships } from "@/data/v1/fixtures";
import {
  MONTHLY_CENTS,
  QUARTERLY_CENTS,
  subscriptionPlan,
  subscriptionPlans,
} from "@/data/v1/plans";
import {
  REALM_GROUP,
  purchasableRelationshipTypes,
  purchasableTypesByGroup,
} from "@/data/v1/relationship-types";
import {
  DASHBOARD_PERSONAS,
  canManageBilling,
  canTakeLibraryActions,
  sectionAllowedFor,
} from "@/lib/v1/persona";

describe("the persona gate (#384)", () => {
  it("lets every dashboard persona browse the template library", () => {
    for (const persona of DASHBOARD_PERSONAS) {
      expect(sectionAllowedFor(persona, "templates"), persona).toBe(true);
    }
  });

  it("keeps the shop to the initiator — nobody else sees billing", () => {
    expect(sectionAllowedFor("initiator", "shop")).toBe(true);
    for (const persona of DASHBOARD_PERSONAS.filter((name) => name !== "initiator")) {
      expect(sectionAllowedFor(persona, "shop"), persona).toBe(false);
    }
  });

  it("gives the library actions to the initiator and the admin, and nobody else", () => {
    expect(DASHBOARD_PERSONAS.filter(canTakeLibraryActions).sort()).toEqual(["admin", "initiator"]);
  });

  it("gives billing to the initiator alone", () => {
    expect(DASHBOARD_PERSONAS.filter(canManageBilling)).toEqual(["initiator"]);
  });
});

describe("the per-relationship subscription plans", () => {
  it("offers exactly the two plans the matrix names", () => {
    expect(subscriptionPlans.map((plan) => plan.id)).toEqual(["monthly", "quarterly"]);
  });

  it("charges three months at the monthly rate, with no discount", () => {
    expect(MONTHLY_CENTS).toBe(999);
    expect(QUARTERLY_CENTS).toBe(MONTHLY_CENTS * 3);
    expect(subscriptionPlan("quarterly").priceCents).toBe(
      subscriptionPlan("monthly").priceCents * 3,
    );
    expect(subscriptionPlan("monthly").periodDays).toBe(30);
    expect(subscriptionPlan("quarterly").periodDays).toBe(90);
  });

  it("refuses an id it does not carry, instead of falling back to one", () => {
    expect(() => subscriptionPlan("annual" as never)).toThrow(/no subscription plan/);
  });
});

describe("every recorded payment is its plan's own price", () => {
  it("matches the plan, on every seeded subscription", () => {
    const subscribed = seedRelationships.filter((rel) => rel.subscription !== null);
    expect(subscribed.length).toBeGreaterThan(0);

    let payments = 0;
    for (const rel of subscribed) {
      const sub = rel.subscription;
      if (sub === null) continue;
      for (const payment of sub.payments) {
        payments += 1;
        expect(payment.plan, `${rel.id} ${payment.id}`).toBe(sub.plan);
        expect(payment.amountCents, `${rel.id} ${payment.id}`).toBe(
          subscriptionPlan(payment.plan).priceCents,
        );
      }
    }
    // The census: a seed with no payments at all would pass the loop vacuously.
    expect(payments).toBeGreaterThanOrEqual(subscribed.length);
  });

  it("starts its before-state unsubscribed, so the checkout has a real transition to make", () => {
    const unsubscribed = seedRelationships.filter((rel) => rel.subscription === null);
    expect(unsubscribed.map((rel) => rel.id)).toContain("rel-unsubscribed");
  });
});

describe("Business · Personal, with the realms underneath", () => {
  it("puts every purchasable type in exactly one group", () => {
    const grouped = purchasableTypesByGroup().flatMap((group) =>
      group.types.map((type) => type.id),
    );
    expect(grouped.slice().sort()).toEqual(
      purchasableRelationshipTypes.map((type) => type.id).sort(),
    );
    expect(new Set(grouped).size).toBe(grouped.length);
  });

  it("derives each group from the realm field, not from prose", () => {
    for (const group of purchasableTypesByGroup()) {
      expect(["Business", "Personal"]).toContain(group.group);
      for (const type of group.types) {
        expect(REALM_GROUP[type.realm], type.id).toBe(group.group);
      }
    }
  });

  it("carries no `Custom` group — Custom is the library's own templates, not a type", () => {
    expect(purchasableTypesByGroup().map((group) => group.group)).not.toContain("Custom");
  });
});
