/**
 * The door's server half: the action refuses on its own, with no UI anywhere in the path
 * (#t_e9212bf9).
 *
 * The card's third requirement is "enforce server-side only — the UI enables a button; the action
 * still refuses independently. A test must POST the action without a method and assert the refusal,
 * with no UI in the path." So this file calls `completeRelationshipAction` — the exported server
 * action, the exact function the browser's POST reaches — against a stubbed `queryRows`, with no
 * component rendered, no props, and no client control to disable.
 *
 * Two claims, and they are different halves of the same sentence:
 *
 *   without a method   the payer's completion does not charge anything. `completeRelationship()`
 *                      opens a **hosted capture** and throws `MemberPaymentRequired`, and the
 *                      action answers `{ ok: false, code: "payment-method-required", url }` — the
 *                      code **and** the place the browser must go. Nothing was written.
 *   with a method      the same read charges the fee outside the transaction and completes the
 *                      relationship inside one, so the Gap opens. Driven at the library with a
 *                      runner that records the statements, because `act()` would otherwise want a
 *                      pool the gate does not have.
 *
 * The stub is the shape `tests/relationship-detail.test.ts` uses to hold the gate database-free, and
 * the charge is injected through `vi.mock` exactly as `lib/billing`'s composition root intends: no
 * surface names an adapter, and no test needs a key.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ActSql, ActTransactionRunner } from "@/lib/admin/act";

const { queryRows, currentUser, startMethodCapture, chargeOnFile } = vi.hoisted(() => ({
  queryRows: vi.fn(),
  currentUser: vi.fn(),
  startMethodCapture: vi.fn(),
  chargeOnFile: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  queryRows,
  DatabaseUnavailableError: class DatabaseUnavailableError extends Error {},
}));
vi.mock("@/lib/auth/session", () => ({ currentUser }));
vi.mock("@/lib/billing", () => ({
  billingProvider: () => "mock",
  startMethodCapture,
  chargeOnFile,
  resolveMethodCapture: vi.fn(),
}));

import { completeRelationshipAction } from "@/app/(mainlayout)/dashboard/relationships/actions";
import { completeRelationship } from "@/lib/member/payment";

const ACTOR = "user_avery";
const REL = "relationship-member-abc123";
const SESSION = "member-session-abc123";
const SEALED_AT = new Date("2026-11-01T12:00:00.000Z");
const NOW = new Date("2026-11-10T12:00:00.000Z");

/** The payment row, with whatever the case needs — `null` method is the state this file is about. */
function paymentRow(over: { method?: Date | null; chargedAt?: Date | null } = {}) {
  const method = over.method ?? null;
  return {
    relationship_id: REL,
    payer_user_id: ACTOR,
    provider: "mock",
    provider_customer_id: method === null ? null : "cus_test",
    provider_payment_method_id: method === null ? null : "pm_test",
    method_captured_at: method,
    charge_due_at: method === null ? null : new Date(method.getTime() + 7 * 86_400_000),
    charged_at: over.chargedAt ?? null,
    charge_amount_cents: null,
    charge_attempts: 0,
    last_attempt_at: null,
    first_failed_at: null,
    expired_at: null,
    expire_reason: null,
    reminder_day3_at: null,
    reminder_day10_at: null,
    created_at: SEALED_AT,
    updated_at: SEALED_AT,
    sealed_at: SEALED_AT,
    has_payment: true,
  };
}

/** Answer each statement by what it is about, not by its order. */
function stubDatabase(payment: ReturnType<typeof paymentRow>): void {
  queryRows.mockImplementation(async (text: string) => {
    if (text.includes("AS session_record_id")) {
      return [
        {
          id: REL,
          status: "active",
          initiator_user_id: ACTOR,
          title: "Son Basics",
          session_record_id: SESSION,
        },
      ];
    }
    if (text.includes("has_payment")) return [payment];
    if (text.includes("aspect_count")) {
      return [
        {
          aspect_count: 6,
          initiator_answered: 6,
          counterparty_answered: 6,
          initiator_accepted: true,
          counterparty_accepted: true,
        },
      ];
    }
    if (text.includes("SELECT role FROM user_profile")) return [{ role: "member" }];
    if (text.includes("RETURNING") || text.includes("UPDATE ")) return [{ relationship_id: REL }];
    return [];
  });
}

/** The transaction `act()` opens, with every statement recorded and the two shapes it branches on. */
function fakeRunner(): { readonly runner: ActTransactionRunner; readonly writes: string[] } {
  const writes: string[] = [];
  const sql: ActSql = {
    async query<R>(text: string) {
      writes.push(text);
      if (text.includes("SELECT role FROM user_profile")) {
        return { rows: [{ role: "member" }] as unknown as readonly R[] };
      }
      if (text.includes("FOR UPDATE OF rel")) {
        return {
          rows: [
            {
              id: REL,
              status: "active",
              initiator_user_id: ACTOR,
              charged_at: null,
              expired_at: null,
              method_captured_at: NOW,
            },
          ] as unknown as readonly R[],
        };
      }
      if (text.includes("UPDATE relationship")) {
        return {
          rows: [{ status: "complete", completed_at: NOW }] as unknown as readonly R[],
        };
      }
      if (text.includes("INSERT INTO admin_action")) {
        return { rows: [{ id: "act_completed" }] as unknown as readonly R[] };
      }
      return { rows: [] };
    },
  };
  return {
    writes,
    runner: {
      async transaction<T>(work: (client: ActSql) => Promise<T>): Promise<T> {
        return work(sql);
      },
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser.mockResolvedValue({ userId: ACTOR, name: "Avery", email: "avery@example.com" });
});

describe("the completion action refuses without a method", () => {
  it("answers payment-method-required and the url to capture at, charging nothing", async () => {
    stubDatabase(paymentRow());
    // A hosted provider: the capture does not complete inline, so the browser is sent to it.
    startMethodCapture.mockResolvedValue({
      completed: false,
      url: "https://provider.test/capture/cs_123",
      provider: "stripe",
      sessionId: "cs_123",
    });

    const answer = await completeRelationshipAction({
      relationshipId: REL,
      reason: "publish the assessment and take the relationship fee",
    });

    expect(answer.ok).toBe(false);
    if (answer.ok) return;
    expect(answer.code).toBe("payment-method-required");
    expect(answer.url).toBe("https://provider.test/capture/cs_123");
    // No charge was attempted, and no fee is claimed.
    expect(chargeOnFile).not.toHaveBeenCalled();
  });

  it("refuses even when the browser posts the action directly — there is no UI in this path", async () => {
    // The only thing that would have made the click possible is the component, and no component is
    // rendered here: the action reads the row, finds no method, and answers.
    stubDatabase(paymentRow());
    startMethodCapture.mockResolvedValue({
      completed: false,
      url: "https://provider.test/capture/cs_123",
      provider: "stripe",
      sessionId: "cs_123",
    });
    const answer = await completeRelationshipAction({ relationshipId: REL });
    expect(answer.ok).toBe(false);
    expect(chargeOnFile).not.toHaveBeenCalled();
  });

  it("refuses a completion before both sheets are sealed, and says which word", async () => {
    stubDatabase(paymentRow({ method: NOW }));
    queryRows.mockImplementation(async (text: string) => {
      if (text.includes("AS session_record_id")) {
        return [
          {
            id: REL,
            status: "active",
            initiator_user_id: ACTOR,
            title: "Son Basics",
            session_record_id: SESSION,
          },
        ];
      }
      if (text.includes("has_payment")) return [paymentRow({ method: NOW })];
      if (text.includes("aspect_count")) {
        return [
          {
            aspect_count: 6,
            initiator_answered: 6,
            counterparty_answered: 6,
            initiator_accepted: true,
            // The counterparty has not accepted: not sealed.
            counterparty_accepted: false,
          },
        ];
      }
      return [];
    });
    const answer = await completeRelationshipAction({ relationshipId: REL });
    expect(answer.ok).toBe(false);
    if (answer.ok) return;
    expect(answer.code).toBe("not-ready-to-complete");
    expect(chargeOnFile).not.toHaveBeenCalled();
  });

  it("is signed out without a session, before any read", async () => {
    currentUser.mockResolvedValue(null);
    const answer = await completeRelationshipAction({ relationshipId: REL });
    expect(answer).toEqual({ ok: false, code: "signed-out" });
    expect(queryRows).not.toHaveBeenCalled();
  });
});

describe("the completion charges and opens the Gap with a method on file", () => {
  it("takes the fee outside the transaction and completes inside one", async () => {
    stubDatabase(paymentRow({ method: NOW }));
    chargeOnFile.mockResolvedValue({ ok: true, chargeId: "ch_1", amountCents: 895 });
    const { runner, writes } = fakeRunner();

    const result = await completeRelationship(
      {
        actorUserId: ACTOR,
        relationshipId: REL,
        reason: "publish the assessment and take the relationship fee",
        returnUrl: "https://alignsynch.test/api/billing/payment/return",
        now: NOW,
      },
      runner,
    );

    expect(chargeOnFile).toHaveBeenCalledTimes(1);
    expect(chargeOnFile.mock.calls[0]?.[0]).toMatchObject({
      relationshipId: REL,
      amountCents: 895,
      idempotencyKey: `relationship-${REL}`,
    });
    expect(result.after.status).toBe("complete");
    // The completion and the audit row are both inside the transaction that `act()` opened.
    expect(writes.some((text) => text.includes("UPDATE relationship"))).toBe(true);
    expect(writes.some((text) => text.includes("INSERT INTO admin_action"))).toBe(true);
  });
});
