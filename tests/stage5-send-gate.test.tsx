// @vitest-environment node
/**
 * **The send waits for money** (#911), and it lives in the walk now (#1014) — the gate, drawn in
 * both states.
 *
 * The card's "doomed if" is one sentence: *the walk is drawn but the send can fire without payment*.
 * There are two places that could be true, and this file pins both halves of the UI:
 *
 *   unpaid   the walk is on its first step (`data-send-gate="locked"`), no send control is drawn at
 *            any step, and the only act available is keeping the draft — so there is nothing to press.
 *   paid     the gate opens, the walk starts at the thank-you, one step opens the act, and the control
 *            carries the owner's sentence: `send email to counterparty now`.
 *
 * The server half lives in `lib/flow/store.ts::sendDraftInvitation()` — a relationship whose
 * Initiator holds no live membership is refused `no-payment-method` there, so the gate is not only
 * the absence of a button. That half needs a database to exercise, so it is asserted by
 * `pnpm flow:e2e` against a live branch; this file is what `pnpm test` can prove with no connection.
 *
 * `StageInvite` is a client component that owns the gate's state, so it is rendered through
 * `CreateRelationship` — the same tree the route renders — rather than in isolation. The action step
 * itself is rendered through `InviteWalk`, because the stage deliberately always starts at the plan.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { CreateRelationship } from "@/components/assessment-flow/create-relationship";
import {
  InviteWalk,
  PAY_FLOW_STEPS,
  type PayFlowStep,
} from "@/components/assessment-flow/invite-walk";
import { assessmentCreatePageCopy } from "@/data/pages/assessment-create";
import { EMPTY_CREATE_DRAFT, type CreateDraft } from "@/lib/flow/create-draft";
import { itemLabel, sectionOf } from "@/lib/page-copy";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined, refresh: () => undefined }),
}));

const TEMPLATE = {
  slug: "brother-a-brother-b",
  recordId: "assessment-brother",
  title: "Brother A-Brother B",
  summary: "Five Aspects about how the two of them work.",
  aspectCount: 5,
};

const DRAFT: CreateDraft = {
  ...EMPTY_CREATE_DRAFT,
  initiatorFirst: "Daniel",
  initiatorLast: "Vance",
  counterpartyFirst: "Rowan",
  counterpartyLast: "Mercer",
  email: "rowan@example.com",
  title: "Quarterly check-in",
  mode: "basic",
  alignmentSetting: "soft",
};

const INVITE = sectionOf(assessmentCreatePageCopy, "invite");

/** The stage, at one gate state. `paid` is the returning state — the membership is already live. */
function stage(paid?: boolean): string {
  return renderToStaticMarkup(
    createElement(CreateRelationship, {
      copy: assessmentCreatePageCopy,
      stage: 5,
      template: TEMPLATE,
      draft: DRAFT,
      backHref: "/back",
      instanceRecordId: "assessment-instance-brother",
      problem: null,
      ...(paid === undefined ? {} : { initialPaid: paid }),
    }),
  );
}

/** The walk at one step, which is the only way to render a panel the stage cannot start on. */
function walkStep(step: PayFlowStep): string {
  return renderToStaticMarkup(
    createElement(InviteWalk, {
      copy: assessmentCreatePageCopy,
      instanceRecordId: "assessment-instance-brother",
      relationshipId: "relationship-brother",
      paid: true,
      onPaid: () => undefined,
      initialStep: step,
    }),
  );
}

describe("stage 5 — the send is gated by the walk", () => {
  it("is locked while the membership is not live, and draws no send control at any step", () => {
    const html = stage(false);
    expect(html).toContain('data-send-gate="locked"');
    // The stage opens on the plan, so the walk is unpaid and the act does not exist yet.
    expect(html).toContain('data-pay-step="plan"');
    expect(html).not.toContain('data-pay-action="send"');
    expect(html).not.toContain(itemLabel(INVITE, "submit"));
    // The one act an unpaid reader keeps could use: the draft, which sends nothing and charges
    // nothing. It is present at every step, so the locked walk is a decision and not a dead end.
    expect(html).toContain('data-pay-action="draft"');
    expect(html).toContain(itemLabel(INVITE, "draft"));
  });

  it("opens the gate and starts at the thank-you once the membership is live", () => {
    const html = stage(true);
    expect(html).toContain('data-send-gate="open"');
    // The returning state lands one step from the act, never back at the plan.
    expect(html).toContain('data-pay-step="thanks"');
    expect(html).toContain('data-pay-action="action"');
  });

  it("keeps the send on the walk's last step only", () => {
    for (const step of PAY_FLOW_STEPS) {
      const html = walkStep(step);
      // Plan, card and thank-you offer the way forward and nothing else; the act is the last step.
      expect(html.includes('data-pay-action="send"')).toBe(step === "action");
    }
    // …and the walk never *starts* on it: the thank-you is what opens the act.
    expect(stage(true)).toContain('data-pay-step="thanks"');
  });

  it("never disables the draft, in either state", () => {
    for (const html of [stage(false), stage(true)]) {
      expect(html).toContain(itemLabel(INVITE, "draft"));
      expect(html).not.toMatch(/data-pay-action="draft"[^>]*\baria-disabled\b/);
    }
  });

  it("keeps the send behind the server's own refusal, not only an absent button", () => {
    // The UI half is a courtesy; the rule is in the write. Read the source the gate ships.
    const store = readFileSync(join(process.cwd(), "lib/flow/store.ts"), "utf8");
    expect(store).toContain('code: "no-payment-method"');
    // #1010 R2 — the rule the write asks is the **membership**, not a captured card: the capture is
    // deleted, so a gate still reading `methodCaptured` would refuse every send for ever.
    expect(store).toMatch(/if \(!membershipLive\)/);
    expect(store).not.toMatch(/methodCaptured === null/);
  });
});

/**
 * The spec is binding, and it described the stage this work replaced: *send, or keep the draft*, with
 * a plan chosen beside the send and no card anywhere. #911's "doomed if" names both halves — a walk
 * that does not gate the send, and a spec still saying the old thing — so the spec is read here.
 * #1014 moved the ending, so the spec's ending is read here too.
 */
describe("the binding spec says what the stage is", () => {
  const spec = readFileSync(join(process.cwd(), "docs/specs/flow-stages.md"), "utf8");
  /** Stage 5's own section: from its heading to the next `## `. */
  const section = spec.slice(spec.indexOf("## Stage 5"), spec.indexOf("## How this is enforced"));

  it("names the four-step walk, in order", () => {
    expect(section).toContain("four-step walk");
    const plan = section.indexOf("**Plan**");
    const card = section.indexOf("**Card**");
    const thanks = section.indexOf("**Thank you**");
    const action = section.indexOf("**Action**");
    expect(plan).toBeGreaterThan(-1);
    expect(card).toBeGreaterThan(plan);
    expect(thanks).toBeGreaterThan(card);
    expect(action).toBeGreaterThan(thanks);
  });

  it("gates the send on the membership, in the owner's words", () => {
    expect(section).toContain("send email to counterparty now");
    expect(section).toContain("data-send-gate");
    expect(section).toContain("no-payment-method");
    expect(section).toContain("draft");
  });

  it("ends the flow on the relationship, which is where both acts land", () => {
    expect(section).toContain("/dashboard/relationships/<id>");
    // The two endings and the history rule that makes Back leave the flow (#1014).
    expect(section).toContain("replace");
  });

  it("no longer describes the retired send card beside the walk", () => {
    expect(spec).not.toContain("Send and Continue");
    expect(spec).not.toContain("Continue as Draft");
    expect(spec).not.toContain("send, or keep the draft");
    expect(section).not.toContain("beside the walk");
  });

  it("says the same thing as the fixture and the walk", () => {
    // One shape, three files: the spec's step names are the walk's steps and its panels' headings.
    const walk = readFileSync(
      join(process.cwd(), "components/assessment-flow/invite-walk.tsx"),
      "utf8",
    );
    expect(walk).toContain('PAY_FLOW_STEPS = ["plan", "card", "thanks", "action"]');
    expect(section).toContain(itemLabel(INVITE, "submit"));
  });
});
