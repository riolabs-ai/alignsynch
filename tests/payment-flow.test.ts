/**
 * Stage 4's payment walk (#771) — plan → account → method → confirm → done, **in place**.
 *
 * The owner's rule is one sentence long and this file is it: *"This isn't where the 'Add payment
 * method' redirect to Pricing page happens — wrong flow. User selects plan here as shown, then
 * fades to login/signup form (stays here), then enter payment method here, then fades to confirm
 * payment, then fades to thank you screen and the left column then changes button … with button
 * text changed from 'Keep as Draft' to 'Complete and Connect'."*
 *
 * Five checks, each one a thing that regresses silently:
 *
 *   1. **No route out of the stage.** The old left card ended in a `PRICING_PATH` link; the walk
 *      has no `href` at all, so a re-added link is red here rather than in a review.
 *   2. **The panels are the artifact's order**, and each one's heading is its own fixture row.
 *   3. **The method panel defers the capture** — "Pay when I publish" and not one card field,
 *      because nothing is charged on this screen (#619/#690).
 *   4. **The advance flips once**, and only on the last panel: the stage's control reads the create
 *      label until `done`, then `Complete and Connect`.
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
  PAY_FLOW_STEPS,
  type PayFlowStep,
  StageFour,
} from "@/components/assessment-flow/stage-four";
import { ADVANCE_CLASSES } from "@/components/assessment-flow/stage-foot";
import { assessmentCreatePageCopy } from "@/data/pages/assessment-create";
import { EMPTY_CREATE_DRAFT } from "@/lib/flow/create-draft";
import { itemLabel, sectionOf } from "@/lib/page-copy";

const flow = sectionOf(assessmentCreatePageCopy, "payment-flow");
const commit = sectionOf(assessmentCreatePageCopy, "commit");
const plans = sectionOf(assessmentCreatePageCopy, "plans");

const TEMPLATE = {
  recordId: "assessment-relationship-basics",
  title: "Relationship Basics",
  aspectCount: 5,
};

/** The entities `renderToStaticMarkup` escapes, decoded so a fixture string compares literally. */
function decode(html: string): string {
  return html.replaceAll("&#x27;", "'").replaceAll("&quot;", '"').replaceAll("&amp;", "&");
}

/** Render stage 4 at one panel. */
function stage(step?: PayFlowStep): string {
  return decode(
    renderToStaticMarkup(
      createElement(StageFour, {
        copy: assessmentCreatePageCopy,
        draft: EMPTY_CREATE_DRAFT,
        template: TEMPLATE,
        backHref: "/templates/relationship/x/aspects",
        cancelHref: "/dashboard",
        cancelLabel: "Cancel",
        advanceClasses: ADVANCE_CLASSES,
        commitFormId: "create-commit-form",
        initialStep: step,
      }),
    ),
  );
}

/** The advance control's own markup — the last button in the foot, which is the stage's submit. */
function advanceOf(html: string): string {
  const foot = html.slice(html.indexOf('data-stage-foot="true"'));
  const submit = foot.slice(foot.indexOf("<button"));
  return submit.slice(0, submit.indexOf("</button>") + 9);
}

describe("stage 4 — the payment walk happens in place", () => {
  it("walks the five panels in the artifact's order", () => {
    expect([...PAY_FLOW_STEPS]).toEqual(["plan", "account", "method", "confirm", "done"]);
  });

  it("has no route off the stage — the pricing link is gone", () => {
    for (const step of PAY_FLOW_STEPS) {
      const html = stage(step);
      expect(html).not.toContain('href="/pricing"');
      expect(html).not.toContain("data-create-plans-link");
    }
  });

  it("names each panel with its own fixture row", () => {
    expect(stage()).toContain(plans.heading ?? "");
    expect(stage("account")).toContain(itemLabel(flow, "account-heading"));
    expect(stage("method")).toContain(itemLabel(flow, "method-heading"));
    expect(stage("confirm")).toContain(itemLabel(flow, "confirm-heading"));
    expect(stage("done")).toContain(itemLabel(flow, "done-heading"));
  });

  it("defers the capture: the method panel takes no card detail", () => {
    const html = stage("method");
    expect(html).toContain(itemLabel(flow, "method-defer"));
    expect(html).toContain(itemLabel(flow, "method-defer-note"));
    expect(html).not.toContain('type="password"');
    expect(html).not.toContain("card-number");
    expect(html).not.toMatch(/data-pay-action="[a-z]+"[^>]*>Save the payment method/);
  });

  it("confirms what will happen, not what has been charged", () => {
    const html = stage("confirm");
    expect(html).toContain(itemLabel(flow, "confirm-plan"));
    expect(html).toContain(itemLabel(flow, "confirm-method"));
    expect(html).toContain(itemLabel(flow, "confirm-method-draft"));
    expect(html).toContain(itemLabel(flow, "confirm-body"));
  });

  it("advances with the create label until the last panel, then Complete and Connect", () => {
    for (const step of ["plan", "account", "method", "confirm"] as const) {
      const advance = advanceOf(stage(step));
      expect(advance).toContain(itemLabel(commit, "submit"));
      expect(advance).not.toContain(itemLabel(flow, "connect-cta"));
    }
    const done = advanceOf(stage("done"));
    expect(done).toContain(itemLabel(flow, "connect-cta"));
    expect(done).not.toContain(itemLabel(commit, "submit"));
    // the same form, so the flip is a label and never a second write path
    expect(done).toContain('form="create-commit-form"');
  });

  it("keeps the review's six facts beside the walk on every panel", () => {
    for (const step of PAY_FLOW_STEPS) {
      const html = stage(step);
      expect(html.match(/data-create-fact="true"/g) ?? []).toHaveLength(6);
      expect(html).toContain(TEMPLATE.title);
    }
  });
});
