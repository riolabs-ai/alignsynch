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
 *      Mounted in a DOM, because the posted value only exists after a click no static render can
 *      make: **choosing the row is the act** since #1031, one press that both advances the step and
 *      starts the checkout.
 *   4. **No silent default.** The card step reached with nothing chosen used to post `?? "basic"`,
 *      which is a price nobody read. It must draw the refusal band and call no checkout at all:
 *      `plan === null` is a state the walk cannot price, so it must not guess.
 *
 * **#1031's own acceptance lives here too**, because it is a client-side reveal no HTTP harness can
 * see: the row's click must leave the card step on screen with `[data-checkout-frame]` drawn and
 * **no second control pressed**, a refusal must replace the frame inside the step, and Back must
 * return to a panel whose rows are unselected again — a native radio fires no `change` when it is
 * already checked, so a panel that kept its choice would be a step nobody could leave twice.
 *
 * The other panels, both landings and Back keep their assertions in `tests/payment-flow.test.ts` and
 * `tests/stage5-send-gate.test.tsx`.
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
import type { MembershipOutcome } from "@/lib/member/outcomes";
import { itemLabel, sectionOf } from "@/lib/page-copy";

declare global {
  // React reads this to know it is inside `act()`; without it every update is unmocked.
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const FLOW = sectionOf(assessmentCreatePageCopy, "payment-flow");
const PLANS = sectionOf(assessmentCreatePageCopy, "plans");

/** Every payload the walk has handed the checkout, in order. The walk posts; this records. */
let posted: { planId?: string; interval?: string }[] = [];

/**
 * What the server answers next. `onStart` answers **a refusal** by default on purpose: the walk then
 * draws its sentence inside the card step instead of mounting the provider's frame, so an assertion
 * about the payload the walk built never needs a Stripe key. A test that wants the frame, or the
 * inline purchase that ends the walk, sets this first.
 */
let answer: MembershipOutcome = { ok: false, code: "test-stop", message: "stopped by the test" };

const checkout = {
  onStart: async (payload: { planId?: string; interval?: string }) => {
    posted.push(payload);
    return answer;
  },
  onConfirm: async () => ({ ok: false as const, code: "test-stop" }),
};

let root: Root | null = null;
let container: HTMLDivElement | null = null;

/**
 * Mount the walk. `initialStep` is the only way to render a panel without clicking; `entitled`
 * draws the #870 summary instead of the radio group, which is the one state whose card step is
 * reached without a row to choose.
 */
async function mount(
  options: { initialStep?: PayFlowStep; entitled?: boolean } = {},
): Promise<HTMLDivElement> {
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
        ...(options.initialStep === undefined ? {} : { initialStep: options.initialStep }),
        ...(options.entitled === true
          ? { planIncluded: { name: "Principal", entitled: true } }
          : {}),
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

/**
 * Every `data-pay-action` the mounted walk draws, in document order — the *set* of controls rather
 * than a search for one name. The plan panel draws none but the draft, and the card step draws only
 * its two ways out, so a resurrected start button fails this list by name.
 */
function payActions(where: HTMLElement): string[] {
  return [...where.querySelectorAll("[data-pay-action]")].map(
    (control) => control.getAttribute("data-pay-action") ?? "",
  );
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  posted = [];
  answer = { ok: false, code: "test-stop", message: "stopped by the test" };
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
      // **One press, and it is the choice.** Since #1031 the row is the act: the selection advances
      // the step and starts the checkout, so there is no second control to press.
      await press(where, `input[name="plan"][value="${plan}"]`);

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

  it("names the row that was bought, by the tier's own name and price", async () => {
    // An inline purchase ends the walk on the thank-you, which recaps the plan it bought.
    answer = { ok: true, completed: true };
    const where = await mount();
    await press(where, 'input[name="plan"][value="unlimited"]');

    expect(posted[0]?.planId).toBe("principal");
    expect(where.querySelector('[data-pay-step="thanks"]')).not.toBeNull();
    // #1036's guard, moved: the plan panel is left the moment a row is chosen, so the recap that
    // names the tier is the thank-you's own line — `Principal` and the price the row prints, never
    // the walk's own id (`unlimited`) that keys the row.
    expect(where.textContent).toContain(
      `${itemLabel(PLANS, "unlimited")} · ${itemLabel(PLANS, "unlimited-price")}${itemLabel(PLANS, "per")}`,
    );
  });

  it("never charges a tier nobody chose — the silent `basic` default is gone", async () => {
    // The one state that reaches the card step with no tier: a measured, already-paying account
    // (#870) whose panel is a summary, so there is no row to select and its own control is the act.
    // `?? "basic"` made this a purchase of a price nobody read; there is no tier to name here, so
    // the walk draws the refusal in the step and calls no checkout at all.
    const where = await mount({ entitled: true });
    await press(where, '[data-pay-action="continue"]');

    expect(posted).toHaveLength(0);
    expect(where.querySelector('[data-pay-step="card"]')).not.toBeNull();
    const band = where.querySelector('[data-pay-refusal="true"]');
    expect(band?.textContent).toBe(itemLabel(FLOW, "card-refused"));
    // The way out is still drawn: Back to the plan, and the draft at every step.
    expect(where.querySelector('[data-pay-action="plan"]')).not.toBeNull();
    expect(where.querySelector('[data-pay-action="draft"]')).not.toBeNull();
  });
});

describe("the card step mounts its frame on reveal (#1031)", () => {
  it("draws the frame the moment a row is chosen, with nothing to press in between", async () => {
    // A session is minted, which is the state the provider's frame mounts in.
    answer = {
      ok: true,
      clientSecret: "cs_test_reveal",
      publishableKey: "pk_test_reveal",
      checkoutSessionId: "cs_1",
    };
    const where = await mount();

    // Nothing on the plan panel starts a checkout: the row itself is the act.
    expect(payActions(where)).toEqual(["draft"]);
    expect(where.querySelector("[data-checkout-frame]")).toBeNull();

    // **One press**, and the frame's mount point is already drawn on the revealed step.
    await press(where, 'input[name="plan"][value="one"]');

    expect(posted).toHaveLength(1);
    expect(where.querySelector('[data-pay-step="card"]')).not.toBeNull();
    const frame = where.querySelector('[data-checkout-frame="embedded"]');
    expect(frame).not.toBeNull();
    // The reveal is the step's focus target — how a keyboard follows it into the frame.
    expect(frame?.getAttribute("data-panel-first")).toBe("true");
    // …and the controls left are the two ways out: no start button survived the reveal.
    expect(payActions(where)).toEqual(["plan", "draft"]);
  });

  it("opens the step in its `opening` state — a status, not a refusal", async () => {
    // The card step before a session has been minted: the mount point is drawn and says so.
    const where = await mount({ initialStep: "card" });
    expect(where.querySelector('[data-checkout-frame="opening"]')).not.toBeNull();
    expect(where.querySelector('[data-checkout-pending="true"]')?.getAttribute("role")).toBe(
      "status",
    );
    // No refusal band: nothing has failed yet, and the walk has nothing to refuse.
    expect(where.querySelector('[data-pay-refusal="true"]')).toBeNull();
    // The two ways out are reachable from the step's first frame.
    expect(where.querySelector('[data-pay-action="plan"]')).not.toBeNull();
    expect(where.querySelector('[data-pay-action="draft"]')).not.toBeNull();
  });

  it("draws a refused start inside the step, in place of the frame", async () => {
    // The default stub refuses, which is a server that will not open a session.
    const where = await mount();
    await press(where, 'input[name="plan"][value="one"]');

    // The sentence, not a dialog over a still-clickable control: the frame is gone and there is no
    // press left that would fail identically.
    expect(where.querySelector('[data-pay-refusal="true"]')?.textContent).toContain(
      "stopped by the test",
    );
    expect(where.querySelector("[data-checkout-frame]")).toBeNull();
    // …and the step still offers Back and the draft, and nothing that would start a checkout again.
    expect(payActions(where)).toEqual(["plan", "draft"]);
  });

  it("returns to an unselected plan panel on Back, so choosing again is the act again", async () => {
    const where = await mount();
    await press(where, 'input[name="plan"][value="one"]');
    await press(where, '[data-pay-action="plan"]');

    expect(where.querySelector('[data-pay-step="plan"]')).not.toBeNull();
    // A native radio fires no `change` when it is already checked: keeping the choice would leave a
    // panel whose rows could not take anybody forward a second time.
    expect(where.querySelector('input[name="plan"]:checked')).toBeNull();
    expect(where.querySelector("[data-checkout-frame]")).toBeNull();

    await press(where, 'input[name="plan"][value="one"]');
    expect(posted).toHaveLength(2);
    expect(where.querySelector('[data-pay-step="card"]')).not.toBeNull();
  });
});
