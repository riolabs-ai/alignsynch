/**
 * Stage 5's walk (#771; four steps since #1014) — **join a plan → save a card → thank you → the act**,
 * in place, and then the relationship.
 *
 * The approved reference is `docs/review/artifacts/prototype-relationship-lifecycle-v9.html`, whose
 * Invite screen draws the pay flow on the left and the send on the right. The owner's bar on #911 is
 * one sentence long — *pick a plan → enter a card → read a thank-you → press one enabled button* —
 * and #1014 added the half that was missing: the button. The act is the walk's last step and both of
 * its controls land on `/dashboard/relationships/<id>`.
 *
 * Six checks, each one a thing that regresses silently:
 *
 *   1. **Four steps, in the card's order.** `PAY_FLOW_STEPS` is read, not restated.
 *   2. **No route out to a pricing page.** The plan is sold in place, so a re-added pricing link is
 *      red here rather than in a review.
 *   3. **The money is named.** The plan panel says what the money buys in the owner's two phrases —
 *      *join membership plan* and *activate relationship*.
 *   4. **The card is Stripe's.** The card panel draws the provider's mount point and never a card
 *      field of our own — no `type="password"`, no `name="card…"`, no CVC. Since #1031 the mount
 *      point is drawn the moment the step opens, and no control on either panel starts a checkout:
 *      choosing the plan row is the act, so this file fails if a start button comes back.
 *   5. **The walk ends with an act, not a thank-you.** The thank-you carries one control that opens
 *      the action panel; the action panel carries **send** and **keep the draft**, and both name the
 *      relationship they land on.
 *   6. **The false sentence stays gone.** Nothing reads "the control beside this walk" — the control
 *      is in the walk — and this file fails if the words come back to the fixture or the component.
 *
 * Rendered with `renderToStaticMarkup`, like the rest of the flow's tests: no database, no server, no
 * session. `initialStep` exists only so a test can render a panel without clicking, and `useRouter`
 * is stubbed because a static render has no router.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  InviteWalk,
  PAY_FLOW_STEPS,
  type PayFlowStep,
} from "@/components/assessment-flow/invite-walk";
import { membershipOf } from "@/lib/relationship/membership";
import { assessmentCreatePageCopy } from "@/data/pages/assessment-create";
import { itemLabel, sectionOf } from "@/lib/page-copy";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined }),
}));

const flow = sectionOf(assessmentCreatePageCopy, "payment-flow");
const plans = sectionOf(assessmentCreatePageCopy, "plans");
const invite = sectionOf(assessmentCreatePageCopy, "invite");

/** The relationship both of the walk's acts land on, and the screen that draws it. */
const RELATIONSHIP = "relationship-1";
const RELATIONSHIP_PATH = `/dashboard/relationships/${RELATIONSHIP}`;

/** The entities `renderToStaticMarkup` escapes, decoded so a fixture string compares literally. */
function decode(html: string): string {
  return html.replaceAll("&#x27;", "'").replaceAll("&quot;", '"').replaceAll("&amp;", "&");
}

/**
 * Every `data-pay-action` a rendered panel draws, in document order — the *set* of controls, not a
 * search for one name. Since #1031 there is no start control between the plan and the card fields, so
 * the proof is that the plan panel draws none and the card step draws only its two ways out: a
 * resurrected start button fails this list by name, without the retired marker being spelled here.
 */
function payActions(html: string): string[] {
  return [...html.matchAll(/data-pay-action="([^"]+)"/g)].map((match) => match[1] ?? "");
}

/** Render the walk at one panel. `paid` is the returning state — the membership is already live. */
function walk(step?: PayFlowStep, paid = false): string {
  return decode(
    renderToStaticMarkup(
      createElement(InviteWalk, {
        copy: assessmentCreatePageCopy,
        instanceRecordId: "assessment-instance-1",
        relationshipId: RELATIONSHIP,
        paid,
        onPaid: () => undefined,
        ...(step === undefined ? {} : { initialStep: step }),
      }),
    ),
  );
}

describe("stage 5 — the walk happens in place, in four steps, and ends on the relationship", () => {
  it("walks plan → card → thanks → action, and nothing else", () => {
    expect([...PAY_FLOW_STEPS]).toEqual(["plan", "card", "thanks", "action"]);
  });

  it("has no route out to a pricing page — the plan is sold in place", () => {
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
    // **No button on this panel starts the checkout** (#1031): choosing a row is the act, and the
    // draft is the only other control the walk draws before the card step exists.
    expect(payActions(html)).toEqual(["draft"]);
  });

  it("takes the card from Stripe's frame, never from a field of ours", () => {
    const html = walk("card");
    expect(html).toContain('data-pay-step="card"');
    expect(html).toContain(itemLabel(flow, "card-heading"));
    // **The frame is drawn on the reveal, and nothing starts it** (#1031): the mount point is the
    // step's own first state, and the only controls left are the two ways out.
    expect(html).toContain('data-checkout-frame="opening"');
    expect(html).toContain('data-checkout-pending="true"');
    expect(payActions(html)).toEqual(["plan", "draft"]);
    // The step says what the card unlocks — the sentence the send card used to carry beside the walk.
    expect(html).toContain(itemLabel(invite, "locked"));
    // Nothing here is a card form: the fields belong to the provider's iframe, and the mount point
    // is the shared frame (#911 lifted it out of the dashboard dialog rather than copying it).
    expect(html).not.toContain('type="password"');
    expect(html).not.toMatch(/name="(card|cvc|cardnumber|expiry)"/i);
  });

  it("thanks the reader, and hands over the act with one control", () => {
    const html = walk("thanks", true);
    expect(html).toContain('data-pay-step="thanks"');
    expect(html).toContain(itemLabel(flow, "thanks-heading"));
    expect(html).toContain(itemLabel(flow, "thanks-body"));
    // One control, and it is the walk's own next step — never a second send up here.
    expect(html).toContain('data-pay-action="action"');
    expect(html).toContain(itemLabel(flow, "continue"));
    expect(html).not.toContain('data-pay-action="send"');
    // The sentence that told the reader the control was *beside* the walk (#1014).
    expect(html).not.toContain("beside this walk");
  });

  it("offers both acts in the last step, and both name the relationship", () => {
    const html = walk("action", true);
    expect(html).toContain('data-pay-step="action"');
    expect(html).toContain(itemLabel(invite, "cta-heading"));
    expect(html).toContain(itemLabel(invite, "cta-body"));

    // Send: the same endpoint stage 5 has always posted to, under the owner's own label.
    expect(html).toContain('data-pay-action="send"');
    expect(html).toContain('data-send-endpoint="/assessment/instances/assessment-instance-1/send"');
    expect(html).toContain(itemLabel(invite, "submit"));

    // Keep the draft: a navigation, not a second write — stage 4 wrote the row as a `draft`.
    expect(html).toContain('data-pay-action="draft"');
    expect(html).toContain(itemLabel(invite, "draft"));

    // Both endings are the relationship's own screen — that is #1014's step 5.
    expect(html).toContain(`href="${RELATIONSHIP_PATH}"`);
  });

  it("opens on the thank-you when the membership is already live", () => {
    // The returning state: a person who paid and came back is not asked to pay twice.
    expect(walk(undefined, true)).toContain('data-pay-step="thanks"');
  });

  it("owns no stage foot — the foot belongs to the stage", () => {
    for (const step of PAY_FLOW_STEPS) {
      expect(walk(step)).not.toContain('data-stage-foot="true"');
    }
  });

  /**
   * The acceptance line, kept where the gate can see it: the sentence is gone from the fixture *and*
   * from the walk. Deleting it from the component alone would leave the words one import away;
   * deleting it from the fixture alone could not stop the panel typing it back.
   */
  it("carries no sentence saying the control is beside the walk", () => {
    const sources = [
      readFileSync(join(process.cwd(), "data/pages/assessment-create.ts"), "utf8"),
      readFileSync(join(process.cwd(), "components/assessment-flow/invite-walk.tsx"), "utf8"),
    ];
    for (const source of sources) {
      expect(source).not.toContain("beside this walk");
      expect(source).not.toContain("the control beside");
    }
  });
});

/**
 * #1014 — **the walk's gate is a subscription, not `membership.writable`.**
 *
 * This pair is the whole defect: `writable` is `true` for a `draft` on purpose (nothing has been
 * sold, so there is nothing to lapse), and stage 5 renders on exactly such a draft. Gating the walk
 * on it opened the walk on its thank-you for every new relationship, skipped the plan and the card,
 * and left `sendDraftInvitation()` to refuse the send with `no-payment-method` — a screen saying
 * "the plan is active" about an account holding no subscription at all.
 */
describe("stage 5 — the walk is paid for by a subscription, not by `writable`", () => {
  it("a draft reads writable while holding no subscription: the two facts disagree", () => {
    const reading = membershipOf({
      status: "draft",
      subscription: null,
      now: new Date("2026-01-01T00:00:00.000Z"),
    });
    expect(reading.state).toBe("open");
    expect(reading.writable).toBe(true);
  });

  it("the invite stage gates the walk on `subscriptionLive`, never on `paymentArmed`", () => {
    const page = readFileSync(
      join(process.cwd(), "app/(mainlayout)/templates/relationship/[slug]/create/invite/page.tsx"),
      "utf8",
    );
    expect(page).toContain("initialPaid={screen.subscriptionLive === true}");
    expect(page).not.toContain("initialPaid={screen.paymentArmed");
  });
});
