/**
 * The Payment surface's table (#1132).
 *
 * The issue's spec is a list of states — a running trial, an invitation nobody has answered, a
 * draft, a pause with one free week, and a Counterparty who is never charged — plus two "must not"s
 * that are worth more than the states: **no second free week**, and **no billing fact on the
 * Counterparty's render**. Every one of those is decided in `lib/billing/payment-view.ts`, so the
 * cases below are that function's table, built from real `MemberRelationshipRow` shapes rather than
 * from a hand-written panel.
 *
 * Three groups:
 *
 *   the states   one case per panel, asserting the badge, the rows it draws, its note and its
 *                actions — including the two the prototype has no panel for (a paid account, and a
 *                lapse that was not the trial) and the one it got wrong (a draft's trial sentence).
 *   the leak     the Counterparty's coverage band holds no price, plan, trial, card or extension
 *                word, and the fixture section it reads has none of them either.
 *   the fixture  every copy id the derivation can emit exists in `data/pages/payment.ts`, and every
 *                `{placeholder}` it fills is spelled the way the fixture spells it. A computed id is
 *                invisible to E23, so this is the ratchet that keeps the two halves joined.
 */
import { describe, expect, it } from "vitest";

import { formatCurrency } from "@/content/core";
import { billingPlan } from "@/data/billing-plans";
import { paymentPageCopy } from "@/data/pages/payment";
import type { Subscription } from "@/lib/billing/types";
import {
  billingViewOf,
  cardOnFileOf,
  firstNameOf,
  initialsOf,
  membershipPrice,
  type BillingFacts,
  type PanelText,
} from "@/lib/billing/payment-view";
import type { MemberRelationshipRow } from "@/lib/member/relationships";
import { itemLabelOr, sectionOf } from "@/lib/page-copy";

const NOW = new Date("2026-11-16T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

/** A live trial three days from its end — the bundle's headline panel. */
const TRIAL_ENDS = new Date(NOW.getTime() + 3 * DAY);

function trialSubscription(overrides: Partial<Subscription> = {}): Subscription {
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

/**
 * One relationship row, as `listMyRelationships()` builds it.
 *
 * Defaults describe the trial panel: an `active` relationship whose seats are bound and whose
 * membership is open. Each case overrides only the facts its state is made of, which is what makes
 * a failure readable — a case that fails on "the badge says Not Started" names the four fields it
 * changed and nothing else.
 */
function rowOf(overrides: Partial<MemberRelationshipRow> = {}): MemberRelationshipRow {
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

function factsOf(overrides: Partial<BillingFacts> = {}): BillingFacts {
  return {
    rows: [rowOf()],
    subscription: trialSubscription(),
    trialExtendedAt: null,
    now: NOW,
    ...overrides,
  };
}

/** The words a panel carries, resolved the way the view resolves them. */
function wordsOf(value: PanelText): string {
  const section = sectionOf(paymentPageCopy, "memberships");
  if (value.kind === "text") return value.text;
  const template = itemLabelOr(section, value.id) ?? "";
  const filled: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value.values ?? {})) {
    filled[key] = typeof raw === "object" ? wordsOf(raw) : String(raw);
  }
  return Object.entries(filled).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, value),
    template,
  );
}

function onlyPanel(facts: BillingFacts) {
  const view = billingViewOf(facts);
  expect(view.panels).toHaveLength(1);
  const panel = view.panels[0];
  if (panel === undefined) throw new Error("no panel");
  return panel;
}

describe("the trial panel", () => {
  it("counts the days the subscription row has left, and names the end", () => {
    const panel = onlyPanel(factsOf());
    expect(panel.state).toBe("trial");
    expect(wordsOf(panel.badge)).toBe("Free Trial · 3 Days Left");
    const trialEnds = panel.fields.find((field) => field.label === "trial-ends");
    expect(trialEnds).toBeDefined();
    expect(wordsOf(trialEnds?.value ?? { kind: "text", text: "" })).toBe("Nov 19, 2026");
  });

  it("prices the membership from the plan fixture, not from the bundle's mock figure", () => {
    const plan = billingPlan("basic");
    expect(plan).toBeDefined();
    expect(membershipPrice()).toBe(formatCurrency(plan?.monthlyCents ?? 0));
    // The prototype draws "$9.99 / month" as fixture data, and since #1127's approved catalogue
    // Basic's own month is $9.99 too: the mock and the fixture now agree on the number, so the
    // check that the price is *derived* is the assertion above, not a difference from the mock.
    const panel = onlyPanel(factsOf());
    const afterTrial = panel.fields.find((field) => field.label === "after-trial");
    expect(wordsOf(afterTrial?.value ?? { kind: "text", text: "" })).toBe(membershipPrice());
  });

  it("offers one action, and it is the existing checkout", () => {
    const panel = onlyPanel(factsOf());
    expect(panel.actions).toEqual(["add-card"]);
    expect(wordsOf(panel.note)).toBe("Add a card before Nov 19, 2026 to keep Stage 6 running.");
    // The pay modal is stage 5's walk for this relationship's session — never a new capture path.
    expect(panel.payHref).toContain("instance=session-1");
  });

  it("says the card is none on file while the trial is card-free", () => {
    const panel = onlyPanel(factsOf());
    const card = panel.fields.find((field) => field.label === "card");
    expect(wordsOf(card?.value ?? { kind: "text", text: "" })).toBe("None on file");
    expect(cardOnFileOf(trialSubscription())).toBe(false);
  });

  it("stops asking for a card once one is on file, and says the trial converts", () => {
    const stripe = trialSubscription({ provider: "stripe" });
    const panel = onlyPanel(factsOf({ subscription: stripe }));
    expect(cardOnFileOf(stripe)).toBe(true);
    expect(panel.actions).toEqual([]);
    expect(wordsOf(panel.note)).toBe(
      "Your trial ends Nov 19, 2026. Your card is charged then, and Stage 6 keeps running.",
    );
  });
});

describe("before the trial starts", () => {
  it("draws a sent invitation with no countdown and no action", () => {
    const panel = onlyPanel(
      factsOf({
        subscription: null,
        rows: [
          rowOf({
            status: "published",
            sessionRecordId: null,
            invite: { claimed: false, revoked: false, expiresAt: new Date(NOW.getTime() + DAY) },
            view: "invite-live",
          }),
        ],
      }),
    );
    expect(panel.state).toBe("invite-sent");
    expect(wordsOf(panel.badge)).toBe("Trial Starts When Elena Accepts");
    // No end date row at all: an unanswered invitation is spending no days.
    expect(panel.fields.some((field) => field.label === "trial-ends")).toBe(false);
    expect(panel.fields.some((field) => field.label === "after-trial")).toBe(true);
    expect(panel.actions).toEqual([]);
    expect(wordsOf(panel.note)).toBe(
      "Your 7-day free trial starts when Elena accepts. No card needed.",
    );
  });

  /**
   * #1132's copy rule, and the one correction the issue asks for.
   *
   * The prototype said the trial starts when you **send** the invite; the bundle fixed it to
   * "when {name} accepts", which is what the rows do — `grantAcceptanceTrial()` runs inside
   * `claimInvite()` and nowhere else (`lib/db/billing.ts`). So a draft says "accepts" too, and the
   * forbidden sentence appears on no surface.
   */
  it("tells a draft that the week starts when the other person accepts, never when you send", () => {
    const panel = onlyPanel(
      factsOf({
        subscription: null,
        rows: [
          rowOf({
            status: "draft",
            sessionRecordId: "session-1",
            invite: null,
            view: "not-published",
            publishedAt: null,
            counterpartyName: "Dana Kim",
            counterpartySeatName: null,
          }),
        ],
      }),
    );
    expect(panel.state).toBe("draft");
    expect(wordsOf(panel.badge)).toBe("Not Started");
    const trial = panel.fields.find((field) => field.label === "trial");
    expect(wordsOf(trial?.value ?? { kind: "text", text: "" })).toBe("Starts When Dana Accepts");
    expect(wordsOf(panel.note)).toBe(
      "Send the invite. Your 7-day free trial starts when Dana accepts.",
    );
    expect(panel.actions).toEqual(["continue-setup"]);

    const everyDraftWord = [
      wordsOf(panel.badge),
      wordsOf(panel.note),
      ...panel.fields.map((field) => wordsOf(field.value)),
    ].join(" ");
    // The prototype's sentence — the one #1132 names and refuses — and its reading.
    expect(everyDraftWord).not.toMatch(/starts when you send/i);
    expect(everyDraftWord).not.toMatch(/send the invite[\s\S]*when you send/i);
    expect(everyDraftWord).toContain("accepts");
  });

  it("sends Continue Setup to the pay walk when there is a session, and to the record when not", () => {
    expect(
      onlyPanel(
        factsOf({
          subscription: null,
          rows: [rowOf({ status: "draft", invite: null, view: "not-published" })],
        }),
      ).payHref,
    ).toContain("/invite?instance=session-1");
    expect(
      onlyPanel(
        factsOf({
          subscription: null,
          rows: [
            rowOf({ status: "draft", invite: null, view: "not-published", sessionRecordId: null }),
          ],
        }),
      ).payHref,
    ).toBeNull();
  });
});

describe("the paused panel", () => {
  const lapsedMembership = {
    state: "lapsed" as const,
    reason: "trial-ended" as const,
    endedAt: TRIAL_ENDS,
    writable: false,
  };

  function pausedFacts(trialExtendedAt: Date | null = null): BillingFacts {
    return factsOf({
      subscription: trialSubscription(),
      trialExtendedAt,
      now: new Date(TRIAL_ENDS.getTime() + DAY),
      rows: [rowOf({ status: "expired", membership: lapsedMembership })],
    });
  }

  it("offers both ways back while the free week is unclaimed", () => {
    const panel = onlyPanel(pausedFacts());
    expect(panel.state).toBe("paused");
    expect(panel.pausedKind).toBe("trial");
    expect(wordsOf(panel.badge)).toBe("Paused");
    expect(panel.actions).toEqual(["add-card", "get-week"]);
    const extra = panel.fields.find((field) => field.label === "extra-week");
    expect(wordsOf(extra?.value ?? { kind: "text", text: "" })).toBe("1 Free Week Available");
    expect(wordsOf(panel.note)).toBe(
      "Stage 6 is paused. Add a card to resume, or take one free extra week. Everything is saved.",
    );
  });

  /**
   * **One extension, once.** The claim is a `plan_grant` row; its presence is what hides the offer,
   * for good and for every relationship the account runs. The panel must not merely disable the
   * button — the issue says the extension *hides*.
   */
  it("hides the free week once it has been used, and says why", () => {
    const panel = onlyPanel(pausedFacts(new Date(TRIAL_ENDS.getTime() + DAY)));
    expect(panel.state).toBe("paused");
    expect(panel.pausedKind).toBe("extra-week");
    expect(panel.actions).toEqual(["add-card"]);
    expect(panel.actions).not.toContain("get-week");
    expect(panel.fields.some((field) => field.label === "extra-week")).toBe(false);
    expect(wordsOf(panel.note)).toContain("one time only");
  });

  it("hides the offer for every relationship at once — the claim belongs to the account", () => {
    const view = billingViewOf(
      factsOf({
        trialExtendedAt: new Date(TRIAL_ENDS.getTime() + DAY),
        now: new Date(TRIAL_ENDS.getTime() + DAY),
        rows: [
          rowOf({ id: "relationship-a", status: "expired", membership: lapsedMembership }),
          rowOf({ id: "relationship-b", status: "expired", membership: lapsedMembership }),
        ],
      }),
    );
    expect(view.panels.map((panel) => panel.actions.includes("get-week"))).toEqual([false, false]);
  });

  /**
   * A cancelled or failed payment is **not** the trial ending, and `pauseOf()` deliberately answers
   * `running` for it so nobody is offered a free week they already paid for. The panel still has to
   * be honest: read-only, no offer, and no "Trial Ended" heading over a payment that failed.
   */
  it("does not dress a failed payment as a trial that ran out", () => {
    const panel = onlyPanel(
      factsOf({
        subscription: trialSubscription({ status: "canceled" }),
        rows: [
          rowOf({
            status: "expired",
            membership: {
              state: "lapsed",
              reason: "payment-failed",
              endedAt: TRIAL_ENDS,
              writable: false,
            },
          }),
        ],
      }),
    );
    expect(panel.state).toBe("paused");
    expect(panel.pausedKind).toBe("other");
    expect(panel.actions).toEqual(["add-card"]);
    expect(panel.fields.some((field) => field.label === "trial-ended")).toBe(false);
    expect(panel.fields.some((field) => field.label === "ended")).toBe(true);
    expect(wordsOf(panel.note)).not.toMatch(/free extra week/);
  });
});

describe("the states the bundle has no panel for", () => {
  it("draws a paid account as active rather than as a trial that never started", () => {
    const panel = onlyPanel(
      factsOf({
        subscription: trialSubscription({
          status: "active",
          provider: "stripe",
          currentPeriodEnd: new Date(NOW.getTime() + 30 * DAY).toISOString(),
        }),
      }),
    );
    expect(panel.state).toBe("paid");
    expect(wordsOf(panel.badge)).toBe("Membership Active");
    expect(panel.actions).toEqual([]);
    expect(panel.fields.some((field) => field.label === "trial-ends")).toBe(false);
    expect(wordsOf(panel.note)).toBe("Your membership is active. Nothing to do here.");
  });

  it("leaves a closed relationship off the page entirely", () => {
    const view = billingViewOf(
      factsOf({
        rows: [
          rowOf({
            id: "relationship-done",
            status: "complete",
            membership: { state: "closed", reason: null, endedAt: null, writable: false },
          }),
        ],
      }),
    );
    expect(view.panels).toEqual([]);
    expect(view.coverage).toEqual([]);
  });
});

describe("the Counterparty", () => {
  const joined = () =>
    rowOf({
      id: "relationship-joined",
      viewerRole: "counterparty",
      isInitiator: false,
      initiatorName: "Marcus Reyes",
      membership: { state: "open", reason: null, endedAt: null, writable: true },
    });

  it("gets the coverage band and no panel at all", () => {
    const view = billingViewOf(factsOf({ rows: [joined()] }));
    expect(view.role).toBe("counterparty");
    expect(view.panels).toEqual([]);
    expect(view.coverage).toEqual([{ initiator: "Marcus Reyes" }]);
  });

  it("reads one band per covering account, and no duplicate for a second relationship", () => {
    const view = billingViewOf(
      factsOf({ rows: [joined(), { ...joined(), id: "relationship-joined-2" }] }),
    );
    expect(view.coverage).toHaveLength(1);
  });

  it("keeps its panels when it also pays for one — its own billing is its own", () => {
    const view = billingViewOf(factsOf({ rows: [rowOf(), joined()] }));
    expect(view.role).toBe("initiator");
    expect(view.panels).toHaveLength(1);
    expect(view.coverage).toHaveLength(1);
  });

  /** The band's own words, and the fixture section it reads: no money, no week, no extension. */
  it("is told nothing about money, plan, trial or card", () => {
    const coverage = sectionOf(paymentPageCopy, "coverage");
    const words = [coverage.items?.map((item) => item.label).join(" ") ?? ""].join(" ");
    expect(words).toContain("{initiator} covers this relationship.");
    expect(words).toContain("You’re never charged.");
    for (const forbidden of [
      /\$/,
      /\bplan\b/i,
      /\btrial\b/i,
      /\bcard\b/i,
      /\bextension\b/i,
      /subscription/i,
      /checkout/i,
      /\bbilling\b/i,
      /\bmonth\b/i,
      /\bpause/i,
    ]) {
      expect(words).not.toMatch(forbidden);
    }
  });
});

describe("the fixture carries every id the derivation can emit", () => {
  const section = sectionOf(paymentPageCopy, "memberships");
  const subscriptions: Record<string, Subscription | null> = {
    trial: trialSubscription(),
    "no-subscription": null,
    paid: trialSubscription({ status: "active" }),
    canceled: trialSubscription({ status: "canceled" }),
  };
  const rows: Record<string, MemberRelationshipRow> = {
    trial: rowOf(),
    "invite-sent": rowOf({
      status: "published",
      invite: { claimed: false, revoked: false, expiresAt: new Date(NOW.getTime() + DAY) },
    }),
    draft: rowOf({ status: "draft", invite: null, sessionRecordId: null }),
    paused: rowOf({
      status: "expired",
      membership: {
        state: "lapsed",
        reason: "trial-ended",
        endedAt: TRIAL_ENDS,
        writable: false,
      },
    }),
    "paused-extended": rowOf({
      status: "expired",
      membership: {
        state: "lapsed",
        reason: "trial-ended",
        endedAt: TRIAL_ENDS,
        writable: false,
      },
    }),
    "payment-failed": rowOf({
      status: "expired",
      membership: {
        state: "lapsed",
        reason: "payment-failed",
        endedAt: TRIAL_ENDS,
        writable: false,
      },
    }),
    "no-name": rowOf({ counterpartyName: null, counterpartySeatName: null }),
  };
  const cases: Array<[string, keyof typeof subscriptions, string, Date | null, Date]> = [
    ["trial", "trial", "trial", null, NOW],
    ["invite-sent", "no-subscription", "invite-sent", null, NOW],
    ["draft", "no-subscription", "draft", null, NOW],
    ["paused", "trial", "paused", null, new Date(TRIAL_ENDS.getTime() + DAY)],
    [
      "paused-extended",
      "trial",
      "paused-extended",
      TRIAL_ENDS,
      new Date(TRIAL_ENDS.getTime() + DAY),
    ],
    ["payment-failed", "canceled", "payment-failed", null, NOW],
    ["paid", "paid", "trial", null, NOW],
    ["no-name", "no-subscription", "draft", null, NOW],
  ];

  for (const [label, subscription, row, extendedAt, now] of cases) {
    it(`resolves every word of the ${label} panel`, () => {
      const panel = onlyPanel({
        rows: [rows[row] ?? rowOf()],
        subscription: subscriptions[subscription] ?? null,
        trialExtendedAt: extendedAt,
        now,
      });
      const texts: PanelText[] = [panel.badge, panel.note, panel.partner];
      for (const field of panel.fields) {
        texts.push(field.value);
        // The field's own label is a fixture id too.
        expect(itemLabelOr(section, field.label), `field label ${field.label}`).toBeDefined();
      }
      for (const value of texts) {
        if (value.kind === "text") continue;
        expect(itemLabelOr(section, value.id), `item ${value.id}`).toBeDefined();
      }
      // The `With {name}` line and the three action labels the view prints.
      for (const id of ["with", "add-card", "continue-setup", "get-week", "get-week-pending"]) {
        expect(itemLabelOr(section, id), `item ${id}`).toBeDefined();
      }
    });
  }

  it("leaves no placeholder unfilled in any note it can emit", () => {
    for (const panel of billingViewOf(
      factsOf({
        rows: [rowOf(), rowOf({ id: "relationship-draft", status: "draft", invite: null })],
      }),
    ).panels) {
      expect(wordsOf(panel.note)).not.toMatch(/\{[a-z]+\}/);
    }
  });
});

describe("the small readers", () => {
  it("takes a first name, and refuses to invent one", () => {
    expect(firstNameOf("Tomás Álvarez")).toBe("Tomás");
    expect(firstNameOf("  ")).toBeUndefined();
    expect(firstNameOf(null)).toBeUndefined();
  });

  it("draws two initials, and none for an empty name", () => {
    expect(initialsOf("Elena Reyes")).toBe("ER");
    expect(initialsOf("Elena")).toBe("E");
    expect(initialsOf("")).toBe("");
  });
});
