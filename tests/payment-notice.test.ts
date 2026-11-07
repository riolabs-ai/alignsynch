/**
 * #638 — the reminder notice actually sends, and the stamp follows the send.
 *
 * `tests/payment-job-run.test.ts` pins what the *job* does with a notifier it is handed. This file
 * pins the notifier itself, and one property that only this pair can prove: **the message goes out
 * before `reminder_day3_at` is written**, and nothing is written when it does not go out.
 *
 * The six claims:
 *
 *   the recipient     the payer, and only the payer, for a reminder — the counterparty is told no
 *                     billing detail at any point (PRD R6).
 *   the amount        `charge_amount_cents` when an attempt recorded it, else the plan's fee; the
 *                     same number the job charges.
 *   the deadline      `sealed + 14 days`, printed as its calendar date; no clock is read here.
 *   undelivered       `unset` (no mailer), `failed` (provider refused), `no-address`, `no-instant`
 *                     and `no-obligation` are all **throws**, because a resolve means "delivered".
 *   both seats        an expiry is the one event both are told about, and the counterparty's body
 *                     carries no figure.
 *   the order         the transport call precedes the stamp write, and a refused send writes none.
 *
 * No database and no network: the row read is a literal, the transport is a stub that records what
 * it was handed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PaymentNoticeFacts } from "@/lib/db/payment-notice";
import type {
  OpenPaymentRow,
  PaymentSql,
  RelationshipPaymentRow,
} from "@/lib/db/relationship-payment";
import { chargeDueAtOf } from "@/lib/flow/payment";
import { runPaymentJobs } from "@/lib/member/payment-job-run";
import {
  PaymentNoticeUndelivered,
  paymentNotice,
  reminderAmountCents,
} from "@/lib/member/payment-notice";
import { relationshipFeeCents } from "@/lib/member/payment";

const SEALED = new Date("2026-11-01T12:00:00.000Z");
const day = (n: number) => new Date(SEALED.getTime() + n * 86_400_000);
const REL = "rel_1";
const PAYER = "avery@example.test";
const COUNTERPARTY = "rowan@example.test";

function facts(overrides: Partial<PaymentNoticeFacts> = {}): PaymentNoticeFacts {
  return {
    title: "Relationship Basics",
    payerEmail: PAYER,
    counterpartyEmail: COUNTERPARTY,
    payerName: "Avery",
    counterpartyName: "Rowan",
    chargeAmountCents: 1900,
    sealedAt: SEALED,
    expiredAt: null,
    ...overrides,
  };
}

interface Sent {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
}

/** A transport that records every message and answers with the status a test asks for. */
function transport(status = 200): { fetchImpl: typeof fetch; sent: Sent[] } {
  const sent: Sent[] = [];
  const fetchImpl = (async (_url: unknown, init?: { body?: unknown }) => {
    const body = JSON.parse(String(init?.body)) as {
      to: string[];
      subject: string;
      text: string;
    };
    sent.push({ to: body.to[0] ?? "", subject: body.subject, text: body.text });
    return { ok: status >= 200 && status < 300, status } as Response;
  }) as unknown as typeof fetch;
  return { fetchImpl, sent };
}

const read = (row: PaymentNoticeFacts | undefined) => async () => row;

beforeEach(() => {
  vi.stubEnv("RESEND_API_KEY", "re_test_key");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("a reminder goes to the payer, and only the payer", () => {
  it("sends one message with the amount and the deadline from the row", async () => {
    const { fetchImpl, sent } = transport();
    await paymentNotice({ read: read(facts()), fetchImpl })({
      kind: "remind",
      relationshipId: REL,
      day: 3,
    });

    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe(PAYER);
    expect(sent[0]?.subject).toBe("The fee for Relationship Basics is still unpaid");
    // The two facts a payer needs: what is owed, and when the window closes.
    expect(sent[0]?.text).toContain("$19.00");
    expect(sent[0]?.text).toContain("2026-11-15");
    expect(sent[0]?.text).toContain(`/dashboard/relationships/${REL}`);
    // The blind rule: the counterparty is never written to about a fee.
    expect(sent.map((message) => message.to)).not.toContain(COUNTERPARTY);
  });

  it("charges the plan's fee when the row recorded none, the same fallback the job uses", () => {
    expect(reminderAmountCents(facts({ chargeAmountCents: null }))).toBe(relationshipFeeCents());
    expect(reminderAmountCents(facts({ chargeAmountCents: 2500 }))).toBe(2500);
  });

  it("says it is the last reminder on day 10", async () => {
    const { fetchImpl, sent } = transport();
    await paymentNotice({ read: read(facts()), fetchImpl })({
      kind: "remind",
      relationshipId: REL,
      day: 10,
    });
    expect(sent[0]?.text).toContain("last reminder");
  });
});

describe("a notice that did not deliver throws, so no stamp can follow", () => {
  it("refuses when the deployment has no mailer", async () => {
    vi.unstubAllEnvs();
    const notify = paymentNotice({ read: read(facts()), fetchImpl: transport().fetchImpl });
    await expect(notify({ kind: "remind", relationshipId: REL, day: 3 })).rejects.toMatchObject({
      failure: "unset",
    });
  });

  it("refuses when the provider refuses the message", async () => {
    const notify = paymentNotice({ read: read(facts()), fetchImpl: transport(500).fetchImpl });
    await expect(notify({ kind: "remind", relationshipId: REL, day: 3 })).rejects.toBeInstanceOf(
      PaymentNoticeUndelivered,
    );
  });

  it("refuses when neither seat holds an address", async () => {
    const notify = paymentNotice({
      read: read(facts({ payerEmail: null, counterpartyEmail: null })),
      fetchImpl: transport().fetchImpl,
    });
    await expect(notify({ kind: "remind", relationshipId: REL, day: 3 })).rejects.toMatchObject({
      failure: "no-address",
    });
  });

  it("refuses when the row it would build the deadline from has no seal", async () => {
    const notify = paymentNotice({
      read: read(facts({ sealedAt: null })),
      fetchImpl: transport().fetchImpl,
    });
    await expect(notify({ kind: "remind", relationshipId: REL, day: 3 })).rejects.toMatchObject({
      failure: "no-instant",
    });
  });

  it("refuses a relationship with no obligation row", async () => {
    const notify = paymentNotice({ read: read(undefined), fetchImpl: transport().fetchImpl });
    await expect(notify({ kind: "remind", relationshipId: REL, day: 3 })).rejects.toMatchObject({
      failure: "no-obligation",
    });
  });
});

describe("an expiry tells both seats, and only one of them hears about money", () => {
  it("writes to both, with no figure in the counterparty's body", async () => {
    const { fetchImpl, sent } = transport();
    await paymentNotice({ read: read(facts({ expiredAt: day(14) })), fetchImpl })({
      kind: "expired",
      relationshipId: REL,
      reason: "unpaid",
    });

    expect(sent.map((message) => message.to)).toEqual([PAYER, COUNTERPARTY]);
    const counterparty = sent[1];
    expect(counterparty?.text).toContain("2026-11-15");
    // PRD R6: the counterparty's surface reads only that the relationship is waiting or ended.
    expect(counterparty?.text).not.toContain("$");
    expect(counterparty?.text).not.toContain("fee");
    // The payer's does say what happened to the fee.
    expect(sent[0]?.text).toContain("fee");
  });

  it("refuses an expiry with no stored instant rather than printing a guessed date", async () => {
    const notify = paymentNotice({ read: read(facts()), fetchImpl: transport().fetchImpl });
    await expect(
      notify({ kind: "expired", relationshipId: REL, reason: "unpaid" }),
    ).rejects.toMatchObject({ failure: "no-instant" });
  });
});

describe("the job stamps only after the send", () => {
  /** A `PaymentSql` that records statements; the stamp is the only `UPDATE` this test expects. */
  function stampingSql(log: string[]): PaymentSql {
    return {
      async query<R>(text: string) {
        log.push(text.includes("reminder_day3_at") ? "stamp" : "query");
        return { rows: [{ relationship_id: REL }] as unknown as readonly R[] };
      },
    };
  }

  function obligation(): OpenPaymentRow {
    const row: RelationshipPaymentRow = {
      relationship_id: REL,
      payer_user_id: "user_initiator",
      provider: "mock",
      provider_customer_id: null,
      provider_payment_method_id: null,
      method_captured_at: null,
      charge_due_at: null,
      charged_at: null,
      charge_amount_cents: null,
      charge_attempts: 0,
      last_attempt_at: null,
      first_failed_at: null,
      expired_at: null,
      expire_reason: null,
      reminder_day3_at: null,
      reminder_day10_at: null,
      created_at: SEALED,
      updated_at: SEALED,
    };
    return {
      row,
      sealedAt: SEALED,
      facts: {
        methodCapturedAt: null,
        chargedAt: null,
        expiredAt: null,
        expireReason: null,
        chargeAttempts: 0,
        firstFailedAt: null,
        sealedAt: SEALED,
        reminderDay3At: null,
        reminderDay10At: null,
      },
    };
  }

  it("sends first, then stamps — in that order", async () => {
    const log: string[] = [];
    const { fetchImpl } = transport();
    const notify = paymentNotice({
      read: async () => {
        log.push("read");
        return facts({ chargeAmountCents: null });
      },
      fetchImpl: (async (url: unknown, init?: { body?: unknown }) => {
        log.push("send");
        return (fetchImpl as unknown as (u: unknown, i?: unknown) => Promise<Response>)(url, init);
      }) as unknown as typeof fetch,
    });

    const run = await runPaymentJobs({
      now: day(3),
      sql: stampingSql(log),
      obligations: [obligation()],
      notify,
    });

    expect(log.filter((entry) => entry !== "query")).toEqual(["read", "send", "stamp"]);
    expect(run.results[0]?.jobs[0]?.outcome).toEqual({ kind: "remind", status: "sent", day: 3 });
  });

  it("writes no stamp when the send is refused", async () => {
    const log: string[] = [];
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const notify = paymentNotice({ read: read(facts()), fetchImpl: transport(500).fetchImpl });

    const run = await runPaymentJobs({
      now: day(3),
      sql: stampingSql(log),
      obligations: [obligation()],
      notify,
    });

    expect(log).not.toContain("stamp");
    expect(run.results[0]?.jobs[0]?.outcome).toEqual({
      kind: "remind",
      status: "pending-delivery",
      day: 3,
    });
    warn.mockRestore();
  });
});

describe("the charge the first attempt recorded is the one quoted", () => {
  it("is the amount the job's own charge path would take", () => {
    // The reminder and the charge read the same row; a row captured before the publish step has no
    // recorded amount yet, which is why the fallback exists and is the same function.
    const row: RelationshipPaymentRow = {
      relationship_id: REL,
      payer_user_id: "u",
      provider: "mock",
      provider_customer_id: "cus_1",
      provider_payment_method_id: "pm_1",
      method_captured_at: SEALED,
      charge_due_at: chargeDueAtOf(SEALED),
      charged_at: null,
      charge_amount_cents: null,
      charge_attempts: 0,
      last_attempt_at: null,
      first_failed_at: null,
      expired_at: null,
      expire_reason: null,
      reminder_day3_at: null,
      reminder_day10_at: null,
      created_at: SEALED,
      updated_at: SEALED,
    };
    expect(reminderAmountCents(facts({ chargeAmountCents: row.charge_amount_cents }))).toBe(
      relationshipFeeCents(),
    );
  });
});
