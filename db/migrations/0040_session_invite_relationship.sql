-- 0040_session_invite_relationship.sql — an invitation names its relationship, not only its session
-- (#1100a).
--
-- Today an invitation cannot exist without a session: `session_invite`'s primary key **is**
-- `session_record_id`, and 0013 only renamed `instance_invite.instance_record_id` into that name.
-- The behaviour card behind #1100 stops the create from writing a session at Stage 5 (Details),
-- because a `draft` relationship has nothing to score yet — so the invitation has to be able to
-- point at the relationship on its own. This file adds the column that makes that possible and
-- fills it for every row that already exists. It changes no behaviour: nothing reads the column
-- yet, and both writers keep writing exactly what they wrote before.
--
--   session_invite.relationship_id   the relationship this invitation belongs to, cascading with it.
--
-- **The column is NULLABLE in this file, deliberately, and that is the one place this file does
-- not do what the card's step 1 asked. Measured, not assumed:** both writers of the table list
-- their columns explicitly and neither writes the new one —
-- `lib/flow/store.ts::createInstanceFromTemplate` (`INSERT INTO session_invite (session_record_id,
-- email, counterparty_name, token_hash, created_at, expires_at, initiator_email)`) and
-- `lib/member/relationships.ts` (the next-round create, same shape). A `NOT NULL` here would make
-- those two INSERTs fail at runtime on the very next invitation, while `typecheck`, `lint`,
-- `data:check` and `next build` all stay green — the gate never opens a connection, so nothing
-- would catch it before a person did. The card's own MUST NOT forbids adding "a constraint that
-- the current writer would violate at runtime", and its opening promise is that *the old writer
-- keeps working*. Those two sentences cannot both hold with a `NOT NULL` in this file, so this
-- file keeps the promise and defers the pin.
--
-- **The pin is the behaviour card's, in one line, once the writers carry the column:**
--
--   ALTER TABLE session_invite ALTER COLUMN relationship_id SET NOT NULL;
--
-- Flipping `session_record_id` to nullable is the same card's job and needs more than an ALTER:
-- it is the table's PRIMARY KEY today (`instance_invite_pkey`, still carrying the old noun in its
-- name), so the row identity has to move to a new key — `relationship_id` plus the session when
-- there is one — before the FK to a session may be dropped. Nothing in this file touches it. The
-- file only records the split so the next reader does not find a nullable column beside a card
-- that asked for `NOT NULL` and guess that the job was left half-done.
--
-- **The backfill cannot invent a relationship, and does not need to.** Every row already points at
-- a session (`session_record_id` is the primary key and a foreign key), and every session carries
-- `relationship_id` as `NOT NULL` since 0013 (#340), so the join below fills every row or fills
-- none. The `DO` block that follows the UPDATE proves it on the rows rather than trusting the
-- reasoning: it raises a **named** error listing the first offenders, so a database this file
-- cannot fill fails loudly, with the rows to look at, instead of on the next statement with a
-- message that names nothing.
--
-- No `gap` column, no `instance` in the object's new names: the index this file adds is
-- `session_invite_relationship_idx`, and the Gap stays `gapOf()` over two scores.
--
-- Idempotent on purpose, like 0001–0039: `db:migrate` ledgers this file and skips what it applied,
-- and a re-run of the file alone is still a no-op — the column is added `IF NOT EXISTS`, the
-- backfill only touches rows that are still NULL, and the index is created `IF NOT EXISTS`.

ALTER TABLE session_invite
  ADD COLUMN IF NOT EXISTS relationship_id TEXT
    REFERENCES relationship (id) ON DELETE CASCADE;

-- Fill from the session the invitation already points at. `WHERE si.relationship_id IS NULL` makes
-- a re-run a no-op and leaves a row that has somehow already been given a relationship alone.
UPDATE session_invite si
   SET relationship_id = s.relationship_id
  FROM session s
 WHERE s.record_id = si.session_record_id
   AND si.relationship_id IS NULL;

-- Louder than the `SET NOT NULL` this card set out to write here: that statement fails on the
-- first NULL with `column contains null values`, naming no row, no table and no fix. This one
-- names the table, the count and the ids.
DO $$
DECLARE
  unfilled   INT;
  offenders  TEXT;
BEGIN
  SELECT count(*) INTO unfilled FROM session_invite WHERE relationship_id IS NULL;
  IF unfilled > 0 THEN
    SELECT string_agg(session_record_id, ', ') INTO offenders
      FROM (SELECT session_record_id FROM session_invite
             WHERE relationship_id IS NULL ORDER BY session_record_id LIMIT 5) AS sample;
    RAISE EXCEPTION
      '0040: % session_invite row(s) carry no relationship_id and the session they point at has none to copy (first: %). Every invitation belongs to a relationship; repair the row before migrating.',
      unfilled, offenders;
  END IF;
END $$;

-- The read the behaviour card will make: "the invitations of this relationship", without a join
-- through `session` for the rows that have no session yet.
CREATE INDEX IF NOT EXISTS session_invite_relationship_idx
  ON session_invite (relationship_id);
