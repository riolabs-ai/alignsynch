/**
 * `relationship_payment` — the SQL (#619).
 *
 * One row per relationship, written when the relationship is created, and this module is the only
 * place that reads or writes it. The decisions are not here: `lib/flow/payment.ts` owns what a set
 * of facts *means*, and `lib/flow/payment-jobs.ts` owns what is *due*. This file moves values.
 *
 * **`sealed_at` is a read, never a column.** The instant both sheets were sealed is
 * `max(party.accepted_at)` over the relationship's sessions — the last acceptance — and every
 * window in `lib/flow/payment.ts` is arithmetic from it. It is selected in the same statement as
 * the row so the two cannot be read a second apart and disagree about which day the clock started.
 *
 * **A relationship with no row answers `null`, and `null` is not "unpaid".** Rows written before
 * this card do not exist; `lib/flow/payment.ts::paymentArmedOf()` turns the absence into
 * `undefined` ("not measured"), which `instanceStatusOf()` does not treat as a gate. Only a row
 * that exists and has no method captured is a `false`.
 *
 * **No card data.** `provider_customer_id` and `provider_payment_method_id` are the two opaque ids
 * a server-side charge needs; a number, a brand or an expiry in this table would be a liability
 * this product never asked for (`lib/billing/types.ts` says the same for subscriptions).
 */
import type { QueryResultRow } from "pg";
import { queryRows } from "@/lib/db/client";
import {
  type PaymentExpiryReason,
  type PaymentFacts,
  type PaymentReminderDay,
  chargeDueAtOf,
} from "@/lib/flow/payment";

/**
 * The query surface these writes need — the same shape `lib/admin/act.ts::ActSql` and
 * `lib/relationship/enforcement.ts::Sql` declare, so a transaction's client and the pool are both
 * accepted without a cast at every call site.
 */
export interface PaymentSql {
  query<R = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ readonly rows: readonly R[] }>;
}

/** The row, as Postgres returns it. `timestamptz` arrives as a `Date`; nullable columns are nullable. */
export interface RelationshipPaymentRow {
  readonly relationship_id: string;
  readonly payer_user_id: string;
  readonly provider: string;
  readonly provider_customer_id: string | null;
  readonly provider_payment_method_id: string | null;
  readonly method_captured_at: Date | null;
  readonly charge_due_at: Date | null;
  readonly charged_at: Date | null;
  readonly charge_amount_cents: number | null;
  readonly charge_attempts: number;
  readonly last_attempt_at: Date | null;
  readonly first_failed_at: Date | null;
  readonly expired_at: Date | null;
  readonly expire_reason: string | null;
  readonly reminder_day3_at: Date | null;
  readonly reminder_day10_at: Date | null;
  readonly created_at: Date;
  readonly updated_at: Date;
}

/** A row plus the instant its sheets sealed — what `lib/flow/payment.ts` needs, in one value. */
export interface PaymentSnapshot {
  /** `null` when the relationship has no obligation row (created before this card). */
  readonly row: RelationshipPaymentRow | null;
  /** `max(party.accepted_at)`; `null` while either seat has not accepted. */
  readonly sealedAt: Date | null;
  readonly relationshipId: string;
}

/** The columns every read selects. One list, so a new column cannot be read by one path only. */
const ROW_COLUMNS = [
  "relationship_id",
  "payer_user_id",
  "provider",
  "provider_customer_id",
  "provider_payment_method_id",
  "method_captured_at",
  "charge_due_at",
  "charged_at",
  "charge_amount_cents",
  "charge_attempts",
  "last_attempt_at",
  "first_failed_at",
  "expired_at",
  "expire_reason",
  "reminder_day3_at",
  "reminder_day10_at",
  "created_at",
  "updated_at",
] as const;

const COLUMN_LIST = ROW_COLUMNS.join(", ");
const PREFIXED_COLUMN_LIST = ROW_COLUMNS.map((column) => `rp.${column}`).join(", ");
/** The same list without the id, for the reads that select the relationship id from somewhere else. */
const PREFIXED_REST = ROW_COLUMNS.filter((column) => column !== "relationship_id")
  .map((column) => `rp.${column}`)
  .join(", ");

/**
 * The instant the relationship's sheets sealed — the **last** acceptance, which is when the
 * fourteen-day window starts. Correlated on the relationship, so a relationship with two rounds
 * measures the window from the round that is actually being completed.
 */
const SEALED_AT_SQL = `(SELECT max(p.accepted_at)
                          FROM party p
                          JOIN session s2 ON s2.record_id = p.session_record_id
                         WHERE s2.relationship_id = rp.relationship_id)`;

/** The payment row for one relationship, or `null`. */
export async function readRelationshipPayment(
  relationshipId: string,
): Promise<RelationshipPaymentRow | null> {
  const rows = await queryRows<RelationshipPaymentRow>(
    `SELECT ${COLUMN_LIST} FROM relationship_payment WHERE relationship_id = $1`,
    [relationshipId],
  );
  return rows[0] ?? null;
}

/**
 * The obligation behind a **session**, which is what every party-facing read holds.
 *
 * One statement, and `COALESCE` on the relationship id so a session with no obligation row still
 * names its relationship: the LEFT JOIN's nulls are then `row: null`, which is the honest "not
 * measured", and not a session that appears to have no relationship. A session that does not exist
 * answers `undefined`, which a caller must treat as "no such instance".
 */
export async function readPaymentForSession(
  sessionRecordId: string,
): Promise<PaymentSnapshot | undefined> {
  const rows = await queryRows<
    RelationshipPaymentRow & { sealed_at: Date | null; has_payment: boolean }
  >(
    `SELECT COALESCE(rp.relationship_id, s.relationship_id) AS relationship_id,
            ${PREFIXED_REST},
            ${SEALED_AT_SQL} AS sealed_at,
            (rp.relationship_id IS NOT NULL) AS has_payment
       FROM session s
       LEFT JOIN relationship_payment rp ON rp.relationship_id = s.relationship_id
      WHERE s.record_id = $1`,
    [sessionRecordId],
  );
  const row = rows[0];
  if (row === undefined) return undefined;
  return {
    row: row.has_payment ? row : null,
    sealedAt: row.sealed_at,
    relationshipId: row.relationship_id,
  };
}

/** The facts `lib/flow/payment.ts` reads, from a snapshot. `null` is "no obligation row". */
export function paymentFactsOf(snapshot: PaymentSnapshot): PaymentFacts | null {
  if (snapshot.row === null) return null;
  return rowFacts(snapshot.row, snapshot.sealedAt);
}

/** The same projection for one row a caller already holds. */
export function rowFacts(row: RelationshipPaymentRow, sealedAt: Date | null): PaymentFacts {
  return {
    methodCapturedAt: row.method_captured_at,
    chargedAt: row.charged_at,
    chargeAttempts: row.charge_attempts,
    firstFailedAt: row.first_failed_at,
    expiredAt: row.expired_at,
    expireReason: row.expire_reason,
    sealedAt,
    reminderDay3At: row.reminder_day3_at,
    reminderDay10At: row.reminder_day10_at,
  };
}

/* ------------------------------------------------------------------ *
 * The writes
 * ------------------------------------------------------------------ */

/**
 * Open the obligation, at relationship creation (#619).
 *
 * `ON CONFLICT DO NOTHING` makes it idempotent: a retried create cannot rewrite the payer (the
 * owner's rule is that the **original** initiator always pays, and a later round opened by the
 * counterparty must not move it), and the row that exists is the one every charge reads.
 */
export async function openPaymentObligation(
  sql: PaymentSql,
  input: {
    readonly relationshipId: string;
    readonly payerUserId: string;
    readonly provider: string;
  },
): Promise<boolean> {
  const rows = await sql.query<{ relationship_id: string }>(
    `INSERT INTO relationship_payment (relationship_id, payer_user_id, provider)
     VALUES ($1, $2, $3)
     ON CONFLICT (relationship_id) DO NOTHING
     RETURNING relationship_id`,
    [input.relationshipId, input.payerUserId, input.provider],
  );
  return rows.rows.length > 0;
}

/**
 * Record a captured payment method and the seven-day delay it starts.
 *
 * `charge_due_at` is computed here rather than by the caller so the two instants in a row cannot be
 * written from different clocks, and the write refuses to overwrite a capture that already
 * happened (`method_captured_at IS NULL`): re-capturing a method must not restart the trial.
 */
export async function recordMethodCaptured(
  sql: PaymentSql,
  input: {
    readonly relationshipId: string;
    readonly provider: string;
    readonly customerId: string | null;
    readonly paymentMethodId: string | null;
    readonly capturedAt: Date;
  },
): Promise<boolean> {
  const due = chargeDueAtOf(input.capturedAt);
  const rows = await sql.query<{ relationship_id: string }>(
    `UPDATE relationship_payment
        SET provider = $2,
            provider_customer_id = $3,
            provider_payment_method_id = $4,
            method_captured_at = $5,
            charge_due_at = $6,
            updated_at = now()
      WHERE relationship_id = $1 AND method_captured_at IS NULL
      RETURNING relationship_id`,
    [
      input.relationshipId,
      input.provider,
      input.customerId,
      input.paymentMethodId,
      input.capturedAt.toISOString(),
      due === null ? null : due.toISOString(),
    ],
  );
  return rows.rows.length > 0;
}

/**
 * What a charge attempt did. Both arms carry the **amount**, because the retry ladder reuses the
 * fee the first attempt decided: a retry must not re-derive a price from a plan the payer may have
 * changed by then, and a row with no amount could not be charged by the job at all.
 */
export type ChargeResult =
  | { readonly ok: true; readonly amountCents: number; readonly chargeId?: string }
  | { readonly ok: false; readonly amountCents: number };

/**
 * Record one charge attempt.
 *
 * **The attempt counter and the outcome are written in one statement**, so a crash between them
 * cannot leave a failed attempt that the ladder does not see (which would retry forever) or a
 * success the charge history does not count. A success is write-once (`charged_at IS NULL`) —
 * that guard is what makes "one fee per relationship" a database fact rather than a caller's care.
 */
export async function recordChargeResult(
  sql: PaymentSql,
  input: { readonly relationshipId: string; readonly at: Date; readonly result: ChargeResult },
): Promise<boolean> {
  const at = input.at.toISOString();
  const rows = input.result.ok
    ? await sql.query<{ relationship_id: string }>(
        `UPDATE relationship_payment
            SET charged_at = $2,
                charge_amount_cents = $3,
                charge_attempts = charge_attempts + 1,
                last_attempt_at = $2,
                updated_at = now()
          WHERE relationship_id = $1 AND charged_at IS NULL
          RETURNING relationship_id`,
        [input.relationshipId, at, input.result.amountCents],
      )
    : await sql.query<{ relationship_id: string }>(
        `UPDATE relationship_payment
            SET charge_attempts = charge_attempts + 1,
                last_attempt_at = $2,
                first_failed_at = COALESCE(first_failed_at, $2),
                charge_amount_cents = COALESCE(charge_amount_cents, $3),
                updated_at = now()
          WHERE relationship_id = $1 AND charged_at IS NULL
          RETURNING relationship_id`,
        [input.relationshipId, at, input.result.amountCents],
      );
  return rows.rows.length > 0;
}

/** Expire the obligation (#619: `unpaid` at day 14, `charge-failed` when the ladder is spent). */
export async function markExpired(
  sql: PaymentSql,
  input: {
    readonly relationshipId: string;
    readonly at: Date;
    readonly reason: PaymentExpiryReason;
  },
): Promise<boolean> {
  const rows = await sql.query<{ relationship_id: string }>(
    `UPDATE relationship_payment
        SET expired_at = $2, expire_reason = $3, updated_at = now()
      WHERE relationship_id = $1 AND charged_at IS NULL AND expired_at IS NULL
      RETURNING relationship_id`,
    [input.relationshipId, input.at.toISOString(), input.reason],
  );
  return rows.rows.length > 0;
}

/** Stamp the nag that went out. Write-once per day, so a job that overlaps itself cannot double-send. */
export async function markReminderSent(
  sql: PaymentSql,
  input: { readonly relationshipId: string; readonly day: PaymentReminderDay; readonly at: Date },
): Promise<boolean> {
  const column = input.day === 3 ? "reminder_day3_at" : "reminder_day10_at";
  const rows = await sql.query<{ relationship_id: string }>(
    `UPDATE relationship_payment
        SET ${column} = $2, updated_at = now()
      WHERE relationship_id = $1 AND ${column} IS NULL
      RETURNING relationship_id`,
    [input.relationshipId, input.at.toISOString()],
  );
  return rows.rows.length > 0;
}

/* ------------------------------------------------------------------ *
 * The job's scan
 * ------------------------------------------------------------------ */

/** One open obligation with the instant its sheets sealed — the job's whole input. */
export interface OpenPaymentRow {
  readonly row: RelationshipPaymentRow;
  readonly sealedAt: Date | null;
  readonly facts: PaymentFacts;
}

/**
 * Every obligation that is neither charged nor expired, with its sealed instant.
 *
 * The filter is the **rows**, not a clock: which of them has work due is
 * `lib/flow/payment-jobs.ts::paymentJobsOf()`'s answer, computed against the one instant the job
 * decided to run at. A job that read the clock here would put "is this due" in SQL and in the
 * scheduler, and the two would drift the day one of them changed.
 */
export async function openPaymentObligations(): Promise<readonly OpenPaymentRow[]> {
  const rows = await queryRows<RelationshipPaymentRow & { sealed_at: Date | null }>(
    `SELECT ${PREFIXED_COLUMN_LIST}, ${SEALED_AT_SQL} AS sealed_at
       FROM relationship_payment rp
      WHERE rp.charged_at IS NULL AND rp.expired_at IS NULL
      ORDER BY COALESCE(rp.first_failed_at, rp.method_captured_at, rp.created_at)`,
  );
  return rows.map((row) => ({
    row,
    sealedAt: row.sealed_at,
    facts: rowFacts(row, row.sealed_at),
  }));
}

/**
 * The pool, in the shape the write helpers accept.
 *
 * The job owns no transaction of its own: each obligation's writes are single statements that are
 * already idempotent (`WHERE charged_at IS NULL`, `RETURNING`), so wrapping a whole batch in one
 * transaction would hold a connection across a provider call and roll back a reminder that had
 * already been sent.
 */
export function poolPaymentSql(): PaymentSql {
  return {
    query: async <R = Record<string, unknown>>(text: string, values?: readonly unknown[]) => {
      const rows = await queryRows<R & QueryResultRow>(text, values);
      return { rows };
    },
  };
}
