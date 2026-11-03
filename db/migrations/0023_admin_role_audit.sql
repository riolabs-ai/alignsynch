-- 0023_admin_role_audit.sql — four roles, an invitation, and the log every admin write lands in
-- (#501, epic #500).
--
-- Three things, and they are one file because they are one decision: a ladder with no audit log is
-- a permission system nobody can review, an invitation with no ladder has no role to grant, and
-- the audit log's `action` vocabulary is the ladder's.
--
--   1. `user_profile.role` widens from two values (#183) to four, in rank order:
--      `member` < `support` < `admin` < `owner`. `lib/admin/roles.ts` is the ladder's only reader;
--      this file is its only storage.
--   2. `admin_invite` — an invitation is a row with a hashed token and an expiry, accepted into a
--      role. Never a silent elevation at sign-in (that is what `lib/auth/admin-allowlist.ts` does,
--      for the one address an operator puts in `ADMIN_EMAILS`, and it is not extended here).
--   3. `admin_action` — append-only, one row per write that went through `lib/admin/act.ts`.
--
-- Numbered 0023, not the 0024 the card's title guessed: `git ls-tree origin/main db/migrations/`
-- ended at `0022_user_profile_tour_seen.sql`, so 0023 is the next free number and a hole at 0023
-- would be a file `db:migrate` never applies.
--
-- **`neon_auth` is read once, and written never.** The owner backfill has to turn an address into
-- an auth user id, and `user_profile` carries no email — 0003 records why in full. So the read is
-- a `SELECT` inside a `DO` block that returns before it when the managed schema is absent (a
-- scratch database, a branch with auth disabled), and it is `EXECUTE`d so the statement is
-- planned only when its guard has already passed. No user is created, and an address with no
-- profile row promotes nobody: that is the card's "only if that row exists".
--
-- Idempotent on purpose, like 0001–0022: `db:migrate` ledgers each file and skips what it applied,
-- but a re-run of this file alone must still be a no-op.

/* ------------------------------------------------------------------ *
 * 1. The role ladder
 * ------------------------------------------------------------------ */

-- The old CHECK is dropped rather than added to: a constraint is the vocabulary, and the
-- vocabulary changed. `ADD COLUMN IF NOT EXISTS` (0004's shape) would skip a column that exists,
-- which is the wrong guard here — the column is not the thing being widened.
ALTER TABLE user_profile DROP CONSTRAINT IF EXISTS user_profile_role_vocabulary;
ALTER TABLE user_profile
  ADD CONSTRAINT user_profile_role_vocabulary
  CHECK (role IN ('member', 'support', 'admin', 'owner'));

-- **At most one owner, structurally.** The epic's invariant is "exactly one owner", and zero is the
-- honest state of a fresh database (nobody has signed in yet) — so the half SQL can hold is the
-- ceiling. A unique index over a constant expression is the idiom for "one row may satisfy this
-- predicate": the expression is the same for every row, so a second `owner` is a duplicate key.
--
-- A transfer is therefore two statements in one transaction — demote the outgoing owner, then
-- promote the incoming one — and not one `UPDATE` touching both rows, which Postgres would check
-- row by row against this index and refuse. That is a property a future card inherits from this
-- line, which is why it is said here rather than discovered there.
CREATE UNIQUE INDEX IF NOT EXISTS user_profile_one_owner
  ON user_profile ((true))
  WHERE role = 'owner';

-- The owner backfill: `alignsynch@riolabs.ai` becomes `owner` **if** the account and its profile
-- row both exist, and nothing happens otherwise.
--
-- `to_regclass` is the guard, not a courtesy: a scratch database created for a migration test has
-- no `neon_auth` at all, and a migration that failed there would make "applies cleanly on a fresh
-- database" false for the one environment that has no accounts. `EXECUTE … USING` keeps the table
-- name out of the planner's hands until the guard has passed.
DO $$
DECLARE
  owner_user_id TEXT;
BEGIN
  IF to_regclass('neon_auth."user"') IS NULL THEN
    RAISE NOTICE 'no neon_auth schema here — owner backfill skipped, no account can exist';
    RETURN;
  END IF;

  EXECUTE
    'SELECT u.id::text
       FROM neon_auth."user" u
       JOIN user_profile p ON p.user_id = u.id::text
      WHERE lower(u.email) = lower($1)
      LIMIT 1'
    INTO owner_user_id
    USING 'alignsynch@riolabs.ai';

  IF owner_user_id IS NULL THEN
    RAISE NOTICE 'alignsynch@riolabs.ai has no profile row — nothing to promote';
    RETURN;
  END IF;

  -- The index above refuses a second owner, so this also demotes nothing: a database that already
  -- has an owner keeps it, and the run says so instead of failing the migration.
  IF EXISTS (SELECT 1 FROM user_profile WHERE role = 'owner' AND user_id <> owner_user_id) THEN
    RAISE NOTICE 'an owner already exists — alignsynch@riolabs.ai left as it was';
    RETURN;
  END IF;

  UPDATE user_profile SET role = 'owner', updated_at = now() WHERE user_id = owner_user_id;
END
$$;

/* ------------------------------------------------------------------ *
 * 2. The invitation
 * ------------------------------------------------------------------ */

-- An invitation the app owns, and the two facts that make it safe:
--
--   token_hash    SHA-256 of the token, lowercase hex, and the only form ever stored
--                 (`lib/flow/tokens.ts` is the one minting/hashing module, reused rather than
--                 re-implemented — 0015's rule for `password_reset`, applied again).
--   expires_at    the link stops working then; `accepted_at` is what makes it single-use.
--
-- **`role` can never be `owner`.** The invitation grants a rung below the top one, so "exactly one
-- owner" cannot be undone by an invitation, and ownership moves only through `owner.transfer`.
-- The vocabulary is repeated in the CHECK rather than shared with `user_profile`'s: it is a
-- different set (`member` is here so an invitation can also be a plain onboarding), and a
-- constraint that read another table's constraint would not be a constraint.
--
-- **No unique index on `email`, on purpose.** Two admins inviting the same address at the same
-- time is not a conflict to resolve — both invitations are valid, both tokens work, and whichever
-- is accepted first grants the role while the other stays claimable until it expires. Enforcing
-- "one live invitation per address" would need a supersede rule, and there is no rule that says
-- which of two independent invitations is the real one.
CREATE TABLE IF NOT EXISTS admin_invite (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Lowercased by the write path (`lib/admin/invites.ts`), so the accept-time lookup is one
  -- equality and not a `lower()` on both sides.
  email       TEXT        NOT NULL CHECK (position('@' in email) > 1 AND length(email) <= 254),
  role        TEXT        NOT NULL CHECK (role IN ('member', 'support', 'admin')),
  token_hash  TEXT        NOT NULL UNIQUE,
  -- The account that sent it (a `user_profile.user_id`). Text, like every other auth id here.
  invited_by  TEXT        NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT admin_invite_expires_after_creation CHECK (expires_at > created_at),
  CONSTRAINT admin_invite_accepted_after_creation CHECK (
    accepted_at IS NULL OR accepted_at >= created_at
  )
);

-- The accept path looks up by token hash, which the UNIQUE constraint already indexes. This one is
-- for the other question the invitation screens ask: "what is still open for this address?"
CREATE INDEX IF NOT EXISTS admin_invite_email_open_idx
  ON admin_invite (email)
  WHERE accepted_at IS NULL;

/* ------------------------------------------------------------------ *
 * 3. The audit log
 * ------------------------------------------------------------------ */

-- One row per write that went through `lib/admin/act.ts`, written in the same transaction as the
-- write it describes — which is the whole point: a mutation that rolls back leaves no row here
-- either, so the log never claims something that did not happen.
--
-- **Append-only by convention, and by the absence of any UPDATE/DELETE here.** A log a writer can
-- edit is not evidence. Nothing in this tree deletes a row from this table; the retention question
-- (how long an audit row lives) is a later card's, and it will be a policy, not a quiet DELETE.
--
-- `before` / `after` are JSONB and nullable: a create has no before and a delete has no after, and
-- NULL says that honestly where `{}` would claim an empty row.
--
-- **No `gap` column, and nothing named like one** — `db:verify` V2 fails on the name, and this
-- table's subject is an action, not a measurement.
CREATE TABLE IF NOT EXISTS admin_action (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- `user_profile.user_id` of the person who acted. No FK: 0003's rule that the app does not
  -- constrain the managed auth schema is the same rule here, and an account deleted upstream must
  -- not delete the record of what it did.
  actor_user_id TEXT        NOT NULL,
  action        TEXT        NOT NULL CHECK (length(btrim(action)) > 0),
  target_table  TEXT        NOT NULL CHECK (length(btrim(target_table)) > 0),
  target_id     TEXT        NOT NULL CHECK (length(btrim(target_id)) > 0),
  -- The SQL twin of `lib/admin/act.ts::REASON_MIN_LENGTH`. Both exist: the function gives the
  -- operator a sentence before any statement runs, and this refuses a hand-written INSERT that
  -- skipped it. A reason of seven characters is not a reason.
  reason        TEXT        NOT NULL CHECK (length(btrim(reason)) >= 8),
  before        JSONB,
  after         JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The `/admin/audit` list is newest-first over the whole log, and that is the index's shape.
CREATE INDEX IF NOT EXISTS admin_action_created_idx
  ON admin_action (created_at DESC);

-- "What has this person done?" — the first filter an operator reaches for.
CREATE INDEX IF NOT EXISTS admin_action_actor_created_idx
  ON admin_action (actor_user_id, created_at DESC);

-- "What happened to this row?" — the question the log exists to answer after an incident, and the
-- one a sequential scan answers worst on a table that only grows.
CREATE INDEX IF NOT EXISTS admin_action_target_created_idx
  ON admin_action (target_table, target_id, created_at DESC);
