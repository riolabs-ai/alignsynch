/**
 * The hard gate at publish (#690) — **the acceptance that must be a test, not a screenshot.**
 *
 * The approved flow makes payment a soft prompt at the invite and a hard gate at publish: the two
 * plans on stage 4 are optional, and a relationship created without one is created and invited like
 * any other. Publishing is the step that needs a card on file, and the way it says so is that it
 * **draws no publish control at all** — not a disabled button, not a form whose submit a server
 * would refuse, and not a warning beside a control that still works.
 *
 * A screenshot cannot prove an absence: a camera sees the button that is there and says nothing
 * about the one that is not. So this file renders the real component over a real view, twice, and
 * asserts the presence and the absence of the control by name:
 *
 *   - no method on file → the gate band (`data-publish-gate="method-required"`) and no submit;
 *   - a method on file → the publish form and its button, and no gate band;
 *   - already published → neither, because there is nothing left to publish.
 *
 * The fact itself is `MemberRelationshipView.hasPaymentMethod`, read from
 * `relationship_payment.method_captured_at` by `readMyRelationship()`; this file starts at the view
 * because that is where the component starts.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// #739 — the detail screen refreshes the band after an inline capture, so it reads the router.
// This file never presses a button; the stub exists only so a static render can reach `useRouter`.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
}));

import { RelationshipDetail } from "@/components/dashboard/relationship-detail";
import { assessments } from "@/data/assessments";
import { dashboardRelationshipDetailPageCopy } from "@/data/pages/dashboard-relationship-detail";
import { PRICING_PATH } from "@/lib/flow/paths";
import type { MemberRelationshipView } from "@/lib/member/relationships";
import { itemLabel, sectionOf } from "@/lib/page-copy";

/** The platform's first authored template — a real record, so the Aspects band draws. */
const template = assessments[0];
if (template === undefined) throw new Error("data/assessments.ts carries no template to draw");

/** The publish control's own label, from the fixture — never typed into this test. */
const PUBLISH_SUBMIT = itemLabel(
  sectionOf(dashboardRelationshipDetailPageCopy, "publish"),
  "submit",
);
const GATE_HEADING = sectionOf(dashboardRelationshipDetailPageCopy, "publish-gate").heading;

function viewOf(input: {
  status: MemberRelationshipView["status"];
  hasPaymentMethod: boolean;
  isInitiator?: boolean;
}): MemberRelationshipView {
  const isInitiator = input.isInitiator ?? true;
  return {
    id: "relationship-publish-gate",
    status: input.status,
    viewerRole: isInitiator ? "initiator" : "counterparty",
    isInitiator,
    templateId: template.id,
    title: template.title,
    summary: template.summary,
    createdAt: "2026-11-01T00:00:00.000Z",
    publishedAt: input.status === "draft" ? null : "2026-11-02T00:00:00.000Z",
    sessionRecordId: null,
    aspectCount: template.items.length,
    invite: null,
    counterpartyName: "Rowan",
    initiatorName: "Avery",
    view: input.status === "draft" ? "not-published" : "invite-missing",
    membership: { state: "open", reason: null, endedAt: null, writable: true },
    template,
    aspectsEditable: isInitiator && input.status === "draft",
    publishable: isInitiator && input.status === "draft",
    hasPaymentMethod: input.hasPaymentMethod,
    // #739 — this file's fixture is publish-time: a relationship with no session has nothing to
    // complete, which is exactly `completion: null`.
    completion: null,
    offersRepublish: false,
    trialWithoutLiveInvite: false,
    closed: false,
    trial: "none",
    trialEndsAt: null,
    lapseSentence: null,
    inviteLinkAvailable: false,
  };
}

/** The component's three callbacks, none of which this file calls: it renders, it does not press. */
function html(view: MemberRelationshipView): string {
  const noop = async () => ({ ok: true as const }) as never;
  return renderToStaticMarkup(
    createElement(RelationshipDetail, {
      copy: dashboardRelationshipDetailPageCopy,
      relationship: view,
      backHref: "/dashboard/relationships",
      onSaveAspects: noop,
      onPublish: noop,
      onRepublish: noop,
      onCapture: noop,
      onResolve: noop,
      onComplete: noop,
    }),
  );
}

describe("publish without a method on file", () => {
  it("renders no publish control at all", () => {
    const rendered = html(viewOf({ status: "draft", hasPaymentMethod: false }));
    expect(rendered).not.toContain(PUBLISH_SUBMIT);
    expect(rendered).not.toContain("data-publish-refusal");
    // The form's own fields would be a control by another name.
    expect(rendered).not.toContain('id="publish-name"');
  });

  it("says why, and names the page where a method is added", () => {
    const rendered = html(viewOf({ status: "draft", hasPaymentMethod: false }));
    expect(rendered).toContain('data-publish-gate="method-required"');
    expect(rendered).toContain(GATE_HEADING);
    expect(rendered).toContain(`data-publish-gate-link="pricing"`);
    expect(rendered).toContain(`href="${PRICING_PATH}"`);
  });
});

describe("publish with a method on file", () => {
  it("renders the form and its button, and no gate band", () => {
    const rendered = html(viewOf({ status: "draft", hasPaymentMethod: true }));
    expect(rendered).toContain(PUBLISH_SUBMIT);
    expect(rendered).toContain('id="publish-name"');
    expect(rendered).not.toContain('data-publish-gate="method-required"');
  });
});

describe("a relationship that is already published", () => {
  it("offers neither, whatever the payment facts say", () => {
    const rendered = html(viewOf({ status: "published", hasPaymentMethod: false }));
    expect(rendered).not.toContain(PUBLISH_SUBMIT);
    expect(rendered).not.toContain('data-publish-gate="method-required"');
  });
});

/**
 * #706 — the Counterparty's screen is the same page, read-only.
 *
 * The read hands this viewer `aspectsEditable: false` and `publishable: false` on purpose; what
 * this block holds is that the component turns those two facts into **absent surfaces**, and that
 * it says why rather than leaving three missing panels to be guessed at.
 */
describe("a Counterparty's detail screen", () => {
  it("draws no editor, no publish form and no reissue control", () => {
    const rendered = html(viewOf({ status: "draft", hasPaymentMethod: true, isInitiator: false }));
    expect(rendered).not.toContain("data-aspect-editor");
    expect(rendered).not.toContain(PUBLISH_SUBMIT);
    expect(rendered).not.toContain('id="publish-name"');
    expect(rendered).not.toContain('data-publish-gate="method-required"');
  });

  it("says which seat it is, and that the screen is read-only", () => {
    const rendered = html(viewOf({ status: "draft", hasPaymentMethod: true, isInitiator: false }));
    expect(rendered).toContain('data-viewer-role="counterparty"');
    expect(rendered).toContain('data-relationship-read-only="counterparty"');
  });
});
