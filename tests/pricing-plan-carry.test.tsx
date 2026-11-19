// @vitest-environment jsdom
/**
 * **The plan chosen on `/pricing` arrives at stage 5 already selected (#1043).**
 *
 * The defect this file locks shut has two halves, and they were one journey apart:
 *
 *   `/pricing`   a plan card asked the server for a checkout and went where the answer said, so a
 *                membership could start with **no relationship behind it**.
 *   stage 5      the plan panel always opened with `useState<PlanId | null>(null)`, so a person who
 *                chose a plan one page earlier was asked for it again.
 *
 * Seven checks, in the order a regression would hit them:
 *
 *   1. **A pair the catalogue sells is a pair that can be carried**, and nothing else is: a retired
 *      tier, `free`, a stray interval and a missing half all resolve to "no plan carried".
 *   2. **The carry survives a round trip**, as base64url JSON, and junk is "nothing carried" rather
 *      than a throw during a render.
 *   3. **The tier crosses back to the row the panel draws**, through `PLAN_BILLING_TIER` read
 *      backwards — never a second map beside it.
 *   4. **Every `/pricing` action opens the flow's door.** The grid's plan cards carry their tier and
 *      interval; the general ones carry nothing; none of them opens a checkout or `/register`.
 *   5. **The route writes the carry and answers `303` to the catalogue** — and clears when the action
 *      carried nothing, which is what keeps a general CTA honestly unselected.
 *   6. **Stage 5 draws the carried row checked, with one control to continue**, and the checkout it
 *      starts names the carried tier *and* the carried interval.
 *   7. **Nothing carried is still nothing selected** — the absence is the proof, and a plan panel
 *      that preselects a tier nobody chose is the defect this card removed.
 *
 * The grid and the walk are rendered here: one as static markup (its footers are all the inventory
 * needs), the walk mounted in a DOM because the posted payload only exists after a click.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Every cookie the route sets, in order — the handler's whole observable effect. */
let written: { name: string; value: string; options?: Record<string, unknown> }[] = [];

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
    getAll: () => [],
    set: (name: string, value: string, options?: Record<string, unknown>) => {
      written.push({ name, value, options });
    },
    delete: () => undefined,
  }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: unknown }) =>
    createElement("a", { href, ...rest }, children as never),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined }),
}));

import { GET as pricingStart } from "@/app/(marketing)/pricing/start/route";
import { InviteWalk } from "@/components/assessment-flow/invite-walk";
import { PricingCta } from "@/components/pricing/pricing-cta";
import { PricingPlans } from "@/components/pricing/pricing-plans";
import { BILLING_INTERVALS } from "@/data/billing-plans";
import { MEMBERSHIP_PLANS } from "@/data/membership-plans";
import { assessmentCreatePageCopy, PLAN_BILLING_TIER } from "@/data/pages/assessment-create";
import { pricingPageCopy } from "@/data/pages/pricing";
import { itemLabel, sectionOf } from "@/lib/page-copy";
import {
  POPULAR_PLAN_ID,
  pricingBands,
  pricingCards,
  pricingHero,
  pricingUnsure,
} from "@/lib/pricing-page";
import {
  carriedPlanOf,
  isPaidPlanTier,
  parsePlanIntent,
  planIntentFromSearch,
  planRowFor,
  serializePlanIntent,
  type PlanIntent,
} from "@/lib/flow/plan-intent";
import { pricingCataloguePath, pricingStartPath, TEMPLATE_CATALOGUE_PATH } from "@/lib/flow/paths";
import { PLAN_INTENT_COOKIE } from "@/lib/flow/session";

declare global {
  // React reads this to know it is inside `act()`; without it every update is unmocked.
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const PLANS = sectionOf(assessmentCreatePageCopy, "plans");

/** The two tiers a card can carry, from the one map — never a list typed here. */
const CARRIED_TIERS = [...new Set(Object.values(PLAN_BILLING_TIER))];

/** A `URLSearchParams` from the pairs a card's address would carry. */
function query(pairs: Record<string, string> = {}): URLSearchParams {
  return new URLSearchParams(pairs);
}

describe("what a plan card can carry, and what it cannot", () => {
  it("carries exactly the tiers the plan map prices", () => {
    for (const tier of CARRIED_TIERS) {
      expect(isPaidPlanTier(tier)).toBe(true);
      expect(planIntentFromSearch(query({ plan: tier, interval: "month" }))).toEqual({
        planId: tier,
        interval: "month",
      });
    }
    // `free` is a plan of the catalogue and nothing any card can carry: it is every account's
    // default, so its card's action is the general door.
    expect(isPaidPlanTier("free")).toBe(false);
    expect(planIntentFromSearch(query({ plan: "free", interval: "month" }))).toBeNull();
  });

  it("refuses a pair the catalogue does not sell, and answers nothing carried", () => {
    expect(planIntentFromSearch(query())).toBeNull();
    expect(planIntentFromSearch(query({ plan: "principal" }))).toBeNull();
    expect(planIntentFromSearch(query({ interval: "month" }))).toBeNull();
    expect(planIntentFromSearch(query({ plan: "principal", interval: "weekly" }))).toBeNull();
    expect(planIntentFromSearch(query({ plan: "enterprise", interval: "month" }))).toBeNull();
    expect(planIntentFromSearch(query({ plan: "principal", interval: "" }))).toBeNull();
    // Since the Family plan was removed (2026-11-19) its tier is not one a card prices, so an
    // address naming it carries nothing — a stale link cannot reselect a plan nobody sells.
    expect(planIntentFromSearch(query({ plan: "principal", interval: "month" }))).toBeNull();
    expect(planIntentFromSearch(query({ plan: "principal", interval: "year" }))).toBeNull();
  });

  it("survives the cookie round trip, and reads junk as nothing carried", () => {
    for (const tier of CARRIED_TIERS) {
      for (const interval of BILLING_INTERVALS) {
        const intent: PlanIntent = { planId: tier as PlanIntent["planId"], interval };
        const raw = serializePlanIntent(intent);
        // base64url: cookie-octet safe, so Next cannot re-encode it into a value that will not parse.
        expect(raw).toMatch(/^[A-Za-z0-9_-]+$/);
        expect(parsePlanIntent(raw)).toEqual(intent);
      }
    }
    expect(parsePlanIntent(undefined)).toBeNull();
    expect(parsePlanIntent("")).toBeNull();
    expect(parsePlanIntent("not-base64-json")).toBeNull();
    expect(parsePlanIntent(Buffer.from("[]", "utf8").toString("base64url"))).toBeNull();
    // A hand-edited cookie naming a tier nobody sells is "no plan", not a preselection.
    const crafted = Buffer.from(
      JSON.stringify({ planId: "enterprise", interval: "month" }),
      "utf8",
    ).toString("base64url");
    expect(parsePlanIntent(crafted)).toBeNull();
  });

  it("crosses back to the row the plan panel draws", () => {
    for (const tier of CARRIED_TIERS) {
      const row = planRowFor(tier);
      expect(row).not.toBeNull();
      // The map read backwards: this is the assertion that fails if a second map is ever added.
      expect(row === null ? null : PLAN_BILLING_TIER[row]).toBe(tier);
    }
    // …and what stage 5 actually receives keeps both halves of the choice.
    const carried = carriedPlanOf({ planId: "basic", interval: "year" });
    expect(carried).not.toBeNull();
    expect(carried && PLAN_BILLING_TIER[carried.row]).toBe("basic");
    expect(carried?.interval).toBe("year");
    // The yearly tier is Single Annual's row, not Single's — the pair is matched exactly.
    expect(carried?.row).toBe("annual");
    expect(carriedPlanOf(null)).toBeNull();
    // The removed Family plan's tier claims no row any more, so a cookie that still names it reads
    // as no plan carried at all rather than as a fallback row.
    const stale = Buffer.from(
      JSON.stringify({ planId: "principal", interval: "month" }),
      "utf8",
    ).toString("base64url");
    expect(carriedPlanOf(parsePlanIntent(stale))).toBeNull();
  });
});

describe("every /pricing action opens the flow's door (#1043)", () => {
  /**
   * The page's bands as `/pricing` builds them (#1127): the three approved plans, no entitlement,
   * so every card offers its own action. Rendered the way the page composes them, so the assertion
   * is about the render a visitor gets rather than about a component in isolation.
   */
  function bands(): { plans: string; cta: string } {
    const cards = pricingCards({ copy: pricingPageCopy, entitledPlanId: null });
    const model = pricingBands(pricingPageCopy, false);
    return {
      plans: renderToStaticMarkup(
        createElement(PricingPlans, {
          hero: pricingHero(pricingPageCopy),
          cards,
          unsure: pricingUnsure({ copy: pricingPageCopy, cards }),
          bands: model,
        }),
      ),
      cta: renderToStaticMarkup(
        createElement(PricingCta, {
          heading: model.ctaHeading,
          body: model.ctaBody,
          label: model.ctaLabel,
          href: model.ctaHref,
        }),
      ),
    };
  }

  it("carries each plan's own tier and interval to the catalogue from every card", () => {
    // #1127 — a plan is *chosen* here and *sold* nowhere: the card's action is the catalogue with
    // its choice in the address (`/relationship-templates?from=pricing&plan=…&interval=…#catalog`),
    // and no card reaches `/pricing/start` or a checkout any more. Each plan has ONE interval, so
    // the address is the plan's own pair rather than a toggle position.
    const { plans } = bands();
    for (const plan of MEMBERSHIP_PLANS) {
      const href = pricingCataloguePath({ planId: plan.tier, interval: plan.interval });
      expect(plans).toContain(`href="${href.replaceAll("&", "&amp;")}"`);
      expect(plans).toContain(`data-plan-cta="${plan.id}"`);
    }
    // The carry is per card, not one shared address.
    expect(
      new Set(
        MEMBERSHIP_PLANS.map((plan) =>
          pricingCataloguePath({ planId: plan.tier, interval: plan.interval }),
        ),
      ).size,
    ).toBe(MEMBERSHIP_PLANS.length);
  });

  it("leaves the general CTA carrying nothing, and opens no checkout and no sign-up", () => {
    const { plans, cta } = bands();
    // The closing band's action is the general door: no tier in its address, so nothing to
    // preselect, and a choice left by an earlier visit is cleared by the route it names.
    expect(cta).toContain(`href="${pricingCataloguePath()}"`);
    // Nothing on this page starts a checkout any more, and nothing sends a reader to `/register`:
    // both were doors out of the flow (#1043). Nor does it collect a card — the create path stays
    // payment-free (#1115 D3).
    for (const html of [plans, cta]) {
      expect(html).not.toContain("/api/billing/checkout");
      expect(html).not.toContain('href="/register"');
      expect(html).not.toContain('href="checkout"');
      expect(html).not.toContain("<input");
    }
  });

  it("marks exactly one plan Most Popular, and it is the one the strip points at", () => {
    const cards = pricingCards({ copy: pricingPageCopy, entitledPlanId: null });
    const popular = cards.filter((card) => card.popular);
    expect(popular).toHaveLength(1);
    expect(popular[0]?.id).toBe(POPULAR_PLAN_ID);
    const unsure = pricingUnsure({ copy: pricingPageCopy, cards });
    // The strip names the ribboned plan and opens that plan's own door.
    expect(unsure.body).toContain(popular[0]?.name ?? "");
    expect(unsure.cta.href).toBe(popular[0]?.cta.href);
  });
});

describe("the carry route", () => {
  beforeEach(() => {
    written = [];
  });

  it("writes the chosen pair and answers 303 to the catalogue", async () => {
    const response = await pricingStart(
      new Request("https://alignsynch.test/pricing/start?plan=basic&interval=year"),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      new URL(TEMPLATE_CATALOGUE_PATH, "https://alignsynch.test").toString(),
    );
    expect(written).toHaveLength(1);
    const cookie = written[0];
    expect(cookie?.name).toBe(PLAN_INTENT_COOKIE);
    expect(parsePlanIntent(cookie?.value)).toEqual({ planId: "basic", interval: "year" });
    // The flow's own cookie options: httpOnly, sameSite lax, one day.
    expect(cookie?.options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/" });
    expect(cookie?.options?.maxAge).toBe(24 * 60 * 60);
  });

  it("clears the carry when the action carried nothing — the general CTA's policy", async () => {
    const response = await pricingStart(new Request("https://alignsynch.test/pricing/start"));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      new URL(TEMPLATE_CATALOGUE_PATH, "https://alignsynch.test").toString(),
    );
    expect(written).toHaveLength(1);
    expect(written[0]?.name).toBe(PLAN_INTENT_COOKIE);
    expect(written[0]?.value).toBe("");
    // `maxAge: 0` at the path it was written to, or the clearing would leave the cookie in place.
    expect(written[0]?.options?.maxAge).toBe(0);
    expect(written[0]?.options?.path).toBe("/");
  });

  it("clears rather than carrying a pair the catalogue does not sell", async () => {
    const response = await pricingStart(
      new Request("https://alignsynch.test/pricing/start?plan=enterprise&interval=month"),
    );

    expect(response.status).toBe(303);
    expect(written[0]?.value).toBe("");
  });
});

/** The walk, mounted in a DOM: the payload it posts only exists after a click. */
let root: Root | null = null;
let container: HTMLDivElement | null = null;
let posted: { planId?: string; interval?: string }[] = [];

async function mountWalk(
  carriedPlan?: PlanIntent & { row: "single" | "annual" },
): Promise<HTMLDivElement> {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      createElement(InviteWalk, {
        copy: assessmentCreatePageCopy,
        sessionRecordId: "assessment-instance-1",
        relationshipId: "relationship-1",
        paid: false,
        onPaid: () => undefined,
        checkout: {
          onStart: async (payload: { planId?: string; interval?: string }) => {
            posted.push(payload);
            // A refusal keeps the walk on the card step, which is where the assertions look.
            return { ok: false as const, code: "test-stop", message: "stopped by the test" };
          },
          onConfirm: async () => ({ ok: false as const, code: "test-stop" }),
        },
        ...(carriedPlan === undefined ? {} : { carriedPlan }),
      }),
    );
  });
  return container;
}

async function press(where: HTMLDivElement, selector: string): Promise<void> {
  const control = where.querySelector<HTMLElement>(selector);
  if (control === null) throw new Error(`no control matching ${selector}`);
  await act(async () => {
    control.click();
  });
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  posted = [];
});

afterEach(async () => {
  const mounted = root;
  root = null;
  if (mounted !== null) {
    await act(async () => {
      mounted.unmount();
    });
  }
  container?.remove();
  container = null;
  delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
});

describe("stage 5 opens with the carried plan already selected", () => {
  it("draws the row checked, names it, and continues with the carried tier and interval", async () => {
    const where = await mountWalk({ planId: "basic", interval: "year", row: "annual" });

    // The render says what it carried — the attribute the acceptance quotes.
    const section = where.querySelector("[data-plan-carried]");
    expect(section?.getAttribute("data-plan-carried")).toBe("basic");
    expect(section?.getAttribute("data-plan-carried-interval")).toBe("year");

    // …and the row itself is the selected one, before anything is pressed.
    const checked = where.querySelector<HTMLInputElement>('input[name="plan"]:checked');
    expect(checked?.value).toBe("annual");
    // The panel's own recap names the plan the money would buy (#1036's line, now filled).
    expect(where.textContent).toContain(
      `${itemLabel(PLANS, "annual")} · ${itemLabel(PLANS, "annual-price")}${itemLabel(PLANS, "annual-interval")}`,
    );

    // A checked row fires no `change`, so the panel carries one control that opens the card step.
    expect(where.querySelector('[data-pay-action="continue"]')).not.toBeNull();
    expect(where.querySelector('[data-pay-step="plan"]')).not.toBeNull();

    await press(where, '[data-pay-action="continue"]');

    expect(where.querySelector('[data-pay-step="card"]')).not.toBeNull();
    // The checkout names the tier, and the interval the reader chose on `/pricing`.
    expect(posted).toEqual([{ planId: "basic", interval: "year" }]);
  });

  it("carries the row, not the walk's own id, whatever the interval", async () => {
    const where = await mountWalk({ planId: "basic", interval: "month", row: "single" });
    await press(where, '[data-pay-action="continue"]');

    expect(posted).toEqual([{ planId: "basic", interval: "month" }]);
    expect(posted[0]?.planId).not.toBe("single");
  });

  it("restores the carried choice on Back instead of dropping it", async () => {
    const where = await mountWalk({ planId: "basic", interval: "month", row: "single" });
    await press(where, '[data-pay-action="continue"]');
    await press(where, '[data-pay-action="plan"]');

    expect(where.querySelector<HTMLInputElement>('input[name="plan"]:checked')?.value).toBe(
      "single",
    );
    expect(where.querySelector('[data-pay-action="continue"]')).not.toBeNull();
  });

  it("leaves the panel unselected when nothing was carried — the absence is the proof", async () => {
    const where = await mountWalk();

    // No marker at all: React omits an attribute whose value is `undefined`, so the section simply
    // does not carry one. (An empty string would be a claim; absence is the absence.)
    expect(where.querySelector("[data-plan-carried]")).toBeNull();
    expect(where.querySelector("[data-plan-carried-interval]")).toBeNull();
    expect(where.querySelector('input[name="plan"]:checked')).toBeNull();
    // With nothing carried, choosing the row is still the act (#1031): no continue control.
    expect(where.querySelector('[data-pay-action="continue"]')).toBeNull();

    await press(where, 'input[name="plan"][value="single"]');
    expect(posted).toEqual([{ planId: "basic", interval: "month" }]);
  });

  it("reads the carry from the cookie on the stage's own page", () => {
    // The page is the only place a cookie can be read: it measures the intent and hands the walk a
    // row. A source assertion because the page needs a database and a session to render.
    const page = readFileSync(
      join(process.cwd(), "components/flow/template-create/invite.tsx"),
      "utf8",
    );
    expect(page).toContain("carriedPlanOf(parsePlanIntent(");
    expect(page).toContain("jar.get(PLAN_INTENT_COOKIE)");
    expect(page).toContain("{...(carriedPlan === null ? {} : { carriedPlan })}");
  });

  it("keeps the plan rows' own words: the catalogue's two plans", () => {
    // #1043 changes where a plan is chosen, never what it is called; #1127 set the catalogue and
    // the owner narrowed it to these two on 2026-11-19 by removing Family.
    expect(itemLabel(PLANS, "single")).toBe("Single");
    expect(itemLabel(PLANS, "annual")).toBe("Single Annual");
    // …and the copy that only the deleted checkout button read is gone, so nothing names a state
    // this product no longer has on `/pricing`.
    expect((pricingPageCopy.sections ?? []).flatMap((section) => section.items ?? [])).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "checkout-busy" })]),
    );
  });
});
