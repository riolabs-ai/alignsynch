/**
 * The Payment surface, rendered (#1132).
 *
 * `tests/payment-panels.test.ts` proves the derivation; this file proves the *document* — that the
 * words a person actually reads are the ones the fixture holds, that the actions are drawn only
 * where the derivation offered them, and above all that the **Counterparty's render carries no
 * money at all**. The last one is the issue's own acceptance line ("the Counterparty page passes
 * the no-leak check"), and it is a claim about markup, so it is read off the markup: no `$`, no
 * trial, card, plan, extension or month word anywhere in the page a non-paying reader gets.
 *
 * No database and no server: the view takes the same plain objects `billingViewOf()` returns, and
 * `next/navigation` is mocked because the component asks the router to re-render after a claimed
 * week (the claim itself is the server action's transaction, not this file's).
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => undefined, push: () => undefined }),
}));

import { PaymentView } from "@/components/billing/payment-view";
import { formatCurrency } from "@/content/core";
import { billingPlan } from "@/data/billing-plans";
import { paymentPageCopy } from "@/data/pages/payment";
import { billingViewOf, type BillingFacts, type BillingView } from "@/lib/billing/payment-view";
import type { MemberRelationshipRow } from "@/lib/member/relationships";
import type { Subscription } from "@/lib/billing/types";

const NOW = new Date("2026-11-16T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const TRIAL_ENDS = new Date(NOW.getTime() + 3 * DAY);

function trial(overrides: Partial<Subscription> = {}): Subscription {
  return {
    userId: "user-initiator",
    planId: "basic",
    interval: "month",
    provider: "mock",
    providerSubscriptionId: "trial-user-initiator",
    status: "trialing",
    livemode: false,
    currentPeriodEnd: TRIAL_ENDS.toISOString(),
    ...overrides,
  };
}

function row(overrides: Partial<MemberRelationshipRow> = {}): MemberRelationshipRow {
  return {
    id: "relationship-trial",
    status: "active",
    viewerRole: "initiator",
    isInitiator: true,
    templateId: "record-copy",
    templateSlug: "spousal-alignment",
    title: "Staying Close Through Busy Seasons",
    relationshipTitle: "Staying Close Through Busy Seasons",
    summary: "",
    createdAt: "2026-11-13T09:00:00.000Z",
    publishedAt: "2026-11-13T09:00:00.000Z",
    sessionRecordId: "session-1",
    aspectCount: 5,
    invite: { claimed: true, revoked: false, expiresAt: new Date(NOW.getTime() + 5 * DAY) },
    counterpartyName: "Elena Reyes",
    counterpartySeatName: "Elena Reyes",
    initiatorName: "Marcus Reyes",
    view: "invite-claimed",
    membership: { state: "open", reason: null, endedAt: null, writable: true },
    ...overrides,
  };
}

function markupOf(rows: readonly MemberRelationshipRow[], facts: Partial<BillingFacts> = {}) {
  const view: BillingView = billingViewOf({
    rows,
    subscription: trial(),
    trialExtendedAt: null,
    now: NOW,
    ...facts,
  });
  return renderToStaticMarkup(
    createElement(PaymentView, {
      copy: paymentPageCopy,
      view,
      unreadable: null,
      onClaimExtension: () => Promise.resolve({ ok: false as const, code: "signed-out" }),
    }),
  );
}

describe("the initiating account's page", () => {
  it("draws the header, the trial panel and the three aside cards", () => {
    const html = markupOf([row()]);
    expect(html).toContain("Payment");
    expect(html).toContain("Memberships");
    expect(html).toContain("Free Trial · 3 Days Left");
    expect(html).toContain("Trial Ends");
    expect(html).toContain("After the Trial");
    // The figure is the plan fixture's, not a literal the test types (#1132 x #1127): the surface
    // prices the membership from `data/billing-plans.ts`, so the check reads the same source.
    expect(html).toContain(formatCurrency(billingPlan("basic")?.monthlyCents ?? 0));
    expect(html).toContain("Add a Card");
    expect(html).toContain("With Elena Reyes");
    expect(html).toContain("Payment Method");
    expect(html).toContain("No card on file.");
    expect(html).toContain("Billing History");
    expect(html).toContain("No charges yet.");
    expect(html).toContain("How Trials Work");
    expect(html).toContain("One free extra week, once");
    // The one action the trial panel may carry is a door into stage 5's pay walk.
    expect(html).toContain('data-payment-action="add-card"');
    expect(html).not.toContain('data-payment-action="get-week"');
  });

  it("draws the paused panel with both ways back, and the free week as a control", () => {
    const html = markupOf(
      [
        row({
          status: "expired",
          membership: {
            state: "lapsed",
            reason: "trial-ended",
            endedAt: TRIAL_ENDS,
            writable: false,
          },
        }),
      ],
      { now: new Date(TRIAL_ENDS.getTime() + DAY) },
    );
    expect(html).toContain("Paused");
    expect(html).toContain("1 Free Week Available");
    expect(html).toContain("Get 7 More Days Free");
    expect(html).toContain('data-payment-action="get-week"');
    expect(html).toContain("Everything is saved.");
  });

  it("stops drawing the free week once the account has used it", () => {
    const html = markupOf(
      [
        row({
          status: "expired",
          membership: {
            state: "lapsed",
            reason: "trial-ended",
            endedAt: TRIAL_ENDS,
            writable: false,
          },
        }),
      ],
      { now: new Date(TRIAL_ENDS.getTime() + DAY), trialExtendedAt: TRIAL_ENDS },
    );
    expect(html).toContain("Paused");
    expect(html).not.toContain("Get 7 More Days Free");
    expect(html).not.toContain("1 Free Week Available");
    expect(html).toContain("one time only");
  });

  it("draws a draft's next step and no countdown", () => {
    const html = markupOf(
      [
        row({
          status: "draft",
          invite: null,
          publishedAt: null,
          sessionRecordId: null,
          view: "not-published",
          counterpartyName: "Dana Kim",
          counterpartySeatName: null,
        }),
      ],
      { subscription: null },
    );
    expect(html).toContain("Not Started");
    expect(html).toContain("Starts When Dana Accepts");
    expect(html).toContain("Continue Setup");
    expect(html).not.toContain("Trial Ends");
    expect(html).not.toContain("Free Trial");
  });

  it("says so when the member has started nothing yet, instead of drawing an empty list", () => {
    const html = markupOf([], { subscription: null });
    expect(html).toContain("Nothing to bill yet.");
  });
});

describe("the Counterparty's page", () => {
  const joined = () =>
    row({
      id: "relationship-joined",
      viewerRole: "counterparty",
      isInitiator: false,
      initiatorName: "Marcus Reyes",
      membership: { state: "open", reason: null, endedAt: null, writable: true },
    });

  it("is one sentence, and the sentence is the bundle's", () => {
    const html = markupOf([joined()]);
    expect(html).toContain("Nothing to pay here.");
    expect(html).toContain("Marcus Reyes covers this relationship.");
    expect(html).toContain("You’re never charged.");
  });

  /**
   * **No billing fact reaches this render** (issue #1132 "Must not", locked rule 5). Not a price,
   * not a plan name, not the word trial, not a card, not an extension — and no aside, because the
   * bundle's Counterparty container has none.
   */
  it("carries no price, plan, trial, card or extension word anywhere in its document", () => {
    const html = markupOf([joined()]);
    // Read the *words*, not the markup: a Tailwind class (`bg-card`) is not a sentence a member
    // reads, and the leak rule is about what the page says.
    const text = html.replace(/<[^>]*>/g, " ");
    expect(text).not.toContain("$");
    expect(text).not.toMatch(/trial/i);
    expect(text).not.toMatch(/\bcard\b/i);
    expect(text).not.toMatch(/\bplan\b/i);
    expect(text).not.toMatch(/extension/i);
    expect(text).not.toMatch(/\bmonth\b/i);
    expect(html).not.toContain("Billing History");
    expect(html).not.toContain("How Trials Work");
    expect(html).not.toContain("Payment Method");
    expect(html).not.toContain("data-payment-action");
  });

  it("never draws another party's trial even when it is also an initiator", () => {
    const html = markupOf([row(), joined()]);
    // The payer's own panel is drawn — for their own relationship — and the joined one is a band.
    expect(html).toContain("Free Trial · 3 Days Left");
    expect(html).toContain("Marcus Reyes covers this relationship.");
    // One coverage band, and no second panel for the relationship they joined.
    expect(html.match(/data-payment-panel=/g) ?? []).toHaveLength(1);
  });
});

describe("the read's failure", () => {
  it("draws the reason and no panels rather than pretending the member owns nothing", () => {
    const view: BillingView = {
      role: "initiator",
      price: "$8.95",
      panels: [],
      coverage: [],
      cardOnFile: false,
      empty: true,
    };
    const html = renderToStaticMarkup(
      createElement(PaymentView, {
        copy: paymentPageCopy,
        view,
        unreadable: "DATABASE_URL is not set",
        onClaimExtension: () => Promise.resolve({ ok: false as const, code: "signed-out" }),
      }),
    );
    expect(html).toContain("could not be loaded just now");
    expect(html).toContain('data-payment-unreadable="DATABASE_URL is not set"');
    // The reason is the operator's, not the member's: it never becomes a sentence on the page.
    expect(html.replace(/<[^>]*>/g, " ")).not.toContain("DATABASE_URL");
  });
});
