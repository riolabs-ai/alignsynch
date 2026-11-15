/**
 * #936 — the relationship detail draws the relationship's **own** Aspects, in both of its lists.
 *
 * Two halves, and the first is the bug:
 *
 *   1. **which record the list lives on.** `aspectsRecordOf()` is the one answer, and it is the
 *      seam the read and the save share. A relationship the flow created keeps its Aspects on the
 *      session's copy — `template_id` names the template it was copied *from*, because V23 pins the
 *      version to that template — so reading `template_id` drew the catalogue's list and never the
 *      creator's added row. These cases pin both shapes: copy-wins-when-there-is-a-session, and
 *      the member write's private copy when there is not.
 *   2. **that the screen has no list of its own.** Whatever `MemberRelationshipView.template.items`
 *      holds is what both the editor (a draft) and the frozen list (anything else) render — no
 *      second source, no filter. The renders below hand the page a view built the way the read now
 *      builds it and assert the added Aspect is in the editor *and* in the frozen list.
 */
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// The detail screen's band reads the router; this file never presses a button.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
}));

import { RelationshipDetail } from "@/components/dashboard/relationship-detail";
import { assessments } from "@/data/assessments";
import { dashboardRelationshipDetailPageCopy } from "@/data/pages/dashboard-relationship-detail";
import type { Assessment } from "@/content/assessment";
import type { MemberRelationshipView } from "@/lib/member/relationships";
import { aspectsRecordOf } from "@/lib/member/relationships";

const template = assessments[0];
if (template === undefined) throw new Error("data/assessments.ts carries no template to draw");

/** The fourth Aspect the owner typed at stage 3 — in the copy, never in the template. */
const ADDED_PROMPT = "Do we say thank you?";

describe("#936 · which record a relationship's Aspects live on", () => {
  it("is the session's copy when the flow created the relationship", () => {
    // `createInstanceFromTemplate()`: `template_id` names the template it copied, the list is the
    // session's record. This is the pair that made the added Aspect invisible.
    expect(
      aspectsRecordOf({
        templateId: "assessment-business-staff-manager",
        sessionRecordId: "inst-1",
      }),
    ).toBe("inst-1");
  });

  it("is the private copy when the member write created it — a draft has no session yet", () => {
    // `createRelationship()`: `template_id` IS the copy, so the template-shaped answer is right.
    expect(aspectsRecordOf({ templateId: "member-config-1", sessionRecordId: null })).toBe(
      "member-config-1",
    );
  });

  it("never answers `template_id` for a relationship that has a session", () => {
    // The whole defect in one assertion: a session's record always wins, so a copy is never
    // replaced by the template it was copied from.
    expect(aspectsRecordOf({ templateId: "t", sessionRecordId: "s" })).not.toBe("t");
  });
});

/** A view built the way `readMyRelationship()` builds one: the copy's items, the template's slug. */
function viewOf(input: {
  readonly status: MemberRelationshipView["status"];
  readonly items: Assessment["items"];
}): MemberRelationshipView {
  const isInitiator = true;
  const draft = input.status === "draft";
  return {
    id: "relationship-936",
    status: input.status,
    viewerRole: "initiator",
    isInitiator,
    templateId: "instance-copy-936",
    templateSlug: template.slug,
    title: template.title,
    summary: template.summary,
    createdAt: "2026-11-01T00:00:00.000Z",
    publishedAt: draft ? null : "2026-11-02T00:00:00.000Z",
    sessionRecordId: "instance-copy-936",
    aspectCount: input.items.length,
    invite: null,
    counterpartyName: "Rowan",
    initiatorName: "Avery",
    view: draft ? "not-published" : "invite-missing",
    membership: { state: "open", reason: null, endedAt: null, writable: true },
    template: { ...template, items: input.items },
    aspectsEditable: isInitiator && draft,
    publishable: isInitiator && draft,
    hasMembership: true,
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

function html(view: MemberRelationshipView, editTrigger: ReactNode = null): string {
  const noop = async () => ({ ok: true as const }) as never;
  return renderToStaticMarkup(
    createElement(RelationshipDetail, {
      copy: dashboardRelationshipDetailPageCopy,
      relationship: view,
      editTrigger,
      onSaveAspects: noop,
      onPublish: noop,
      onRepublish: noop,
      onComplete: noop,
      onFork: noop,
      templatesHref: "/templates/relationship?view=mine",
    }),
  );
}

describe("#936 · the detail draws the list the read handed it", () => {
  const items: Assessment["items"] = [
    ...template.items,
    {
      id: "aspect-936-added",
      prompt: ADDED_PROMPT,
      scale: { kind: "score", min: 1, max: 5 },
      leftValue: "Never",
      rightValue: "Daily",
    },
  ];

  it("the editor (a draft, the initiator) lists the added Aspect", () => {
    const rendered = html(viewOf({ status: "draft", items }));
    expect(rendered).toContain('data-aspect-list="true"');
    expect(rendered).toContain(ADDED_PROMPT);
  });

  it("the frozen list (a published relationship) lists it too", () => {
    // `aspectsEditable` gates the editor, not visibility: a published relationship still shows the
    // words the pair were asked, and the added one is one of them.
    const rendered = html(viewOf({ status: "published", items }));
    expect(rendered).not.toContain('data-aspect-list="true"');
    expect(rendered).toContain(ADDED_PROMPT);
  });

  it("draws the copy's whole list, in the order the read sorted it", () => {
    const rendered = html(viewOf({ status: "draft", items }));
    const positions = items.map((item) => rendered.indexOf(item.prompt));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((left, right) => left - right));
  });
});
