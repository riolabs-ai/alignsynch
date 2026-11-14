// @vitest-environment jsdom
/**
 * **The plan choice and the billing catalogue are two vocabularies, and this file is the check
 * between them** (P0, the walk that could never be paid).
 *
 * Stage 5's plan panel is keyed by the fixture's ids — `one`, `unlimited` — because those are the
 * handles the review copy uses (`one-note`, `one-price`). A checkout is named by a tier the
 * catalogue sells: `free` / `basic` / `principal` (`data/billing-plans.ts`), and `startCheckout`
 * refuses anything else (`"one" is not a plan this product sells`). Both sides are `string`, so
 * TypeScript cannot see the crossing and the gate could not either: the walk posted its own id,
 * the card frame never mounted, and `#1019`'s gate then made the Send unreachable for every new
 * relationship.
 *
 * Four things, in the order a regression would hit them:
 *
 *   1. **Every plan has a tier, and only plans have one.** `satisfies Record<PlanId, PaidPlanId>`
 *      is compile-time; this is the runtime list, which is what catches a plan added to
 *      `PLAN_IDS` whose map was left alone.
 *   2. **Every mapped tier is actually sold.** A mapping to `free` type-checks (it is a
 *      `BillingPlanId`) and cannot be bought, so membership in `BILLING_PLAN_IDS` is not enough:
 *      each tier must resolve a Price at both intervals, which is the lookup the adapter itself
 *      refuses without.
 *   3. **The walk posts the tier, not its own id** — the assertion that fails on `origin/main`.
 *      Mounted in a DOM, because the posted value only exists after two clicks (choose a row,
 *      continue) that no static render can make.
 *   4. **No silent default.** The card step reached with nothing chosen used to post `?? "basic"`,
 *      which is a price nobody read. It must draw the refusal band and call no checkout at all:
 *      `plan === null` is a state the walk cannot price, so it must not guess.
 *
 * The three panels this file touches are stage 5's own; the other panels, both landings and Back
 * keep their assertions in `tests/payment-flow.test.ts` and `tests/stage5-send-gate.test.tsx`.
 */
import { createElement } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: unknown }) =>
    createElement("a", { href, ...rest }, children as never),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined }),
}));

import { PLAN_IDS } from "@/components/assessment-flow/plan-choices";
import { InviteWalk, type PayFlowStep } from "@/components/assessment-flow/invite-walk";
import { BILLING_INTERVALS, BILLING_PLAN_IDS } from "@/data/billing-plans";
import { BILLING_PRICE_IDS, billingPriceIdFor } from "@/data/billing-prices";
import { assessmentCreatePageCopy, PLAN_BILLING_TIER } from "@/data/pages/assessment-create";
import { itemLabel, sectionOf } from "@/lib/page-copy";

declare global {
  // React reads this to know it is inside `act()`; without it every update is unmocked.
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const FLOW = sectionOf(assessmentCreatePageCopy, "payment-flow");

/** Every payload the walk has handed the checkout, in order. The walk posts; this records. */
let posted: { planId?: string; interval?: string }[] = [];

/**
 * The server's two actions, stubbed. `onStart` answers **a refusal** on purpose: the walk then
 * stays on the card step instead of mounting the provider's frame, so the assertion is about the
 * payload the walk built rather than about a frame that needs a browser key.
 */
const checkout = {
  onStart: async (payload: { planId?: string; interval?: string }) => {
    posted.push(payload);
    return { ok: false as const, code: "test-stop", message: "stopped by the test" };
  },
  onConfirm: async () => ({ ok: false as const, code: "test-stop" }),
};

let root: Root | null = null;
let container: HTMLDivElement | null = null;

/** Mount the walk at one panel. `initialStep` is the only way to render a panel without clicking. */
async function mount(initialStep?: PayFlowStep): Promise<HTMLDivElement> {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(
      createElement(InviteWalk, {
        copy: assessmentCreatePageCopy,
        instanceRecordId: "assessment-instance-1",
        relationshipId: "relationship-1",
        paid: false,
        onPaid: () => undefined,
        checkout,
        ...(initialStep === undefined ? {} : { initialStep }),
      }),
    );
  });
  return container;
}

/** Press one control the way a person does, and let the state it writes flush. */
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

describe("the plan choice's ids are not billing tiers — the map is the only crossing", () => {
  it("maps every plan, and maps nothing that is not a plan", () => {
    expect(Object.keys(PLAN_BILLING_TIER).sort()).toEqual([...PLAN_IDS].sort());
  });

  it("maps only to tiers the catalogue knows", () => {
    for (const plan of PLAN_IDS) {
      expect(BILLING_PLAN_IDS).toContain(PLAN_BILLING_TIER[plan]);
    }
  });

  it("gives each plan its own tier — two rows, two prices", () => {
    const tiers = PLAN_IDS.map((plan) => PLAN_BILLING_TIER[plan]);
    expect(new Set(tiers).size).toBe(tiers.length);
  });

  it("maps only to tiers that are actually sold: a Price at every interval", () => {
    for (const plan of PLAN_IDS) {
      const tier = PLAN_BILLING_TIER[plan];
      for (const interval of BILLING_INTERVALS) {
        // The lookup, not just the list: `free` is a member of `BILLING_PLAN_IDS` and has no Price,
        // so a mapping to it type-checks and is exactly the mapping this line rejects.
        expect(billingPriceIdFor(tier, interval)).toBe(BILLING_PRICE_IDS[tier][interval]);
      }
    }
  });

  it("would fail such a mapping: free is a member of the catalogue and not for sale", () => {
    expect(BILLING_PLAN_IDS).toContain("free");
    expect(billingPriceIdFor("free", "month")).toBeUndefined();
    expect(billingPriceIdFor("free", "year")).toBeUndefined();
  });
});

describe("stage 5 posts a billing tier — the defect the live error named", () => {
  it("posts the mapped tier for every plan row, never the plan choice's own id", async () => {
    for (const plan of PLAN_IDS) {
      posted = [];
      const where = await mount();
      await press(where, `input[name="plan"][value="${plan}"]`);
      await press(where, '[data-pay-action="card"]');
      await press(where, '[data-pay-action="subscribe"]');

      expect(posted).toHaveLength(1);
      const payload = posted[0];
      expect(payload?.planId).toBe(PLAN_BILLING_TIER[plan]);
      // Both halves of the live error: the walk's own vocabulary is not a tier, and the tier is one
      // the catalogue sells.
      expect(payload?.planId).not.toBe(plan);
      expect(BILLING_PLAN_IDS).toContain(payload?.planId);
      expect(payload?.interval).toBe("month");

      const mounted = root;
      root = null;
      if (mounted !== null) {
        await act(async () => {
          mounted.unmount();
        });
        where.remove();
      }
    }
  });

  it("posts the second row's tier too — the mapping is not a one-row coincidence", async () => {
    const where = await mount();
    await press(where, 'input[name="plan"][value="unlimited"]');
    // The buys-list recaps the chosen row by the plan's own name, which is the tier the catalogue
    // sells (`Principal`), while the id behind the row stays the walk's (`unlimited`).
    expect(where.innerHTML).toContain("Principal ·");
    await press(where, '[data-pay-action="card"]');
    await press(where, '[data-pay-action="subscribe"]');
    expect(posted[0]?.planId).toBe("principal");
  });

  it("never charges a tier nobody chose — the silent `basic` default is gone", async () => {
    // The card step with no row chosen. `?? "basic"` made this a purchase of a price nobody read;
    // there is no tier to name now, so the walk draws the refusal band and calls no checkout.
    const where = await mount("card");
    await press(where, '[data-pay-action="subscribe"]');

    expect(posted).toHaveLength(0);
    const band = where.querySelector('[data-pay-refusal="true"]');
    expect(band?.textContent).toBe(itemLabel(FLOW, "card-refused"));
    // The way out is still drawn: Back to the plan, and the draft at every step.
    expect(where.querySelector('[data-pay-action="plan"]')).not.toBeNull();
    expect(where.querySelector('[data-pay-action="draft"]')).not.toBeNull();
  });
});
