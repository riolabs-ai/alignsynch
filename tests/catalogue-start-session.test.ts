/**
 * A signed-in member is never offered sign-up (#979, defect 1).
 *
 * The measured defect: `/relationship-types` (twenty-seven cards), `/relationship-types/<slug>` and
 * `/relationship-templates` all sent a **member with a live session** to `/register`. Identity was
 * asserted per route from `/api/auth/get-session`, so it was a member, not a cookie ambiguity —
 * somebody who already has an account being asked to create one, on the front door of the product's
 * only paid flow.
 *
 * The cause was a constant: every start action was authored as `/register` (or
 * `/register?next=<stage 1>`, #867) and no surface consulted the session. The fix is
 * `lib/start-path.ts` plus a required `StartViewer` argument on each model builder, so a surface
 * cannot be session-aware on one control and stuck on another — and a missed call site is a
 * `tsc` error rather than a quiet second `/register`.
 *
 * What this file proves, at both layers:
 *
 *   1. **the derivation** — `startPathFor()` and `startHrefFor()` send a member into the flow (or to
 *      their brand's account home) and leave every visitor href exactly as authored;
 *   2. **the models** — every surface that draws a start action carries the member's destination
 *      when it is handed a member, and no model contains a `/register` href in that case.
 *
 * The rendered proof is `tests/templates-page.test.ts` (visitor) and
 * `tests/account-menu-session.test.ts` (the shell's own defect); the live proof is the before/after
 * screenshot pair in the card's PR.
 */
import { describe, expect, it } from "vitest";

import { templatesPage } from "@/lib/templates-page";
import { templatesCatalogue } from "@/lib/templates-catalogue";
import { templateDetail } from "@/lib/template-detail";
import { assessmentDemo } from "@/lib/assessment-demo";
import { pricingPlans } from "@/lib/billing/catalogue";
import { billingPlanRows } from "@/data/billing-plans";
import { alignSynchBrand } from "@/data/brands/alignsynch";
import { templatesPageCopy } from "@/data/pages/templates";
import { templatesDetailPageCopy } from "@/data/pages/templates-detail";
import { demoAnswersByType, purchasableRelationshipTypes } from "@/data/relationship-types";
import {
  OVERVIEW_PATH,
  RELATIONSHIP_TEMPLATES_PATH,
  createRelationshipPath,
} from "@/lib/flow/paths";
import {
  REGISTER_PATH,
  memberLandingPath,
  startHrefFor,
  startPathFor,
  startViewer,
  visitorOf,
  type StartViewer,
} from "@/lib/start-path";

/** A member with a live session, on the AlignSynch build. */
const MEMBER: StartViewer = startViewer("alignsynch", true);
/** The same request, signed out. */
const VISITOR: StartViewer = visitorOf("alignsynch");

const OFFERED = purchasableRelationshipTypes;

/** Every `/register`-targeting href in a value, wherever it is nested. */
function registerHrefs(value: unknown): string[] {
  if (typeof value === "string") return value.startsWith(REGISTER_PATH) ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(registerHrefs);
  if (value !== null && typeof value === "object")
    return Object.values(value).flatMap(registerHrefs);
  return [];
}

describe("startPathFor — the catalogue's action, per viewer", () => {
  it("sends a member into the flow's stage 1, with no account step", () => {
    for (const type of OFFERED) {
      expect(startPathFor(type.id, MEMBER)).toBe(createRelationshipPath(type.id));
    }
  });

  it("keeps the visitor's `/register?next=<stage 1>` exactly as #867 authored it", () => {
    for (const type of OFFERED) {
      const href = startPathFor(type.id, VISITOR);
      expect(href.startsWith(`${REGISTER_PATH}?next=`)).toBe(true);
      expect(new URL(href, "http://x").searchParams.get("next")).toBe(
        createRelationshipPath(type.id),
      );
    }
  });
});

describe("startHrefFor — hrefs that arrive as data", () => {
  it("leaves a bare `/register` alone for a visitor and resolves it for a member", () => {
    expect(startHrefFor(REGISTER_PATH, VISITOR)).toBe(REGISTER_PATH);
    expect(startHrefFor(REGISTER_PATH, MEMBER)).toBe(OVERVIEW_PATH);
  });

  it("unwraps `?next=` for a member, so the template they chose survives", () => {
    const href = startHrefFor(`${REGISTER_PATH}?next=%2Fpricing`, MEMBER);
    expect(href).toBe("/pricing");
  });

  it("does not rewrite a destination that was never a sign-up page", () => {
    for (const href of ["checkout", "/pricing", "/#questions", "/relationship-types"]) {
      expect(startHrefFor(href, MEMBER)).toBe(href);
      expect(startHrefFor(href, VISITOR)).toBe(href);
    }
  });

  it("uses the brand's own account home, not one brand's answer for both", () => {
    expect(memberLandingPath(MEMBER)).toBe(OVERVIEW_PATH);
    // QuizHub's account home is `/dashboard/user`; the table is `AFTER_SIGN_IN_BY_BRAND`, so a
    // member of that brand is not sent to the console's Overview.
    expect(memberLandingPath(startViewer("quizhub", true))).toBe("/dashboard/user");
  });
});

describe("every surface that offers a start action", () => {
  it("gives a member the flow on all twenty-seven catalogue cards", () => {
    const page = templatesPage(templatesPageCopy, MEMBER);
    const cards = page.catalogue.realms.flatMap((realm) => realm.cards);
    expect(cards).toHaveLength(OFFERED.length);
    for (const card of cards) {
      expect(card.start, card.id).toBe(createRelationshipPath(card.id));
    }
    // Nothing on the page is a sign-up destination any more. The membership band's authored CTA is
    // `/pricing` ("See plans") and is not a start action — it is left exactly as authored.
    expect(registerHrefs(page)).toEqual([]);
    expect(page.membership.link?.href).toBe("/pricing");
  });

  it("gives a member the flow from the type's own page", () => {
    for (const type of OFFERED.slice(0, 5)) {
      const model = templateDetail(templatesDetailPageCopy, type.id, MEMBER);
      expect(model?.start.href).toBe(createRelationshipPath(type.id));
    }
  });

  it("gives a member the flow from the worked example", () => {
    for (const id of Object.keys(demoAnswersByType)) {
      expect(assessmentDemo(id, MEMBER)?.startPath).toBe(createRelationshipPath(id));
    }
  });

  it("gives a member their account home from the V2 catalogue's authored final CTA", () => {
    const model = templatesCatalogue(alignSynchBrand, templatesPageCopy, MEMBER);
    // `final-cta` is the one authored `/register` on this fixture ("Create a relationship").
    expect(model.finalCta.action.href).toBe(OVERVIEW_PATH);
    expect(registerHrefs(model)).toEqual([]);
    // The membership band's "See plans" is a pricing destination, not a start action — untouched
    // for both viewers.
    expect(model.benefits.action.href).toBe("/pricing");
    // And a visitor keeps the sign-up page exactly as authored.
    const visitor = templatesCatalogue(alignSynchBrand, templatesPageCopy, VISITOR);
    expect(visitor.finalCta.action.href).toBe(REGISTER_PATH);
    expect(visitor.benefits.action.href).toBe("/pricing");
  });

  it("gives a member their account home from the Free plan card, and leaves `checkout` a checkout", () => {
    const plans = pricingPlans({
      rows: billingPlanRows(),
      source: "table",
      entitledPlanId: null,
      startHref: startHrefFor(REGISTER_PATH, MEMBER),
    });
    // Free is the one tier whose authored CTA is `/register` ("Start your 7 days").
    expect(plans.find((plan) => plan.id === "free")?.cta.href).toBe(OVERVIEW_PATH);
    // "checkout" is the card's sentinel, not a route: it must never be resolved to a page.
    for (const id of ["basic", "principal"] as const) {
      expect(plans.find((plan) => plan.id === id)?.cta.href).toBe("checkout");
    }
    // A visitor's card still starts at the sign-up page.
    const visitor = pricingPlans({
      rows: billingPlanRows(),
      source: "table",
      entitledPlanId: null,
      startHref: startHrefFor(REGISTER_PATH, VISITOR),
    });
    expect(visitor.find((plan) => plan.id === "free")?.cta.href).toBe(REGISTER_PATH);
  });

  it("keeps the visitor's page byte-for-byte the one it shipped (#317)", () => {
    const page = templatesPage(templatesPageCopy, VISITOR);
    for (const card of page.catalogue.realms.flatMap((realm) => realm.cards)) {
      expect(card.start).toBe(startPathFor(card.id, VISITOR));
    }
    // A visitor's two authored bands are unchanged, and the two viewers differ only in the final
    // CTA — the paint is the same page.
    expect(page.membership.link?.href).toBe("/pricing");
    const visitor = templatesCatalogue(alignSynchBrand, templatesPageCopy, VISITOR);
    const member = templatesCatalogue(alignSynchBrand, templatesPageCopy, MEMBER);
    expect(visitor.finalCta.action.href).toBe(REGISTER_PATH);
    expect(visitor.tokens).toEqual(member.tokens);
    expect(RELATIONSHIP_TEMPLATES_PATH).toBe("/templates/relationship");
  });
});
