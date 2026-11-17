/**
 * The publish control on the relationship detail — **the acceptance that must be a test, not a
 * screenshot.**
 *
 * #1140 — this file used to pin a *gate band*: a second `DetailPanel` drawn when the relationship had
 * no live membership, with no publish form at all. The band could not be reached. `publishable()` is
 * `draft|pending` (`lib/member/publish-basis.ts`) and `membershipOf()` answers `writable: true` for
 * exactly those statuses (`lib/relationship/membership.ts`, pinned in
 * `tests/relationship-membership.test.ts`), so "publishable and has no membership" had no state to
 * be true in — and the read that answered it has been deleted with the band (#1140, owner decision
 * A). What is left is one question, and this file holds its three shapes.
 *
 * A screenshot cannot prove an absence: a camera sees the button that is there and says nothing
 * about the one that is not. So this file renders the real component over a real view and asserts
 * the presence and the absence of the control by name:
 *
 *   - a draft, initiator → the publish form and its button, and no gate band (there is no such band);
 *   - already published → no submit, because there is nothing left to publish;
 *   - a draft-shaped Counterparty view → no submit, because the seat owns no write (#706).
 *
 * The fact itself is `MemberRelationshipView.publishable`, derived as
 * `isInitiator && publishable(status)` by `readMyRelationship()`; this file starts at the view
 * because that is where the component starts.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// The detail screen refreshes the band after an inline write, so it reads the router. This file
// never presses a button; the stub exists only so a static render can reach `useRouter`.
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

function viewOf(input: {
  status: MemberRelationshipView["status"];
  isInitiator?: boolean;
}): MemberRelationshipView {
  const isInitiator = input.isInitiator ?? true;
  return {
    id: "relationship-publish-gate",
    status: input.status,
    viewerRole: isInitiator ? "initiator" : "counterparty",
    isInitiator,
    templateId: template.id,
    templateSlug: template.slug,
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
    /* #785 — the fork is not this file's subject; `tests/relationship-fork.test.tsx` drives it. */
    canForkTemplate: false,
  };
}

/** The component's three callbacks, none of which this file calls: it renders, it does not press. */
function html(view: MemberRelationshipView): string {
  const noop = async () => ({ ok: true as const }) as never;
  return renderToStaticMarkup(
    createElement(RelationshipDetail, {
      copy: dashboardRelationshipDetailPageCopy,
      relationship: view,
      onSaveAspects: noop,
      onPublish: noop,
      onRepublish: noop,
      onComplete: noop,
      onFork: noop,
      templatesHref: "/templates/relationship?view=mine",
    }),
  );
}

describe("a draft the initiator owns", () => {
  it("draws the publish form and its button", () => {
    const rendered = html(viewOf({ status: "draft" }));
    expect(rendered).toContain(PUBLISH_SUBMIT);
    expect(rendered).toContain('id="publish-name"');
    expect(rendered).toContain('id="publish-email"');
  });

  it("draws no gate band — there is no second surface between this screen and its submit", () => {
    const rendered = html(viewOf({ status: "draft" }));
    // The marker the deleted band carried, and the door it was the only user of: both gone (#1140).
    expect(rendered).not.toContain("data-publish-gate");
    expect(rendered).not.toContain(`href="${PRICING_PATH}"`);
  });
});

describe("a relationship that is already published", () => {
  it("offers no submit, because there is nothing left to publish", () => {
    const rendered = html(viewOf({ status: "published" }));
    expect(rendered).not.toContain(PUBLISH_SUBMIT);
    expect(rendered).not.toContain('id="publish-name"');
    expect(rendered).not.toContain("data-publish-gate");
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
    const rendered = html(viewOf({ status: "draft", isInitiator: false }));
    expect(rendered).not.toContain("data-aspect-editor");
    expect(rendered).not.toContain(PUBLISH_SUBMIT);
    expect(rendered).not.toContain('id="publish-name"');
  });

  it("says which seat it is, and that the screen is read-only", () => {
    const rendered = html(viewOf({ status: "draft", isInitiator: false }));
    expect(rendered).toContain('data-viewer-role="counterparty"');
    expect(rendered).toContain('data-relationship-read-only="counterparty"');
  });
});
