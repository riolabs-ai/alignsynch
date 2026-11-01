-- 0013_relationship_sessions.sql — a Relationship holds Sessions (#340).
--
-- The model changes shape without changing any fact a row already carries: #145's
-- `assessment_instance` did two jobs at once — the relationship two people share, and one
-- assessment cycle of it — and this file splits them into two tables.
--
--   relationship   the thing bought once by the Initiator: the template it was created from,
--                  the two accounts that own it, when it was bought. It persists.
--   session        one assessment cycle of a relationship: the copy of the Aspects, the mode,
--                  the Setting, the answers. Immutable once scored.
--
-- The split is a rename, not a rewrite: `assessment_instance` becomes `session` and gains
-- `relationship_id`, and every other database object that carried the old noun follows —
-- the FK columns `instance_record_id` → `session_record_id`, the invitation table
-- `instance_invite` → `session_invite`, and the `party_instance_user_key` index → `session`
-- name. Nothing is dropped and no row is invented: one `relationship` is backfilled per
-- existing instance, reusing that instance's template and its parties' account bindings.
--
-- **`initiator_user_id` and `purchased_at` are nullable, deliberately.** The card's column list
-- marks only `plan` and `counterparty_user_id` nullable, but a backfill cannot invent an
-- account or a purchase: a pre-#340 relationship whose Initiator created it signed out — or a
-- seeded one whose parties have no account (`0005_demo_account.sql` makes `party.user_id`
-- nullable for exactly that reason) — has no initiator account, and nothing before #340 recorded
-- a purchase instant. NULL is the honest value for both, the same rule `party.user_id` follows;
-- a relationship created through the product from now on always carries its Initiator and its
-- purchase instant. `created_at` is backfilled from the instance's own `record.date`, so the
-- relationship reads as old as the rows it was split from, never as "now, at migration time".
--
-- **The counterparty is still a `party.role`, unchanged.** A coach is a role on the relationship
-- (a separate card), not a third `party.role` value, so `role` stays `initiator|counterparty`.
--
-- No `gap` column, no `instance` left in a table or column name: the Gap is `gapOf()` over two
-- scores, and the old noun is gone the moment this file commits.
--
-- Idempotent on purpose, like 0001–0012: `db:migrate` ledgers each file and skips what it
-- applied. Every ADD is guarded by `IF NOT EXISTS`; the renames are the one thing that flag
-- cannot express, so each is wrapped in a DO block that checks the old name first. The backfill
-- reads `assessment_instance` by its pre-rename name, which is exactly the schema 0001–0012
-- leave this file; the ledger is what guarantees this file runs once, before that name is gone.

-- The relationship. `template_id` is the template it was created from; `initiator_user_id` and
-- `counterparty_user_id` are Neon Auth ids (text, like `party.user_id`); `plan` is the tier
-- bought, free text until a plan vocabulary owns it; `purchased_at` is when it was bought.
CREATE TABLE IF NOT EXISTS relationship (
  id                  TEXT        PRIMARY KEY,
  template_id         TEXT        NOT NULL REFERENCES record (id),
  initiator_user_id   TEXT,
  purchased_at        TIMESTAMPTZ,
  plan                TEXT,
  counterparty_user_id TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The split. Added nullable first so the backfill can fill it, then pinned NOT NULL once every
-- existing row has one.
ALTER TABLE assessment_instance ADD COLUMN IF NOT EXISTS relationship_id TEXT;

-- Backfill, before the rename: one relationship per existing instance, reusing the instance's
-- template and its parties' account bindings. The id is deterministic (`relationship-<record_id>`)
-- so a re-run converges on the same row, and `ON CONFLICT DO NOTHING` keeps it a no-op.
INSERT INTO relationship
  (id, template_id, initiator_user_id, counterparty_user_id, purchased_at, plan, created_at)
SELECT 'relationship-' || ai.record_id,
       ai.template_record_id,
       init.user_id,
       cp.user_id,
       NULL,
       NULL,
       r.date
  FROM assessment_instance ai
  JOIN record r ON r.id = ai.record_id
  LEFT JOIN party init ON init.instance_record_id = ai.record_id AND init.role = 'initiator'
  LEFT JOIN party cp    ON cp.instance_record_id    = ai.record_id AND cp.role    = 'counterparty'
  ON CONFLICT (id) DO NOTHING;

-- Point every instance at the relationship the backfill just created. `WHERE relationship_id IS
-- NULL` makes it idempotent: a row that already has one is left alone.
UPDATE assessment_instance ai
   SET relationship_id = 'relationship-' || ai.record_id
 WHERE ai.relationship_id IS NULL;

-- The table rename. Postgres re-points every FK and index at `session` automatically.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema = 'public' AND table_name = 'assessment_instance') THEN
    ALTER TABLE assessment_instance RENAME TO session;
  END IF;
END $$;

-- The invitation table follows the noun. (The invitation stays a session-scoped row — one per
-- assessment cycle — until the coach card restructures the claim; this card only renames it.)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
              WHERE table_schema = 'public' AND table_name = 'instance_invite') THEN
    ALTER TABLE instance_invite RENAME TO session_invite;
  END IF;
END $$;

-- The FK columns. Each rename is guarded so a re-run (where the old name is gone) is a no-op;
-- Postgres follows the rename through every FK and index that names the column.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'party'
                AND column_name = 'instance_record_id') THEN
    ALTER TABLE party RENAME COLUMN instance_record_id TO session_record_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'opinion'
                AND column_name = 'instance_record_id') THEN
    ALTER TABLE opinion RENAME COLUMN instance_record_id TO session_record_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'session_invite'
                AND column_name = 'instance_record_id') THEN
    ALTER TABLE session_invite RENAME COLUMN instance_record_id TO session_record_id;
  END IF;
END $$;

-- The one index that named the old noun (`0005_demo_account.sql`). Referenced only in comments
-- today, so this is a name-only rename for the same "no database object carries the noun" rule.
-- `IF EXISTS` makes a re-run a no-op once the old name is gone.
ALTER INDEX IF EXISTS party_instance_user_key RENAME TO party_session_user_key;

-- Now that the backfill has given every row one, the column is the model's NOT NULL, and the FK
-- is added beside it. Named `session_relationship_id_fkey` so the finished schema carries no
-- `instance` in a constraint name either.
ALTER TABLE session ALTER COLUMN relationship_id SET NOT NULL;
ALTER TABLE session DROP CONSTRAINT IF EXISTS session_relationship_id_fkey;
ALTER TABLE session
  ADD CONSTRAINT session_relationship_id_fkey
  FOREIGN KEY (relationship_id) REFERENCES relationship (id);
