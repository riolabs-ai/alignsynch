/**
 * The console's billing read (#505) — what `/admin/billing` sees, and nothing more.
 *
 * One statement over four tables, and the column list is the card's hard rule: **no card data, ever**.
 * This module selects a provider *id*, a provider *state*, a plan id, a period and a boolean. It
 * never selects a customer object, an instrument, a last-four, an expiry, an address or a receipt —
 * and it cannot be handed one, because the three billing columns it reads are the three
 * `billing_subscription` has that are not money. A provider payload that grew a `card: { last4 }`
 * could not reach a render through this file without somebody adding a column here, in a diff.
 *
 * **The row is a relationship, not an account.** The card asks for subscription state *per
 * relationship*, and 0013 records why that is the unit: a relationship is what is bought once and
 * persists. The subscription itself belongs to an account (`billing_subscription.user_id`), so the
 * row joins the Initiator's live subscription through `relationship.initiator_user_id`. A
 * relationship with no Initiator account — a seeded one, or one started signed out — is drawn as
 * such rather than hidden: it is a real relationship the console has to be able to see.
 *
 * **Three plan facts, kept apart.** `relationship.plan` is the row's own tier (an operator's comp
 * writes it, `lib/admin/billing-control.ts`), the subscription names what the account pays for, and
 * a live `plan_grant` names what was given. The row reports each rather than a merged guess, and
 * `planSource` says which one the printed tier came from, so "why does this say Basic" is
 * answerable from the table.
 *
 * **The account's active relationship count** rides on every row (it is the plan's limit's
 * numerator) and is the same predicate `activeRelationshipCount()` uses — see `lib/db/billing.ts`,
 * which is where the definition and its argument live.
 */
import { queryRows } from "@/lib/db/client";
import { ENTITLING_STATUSES } from "@/lib/db/billing";

/** One subscription, as the console may see it. No instrument, no customer, no address. */
export interface AdminBillingSubscription {
  readonly planId: string;
  readonly interval: string;
  readonly provider: string;
  /** The provider's own id — what a support ticket quotes. Never a card, never a customer. */
  readonly providerSubscriptionId: string;
  readonly status: string;
  /** `false` is test mode. The banner and the row badge both read this one boolean. */
  readonly livemode: boolean;
  readonly currentPeriodEnd: string;
}

/** One grant, as the console may see it: what was given, for which period, by whom and why. */
export interface AdminBillingGrant {
  readonly planId: string;
  readonly kind: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly reason: string;
  readonly grantedBy: string;
  readonly createdAt: string;
}

/** Where the tier the table prints came from. Three sources, named, never merged silently. */
export type PlanSource = "relationship" | "subscription" | "free" | "none";

/** One relationship's billing state — the whole of what the screen may render. */
export interface AdminBillingRow {
  readonly relationshipId: string;
  readonly templateTitle: string;
  readonly initiatorUserId: string | null;
  /** The account's display name, or `null` when the seat has no profile row. Never an address. */
  readonly initiatorName: string | null;
  /** The tier in force, from `planSource`. */
  readonly planId: string;
  readonly planSource: PlanSource;
  readonly subscription: AdminBillingSubscription | null;
  /** The newest grant on this relationship, live or expired. `null` when there is none. */
  readonly grant: AdminBillingGrant | null;
  /** Relationships this account has started and not finished — the plan limit's numerator. */
  readonly activeRelationships: number;
}

interface AdminBillingSqlRow {
  readonly relationship_id: string;
  readonly template_title: string | null;
  readonly initiator_user_id: string | null;
  readonly initiator_name: string | null;
  readonly relationship_plan: string | null;
  readonly sub_plan_id: string | null;
  readonly sub_interval: string | null;
  readonly sub_provider: string | null;
  readonly sub_provider_id: string | null;
  readonly sub_status: string | null;
  readonly sub_livemode: boolean | null;
  readonly sub_period_end: string | null;
  readonly grant_plan: string | null;
  readonly grant_kind: string | null;
  readonly grant_period_start: string | null;
  readonly grant_period_end: string | null;
  readonly grant_reason: string | null;
  readonly grant_granted_by: string | null;
  readonly grant_created_at: string | null;
  readonly account_active_relationships: number;
}

/**
 * The read.
 *
 * `template_title` falls back to the template's id, so a relationship whose template row is missing
 * still draws a row instead of an empty cell: this screen's job is to show what billing thinks,
 * not to hide a row because its copy is gone.
 */
const ADMIN_BILLING_SQL = `
  SELECT r.id                AS relationship_id,
         COALESCE(t.title, r.template_id) AS template_title,
         r.initiator_user_id,
         p.display_name      AS initiator_name,
         r.plan              AS relationship_plan,
         s.plan_id           AS sub_plan_id,
         s.interval          AS sub_interval,
         s.provider          AS sub_provider,
         s.provider_subscription_id AS sub_provider_id,
         s.status            AS sub_status,
         s.livemode          AS sub_livemode,
         s.current_period_end::text AS sub_period_end,
         g.plan_id           AS grant_plan,
         g.kind              AS grant_kind,
         g.period_start::text AS grant_period_start,
         g.period_end::text  AS grant_period_end,
         g.reason            AS grant_reason,
         g.granted_by        AS grant_granted_by,
         g.created_at::text  AS grant_created_at,
         COALESCE((
           SELECT count(*)::int
             FROM relationship r2
            WHERE r2.initiator_user_id = r.initiator_user_id
              AND r.initiator_user_id IS NOT NULL
              AND EXISTS (
                SELECT 1
                  FROM session ai
                 WHERE ai.relationship_id = r2.id
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
              )
         ), 0) AS account_active_relationships
    FROM relationship r
    LEFT JOIN record t ON t.id = r.template_id
    LEFT JOIN user_profile p ON p.user_id = r.initiator_user_id
    LEFT JOIN LATERAL (
      SELECT bs.plan_id, bs.interval, bs.provider, bs.provider_subscription_id, bs.status,
             bs.livemode, bs.current_period_end
        FROM billing_subscription bs
       WHERE bs.user_id = r.initiator_user_id
         AND bs.status = ANY($1::text[])
       ORDER BY bs.updated_at DESC
       LIMIT 1
    ) s ON TRUE
    LEFT JOIN LATERAL (
      SELECT pg.plan_id, pg.kind, pg.period_start, pg.period_end, pg.reason, pg.granted_by,
             pg.created_at
        FROM plan_grant pg
       WHERE pg.relationship_id = r.id
       ORDER BY pg.period_start DESC
       LIMIT 1
    ) g ON TRUE
   ORDER BY r.created_at DESC, r.id`;

function rowOf(row: AdminBillingSqlRow): AdminBillingRow {
  const subscription: AdminBillingSubscription | null =
    row.sub_plan_id === null
      ? null
      : {
          planId: row.sub_plan_id,
          interval: row.sub_interval ?? "month",
          provider: row.sub_provider ?? "mock",
          providerSubscriptionId: row.sub_provider_id ?? "",
          status: row.sub_status ?? "incomplete",
          // The column's own default and the safe direction: only an explicit `true` is live.
          livemode: row.sub_livemode === true,
          currentPeriodEnd: row.sub_period_end ?? "",
        };

  const grant: AdminBillingGrant | null =
    row.grant_plan === null
      ? null
      : {
          planId: row.grant_plan,
          kind: row.grant_kind ?? "comp",
          periodStart: row.grant_period_start ?? "",
          periodEnd: row.grant_period_end ?? "",
          reason: row.grant_reason ?? "",
          grantedBy: row.grant_granted_by ?? "",
          createdAt: row.grant_created_at ?? "",
        };

  // The row's own tier wins, then the account's paid subscription, then Free. A grant is not in
  // this chain on purpose: `relationship.plan` is what the comp wrote, and reporting the grant twice
  // would let a stale grant outrank a newer purchase.
  const paidSubscription = subscription !== null && subscription.status !== "canceled";
  const planId = row.relationship_plan ?? (paidSubscription ? subscription.planId : "free");
  const planSource: PlanSource =
    row.relationship_plan !== null
      ? "relationship"
      : paidSubscription
        ? "subscription"
        : row.initiator_user_id === null
          ? "none"
          : "free";

  return {
    relationshipId: row.relationship_id,
    templateTitle: row.template_title ?? row.relationship_id,
    initiatorUserId: row.initiator_user_id,
    initiatorName: row.initiator_name,
    planId,
    planSource,
    subscription,
    grant,
    activeRelationships: row.account_active_relationships,
  };
}

/** Every relationship, newest first, with its billing state. An empty database is an empty array. */
export async function readAdminBilling(): Promise<AdminBillingRow[]> {
  const rows = await queryRows<AdminBillingSqlRow>(ADMIN_BILLING_SQL, [ENTITLING_STATUSES]);
  return rows.map(rowOf);
}

/** The four counts the header draws, derived from the rows — never a second query. */
export interface AdminBillingCounts {
  readonly relationships: number;
  readonly paid: number;
  readonly live: number;
  readonly test: number;
  readonly granted: number;
  readonly blocked: number;
}

/**
 * The header's numbers, as a function of the rows.
 *
 * Pure, so the count line and the table are the same list — the defect `/admin/instances` records
 * for its filter. `blocked` is "the account is at or past its plan's limit", computed by the caller
 * because the limits are the fixture's (`entitlementForPlan`), not this module's.
 */
export function countsOf(
  rows: readonly AdminBillingRow[],
  limitFor: (planId: string) => number | null,
): AdminBillingCounts {
  let paid = 0;
  let live = 0;
  let test = 0;
  let granted = 0;
  let blocked = 0;
  for (const row of rows) {
    const subscription = row.subscription;
    if (subscription !== null && subscription.status !== "canceled") paid += 1;
    // Only a row that actually carries a subscription is a mode: a relationship nobody bought is
    // neither live nor test, and counting it as test would inflate the banner.
    if (subscription !== null) {
      if (subscription.livemode) live += 1;
      else test += 1;
    }
    if (row.grant !== null) granted += 1;
    const limit = limitFor(row.planId);
    if (limit !== null && row.activeRelationships >= limit) blocked += 1;
  }
  return { relationships: rows.length, paid, live, test, granted, blocked };
}
