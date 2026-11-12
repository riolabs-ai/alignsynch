/**
 * Stage 5's payment walk (#771, moved into Invite by #825) — plan → account → method → confirm →
 * done, **in place**.
 *
 * The owner's rule is one sentence long and this file is it: *"This isn't where the 'Add payment
 * method' redirect to Pricing page happens — wrong flow. User selects plan here as shown, then
 * fades to login/signup form (stays here), then enter payment method here, then fades to confirm
 * payment, then fades to thank you screen …"*
 *
 * v9 moved the walk one stage later: it sits in **Invite**, because that is where the send happens
 * and the soft prompt belongs beside the act it prompts for. What did not change is that choosing a
 * plan commits nothing and that no panel charges anything.
 *
 * Five checks, each one a thing that regresses silently:
 *
 *   1. **No route out of the stage.** The walk has no `href` at all, so a re-added pricing link is
 *      red here rather than in a review.
 *   2. **The panels are the artifact's order**, and each one's heading is its own fixture row.
 *   3. **The method panel defers the capture** — "Pay when I publish" and not one card field.
 *   4. **The walk owns no advancing control.** It used to flip the stage's foot from "Create
 *      relationship and send invite" to "Complete and Connect"; under v9 the send is the stage's own
 *      act, so the walk cannot change any label in the foot.
 *   5. **Every word is the fixture's** — the strings asserted below are read out of
 *      `data/pages/assessment-create.ts`, so a rename is one edit in one file.
 *
 * Rendered with `renderToStaticMarkup`, like the rest of the flow's tests: no database, no server,
 * no session. `initialStep` exists only so a test can render a panel without clicking.
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
import { MODE_LABELS } from "@/content/assessment";
import type { CreateDraft } from "@/lib/flow/create-draft";
import { itemLabel, sectionOf } from "@/lib/page-copy";

const flow = sectionOf(assessmentCreatePageCopy, "payment-flow");
const account = sectionOf(assessmentCreatePageCopy, "account");
const plans = sectionOf(assessmentCreatePageCopy, "plans");

const DRAFT: CreateDraft = {
  initiatorFirst: "Daniel",
  initiatorLast: "Vance",
  counterpartyFirst: "Rowan",
  counterpartyLast: "Mercer",
  email: "rowan@example.com",
  title: "Quarterly check-in",
  description: "A short reset before the planning cycle.",
  mode: "advanced",
  alignmentSetting: "halfway",
};

/** The entities `renderToStaticMarkup` escapes, decoded so a fixture string compares literally. */
function decode(html: string): string {
  return html.replaceAll("&#x27;", "'").replaceAll("&quot;", '"').replaceAll("&amp;", "&");
}

/** Render the walk at one panel. The account panel's sentence is the page's, passed in. */
function walk(step?: PayFlowStep): string {
  return decode(
    renderToStaticMarkup(
      createElement(InviteWalk, {
        copy: assessmentCreatePageCopy,
        draft: DRAFT,
        account: createElement("p", null, itemLabel(account, "signed-in-body")),
        ...(step === undefined ? {} : { initialStep: step }),
      }),
    ),
  );
}

describe("stage 5 — the payment walk happens in place", () => {
  it("walks the five panels in the artifact's order", () => {
    expect([...PAY_FLOW_STEPS]).toEqual(["plan", "account", "method", "confirm", "done"]);
  });

  it("has no route off the stage — the pricing link is gone", () => {
    for (const step of PAY_FLOW_STEPS) {
      const html = walk(step);
      expect(html).not.toContain('href="/pricing"');
      expect(html).not.toContain("data-create-plans-link");
    }
  });

  it("names each panel with its own fixture row", () => {
    expect(walk()).toContain(plans.heading ?? "");
    expect(walk("account")).toContain(itemLabel(account, "signed-in-body"));
    expect(walk("method")).toContain(itemLabel(flow, "method-heading"));
    expect(walk("confirm")).toContain(itemLabel(flow, "confirm-heading"));
    expect(walk("done")).toContain(itemLabel(flow, "done-heading"));
  });

  it("defers the capture: the method panel takes no card detail", () => {
    const html = walk("method");
    expect(html).toContain(itemLabel(flow, "method-defer"));
    expect(html).toContain(itemLabel(flow, "method-defer-note"));
    expect(html).not.toContain('type="password"');
    expect(html).not.toContain("card-number");
  });

  it("confirms what will happen, not what has been charged", () => {
    const html = walk("confirm");
    expect(html).toContain(itemLabel(flow, "confirm-plan"));
    expect(html).toContain(itemLabel(flow, "confirm-method"));
    expect(html).toContain(itemLabel(flow, "confirm-method-draft"));
    expect(html).toContain(itemLabel(flow, "confirm-to"));
    // The recap names the person and the Mode from the draft, and nothing has been charged.
    expect(html).toContain("Rowan Mercer");
    expect(html).toContain(MODE_LABELS[DRAFT.mode as keyof typeof MODE_LABELS]);
    expect(html).toContain(itemLabel(flow, "confirm-body"));
  });

  it("owns no advancing control — the foot belongs to the stage, at every panel", () => {
    for (const step of PAY_FLOW_STEPS) {
      const html = walk(step);
      // No stage foot, so no label for the walk to flip: the send is stage 5's own act (#825).
      expect(html).not.toContain('data-stage-foot="true"');
    }
  });
});
