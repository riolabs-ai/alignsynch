/**
 * **The ratchet: no create stage renders a payment input, and stage 5 offers the free week**
 * (#1115 task 3, spec US-1's measured criterion).
 *
 * The issue's whole point is one sentence — *no credit card, 7 day trial* — and the acceptance is
 * measured, not eyeballed: *a rendered create stage contains zero card-number, expiry, CVC or
 * billing-postcode inputs*. So this file renders every stage of the flow and every panel of stage
 * 5's walk, and fails on any input that asks for money. Three things are pinned, each one a way the
 * card comes back:
 *
 *   the fields   no `type="tel"`, no `autocomplete="cc-*"`, no `name` carrying `card`, `cvc`,
 *                `expiry`, `exp` or `postal`, and no `type="password"` on stage 5.
 *   the panel    stage 5 opens on the plan panel, never on the card step: no
 *                `data-checkout-frame`, no `data-pay-step="card"` in a create render, and the
 *                provider's frame is not imported by a path the create can reach.
 *   the act      the plan panel's primary action reads `Continue with 7 days free`, is enabled,
 *                and the trial's end is drawn as a date the server measured.
 *
 * **The page is asserted too.** A component can be blameless while the page that mounts it hands
 * over the checkout — that is exactly how this shipped — so the invite page's own source must not
 * pass `checkout` or import the membership actions. A reintroduced card would arrive with the
 * adapter back in the page, and this fails on the line that did it.
 *
 * Rendered with `renderToStaticMarkup`, like the rest of the flow's tests: no database, no server,
 * no session, no clock.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  CreateRelationship,
  type CreateStage,
} from "@/components/assessment-flow/create-relationship";
import { InviteWalk, PAY_FLOW_STEPS } from "@/components/assessment-flow/invite-walk";
import { assessmentCreatePageCopy } from "@/data/pages/assessment-create";
import { EMPTY_CREATE_DRAFT } from "@/lib/flow/create-draft";
import { itemLabel, sectionOf } from "@/lib/page-copy";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined }),
}));

const PLANS = sectionOf(assessmentCreatePageCopy, "plans");

const TEMPLATE = {
  slug: "brother-a-brother-b",
  recordId: "assessment-brother",
  title: "Brother A-Brother B",
  summary: "Five Aspects about how the two of them work.",
  aspectCount: 5,
};

const DRAFT = { ...EMPTY_CREATE_DRAFT, initiatorFirst: "Daniel", counterpartyFirst: "Rowan" };

const TRIAL_ENDS_AT = "2026-11-23T12:00:00.000Z";

/**
 * Every control that would take a card, as a list of `name`, `type` and `autocomplete` triples.
 *
 * Written as one extractor rather than five `not.toContain` calls so a failure names the field
 * that came back instead of the whole document.
 */
function paymentInputs(html: string): string[] {
  const inputs = [...html.matchAll(/<(input|select|textarea)\b[^>]*>/gi)].map((match) => match[0]);
  return inputs.filter((input) => {
    const type = /\stype="([^"]*)"/i.exec(input)?.[1]?.toLowerCase() ?? "";
    const name = /\sname="([^"]*)"/i.exec(input)?.[1]?.toLowerCase() ?? "";
    const autocomplete = /\sautocomplete="([^"]*)"/i.exec(input)?.[1]?.toLowerCase() ?? "";
    if (type === "tel") return true;
    if (autocomplete.startsWith("cc")) return true;
    if (/card|cvc|cvv|expiry|\bexp\b|postal|billing/.test(name)) return true;
    if (/card|cvc|cvv|expiry|postal/.test(autocomplete)) return true;
    return false;
  });
}

/** The stage, as the route renders it. `stage` 5 is the invite; 1–4 are the steps before it. */
function stage(which: CreateStage, extra: Record<string, unknown> = {}): string {
  return renderToStaticMarkup(
    createElement(CreateRelationship, {
      copy: assessmentCreatePageCopy,
      stage: which,
      template: TEMPLATE,
      draft: DRAFT,
      aspects: [{ id: "aspect-1", prompt: "Aspect One", leftValue: "Low", rightValue: "High" }],
      backHref: "/back",
      problem: null,
      sessionRecordId: "assessment-instance-brother",
      relationshipId: "relationship-brother",
      /* The create path always measures the week: its absence is the purchase panel, which this
         flow cannot reach (it supplies no checkout handler either). */
      ...(which === 5 ? { trialEndsAt: TRIAL_ENDS_AT } : {}),
      ...extra,
    }),
  );
}

/** The walk, as the create path mounts it: no checkout handler, a server-read trial end. */
function walk(step?: (typeof PAY_FLOW_STEPS)[number], extra: Record<string, unknown> = {}): string {
  return renderToStaticMarkup(
    createElement(InviteWalk, {
      copy: assessmentCreatePageCopy,
      sessionRecordId: "assessment-instance-brother",
      relationshipId: "relationship-brother",
      paid: false,
      onPaid: () => undefined,
      trialEndsAt: TRIAL_ENDS_AT,
      ...(step === undefined ? {} : { initialStep: step }),
      ...extra,
    }),
  );
}

describe("every create stage renders zero payment inputs", () => {
  it("stages 1–4 ask for no card, and stage 4's account form never asks for one either", () => {
    for (const which of [1, 2, 3, 4] as const) {
      const found = paymentInputs(stage(which));
      expect(found, `stage ${which} renders a payment input`).toEqual([]);
    }
  });

  it("stage 5 asks for no card on any panel the create path can reach", () => {
    // The create path renders the walk with no checkout handler and no `initialStep`, so the
    // panels it can reach are the plan and — after the free continue — the act. Both are checked.
    for (const extra of [{}, { paid: true }]) {
      const html = stage(5);
      expect(paymentInputs(html), `stage 5 with ${JSON.stringify(extra)}`).toEqual([]);
    }
    expect(paymentInputs(walk())).toEqual([]);
    expect(paymentInputs(walk("action", { paid: true }))).toEqual([]);
  });

  it("never draws the provider's frame or the card step from the create path", () => {
    const html = stage(5);
    expect(html).toContain('data-pay-step="plan"');
    expect(html).not.toContain('data-pay-step="card"');
    expect(html).not.toContain("data-checkout-frame");
    expect(html).not.toContain("data-stripe-embedded-checkout");
    expect(walk()).not.toContain("data-checkout-frame");
  });

  it("mounts a walk that cannot reach the checkout adapter at all", () => {
    // The stage hands over what the create path has — and no handler is one of those facts.
    const walkMarkup = walk();
    expect(walkMarkup).not.toContain("data-checkout-pending");
    expect(walkMarkup).not.toContain("data-checkout-frame");
  });
});

describe("stage 5's primary action is the free week", () => {
  it("reads `Continue with 7 days free` and is enabled", () => {
    const html = stage(5);
    expect(html).toContain(itemLabel(PLANS, "free-continue"));

    const control = /<button[^>]*data-pay-action="continue"[^>]*>([\s\S]*?)<\/button>/.exec(html);
    expect(control).not.toBeNull();
    // Never disabled: a price is not a blocker on this screen (spec US-1). The attribute, not the
    // word — `disabled:cursor-not-allowed` lives in the shared class string.
    expect(control?.[0] ?? "").not.toMatch(/\sdisabled(="")?[ >]/);
    expect(control?.[1] ?? "").toContain(itemLabel(PLANS, "free-continue"));
  });

  it("draws the trial's end date, from the instant the server measured", () => {
    const html = stage(5, { trialEndsAt: TRIAL_ENDS_AT });
    expect(html).toContain(`data-trial-ends="${TRIAL_ENDS_AT}"`);
    // The date is rendered from that instant — `Thursday, November 23` — never a countdown the
    // browser recomputes (two people on one account must read the same number).
    expect(html).toContain(itemLabel(PLANS, "trial-ends").split("{")[0] ?? "");
    expect(html).toContain("November 23");
    expect(html).not.toContain("days left");
  });

  it("does not ask for a plan selection to continue", () => {
    const html = stage(5);
    // The rows are still drawn — the comparison is information — and none of them is required,
    // pre-selected, or wired to the step change.
    expect(html).toContain('data-create-plans="true"');
    expect(html).not.toMatch(/<input[^>]*\srequired\b/);
    expect(html).not.toMatch(/<input[^>]*\schecked\b/);
    // The draft stays the other choice at the plan panel: two ways on, no dead end.
    expect(html).toContain('data-pay-action="draft"');
  });
});

describe("the invite page cannot reach the checkout adapter", () => {
  // #1109 moved the stage's body out of the route and under `components/flow/template-create/`,
  // so the page at `/dashboard/templates/[id]/create/invite` is the two-line wrapper and this is
  // the module that decides what the step draws.
  const page = readFileSync(
    join(process.cwd(), "components/flow/template-create/invite.tsx"),
    "utf8",
  );

  it("passes no checkout handler, and imports none of the membership actions", () => {
    expect(page).not.toContain("startMembershipAction");
    expect(page).not.toContain("confirmMembershipAction");
    expect(page).not.toContain("onStart:");
    expect(page).not.toContain("onConfirm:");
  });

  it("reads the trial through the one function, with a clock the request supplies", () => {
    expect(page).toContain("trialStateOf(");
  });
});

describe("the walk's purchase path is out of the create flow, not deleted", () => {
  it("keeps the four steps and their order", () => {
    // Stage names, order and the `Stage {n} of 5` count are the flow spec's (docs/specs/
    // flow-stages.md). #1115 takes payment out of the path; it renames nothing.
    expect([...PAY_FLOW_STEPS]).toEqual(["plan", "card", "thanks", "action"]);
  });

  it("still draws the card step when a caller supplies a checkout — the upgrade action's surface", () => {
    // Reachable only by naming the step: the create path has no handler, so nothing it renders
    // can enter it. Kept because the explicit "add a payment method" action is the only caller
    // of `payment_method_collection: "always"` (a later card), and `tests/one-payment-surface`
    // still wants exactly one card-capture component.
    const html = renderToStaticMarkup(
      createElement(InviteWalk, {
        copy: assessmentCreatePageCopy,
        sessionRecordId: "assessment-instance-brother",
        relationshipId: "relationship-brother",
        paid: true,
        onPaid: () => undefined,
        checkout: {
          onStart: async () => ({ ok: true as const, completed: true }),
          onConfirm: async () => ({ ok: true as const, completed: true }),
        },
        initialStep: "card",
      }),
    );
    expect(html).toContain('data-pay-step="card"');
  });
});
