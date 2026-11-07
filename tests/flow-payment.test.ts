/**
 * #619 — the payment model's arithmetic, without a database.
 *
 * Nothing here touches SQL: `lib/flow/payment.ts` and `lib/flow/payment-jobs.ts` decide every
 * window, phase and due job from instants, and this file pins them. The write side has its own
 * tests (`tests/payment-job-run.test.ts`) and the flow's status hinge is pinned in
 * `tests/flow-state.test.ts`.
 *
 * The four things that must not drift:
 *
 *   the windows      charge at day 7, remind at 3 and 10, expire at 14 — all from stored instants.
 *   the ladder       retries on day 1, 3 and 5 after the first failure, then nothing.
 *   the "armed" flag three-valued: `true`, `false`, and **`undefined` for a relationship that never
 *                    had an obligation** — the legacy rule, which must never read as unpaid.
 *   the last gate    sealed + unarmed is `awaiting_payment`, never `complete`.
 */
import { describe, expect, it } from "vitest";
import {
  CHARGE_ATTEMPT_LIMIT,
  chargeDueAtOf,
  chargeRetryAt,
  CHARGE_RETRY_OFFSET_DAYS,
  completionRefusalOf,
  METHOD_TRIAL_DAYS,
  PAYMENT_WINDOW_DAYS,
  paymentArmedOf,
  paymentDeadlineOf,
  paymentPhaseOf,
  reminderAtOf,
  reminderDueOf,
  expiryDueOf,
  type PaymentFacts,
} from "@/lib/flow/payment";
import { paymentJobKey, paymentJobsOf, retryDue } from "@/lib/flow/payment-jobs";
import { instanceStatusOf } from "@/lib/flow/state";

const SEALED = new Date("2026-11-01T12:00:00.000Z");
const day = (n: number) => new Date(SEALED.getTime() + n * 86_400_000);

/** A sealed relationship with a method on file at `SEALED`. Each test moves one field. */
function armed(overrides: Partial<PaymentFacts> = {}): PaymentFacts {
  return {
    methodCapturedAt: SEALED,
    chargedAt: null,
    expiredAt: null,
    expireReason: null,
    chargeAttempts: 0,
    firstFailedAt: null,
    sealedAt: SEALED,
    reminderDay3At: null,
    reminderDay10At: null,
    ...overrides,
  };
}

describe("the two windows", () => {
  it("takes the fee seven days after the method was captured", () => {
    expect(METHOD_TRIAL_DAYS).toBe(7);
    expect(chargeDueAtOf(SEALED)?.toISOString()).toBe("2026-11-08T12:00:00.000Z");
  });

  it("expires an unpaid seal fourteen days after it sealed", () => {
    expect(PAYMENT_WINDOW_DAYS).toBe(14);
    expect(paymentDeadlineOf(SEALED)?.toISOString()).toBe("2026-11-15T12:00:00.000Z");
  });

  it("has no deadline and no charge instant without the instant it counts from", () => {
    // A relationship whose second acceptance has not happened has no window at all: the clock
    // starts at the seal, and a null there must not become "1970 + 14 days".
    expect(paymentDeadlineOf(null)).toBeNull();
    expect(chargeDueAtOf(undefined)).toBeNull();
  });
});

describe("paymentArmedOf — three answers, and the third is not false", () => {
  it("answers undefined when there is no obligation at all", () => {
    // The legacy rule: a relationship created before `relationship_payment` existed was charged at
    // creation, so a missing row means "nobody measured this", never "unpaid".
    expect(paymentArmedOf(null)).toBeUndefined();
    expect(paymentArmedOf(undefined)).toBeUndefined();
  });

  it("answers false when the row exists and no method is on file", () => {
    expect(paymentArmedOf(armed({ methodCapturedAt: null }))).toBe(false);
  });

  it("answers true once a method is on file", () => {
    expect(paymentArmedOf(armed())).toBe(true);
  });

  it("answers true when the fee is already taken, even after the method row was pruned", () => {
    expect(paymentArmedOf(armed({ chargedAt: day(7) }))).toBe(true);
  });

  it("answers false for an expired obligation, whatever else the row says", () => {
    expect(paymentArmedOf(armed({ expiredAt: day(14), expireReason: "unpaid" }))).toBe(false);
  });

  it("answers false once the retry ladder is spent — a charge nobody can take", () => {
    const spent = armed({
      chargeAttempts: CHARGE_ATTEMPT_LIMIT,
      firstFailedAt: day(7),
    });
    expect(paymentArmedOf(spent)).toBe(false);
  });
});

describe("paymentPhaseOf — what the screen says, from rows only", () => {
  it("is `none` before a method exists, including for the no-row case", () => {
    expect(paymentPhaseOf(null, day(2))).toBe("none");
    expect(paymentPhaseOf(armed({ methodCapturedAt: null }), day(2))).toBe("none");
  });

  it("is `method-on-file` between capture and the first attempt", () => {
    expect(paymentPhaseOf(armed(), day(2))).toBe("method-on-file");
  });

  it("is `retrying` after a failed attempt", () => {
    expect(paymentPhaseOf(armed({ firstFailedAt: day(7), chargeAttempts: 1 }), day(8))).toBe(
      "retrying",
    );
  });

  it("is `charged` and then `expired` — terminal states win over the rest of the row", () => {
    expect(paymentPhaseOf(armed({ chargedAt: day(7) }), day(30))).toBe("charged");
    expect(paymentPhaseOf(armed({ expiredAt: day(14) }), day(30))).toBe("expired");
  });
});

describe("reminders — day 3 and day 10, each once", () => {
  it("owes nothing on day 2", () => {
    expect(reminderDueOf({ facts: armed(), now: day(2) })).toBeNull();
  });

  it("owes day 3 on the third day, and stops owing it once stamped", () => {
    expect(reminderDueOf({ facts: armed(), now: day(3) })).toBe(3);
    expect(reminderDueOf({ facts: armed({ reminderDay3At: day(3) }), now: day(4) })).toBeNull();
  });

  it("owes day 10 on the tenth day", () => {
    expect(reminderAtOf(SEALED, 10)?.toISOString()).toBe("2026-11-11T12:00:00.000Z");
    expect(reminderDueOf({ facts: armed({ reminderDay3At: day(3) }), now: day(10) })).toBe(10);
  });

  it("owes both when nothing ran for a fortnight — the catch-up case a cron outage produces", () => {
    // The stamp is per day, so a run that missed day 3 and then fires on day 11 owes day 10 only:
    // day 3's nag is history, and sending it late would be a lie about the deadline.
    expect(reminderDueOf({ facts: armed(), now: day(11) })).toBe(10);
  });

  it("owes nothing once the fee is taken or the obligation ended", () => {
    expect(reminderDueOf({ facts: armed({ chargedAt: day(4) }), now: day(10) })).toBeNull();
    expect(reminderDueOf({ facts: armed({ expiredAt: day(14) }), now: day(15) })).toBeNull();
  });
});

describe("the retry ladder", () => {
  const failed = armed({ firstFailedAt: day(7), chargeAttempts: 1 });

  it("retries one, three and five days after the first failure", () => {
    expect([...CHARGE_RETRY_OFFSET_DAYS]).toEqual([1, 3, 5]);
    expect(chargeRetryAt(failed)?.toISOString()).toBe("2026-11-09T12:00:00.000Z");
  });

  it("is not due before the rung arrives", () => {
    expect(retryDue({ facts: failed, now: day(7) })).toBe(false);
    expect(retryDue({ facts: failed, now: day(8) })).toBe(true);
  });

  it("stops after three retries — four attempts in all", () => {
    const spent = { ...failed, chargeAttempts: CHARGE_ATTEMPT_LIMIT };
    expect(CHARGE_ATTEMPT_LIMIT).toBe(4);
    expect(retryDue({ facts: spent, now: day(30) })).toBe(false);
    expect(expiryDueOf({ facts: spent, now: day(30) })).toBe("charge-failed");
  });
});

describe("expiry", () => {
  it("expires an unpaid seal at day 14 and not a second earlier", () => {
    expect(expiryDueOf({ facts: armed(), now: day(13) })).toBeNull();
    expect(expiryDueOf({ facts: armed(), now: day(14) })).toBe("unpaid");
  });

  it("never expires a relationship whose fee was taken or whose obligation already ended", () => {
    expect(expiryDueOf({ facts: armed({ chargedAt: day(7) }), now: day(30) })).toBeNull();
    expect(expiryDueOf({ facts: armed({ expiredAt: day(14) }), now: day(30) })).toBeNull();
  });
});

describe("paymentJobsOf — the order the route runs", () => {
  it("owes nothing in the quiet middle", () => {
    expect(paymentJobsOf({ facts: armed(), now: day(2) })).toEqual([]);
  });

  it("owes a nag and then the retry on day 8", () => {
    const facts = armed({ firstFailedAt: day(7), chargeAttempts: 1 });
    expect(paymentJobsOf({ facts, now: day(8) })).toEqual([
      { kind: "remind", day: 3 },
      { kind: "retry-charge" },
    ]);
  });

  it("returns expiry alone — a nag must not follow an ended obligation", () => {
    expect(paymentJobsOf({ facts: armed({ reminderDay3At: day(3) }), now: day(14) })).toEqual([
      { kind: "expire", reason: "unpaid" },
    ]);
  });

  it("keys a job by relationship and what it does", () => {
    expect(paymentJobKey("rel_1", { kind: "remind", day: 3 })).toBe("rel_1:remind:3");
    expect(paymentJobKey("rel_1", { kind: "retry-charge" })).toBe("rel_1:retry-charge");
    expect(paymentJobKey("rel_1", { kind: "expire", reason: "unpaid" })).toBe(
      "rel_1:expire:unpaid",
    );
  });
});

describe("completionRefusalOf — asked only when an obligation exists", () => {
  it("refuses when it is handed no facts at all", () => {
    // `null` here is "this relationship's payment was not read", not "no obligation": the caller
    // that finds no `relationship_payment` row never calls this function — it completes the
    // relationship for free, because a legacy relationship was charged at creation (#619). Asking
    // this function about an unread row would refuse a fee that was already paid.
    expect(completionRefusalOf(null)).toBe("method-required");
  });

  it("refuses a sealed relationship with no method, and says which", () => {
    expect(completionRefusalOf(armed({ methodCapturedAt: null }))).toBe("method-required");
  });

  it("refuses an expired obligation", () => {
    expect(completionRefusalOf(armed({ expiredAt: day(14) }))).toBe("expired");
  });

  it("lets an armed relationship through", () => {
    expect(completionRefusalOf(armed())).toBeNull();
  });
});

describe("instanceStatusOf — the fee is the last gate", () => {
  const sealed = {
    aspectCount: 2,
    hasCounterparty: true,
    initiatorAnswered: 2,
    counterpartyAnswered: 2,
    initiatorAccepted: 1,
    counterpartyAccepted: 1,
  };

  it("is awaiting_payment when both accepted and the fee is unarmed", () => {
    expect(instanceStatusOf({ ...sealed, paymentArmed: false })).toBe("awaiting_payment");
  });

  it("is complete when the fee is armed", () => {
    expect(instanceStatusOf({ ...sealed, paymentArmed: true })).toBe("complete");
  });

  it("is complete when nobody measured — the legacy direction", () => {
    // A read path that never learned about payment must not turn every finished session into a
    // paywall; the server action refuses on its own re-read.
    expect(instanceStatusOf(sealed)).toBe("complete");
  });

  it("stays answering before the second acceptance, whatever the money says", () => {
    expect(instanceStatusOf({ ...sealed, counterpartyAccepted: 0, paymentArmed: false })).toBe(
      "answering",
    );
  });
});
