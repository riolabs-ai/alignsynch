/**
 * **#975 D10 (`t_90026133`) — a payment started from the dashboard stays on the dashboard.**
 *
 * The row: `/dashboard/relationships/<own draft>` → *Open the payment step* dropped the reader into
 * stage 5 of the creation flow, and that stage's `Cancel` left to the **template library** instead
 * of back to the relationship. Two faults behind one symptom, and this file pins the first:
 *
 *   - **the door was a document load.** `payHref` was drawn as a bare `<a>`, so the navigation was a
 *     new document. This segment declares the create flow's `@flow` slot
 *     (`app/(mainlayout)/dashboard/relationships/layout.tsx`), which only intercepts a *client-side*
 *     navigation — so the dashboard page was torn down and the stage rendered as a page of its own.
 *     A `FlowEntryLink` is the same address entered softly, which is what makes the stage a dialog
 *     over the relationship rather than a screen instead of it, and it remembers the relationship as
 *     the flow's origin, so the dialog closes back onto it.
 *   - **the surface is read off the render, never typed here.** Both facts below come from the
 *     control's own markup in the page `RelationshipDetail` renders: its `href` (both #794 handles,
 *     built by `createInviteForPath`) and its `data-flow-entry` marker. A path written into this test
 *     from memory would prove only that the test agrees with itself.
 *
 * #1140 — **this file used to assert two doors, and the surviving one carries both facts.** The
 * membership gate band drew `Publish to Counterparty` and a second `Invite Members`; the band was
 * unreachable (`publishable()` is `draft|pending`, where `membershipOf()` already answers
 * `writable: true`) and it has been deleted. The publish panel's own `Invite Members`
 * (`data-invite-members`) is now the only door drawn from `payHref`, so the soft-navigation
 * assertion moved onto it rather than dying with the band.
 *
 * `payHref === null` — a draft with **no session** — is asserted unchanged (#912): that shape has no
 * stage 5 to open, so no door into it is drawn at all, and the publish form is still drawn. It is
 * the case a fix must not resurrect.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: import("react").ReactNode }) =>
    createElement("a", { href, ...rest }, children),
}));

import { RelationshipDetail } from "@/components/dashboard/relationship-detail";
import { assessments } from "@/data/assessments";
import { dashboardRelationshipDetailPageCopy } from "@/data/pages/dashboard-relationship-detail";
import { createInviteForPath } from "@/lib/flow/paths";
import type { MemberRelationshipView } from "@/lib/member/relationships";
import { itemLabel, sectionOf } from "@/lib/page-copy";

const template = assessments[0];
if (template === undefined) throw new Error("data/assessments.ts carries no template to draw");

/** The session stage 4 wrote for this draft — the handle stage 5 is keyed by. */
const SESSION = "session-abc123";
/** The address the pay walk answers, built by the product's own path helper. */
const PAY_PATH = createInviteForPath(template.slug, SESSION);
/** The publish panel's submit, from the fixture — the control that must survive a missing session. */
const PUBLISH_SUBMIT = itemLabel(
  sectionOf(dashboardRelationshipDetailPageCopy, "publish"),
  "submit",
);

/** One draft of this account's, with the two facts this row is about. */
function viewOf(sessionRecordId: string | null): MemberRelationshipView {
  return {
    id: "relationship-pay-door",
    status: "draft",
    viewerRole: "initiator",
    isInitiator: true,
    templateId: template.id,
    templateSlug: template.slug,
    title: template.title,
    summary: template.summary,
    createdAt: "2026-11-01T00:00:00.000Z",
    publishedAt: null,
    sessionRecordId,
    aspectCount: template.items.length,
    invite: null,
    counterpartyName: "Rowan",
    initiatorName: "Avery",
    view: "not-published",
    membership: { state: "open", reason: null, endedAt: null, writable: true },
    template,
    aspectsEditable: true,
    publishable: true,
    completion: null,
    offersRepublish: false,
    trialWithoutLiveInvite: false,
    closed: false,
    trial: "none",
    trialEndsAt: null,
    lapseSentence: null,
    inviteLinkAvailable: false,
    canForkTemplate: false,
  };
}

/** The rendered page. Callbacks are never pressed here — this file reads markup. */
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
      /* #1121 — none of these suites presses the free week; the stub exists so the screen renders. */
      onClaimExtension: noop,
      templatesHref: "/templates/relationship?view=mine",
    }),
  );
}

/** The opening tag of the anchor that carries `marker`, read off the render. */
function anchorWith(rendered: string, marker: string): string {
  const at = rendered.indexOf(marker);
  if (at < 0) throw new Error(`the page rendered no control carrying ${marker}`);
  const start = rendered.lastIndexOf("<a ", at);
  const end = rendered.indexOf(">", at);
  expect(start, `${marker} is not inside an anchor`).toBeGreaterThan(-1);
  return rendered.slice(start, end + 1);
}

describe("the payment step, opened from the relationship", () => {
  it("enters the pay address as a flow entry, so stage 5 renders over this page and not instead of it", () => {
    const rendered = html(viewOf(SESSION));

    const door = anchorWith(rendered, 'data-invite-members="true"');
    // The address, from the page itself: both #794 handles, the slug in the path and the session in
    // `?instance=`.
    expect(door).toContain(`href="${PAY_PATH}"`);
    // And the fact that makes it a dialog: only `FlowEntryLink` carries the marker, and only a soft
    // navigation is intercepted by the `@flow` slot. A bare `<a>` here was the defect.
    expect(door).toContain('data-flow-entry="true"');
    // The door names itself to the dialog, so closing can hand focus back to the same control after
    // the underlying page re-renders.
    expect(door).toContain(`data-flow-entry-id="${PAY_PATH}"`);
  });

  it("draws exactly one door to the pay walk — the publish panel's, not a band's", () => {
    const rendered = html(viewOf(SESSION));
    const entries = rendered.match(/data-flow-entry="true"/g) ?? [];
    expect(entries).toHaveLength(1);
    // And the publish form it sits above is the surface the draft actually owns.
    expect(rendered).toContain(PUBLISH_SUBMIT);
  });
});

describe("a draft with no session", () => {
  it("draws no door into stage 5 at all, and still draws the publish form", () => {
    const rendered = html(viewOf(null));

    // Nothing points at the pay walk: there is no session for stage 5 to read.
    expect(rendered).not.toContain("/create/invite");
    expect(rendered).not.toContain("data-flow-entry");
    expect(rendered).not.toContain('data-invite-members="true"');
    // The suppression is the door's, not the panel's: the form and its submit are still drawn.
    expect(rendered).toContain(PUBLISH_SUBMIT);
    expect(rendered).toContain('id="publish-name"');
  });
});
