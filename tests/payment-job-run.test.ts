/**
 * #619 — the job's writes, against a recording fake rather than a database.
 *
 * `tests/flow-payment.test.ts` pins **what is due**; this file pins **what the job does about it**.
 * The four claims that matter, and each one is a mistake the model invites:
 *
 *   reminders are never stamped without a delivery function  — a stored "sent" with no message is
 *                                                              the defect this card removes.
 *   a retry charges the amount the first attempt recorded   — not a re-priced fee from a plan the
 *                                                              payer may have changed.
 *   expiry ends the obligation **and** its relationship      — a row that ends while the
 *                                                              relationship stays `active` is a
 *                                                              session nobody can finish.
 *   one obligation's failure does not stop the scan          — a provider outage on one
 *                                                              relationship must not strand every
 *                                                              other relationship's expiry.
 */
import { describe, expect, it, vi } from "vitest";
import type {
  OpenPaymentRow,
  PaymentSql,
  RelationshipPaymentRow,
} from "@/lib/db/relationship-payment";
import { runPaymentJobs } from "@/lib/member/payment-job-run";
import { chargeDueAtOf, paymentDeadlineOf } from "@/lib/flow/payment";

const SEALED = new Date("2026-11-01T12:00:00.000Z");
const day = (n: number) => new Date(SEALED.getTime() + n * 86_400_000);
const REL = "rel_1";

interface Written {
  readonly text: string;
  readonly values: readonly unknown[] | undefined;
}

/**
 * A `PaymentSql` that records every statement and answers the three `RETURNING`/`SELECT` shapes the
 * module actually branches on. `relationshipStatus` is the row the expiry path reads first.
 */
function fakeSql(options: { relationshipStatus?: string } = {}): {
  readonly sql: PaymentSql;
  readonly writes: Written[];
  readonly touched: (fragment: string) => number;
} {
  const writes: Written[] = [];
  const sql: PaymentSql = {
    async query<R>(text: string, values?: readonly unknown[]) {
      writes.push({ text, values });
      if (text.includes("SELECT status FROM relationship")) {
        return {
          rows: (options.relationshipStatus === undefined
            ? []
            : [{ status: options.relationshipStatus }]) as unknown as readonly R[],
        };
      }
      // Every other statement in this module is an `UPDATE … RETURNING relationship_id`, and the
      // row it updates exists in these tests: one row back is "the write landed".
      if (text.includes("RETURNING relationship_id")) {
        return { rows: [{ relationship_id: REL }] as unknown as readonly R[] };
      }
      return { rows: [] as unknown as readonly R[] };
    },
  };
  const touched = (fragment: string) =>
    writes.filter((write) => write.text.includes(fragment)).length;
  return { sql, writes, touched };
}

function withMethod(overrides: Partial<RelationshipPaymentRow> = {}): OpenPaymentRow {
  const capturedAt = SEALED;
  const row: RelationshipPaymentRow = {
    relationship_id: REL,
    payer_user_id: "user_initiator",
    provider: "mock",
    provider_customer_id: "cus_1",
    provider_payment_method_id: "pm_1",
    method_captured_at: capturedAt,
    charge_due_at: chargeDueAtOf(capturedAt),
    charged_at: null,
    charge_amount_cents: 1900,
    charge_attempts: 0,
    last_attempt_at: null,
    first_failed_at: null,
    expired_at: null,
    expire_reason: null,
    reminder_day3_at: null,
    reminder_day10_at: null,
    created_at: SEALED,
    updated_at: SEALED,
    ...overrides,
  };
  return {
    sealedAt: SEALED,
    row,
    // Derived from the row rather than written twice: a test that moves a row field must move the
    // fact the decision reads, or it proves nothing about production.
    facts: {
      methodCapturedAt: row.method_captured_at,
      chargedAt: row.charged_at,
      expiredAt: row.expired_at,
      expireReason: row.expire_reason,
      chargeAttempts: row.charge_attempts,
      firstFailedAt: row.first_failed_at,
      sealedAt: SEALED,
      reminderDay3At: row.reminder_day3_at,
      reminderDay10At: row.reminder_day10_at,
    },
  };
}

describe("reminders are not stamped without a delivery", () => {
  it("reports the nag as pending-delivery and writes nothing", async () => {
    const { sql, touched } = fakeSql();
    const run = await runPaymentJobs({ now: day(3), sql, obligations: [withMethod()] });

    expect(run.results[0]?.jobs[0]).toEqual({
      key: `${REL}:remind:3`,
      outcome: { kind: "remind", status: "pending-delivery", day: 3 },
    });
    // The one claim: no `reminder_day3_at` write, because no message went out.
    expect(touched("reminder_day3_at")).toBe(0);
    expect(sql).toBeDefined();
  });

  it("sends and then stamps when a notifier is supplied", async () => {
    const { sql, touched } = fakeSql();
    const notify = vi.fn(async () => {});
    const run = await runPaymentJobs({
      now: day(3),
      sql,
      obligations: [withMethod()],
      notify,
    });

    expect(notify).toHaveBeenCalledWith({ kind: "remind", relationshipId: REL, day: 3 });
    expect(touched("reminder_day3_at")).toBe(1);
    expect(run.results[0]?.jobs[0]?.outcome).toEqual({ kind: "remind", status: "sent", day: 3 });
  });

  it("owes no nag on a quiet day", async () => {
    const { sql, writes } = fakeSql();
    const run = await runPaymentJobs({ now: day(2), sql, obligations: [withMethod()] });
    expect(run.results).toEqual([]);
    expect(writes).toEqual([]);
  });
});

describe("a retry charges the amount the first attempt recorded", () => {
  const failed = () =>
    withMethod({ first_failed_at: day(7), charge_attempts: 1, last_attempt_at: day(7) });

  it("charges the stored cents, and marks the obligation charged", async () => {
    const { sql, touched } = fakeSql();
    const charge = vi.fn(async () => ({ ok: true as const, chargeId: "ch_retry" }));

    const run = await runPaymentJobs({
      now: day(8),
      sql,
      obligations: [failed()],
      charge: charge as never,
    });

    expect(charge).toHaveBeenCalledTimes(1);
    expect(charge).toHaveBeenCalledWith(
      expect.objectContaining({
        relationshipId: REL,
        amountCents: 1900,
        customerId: "cus_1",
        paymentMethodId: "pm_1",
        idempotencyKey: `relationship-${REL}`,
      }),
    );
    expect(touched("SET charged_at")).toBe(1);
    expect(touched("SET status = 'complete'")).toBe(1);
    expect(run.results[0]?.jobs.map((job) => job.outcome.kind)).toContain("retry-charge");
  });

  it("records a second decline and leaves the obligation open", async () => {
    const { sql, touched } = fakeSql();
    const charge = vi.fn(async () => ({ ok: false as const, message: "card_declined" }));

    await runPaymentJobs({ now: day(8), sql, obligations: [failed()], charge: charge as never });

    expect(touched("charge_attempts = charge_attempts + 1")).toBe(1);
    expect(touched("SET charged_at")).toBe(0);
    expect(touched("SET status = 'complete'")).toBe(0);
  });

  it("does not attempt a charge with no method or no amount", async () => {
    // A row in this shape cannot be charged. Counting an attempt would shorten the ladder, so the
    // job does nothing and the expiry window ends the obligation instead.
    const { sql } = fakeSql();
    const charge = vi.fn(async () => ({ ok: true as const, chargeId: "ch_x" }));

    const run = await runPaymentJobs({
      now: day(8),
      sql,
      charge: charge as never,
      obligations: [
        withMethod({
          first_failed_at: day(7),
          charge_attempts: 1,
          charge_amount_cents: null,
        }),
      ],
    });

    expect(charge).not.toHaveBeenCalled();
    // The nag is still owed — day 3 arrived and nobody has been told — but no charge is attempted.
    expect(run.results[0]?.jobs.map((job) => job.outcome.kind)).toEqual(["remind"]);
  });
});

describe("expiry ends the obligation and the relationship", () => {
  it("expires an unpaid seal at day 14 and closes an active relationship", async () => {
    const { sql, touched, writes } = fakeSql({ relationshipStatus: "active" });

    const run = await runPaymentJobs({ now: day(14), sql, obligations: [withMethod()] });

    const expiredAt = paymentDeadlineOf(SEALED)?.toISOString();
    expect(touched("SET expired_at")).toBe(1);
    expect(touched("SET status = 'expired'")).toBe(1);
    // `payment-failed` is the merged CHECK's word for "the money did not arrive"; `unpaid` is this
    // card's own reason on the obligation row.
    const relationship = writes.find((write) => write.text.includes("SET status = 'expired'"));
    expect(relationship?.values).toContain("payment-failed");
    expect(expiredAt).toBe("2026-11-15T12:00:00.000Z");
    expect(run.results[0]?.jobs[0]?.outcome).toEqual({
      kind: "expire",
      status: "expired",
      reason: "unpaid",
    });
  });

  it("does not close a relationship that was completed while the obligation waited", async () => {
    // The race the guard exists for: the payer completed at 11:59, the job ran at 12:00.
    const { sql, touched } = fakeSql({ relationshipStatus: "complete" });
    await runPaymentJobs({ now: day(14), sql, obligations: [withMethod()] });
    expect(touched("SET status = 'expired'")).toBe(0);
  });

  it("tells both parties through the notifier when one is supplied", async () => {
    const { sql } = fakeSql({ relationshipStatus: "active" });
    const notify = vi.fn(async () => {});
    await runPaymentJobs({ now: day(14), sql, obligations: [withMethod()], notify });
    expect(notify).toHaveBeenCalledWith({
      kind: "expired",
      relationshipId: REL,
      reason: "unpaid",
    });
  });
});

describe("the scan survives a broken obligation", () => {
  it("keeps going, and reports only what it did", async () => {
    const { sql } = fakeSql({ relationshipStatus: "active" });
    const charge = vi.fn(async () => {
      throw new Error("provider down");
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const run = await runPaymentJobs({
      now: day(8),
      sql,
      charge: charge as never,
      obligations: [
        withMethod({ first_failed_at: day(7), charge_attempts: 1 }),
        { ...withMethod(), row: { ...withMethod().row, relationship_id: "rel_2" } },
      ],
    });

    expect(run.scanned).toBe(2);
    expect(consoleError).toHaveBeenCalled();
    // The first relationship's throw is logged and dropped — its nag still counts — and the second
    // relationship is processed regardless.
    expect(run.results.map((result) => result.relationshipId)).toEqual(["rel_1", "rel_2"]);
    expect(run.results[0]?.jobs.map((job) => job.outcome.kind)).toEqual(["remind"]);
    expect(run.results[1]?.jobs.map((job) => job.outcome.kind)).toEqual(["remind"]);
    consoleError.mockRestore();
  });
});
