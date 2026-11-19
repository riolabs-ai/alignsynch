-- 0043_stakeholder_role.sql — the storage half of #1252: `stakeholder` is a rung the database refuses.
--
-- `0043`, not `0042`: the number names one step and #1249 exists because two files shared one.
--
-- **Why this file exists.** `content/role-ladder.ts::USER_ROLES` is
-- `("member", "stakeholder", "support", "admin", "owner")` (#1254) and `stakeholder` sits *under*
-- `support` — the one seat the project spec is open to and the support inbox is not. The type
-- system, the rail and the `requireRole` gate all admit it; the column does not, because
-- `0023_admin_role_audit.sql` wrote the vocabulary it had:
--
--   CHECK (role IN ('member', 'support', 'admin', 'owner'))
--
-- So a row for a stakeholder is refused by Postgres (`23514`) at the moment the code has already
-- decided they are one — the worst place for two vocabularies to disagree, because the app's answer
-- is the code's and the database's answer is a 500.
--
-- **Why a dropped-and-re-added CHECK, not a second one.** A constraint is the vocabulary, and the
-- vocabulary changed. `DROP … IF EXISTS` then `ADD` is the shape `0023` already uses for this exact
-- constraint, and it is idempotent: the file can be run twice without a `42710`. No column is
-- dropped and no row is touched — widening a CHECK admits values, it never rewrites one, so this
-- migration has no data statement and needs none.
--
-- **The name is the one that exists, not the one we expected.** The definition found on `demo`
-- before this file was written (`pg_get_constraintdef`) was
-- `CHECK (role = ANY (ARRAY['member'::text, 'support'::text, 'admin'::text, 'owner'::text]))`
-- under `user_profile_role_vocabulary`; that is the name dropped below, and the same name is
-- re-added so the constraint keeps one identity across the change.
--
-- **What this file must not do.** It does not touch `user_profile_one_owner` (the unique index that
-- holds "at most one owner", `0023` line 51), any other `user_profile` constraint, or any other
-- table: `stakeholder` is a vocabulary widening and nothing else. `content/role-ladder.ts` and
-- `lib/admin/roles.ts` landed in #1254 and are not this card's business.

ALTER TABLE user_profile DROP CONSTRAINT IF EXISTS user_profile_role_vocabulary;
ALTER TABLE user_profile
  ADD CONSTRAINT user_profile_role_vocabulary
  CHECK (role IN ('member', 'stakeholder', 'support', 'admin', 'owner'));
