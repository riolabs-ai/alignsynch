/**
 * The billing tables' SQL (#289) — reads on the pool, writes in one transaction.
 *
 * Three tables, no ORM (the repo's rule), and one property that matters more than any of them:
 * **a webhook applied twice writes once.** `billing_event.provider_event_id` is unique, and
 * `applyBillingEventOnce()` inserts the event row *in the same transaction* as the subscription
 * write — so a provider retry either finds the event already recorded (and applies nothing) or
 * finds neither, never a recorded event whose subscription write was lost.
 *
 * The design choices worth stating, because each one is a place a billing system usually rots:
 *
 *   - **`billing_plan` is a mirror, not an authority.** `data/billing-plans.ts` is authored by a
 *     person; `scripts/db-seed.mjs` writes these rows from it and `db:verify` (V13) compares them
 *     back. `readBillingPlans()` exists for the surfaces that render a tier, so a page reads rows
 *     rather than a second price literal — and a hand-edited price is a V13 failure, not a
 *     quietly different charge.
 *   - **One live subscription per account, enforced by a partial unique index.** A subscription
 *     is `active | trialing | past_due` while it entitles; those are the states the index covers.
 *     `canceled` rows accumulate as history, which is what an audit wants and what a plain
 *     `UNIQUE (user_id)` would refuse.
 *   - **`activeInstanceCount()` is a query, not a column.** Free is "one active assessment", and
 *     "active" is derived from the same counts `instanceStatusOf` uses — an instance the account
 *     holds a seat on and that is not complete. A boolean or a counter column would be a second
 *     truth every write path has to remember to update, and the first missed update is a person
 *     paying for a plan the product does not give them.
 */
import type { PoolClient } from "pg";
import { type BillingInterval, type BillingPlanId, BILLING_INTERVALS } from "@/data/billing-plans";
import { getPool, queryRows } from "@/lib/db/client";
import {
  type BillingProvider,
  type Plan,
  SUBSCRIPTION_STATUSES,
  type Subscription,
  type SubscriptionStatus,
} from "@/lib/billing/types";

/** The states that entitle the account, and therefore the states the unique index covers. */
export const ENTITLING_STATUSES: readonly SubscriptionStatus[] = ["active", "trialing", "past_due"];

export interface BillingSubscriptionRow {
  readonly user_id: string;
  readonly plan_id: string;
  readonly interval: string;
  readonly provider: string;
  readonly provider_subscription_id: string;
  readonly status: string;
  readonly livemode: boolean;
  readonly current_period_end: Date | string;
}

/**
 * One row → the port's shape.
 *
 * A status the model does not carry becomes `incomplete` and an interval it does not carry becomes
 * `month` — the least entitlement either could be. The row is still reported by V13; a read path
 * must never widen because the data is wrong.
 */
export function subscriptionFromRow(row: BillingSubscriptionRow): Subscription {
  const status = (SUBSCRIPTION_STATUSES as readonly string[]).includes(row.status)
    ? (row.status as SubscriptionStatus)
    : "incomplete";
  const interval = (BILLING_INTERVALS as readonly string[]).includes(row.interval)
    ? (row.interval as BillingInterval)
    : "month";
  return {
    userId: row.user_id,
    planId: row.plan_id as BillingPlanId,
    interval,
    provider: row.provider as BillingProvider,
    providerSubscriptionId: row.provider_subscription_id,
    status,
    // A row that does not answer `true` is test mode — the column's own default and the safe
    // direction (#505). `undefined` from a database migrated before 0026 reads as test too.
    livemode: row.livemode === true,
    currentPeriodEnd:
      row.current_period_end instanceof Date
        ? row.current_period_end.toISOString()
        : new Date(row.current_period_end).toISOString(),
  };
}

const SUBSCRIPTION_COLUMNS = `user_id, plan_id, interval, provider, provider_subscription_id,
                               status, livemode, current_period_end`;

/**
 * The account's live subscription, or `null`.
 *
 * "Live" is the entitling set, read with `= ANY(...)`. A cancelled row is history and is
 * deliberately not returned: a caller asking "what am I paying for?" must not be handed the thing
 * that ended last month.
 */
export async function readActiveSubscription(userId: string): Promise<Subscription | null> {
  const rows = await queryRows<BillingSubscriptionRow>(
    `SELECT ${SUBSCRIPTION_COLUMNS}
       FROM billing_subscription
      WHERE user_id = $1 AND status = ANY($2::text[])
      ORDER BY updated_at DESC
      LIMIT 1`,
    [userId, ENTITLING_STATUSES],
  );
  const row = rows[0];
  return row === undefined ? null : subscriptionFromRow(row);
}

/** The sellable tiers, one row per (tier, interval) — what a surface renders. */
export async function readBillingPlans(): Promise<Plan[]> {
  const rows = await queryRows<{
    id: string;
    interval: string;
    name: string;
    price_cents: number;
    active: boolean;
  }>(
    `SELECT id, interval, name, price_cents, active
       FROM billing_plan
      ORDER BY id, interval`,
  );
  return rows.map((row) => ({
    id: row.id as BillingPlanId,
    interval: row.interval as BillingInterval,
    name: row.name,
    priceCents: row.price_cents,
    active: row.active,
  }));
}

/**
 * Write one subscription, superseding any other live row for the same account.
 *
 * Two statements in the caller's transaction, in this order, because the partial unique index
 * covers `(user_id) WHERE status IN ('active','trialing','past_due')`:
 *
 *   1. cancel every *other* live subscription for the account — an upgrade is a new row, and the
 *      old one should read as history rather than block the insert;
 *   2. upsert on `provider_subscription_id`, so a replay of the same event is an update of the
 *      row it already wrote and never a second subscription.
 */
export async function writeSubscription(
  client: PoolClient,
  subscription: Subscription,
): Promise<Subscription> {
  await client.query(
    `UPDATE billing_subscription
        SET status = 'canceled', updated_at = now()
      WHERE user_id = $1
        AND provider_subscription_id <> $2
        AND status = ANY($3::text[])`,
    [subscription.userId, subscription.providerSubscriptionId, ENTITLING_STATUSES],
  );

  const { rows } = await client.query<BillingSubscriptionRow>(
    `INSERT INTO billing_subscription
       (user_id, plan_id, interval, provider, provider_subscription_id, status, livemode, current_period_end)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (provider_subscription_id) DO UPDATE SET
       plan_id            = EXCLUDED.plan_id,
       interval           = EXCLUDED.interval,
       status             = EXCLUDED.status,
       livemode           = EXCLUDED.livemode,
       current_period_end = EXCLUDED.current_period_end,
       updated_at         = now()
     RETURNING ${SUBSCRIPTION_COLUMNS}`,
    [
      subscription.userId,
      subscription.planId,
      subscription.interval,
      subscription.provider,
      subscription.providerSubscriptionId,
      subscription.status,
      subscription.livemode,
      subscription.currentPeriodEnd,
    ],
  );
  const written = rows[0];
  if (written === undefined) throw new Error("billing_subscription: the upsert returned no row");
  return subscriptionFromRow(written);
}

/** One provider event, as the receiver decided to record it. */
export interface BillingEventInput {
  readonly provider: BillingProvider;
  /** The provider's own event id — the idempotency key. */
  readonly eventId: string;
  readonly type: string;
  /** SHA-256 of the exact body, so a replay with different bytes is visible in the row. */
  readonly payloadDigest: string;
}

/**
 * Apply one event at most once.
 *
 * `work` runs inside the same transaction as the `billing_event` insert: `rowCount === 0` from the
 * insert means the event was already recorded and `work` is never called. A throw in `work` rolls
 * the event row back with it, so the provider's retry is a first attempt again — the two facts
 * cannot disagree.
 */
export async function applyBillingEventOnce(
  event: BillingEventInput,
  work: (client: PoolClient) => Promise<Subscription | null>,
): Promise<{ readonly applied: boolean; readonly subscription: Subscription | null }> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const { rowCount } = await client.query(
      `INSERT INTO billing_event (provider, provider_event_id, type, payload_digest)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (provider, provider_event_id) DO NOTHING`,
      [event.provider, event.eventId, event.type, event.payloadDigest],
    );
    if (rowCount === 0) {
      await client.query("COMMIT");
      return { applied: false, subscription: null };
    }
    const subscription = await work(client);
    await client.query("COMMIT");
    return { applied: true, subscription };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Every billed event, newest first — the smoke script's evidence for "applied once". */
export async function listBillingEvents(
  limit = 20,
): Promise<{ provider: string; provider_event_id: string; type: string; received_at: Date }[]> {
  return queryRows(
    `SELECT provider, provider_event_id, type, received_at
       FROM billing_event ORDER BY received_at DESC, id DESC LIMIT $1`,
    [limit],
  );
}

/** How many events exist for one provider id — `1` after a replay is the point of the table. */
export async function countBillingEvents(provider: string, eventId: string): Promise<number> {
  const rows = await queryRows<{ n: number }>(
    `SELECT count(*)::int AS n FROM billing_event WHERE provider = $1 AND provider_event_id = $2`,
    [provider, eventId],
  );
  return rows[0]?.n ?? 0;
}

/** One subscription row as the database holds it — the smoke script prints this, not a model. */
export interface SubscriptionRowView {
  readonly user_id: string;
  readonly plan_id: string;
  readonly interval: string;
  readonly provider: string;
  readonly provider_subscription_id: string;
  readonly status: string;
  readonly current_period_end: string;
  readonly created_at: string;
}

/** Every subscription row for an account, newest first — the live proof for the acceptance. */
export async function listSubscriptionsFor(userId: string): Promise<SubscriptionRowView[]> {
  return queryRows<SubscriptionRowView>(
    `SELECT user_id, plan_id, interval, provider, provider_subscription_id,
            status, current_period_end::text AS current_period_end,
            created_at::text AS created_at
       FROM billing_subscription
      WHERE user_id = $1
      ORDER BY created_at DESC, id DESC`,
    [userId],
  );
}

/**
 * How many assessment instances this account is actively holding.
 *
 * The same three facts `instanceStatusOf` derives, in SQL: the account holds a party row on the
 * instance, the instance has Aspects, and at least one seat has not answered every Aspect. An
 * instance both parties have finished does not hold a slot — which is what makes the free plan
 * usable for ever rather than once.
 *
 * Signed-out creators hold no seat (their `party.user_id` is NULL), so they are not counted and
 * cannot be gated; the gate is a property of an account, and the anonymous flow is the pre-#213
 * behaviour the product still supports.
 */
export async function activeInstanceCount(userId: string): Promise<number> {
  const rows = await queryRows<{ n: number }>(
    `SELECT count(*)::int AS n
       FROM party vp
       JOIN session ai ON ai.record_id = vp.session_record_id
      WHERE vp.user_id = $1
        AND (SELECT count(*) FROM item i WHERE i.record_id = ai.record_id) > 0
        AND (
          (SELECT count(*) FROM opinion o
            WHERE o.session_record_id = ai.record_id AND o.role = 'initiator')
            < (SELECT count(*) FROM item i WHERE i.record_id = ai.record_id)
          OR
          (SELECT count(*) FROM opinion o
            WHERE o.session_record_id = ai.record_id AND o.role = 'counterparty')
            < (SELECT count(*) FROM item i WHERE i.record_id = ai.record_id)
        )`,
    [userId],
  );
  return rows[0]?.n ?? 0;
}

/**
 * The tier this account is entitled to, raised by any grant that is still running (#505).
 *
 * A comp is a real entitlement, not a receipt: `plan_grant` is written by an operator for one
 * relationship for one period, and while that period is running the account may do what the tier
 * allows — otherwise the console's comp would change a label and nothing else, which is the
 * decorative version of this card. `period_end > $2` is the whole test; an expired grant simply
 * stops being returned, so nothing has to be swept.
 *
 * Reads `plan_id` only. A grant is a tier and a period, and this is the query that decides what an
 * account may do — it has no business loading reasons or authors.
 */
export async function livePlanGrantIds(userId: string, now: Date): Promise<string[]> {
  const rows = await queryRows<{ plan_id: string }>(
    `SELECT pg.plan_id
       FROM plan_grant pg
       JOIN relationship r ON r.id = pg.relationship_id
      WHERE r.initiator_user_id = $1
        AND pg.period_end > $2`,
    [userId, now],
  );
  return rows.map((row) => row.plan_id);
}

/**
 * How many relationships this account has **started** and not finished (#505).
 *
 * The plan's own count, and the one `relationshipGateRefusal()` is asked with. "Active" is the same
 * predicate `activeInstanceCount()` uses, one level up: a relationship counts while it holds a
 * session that is voided nowhere and still has an Aspect one of the parties has not answered. A
 * relationship both parties have finished stops holding a slot, which is what makes the free plan
 * usable for ever rather than once.
 *
 * **It counts what the account initiated**, not every relationship it appears on: being the
 * Counterparty on five relationships is not five purchases, and `initiator_user_id` is the column
 * 0013 records for "the thing bought once by the Initiator". A relationship with no initiator
 * account (a seeded one, or one started signed out) belongs to nobody and is counted for nobody —
 * the same rule `activeInstanceCount` states for an unbound party.
 */
export async function activeRelationshipCount(userId: string): Promise<number> {
  const rows = await queryRows<{ n: number }>(
    `SELECT count(*)::int AS n
       FROM relationship r
      WHERE r.initiator_user_id = $1
        AND EXISTS (
          SELECT 1
            FROM session ai
           WHERE ai.relationship_id = r.id
             AND ai.voided_at IS NULL
             AND (SELECT count(*) FROM item i WHERE i.record_id = ai.record_id) > 0
             AND (
               (SELECT count(*) FROM opinion o
                 WHERE o.session_record_id = ai.record_id AND o.role = 'initiator')
                 < (SELECT count(*) FROM item i WHERE i.record_id = ai.record_id)
               OR
               (SELECT count(*) FROM opinion o
                 WHERE o.session_record_id = ai.record_id AND o.role = 'counterparty')
                 < (SELECT count(*) FROM item i WHERE i.record_id = ai.record_id)
             )
        )`,
    [userId],
  );
  return rows[0]?.n ?? 0;
}
