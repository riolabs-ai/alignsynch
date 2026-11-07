/**
 * The door's stored half, against **real Postgres** (#t_e9212bf9).
 *
 * The unit tests prove the view model; `tests/payment-door.test.ts` proves the vocabulary. What
 * neither can prove is the sentence this card is judged on: "returns, and the relationship reads its
 * 7-day trial date". That is a fact about two columns — `method_captured_at` and `charge_due_at` —
 * and about the read composing them the way the page does.
 *
 * So this file takes the branch's own schema, writes the capture through the engine's
 * `recordMethodCaptured()`, and then reads the door back through `readPaymentForSession()` →
 * `paymentFactsOf()` → `paymentDoorOf()`, the same three functions `readFlowScreen()` and
 * `readRelationshipById()` compose. No provider is called and no money moves: the seam is the write,
 * which is the half a fake cannot check.
 *
 * **Skipped unless `DATABASE_URL` is set**, exactly like `tests/payment-jobs-live.test.ts`: the gate
 * has no connection string by design, so this costs the gate nothing and runs when someone points it
 * at a branch.
 *
 *     DATABASE_URL=<branch url> npx vitest run tests/payment-door-live.test.ts
 */
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  paymentFactsOf,
  readPaymentForSession,
  recordMethodCaptured,
} from "@/lib/db/relationship-payment";
import { paymentDoorOf, type PaymentDoor } from "@/lib/member/payment-door";
import { METHOD_TRIAL_DAYS } from "@/lib/flow/payment";

/**
 * `process.env` is shared with every other file in the worker, and `tests/db-client.test.ts` /
 * `tests/db-client-tls.test.ts` plant **placeholder** endpoints in it (`…@example.invalid`,
 * `…@ep-example-pooler.…`) for their own parsing cases. So "is `DATABASE_URL` set" is not the
 * question this file asks — a placeholder leaked from a sibling's last case made the guard read
 * green and the run fail five times on `DATABASE_URL is not set` (measured in the gate). The
 * question is "is it an endpoint a probe may write to", and a placeholder is a skip.
 */
const PLACEHOLDER_ENDPOINT = /example[.-]/i;
const declaredUrl = process.env.DATABASE_URL?.trim() ?? "";
const databaseUrl = PLACEHOLDER_ENDPOINT.test(declaredUrl) ? "" : declaredUrl;
const live = databaseUrl === "" ? describe.skip : describe;

const TAG = `probe-door-${Date.now().toString(36)}`;
const DAY = 86_400_000;
/** One instant for every fixture, so the trial window is arithmetic a reader can check by hand. */
const SEALED = new Date("2026-03-01T12:00:00.000Z");
const CAPTURED = new Date("2026-03-04T09:30:00.000Z");
const day = (n: number) => new Date(SEALED.getTime() + n * DAY);

const pool = new Pool({ connectionString: databaseUrl, max: 2 });

/** A sealed relationship with an obligation and no method on file — the state the door opens from. */
async function fixture(
  suffix: string,
): Promise<{ relationshipId: string; sessionId: string; payer: string }> {
  const relationshipId = `${TAG}-${suffix}`;
  const templateId = `${relationshipId}-template`;
  const versionId = `${relationshipId}-version`;
  const sessionId = `${relationshipId}-session`;
  const payer = `${relationshipId}-payer`;

  await pool.query(
    `INSERT INTO record (id, slug, record_type, status, date, title, summary, author_user_id, owner_user_id, visibility)
     VALUES ($1, $1, 'assessment', 'published', now(), 'Door probe', 'probe', NULL, NULL, 'private')`,
    [templateId],
  );
  await pool.query(
    `INSERT INTO template_version (id, template_record_id, version, payload, published_at, published_by)
     VALUES ($1, $2, 1, '{}'::jsonb, now(), NULL)`,
    [versionId, templateId],
  );
  await pool.query(
    `INSERT INTO relationship
       (id, template_id, template_version_id, initiator_user_id, status, created_at, published_at)
     VALUES ($1, $2, $3, $4, 'active', $5, $6)`,
    [relationshipId, templateId, versionId, payer, day(-30), day(-29)],
  );
  await pool.query(
    `INSERT INTO record (id, slug, record_type, status, date, title, summary, author_user_id, owner_user_id, visibility)
     VALUES ($1, $1, 'assessment', 'published', now(), 'Door probe session', 'probe', NULL, NULL, 'private')`,
    [sessionId],
  );
  await pool.query(
    `INSERT INTO session (record_id, template_record_id, relationship_id, name, mode, alignment_setting, round)
     VALUES ($1, $2, $3, 'Door probe', 'basic', 'soft', 1)`,
    [sessionId, templateId, relationshipId],
  );
  // Sealed: the counterparty accepts a day after the initiator, so `max(accepted_at)` is distinguishable.
  await pool.query(
    `INSERT INTO party (session_record_id, role, name, user_id, accepted_at, submitted_at)
     VALUES ($1, 'initiator', 'Init', $2, $3, $3),
            ($1, 'counterparty', 'Counter', NULL, $4, $4)`,
    [sessionId, payer, day(-1), SEALED],
  );
  // The obligation with no method: `provider_customer_id` and `charge_due_at` are both null.
  await pool.query(
    `INSERT INTO relationship_payment (relationship_id, payer_user_id, provider, charge_attempts)
     VALUES ($1, $2, 'mock', 0)`,
    [relationshipId, payer],
  );
  return { relationshipId, sessionId, payer };
}

/** The door as the page composes it, from the row alone. */
async function doorOf(sessionId: string, now: Date): Promise<PaymentDoor | undefined> {
  const payment = await readPaymentForSession(sessionId);
  if (payment === undefined) return undefined;
  const facts = paymentFactsOf(payment);
  return paymentDoorOf({
    facts,
    sealed: payment.sealedAt !== null,
    amountCents: payment.row?.charge_amount_cents ?? 895,
    now,
  });
}

afterAll(async () => {
  if (!live.name || databaseUrl === "") return;
  await pool.query(`DELETE FROM relationship_payment WHERE relationship_id LIKE $1`, [`${TAG}%`]);
  await pool.query(`DELETE FROM opinion WHERE session_record_id LIKE $1`, [`${TAG}%`]);
  await pool.query(`DELETE FROM party WHERE session_record_id LIKE $1`, [`${TAG}%`]);
  await pool.query(`DELETE FROM session WHERE relationship_id LIKE $1`, [`${TAG}%`]);
  await pool.query(`DELETE FROM relationship WHERE id LIKE $1`, [`${TAG}%`]);
  await pool.query(`DELETE FROM template_version WHERE template_record_id LIKE $1`, [`${TAG}%`]);
  await pool.query(`DELETE FROM record WHERE id LIKE $1`, [`${TAG}%`]);
  await pool.end();
  // Put the environment back as this file found it (see `beforeAll`): the next live suite in this
  // worker must decide for itself whether it has an endpoint.
  delete process.env.DATABASE_URL;
});

live("the capture writes the trial date, and the read states it", () => {
  let relationshipId: string;
  let sessionId: string;

  beforeAll(async () => {
    if (databaseUrl === "") return;
    // The app's client reads `process.env.DATABASE_URL` at call time, and a sibling file's
    // `afterEach` can delete it between this file's collection and its first case. Pin the
    // endpoint this run declared, so the probe and the code under test cannot disagree about
    // which database they are on. `afterAll` removes it again — leaving it set would make the
    // *next* live suite in this worker run against a database nobody declared.
    process.env.DATABASE_URL = databaseUrl;
    ({ relationshipId, sessionId } = await fixture("capture"));
  });

  it("is not completable before a method is on file", async () => {
    const door = await doorOf(sessionId, CAPTURED);
    expect(door?.phase).toBe("none");
    expect(door?.refusal).toBe("method-required");
    expect(door?.chargeDueAt).toBeNull();
  });

  it("stores charge_due_at = method_captured_at + the trial window, not a date derived at read time", async () => {
    const written = await pool.query<{ method_captured_at: Date; charge_due_at: Date }>(
      `SELECT method_captured_at, charge_due_at FROM relationship_payment WHERE relationship_id = $1`,
      [relationshipId],
    );
    expect(written.rows[0]?.method_captured_at ?? null).toBeNull();

    const ok = await pool.connect().then(async (client) => {
      try {
        return await recordMethodCaptured(client, {
          relationshipId,
          provider: "stripe",
          customerId: "cus_probe",
          paymentMethodId: "pm_probe",
          capturedAt: CAPTURED,
        });
      } finally {
        client.release();
      }
    });
    expect(ok).toBe(true);

    const row = await pool.query<{ method_captured_at: Date; charge_due_at: Date }>(
      `SELECT method_captured_at, charge_due_at FROM relationship_payment WHERE relationship_id = $1`,
      [relationshipId],
    );
    expect(row.rows[0]?.method_captured_at.toISOString()).toBe(CAPTURED.toISOString());
    // The stored instant is the arithmetic of the capture, written once: seven days later, to the ms.
    expect(row.rows[0]?.charge_due_at.toISOString()).toBe(
      new Date(CAPTURED.getTime() + METHOD_TRIAL_DAYS * DAY).toISOString(),
    );
  });

  it("reads that stored instant back through the door, and is now completable", async () => {
    const door = await doorOf(sessionId, CAPTURED);
    expect(door?.phase).toBe("method-on-file");
    expect(door?.chargeDueAt).toBe(
      new Date(CAPTURED.getTime() + METHOD_TRIAL_DAYS * DAY).toISOString(),
    );
    expect(door?.canComplete).toBe(true);
    expect(door?.refusal).toBeNull();
  });

  it("reads the same instant a month later — the date is stored, so no clock moves it", async () => {
    const door = await doorOf(sessionId, new Date(CAPTURED.getTime() + 30 * DAY));
    expect(door?.chargeDueAt).toBe(
      new Date(CAPTURED.getTime() + METHOD_TRIAL_DAYS * DAY).toISOString(),
    );
  });

  it("refuses a second capture, so a returned browser cannot move the trial date", async () => {
    const client = await pool.connect();
    try {
      const again = await recordMethodCaptured(client, {
        relationshipId,
        provider: "stripe",
        customerId: "cus_other",
        paymentMethodId: "pm_other",
        capturedAt: new Date(CAPTURED.getTime() + 3 * DAY),
      });
      expect(again).toBe(false);
    } finally {
      client.release();
    }
    const row = await pool.query<{ charge_due_at: Date }>(
      `SELECT charge_due_at FROM relationship_payment WHERE relationship_id = $1`,
      [relationshipId],
    );
    expect(row.rows[0]?.charge_due_at.toISOString()).toBe(
      new Date(CAPTURED.getTime() + METHOD_TRIAL_DAYS * DAY).toISOString(),
    );
  });
});
