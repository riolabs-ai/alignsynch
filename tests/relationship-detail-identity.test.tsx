/**
 * #975 D9 / D2 — **whose relationship is this, and which one** (#975).
 *
 * Two rows of the UX inventory, both of them the same failure in different clothes: the screen
 * knows things about the relationship it never says, and says one thing twice in two ways.
 *
 *   D9  the page was headed by the **template's** name (`relationship.title`), so every relationship
 *       made from one template shared one `<h1>` and four of the demo branch's rows read
 *       identically. `relationship.relationshipTitle` — the title the creator's stage 1 wrote, which
 *       the list and the card already print — was read and then never drawn.
 *   D2  the seat chip says `viewerRole` (the viewer's own `party` row) and the read-only band was
 *       gated on `isInitiator` (the permission), and its one sentence claimed the *role*. Where the
 *       two reads disagree the same screen called one person both an Initiator and the Counterparty.
 *
 * The claims below are all against rendered markup, because both rows are about what a person
 * reads. The view is hand-built (`MemberRelationshipView`, the shape `readMyRelationship` returns)
 * for the reason `tests/record-detail-shell.test.tsx` gives: the component takes a projection, so
 * every seat can be driven without a database. The template used is `relationship-basics`, whose
 * slug names **no** catalogue type — that is the state the demo branch's relationships are in, and
 * it is where the band's nouns are the product's own words (`Initiator` / `Counterparty`) rather
 * than a type's (`Staff` / `Manager`).
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// The screen refreshes after an inline capture, so it reads the router. No test here presses a
// button; the stub exists only so a static render can reach `useRouter`.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
}));

import { RelationshipDetail } from "@/components/dashboard/relationship-detail";
import { assessments } from "@/data/assessments";
import { dashboardRelationshipDetailPageCopy } from "@/data/pages/dashboard-relationship-detail";
import { relationshipType } from "@/data/relationship-types";
import type { MemberRelationshipView } from "@/lib/member/relationships";

/** The demo's template: a real assessment record whose slug names no catalogue type. */
const record = (() => {
  const found = assessments.find((entry) => entry.id === "assessment-relationship-basics");
  if (found === undefined) throw new Error("assessment-relationship-basics is not a fixture");
  return found;
})();

if (relationshipType(record.slug) !== undefined) {
  throw new Error(
    `"${record.slug}" now names a catalogue type — pick a template that does not, because this file's noun assertions are the product's own words`,
  );
}

function view(overrides: Partial<MemberRelationshipView> = {}): MemberRelationshipView {
  return {
    id: "relationship-975-d9",
    status: "published",
    viewerRole: "initiator",
    isInitiator: true,
    templateId: record.id,
    templateSlug: record.slug,
    /** The template's name — the heading this page used to draw. */
    title: record.title,
    /** Stage 1's answer, which the list and the card already print. */
    relationshipTitle: "Avery B – Rowan",
    summary: record.summary,
    createdAt: "2026-10-28T18:30:00.000Z",
    publishedAt: null,
    sessionRecordId: "assessment-instance-avery-rowan",
    aspectCount: record.items.length,
    invite: null,
    counterpartyName: null,
    /** The Counterparty's own `party` row — no invitation row exists on the demo branch. */
    counterpartySeatName: "Rowan",
    initiatorName: "Avery",
    view: "not-published",
    membership: { state: "open", reason: null, endedAt: null, writable: true },
    template: record,
    aspectsEditable: false,
    publishable: false,
    hasMembership: false,
    completion: null,
    offersRepublish: false,
    trialWithoutLiveInvite: false,
    closed: false,
    trial: "none",
    trialEndsAt: null,
    lapseSentence: null,
    inviteLinkAvailable: false,
    canForkTemplate: false,
    ...overrides,
  };
}

function html(overrides: Partial<MemberRelationshipView> = {}): string {
  const noop = async () => ({ ok: true as const }) as never;
  return renderToStaticMarkup(
    createElement(RelationshipDetail, {
      copy: dashboardRelationshipDetailPageCopy,
      relationship: view(overrides),
      onSaveAspects: noop,
      onPublish: noop,
      onRepublish: noop,
      onComplete: noop,
      onFork: noop,
      templatesHref: "/templates/relationship?view=mine",
    }),
  );
}

/** The markup as a reader sees it: tags dropped, entities decoded, whitespace collapsed. */
function textOf(markup: string): string {
  return markup
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The page's one heading, as text. `record-detail-shell.test.tsx` holds the count at one. */
function headingOf(markup: string): string {
  const found = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(markup);
  if (found === null) throw new Error("the page drew no <h1>");
  return textOf(found[1] ?? "");
}

/** How many times a phrase is rendered — a role stated twice is the defect, not a style. */
function countOf(markup: string, needle: string): number {
  return markup.split(needle).length - 1;
}

describe("D9 — the heading is the relationship's, and the seats are named", () => {
  it("heads the page with the title the creator gave the relationship, not its template's", () => {
    expect(headingOf(html())).toBe("Avery B – Rowan");
    expect(headingOf(html())).not.toBe(record.title);
  });

  it("falls back to the template's name for a row whose copy carries no title of its own", () => {
    // A relationship written before #841: `relationship_title` is NULL, and the template is the
    // only name the row has. The fallback is stated so the fallback is what a reader gets.
    expect(headingOf(html({ relationshipTitle: null }))).toBe(record.title);
  });

  it("reads the title and the seats off two different fields — the list's, and the seat's", () => {
    // The title is the session copy's; the Counterparty's name is the `party` row's, which is the
    // name the demo branch has and `session_invite` does not.
    const band = textOf(html({ counterpartyName: null, counterpartySeatName: "Rowan" }));
    expect(band).toContain("Rowan — Counterparty");
    // An invitation that named somebody is what the initiator typed, and it wins.
    expect(textOf(html({ counterpartyName: "Rowan R", counterpartySeatName: "Rowan" }))).toContain(
      "Rowan R — Counterparty",
    );
  });

  it("names both seats, initiator first, under the heading", () => {
    const band = textOf(html());
    const initiator = band.indexOf("Avery — Initiator");
    const counterparty = band.indexOf("Rowan — Counterparty");
    expect(initiator).toBeGreaterThan(-1);
    expect(counterparty).toBeGreaterThan(-1);
    expect(initiator).toBeLessThan(counterparty);
  });

  it("falls back to the product's two nouns while a seat is still empty", () => {
    // A draft the flow has not sent: nobody holds the Counterparty seat, so the line says the
    // seat's name rather than half a dash.
    const band = textOf(html({ counterpartySeatName: null, counterpartyName: null }));
    expect(band).toContain("Avery — Initiator");
    expect(band).toContain("Initiator / Counterparty");
  });

  it("makes two relationships from one template tell apart at a glance", () => {
    const first = html({ relationshipTitle: "Kitchen load" });
    const second = html({ relationshipTitle: "Money talks" });
    expect(headingOf(first)).toBe("Kitchen load");
    expect(headingOf(second)).toBe("Money talks");
    expect(headingOf(first)).not.toBe(headingOf(second));

    // And when both kept stage 1's default, the seat line is what differs — which is the whole
    // point of naming the pair rather than only titling the record.
    const averyRowan = textOf(
      html({
        relationshipTitle: record.title,
        initiatorName: "Avery",
        counterpartySeatName: "Rowan",
      }),
    );
    const ruthSam = textOf(
      html({ relationshipTitle: record.title, initiatorName: "Ruth", counterpartySeatName: "Sam" }),
    );
    expect(averyRowan).toContain("Avery — Initiator / Rowan — Counterparty");
    expect(ruthSam).toContain("Ruth — Initiator / Sam — Counterparty");
  });
});

describe("D2 — one screen states one role", () => {
  it("says Counterparty once, in the chip and in its own sentence, for the Counterparty's seat", () => {
    const markup = html({ viewerRole: "counterparty", isInitiator: false });
    expect(markup).toContain('data-viewer-role="counterparty"');
    expect(markup).toContain('data-relationship-read-only="counterparty"');
    // The role is stated by the chip and by the one band; the band's sentence is the role sentence.
    expect(countOf(markup, "You are the Counterparty")).toBe(1);
    expect(markup).not.toContain("The Aspects, publishing and invitation on this relationship");
  });

  it("does not call an Initiator's seat the Counterparty when the controls are somebody else's", () => {
    /*
     * The measured defect: `initiator_user_id` named another account while the viewer held the
     * Initiator seat, so `isInitiator` was false and the band said "You are the Counterparty" 300px
     * under a chip reading `Initiator`. The seats are what the chip prints, so the band prints the
     * permission and names no role.
     */
    const markup = html({ viewerRole: "initiator", isInitiator: false });
    expect(markup).toContain('data-viewer-role="initiator"');
    expect(markup).toContain('data-relationship-read-only="initiator"');
    expect(markup).toContain("The Aspects, publishing and invitation on this relationship");
    expect(markup).not.toContain("You are the Counterparty");
  });

  it("draws no read-only band at all for the account that holds the controls", () => {
    const markup = html({ viewerRole: "initiator", isInitiator: true });
    expect(markup).toContain('data-viewer-role="initiator"');
    expect(markup).not.toContain("data-relationship-read-only");
    expect(markup).not.toContain("You are the Counterparty");
  });
});
