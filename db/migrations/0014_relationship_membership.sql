-- 0014_relationship_membership.sql — a coach is a role on the relationship, not a party type.
--
-- #340 split the instance into a `relationship` (bought once, persists) and a `session` (one
-- assessment cycle of it). This file answers the question the split left open: *who may see*
-- the relationship. A party's `party.role` stays `initiator|counterparty` — that column is the
-- answering binding, and it does not change. Membership is the separate question, and it lives
-- here:
--
--   relationship_member   one row per (relationship, account). The role is `initiator`,
--                         `counterparty` or `coach`. The Initiator and Counterparty are
--                         backfilled from the party rows they already answer as; a coach is
--                         **never** auto-created — a coach is invited (see `coach_invite`).
--                         `party` keeps the answering bindings; membership is who may *see*.
--   coach_invite          the single-use, revocable invitation that turns an account into a
--                         coach member. It reuses `lib/flow/tokens.ts` (mint/hash/expiry) —
--                         there is no second token mechanism, only a second *row* for a
--                         different kind of claim.
--
-- **A membership requires an account, so a party without one is not backfilled.** `party.user_id`
-- is nullable (a seeded or signed-out party has no account, `0005_demo_account.sql` says why), and
-- a `relationship_member` row that carried NULL would name nobody. A relationship whose parties
-- never signed in therefore has no member rows and is reached the way it always was — by the
-- party's bearer token, not by membership. The membership invariant `db:verify` V19 checks is
-- exactly this fact: a relationship with members has exactly one initiator member; a
-- relationship with none is the signed-out state, not drift.
--
-- **The coach's boundary is enforced in code, not in this file.** Nothing here grants a read:
-- `requireRelationshipRole()` (`lib/flow/membership.ts`) is the one gate every read path goes
-- through, and `visibleRoles()` (`lib/flow/state.ts`) keeps the blind rule above the coach — a
-- coach sees a session's scores only once it is `complete`, exactly like a party would.
--
-- **A coach is not a billable seat.** `billing` never reads this table; the Initiator's purchase
-- is the only entitlement, and a coach member adds none.
--
-- Idempotent on purpose, like 0001–0013: `db:migrate` ledgers this file and skips it on a
-- re-run, and every statement below is guarded or convergent so a replay is a no-op.

-- The membership table. `role` is a CHECK over the three relationship roles — `initiator` and
-- `counterparty` mirror `party.role`, `coach` is the new one. The unique key makes "one account
-- holds one role on one relationship" structural, so two initiators or a party who is also their
-- own coach are unrepresentable rather than a rule somebody has to remember.
CREATE TABLE IF NOT EXISTS relationship_member (
  relationship_id TEXT        NOT NULL REFERENCES relationship (id) ON DELETE CASCADE,
  user_id         TEXT        NOT NULL,
  role            TEXT        NOT NULL CHECK (role IN ('initiator', 'counterparty', 'coach')),
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT relationship_member_key UNIQUE (relationship_id, user_id)
);

-- Backfill the two parties a relationship already has, from the rows they answer as. One row per
-- (relationship, account): the same account answering the same role across several sessions of
-- one relationship converges on one member row, and `ON CONFLICT DO NOTHING` keeps a re-run a
-- no-op. `joined_at` is the seat's `submitted_at` when it answered, else the session's own
-- `record.date`, else now — never "now, at migration time", the same honesty #340's backfill
-- used for `relationship.created_at`.
INSERT INTO relationship_member (relationship_id, user_id, role, joined_at)
SELECT s.relationship_id, p.user_id, p.role,
       COALESCE(p.submitted_at, r.date, now())
  FROM party p
  JOIN session s ON s.record_id = p.session_record_id
  JOIN record  r ON r.id = s.record_id
 WHERE p.user_id IS NOT NULL
   AND p.role IN ('initiator', 'counterparty')
 ON CONFLICT (relationship_id, user_id) DO NOTHING;

-- The coach invitation. A coach is invited exactly the way the Counterparty is: a token goes in
-- the link, the hash of it goes here (never the token — `lib/flow/tokens.ts` is the only mint and
-- the only hash). Single-use is `claimed_at`; revocable is `revoked_at`. `invited_by_user_id` is
-- the Initiator's account, so the invite is always tied to the seat that may send it.
CREATE TABLE IF NOT EXISTS coach_invite (
  relationship_id     TEXT        NOT NULL REFERENCES relationship (id) ON DELETE CASCADE,
  token_hash          TEXT        NOT NULL UNIQUE,
  email               TEXT        NOT NULL CHECK (position('@' in email) > 1),
  invited_by_user_id  TEXT        NOT NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at          TIMESTAMPTZ NOT NULL,
  claimed_at          TIMESTAMPTZ,
  revoked_at          TIMESTAMPTZ,
  CONSTRAINT coach_invite_expires_after_creation CHECK (expires_at > created_at),
  CONSTRAINT coach_invite_claimed_after_creation CHECK (claimed_at IS NULL OR claimed_at >= created_at),
  CONSTRAINT coach_invite_revoked_after_creation CHECK (revoked_at IS NULL OR revoked_at >= created_at)
);

-- One live invitation per relationship, the same shape `0010_invite_resend.sql` gives the
-- counterparty's invite: the initiating seat re-invites by overwriting the row, never by adding a
-- second one. A partial index lets a relationship with no coach invited yet hold no row at all.
CREATE UNIQUE INDEX IF NOT EXISTS coach_invite_relationship_key
  ON coach_invite (relationship_id)
  WHERE claimed_at IS NULL AND revoked_at IS NULL;
