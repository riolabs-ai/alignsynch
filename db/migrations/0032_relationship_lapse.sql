-- 0032_relationship_lapse.sql — a lapsed relationship records when, and why (#533 phase 3).
--
-- Phase 1 gave `relationship` the seven-word lifecycle and three instants (`published_at`,
-- `completed_at`, `void_reason`). Phase 3 is the enforcement half, and it needs two facts those
-- columns cannot carry:
--
--   expired_at      **when** the membership stopped paying for this relationship. The trial's own
--                   `billing_subscription.current_period_end` answers "when would it have ended",
--                   but it moves on every renewal and it is the *account's* instant, not this
--                   relationship's. A lapse can also happen for a reason the subscription row
--                   alone does not date (a cancellation mid-period ends the entitlement at the
--                   period end, but the *decision* is the instant the row was flipped). The
--                   sentence both parties read — "the initiator's membership ended on <instant>" —
--                   has to be a stored instant, not a value re-derived differently by each reader.
--   lapse_reason    **why**, out of three words: `trial-ended`, `payment-failed`,
--                   `subscription-canceled`. `expired` alone cannot say which, and the three are
--                   different news: "the 14 days ran out" asks the reader to subscribe, "the
--                   subscription was cancelled" asks whoever cancelled it. The column is TEXT with
--                   a CHECK rather than an enum so a fourth reason is a one-line migration, and the
--                   pure vocabulary lives in `lib/relationship/membership.ts::LAPSE_REASONS` with a
--                   test asserting this CHECK agrees with it.
--
-- **Why `expired` stopped being terminal, recorded where a reader of the schema will find it.**
-- Phase 1's transition table put `expired` beside `complete` and `void` as having no outgoing edge.
-- #533 phase 3 requires `expired → active` when a payment lands, because a lapse is *unpaid* rather
-- than *decided*: the owner did not close the relationship, the money ran out. The edges live in
-- `lib/relationship/status.ts` (a CHECK cannot express "only the system may reactivate"), and this
-- file adds the two columns that make the revival recordable — without `expired_at` a reactivated
-- relationship could not say when it had lapsed, and without `lapse_reason` it could not say why.
--
-- **`expired_at` is history and is deliberately not cleared on reactivation.** It is the last
-- instant this relationship stopped being paid for. The relationship's *current* state is
-- `status`; a reader that wants "is it lapsed right now" asks `status = 'expired'`, and the
-- reactivation edge is what changes that. Clearing the column would erase the only record of a gap
-- that already happened, and `admin_action` (which records the reactivation) is not a column a
-- party-facing read may join.
--
-- **No `expired_from` column.** The status a lapsed relationship returns to is derived from the
-- `party` rows — a bound counterparty means `active`, no counterparty means `published` — and a
-- stored copy of that would be a second truth `claimInvite` already maintains (`party` is where a
-- seat lives, `0016`). `reactivationStatusOf()` is the one-line function.
--
-- No `gap` column, nothing named like one: the Gap stays `gapOf()` over two scores.
--
-- Idempotent on purpose, like 0001–0031: `db:migrate` ledgers this file and skips what it applied,
-- and a re-run of this file alone must still be a no-op.

ALTER TABLE relationship ADD COLUMN IF NOT EXISTS expired_at TIMESTAMPTZ NULL;
ALTER TABLE relationship ADD COLUMN IF NOT EXISTS lapse_reason TEXT NULL;

ALTER TABLE relationship DROP CONSTRAINT IF EXISTS relationship_lapse_reason_vocabulary;
ALTER TABLE relationship
  ADD CONSTRAINT relationship_lapse_reason_vocabulary CHECK (
    lapse_reason IS NULL
    OR lapse_reason IN ('trial-ended', 'payment-failed', 'subscription-canceled')
  );

-- A lapse cannot predate the relationship, and a reason with no instant is a half-written row:
-- the pair is written in one statement (`lib/relationship/enforcement.ts`), so a row that carries
-- one and not the other is drift a reader cannot interpret. `expired_at` without a reason is
-- allowed — a handler that knew the membership ended but not which event caused it should say so
-- rather than invent `payment-failed`.
ALTER TABLE relationship DROP CONSTRAINT IF EXISTS relationship_lapsed_pair;
ALTER TABLE relationship
  ADD CONSTRAINT relationship_lapsed_pair CHECK (
    (lapse_reason IS NULL)
    OR (expired_at IS NOT NULL AND expired_at >= created_at)
  );

-- "Which of this account's relationships are lapsed" is asked on every payment event, for every
-- relationship the account initiated. The composite index 0030 added is `(initiator_user_id,
-- status)` and already answers it; nothing further is needed here.
