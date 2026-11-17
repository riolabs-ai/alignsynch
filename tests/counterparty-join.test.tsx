/**
 * The Counterparty's join — three steps, three dots, one primary each (#1125).
 *
 * The card ports `docs/specs/v2-bundles/02-spec-design-page-onboarding-v2/counterparty-join.html`,
 * and its acceptance is four facts, all of them visible in static markup — which is why this file
 * renders instead of screenshotting:
 *
 *   1. **The stepper is the join's own.** Three dots, `Invite` · `Join` · `Accept`, and
 *      `Step {n} of 3`. The five-stage rail is the *Initiator's* map and is deliberately absent: the
 *      bundle draws a three-dot stepper, and printing `Stage 4 of 5` here told the invitee they were
 *      four stages into a flow they had never seen.
 *   2. **The step is addressed, not inferred.** `?step=1|2|3` with the token in the path, so a
 *      refresh, a deep link and a refusal's redirect all land on the same screen — and step 3
 *      without the carrier renders step 2, because the acceptance has nothing to post without it.
 *   3. **The acceptance is the one write, and it is last.** Step 1 posts a decline and step 2 posts
 *      the two fields to the carrier; only step 3 addresses `/claim`.
 *   4. **A completed join closes onto `/dashboard`.** That decision stays `afterClaimTarget()` in
 *      `lib/flow/paths.ts`, asserted here rather than restated in the route.
 *
 * The page module itself needs a live row to mount, so its half is a source rule — the same technique
 * `tests/stage-modal.test.tsx` uses for Sent and the account gate.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { JoinAcceptStep } from "@/components/assessment-flow/join-accept-step";
import { JoinAccountStep } from "@/components/assessment-flow/join-account-step";
import { JoinInviteStep } from "@/components/assessment-flow/join-invite-step";
import { JoinStepper } from "@/components/assessment-flow/join-stepper";
import { invitePageCopy } from "@/data/pages/invite";
import { afterClaimTarget, instancePath, inviteStepPath, OVERVIEW_PATH } from "@/lib/flow/paths";
import { inviteWizardStepOf } from "@/lib/flow/paths";
import type { InvitePreview } from "@/lib/flow/store";

const TOKEN = "k".repeat(43);

const PREVIEW: InvitePreview = {
  state: "claimable",
  instanceRecordId: "instance-response-1",
  initiatorName: "Avery",
  counterpartyName: "Rowan",
  templateTitle: "Relationship Basics",
  viewerRole: null,
  relationshipTitle: "Staying Close",
  templateSummary: "Relationship Basics, answered by Avery and Rowan.",
  mode: "basic",
  setting: "soft",
  aspects: [
    {
      id: "aspect-contact",
      prompt: "How does how often you are in touch compare to what each wants?",
    },
  ],
};

/** The file's code, without its comments — a docstring that names a class must not read as one. */
function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function stepperHtml(step: 1 | 2 | 3): string {
  return renderToStaticMarkup(createElement(JoinStepper, { copy: invitePageCopy, step }));
}

function stepHtml(step: 1 | 2 | 3): string {
  const base = { copy: invitePageCopy, preview: PREVIEW, token: TOKEN };
  if (step === 1) return renderToStaticMarkup(createElement(JoinInviteStep, base));
  if (step === 2) return renderToStaticMarkup(createElement(JoinAccountStep, base));
  return renderToStaticMarkup(
    createElement(JoinAcceptStep, {
      ...base,
      details: { name: "Rowan", email: "rowan@example.test" },
    }),
  );
}

/** The one primary control each step is allowed to draw. */
const PRIMARY: Record<1 | 2 | 3, string> = {
  1: "Join Avery",
  2: "Create Account",
  3: "Accept Invitation",
};

describe("the join's stepper", () => {
  it("draws three dots, in the bundle's three words", () => {
    const html = stepperHtml(1);
    expect(html.match(/data-step-dot="\d"/g) ?? []).toHaveLength(3);
    expect(html).toContain("Invite");
    expect(html).toContain("Join");
    expect(html).toContain("Accept");
  });

  it("says where the reader is, in words, and marks exactly one dot current", () => {
    for (const step of [1, 2, 3] as const) {
      const html = stepperHtml(step);
      expect(html).toContain(`Step ${step} of 3`);
      expect(html.match(/data-state="current"/g) ?? []).toHaveLength(1);
      // The dots before the current one read `done`, the ones after `todo`.
      expect(html.match(/data-state="done"/g) ?? []).toHaveLength(step - 1);
      expect(html.match(/data-state="todo"/g) ?? []).toHaveLength(3 - step);
    }
  });

  it("is the join's own progress — no stage rail and no stage count", () => {
    const html = stepperHtml(2);
    expect(html).not.toMatch(/Stage \d of 5/);
    expect(html).not.toContain("data-step-cell");
    // One progress pattern on the surface, which is this one (#716's rule, kept).
    expect(html.split("<nav").length - 1).toBe(1);
  });
});

describe("the join's three steps", () => {
  it("draws exactly one primary action per step, and the bundle's word on each", () => {
    for (const step of [1, 2, 3] as const) {
      const html = stepHtml(step);
      expect(html.match(/data-primary-action="[^"]+"/g) ?? []).toHaveLength(1);
      expect(html).toContain(PRIMARY[step]);
    }
  });

  it("keeps the claim on the last step, and nothing earlier writes anything", () => {
    expect(stepHtml(1)).not.toContain("/claim");
    expect(stepHtml(2)).not.toContain(`action="/invite/${TOKEN}/claim"`);
    expect(stepHtml(3)).toContain(`action="/invite/${TOKEN}/claim"`);
  });

  it("addresses each step by the token in the path, so a refresh cannot lose it", () => {
    expect(stepHtml(1)).toContain(`href="${inviteStepPath(TOKEN, 2)}"`);
    expect(stepHtml(2)).toContain(`href="${inviteStepPath(TOKEN, 1)}"`);
    expect(stepHtml(3)).toContain(`href="${inviteStepPath(TOKEN, 2)}"`);
    // The token is never re-minted or moved into a query.
    expect(stepHtml(1)).not.toContain("?step=3&token=");
  });
});

describe("an invitation deep link resolves to the step it names", () => {
  it("reads a `?step=` value, and an unknown one lands on the first step", () => {
    expect(inviteWizardStepOf("1")).toBe(1);
    expect(inviteWizardStepOf("3")).toBe(3);
    expect(inviteWizardStepOf(undefined)).toBe(1);
    expect(inviteWizardStepOf("9")).toBe(1);
    expect(inviteStepPath(TOKEN, 1)).toBe(`/invite/${TOKEN}`);
    expect(inviteStepPath(TOKEN, 3)).toBe(`/invite/${TOKEN}?step=3`);
  });

  it("is the page's own wiring: the three steps, and a GET that writes nothing", () => {
    const page = source("app/(mainlayout)/invite/[token]/page.tsx");
    expect(page).toContain("<JoinInviteStep");
    expect(page).toContain("<JoinAccountStep");
    expect(page).toContain("<JoinAcceptStep");
    expect(page).toContain("<JoinStepper");
    // The GET stays inert: claiming is the POST, and the page only previews.
    expect(page).toContain("previewInvite(");
    expect(page).not.toContain("claimInvite(");
    // No carrier, no acceptance: the acceptance posts the two fields, so step 3 without them sends
    // the reader to the step that collects them.
    expect(page).toMatch(/requested === 3 && details === null \? 2 : requested/);
  });

  it("keeps the modal shell and the stage rail off the join", () => {
    const page = source("app/(mainlayout)/invite/[token]/page.tsx");
    expect(page).not.toContain("StageRail");
    expect(page).not.toContain("CounterpartyWizard");
  });
});

describe("a completed join closes onto /dashboard", () => {
  it("lands a signed-in claimer on the console, where the relationship is listed", () => {
    expect(
      afterClaimTarget({ viewerSignedIn: true, instanceRecordId: PREVIEW.instanceRecordId ?? "" }),
    ).toBe(OVERVIEW_PATH);
  });

  it("keeps a signed-out claim on the relationship it just bound", () => {
    expect(afterClaimTarget({ viewerSignedIn: false, instanceRecordId: "instance-1" })).toBe(
      instancePath("instance-1"),
    );
  });

  it("names no `Ongoing` surface on either exit — that stage does not exist", () => {
    for (const viewerSignedIn of [true, false]) {
      const target = afterClaimTarget({ viewerSignedIn, instanceRecordId: "instance-1" });
      expect(target).not.toMatch(/ongoing/i);
    }
  });

  it("is the claim handler that asks for it, so the route has no second copy of the rule", () => {
    const route = source("app/(mainlayout)/invite/[token]/claim/route.ts");
    expect(route).toContain("afterClaimTarget({");
    // #1115 task 4 — a claim that just created the account is signed in by the auth server's own
    // cookies, so it exits onto the dashboard like any other signed-in claim.
    expect(route).toContain("viewerSignedIn: signedIn");
  });
});
