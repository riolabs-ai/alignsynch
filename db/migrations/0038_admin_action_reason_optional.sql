-- 0038_admin_action_reason_optional.sql — a reason is optional on every action (#732).
--
-- 0023 gave `admin_action.reason` two guards: `NOT NULL` and
-- `CHECK (length(btrim(reason)) >= 8)`. 0026 copied both onto `plan_grant.reason`, because a comp
-- is written to its own table beside the audit row. Both existed to make a required form field on
-- twelve screens impossible to skip, and the owner removed the field — *"remove all 'Reason' fields
-- as each one is a required field and doesn't serve a purpose"* — because a sentence typed to
-- satisfy a constraint is not provenance, it is a tax on the operator.
--
-- **The columns stay.** Every row already written carries a reason somebody typed, and that is
-- evidence of what they said they did. Dropping a column would erase it; instead both become
-- nullable, so `NULL` means exactly one thing: *nobody stated one*. A reader of `/admin/audit`
-- still lists an old row's reason, and a new row shows none — the two are distinguishable, which
-- is the whole point of nullable rather than a blank-string default.
--
-- **The CHECKs are dropped by their definition, not their name.** 0023 and 0026 wrote them inline
-- on the column, so the constraint names came from Postgres's own convention
-- (`admin_action_reason_check`) rather than from this repo — a migration that guesses a name is one
-- rename away from silently doing nothing. Reading the catalogue for a check that mentions
-- `btrim(reason)` is the version that cannot miss, and it is idempotent: a second run finds
-- nothing to drop.
--
-- Nothing here rewrites a row. The audit log is append-only and a grant is a fact; this migration
-- only changes what a *future* insert may say.

ALTER TABLE admin_action ALTER COLUMN reason DROP NOT NULL;
ALTER TABLE plan_grant ALTER COLUMN reason DROP NOT NULL;

DO $$
DECLARE
  target_table    TEXT;
  constraint_name TEXT;
BEGIN
  FOR target_table IN SELECT unnest(ARRAY['admin_action', 'plan_grant'])
  LOOP
    FOR constraint_name IN
      SELECT conname
        FROM pg_constraint
       WHERE conrelid = format('public.%I', target_table)::regclass
         AND contype = 'c'
         AND pg_get_constraintdef(oid) ILIKE '%btrim(reason)%'
         AND pg_get_constraintdef(oid) ILIKE '%>= 8%'
    LOOP
      EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', target_table, constraint_name);
      RAISE NOTICE '0038: dropped % from %', constraint_name, target_table;
    END LOOP;
  END LOOP;
END
$$;
