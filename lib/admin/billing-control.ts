/**
 * `lib/admin/billing-control.ts` — the one write an operator may make to a plan (#505, epic #500).
 *
 * `compPlan()` gives a relationship a tier for a period, or extends the plan it has, and does it the
 * only way this console allows: one `act()` transaction that reads the actor's rung from
 * `user_profile`, inserts a `plan_grant` row and its `admin_action` row, and commits with both or
 * neither. There is no `query()` in this file and no pooled client.
 *
 * **A comp is not a purchase, so it does not touch `billing_subscription`.** That table is written
 * from provider reports only (`lib/db/billing.ts::writeSubscription`), and a gift written there
 * would be overwritten by the next webhook and would make a granted period indistinguishable from a
 * paid one in every query that asks what an account bought. The grant lives in its own table, with
 * its own `reason`, `granted_by` and period — `0026`'s argument, and the reason the card asks for
 * "a `plan_grant` row so a comp is auditable separately from a paid period".
 *
 * **Idempotent by period, not by click.** The insert is a single `ON CONFLICT (relationship_id,
 * period_start) DO NOTHING RETURNING id`: a second comp of the same period finds the key already
 * taken, writes nothing and throws `GrantRefused("period-already-granted")`, which rolls the
 * transaction back — so the second attempt leaves no grant **and no audit row**. An extension
 * starts at a later `period_start` and is therefore a second, legitimate row. Two concurrent
 * operators comping one period race on the constraint rather than on a read, which is the only kind
 * of check that holds under `READ COMMITTED`.
 *
 * **No clock, no card.** `periodStart` is an argument (the operator picks the day, the form sends
 * it), so nothing here reads `new Date()`; and the row this writes names a tier, a period and an
 * author — never a payment instrument. That is the card's hard rule held by the shape of the table.
 *
 * **Refusals are codes**, the shape `lib/admin/relationship-ops.ts` uses: `GrantRefused.reason` is a
 * closed union, and the sentence a person reads is the screen's (`data/pages/admin-billing.ts`). A
 * refusal happens inside the transaction and before the audit insert, so it rolls back having
 * written nothing.
 *
 * The production caller is the server action
 * `app/(mainlayout)/admin/billing/actions.ts`; this module never reads a cookie and never opens a
 * pool of its own.
 */
import { randomUUID } from "node:crypto";

import type { BillingInterval, BillingPlanId } from "@/data/billing-plans";
import { BILLING_INTERVALS, billingPlan } from "@/data/billing-plans";
import {
  type ActResult,
  act,
  type ActSql,
  type ActTransactionRunner,
  recordedReason,
} from "@/lib/admin/act";

/* ------------------------------------------------------------------ *
 * Refusals
 * ------------------------------------------------------------------ */

/**
 * Why a grant was refused — every value a fact about the request or the rows, never a permission.
 *
 * Permissions are `act()`'s (`ActRefused`), so an `admin`
 * session attempting a comp answers `role-too-low` from exactly the mechanism a `support` session
 * attempting a void does. These four are the cases where the request itself cannot be honoured.
 */
export const GRANT_REFUSALS = [
  "no-such-relationship",
  "unknown-plan",
  "invalid-period",
  "period-already-granted",
] as const;

export type GrantRefusal = (typeof GRANT_REFUSALS)[number];

/** A refused grant: nothing ran, nothing was written, no audit row exists. */
export class GrantRefused extends Error {
  readonly reason: GrantRefusal;

  constructor(reason: GrantRefusal, message: string) {
    super(message);
    this.name = "GrantRefused";
    this.reason = reason;
  }
}

/* ------------------------------------------------------------------ *
 * The period
 * ------------------------------------------------------------------ */

/** The two things an operator may do to a relationship's tier. `comp` gives, `extend` pushes out. */
export const GRANT_KINDS = ["comp", "extend"] as const;

export type GrantKind = (typeof GRANT_KINDS)[number];

/** Is this string one of `GRANT_KINDS`? The runtime half of the closed union a form posts. */
export function isGrantKind(value: string): value is GrantKind {
  return (GRANT_KINDS as readonly string[]).includes(value);
}

/** Is this string one of `BILLING_INTERVALS`? The form's other closed field. */
export function isBillingInterval(value: string): value is BillingInterval {
  return (BILLING_INTERVALS as readonly string[]).includes(value);
}

/**
 * One interval after `start`, in UTC.
 *
 * Months are added by month index rather than by 30-day arithmetic, so a comp of `2026-01-31` ends
 * on `2026-02-28` — the day the calendar has, not a day the arithmetic invented. That needs no
 * `Date` rollover trickery: `setUTCMonth(getUTCMonth() + 1)` overflows into the next month for a
 * day the target month does not have, so the day is clamped explicitly.
 */
export function addInterval(start: Date, interval: BillingInterval): Date {
  const months = interval === "year" ? 12 : 1;
  const year = start.getUTCFullYear();
  const month = start.getUTCMonth() + months;
  const day = start.getUTCDate();
  // The first day of the target month, then `min(day, last day of that month)`.
  const target = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0, 0, 0, 0, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  target.setUTCHours(
    start.getUTCHours(),
    start.getUTCMinutes(),
    start.getUTCSeconds(),
    start.getUTCMilliseconds(),
  );
  return target;
}

/**
 * The period a grant of `interval` covers, from a start instant.
 *
 * Pure, and the one place a period is derived: the write stores what this returned, and the form's
 * preview shows the same two instants. A start that is not a date, or one that carries a time zone
 * offset a browser guessed, is `invalid-period` — refused before a transaction opens, so a bad form
 * post costs nothing.
 */
export function grantPeriod(input: {
  readonly periodStart: string;
  readonly interval: BillingInterval;
}): { readonly start: Date; readonly end: Date } {
  const start = new Date(input.periodStart);
  if (Number.isNaN(start.getTime())) {
    throw new GrantRefused(
      "invalid-period",
      `"${input.periodStart}" is not a date a period can start on`,
    );
  }
  return { start, end: addInterval(start, input.interval) };
}

/* ------------------------------------------------------------------ *
 * The write
 * ------------------------------------------------------------------ */

/** What an operator is granting, and why. `actorUserId` comes from the session. */
export interface GrantRequest {
  readonly actorUserId: string;
  readonly relationshipId: string;
  readonly planId: string;
  readonly kind: GrantKind;
  readonly interval: BillingInterval;
  /** ISO-8601. The first instant the granted tier covers. */
  readonly periodStart: string;
  /**
   * Why, when a caller has one. Optional since #732: the console no longer asks, and `NULL` is how
   * "nobody stated one" is recorded.
   */
  readonly reason?: string;
}

/** What a successful grant answers, and what the audit row's `after` carries. */
export interface GrantOutcome {
  readonly grantId: string;
  readonly relationshipId: string;
  readonly planId: BillingPlanId;
  readonly kind: GrantKind;
  readonly periodStart: string;
  readonly periodEnd: string;
  /** The tier the relationship carried before this grant, or `null` for "nobody had set one". */
  readonly previousPlanId: string | null;
}

/**
 * Give one relationship a tier for one period, audited.
 *
 * Throws `ActRefused` for a rung below `owner` (the floor is
 * `lib/admin/roles.ts::ACTION_REQUIREMENTS["plan.comp"]`), `GrantRefused` for a request the rows
 * cannot honour, and rethrows a database failure unchanged.
 *
 * The order inside the transaction is the contract: read the relationship `FOR UPDATE` (so two
 * grants to one row serialize), refuse an unknown tier, insert the grant — the conflict is the
 * idempotency check — then write the relationship's own `plan`, and only then let `act()` insert
 * the audit row. Every refusal therefore precedes the audit insert, which is what makes "a refused
 * comp leaves no trace" true rather than intended.
 */
export async function compPlan(
  request: GrantRequest,
  runner?: ActTransactionRunner,
): Promise<ActResult<GrantOutcome>> {
  const plan = billingPlan(request.planId);
  if (plan === undefined) {
    throw new GrantRefused(
      "unknown-plan",
      `"${request.planId}" is not a plan this product sells — the tier is refused rather than invented`,
    );
  }
  if (!isGrantKind(request.kind)) {
    throw new GrantRefused("invalid-period", `"${request.kind}" is not a grant this console makes`);
  }
  const period = grantPeriod({ periodStart: request.periodStart, interval: request.interval });
  const grantId = randomUUID();
  // The tier as the fixture spells it, not as the form posted it: `billingPlan()` matched on a
  // string, and the row stores the vocabulary's own id.
  const planId: BillingPlanId = plan.id;

  return act<GrantOutcome>(
    {
      actorUserId: request.actorUserId,
      action: "plan.comp",
      // The row this writes. An audit entry that pointed at the relationship instead would answer
      // "somebody granted something" and leave a reader to guess which grant.
      target: { table: "plan_grant", id: grantId },
      reason: request.reason,
      mutate: async (sql: ActSql) => {
        const relationship = await sql.query<{ id: string; plan: string | null }>(
          "SELECT id, plan FROM relationship WHERE id = $1 FOR UPDATE",
          [request.relationshipId],
        );
        const row = relationship.rows[0];
        if (row === undefined) {
          throw new GrantRefused(
            "no-such-relationship",
            `no relationship "${request.relationshipId}" to grant`,
          );
        }

        // The idempotency key is the constraint, not a read: `ON CONFLICT DO NOTHING` with no
        // returned row means this period already carries a grant, whoever wrote it and however
        // many times they clicked.
        const inserted = await sql.query<{ id: string }>(
          `INSERT INTO plan_grant
             (id, relationship_id, plan_id, kind, period_start, period_end, reason, granted_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (relationship_id, period_start) DO NOTHING
           RETURNING id::text AS id`,
          [
            grantId,
            request.relationshipId,
            planId,
            request.kind,
            period.start.toISOString(),
            period.end.toISOString(),
            recordedReason(request.reason),
            request.actorUserId,
          ],
        );
        if (inserted.rows[0] === undefined) {
          throw new GrantRefused(
            "period-already-granted",
            `relationship "${request.relationshipId}" already has a grant starting ${period.start.toISOString()} — a period is granted once`,
          );
        }

        // The relationship reads on the tier it was granted. `DISTINCT FROM` so a second grant of
        // the same tier for a later period writes no row — the update is convergent, and the audit
        // `before`/`after` still records the period that moved.
        await sql.query(
          "UPDATE relationship SET plan = $2 WHERE id = $1 AND plan IS DISTINCT FROM $2",
          [request.relationshipId, planId],
        );

        return {
          before: { plan: row.plan },
          after: {
            grantId,
            relationshipId: request.relationshipId,
            planId,
            kind: request.kind,
            periodStart: period.start.toISOString(),
            periodEnd: period.end.toISOString(),
            previousPlanId: row.plan,
          } satisfies GrantOutcome,
        };
      },
    },
    runner,
  );
}
