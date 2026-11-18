/**
 * **The plan chosen on `/pricing` reaches stage 5 through the address, not through a detour (#1127).**
 *
 * #1043 built the carry and made `/pricing/start` its only writer: a card's action hit a route
 * handler that wrote a cookie and answered `303` to the catalogue. The v2 spec replaces that step
 * with a plain link — every `/pricing` action opens
 * `/relationship-templates?from=pricing&plan=<tier>&interval=<interval>#catalog` — so the pair has
 * to travel the way a query travels: on the catalogue's own links, then on the template page's one
 * action, then as two hidden fields on stage 1's form, and only there does it become the flow's
 * cookie. This file pins the two ends that can be proved without a browser:
 *
 *   1. **`pricingCataloguePath()`** is the one address `/pricing` emits, and the general door carries
 *      no tier at all.
 *   2. **Stage 1's form posts the pair** — two hidden fields, and neither when nothing was carried.
 *   3. **Stage 5 draws the chip** the bundle draws: the tier's own name from the billing fixture, the
 *      "saved, nothing charged yet" sentence, and a Change link back to `/pricing`.
 *
 * The middle of the walk (the catalogue's links, the template page's browser-side append) is pinned
 * where it is written: `lib/relationship-catalogue.ts` takes one `carry` string and appends it to
 * both of a card's addresses, and `CarriedPlanLink` validates before it appends.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: unknown }) =>
    createElement("a", { href, ...rest }, children as never),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined }),
}));

import { StageInvite } from "@/components/assessment-flow/stage-invite";
import { StageOneForm } from "@/components/assessment-flow/stage-one-form";
import { EMPTY_CREATE_DRAFT } from "@/lib/flow/create-draft";
import { carriedPlanOf, type PlanIntent } from "@/lib/flow/plan-intent";
import { PRICING_PATH, pricingCataloguePath, TEMPLATE_CATALOGUE_PATH } from "@/lib/flow/paths";
import { assessmentCreatePageCopy } from "@/data/pages/assessment-create";

const ROOT = join(__dirname, "..");
const source = (path: string) => readFileSync(join(ROOT, path), "utf8");

/** A tier the plan map prices — read from the map, never typed here. */
function carriedTier(): PlanIntent {
  const intent = carriedPlanOf({ planId: "basic", interval: "month" });
  expect(intent).not.toBeNull();
  return { planId: "basic", interval: "month" };
}

describe("the address /pricing emits (#1127)", () => {
  it("names the catalogue, the tier and the interval, and lands on the shelf", () => {
    const href = pricingCataloguePath({ planId: "basic", interval: "month" });
    expect(href).toBe(`${TEMPLATE_CATALOGUE_PATH}?from=pricing&plan=basic&interval=month#catalog`);
  });

  it("carries nothing on the general door, so the catalogue renders no banner", () => {
    const href = pricingCataloguePath();
    expect(href).toBe(`${TEMPLATE_CATALOGUE_PATH}#catalog`);
    expect(href).not.toContain("plan=");
  });

  it("is what the band emits, and /pricing/start is no longer a card's destination", () => {
    // The band's address comes from one function, called by the projection that builds the cards;
    // the retired route is still served (old links), but a card that reached it would be the
    // double step #1127 removes.
    expect(source("lib/pricing-page.ts")).toContain("pricingCataloguePath({");
    expect(source("lib/pricing-page.ts")).not.toContain("pricingStartPath(");
  });
});

describe("stage 1 posts the pair, and only when one was carried (#1127)", () => {
  function form(planIntent?: PlanIntent): string {
    return renderToStaticMarkup(
      createElement(StageOneForm, {
        action: "/assessment/new/who",
        templateRecordId: "rec-1",
        ...(planIntent === undefined ? {} : { planIntent }),
        copy: {
          titleLabel: "Title",
          titleHelp: "Help",
          initiatorFirstLabel: "First",
          initiatorLastLabel: "Last",
          initiatorLastPlaceholder: "Last",
          initiatorHelp: "Help",
          counterpartyFirstLabel: "First",
          counterpartyFirstPlaceholder: "First",
          counterpartyLastLabel: "Last",
          counterpartyLastPlaceholder: "Last",
          counterpartyHelp: "Help",
          emailLabel: "Email",
          emailPlaceholder: "you@example.com",
          descriptionLabel: "Description",
          descriptionPlaceholder: "Description",
          descriptionHelp: "Help",
          requiredNote: "All required",
        },
        values: {
          initiatorFirst: EMPTY_CREATE_DRAFT.initiatorFirst,
          initiatorLast: EMPTY_CREATE_DRAFT.initiatorLast,
          counterpartyFirst: EMPTY_CREATE_DRAFT.counterpartyFirst,
          counterpartyLast: EMPTY_CREATE_DRAFT.counterpartyLast,
          title: EMPTY_CREATE_DRAFT.title,
          email: EMPTY_CREATE_DRAFT.email,
          description: EMPTY_CREATE_DRAFT.description,
        },
        descriptionDefault: "Default",
        requirements: [],
        foot: null,
      }),
    );
  }

  it("carries the tier and the interval as hidden fields", () => {
    const html = form(carriedTier());
    expect(html).toContain('name="plan" value="basic"');
    expect(html).toContain('name="interval" value="month"');
  });

  it("posts nothing extra on an ordinary first visit", () => {
    const html = form();
    expect(html).not.toContain('name="plan"');
    expect(html).not.toContain('name="interval"');
  });

  it("is the save handler that writes the flow's cookie, with the same reader", () => {
    const who = source("app/(mainlayout)/assessment/new/who/route.ts");
    expect(who).toContain("planIntentFromSearch(");
    expect(who).toContain("PLAN_INTENT_COOKIE");
    expect(who).toContain("serializePlanIntent(");
  });
});

describe("stage 5 draws the chip, and a way to change it (#1127)", () => {
  const copy = assessmentCreatePageCopy;

  function stage(planIntent: PlanIntent | null): string {
    const carried = planIntent === null ? null : carriedPlanOf(planIntent);
    return renderToStaticMarkup(
      createElement(StageInvite, {
        copy,
        draft: EMPTY_CREATE_DRAFT,
        sessionRecordId: "session-1",
        relationshipId: "relationship-1",
        ...(carried === null ? {} : { carriedPlan: carried }),
        backHref: "/back",
        cancelHref: "/cancel",
        cancelLabel: "Cancel",
        trialEndsAt: "2026-11-24T00:00:00.000Z",
      }),
    );
  }

  it("names the tier, says when it starts, and links back to Pricing", () => {
    const html = stage(carriedTier());
    expect(html).toContain("Basic Plan · Saved from Pricing.");
    expect(html).toContain("only once you add a card");
    expect(html).toContain(`href="${PRICING_PATH}"`);
    expect(html).toContain('data-plan-chip="basic"');
  });

  it("draws no chip when nothing was carried", () => {
    expect(stage(null)).not.toContain("data-plan-chip");
  });
});
