/**
 * The My Relationships card, and the two controls #620 shipped disabled (#t_e9212bf9).
 *
 * #620's decision was explicitly temporary: `Activate Relationship` and `Gap Analysis` rendered
 * `<button disabled>` because the payment state did not exist and the Gap was not there, and its
 * handoff said the change that makes payment possible owns wiring them. This file is that change's
 * half of the proof:
 *
 *   neither control is disabled  — the button carries `Activate Relationship` (or the capture's
 *                                  label) and no `disabled`, and `Gap Analysis` is a link;
 *   the Gap's href is the truth  — the report once the fee landed, the assessment before that, so
 *                                  the card cannot link to a report that does not exist;
 *   a draft has neither          — nothing to activate and no Gap, so `Publish Assessment` is the
 *                                  only next step, and `Open Assessment` keeps its own disabled state;
 *   the sentence is not a code   — the fee and the trial rule are drawn, never `method-required`.
 */
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode }) =>
    createElement("a", { href, ...rest }, children),
}));

// `PaymentControls` is a client component; the router only matters for the writes, which this file
// does not post.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {}, replace: () => {} }),
}));

import { RelationshipCards } from "@/components/dashboard/relationship-cards";
import { dashboardRelationshipsPageCopy } from "@/data/pages/dashboard-relationships";
import type { CompleteOutcome } from "@/lib/member/outcomes";
import type { PaymentDoor } from "@/lib/member/payment-door";
import type { MemberRelationshipRow } from "@/lib/member/relationships";

const copy = dashboardRelationshipsPageCopy;

const onCapture = async () => ({ ok: true as const, url: null });
const onComplete = async (): Promise<CompleteOutcome> => ({
  ok: true,
  actionId: "act_1",
  status: "complete",
  chargedAt: "2026-11-09T12:00:00.000Z",
  amountCents: 895,
});

/** A door: sealed, no method on file — the state `Activate Relationship` exists for. */
const door = (over: Partial<PaymentDoor> = {}): PaymentDoor => ({
  phase: "none",
  amountCents: 895,
  chargeDueAt: null,
  chargedAt: null,
  paymentDeadlineAt: "2026-11-15T12:00:00.000Z",
  canComplete: false,
  refusal: "method-required",
  ...over,
});

/** One relationship, in the shape `listMyRelationships()` hands the page. */
const row: MemberRelationshipRow = {
  id: "relationship-member-abc123",
  status: "active",
  templateId: "member-config-abc123",
  title: "Son Basics",
  summary: "What we want to ask each other every month.",
  createdAt: "2026-11-01T12:00:00.000Z",
  publishedAt: "2026-11-01T13:00:00.000Z",
  sessionRecordId: "member-session-abc123",
  aspectCount: 6,
  payment: door(),
  invite: null,
  counterpartyName: "Junior",
  view: "not-published",
  membership: { state: "open", reason: null, endedAt: null, writable: true },
};

function render(overrides: Partial<MemberRelationshipRow> = {}): string {
  return renderToStaticMarkup(
    createElement(RelationshipCards, {
      copy,
      rows: [{ ...row, ...overrides }],
      unreadable: null,
      onCapture,
      onComplete,
    }),
  );
}

/** The `<button>` whose text is `label`, or `undefined`. */
function buttonWith(html: string, label: string): string | undefined {
  return html.match(/<button[^>]*>.*?<\/button>/g)?.find((button) => button.includes(`>${label}<`));
}

describe("the relationship card's payment door", () => {
  it("carries the four owner-named actions once the relationship has a session", () => {
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

  it("does not disable Activate Relationship — it posts the completion instead", () => {
    const html = render({
      payment: door({
        phase: "method-on-file",
        canComplete: true,
        refusal: null,
        chargeDueAt: "2026-11-08T12:00:00.000Z",
      }),
    });
    const activate = buttonWith(html, "Activate Relationship");
    expect(activate, "the Activate Relationship control").toBeDefined();
    expect(activate).not.toContain("disabled");
  });

  it("offers the capture, not a disabled control, when no method is on file", () => {
    const html = render();
    const capture = buttonWith(html, "Add a payment method");
    expect(capture, "the capture control").toBeDefined();
    expect(capture).not.toContain("disabled");
  });

  it("does not disable Gap Analysis — it is a link", () => {
    const html = render();
    const gap = html.match(/<a[^>]*>Gap Analysis<\/a>/)?.[0];
    expect(gap, "the Gap Analysis link").toBeDefined();
    expect(gap).not.toContain("disabled");
  });

  it("points Gap Analysis at the assessment while the fee is outstanding", () => {
    const html = render({ status: "active" });
    expect(html).toContain('href="/assessment/instances/member-session-abc123"');
  });

  it("points Gap Analysis at the report once the fee has landed", () => {
    const html = render({
      status: "complete",
      payment: door({ phase: "charged", canComplete: false, refusal: "already-charged" }),
    });
    expect(html).toContain('href="/assessment/instances/member-session-abc123/report"');
    // …and Activate is gone: there is nothing left to take.
    expect(buttonWith(html, "Activate Relationship")).toBeUndefined();
  });

  it("says the fee and the trial rule, never the refusal code", () => {
    const html = render();
    expect(html).toContain("$8.95");
    expect(html).toContain("7 days after you add a method");
    expect(html).not.toContain("method-required");
  });

  it("draws no Activate and no Gap on a draft, and keeps Open Assessment's own disable", () => {
    const html = render({
      status: "pending",
      sessionRecordId: null,
      publishedAt: null,
      payment: null,
    });
    expect(buttonWith(html, "Activate Relationship")).toBeUndefined();
    expect(html).not.toContain(">Gap Analysis<");
    // The one control that is still deliberately disabled: a draft has no assessment to open.
    expect((html.match(/<button[^>]*disabled=""/g) ?? []).length).toBe(1);
  });

  it("links Open Assessment to the session once the relationship has one", () => {
    const html = render();
    expect(html).toContain('href="/assessment/instances/member-session-abc123"');
    // …and the title and Publish Assessment open the relationship's own screen, the only
    // surface that publishes.
    expect(html).toContain('href="/dashboard/relationships/relationship-member-abc123"');
  });

  it("draws the stored status and the invitation's view as the table did", () => {
    const html = render();
    expect(html).toContain("Running");
    expect(html).toContain("Not sent");
    expect(html).toContain("with");
    expect(html).toContain("Junior");
  });
});
