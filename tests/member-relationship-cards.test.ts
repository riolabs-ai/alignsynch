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

const copy = dashboardRelationshipsPageCopy;

/** One relationship, in the shape `listMyRelationships()` hands the page. */
const row = {
  id: "relationship-member-abc123",
  status: "pending" as const,
  templateId: "member-config-abc123",
  title: "Son Basics",
  summary: "What we want to ask each other every month.",
  createdAt: "2026-11-01T12:00:00.000Z",
  publishedAt: null,
  sessionRecordId: "member-session-abc123" as string | null,
  aspectCount: 6,
  invite: null,
  counterpartyName: "Junior",
  view: "not-published" as const,
  membership: { state: "open" as const, reason: null, endedAt: null, writable: true },
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
});
