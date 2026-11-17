/**
 * The one free week — an Initiator's 7-day extension, once per account (#1121).
 *
 * #1121's owner decision has a server half as well as a screen half: *"One free 7-day extension,
 * usable once, on the Initiator's account"*, and the issue's own must-not list says the API may not
 * allow a second one either. A button that hides after the first click is a screen, not a rule, so
 * the claim lives here, inside `act()`'s transaction, and re-asks every fact the button was drawn
 * from.
 *
 * **What the claim writes, and why both halves.**
 *
 *   1. **The entitlement** — the account's `trialing` row's `current_period_end` moves to *now + 7
 *      days*. Anchored at the click rather than at the trial's old end on purpose: an extension
 *      taken five days into a pause would otherwise hand back two days, and the copy the member
 *      reads promises *7 More Days* and an end date. This is what makes Stage 6 run again on the
 *      very next read (`membershipOf()` asks the row, not a flag).
 *   2. **The grant** — one `plan_grant` row, `kind = 'extend'`, for the period `[now, now + 7)`.
 *      `plan_grant` already means *"a period granted to a relationship, separately auditable from a
 *      paid one"* (`0026_billing_control.sql`), and `extend` is already the word for *"push the same
 *      plan's period out"*. That row is also the **once-only marker**: the extension is used when
 *      `granted_by` is this account and `kind = 'extend'`, which is a fact about rows rather than a
 *      boolean somebody has to keep true. No column was added for it — `trial_extended_at` in the
 *      spec is this row's `created_at`, read.
 *
 * **Two locks, and the second one is the interesting one.** The relationship row is locked first
 * (the same `FOR UPDATE` every member write takes), and then the **account's trial subscription
 * row**. The second is what makes "once" true under a double click on *two different relationships*
 * of one account: both claims touch the same subscription row, so the second waits, reads the first
 * claim's grant, and refuses. Locking the relationship alone would serialize two clicks on one
 * screen and let two screens race.
 *
 * **It is not `extendTrial()`.** That operator override (`lib/admin/relationship-ops.ts`) is
 * `admin`-floored, takes an arbitrary day count up to 90, and pushes the *existing* end out — all
 * three of which are wrong for a self-serve free week. The two share the reactivation half and
 * nothing else, which is why this file is short and names that one explicitly.
 *
 * **What it deliberately does not do:** it never closes the relationship, never deletes an answer,
 * never takes a payment, never creates a subscription (an account with no trial row is refused with
 * `no-trial` — the card is the answer for that account), and never writes the Counterparty's
 * anything. The Counterparty is not this function's actor at all: `not-yours` is what they get.
 */
import { act, recordedReason, type ActResult, type ActTransactionRunner } from "@/lib/admin/act";
import type { AdminAction } from "@/lib/admin/roles";
import { TRIAL_PLAN_ID, trialEndsAt } from "@/lib/billing/trial";
import { MemberRefused } from "@/lib/member/publish-basis";
import { canTransition, type RelationshipStatus } from "@/lib/relationship/status";

/** The statuses a pause can be reached from: a relationship that ran a trial. */
const PAUSABLE_STATUSES: readonly RelationshipStatus[] = ["published", "active", "expired"];

/**
 * The audit reason a claim records when the member stated none.
 *
 * Long enough for `plan_grant.reason`'s eight-character floor, and a sentence rather than a code so
 * the grant list and the audit log both read as what happened.
 */
const CLAIM_REASON = "One free 7-day trial extension, claimed by the initiating account";

/** What `claimTrialExtension()` asks for. The actor is the session's, never a payload field. */
export interface TrialExtensionRequest {
  readonly actorUserId: string;
  readonly relationshipId: string;
  /** The member's own words, when they sent any. Never required, never invented. */
  readonly reason?: string;
  /** The click's instant. Injected so a test pins the window to the millisecond. */
  readonly now?: Date;
}

/** What the claim wrote — enough for the screen to say the end date without a second read. */
export interface ClaimedExtension {
  readonly relationshipId: string;
  /** The extra week's last instant, ISO-8601 — what *"your extra week ends <date>"* prints. */
  readonly endsAt: string;
  /** The status the relationship returned to when it had lapsed (`expired`), else `null`. */
  readonly resumed: "active" | null;
}

/**
 * Claim the free week on one paused relationship, or refuse with the code the screen has a sentence
 * for. Refusals, each its own dead end:
 *
 *   `not-yours`             the actor is not this relationship's Initiator
 *   `no-such-relationship`  no row holds the id
 *   `not-paused`            the relationship is closed, or live and still running
 *   `no-trial`              the account holds no `trialing` row to extend
 *   `extension-used`        this account has already taken its free week
 */
export async function claimTrialExtension(
  request: TrialExtensionRequest,
  runner?: ActTransactionRunner,
): Promise<ActResult<ClaimedExtension>> {
  const now = request.now ?? new Date();
  const endsAt = trialEndsAt(now);

  return act<ClaimedExtension>(
    {
      actorUserId: request.actorUserId,
      action: "relationship.claim-extension" satisfies AdminAction,
      target: { table: "relationship", id: request.relationshipId },
      reason: request.reason,
      mutate: async (sql) => {
        const locked = await sql.query<{
          id: string;
          status: string;
          initiator_user_id: string | null;
        }>(`SELECT id, status, initiator_user_id FROM relationship WHERE id = $1 FOR UPDATE`, [
          request.relationshipId,
        ]);
        const rel = locked.rows[0];
        if (rel === undefined) {
          throw new MemberRefused(
            "no-such-relationship",
            `no relationship holds the id "${request.relationshipId}"`,
          );
        }
        if (rel.initiator_user_id === null || rel.initiator_user_id !== request.actorUserId) {
          throw new MemberRefused(
            "not-yours",
            `relationship "${rel.id}" was started by another account — the free week is the initiating account's`,
          );
        }
        const status = rel.status as RelationshipStatus;
        if (!PAUSABLE_STATUSES.includes(status)) {
          throw new MemberRefused(
            "not-paused",
            `relationship "${rel.id}" is ${status}: only a relationship that has run a trial can take the free week`,
          );
        }

        /*
         * The account's trial row, locked. Ordering by `updated_at DESC` mirrors
         * `extendTrial()` — one live row per account is a partial unique index
         * (`billing_subscription_live_user_key`), so this is a read of one row, not a choice.
         */
        const found = await sql.query<{
          provider_subscription_id: string;
          current_period_end: Date;
        }>(
          `SELECT provider_subscription_id, current_period_end
             FROM billing_subscription
            WHERE user_id = $1 AND status = 'trialing'
            ORDER BY updated_at DESC
            LIMIT 1
            FOR UPDATE`,
          [request.actorUserId],
        );
        const trial = found.rows[0];
        if (trial === undefined) {
          throw new MemberRefused(
            "no-trial",
            `account "${request.actorUserId}" holds no running trial — a card is the way to resume this relationship`,
          );
        }
        if (new Date(trial.current_period_end).getTime() > now.getTime()) {
          throw new MemberRefused(
            "not-paused",
            `the trial on "${trial.provider_subscription_id}" runs until ${new Date(trial.current_period_end).toISOString()} — there is nothing paused to extend`,
          );
        }

        /*
         * The once-only check, after both locks, so a second claim reads the first one's row.
         * Scoped to the account (`granted_by`) rather than to the relationship: the trial is the
         * *account's* window, so a second paused relationship is the same free week, not a new one.
         */
        const claimed = await sql.query<{ id: string }>(
          `SELECT id::text AS id
             FROM plan_grant
            WHERE kind = 'extend' AND granted_by = $1
            LIMIT 1`,
          [request.actorUserId],
        );
        if (claimed.rows[0] !== undefined) {
          throw new MemberRefused(
            "extension-used",
            `account "${request.actorUserId}" has already taken its one free week — a card is the way to resume`,
          );
        }

        const moved = await sql.query<{ current_period_end: Date }>(
          `UPDATE billing_subscription
              SET current_period_end = $2,
                  updated_at = now()
            WHERE provider_subscription_id = $1
            RETURNING current_period_end`,
          [trial.provider_subscription_id, endsAt.toISOString()],
        );
        if (moved.rows[0] === undefined) {
          throw new MemberRefused("no-trial", "the extension wrote no subscription row");
        }

        // The grant: the period, why, and who. `period_start` is the claim's instant, which is also
        // what makes a replayed click land on the unique key rather than on a second row.
        await sql.query(
          `INSERT INTO plan_grant
             (relationship_id, plan_id, kind, period_start, period_end, reason, granted_by)
           VALUES ($1, $2, 'extend', $3, $4, $5, $6)`,
          [
            rel.id,
            TRIAL_PLAN_ID,
            now.toISOString(),
            endsAt.toISOString(),
            recordedReason(request.reason) ?? CLAIM_REASON,
            request.actorUserId,
          ],
        );

        /*
         * The reactivation half — the same `system` edge a payment takes, and only from `expired`.
         * A relationship that is still `published`/`active` needs no status write: the membership is
         * derived from the subscription, and that moved one statement ago.
         */
        let resumed: "active" | null = null;
        if (status === "expired") {
          if (!canTransition("expired", "active", "system")) {
            throw new MemberRefused(
              "not-paused",
              `relationship "${rel.id}" cannot return to active from expired`,
            );
          }
          const revived = await sql.query<{ id: string }>(
            `UPDATE relationship SET status = 'active' WHERE id = $1 AND status = 'expired' RETURNING id`,
            [rel.id],
          );
          if (revived.rows[0] === undefined) {
            throw new MemberRefused(
              "not-paused",
              `relationship "${rel.id}" left expired while this extension was running`,
            );
          }
          resumed = "active";
        }

        return {
          before: { status, periodEnd: new Date(trial.current_period_end).toISOString() },
          after: { relationshipId: rel.id, endsAt: endsAt.toISOString(), resumed },
        };
      },
    },
    runner,
  );
}
