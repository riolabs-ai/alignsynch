/**
 * Stage 5 tells a person their Mode is not on their plan, and **lets them act anyway** (#834).
 *
 * The gate used to refuse the draft at stage 4 — one stage *before* the screen that carries the
 * plans and the checkout — which is a wall where the product promises an upsell. The draft is now
 * written whatever Mode it asks for, and the plan question is asked here, as a notice.
 *
 * Two claims, and the second is the one that makes this a notice rather than a refusal:
 *
 *   1. with a plan line the stage draws it, marked `data-create-notice` and `role="status"` — not
 *      the `data-create-problem` / `role="alert"` band, because nothing is being refused;
 *   2. **the send control stays enabled.** A "notice" that disables the action is the old wall with
 *      new paint, and this suite is what tells the difference.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CreateRelationship } from "@/components/assessment-flow/create-relationship";
import { assessmentCreatePageCopy } from "@/data/pages/assessment-create";
import type { CreateDraft } from "@/lib/flow/create-draft";
import { createCommitPath } from "@/lib/flow/paths";
import { itemLabel, sectionOf } from "@/lib/page-copy";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, refresh: () => undefined }),
}));

const TEMPLATE_SLUG = "relationship-basics";
const INSTANCE_ID = "assessment-instance-audit-ready";

const TEMPLATE = {
  slug: TEMPLATE_SLUG,
  recordId: "template-relationship-basics",
  title: "Relationship Basics",
  summary: "Ten Aspects about how a working relationship feels and where it should go.",
  aspectCount: 7,
};

/** The draft stage 4 wrote: Advanced Mode, which is the Mode a Free plan does not include. */
const DRAFT: CreateDraft = {
  initiatorFirst: "Daniel",
  initiatorLast: "Vance",
  counterpartyFirst: "Rowan",
  counterpartyLast: "Mercer",
  email: "rowan@example.com",
  title: "Quarterly check-in",
  description: "A short reset before the planning cycle.",
  mode: "advanced",
  alignmentSetting: "soft",
};

const PROBLEMS = sectionOf(assessmentCreatePageCopy, "problems");
const SENTENCE = itemLabel(PROBLEMS, "mode-not-entitled");
const PLANS = { href: "/pricing", label: itemLabel(PROBLEMS, "plans") };

function stage5Html(extra: Record<string, unknown> = {}): string {
  return renderToStaticMarkup(
    createElement(CreateRelationship, {
      copy: assessmentCreatePageCopy,
      stage: 5,
      template: TEMPLATE,
      draft: DRAFT,
      instanceRecordId: INSTANCE_ID,
      backHref: createCommitPath(TEMPLATE_SLUG),
      problem: null,
      problemLink: null,
      ...extra,
    }),
  );
}

describe("stage 5's plan notice (#834)", () => {
  it("draws the plan line as a status, not as a problem", () => {
    const html = stage5Html({ notice: SENTENCE, noticeLink: PLANS });

    expect(html).toContain('data-create-notice="true"');
    expect(html).toContain('role="status"');
    expect(html).toContain(SENTENCE);
    expect(html).toContain(itemLabel(PROBLEMS, "plans"));
    // The blocking band stays empty: nothing was refused.
    expect(html).not.toContain('data-create-problem="true"');
  });

  it("keeps the send control enabled, because nothing is being refused", () => {
    const withNotice = stage5Html({ notice: SENTENCE, noticeLink: PLANS });
    const without = stage5Html();

    // Same form, same button: the notice adds a line, not a lock.
    const sendButtons = (html: string) =>
      html.split("<button").filter((chunk) => chunk.includes("disabled")).length;
    expect(sendButtons(withNotice)).toBe(sendButtons(without));
  });

  it("draws nothing when the Mode is on the plan", () => {
    expect(stage5Html()).not.toContain("data-create-notice");
  });
});
