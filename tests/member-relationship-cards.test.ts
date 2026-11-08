/**
 * The My Relationships card — four actions, two of them deliberately disabled (#620).
 *
 * The owner's decision is the thing worth pinning: ship the two-row menu now, with
 * `Activate Relationship` and `Gap Analysis` **visibly disabled** because payment does not exist
 * yet and the Gap is not open. That state is explicitly temporary, so the day payment lands this
 * file is the reminder that the two controls were waiting — the test asserts the disabled pair by
 * label, and the note beside them says out loud why.
 *
 * `Open Assessment` is the other half: it is a link the moment the relationship has a session and
 * a disabled control before that, because a draft has no assessment to open and a link to a 404
 * is worse than a control that says what it is waiting for.
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
  status: "pending",
  viewerRole: "initiator",
  isInitiator: true,
  templateId: "member-config-abc123",
  title: "Son Basics",
  summary: "What we want to ask each other every month.",
  createdAt: "2026-11-01T12:00:00.000Z",
  publishedAt: null,
  sessionRecordId: "member-session-abc123",
  aspectCount: 6,
  invite: null,
  counterpartyName: "Junior",
  initiatorName: "Avery",
  view: "not-published",
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

describe("the relationship card", () => {
  it("carries the four owner-named actions", () => {
    const html = render();
    for (const label of [
      "Open Assessment",
      "Publish Assessment",
      "Activate Relationship",
      "Gap Analysis",
    ]) {
      expect(html).toContain(label);
    }
  });

  it("disables Activate Relationship and Gap Analysis, and says why", () => {
    const html = render();
    expect(html).toContain("Payment is not built yet");
    // Exactly two controls are disabled: the payment one and the Gap one.
    expect((html.match(/<button[^>]*disabled=""/g) ?? []).length).toBe(2);
  });

  it("links Open Assessment to the session once the relationship has one", () => {
    const html = render();
    expect(html).toContain('href="/assessment/instances/member-session-abc123"');
    // …and the title and Publish Assessment open the relationship's own screen, the only
    // surface that publishes.
    expect(html).toContain('href="/dashboard/relationships/relationship-member-abc123"');
  });

  it("disables Open Assessment on a draft, because there is no session to open", () => {
    const html = render({ sessionRecordId: null, invite: null });
    expect(html).not.toContain("/assessment/instances/");
    expect((html.match(/<button[^>]*disabled=""/g) ?? []).length).toBe(3);
  });

  it("draws the stored status and the invitation's view as the table did", () => {
    const html = render();
    expect(html).toContain("Ready to publish");
    expect(html).toContain("Not sent");
    expect(html).toContain("with");
    expect(html).toContain("Junior");
  });

  it("says which seat the initiator holds, and keeps both write controls (#706)", () => {
    const html = render();
    expect(html).toContain('data-relationship-role="initiator"');
    expect(html).toContain("Initiator");
    expect(html).toContain("Publish Assessment");
    expect(html).toContain("Activate Relationship");
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

  it("draws no publish control and no disabled pair — they are the initiator's", () => {
    const html = render(counterparty);
    expect(html).not.toContain("Publish Assessment");
    expect(html).not.toContain("Activate Relationship");
    expect(html).not.toContain("Gap Analysis");
    expect(html).not.toContain("Payment is not built yet");
    expect((html.match(/<button[^>]*disabled=""/g) ?? []).length).toBe(0);
  });

  it("still opens the relationship's own screen — read-only there, but reachable", () => {
    const html = render(counterparty);
    expect(html).toContain('href="/dashboard/relationships/relationship-member-abc123"');
    expect(html).toContain("View Relationship");
  });
});
