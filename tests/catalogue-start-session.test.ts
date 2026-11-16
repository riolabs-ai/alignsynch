/**
 * One start action, one door: the create flow's stage 1 (#979, #1042).
 *
 * Two defects shaped this file, and the second reversed half of the first.
 *
 * **#979** measured a **member with a live session** being sent to `/register` from
 * `/relationship-types` (twenty-seven cards), `/relationship-types/<slug>` and
 * `/relationship-templates`. Identity was asserted per route from `/api/auth/get-session`, so it was
 * a member, not a cookie ambiguity. The cause was a constant: every start action was authored as
 * `/register` (or `/register?next=<stage 1>`, #867) and no surface consulted the session.
 *
 * **#1042** measured the other half: a **visitor** was then still sent to the sign-up form, so the
 * wizard was not where anybody landed and a draft could not survive the account round-trip. The
 * owner reproduced it on Staff–Manager
 * (`/register?next=%2Ftemplates%2Frelationship%2Fstaff-manager%2Fcreate`) and on the generic entry
 * (`/login?next=%2Ftemplates%2Frelationship%2Fcreate`). Stage 1 renders for a signed-out visitor
 * (#690 — the create endpoint has never required an account), and the account is stage 4 *of that
 * same wizard*, where the app's own sign-in form is mounted on the draft. So the destination no
 * longer depends on the session at all:
 *
 *   - `startPathFor()` is the flow's stage 1, for a visitor and a member alike;
 *   - `startHrefFor()` still resolves the **account-only** hrefs a fixture authors (`/register` for
 *     a visitor, the brand's account home for a member) and now unwraps `/register?next=<screen>`
 *     for both viewers.
 *
 * What this file proves, at both layers:
 *
 *   1. **the derivation** — `startPathFor()` carries the template and nothing else;
 *      `startHrefFor()` keeps the account-only case session-aware and lands the create case on the
 *      same screen for everybody;
 *   2. **the models** — every surface that draws a start action carries stage 1, and no
 *      create-intent action is a `/register` href any more.
 *
 * The rendered proof is `tests/templates-page.test.ts`; the live proof is the three-viewer matrix
 * in the card's PR (visitor, returning signed-out user, member — each on stage 1 with the template
 * carried).
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
  blankRelationshipPath,
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

describe("startPathFor — the catalogue's action, for every viewer", () => {
  it("sends everyone into the flow's stage 1, with no account step", () => {
    for (const type of OFFERED) {
      expect(startPathFor(type.id), type.id).toBe(createRelationshipPath(type.id));
    }
  });

  it("takes no viewer, so a session cannot reintroduce a second door", () => {
    // #1042: the viewer argument is gone — `startHrefFor` is the only place identity is read.
    // This case fails if somebody puts a session-shaped branch back here.
    expect(startPathFor("parent-teacher")).toBe("/dashboard/templates/parent-teacher/create");
  });
});

describe("startHrefFor — hrefs that arrive as data", () => {
  it("leaves a bare `/register` alone for a visitor and resolves it for a member", () => {
    expect(startHrefFor(REGISTER_PATH, VISITOR)).toBe(REGISTER_PATH);
    expect(startHrefFor(REGISTER_PATH, MEMBER)).toBe(OVERVIEW_PATH);
  });

  it("lands on the named screen for both viewers, so a visitor's choice survives", () => {
    // #1042 reverses #867's visitor half: `/register?next=<screen>` used to mean "make the account,
    // then go here"; it means "go here" now, because the account is stage 4 of the wizard.
    const stage = createRelationshipPath("parent-teacher");
    const href = `${REGISTER_PATH}?next=${encodeURIComponent(stage)}`;
    expect(startHrefFor(href, VISITOR)).toBe(stage);
    expect(startHrefFor(href, MEMBER)).toBe(stage);
    // The parameter names a screen, not only a flow stage.
    expect(startHrefFor(`${REGISTER_PATH}?next=%2Fpricing`, VISITOR)).toBe("/pricing");
    expect(startHrefFor(`${REGISTER_PATH}?next=%2Fpricing`, MEMBER)).toBe("/pricing");
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
  it("gives the flow on all twenty-seven catalogue cards, for both viewers", () => {
    for (const viewer of [MEMBER, VISITOR]) {
      const page = templatesPage(templatesPageCopy, viewer);
      const cards = page.catalogue.realms.flatMap((realm) => realm.cards);
      expect(cards).toHaveLength(OFFERED.length);
      for (const card of cards) {
        expect(card.start, card.id).toBe(createRelationshipPath(card.id));
      }
      // No card or band on the page is a sign-up destination any more. The membership band's
      // authored CTA is `/pricing` ("See plans") and is not a start action.
      expect(registerHrefs(page)).toEqual([]);
      expect(page.membership.link?.href).toBe("/pricing");
    }
  });

  it("gives the flow from the type's own page", () => {
    for (const type of OFFERED.slice(0, 5)) {
      const model = templateDetail(templatesDetailPageCopy, type.id);
      expect(model?.start.href).toBe(createRelationshipPath(type.id));
    }
  });

  it("gives the flow from the worked example", () => {
    for (const id of Object.keys(demoAnswersByType)) {
      expect(assessmentDemo(id)?.startPath).toBe(createRelationshipPath(id));
    }
  });

  it("gives the flow's blank start from the authored final CTA, for both viewers", () => {
    for (const viewer of [MEMBER, VISITOR]) {
      const model = templatesCatalogue(alignSynchBrand, templatesPageCopy, viewer);
      // `final-cta` is "Create a relationship" — a generic create action, so it carries no
      // template and starts on the platform's blank one (#1042).
      expect(model.finalCta.action.href).toBe(blankRelationshipPath());
      expect(registerHrefs(model)).toEqual([]);
      // The membership band's "See plans" is a pricing destination, not a start action.
      expect(model.benefits.action.href).toBe("/pricing");
    }
  });

  it("keeps the Free plan card's `/register` an account action, per viewer", () => {
    // A plan card sells a *membership*, not a relationship: it authors `/register` and
    // `startHrefFor` resolves it for the member only. Where a plan CTA should send somebody is
    // #1043's decision, so this card must not move it.
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

  it("keeps the two viewers on the same painted page (#317)", () => {
    const page = templatesPage(templatesPageCopy, VISITOR);
    for (const card of page.catalogue.realms.flatMap((realm) => realm.cards)) {
      expect(card.start).toBe(startPathFor(card.id));
    }
    expect(page.membership.link?.href).toBe("/pricing");
    const visitor = templatesCatalogue(alignSynchBrand, templatesPageCopy, VISITOR);
    const member = templatesCatalogue(alignSynchBrand, templatesPageCopy, MEMBER);
    // The final CTA is one destination for both viewers now; the paint never differed.
    expect(visitor.finalCta.action.href).toBe(member.finalCta.action.href);
    expect(visitor.tokens).toEqual(member.tokens);
    expect(RELATIONSHIP_TEMPLATES_PATH).toBe("/templates/relationship");
  });
});
