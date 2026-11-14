/**
 * The My Relationships card — the acts the product can actually perform (#620, #739, #841).
 *
 * #620 shipped this card with `Activate Relationship` and `Gap Analysis` **visibly disabled**,
 * because the payment workflow behind them did not exist and the owner preferred showing that
 * completion was coming to hiding it. That was explicitly temporary; #739 built the payer's two
 * acts and this file is where the promise is kept or broken.
 *
 * What replaced them: **no payment control on the card at all.** The card's read
 * (`MemberRelationshipRow`) carries no seal and no method, so a control here could only guess —
 * and the acts live on the relationship's own screen, which knows. What the card still says is the
 * true verb for the initiator's state: publishing while there is no session, and completing once
 * there is one.
 *
 * #841 part 2 moved the secondary acts into the per-row menu, so `Open Assessment` is no longer a
 * dead button on the action row: the row draws it as a link when there is a session to open, and
 * the menu draws it disabled — with the reason in words — when there is not. The menu's content is
 * a Radix portal and is therefore absent from this static render, so the file asserts the row's
 * own markup and the reason the *trigger* carries; the item's own sentence is pinned by the
 * fixture (`open-assessment-why`) and by E23, which fails a component that asks for an id the
 * fixture does not declare.
 */
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) =>
    createElement("a", { href, ...rest }, children),
}));

import { RelationshipCards } from "@/components/dashboard/relationship-cards";
import { dashboardRelationshipsPageCopy } from "@/data/pages/dashboard-relationships";
import type { MemberRelationshipRow } from "@/lib/member/relationships";

const copy = dashboardRelationshipsPageCopy;

/** One relationship, in the shape `listMyRelationships()` hands the page. */
const row: MemberRelationshipRow = {
  id: "relationship-member-abc123",
  status: "active",
  viewerRole: "initiator",
  isInitiator: true,
  templateId: "member-config-abc123",
  templateSlug: "member-config-abc123",
  title: "Son Basics",
  summary: "What we want to ask each other every month.",
  createdAt: "2026-11-01T12:00:00.000Z",
  publishedAt: "2026-11-02T12:00:00.000Z",
  sessionRecordId: "member-session-abc123",
  aspectCount: 6,
  invite: null,
  counterpartyName: "Junior",
  initiatorName: "Avery",
  view: "invite-claimed",
  membership: { state: "open", reason: null, endedAt: null, writable: true },
};

function render(overrides: Partial<typeof row> = {}): string {
  return renderToStaticMarkup(
    createElement(RelationshipCards, {
      copy,
      rows: [{ ...row, ...overrides }],
      unreadable: null,
    }),
  );
}

/** How many controls the markup draws disabled. #739 retired both of the card's dead pair. */
function disabledControls(html: string): number {
  return (html.match(/<button[^>]*disabled=""/g) ?? []).length;
}

/** The card's own words, from the fixture — escaped, because this reads rendered markup. */
const COMPLETE_LABEL = "Complete Relationship";
/**
 * #912 — **a draft's primary is the owner's words.** It read "Publish Assessment" for every row
 * with no session; the card that draws a draft's pair names the act's audience instead, because on
 * a draft the counterparty is still a decision and not a fact.
 */
const TO_COUNTERPARTY_LABEL = "Publish to Counterparty";
const INVITE_MEMBERS_LABEL = "Invite Members";
/** The menu item's reason, on the trigger, for the state where there is no session to open. */
const NO_SESSION_WHY = "No session yet — publish first";
/**
 * #958 — the draft with no session, in words rather than in a tooltip. The label is a sentence now
 * because the control it used to sit on is gone: a disabled `Invite Members` carrying its reason in
 * a `title` is exactly what the owner rejected.
 */
const NO_INVITE_WHY =
  "No session yet, so the pay modal has nothing to open — start it again from its template and the modal comes with it. This draft stays as it is.";

describe("the relationship card", () => {
  it("carries the three actions the product can actually perform", () => {
    const html = render();
    for (const label of ["Open Assessment", COMPLETE_LABEL]) {
      expect(html).toContain(label);
    }
    expect(html).toContain("/dashboard/relationships/relationship-member-abc123");
  });

  it("draws no payment control and no 'payment is not built' note", () => {
    const html = render();
    expect(html).not.toContain("Activate Relationship");
    expect(html).not.toContain("Gap Analysis");
    expect(html).not.toContain("Payment is not built yet");
    // Nothing is disabled while there is a session to open.
    expect(disabledControls(html)).toBe(0);
  });

  it("offers publishing while the relationship has no session, and completing once it has one", () => {
    expect(render({ sessionRecordId: null, status: "draft", view: "not-published" })).toContain(
      TO_COUNTERPARTY_LABEL,
    );
    const live = render();
    expect(live).not.toContain(TO_COUNTERPARTY_LABEL);
    expect(live).toContain(COMPLETE_LABEL);
  });

  it("links Open Assessment to the session once the relationship has one", () => {
    const html = render();
    expect(html).toContain('href="/assessment/instances/member-session-abc123"');
    // …and the title and the primary action open the relationship's own screen, the only surface
    // that can complete it.
    expect(html).toContain('href="/dashboard/relationships/relationship-member-abc123"');
  });

  it("keeps Open Assessment off the action row on a draft, and says why in the row's menu", () => {
    const html = render({ sessionRecordId: null, status: "draft", view: "not-published" });
    expect(html).not.toContain("/assessment/instances/");
    // #841 part 2 — the dead inline button is gone; the menu carries it disabled, with the reason.
    // The menu's content is portal-rendered (so absent from this static render), which is why the
    // reason is asserted where it is reachable before the click and where the item repeats it.
    expect(disabledControls(html)).toBe(0);
    expect(html).toContain(`title="${NO_SESSION_WHY}"`);
  });

  it("draws the stored status and the invitation's view as the table did", () => {
    const html = render();
    expect(html).toContain("Running");
    expect(html).toContain("Joined");
    expect(html).toContain("with");
    expect(html).toContain("Junior");
  });

  it("says which seat the initiator holds (#706)", () => {
    const html = render();
    expect(html).toContain('data-relationship-role="initiator"');
    expect(html).toContain("Initiator");
  });
});

/**
 * #706 — the same card, read by the Counterparty.
 *
 * The defect was that this reader got no row at all; the fix is a list keyed on the party binding.
 * What this file holds is the other half: the row that now appears draws **no write control**, and
 * it names the person whose relationship it is rather than printing the reader's own name back.
 */
describe("the relationship card a Counterparty reads", () => {
  const counterparty = {
    viewerRole: "counterparty" as const,
    isInitiator: false,
    counterpartyName: "Junior",
    initiatorName: "Avery",
  };

  it("says Counterparty, and names the initiator it is with", () => {
    const html = render(counterparty);
    expect(html).toContain('data-relationship-role="counterparty"');
    expect(html).toContain("Counterparty");
    expect(html).toContain("with");
    expect(html).toContain("Avery");
    expect(html).not.toContain("Junior");
  });

  it("draws no publish control and no payment control — they are the initiator's", () => {
    const html = render(counterparty);
    expect(html).not.toContain(TO_COUNTERPARTY_LABEL);
    expect(html).not.toContain(INVITE_MEMBERS_LABEL);
    expect(html).not.toContain(COMPLETE_LABEL);
    expect(html).not.toContain("Activate Relationship");
    expect(html).not.toContain("Gap Analysis");
    expect(disabledControls(html)).toBe(0);
  });

  it("still opens the relationship's own screen — read-only there, but reachable", () => {
    const html = render(counterparty);
    expect(html).toContain('href="/dashboard/relationships/relationship-member-abc123"');
    // #841 part 2 — the seat that cannot write gets `Open Relationship` as its primary (the
    // artifact's word), and the footer's `View` beside it. `View Relationship` is the same
    // destination as the row menu's item, which this static render cannot see.
    expect(html).toContain("Open Relationship");
    expect(html).toContain("View");
  });
});

/**
 * **A draft's two CTAs (#912).**
 *
 * The card's rule: a draft is where the money and the counterparty are both still open decisions, so
 * both acts are drawn as controls on the row rather than behind the More menu — and *one* of them is
 * the pay modal, never a capture of this card's own.
 *
 * Two shapes, and they are different row states rather than a preference: a draft written by the
 * create flow has a session (stage 4 writes it) and the modal can open; a draft written by the
 * list's own create band — a path #913 deleted — has none, and #958's answer to that row is a
 * sentence and a door rather than a dead control.
 */
describe("a draft's two CTAs", () => {
  /** A draft as the create flow leaves it: a session, a staged invitation, no method yet. */
  const flowDraft = {
    status: "draft",
    view: "not-published",
    sessionRecordId: "member-session-abc123",
    publishedAt: null,
  } as const;

  it("draws Invite Members and Publish to Counterparty, front and centre", () => {
    const html = render(flowDraft);
    expect(html).toContain(INVITE_MEMBERS_LABEL);
    expect(html).toContain(TO_COUNTERPARTY_LABEL);
    // The owner's words, not the retired pair — a draft never reads "Publish Assessment" now.
    expect(html).not.toContain("Publish Assessment");
  });

  it("sends Invite Members into the pay modal, with both handles the stage resolves", () => {
    const html = render(flowDraft);
    /*
     * The modal's address, from `createInviteForPath()`: the relationship's **copy** slug in the
     * path (`#794`) and the session in `?instance=`. The row is a *client* component, so this is the
     * proof the address is built from `templateSlug` and not from the storage id.
     */
    expect(html).toContain(
      'href="/templates/relationship/member-config-abc123/create/invite?instance=member-session-abc123"',
    );
    expect(html).toContain('data-pay-modal="true"');
    expect(html).not.toContain("data-invite-blocked");
  });

  it("sends Publish to Counterparty into the same modal, because the send is the modal's act (#913)", () => {
    /*
     * The row used to point this at the relationship's screen, which was one click short of the
     * modal that holds the card and the Send — the owner's "blocked to get back to the modal step
     * needed". The primary's own href is the proof, not the label.
     */
    const html = render(flowDraft);
    expect(html).toContain('data-publish-to-counterparty="true"');
    expect(html).toContain(
      'href="/templates/relationship/member-config-abc123/create/invite?instance=member-session-abc123"',
    );
  });

  it("keeps Publish to Counterparty on the relationship screen when there is no session to open", () => {
    const html = render({ status: "draft", view: "not-published", sessionRecordId: null });
    // No session means no stage 5 to render, so the row is honest about the only address it has.
    expect(html).toContain('href="/dashboard/relationships/relationship-member-abc123"');
    expect(html).not.toContain("data-pay-modal");
  });

  it("takes no card on the card itself — the capture lives on the modal and nowhere else", () => {
    const html = render(flowDraft);
    expect(html).not.toContain("data-capture");
    expect(html).not.toContain("data-add-method");
    expect(html).not.toContain("<input");
  });

  it("says why the modal cannot open, and offers a door, when the draft has no session (#958)", () => {
    /*
     * **#958 reverses this test's old acceptance on purpose.** It used to require an inert
     * `Invite Members` — a `span[aria-disabled]` carrying its reason in a `title` — and the owner's
     * answer to that pattern was "use the modal, not explain why you cannot". So the reason is now
     * words on the card and the control is not drawn at all, because a control that cannot act is
     * the failure mode the card names as doomed. The door is the template's own create flow, which
     * is the only writer of a session.
     */
    const html = render({ status: "draft", view: "not-published", sessionRecordId: null });
    expect(html).toContain('data-invite-blocked-why="no-session"');
    expect(html).toContain(NO_INVITE_WHY);
    expect(html).toContain('href="/templates/relationship/member-config-abc123/create"');
    expect(html).toContain('data-invite-blocked-door="restart"');
    // Nothing inert: no disabled control, and no label with its reason hidden in a `title`.
    expect(html).not.toContain("aria-disabled");
    expect(html).not.toContain(`title="${NO_INVITE_WHY}"`);
    expect(html).not.toContain("data-pay-modal");
    // …and the other half survives: publishing is still offered.
    expect(html).toContain(TO_COUNTERPARTY_LABEL);
  });
});
