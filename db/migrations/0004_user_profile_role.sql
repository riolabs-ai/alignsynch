-- 0004_user_profile_role.sql — the one authorization fact (#183, part 1 of 2).
--
-- `member | admin`, default `member`. That is the whole model: one boolean with a name, not a
-- permission system. There is no rank order (a role is compared for equality), no per-resource
-- grant, and no capability list — a surface either asks `lib/auth/require-role.ts` for `admin`
-- or it does not ask at all.
--
-- Why a column and not a table: a role is one value on one person, and `user_profile` already
-- holds exactly one row per auth user id. A `user_role` join table would be the same fact with
-- a second place to disagree with it.
--
-- `NOT NULL DEFAULT 'member'` is the reason this migration needs no backfill and no nullable
-- window: every existing row becomes a member the instant the column exists, which is what
-- every existing row *is* — nothing in the tree before #183 created an admin, so no row can
-- mean anything else. `DEFAULT` is load-bearing twice over: the column default here, and
-- `writeUserProfile`'s INSERT naming no role at all (a settings save can neither promote nor
-- demote — the value a person can write is never a value that decides what they may reach).
--
-- The CHECK is the enum. Postgres' own `CREATE TYPE` would be a second object to migrate and
-- to drop; a text column with a named constraint is the same guarantee minus the baggage, and
-- it is the shape `0001` already uses for `party.role`.
--
-- Idempotent on purpose, like 0001–0003: `db:migrate` ledgers each file and skips what it
-- applied, but a re-run of this file alone must still be a no-op.

ALTER TABLE user_profile
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member';

-- The CHECK is added separately and guarded by the catalogue, because `ADD COLUMN IF NOT
-- EXISTS` would silently skip a column that exists without its constraint.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'user_profile_role_vocabulary'
  ) THEN
    ALTER TABLE user_profile
      ADD CONSTRAINT user_profile_role_vocabulary CHECK (role IN ('member', 'admin'));
  END IF;
END
$$;

-- No index. `role` is read for the one user whose session is asking, and that read is already
-- `user_profile`'s primary key (`user_id`). "List every admin" is not a query this app makes,
-- and an index would be a second structure maintained for a read nobody performs.
