/**
 * Enforcement: the database half of #533 phase 3 — the queries that read a membership and the two
 * statements that correct it.
 *
 * `lib/relationship/membership.ts` decides *what* a relationship's state is; this module is the
 * only place that **reads the rows to answer it** and the only place that **writes the lapse**.
 * Splitting them matters for the same reason phase 2 split `publish-basis.ts` from
 * `relationships.ts`: the policy is testable with literals and a fake connection, and the SQL is a
 * handful of statements a reviewer reads once.
 *
 * **Check-on-read, corrected on write — the choice #533's card asks to be stated.** There is no
 * nightly sweep and no cron. Every read path derives the state from the instant it was handed
 * (`readMembershipForSession`, `readMembershipForRelationship`), so a screen is correct on the
 * request that draws it and a job cannot silently die between two correct requests. The **status
 * column** is corrected by the next write path (`lapseIfDue`, called inside the claim, the answer
 * submit, the accept, the re-publish and the payment event), so the stored row converges to the
 * derived answer without a background process. The alternative — a daily sweep — was rejected
 * because the product has no scheduler the gate can exercise, and \"the report is read-only because
 * a job ran last night\" is not a property a test can prove.
 *
 * **Every lapse write is idempotent and guarded on the derived answer, not on a timer.** The
 * UPDATE names `status IN ('published','active')` and sets the pair in one statement, so a second
 * attempt finds nothing to do; and the guard is the *derived* state (`membershipOf`), which is the
 * same function the screen draws from. There is no second copy of \"is it lapsed\" in SQL.
 *
 * **The two directions of the payment rule are here.** `syncRelationshipsWithSubscription()` is
 * called from inside the billing transaction (`lib/db/billing.ts::applyBillingEventOnce`), so a
 * provider event and its consequence on the relationships it pays for commit or roll back
 * together: a committed subscription whose relationship consequence was lost would be a customer
 * paying for a relationship nobody reactivated. It is the only write in this module that is not
 * `act()`-audited, and deliberately so — it is a **system** transition (`lib/relationship/
 * status.ts`), the same class as the claim's `published → active`, not an operator's decision.
 *
 * Not a client module: it reaches `pg` types only as an interface, and every caller is a server
 * module. `data:check` E34 walks the `"use client"` graph and would fail on a crossing.
 */
import type { SubscriptionStatus } from "@/lib/billing/types";
import { getPool } from "@/lib/db/client";
import {
  LAPSE_REASONS,
  lapseReasonOf,
  membershipOf,
  type LapseReason,
  type Membership,
} from "@/lib/relationship/membership";
import { type RelationshipStatus, isRelationshipStatus } from "@/lib/relationship/status";
import type { TrialFacts } from "@/lib/relationship/trial";

/**
 * The one query surface this module needs.
 *
 * `pg`'s `Pool` and `PoolClient` both satisfy it, and so does `act()`'s `ActSql` — which is what
 * lets the claim, the answer submit and the accept share these statements with the payment event
 * without any of them handing over a pool they own.
 */
export interface Sql {
  query<R = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<{ readonly rows: readonly R[] }>;
}

/** The statuses a lapse may move from. Everything else is either not yet sold or already over. */
export const LAPSABLE_STATUSES: readonly RelationshipStatus[] = ["published", "active"];

/** The statuses whose membership question is asked at all. `draft`/`pending` are not sold yet. */
export const LIVE_STATUSES: readonly RelationshipStatus[] = ["published", "active", "expired"];

/** The columns one membership read needs from `relationship`. */
interface RelationshipFactRow {
  readonly id: string;
  readonly status: string;
  readonly initiator_user_id: string | null;
  readonly expired_at: Date | null;
  readonly lapse_reason: string | null;
}

/** The subscription facts a membership read needs. Structurally `TrialFacts`. */
interface SubscriptionFactRow {
  readonly status: string;
  readonly current_period_end: Date | string;
}

/** What one membership read answers: the derived state, and the rows it was derived from. */
export interface MembershipReading {
  readonly relationshipId: string;
  /** The account that pays for it. `null` for a seeded relationship nobody owns. */
  readonly initiatorUserId: string | null;
  readonly status: RelationshipStatus;
  readonly membership: Membership;
  /** Does a counterparty seat exist? Decides `expired → active` vs `expired → published`. */
  readonly hasCounterparty: boolean;
}

const RELATIONSHIP_FACT_COLUMNS = `id, status, initiator_user_id, expired_at, lapse_reason`;

/**
 * The account's live subscription, or `null`.
 *
 * The same predicate `lib/db/billing.ts::readActiveSubscription()` uses (`status = ANY` of the
 * entitling three), written here rather than imported: this module is imported *by* the billing
 * row writer, and an import back would be a cycle. `tests/relationship-membership.test.ts` pins
 * the entitling set against `entitlements.ts` so the two cannot drift.
 */
async function readSubscriptionFacts(sql: Sql, userId: string): Promise<TrialFacts | null> {
  const rows = await sql.query<SubscriptionFactRow>(
    `SELECT status, current_period_end
       FROM billing_subscription
      WHERE user_id = $1 AND status = ANY($2::text[])
      ORDER BY updated_at DESC
      LIMIT 1`,
    [userId, ["active", "trialing", "past_due"]],
  );
  const row = rows.rows[0];
  if (row === undefined) return null;
  return {
    status: row.status as SubscriptionStatus,
    currentPeriodEnd:
      row.current_period_end instanceof Date
        ? row.current_period_end
        : new Date(row.current_period_end),
  };
}

/** Does this relationship hold a counterparty seat? One `EXISTS`, over the newest session. */
async function hasCounterpartyOf(sql: Sql, relationshipId: string): Promise<boolean> {
  const rows = await sql.query<{ present: boolean }>(
    `SELECT EXISTS (
              SELECT 1
                FROM session s
                JOIN party p ON p.session_record_id = s.record_id
               WHERE s.relationship_id = $1 AND p.role = 'counterparty'
            ) AS present`,
    [relationshipId],
  );
  return rows.rows[0]?.present === true;
}

/** One relationship row, or `undefined` when the id names nothing. */
async function relationshipFactsOf(
  sql: Sql,
  relationshipId: string,
  { lock }: { readonly lock: boolean },
): Promise<RelationshipFactRow | undefined> {
  const rows = await sql.query<RelationshipFactRow>(
    `SELECT ${RELATIONSHIP_FACT_COLUMNS}
       FROM relationship
      WHERE id = $1${lock ? " FOR UPDATE" : ""}`,
    [relationshipId],
  );
  return rows.rows[0];
}

/** Build the reading from rows already in hand. Pure, so the two callers cannot diverge. */
function readingOf(
  row: RelationshipFactRow,
  subscription: TrialFacts | null,
  hasCounterparty: boolean,
  now: Date,
): MembershipReading {
  const status = isRelationshipStatus(row.status) ? row.status : "expired";
  return {
    relationshipId: row.id,
    initiatorUserId: row.initiator_user_id,
    status,
    membership: membershipOf({
      status,
      subscription,
      expiredAt: row.expired_at,
      lapseReason: row.lapse_reason,
      now,
    }),
    hasCounterparty,
  };
}

/**
 * Does this account hold a **live subscription** — the fact stage 5's send is gated on?
 *
 * This is not `membership.writable`, and the difference is the whole reason it exists. `writable`
 * answers "may either party write?" and deliberately reads `true` for a `draft` (nothing has been
 * sold yet, so there is nothing to lapse). A freshly created relationship is exactly that: a draft.
 * So a screen that asked `membership.writable` whether the walk was paid for would open the walk on
 * its thank-you for every brand-new relationship, skip the plan and the card entirely, and then be
 * refused by `sendDraftInvitation()` with `no-payment-method` — the UI saying "the plan is active"
 * about an account holding no subscription.
 *
 * The read is the same one the send performs (`readSubscriptionFacts` filters to the entitling
 * statuses), so the courtesy and the rule cannot disagree.
 */
export async function readSubscriptionLive(sql: Sql, userId: string): Promise<boolean> {
  return (await readSubscriptionFacts(sql, userId)) !== null;
}

/** Read one relationship's membership, without writing anything.
 *
 * This is the read a screen uses. It never takes a lock and never writes, which is what makes it
 * safe inside a render — the repo's rule is that a render does not read a clock *or* write a row,
 * and this function obeys both (the clock is the `now` the caller decided to render).
 */
export async function readMembershipForRelationship(
  sql: Sql,
  relationshipId: string,
  now: Date,
): Promise<MembershipReading | undefined> {
  const row = await relationshipFactsOf(sql, relationshipId, { lock: false });
  if (row === undefined) return undefined;
  const subscription =
    row.initiator_user_id === null ? null : await readSubscriptionFacts(sql, row.initiator_user_id);
  return readingOf(row, subscription, await hasCounterpartyOf(sql, row.id), now);
}

/**
 * Read the membership of the relationship a **session** belongs to — the shape every flow write
 * has in hand (a claim, an answer submit, an accept all begin from a session record id).
 *
 * A session with no relationship returns `undefined`; the flow's own `no-such-instance` refusal is
 * what names that, and this module does not invent a second one.
 */
export async function readMembershipForSession(
  sql: Sql,
  sessionRecordId: string,
  now: Date,
): Promise<MembershipReading | undefined> {
  const rows = await sql.query<{ relationship_id: string | null }>(
    "SELECT relationship_id FROM session WHERE record_id = $1",
    [sessionRecordId],
  );
  const relationshipId = rows.rows[0]?.relationship_id;
  if (relationshipId === null || relationshipId === undefined) return undefined;
  return readMembershipForRelationship(sql, relationshipId, now);
}

/**
 * Read a membership **and correct the stored row if the derived answer says it lapsed**.
 *
 * Called at the top of every write path, inside the caller's transaction, after the caller has
 * locked what it is about to write. Two statements at most:
 *
 *   1. the relationship row `FOR UPDATE` — so two writers cannot both decide to lapse it;
 *   2. the UPDATE, only when the derived state is `lapsed` and the stored status is still one the
 *      lapse may move from.
 *
 * A relationship already `expired` is returned unchanged (the row is the fact), and a `complete` /
 * `void` one is not lapsed at all — `membershipOf` says `closed`, and money does not reopen a
 * decision. That is why the guard is `LAPSABLE_STATUSES` and not "not expired".
 */
export async function lapseIfDue(
  sql: Sql,
  relationshipId: string,
  now: Date,
): Promise<MembershipReading | undefined> {
  const row = await relationshipFactsOf(sql, relationshipId, { lock: true });
  if (row === undefined) return undefined;

  const subscription =
    row.initiator_user_id === null ? null : await readSubscriptionFacts(sql, row.initiator_user_id);
  const hasCounterparty = await hasCounterpartyOf(sql, row.id);
  const reading = readingOf(row, subscription, hasCounterparty, now);

  if (reading.membership.state !== "lapsed" || !LAPSABLE_STATUSES.includes(reading.status)) {
    return reading;
  }

  const reason: LapseReason = reading.membership.reason ?? lapseReasonOf(subscription, now);
  /**
   * The instant the row records is the **derived** one, not this request's clock: a trial that ran
   * out on the 1st ended on the 1st, whatever day the member next opens the page. Storing `now`
   * would make the row and `membershipSentence()` disagree with the read that produced them, and
   * `membershipOf` reads `expired_at` back on the next request.
   */
  const endedAt = reading.membership.endedAt ?? now;
  await sql.query(
    `UPDATE relationship
        SET status = 'expired', expired_at = $2, lapse_reason = $3
      WHERE id = $1 AND status = ANY($4::text[])`,
    [row.id, endedAt.toISOString(), reason, LAPSABLE_STATUSES],
  );

  return {
    ...reading,
    status: "expired",
    membership: { ...reading.membership, state: "lapsed", reason, endedAt, writable: false },
  };
}

/**
 * Record a due lapse **on its own connection**, and let it commit.
 *
 * The write paths that refuse a lapsed pair do so by rolling their own transaction back — a
 * refused claim writes nothing, which is the point of a refusal. But the *lapse itself* is not the
 * caller's write: it is a fact the money already decided, and `#533` asks for the state to move to
 * `expired`, not for it to move only if somebody happens to write successfully (a lapsed pair can
 * never write successfully, so that would be never).
 *
 * So a refusal path calls this **after** its own `ROLLBACK`, in a transaction of its own that
 * commits. The correction is the same `lapseIfDue`, guarded by the same derived answer and the same
 * `status = ANY('published','active')` predicate, so a repeated refusal is a no-op and a
 * `complete`/`void` relationship is never touched. A failure here must not turn a refusal into a
 * 500: the caller has an answer for the person either way, so a correction that cannot be written
 * is swallowed and the request still answers `lapsed` (the derived read is the truth; the column is
 * the record of it).
 */
export async function recordLapseIfDue(
  relationshipId: string,
  now: Date,
): Promise<MembershipReading | undefined> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const reading = await lapseIfDue(client, relationshipId, now);
    await client.query("COMMIT");
    return reading;
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    return undefined;
  } finally {
    client.release();
  }
}

/* ------------------------------------------------------------------ *
 * The payment rule, both directions
 * ------------------------------------------------------------------ */

/** What a payment event did to the account's relationships. The adapter logs it, tests pin it. */
export interface SubscriptionConsequence {
  readonly entitled: boolean;
  /** Relationships moved `expired → active|published`. */
  readonly reactivated: number;
  /** Relationships moved `published|active → expired`. */
  readonly lapsed: number;
}

/**
 * Apply one subscription write to every relationship the account started.
 *
 * Called inside the billing transaction, so the two commit together. The direction is decided by
 * **the entitlement**, not by the event's name: `membershipEntitles()` plus the trial window says
 * whether the account is still paying, and `invoice.paid`, `checkout.session.completed`,
 * `customer.subscription.updated` and `customer.subscription.deleted` all reduce to that one
 * question. A rule written per event name would have to be extended for the next event type and
 * would disagree with `entitlements.ts` the first time the two were edited apart.
 *
 * `past_due` is entitled on purpose — dunning is a grace period and `lib/billing/entitlements.ts`
 * records the same decision; the provider stops entitling the account at `unpaid`/`canceled`, and
 * that is the instant the relationship goes read-only. #533's "a failed payment moves
 * `active → expired`" is therefore implemented as "the entitlement ended", which is what a failed
 * payment becomes once the retries are exhausted.
 *
 * Reactivation reads the seat, not a stored origin (`reactivationStatusOf`): a bound counterparty
 * means `active`, an unclaimed invitation means `published` so the link works again. Both are
 * `system` edges in `lib/relationship/status.ts`.
 */
export async function syncRelationshipsWithSubscription(
  sql: Sql,
  subscription: TrialFacts & { readonly userId: string },
  now: Date = new Date(),
): Promise<SubscriptionConsequence> {
  /**
   * The event's own status is the provider's truth *as of the delivery*, so a `trialing` event is a
   * running trial even though its `current_period_end` is (by definition) in the future and a
   * `canceled` one is over. The clock comparison belongs on the **read** path (`membershipOf`), where
   * a row can outlive the event that last described it; applying it here would make every arrival
   * late enough to matter lapse the account the event was trying to keep alive.
   */
  const entitled =
    subscription.status === "active" ||
    subscription.status === "trialing" ||
    subscription.status === "past_due";

  if (entitled) {
    const reactivated = await sql.query<{ id: string }>(
      `UPDATE relationship r
          SET status = CASE
                WHEN EXISTS (
                  SELECT 1
                    FROM session s
                    JOIN party p ON p.session_record_id = s.record_id
                   WHERE s.relationship_id = r.id AND p.role = 'counterparty'
                ) THEN 'active'
                ELSE 'published'
              END
        WHERE r.initiator_user_id = $1
          AND r.status = 'expired'
        RETURNING r.id`,
      [subscription.userId],
    );
    return { entitled: true, reactivated: reactivated.rows.length, lapsed: 0 };
  }

  /**
   * When the membership ended, from the subscription's own window: the period end if it has already
   * passed, otherwise the instant the event was applied (a cancellation decided mid-period ends the
   * entitlement at the period end, but the row is written now and a future `expired_at` would read
   * as "ended tomorrow" to the party looking at it).
   */
  const periodEnd = periodEndOf(subscription);
  const endedAt = periodEnd !== null && periodEnd.getTime() < now.getTime() ? periodEnd : now;

  const lapsed = await sql.query<{ id: string }>(
    `UPDATE relationship
        SET status = 'expired',
            expired_at = COALESCE(expired_at, $2),
            lapse_reason = $3
      WHERE initiator_user_id = $1
        AND status = ANY($4::text[])
      RETURNING id`,
    [
      subscription.userId,
      endedAt.toISOString(),
      lapseReasonOf(subscription, now),
      LAPSABLE_STATUSES,
    ],
  );
  return { entitled: false, reactivated: 0, lapsed: lapsed.rows.length };
}

/**
 * The subscription's own period end, parsed — the only instant the payload dates the membership by.
 *
 * Deliberately not "the current clock": a `trialing` event that arrives late still describes a trial
 * window that ended at its period end, and a `canceled` one describes an account whose access runs
 * to that instant. `null` when the column is unreadable, which the caller reads as "use now".
 */
function periodEndOf(subscription: TrialFacts): Date | null {
  const ends =
    subscription.currentPeriodEnd instanceof Date
      ? subscription.currentPeriodEnd
      : new Date(subscription.currentPeriodEnd);
  return Number.isNaN(ends.getTime()) ? null : ends;
}

/* ------------------------------------------------------------------ *
 * The trial's holder — #533's refusal, named
 * ------------------------------------------------------------------ */

/** The relationship a running trial pays for, as the refusal names it. */
export interface TrialHolder {
  readonly relationshipId: string | null;
  readonly title: string | null;
  readonly endsAt: Date;
}

/**
 * Which of this account's relationships holds the live trial?
 *
 * #533's acceptance asks for the *relationship*, not just the instant: \"a second relationship
 * cannot start a trial, and the refusal names the relationship that holds the trial\". Phase 2's
 * refusal named the instant; this adds the row.
 *
 * The link is `billing_subscription.provider_subscription_id` — `publishRelationship()` writes
 * `trial-<relationship id>`, which is a real column and not a text search over a payload. A trial
 * that arrived from a provider instead has no such id, so the fallback is the account's most
 * recently published relationship: the one that would have started it. `title` is the
 * relationship's own copy's title, so the sentence names something a person recognizes.
 */
export async function trialHolderOf(sql: Sql, userId: string): Promise<TrialHolder | null> {
  const own = await sql.query<{
    relationship_id: string | null;
    title: string | null;
    current_period_end: Date | string;
  }>(
    `SELECT r.id AS relationship_id, t.title, bs.current_period_end
       FROM billing_subscription bs
       LEFT JOIN relationship r ON bs.provider_subscription_id = 'trial-' || r.id
       LEFT JOIN record t ON t.id = r.template_id
      WHERE bs.user_id = $1 AND bs.status = 'trialing'
      ORDER BY bs.updated_at DESC
      LIMIT 1`,
    [userId],
  );
  const row = own.rows[0];
  if (row === undefined) return null;

  if (row.relationship_id !== null) {
    return {
      relationshipId: row.relationship_id,
      title: row.title,
      endsAt:
        row.current_period_end instanceof Date
          ? row.current_period_end
          : new Date(row.current_period_end),
    };
  }

  const fallback = await sql.query<{
    relationship_id: string;
    title: string;
  }>(
    `SELECT r.id AS relationship_id, t.title
       FROM relationship r
       JOIN record t ON t.id = r.template_id
      WHERE r.initiator_user_id = $1 AND r.status = 'published'
      ORDER BY r.published_at DESC NULLS LAST
      LIMIT 1`,
    [userId],
  );
  const held = fallback.rows[0];
  return {
    relationshipId: held?.relationship_id ?? null,
    title: held?.title ?? null,
    endsAt:
      row.current_period_end instanceof Date
        ? row.current_period_end
        : new Date(row.current_period_end),
  };
}

/** The three lapse words, re-exported so a caller building a sentence imports one module. */
export { LAPSE_REASONS };
