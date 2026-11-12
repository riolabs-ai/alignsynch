/**
 * Stage 5's payment walk (#771; three steps since #911) — **join a plan → save a card → thank you**,
 * in place, with the send waiting for it.
 *
 * The approved reference is `docs/review/artifacts/prototype-relationship-lifecycle-v9.html`, whose
 * Invite screen draws the pay flow on the left and the send on the right. The owner's bar on #911 is
 * one sentence long — *pick a plan → enter a card → read a thank-you → press one enabled button* —
 * and this file is the enforceable half of it. (v8 is the older drawing and is not the reference; it
 * still carried the account panel the walk lost when Account became stage 4, #825.)
 *
 * Five checks, each one a thing that regresses silently:
 *
 *   1. **Three steps, in the artifact's order.** `PAY_FLOW_STEPS` is read, not restated.
 *   2. **No route out of the stage.** The walk has no `href` at all, so a re-added pricing link is red
 *      here rather than in a review.
 *   3. **The money is named.** The plan panel says what the money buys in the owner's two phrases —
 *      *join membership plan* and *activate relationship*.
 *   4. **The card is Stripe's.** The card panel draws the provider's mount point and never a card
 *      field of our own — no `type="password"`, no `name="card…"`, no CVC.
 *   5. **The walk ends.** The thank-you draws no button and one sentence that says where to go next,
 *      because a modal that stops and offers nothing is where people close the tab.
 *
 * Rendered with `renderToStaticMarkup`, like the rest of the flow's tests: no database, no server, no
 * session. `initialStep` exists only so a test can render a panel without clicking.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  InviteWalk,
  PAY_FLOW_STEPS,
  type PayFlowStep,
} from "@/components/assessment-flow/invite-walk";
import { assessmentCreatePageCopy } from "@/data/pages/assessment-create";
import { itemLabel, sectionOf } from "@/lib/page-copy";

const flow = sectionOf(assessmentCreatePageCopy, "payment-flow");
const plans = sectionOf(assessmentCreatePageCopy, "plans");

/** The entities `renderToStaticMarkup` escapes, decoded so a fixture string compares literally. */
function decode(html: string): string {
  return html.replaceAll("&#x27;", "'").replaceAll("&quot;", '"').replaceAll("&amp;", "&");
}

/** Render the walk at one panel. `paid` is the returning state — the card is already on file. */
function walk(step?: PayFlowStep, paid = false): string {
  return decode(
    renderToStaticMarkup(
      createElement(InviteWalk, {
        copy: assessmentCreatePageCopy,
        relationshipId: "relationship-1",
        paid,
        onPaid: () => undefined,
        ...(step === undefined ? {} : { initialStep: step }),
      }),
    ),
  );
}

describe("stage 5 — the payment walk happens in place, in three steps", () => {
  it("walks plan → card → thanks, and nothing else", () => {
    expect([...PAY_FLOW_STEPS]).toEqual(["plan", "card", "thanks"]);
  });

  it("has no route off the stage — the pricing link is gone", () => {
    for (const step of PAY_FLOW_STEPS) {
      const html = walk(step);
      expect(html).not.toContain('href="/pricing"');
      expect(html).not.toContain("data-create-plans-link");
    }
  });

  it("opens on the plan, with the owner's two phrases for what the money buys", () => {
    const html = walk();
    expect(html).toContain('data-pay-step="plan"');
    expect(html).toContain(plans.heading ?? "");
    expect(html).toContain(itemLabel(plans, "buys-heading"));
    // The two things money buys, in the owner's words — never "purchase", never a subscription pitch.
    expect(html).toContain("Join membership plan");
    expect(html).toContain("Activate relationship");
    // The rows are the plan group's, and nothing is pre-selected: this screen never picks a tier.
    expect(html).toContain('name="plan"');
    expect(html).not.toMatch(/<input[^>]*\schecked/);
  });

  it("takes the card from Stripe's frame, never from a field of ours", () => {
    const html = walk("card");
    expect(html).toContain('data-pay-step="card"');
    expect(html).toContain(itemLabel(flow, "card-heading"));
    expect(html).toContain(itemLabel(flow, "card-start"));
    // Nothing here is a card form: the fields belong to the provider's iframe, and the mount point
    // is the shared frame (#911 lifted it out of the dashboard dialog rather than copying it).
    expect(html).not.toContain('type="password"');
    expect(html).not.toMatch(/name="(card|cvc|cardnumber|expiry)"/i);
  });

  it("ends on a thank-you with no button, and says where the reader goes next", () => {
    const html = walk("thanks", true);
    expect(html).toContain('data-pay-step="thanks"');
    expect(html).toContain(itemLabel(flow, "thanks-heading"));
    expect(html).toContain(itemLabel(flow, "thanks-body"));
    // The owner's "no dead ends": the step names the send (or the draft) in words.
    expect(html).toContain(itemLabel(flow, "thanks-next"));
    // A thank-you that offers another control is the walk starting again.
    expect(html).not.toContain("<button");
  });

  it("opens on the thank-you when the card is already on file", () => {
    // The returning state: a person who paid and came back is not asked for a second card.
    expect(walk(undefined, true)).toContain('data-pay-step="thanks"');
  });

  it("owns no advancing control — the foot belongs to the stage", () => {
    for (const step of PAY_FLOW_STEPS) {
      expect(walk(step)).not.toContain('data-stage-foot="true"');
    }
  });
});
