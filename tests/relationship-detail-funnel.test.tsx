/**
 * #873 — the relationship detail from both seats, as one rendered proof.
 *
 * The card asks for two things a screenshot cannot settle on its own:
 *
 *   1. **the initiator's draft funnel** — `edit → aspects → plan → publish` reachable on a
 *      `draft`. A camera sees what is on screen and says nothing about the step that is not;
 *      this file renders the real component over a real draft view and asserts each of the four
 *      affordances by its own marker, in the rail order the component declares.
 *   2. **the counterparty's read-only screen has a door** — the notice (#706) used to name three
 *      destinations in prose and link to none of them, which is the dead end the owner reported.
 *      It now carries one anchor to `RELATIONSHIPS_PATH`, labelled with this page's own
 *      `back`/`all` string, and this file asserts the `href` and the label rather than a sentence.
 *
 * The view literals are built here, not read from Postgres: `readMyRelationship()` is the boundary
 * where the flags are decided (and `tests/member-publish.test.ts` drives the derivation), and this
 * file starts where the component starts — the same seam `tests/relationship-publish-gate.test.tsx`
 * uses.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// The detail screen refreshes the band after an inline capture, so it reads the router. This file
// never presses a button; the stub exists only so a static render can reach `useRouter`.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
}));

import { RelationshipDetail } from "@/components/dashboard/relationship-detail";
import { assessments } from "@/data/assessments";
import { dashboardRelationshipDetailPageCopy } from "@/data/pages/dashboard-relationship-detail";
import { PRICING_PATH, RELATIONSHIPS_PATH } from "@/lib/flow/paths";
import type { MemberRelationshipView } from "@/lib/member/relationships";
import { itemLabel, sectionOf } from "@/lib/page-copy";

const template = assessments[0];
if (template === undefined) throw new Error("data/assessments.ts carries no template to draw");

/** The page's own strings, read from the fixture it ships — never typed into this file. */
const PUBLISH_SUBMIT = itemLabel(
  sectionOf(dashboardRelationshipDetailPageCopy, "publish"),
  "submit",
);
const ALL_RELATIONSHIPS = itemLabel(sectionOf(dashboardRelationshipDetailPageCopy, "back"), "all");
const GATE_HEADING = sectionOf(dashboardRelationshipDetailPageCopy, "publish-gate").heading;

function viewOf(input: {
  status: MemberRelationshipView["status"];
  hasPaymentMethod: boolean;
  isInitiator?: boolean;
  view?: MemberRelationshipView["view"];
}): MemberRelationshipView {
  const isInitiator = input.isInitiator ?? true;
  const draft = input.status === "draft";
  return {
    id: "relationship-873",
    status: input.status,
    viewerRole: isInitiator ? "initiator" : "counterparty",
    isInitiator,
    templateId: template.id,
    title: template.title,
    summary: template.summary,
    createdAt: "2026-11-01T00:00:00.000Z",
    publishedAt: draft ? null : "2026-11-02T00:00:00.000Z",
    sessionRecordId: null,
    aspectCount: template.items.length,
    invite: null,
    counterpartyName: "Rowan",
    initiatorName: "Avery",
    view: input.view ?? (draft ? "not-published" : "invite-missing"),
    membership: { state: "open", reason: null, endedAt: null, writable: true },
    template,
    // #706 — the two write flags the read derives, verbatim: `isInitiator && <status question>`.
    aspectsEditable: isInitiator && draft,
    publishable: isInitiator && draft,
    hasPaymentMethod: input.hasPaymentMethod,
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

/** The edit surface the page hands down when `readRelationshipEditState()` answered. */
const EDIT_PANEL = createElement("div", { "data-edit-panel": "stand-in" }, "edit surface");

function html(view: MemberRelationshipView): string {
  const noop = async () => ({ ok: true as const }) as never;
  return renderToStaticMarkup(
    createElement(RelationshipDetail, {
      copy: dashboardRelationshipDetailPageCopy,
      relationship: view,
      editPanel: EDIT_PANEL,
      onSaveAspects: noop,
      onPublish: noop,
      onRepublish: noop,
      onCapture: noop,
      onResolve: noop,
      onComplete: noop,
      onFork: noop,
      templatesHref: "/templates/relationship?view=mine",
    }),
  );
}

describe("#873 · the initiator's draft funnel", () => {
  it("step 1 — the edit surface is drawn, and drawn before the publish band", () => {
    const rendered = html(viewOf({ status: "draft", hasPaymentMethod: true }));
    expect(rendered).toContain('data-edit-panel="stand-in"');
    // Configuring comes before publishing: the panel order is the funnel's order.
    expect(rendered.indexOf('data-edit-panel="stand-in"')).toBeLessThan(
      rendered.indexOf('id="publish-name"'),
    );
  });

  it("step 2 — the Aspect editor is drawn on a draft, with its add control", () => {
    const rendered = html(viewOf({ status: "draft", hasPaymentMethod: true }));
    expect(rendered).toContain('data-relationship-aspects="true"');
    expect(rendered).toContain('data-aspect-list="true"');
    expect(rendered).toContain('data-aspect-add="true"');
  });

  it("step 3 — with no method on file, the plan door is drawn and the publish form is not", () => {
    const rendered = html(viewOf({ status: "draft", hasPaymentMethod: false }));
    expect(rendered).toContain('data-publish-gate="method-required"');
    expect(rendered).toContain(GATE_HEADING);
    expect(rendered).toContain(`href="${PRICING_PATH}"`);
    expect(rendered).not.toContain(PUBLISH_SUBMIT);
  });

  it("step 4 — with a method on file, the publish form and its button are drawn", () => {
    const rendered = html(viewOf({ status: "draft", hasPaymentMethod: true }));
    expect(rendered).toContain(PUBLISH_SUBMIT);
    expect(rendered).toContain('id="publish-name"');
    expect(rendered).toContain('id="publish-email"');
    expect(rendered).not.toContain('data-publish-gate="method-required"');
  });

  it("says nothing about a read-only seat to the person who owns the writes", () => {
    const rendered = html(viewOf({ status: "draft", hasPaymentMethod: true }));
    expect(rendered).not.toContain('data-relationship-read-only="counterparty"');
    expect(rendered).not.toContain('data-relationship-read-only-open="relationships"');
  });
});

describe("#873 · the counterparty's read-only screen has a way forward", () => {
  it("carries a real door to My Relationships, in the page's own words", () => {
    const rendered = html(
      viewOf({ status: "published", hasPaymentMethod: false, isInitiator: false }),
    );
    expect(rendered).toContain('data-relationship-read-only="counterparty"');
    expect(rendered).toContain('data-relationship-read-only-open="relationships"');
    expect(rendered).toContain(`href="${RELATIONSHIPS_PATH}"`);
    // The label is the fixture's `back`/`all` string — no new copy, and no dead button.
    expect(ALL_RELATIONSHIPS).not.toBe("all");
    expect(rendered).toContain(ALL_RELATIONSHIPS);
  });

  it("stays read-only: no editor, no publish form, no plan gate", () => {
    const rendered = html(
      viewOf({ status: "published", hasPaymentMethod: false, isInitiator: false }),
    );
    expect(rendered).not.toContain('data-aspect-list="true"');
    expect(rendered).not.toContain(PUBLISH_SUBMIT);
    expect(rendered).not.toContain('id="publish-name"');
    expect(rendered).not.toContain('data-publish-gate="method-required"');
  });

  it("draws the door on an unanswered draft-shaped read too — never a notice with no exit", () => {
    // A seat can be bound while the initiator has published and nobody has claimed: the notice and
    // its door are one element, so there is no state in which the sentence appears alone.
    const rendered = html(
      viewOf({
        status: "published",
        hasPaymentMethod: true,
        isInitiator: false,
        view: "invite-live",
      }),
    );
    expect(rendered).toContain('data-relationship-read-only-open="relationships"');
  });
});
