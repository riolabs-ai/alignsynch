-- 0025_relationship_operations.sql — the three facts an operator's repair writes (#503, epic #500).
--
-- The console can act now. Four of the five operations in #503 reuse a column that already
-- exists (`party.unlock_seen_at`, `party.accepted_at`, `session_invite.token_hash` / `expires_at`),
-- and this file adds only what those columns cannot carry:
--
--   session.voided_at / voided_by           a session an operator ended, and who ended it
--   party.impersonated_by                   an acceptance an operator wrote on a party's behalf
--   session_invite.revoked_at / revoked_by  an invitation an operator killed, and who killed it
--
-- **Each one is a fact, not a state.** None of them is a status, a summary or a derived value:
-- `instanceStatusOf()` still derives the status from the counts plus `voided_at`, the invitation's
-- display state is still `inviteStateOf()` over its own columns, and the audit log
-- (`admin_action`, 0023) is still the only place a reason lives. Asking "why" is the audit row's
-- job; these columns answer "did it happen, and who".
--
-- **`voided_at` is terminal and is not a delete.** The report survives verbatim — no `opinion`,
-- `party` or `step` row is touched — because an operator voids a session so nobody can keep
-- answering it, not so the record of what the two people wrote disappears. `submitAnswers()` and
-- `acceptSession()` refuse on this column (`lib/flow/store.ts`), and `instanceStatusOf()` answers
-- `voided` before it looks at any count, which is what makes "a void cannot re-open" a property of
-- the derivation rather than of the two call sites.
--
-- **`impersonated_by` sits beside `accepted_at` on purpose.** The card's sentence is "the report
-- says an admin set it", so the fact has to be readable from the same row the report reads — not
-- reconstructed by joining `admin_action` and guessing which of two accepts an operator wrote. The
-- CHECK below makes an impersonation without an acceptance unrepresentable, and a party's own
-- acceptance keeps `impersonated_by = NULL`.
--
-- **`revoked_at` is the one new invitation column, and 0010 refused one.** That file's argument was
-- that "live, expired, claimed" is derivable from `claimed_at` and `expires_at`, so a `state`
-- column would be a second authored copy. Revocation is not derivable: it is a person deciding the
-- link must stop working *before* its expiry, which is exactly the class of fact `claimed_at` is —
-- an instant somebody acted. So it is stored as an instant, and `inviteStateOf()` reads it.
--
-- Idempotent on purpose, like 0001–0023: `db:migrate` ledgers a file and skips what it applied, and
-- a re-run of this file alone must still be a no-op.
--
-- **No `gap` column, nothing named like one.** `db:verify` V2 fails on the name and this table set
-- is the six-model mirror, not a measurement.

/* ------------------------------------------------------------------ *
 * 1. Voiding a session
 * ------------------------------------------------------------------ */

ALTER TABLE session ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ NULL;
-- `user_profile.user_id` of the operator who voided it. No FK, for 0023's reason: the app does not
-- constrain the managed auth schema, and an account deleted upstream must not delete the record.
ALTER TABLE session ADD COLUMN IF NOT EXISTS voided_by TEXT NULL;

-- Both or neither. An instant with no author is an unauditable void; an author with no instant is a
-- row that claims somebody voided something without saying when.
ALTER TABLE session DROP CONSTRAINT IF EXISTS session_voided_by_comes_with_instant;
ALTER TABLE session
  ADD CONSTRAINT session_voided_by_comes_with_instant CHECK (
    (voided_at IS NULL) = (voided_by IS NULL)
  );

/* ------------------------------------------------------------------ *
 * 2. Accepting on a party's behalf
 * ------------------------------------------------------------------ */

ALTER TABLE party ADD COLUMN IF NOT EXISTS impersonated_by TEXT NULL;

-- **An impersonation without an acceptance is not a state.** The operator's write sets both
-- columns in one statement (`lib/admin/relationship-ops.ts`); a row that names an operator and has
-- never been accepted would be a report claiming an admin set something that was never set.
ALTER TABLE party DROP CONSTRAINT IF EXISTS party_impersonation_needs_acceptance;
ALTER TABLE party
  ADD CONSTRAINT party_impersonation_needs_acceptance CHECK (
    impersonated_by IS NULL OR accepted_at IS NOT NULL
  );

/* ------------------------------------------------------------------ *
 * 3. Revoking an invitation
 * ------------------------------------------------------------------ */

ALTER TABLE session_invite ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ NULL;
ALTER TABLE session_invite ADD COLUMN IF NOT EXISTS revoked_by TEXT NULL;

ALTER TABLE session_invite DROP CONSTRAINT IF EXISTS invite_revoked_by_comes_with_instant;
ALTER TABLE session_invite
  ADD CONSTRAINT invite_revoked_by_comes_with_instant CHECK (
    (revoked_at IS NULL) = (revoked_by IS NULL)
  );

-- A revocation is an action taken on an invitation that existed when it was taken. `>=` and not
-- `>`: `created_at` and `revoked_at` may share an instant on a create-then-immediately-kill run.
ALTER TABLE session_invite DROP CONSTRAINT IF EXISTS invite_revoked_after_creation;
ALTER TABLE session_invite
  ADD CONSTRAINT invite_revoked_after_creation CHECK (
    revoked_at IS NULL OR revoked_at >= created_at
  );
