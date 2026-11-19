/**
 * The v2 rectification, bundle 03 — **the At a Glance card, the Payment tab's summary, and the two
 * sentences the reference draws that the live page did not.**
 *
 * Four claims, and each is a way the port could have gone wrong:
 *
 *   the tally      the card prints the numbers `alignmentSummaryOf()` produced, not a second
 *                  subtraction and never a zero: an unanswered round draws no tally at all
 *   the round      Mode, Alignment Tolerance and Latest Round come from the Settings read and the
 *                  session row; with none of them the card is absent, which is the old screen
 *   the payment    the Initiator's tab is the reference's summary table, and a paused window says
 *                  so instead of printing a countdown it does not have
 *   the no-leak    the Counterparty's tab still carries no price, no trial and no card word — the
 *                  copy rules' rule 4, asserted where the row would have been added
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// The screen refreshes after a write, so it reads the router. No test here presses a button; the
// stub exists only so a static render can reach `useRouter`.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
}));

import { RelationshipDetail } from "@/components/dashboard/relationship-detail";
import { PaymentPanel } from "@/components/dashboard/relationship-panels";
import { assessments } from "@/data/assessments";
import { dashboardRelationshipDetailPageCopy } from "@/data/pages/dashboard-relationship-detail";
import {
  type AlignmentSummary,
  type AspectAnswers,
  alignmentSummaryOf,
} from "@/lib/member/alignment-summary";
import type { MemberRelationshipView } from "@/lib/member/relationships";

const record = (() => {
  const found = assessments.find((entry) => entry.id === "assessment-relationship-basics");
  if (found === undefined) throw new Error("assessment-relationship-basics is not a fixture");
  return found;
})();

/** Five Aspects, three In Synch, one Small Gap and one Gap under Soft — the reference's own shape. */
const ANSWERS: readonly AspectAnswers[] = [
  { itemId: "a1", position: 1, prompt: "Contact Frequency", feel: [3, 3], wish: [3, 3] },
  { itemId: "a2", position: 2, prompt: "Old Roles", feel: [2, 2], wish: [4, 4] },
  { itemId: "a3", position: 3, prompt: "Showing Up", feel: [5, 5], wish: [1, 1] },
  { itemId: "a4", position: 4, prompt: "Parent Decisions", feel: [3, 4], wish: [4, 4] },
  { itemId: "a5", position: 5, prompt: "Feeling Respected", feel: [1, 4], wish: [2, 2] },
].map((row) => ({
  itemId: row.itemId,
  position: row.position,
  prompt: row.prompt,
  initiator: { feel: row.feel[0] as 1 | 2 | 3 | 4 | 5, wish: row.wish[0] as 1 | 2 | 3 | 4 | 5 },
  counterparty: {
    feel: row.feel[1] as 1 | 2 | 3 | 4 | 5,
    wish: row.wish[1] as 1 | 2 | 3 | 4 | 5,
  },
}));

const ALIGNMENT: AlignmentSummary = alignmentSummaryOf("soft", ANSWERS);

function view(overrides: Partial<MemberRelationshipView> = {}): MemberRelationshipView {
  return {
    id: "relationship-rect03",
    status: "published",
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
    round: 1,
    roundStartedAt: "2026-11-15T12:00:00.000Z",
    aspectCount: record.items.length,
    invite: { claimed: true, revoked: false, expiresAt: new Date("2026-11-12T12:00:00.000Z") },
    counterpartyName: "Rowan",
    counterpartySeatName: "Rowan",
    initiatorName: "Avery",
    view: "invite-claimed",
    membership: { state: "open", reason: null, endedAt: null, writable: true },
    template: record,
    aspectsEditable: false,
    publishable: false,
    completion: { sealed: true },
    offersRepublish: false,
    trialWithoutLiveInvite: false,
    closed: false,
    trial: "active",
    trialEndsAt: "2026-11-19T12:00:00.000Z",
    lapseSentence: null,
    inviteLinkAvailable: false,
    canForkTemplate: true,
    ...overrides,
  };
}

function html({
  overrides = {},
  settings = { mode: "basic", setting: "soft" },
  alignment = ALIGNMENT as AlignmentSummary | null | undefined,
  round = { ordinal: 1, startedAt: "2026-11-15T12:00:00.000Z" },
}: {
  overrides?: Partial<MemberRelationshipView>;
  settings?: { mode: string; setting: string };
  alignment?: AlignmentSummary | null;
  round?: { ordinal: number; startedAt: string } | null;
} = {}): string {
  const noop = async () => ({ ok: true as const }) as never;
  return renderToStaticMarkup(
    createElement(RelationshipDetail, {
      copy: dashboardRelationshipDetailPageCopy,
      relationship: view(overrides),
      settings,
      alignment,
      round,
      planPrice: "$9.99",
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
    .replace(/\s+/g, " ")
    .trim();
}

describe("the At a Glance card — the reference's tally, with the model's own numbers", () => {
  it("prints the aligned figure the derivation produced, never a second count", () => {
    const markup = html();
    const tally = textOf(markup);
    expect(tally).toContain(`${ALIGNMENT.aligned} of ${ALIGNMENT.total} Aspects Aligned`);
    expect(tally).toContain(`${ALIGNMENT.tally.inSynch} In Synch`);
    expect(tally).toContain(`${ALIGNMENT.tally.smallGap} Small Gap`);
    expect(tally).toContain(`${ALIGNMENT.tally.gap} Gap`);
    // One mark per Aspect, each carrying the Aspect's own word.
    expect([...markup.matchAll(/data-glance-mark="([^"]+)"/g)].map((m) => m[1])).toEqual(
      ALIGNMENT.aspects.map((aspect) => aspect.status),
    );
  });

  it("draws Mode and Alignment Tolerance from the Settings the tab already reads", () => {
    const rendered = textOf(html());
    expect(rendered).toContain("Mode");
    // Basic Mode asks two opinions, and the count is derived from the mode rather than typed here.
    expect(rendered).toContain("Basic · 2 Opinions");
    expect(rendered).toContain("Alignment Tolerance");
    expect(rendered).toContain("Soft · Small Gap OK");
  });

  it("counts four opinions in Advanced Mode and names the stricter Setting", () => {
    const rendered = textOf(html({ settings: { mode: "advanced", setting: "full" } }));
    expect(rendered).toContain("Advanced · 4 Opinions");
    expect(rendered).toContain("Full · No Gap OK");
  });

  it("names the round from the read, and links to the Gap it opened", () => {
    const markup = html();
    expect(textOf(markup)).toMatch(/Round 1 · .*2026/);
    expect(markup).toContain('data-glance-align="true"');
    expect(markup).toMatch(/href="[^"]*\/assessment\/instances\/[^"]*\/report"/);
  });

  it("draws no tally for a round only one side has answered, and no zero instead", () => {
    const markup = html({ alignment: null });
    const rendered = textOf(markup);
    expect(markup).toContain('data-glance-alignment="absent"');
    expect(rendered).not.toContain("Aspects Aligned");
    expect(markup).not.toContain('data-glance-align="true"');
    // The rows the read does answer are still drawn — the card is a summary, not an all-or-nothing.
    expect(rendered).toContain("Basic · 2 Opinions");
  });

  it("is absent on a view literal that predates these reads", () => {
    const noop = async () => ({ ok: true as const }) as never;
    const markup = renderToStaticMarkup(
      createElement(RelationshipDetail, {
        copy: dashboardRelationshipDetailPageCopy,
        relationship: view(),
        onSaveAspects: noop,
        onPublish: noop,
        onRepublish: noop,
        onComplete: noop,
        onFork: noop,
        onClaimExtension: noop,
        templatesHref: "/templates/relationship?view=mine",
      }),
    );
    expect(markup).not.toContain("data-relationship-glance");
  });
});

describe("the Payment tab — the reference's summary, and what it must not say", () => {
  const render = (overrides: Partial<MemberRelationshipView> = {}, planPrice?: string): string =>
    renderToStaticMarkup(
      createElement(PaymentPanel, {
        copy: dashboardRelationshipDetailPageCopy,
        relationship: view(overrides),
        planPrice,
      }),
    );

  it("states the window, the price after it, and who pays", () => {
    const rendered = textOf(render({ pause: undefined }, "$9.99"));
    expect(rendered).toContain("Status");
    expect(rendered).toContain("Free Trial · Ends");
    expect(rendered).toContain("After the Trial");
    expect(rendered).toContain("$9.99 / month");
    expect(rendered).toContain("Billing Owner");
  });

  it("says what happens if no card arrives, while the window is still running", () => {
    const markup = render({ pause: undefined }, "$9.99");
    expect(markup).toContain('data-payment-resume="true"');
    expect(textOf(markup)).toContain("to keep Stage 6 running");
  });

  it("says the window has paused, and stops asking for a card it would ignore", () => {
    const markup = render({
      pause: {
        state: "trial-ended",
        paused: true,
        endsAt: new Date("2026-11-19T12:00:00.000Z"),
        daysLeft: null,
        extended: false,
        extensionAvailable: true,
      },
    });
    const rendered = textOf(markup);
    expect(rendered).toContain("Paused · Trial Ended");
    expect(rendered).not.toContain("Free Trial · Ends");
    expect(markup).not.toContain("data-payment-resume");
  });

  it("invents no price when the page could not read the plan", () => {
    const rendered = textOf(render({ pause: undefined }, undefined));
    expect(rendered).not.toContain("/ month");
    expect(rendered).not.toContain("$");
  });

  it("keeps the Counterparty's tab free of every billing word (copy rule 4)", () => {
    const rendered = textOf(
      render({ viewerRole: "counterparty", isInitiator: false, canForkTemplate: false }),
    );
    for (const word of ["$", "Trial", "trial", "Card", "card", "Status", "month"]) {
      expect(rendered).not.toContain(word);
    }
    expect(rendered).toContain("covers this relationship");
  });
});

describe("the two sentences the reference draws and the live page owed", () => {
  it("says the Gap stays readable until the relationship closes", () => {
    expect(textOf(html())).toContain("Align stays live until the relationship closes.");
  });

  it("Title-Cases the Counterparty's save-as-template section and its action", () => {
    const rendered = textOf(html({ overrides: { canForkTemplate: true } }));
    expect(rendered).toContain("Keep These Aspects for Yourself");
    expect(rendered).toContain("Save This Template to My Templates");
    expect(rendered).not.toContain("Keep these Aspects for yourself");
  });
});
