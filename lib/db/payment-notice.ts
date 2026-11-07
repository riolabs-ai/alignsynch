/**
 * The read behind the payment notice (#619) — who to write to, and what the message may say.
 *
 * **One statement, five facts per seat, and no `opinion` row.** The notice goes out on a clock, not
 * on a request, so it cannot borrow a screen's context: it has to read the relationship's title,
 * the two seats' names and addresses, the amount the job will charge, and the two instants
 * (`sealed_at` for the deadline, `expired_at` for the expiry's calendar date) itself. Reading them
 * in one statement is what stops the amount in a reminder and the amount charged from being read a
 * second apart and disagreeing.
 *
 * **`sealed_at` is a read, never a column.** The same expression `lib/db/relationship-payment.ts`
 * uses — `max(party.accepted_at)` over the relationship's sessions — because the fourteen-day
 * deadline is arithmetic from the last acceptance and a second copy of that rule would be a second
 * answer to "when does this expire".
 *
 * **The addresses come from `session_invite`, not from `neon_auth`.** The invite row holds both:
 * `initiator_email` is the address the creator was signed in as (written at publish),
 * `email` is the counterparty's invited address. That keeps this read working on a branch with no
 * auth schema — and it is the address the invitation actually reached, which is the one a nag
 * should use. A signed-out create stores NULL, so a relationship from it answers `null` here and
 * the notice treats that as `no-address` rather than guessing.
 *
 * **No card data.** Nothing in this result is a number, a brand or an expiry date, and the row
 * shape deliberately has no field a caller could put in a message: the notice composes from the
 * title, a name and a link.
 */
import { queryRows } from "@/lib/db/client";

/** The query surface this read needs — the pool by default, a recording fake in a test. */
export type PaymentNoticeQuery = (
  text: string,
  values: readonly unknown[],
) => Promise<readonly unknown[]>;

const POOL_QUERY: PaymentNoticeQuery = (text, values) =>
  queryRows<Record<string, unknown>>(text, values);

/** The latest round of a relationship — the one the fee is being charged for. */
const LATEST_SESSION_SQL = `LEFT JOIN LATERAL (
    SELECT s.record_id
      FROM session s
     WHERE s.relationship_id = rel.id
     ORDER BY s.round DESC
     LIMIT 1
  ) latest ON true`;

/** The last acceptance over every session of the relationship — when the window started. */
const SEALED_AT_SQL = `(SELECT max(p.accepted_at)
                          FROM party p
                          JOIN session s2 ON s2.record_id = p.session_record_id
                         WHERE s2.relationship_id = rp.relationship_id)`;

export const PAYMENT_NOTICE_SQL = `SELECT r.title,
       si.initiator_email  AS payer_email,
       si.email            AS counterparty_email,
       pi.name             AS payer_name,
       pc.name             AS counterparty_name,
       rp.charge_amount_cents,
       rp.expired_at,
       ${SEALED_AT_SQL} AS sealed_at
  FROM relationship rel
  JOIN record r ON r.id = rel.template_id
  JOIN relationship_payment rp ON rp.relationship_id = rel.id
  ${LATEST_SESSION_SQL}
  LEFT JOIN session_invite si ON si.session_record_id = latest.record_id
  LEFT JOIN party pi ON pi.session_record_id = latest.record_id AND pi.role = 'initiator'
  LEFT JOIN party pc ON pc.session_record_id = latest.record_id AND pc.role = 'counterparty'
 WHERE rel.id = $1`;

/** What a message may use. Every nullable field is nullable because the row can honestly lack it. */
export interface PaymentNoticeFacts {
  readonly title: string;
  readonly payerEmail: string | null;
  readonly counterpartyEmail: string | null;
  readonly payerName: string | null;
  readonly counterpartyName: string | null;
  /** `charge_amount_cents`: what an attempt recorded. `null` before the first attempt. */
  readonly chargeAmountCents: number | null;
  /** `max(party.accepted_at)`: the instant the fourteen-day window starts. */
  readonly sealedAt: Date | null;
  readonly expiredAt: Date | null;
}

/** A `timestamptz` as a `Date`, or `null` — a value a driver returned as a string is still read. */
function instantOf(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** A text column or `null`. An empty string is absence, not an address. */
function textOf(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/**
 * The facts for one relationship's notice, or `undefined` when it has no obligation row.
 *
 * `undefined` is the honest answer for a relationship that was created before #619: there is no
 * row, so there is nothing owed and nothing to say. It is not "unpaid" and it is not an error.
 */
export async function readPaymentNoticeFacts(
  relationshipId: string,
  query: PaymentNoticeQuery = POOL_QUERY,
): Promise<PaymentNoticeFacts | undefined> {
  const rows = await query(PAYMENT_NOTICE_SQL, [relationshipId]);
  const row = rows[0];
  if (typeof row !== "object" || row === null) return undefined;
  const facts = row as Record<string, unknown>;
  const title = textOf(facts.title);
  if (title === null) return undefined;
  const amount = facts.charge_amount_cents;
  return {
    title,
    payerEmail: textOf(facts.payer_email),
    counterpartyEmail: textOf(facts.counterparty_email),
    payerName: textOf(facts.payer_name),
    counterpartyName: textOf(facts.counterparty_name),
    chargeAmountCents: typeof amount === "number" && Number.isFinite(amount) ? amount : null,
    sealedAt: instantOf(facts.sealed_at),
    expiredAt: instantOf(facts.expired_at),
  };
}
