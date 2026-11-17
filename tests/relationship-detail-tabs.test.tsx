/**
 * #1124 — **the six-tab layer**, on the relationship's own route.
 *
 * Three claims, and each of them is a way the port could have gone wrong:
 *
 *   the six      the strip is Discussion · Aspects · Members · Details · Settings · Payment in the
 *   sections     bundle's order, with the owner's words verbatim, and every one of them has a panel
 *                behind it — a tab that opens onto nothing is a control that lies.
 *   one h1       the layer is inside the shell's content column, so the band keeps the page's only
 *                `<h1>` and every panel's own heading starts at `h2`. A second `h1` is the defect
 *                the shell exists to make impossible.
 *   the hash     `#aspects` is the Aspects tab and an unknown hash changes nothing — the mapping is
 *                a pure function (`relationshipTabFromHash`), so it is asserted without a DOM and
 *                the browser only has to call it.
 *
 * The Counterparty's Payment panel is asserted separately, against its own part of the tree: the
 * owner's rule is that they never read a plan, a price, a card ask or a trial countdown, and a
 * leak inside one tab would not be a whole-page failure, so it is checked where it would happen.
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
import {
  RELATIONSHIP_TAB_IDS,
  relationshipTabFromHash,
} from "@/components/dashboard/relationship-tabs";
import { assessments } from "@/data/assessments";
import { dashboardRelationshipDetailPageCopy } from "@/data/pages/dashboard-relationship-detail";
import type { MemberRelationshipView } from "@/lib/member/relationships";

const record = (() => {
  const found = assessments.find((entry) => entry.id === "assessment-relationship-basics");
  if (found === undefined) throw new Error("assessment-relationship-basics is not a fixture");
  return found;
})();

function view(overrides: Partial<MemberRelationshipView> = {}): MemberRelationshipView {
  return {
    id: "relationship-1124",
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
    aspectCount: record.items.length,
    invite: { claimed: false, revoked: false, expiresAt: new Date("2026-11-12T12:00:00.000Z") },
    counterpartyName: "Rowan",
    counterpartySeatName: "Rowan",
    initiatorName: "Avery",
    view: "invite-live",
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

function html(
  overrides: Partial<MemberRelationshipView> = {},
  settings?: { mode: string; setting: string },
): string {
  const noop = async () => ({ ok: true as const }) as never;
  return renderToStaticMarkup(
    createElement(RelationshipDetail, {
      copy: dashboardRelationshipDetailPageCopy,
      relationship: view(overrides),
      settings,
      onSaveAspects: noop,
      onPublish: noop,
      onRepublish: noop,
      onComplete: noop,
      onFork: noop,
      templatesHref: "/templates/relationship?view=mine",
    }),
  );
}

/** The tab ids the strip rendered, in document order — the order is part of the design. */
function tabOrder(markup: string): string[] {
  return [...markup.matchAll(/data-relationship-tab="([^"]+)"/g)].map((match) => match[1] ?? "");
}

/** Every panel the layer mounted, in document order. */
function panelOrder(markup: string): string[] {
  return [...markup.matchAll(/data-relationship-panel="([^"]+)"/g)].map((match) => match[1] ?? "");
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

describe("#1124 — six sections, in the bundle's order, with the owner's words", () => {
  it("renders the six tab triggers in the approved order", () => {
    expect(tabOrder(html())).toEqual([
      "discussion",
      "aspects",
      "members",
      "details",
      "settings",
      "payment",
    ]);
    // The ids the component pins are the ids the fixture carries — one vocabulary, not two.
    expect(tabOrder(html())).toEqual([...RELATIONSHIP_TAB_IDS]);
  });

  it("labels them verbatim — Discussion, Aspects, Members, Details, Settings, Payment", () => {
    const rendered = textOf(html());
    for (const label of ["Discussion", "Aspects", "Members", "Details", "Settings", "Payment"]) {
      expect(rendered).toContain(label);
    }
  });

  it("mounts one panel per tab, so no trigger opens onto nothing", () => {
    expect(panelOrder(html())).toEqual(tabOrder(html()));
  });

  it("ties every trigger to its panel and back again", () => {
    const markup = html();
    for (const id of RELATIONSHIP_TAB_IDS) {
      // Radix writes `aria-controls` on the trigger and `aria-labelledby` on the panel; both are
      // how a screen reader knows which region the tab controls rather than guessing from order.
      expect(markup).toMatch(new RegExp(`aria-controls="[^"]*${id}[^"]*"`));
      expect(markup).toMatch(new RegExp(`aria-labelledby="[^"]*${id}[^"]*"`));
    }
  });

  it("is one roving group: exactly one selected tab, the rest reached with the arrow keys", () => {
    const markup = html();
    const triggers = [...markup.matchAll(/<button[^>]*role="tab"[^>]*>/g)].map((match) => match[0]);
    expect(triggers).toHaveLength(6);
    /* Radix's roving focus: the selected trigger is the group's single tab stop and the others are
       `tabindex="-1"`, reached with Left/Right/Home/End. The static pass renders every trigger at
       -1 because the roving collection applies `0` to the selected one after mount — so the claim
       this markup can carry is the one that matters: the selected state is exactly one, and every
       trigger is a real `<button>` in the roving collection rather than a div. */
    expect(triggers.filter((trigger) => trigger.includes('aria-selected="true"'))).toHaveLength(1);
    expect(triggers[0]).toContain('aria-selected="true"');
    for (const trigger of triggers) {
      expect(trigger).toContain('type="button"');
      expect(trigger).toContain('tabindex="-1"');
      expect(trigger).toContain("data-radix-collection-item");
    }
  });

  it("keeps one <h1> on the page and starts every panel heading below it", () => {
    const markup = html();
    expect(markup.match(/<h1[\s>]/g) ?? []).toHaveLength(1);
    // Every panel's own title is an h2 or an h3 — no panel re-opens the page at h1.
    expect(markup).not.toMatch(/<h1[^>]*data-relationship-(panel|tabs)/);
  });
});

describe("#1124 — the hash is the tab", () => {
  it("maps every id to itself, with or without the octothorpe", () => {
    for (const id of RELATIONSHIP_TAB_IDS) {
      expect(relationshipTabFromHash(`#${id}`)).toBe(id);
      expect(relationshipTabFromHash(id)).toBe(id);
      expect(relationshipTabFromHash(`#${id.toUpperCase()}`)).toBe(id);
    }
  });

  it("leaves the page on its default tab for a hash it does not own", () => {
    // `#main` is the skip link's target and `""` is a plain load: neither is a tab, and neither may
    // blank the strip.
    expect(relationshipTabFromHash("#main")).toBeUndefined();
    expect(relationshipTabFromHash("")).toBeUndefined();
    expect(relationshipTabFromHash("#aspects-2")).toBeUndefined();
  });
});

describe("#1124 — the panels say what the record says, and the Counterparty reads no money", () => {
  it("marks the viewer's own seat and names both sides", () => {
    const rendered = textOf(html());
    expect(rendered).toContain("Avery");
    expect(rendered).toContain("Rowan");
    expect(rendered).toContain("(You)");
  });

  it("names the invitation's instants instead of inventing a claimed date", () => {
    const rendered = textOf(
      html({
        invite: { claimed: true, revoked: false, expiresAt: new Date("2026-11-12T12:00:00.000Z") },
      }),
    );
    expect(rendered).toContain("The other person has joined.");
  });

  it("states the two settings when the read produced them, and who owns them when it did not", () => {
    const withSettings = textOf(html({}, { mode: "basic", setting: "full" }));
    expect(withSettings).toContain("Changes apply from the next round.");
    expect(withSettings).toMatch(/Full — a large Gap/);

    const unread = textOf(html());
    expect(unread).toContain("The person who started this relationship sets these.");
  });

  it("gives the Counterparty one sentence and no price, trial, card or extension on Payment", () => {
    const counterparty = textOf(
      renderToStaticMarkup(
        createElement(PaymentPanel, {
          copy: dashboardRelationshipDetailPageCopy,
          relationship: view({ viewerRole: "counterparty", isInitiator: false }),
        }),
      ),
    );
    expect(counterparty).toContain("Avery covers this relationship. You’re never charged.");
    for (const forbidden of ["$", "Trial", "trial", "card", "Card", "extension", "price"]) {
      expect(counterparty).not.toContain(forbidden);
    }
  });

  it("shows the Initiator the membership and the trial they are on", () => {
    const initiator = textOf(
      renderToStaticMarkup(
        createElement(PaymentPanel, {
          copy: dashboardRelationshipDetailPageCopy,
          relationship: view(),
        }),
      ),
    );
    expect(initiator).toContain("Running");
    expect(initiator).toContain("Billing Owner");
    expect(initiator).toContain("Trial ends");
  });
});
