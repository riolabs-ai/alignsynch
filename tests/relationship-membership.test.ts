/**
 * The membership rule, driven with literals (#533 phase 3) — no database, no clock.
 *
 * Four claims, and every write path in the phase depends on them:
 *
 *   1. **The trial's last instant is the boundary.** Strictly before it the pair may write; at it
 *      they may not. `membershipOf()` reads the same `TrialFacts` phase 1 defined, so the screen,
 *      the answer sheet and the claim refusal cannot disagree about which side of the instant they
 *      are on.
 *   2. **`complete` and `void` are closed, not lapsed.** Money does not reopen a decision, and a
 *      finished report is not a billing problem — a false "your membership ended" band on a
 *      delivered report is worse than no band.
 *   3. **The reason is the three-word vocabulary, and it comes from the subscription when no row
 *      recorded one.** A cancellation and an exhausted trial are different news.
 *   4. **The sentence names the initiator's membership.** #533's card says the counterparty must not
 *      read a lapse as their own failure; this asserts the words that make that true.
 *
 * Plus one cross-module pin: `MEMBERSHIP_ENTITLING_STATUSES` must equal
 * `lib/billing/entitlements.ts`'s paid set, or the screen and the plan gate would disagree about
 * whether an account is paying.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  LAPSE_EXTENSION_DAYS,
  MEMBERSHIP_ENTITLING_STATUSES,
  lapseSentenceOf,
  membershipOf,
  membershipSentence,
} from "@/lib/relationship/membership";
import { leakWords } from "@/lib/email/override";
import { METHOD_TRIAL_DAYS } from "@/lib/flow/payment";
import { TRIAL_DAYS } from "@/lib/relationship/trial";

const NOW = new Date("2026-11-04T12:00:00.000Z");
const TRIAL_ENDS = new Date("2026-11-18T09:59:05.789Z");

const trial = (
  status: "trialing" | "active" | "past_due" | "canceled" | "incomplete",
  ends = TRIAL_ENDS,
) => ({
  status,
  currentPeriodEnd: ends,
});

describe("membershipOf — the three states", () => {
  it("keeps a running trial open, at millisecond resolution either side of the boundary", () => {
    const before = new Date(TRIAL_ENDS.getTime() - 1);
    expect(
      membershipOf({ status: "published", subscription: trial("trialing"), now: before }),
    ).toMatchObject({
      state: "open",
      writable: true,
    });
    expect(
      membershipOf({ status: "published", subscription: trial("trialing"), now: TRIAL_ENDS }),
    ).toMatchObject({
      state: "lapsed",
      writable: false,
      reason: "trial-ended",
      endedAt: TRIAL_ENDS,
    });
  });

  it("lapses a live relationship the instant its trial's period end is reached", () => {
    const membership = membershipOf({
      status: "active",
      subscription: trial("trialing"),
      now: NOW,
      // The row says 2026-11-18; the clock is 2026-11-04 — still open.
    });
    expect(membership.state).toBe("open");

    const lapsed = membershipOf({
      status: "active",
      subscription: trial("trialing", new Date("2026-11-01T00:00:00.000Z")),
      now: NOW,
    });
    expect(lapsed).toMatchObject({ state: "lapsed", reason: "trial-ended", writable: false });
    expect(lapsed.endedAt?.toISOString()).toBe("2026-11-01T00:00:00.000Z");
  });

  it("treats a cancelled subscription as lapsed, with its own reason", () => {
    expect(
      membershipOf({ status: "active", subscription: trial("canceled"), now: NOW }),
    ).toMatchObject({ state: "lapsed", reason: "subscription-canceled" });
  });

  it("keeps past_due entitled, because dunning is a grace period", () => {
    expect(
      membershipOf({ status: "active", subscription: trial("past_due"), now: NOW }),
    ).toMatchObject({
      state: "open",
      writable: true,
    });
  });

  it("keeps a `published` relationship open while no trial has opened — a pending invitation", () => {
    // #1115 / spec D3 — the week starts when the Counterparty accepts, so a published relationship
    // whose invitation nobody has answered holds **no** subscription row and has spent nothing.
    // Reading it as `lapsed` is not a stricter answer, it is a wrong one: `lapseIfDue()` would flip
    // the row to `expired` before the invitation was ever accepted, which is the lock-out #840
    // fixed — now reachable without a trial at all.
    expect(membershipOf({ status: "published", subscription: null, now: NOW })).toMatchObject({
      state: "open",
      writable: true,
    });
  });

  it("still lapses an `active` relationship whose account holds no subscription at all", () => {
    // The acceptance writes the trial in the transaction that makes the pair `active`, so an
    // `active` row with no subscription is drift (or an account that never had one to grant to),
    // and the safe direction for drift is read-only.
    expect(membershipOf({ status: "active", subscription: null, now: NOW })).toMatchObject({
      state: "lapsed",
      writable: false,
    });
  });

  it("reads an expired row as lapsed whatever the subscription now says, using the stored instant", () => {
    const expiredAt = new Date("2026-10-30T08:00:00.000Z");
    const membership = membershipOf({
      status: "expired",
      subscription: trial("active", new Date("2026-12-01T00:00:00.000Z")),
      expiredAt,
      lapseReason: "payment-failed",
      now: NOW,
    });
    expect(membership).toMatchObject({
      state: "lapsed",
      reason: "payment-failed",
      writable: false,
      endedAt: expiredAt,
    });
  });

  it("ignores a lapse reason this build does not carry, and falls back to the subscription", () => {
    const membership = membershipOf({
      status: "expired",
      subscription: trial("canceled"),
      expiredAt: new Date("2026-10-30T08:00:00.000Z"),
      lapseReason: "some-future-reason",
      now: NOW,
    });
    expect(membership.reason).toBe("subscription-canceled");
  });

  it("is closed — not lapsed — for complete and void, whatever the money did", () => {
    for (const status of ["complete", "void"] as const) {
      const membership = membershipOf({ status, subscription: null, now: NOW });
      expect(membership, status).toMatchObject({ state: "closed", writable: false, reason: null });
    }
  });

  it("treats a draft as open, because nothing has been sold yet", () => {
    expect(membershipOf({ status: "draft", subscription: null, now: NOW }).state).toBe("open");
    expect(membershipOf({ status: "pending", subscription: null, now: NOW }).state).toBe("open");
  });
});

describe("the sentence both seats read", () => {
  it("names the initiator's membership, the instant and what stopped working", () => {
    const membership = membershipOf({
      status: "expired",
      subscription: trial("trialing"),
      expiredAt: TRIAL_ENDS,
      lapseReason: "trial-ended",
      now: NOW,
    });
    const sentence = membershipSentence(membership, "Avery");
    expect(sentence).toContain("Avery's membership ended on 2026-11-18T09:59:05.789Z");
    expect(sentence).toContain("the 14-day trial ended");
    expect(sentence).toContain("read-only for both of you");
    // The counterparty bought nothing. The sentence must not address them as the payer.
    expect(sentence).not.toContain("your membership");
  });

  it("falls back to 'the initiator' when the name was not read", () => {
    const membership = membershipOf({ status: "expired", subscription: null, now: NOW });
    expect(membershipSentence(membership)).toContain("the initiator's membership ended");
  });

  it("says nothing about a lapse for the two other states", () => {
    expect(
      membershipSentence(
        membershipOf({ status: "active", subscription: trial("active"), now: NOW }),
      ),
    ).toBe("the initiator's membership is live");
    expect(membershipSentence(membershipOf({ status: "void", subscription: null, now: NOW }))).toBe(
      "this relationship is closed",
    );
  });
});

/**
 * #1224 — **the lapse line is written for the seat that reads it.**
 *
 * The detail screen printed one sentence to both people, and it named "the 14-day trial" and a
 * payment to the person who was invited — someone who bought nothing and was never asked to. The
 * owner's decision on the issue is *7 days free, then one free 7-day extension*, so `TRIAL_DAYS`
 * (14) is the promoted **total** and the trial's own name is 7. The clock was never wrong; the
 * sentence was.
 *
 * The cases below pin the two halves and the derivation between them: the Counterparty's line
 * carries none of the six words the card bans, and the Initiator's two numbers come from
 * `METHOD_TRIAL_DAYS` and `TRIAL_DAYS − METHOD_TRIAL_DAYS` rather than from a typed literal, so a
 * future change to either constant moves the copy instead of leaving it lying.
 */
describe("#1224 — the lapse line, per seat", () => {
  const lapsed = (reason: "trial-ended" | "payment-failed" | "subscription-canceled") =>
    membershipOf({
      status: "expired",
      subscription: null,
      expiredAt: TRIAL_ENDS,
      lapseReason: reason,
      now: NOW,
    });

  /**
   * The card's six words plus the currency sign. Word-bounded and case-insensitive, the same shape
   * `lib/email/override.ts::leakWords()` uses for the Counterparty's mail — and asserted against it
   * as well, so the two halves of the product cannot disagree about the vocabulary.
   */
  const BILLING: readonly RegExp[] = [
    /\bprices?\b/i,
    /\btrials?\b/i,
    /\bcards?\b/i,
    /\bpayments?\b/i,
    /\bplans?\b/i,
    /\bmemberships?\b/i,
    /\$/,
  ];

  it("tells the Counterparty the pause, the name and the promise — and no billing word", () => {
    for (const reason of ["trial-ended", "payment-failed", "subscription-canceled"] as const) {
      const sentence = lapseSentenceOf({
        membership: lapsed(reason),
        seat: "counterparty",
        initiatorName: "Marcus",
      });
      expect(sentence).toBe("Stage 6 is paused until Marcus resumes it. Everything is saved.");
      for (const word of BILLING) expect(sentence ?? "").not.toMatch(word);
      expect(leakWords(sentence ?? "")).toEqual([]);
    }
  });

  it("falls back to 'the initiator' for a Counterparty when the name was not read", () => {
    expect(
      lapseSentenceOf({
        membership: lapsed("trial-ended"),
        seat: "counterparty",
        initiatorName: null,
      }),
    ).toBe("Stage 6 is paused until the initiator resumes it. Everything is saved.");
    expect(lapseSentenceOf({ membership: lapsed("trial-ended"), seat: "counterparty" })).toBe(
      "Stage 6 is paused until the initiator resumes it. Everything is saved.",
    );
  });

  it("gives the Initiator both numbers, derived from the constants and never typed", () => {
    const sentence = lapseSentenceOf({
      membership: lapsed("trial-ended"),
      seat: "initiator",
      initiatorName: "Marcus",
    });
    expect(METHOD_TRIAL_DAYS).toBe(7);
    expect(LAPSE_EXTENSION_DAYS).toBe(TRIAL_DAYS - METHOD_TRIAL_DAYS);
    expect(sentence).toBe(
      `Your ${METHOD_TRIAL_DAYS}-day free trial and free ${LAPSE_EXTENSION_DAYS}-day Extra Week ended with no card added, so Stage 6 is paused.`,
    );
    // The defect #1224 names: the promoted total is not the trial's name.
    expect(sentence).not.toContain("14-day");
    // Copy rule 5: the word is "Stage 6" and "Extra Week", never "Align is paused" or "extension".
    expect(sentence).not.toContain("Align is paused");
    expect(sentence).not.toContain("extension");
  });

  it("keeps today's fact for a failed payment and a cancellation, in the same calm tone", () => {
    expect(lapseSentenceOf({ membership: lapsed("payment-failed"), seat: "initiator" })).toBe(
      "The payment did not go through, so Stage 6 is paused.",
    );
    expect(
      lapseSentenceOf({ membership: lapsed("subscription-canceled"), seat: "initiator" }),
    ).toBe("The subscription was cancelled, so Stage 6 is paused.");
  });

  it("says nothing at all while nothing has lapsed", () => {
    const open = membershipOf({ status: "published", subscription: trial("trialing"), now: NOW });
    const closed = membershipOf({ status: "void", subscription: null, now: NOW });
    for (const seat of ["initiator", "counterparty"] as const) {
      expect(lapseSentenceOf({ membership: open, seat })).toBeNull();
      expect(lapseSentenceOf({ membership: closed, seat })).toBeNull();
    }
  });
});

describe("the vocabulary agrees with the modules it mirrors", () => {
  it("carries the same entitling statuses as lib/billing/entitlements.ts", () => {
    const source = readFileSync(new URL("../lib/billing/entitlements.ts", import.meta.url), "utf8");
    const match = /PAID_STATUSES[^=]*=\s*new Set\(\[([^\]]+)\]\)/.exec(source);
    expect(
      match,
      "entitlements.ts no longer declares PAID_STATUSES as a literal set",
    ).not.toBeNull();
    const listed = (match?.[1] ?? "")
      .split(",")
      .map((word) => word.trim().replace(/^"|"$/g, ""))
      .filter((word) => word !== "");
    expect([...MEMBERSHIP_ENTITLING_STATUSES].sort()).toEqual([...listed].sort());
  });

  it("keeps #533's fourteen days as the trial length", () => {
    expect(TRIAL_DAYS).toBe(14);
  });

  it("reads no clock of its own", () => {
    const source = readFileSync(
      new URL("../lib/relationship/membership.ts", import.meta.url),
      "utf8",
    );
    expect(source).not.toMatch(/new Date\(\s*\)/);
    expect(source).not.toMatch(/Date\.now\(/);
  });
});
