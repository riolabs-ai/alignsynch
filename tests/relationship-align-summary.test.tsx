/**
 * #rect-04 — **the Align summary on the relationship's own page.**
 *
 * `guides/shared/results-and-align.md` promises that *"when you've both answered, Align puts your
 * answers side by side"*, and bundle 04's reference photographs the screen that keeps it: the
 * heading, the tally (*"3 of 5 Aspects Aligned · 1 In Synch · 2 Small Gap · 2 Gap"*) and a Next Step
 * band naming the widest Gap with one door into the Discussion.
 *
 * Before this card the page reached the both-answered state and still said *"Next Step · Continue
 * Your Assessment"* over *"5 of 5 Aspects answered"* — a verb the state had outgrown — and the
 * results sat behind a separate *"Complete and open the Gap"* act. So the claims asserted here are
 * one per half of that delta:
 *
 *   the summary   the heading, the tally figure and its three status words come off the same
 *                 `AlignmentSummary` the card reads (the numbers are `alignmentSummaryOf()`'s).
 *   one Next Step `align` present means the answering band is gone; absent means it is what the rail
 *                 still draws — never both, and never "Continue" over five answered Aspects.
 *
 * The summary is built here by calling `alignmentSummaryOf()` on five answer sheets rather than by
 * hand-writing a literal: a fixture object with the right numbers would pass even if the derivation
 * the page depends on had broken.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// The screen refreshes after a write, so it reads the router. No test here presses a button.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
}));

import { RelationshipDetail } from "@/components/dashboard/relationship-detail";
import { assessments } from "@/data/assessments";
import { dashboardRelationshipDetailPageCopy } from "@/data/pages/dashboard-relationship-detail";
import { type AspectAnswers, alignmentSummaryOf } from "@/lib/member/alignment-summary";
import type { MemberRelationshipView } from "@/lib/member/relationships";

const record = (() => {
  const found = assessments.find((entry) => entry.id === "assessment-relationship-basics");
  if (found === undefined) throw new Error("assessment-relationship-basics is not a fixture");
  return found;
})();

/**
 * Five Aspects that produce the reference's own line: **3 of 5 Aspects Aligned · 1 In Synch · 2
 * Small Gap · 2 Gap**, with Parent Decisions (a Feel Gap of 3) the widest — which is the
 * reference's own Next Step.
 */
const ANSWER_SHEETS: readonly AspectAnswers[] = [
  {
    itemId: "item-contact",
    position: 1,
    prompt: "Contact Frequency",
    initiator: { feel: 3, wish: 3 },
    counterparty: { feel: 3, wish: 3 },
  },
  {
    itemId: "item-roles",
    position: 2,
    prompt: "Old Roles",
    initiator: { feel: 3, wish: 3 },
    counterparty: { feel: 4, wish: 4 },
  },
  {
    itemId: "item-support",
    position: 3,
    prompt: "Showing Up",
    initiator: { feel: 4, wish: 4 },
    counterparty: { feel: 3, wish: 3 },
  },
  {
    itemId: "item-respect",
    position: 4,
    prompt: "Feeling Respected",
    initiator: { feel: 4, wish: 4 },
    counterparty: { feel: 2, wish: 2 },
  },
  {
    itemId: "item-parents",
    position: 5,
    prompt: "Parent Decisions",
    initiator: { feel: 2, wish: 4 },
    counterparty: { feel: 5, wish: 4 },
  },
];

function view(overrides: Partial<MemberRelationshipView> = {}): MemberRelationshipView {
  return {
    id: "relationship-rect04",
    status: "active",
    viewerRole: "initiator",
    isInitiator: true,
    templateId: record.id,
    templateSlug: record.slug,
    title: record.title,
    relationshipTitle: "Avery B – Rowan",
    summary: record.summary,
    createdAt: "2026-10-28T18:30:00.000Z",
    publishedAt: "2026-10-29T12:00:00.000Z",
    sessionRecordId: "assessment-instance-avery-rowan",
    aspectCount: 5,
    viewerAnswered: 5,
    invite: { claimed: true, revoked: false, expiresAt: new Date("2026-11-12T12:00:00.000Z") },
    counterpartyName: "Rowan",
    counterpartySeatName: "Rowan",
    initiatorName: "Avery",
    view: "invite-claimed",
    membership: { state: "open", reason: null, endedAt: null, writable: true },
    template: record,
    aspectsEditable: false,
    publishable: false,
    completion: null,
    offersRepublish: false,
    trialWithoutLiveInvite: false,
    closed: false,
    trial: "active",
    trialEndsAt: "2026-11-05T12:00:00.000Z",
    lapseSentence: null,
    inviteLinkAvailable: false,
    canForkTemplate: false,
    ...overrides,
  };
}

function html(align: ReturnType<typeof alignmentSummaryOf> | null): string {
  const noop = async () => ({ ok: true as const }) as never;
  return renderToStaticMarkup(
    createElement(RelationshipDetail, {
      copy: dashboardRelationshipDetailPageCopy,
      relationship: view(),
      align,
      onSaveAspects: noop,
      onPublish: noop,
      onRepublish: noop,
      onComplete: noop,
      onFork: noop,
      onClaimExtension: noop,
      templatesHref: "/templates/relationship?view=mine",
    }),
  );
}

function textOf(markup: string): string {
  return markup
    .replace(/<[^>]*>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#x2F;/g, "/")
    .replace(/\s+/g, " ")
    .trim();
}

const summary = alignmentSummaryOf("soft", ANSWER_SHEETS);

describe("#rect-04 — the Align summary the doc promises", () => {
  it("draws the reference's heading and its one-sentence promise", () => {
    const text = textOf(html(summary));

    expect(text).toContain("Where You Agree, and Where You Differ");
    expect(text).toContain(
      "Both answers on every Aspect, side by side. Start with the widest Gap.",
    );
  });

  it("prints the tally in the reference's words — 3 of 5 Aspects Aligned", () => {
    const markup = html(summary);

    expect(textOf(markup)).toContain("3 of 5 Aspects Aligned");
    /* The three status words, each with its own count, beside the figure they add up to. */
    expect(markup).toContain('data-align-count="in-synch"');
    expect(markup).toContain('data-align-count="small-gap"');
    expect(markup).toContain('data-align-count="gap"');
    expect(textOf(markup)).toContain("In Synch");
    expect(textOf(markup)).toContain("Small Gap");
  });

  it("names the widest Gap in the Next Step band and opens the Discussion", () => {
    const markup = html(summary);
    const text = textOf(markup);

    expect(markup).toContain('data-align-next-step="item-parents"');
    expect(text).toContain("Talk About Your Widest Gap");
    expect(text).toContain(
      "“Parent Decisions” is 3 steps apart — the widest on this relationship. Start there.",
    );
    expect(text).toContain("Start the Conversation");
    /* The door is the tab layer's own hash — a Discussion, not a route that leaves the record. */
    expect(markup).toMatch(/href="#discussion"[^>]*data-align-conversation="true"/);
  });

  it("retires the answering band once both sheets are in", () => {
    const withAlign = textOf(html(summary));

    expect(withAlign).not.toContain("Continue Your Assessment");
    expect(withAlign).not.toContain("5 of 5 Aspects answered");
    expect(withAlign).not.toContain("Continue Assessment");
  });

  it("still draws the answering band while the pair has not both finished", () => {
    const text = textOf(html(null));

    expect(text).toContain("Continue Your Assessment");
    expect(text).toContain("5 of 5 Aspects answered");
    expect(text).not.toContain("Where You Agree, and Where You Differ");
  });

  it("offers no Next Step when nothing is out of tolerance", () => {
    const allAligned = alignmentSummaryOf("soft", [
      {
        itemId: "item-contact",
        position: 1,
        prompt: "Contact Frequency",
        initiator: { feel: 3, wish: 3 },
        counterparty: { feel: 3, wish: 3 },
      },
    ]);
    const markup = html(allAligned);
    const text = textOf(markup);

    expect(markup).toContain('data-align-summary="nothing-left"');
    expect(text).toContain("Every Aspect is aligned");
    expect(text).not.toContain("Start the Conversation");
    expect(text).not.toContain("Talk About");
  });
});
