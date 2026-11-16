-- 0041_session_state.sql — a draft session is not a live session (#1100b).
--
-- The owner's ruling (2026-11-15): the session row keeps existing from the Initiator's commit —
-- it is where `mode`, `alignment_setting`, `aspects_authored_at` and the Initiator's `party` row
-- already live — but it carries a **state**, and nothing in the product counts or shows a session
-- until both parties have joined it.
--
--   session.state   `draft` while the relationship has no Counterparty seat; `active` once it does.
--
-- **Why the row stays and the state is added, instead of the row appearing at acceptance.** The
-- alternative — "write no session at commit" — has no home for four facts the create must write:
-- the stage-2 `mode` and `alignment_setting` (on `session` only; the create cookie holding them is
-- deleted at commit), `aspects_authored_at` (#699), and the Initiator's own seat
-- (`party.session_record_id` is a `NOT NULL` FK to `session`, and the invitation's
-- `session_invite.session_record_id` **is** its primary key). Moving those off the session is a
-- key move and a second model, for no product gain. A state column buys the same invisibility
-- with one column and one flip.
--
-- **The two values are the two facts the product has, not a lifecycle.** `draft` is "the
-- Counterparty has not joined"; `active` is "they have". Everything a person reads about progress
-- (`instanceStatusOf`, #146) stays derived from rows — this column never becomes a second status.
-- A voided, lapsed or completed relationship still carries `active`: its session is a live
-- session that ended, and `voided_at` / `relationship.status` are what say so.
--
-- **Who writes it.** `lib/flow/store.ts::createInstanceFromTemplate` writes `draft` in the same
-- INSERT that writes the session; `claimInvite` flips it to `active` in the transaction that binds
-- the Counterparty's seat, so "accepted but still draft" cannot exist; the next-round create in
-- `lib/member/relationships.ts` writes `active`, because a round opened on an accepted
-- relationship is live from its first row. `scripts/db-seed.mjs` writes it from the dataset's own
-- lifecycle (`seats: "both"` is `active`). V33 (`scripts/db-verify.mjs`) is the check that holds
-- the three writers to the one rule.
--
-- **The default is `active`, and it is the honest answer for every row that exists.** A row
-- written before this file was written by a create that opened a session for a pair — the claim
-- was the only path that made a relationship live, and the seeded ones carry both seats. The
-- backfill below then corrects the exception: the sessions whose relationship has no Counterparty
-- seat at all are `draft`, which on a seeded branch is exactly the `draft` and `pending`
-- lifecycle rows.
--
-- **The acceptance test is the seat, not `relationship.counterparty_user_id`.** That column has no
-- writer in the product — `claimInvite` binds `party.user_id`, and only the seed and the
-- account-purge path touch the relationship's mirror (measured: `grep -rn counterparty_user_id
-- lib scripts`). Keying the backfill on it would mark a live relationship `draft` the first time
-- somebody claimed an invitation signed out. So the rule reads the row the claim actually writes:
-- a Counterparty `party` row exists.
--
-- Additive on purpose: one column, one CHECK, one backfill, no index (nothing reads `state` as a
-- lookup key: every reader adds it to a predicate it already has). Reversible with
-- `ALTER TABLE session DROP COLUMN state;` — nothing this file writes is a fact the rows did not
-- already carry.
--
-- Idempotent on purpose, like 0001–0040: `db:migrate` ledgers this file and skips what it applied,
-- and a re-run of the file alone is still a no-op — the column is added `IF NOT EXISTS`, the
-- constraint is added only when it is absent, and the backfill only moves `active` rows that the
-- seat rule says are `draft`.

ALTER TABLE session ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT 'active';

-- The vocabulary is two words because the product has two facts. Written as a named constraint so
-- a hand-written row that invents a third word (`started`, `open`, `live`) fails at the write
-- instead of being read as "not draft" by every predicate below.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'session'::regclass
       AND conname = 'session_state_check'
  ) THEN
    ALTER TABLE session
      ADD CONSTRAINT session_state_check CHECK (state IN ('draft', 'active'));
  END IF;
END $$;

-- The correction. `NOT EXISTS` on the Counterparty seat is the whole rule; the `state <> 'draft'`
-- guard keeps a re-run from rewriting rows it has already corrected (a no-op, in the ledger sense
-- and in the row sense).
UPDATE session s
   SET state = 'draft'
 WHERE s.state <> 'draft'
   AND NOT EXISTS (
     SELECT 1
       FROM party p
      WHERE p.session_record_id = s.record_id
        AND p.role = 'counterparty'
   );

-- The census this file leaves behind, printed by `db:verify` (V33) rather than here: a migration
-- that writes rows should say what it did on the rows, and `db:migrate` prints only the file it
-- applied. V33's line names the draft count as the product's "invited but not started" number.
