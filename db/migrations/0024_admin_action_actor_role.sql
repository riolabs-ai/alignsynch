-- 0024_admin_action_actor_role.sql — the rung the actor held **at the time** (#501b).
--
-- `/admin/audit`'s actor column reads "email · role at the time", and 0023's log stored only
-- `actor_user_id`. Reading the role from `user_profile` at render time would print *today's* rung
-- beside a write made last week — a promotion would silently rewrite history, which is the one
-- thing an append-only log must not do. So the rung travels with the row: `lib/admin/act.ts`
-- already holds it (it reads the profile `FOR SHARE` inside the same transaction, before the
-- mutation runs), and this column is the only place that fact survives a later demotion.
--
-- **Nullable, and NULL means "not recorded".** Every row written before this file has no rung to
-- recover: a backfill from today's `user_profile` would be a guess presented as evidence, so there
-- is none. The screen prints its own "not recorded" word for those rows instead of inventing one.
--
-- No UPDATE and no DELETE here, like the table it widens — the log is append-only in this file too.
-- Idempotent on purpose: `db:migrate` ledgers this file and skips it, but a re-run alone must be a
-- no-op.
ALTER TABLE admin_action ADD COLUMN IF NOT EXISTS actor_role TEXT;

-- The vocabulary is `content/identity.ts::USER_ROLES`, spelled here the way 0023 spells
-- `user_profile.role`'s: a constraint is a vocabulary, and a column that could hold "root" would be
-- a second ladder nobody reviews.
ALTER TABLE admin_action DROP CONSTRAINT IF EXISTS admin_action_actor_role_vocabulary;
ALTER TABLE admin_action
  ADD CONSTRAINT admin_action_actor_role_vocabulary
  CHECK (actor_role IS NULL OR actor_role IN ('member', 'support', 'admin', 'owner'));
