-- 0031_session_round.sql — a relationship is assessed in rounds (#533 phase 1).
--
-- #533's billing unit is the **relationship**, and its work unit is the **session**: a relationship
-- stays `active` while it is paid, and each assessment round is a `session` with its own copy of the
-- Aspects, its own answers and its own Gap. Before this file a relationship could hold any number of
-- sessions and nothing said which one was which — 0013 split the two tables but left the sessions in
-- no order, so "the second round" was whatever `ORDER BY` a reader happened to write.
--
--   session.round   the ordinal of this session inside its relationship: 1 is the first round.
--
-- **Why a number and not a timestamp.** "Round 2" is what both people call it, and a timestamp
-- cannot be compared without reading two rows: the report says "Round 2 of 3", the second round is
-- the one after the first, and the next round is `max(round) + 1`. A `started_at` would answer a
-- different question (when) and leave this one to a window function at every read.
--
-- **`UNIQUE (relationship_id, round)` is the rule, structurally.** Two sessions cannot both be
-- round 2 of one relationship, so "the round" is a key read and a retry that raced another round's
-- creation is refused by the database instead of producing two round 2s that the report would
-- silently sum. The uniqueness is a `UNIQUE INDEX` and not a table constraint only so this file can
-- drop it before the backfill and recreate it after — a re-run then renumbers deterministically
-- instead of colliding with its own previous numbering.
--
-- **The backfill numbers the sessions that already exist, densely, in creation order.** The card
-- says "every session gets `round = 1`", which is the true answer for every relationship that has
-- one session — and the whole demo and production-shaped set today. It is not the true answer for a
-- relationship that already holds two, and `round = 1` for both would fail the unique index this
-- same file creates (the honest outcome: a migration that refused to invent a collision, and a
-- half-applied file, which `db:migrate` rolls back). So the numbering is `row_number()` per
-- relationship ordered by the session's own record date — deterministic, dense, starting at 1 — and
-- it is exactly "1" wherever a relationship holds one session. `record.date` is the instant a
-- session carries; `record_id` breaks a tie so two sessions authored on one day still number
-- stably.
--
-- No `gap` column, nothing named like one: the Gap stays `gapOf()` over two scores, and a round
-- changes which pair of scores it is computed over, never how.
--
-- Idempotent on purpose, like 0001–0030: `db:migrate` ledgers this file and skips what it applied,
-- and a re-run of this file alone must still be a no-op.

ALTER TABLE session ADD COLUMN IF NOT EXISTS round INT NOT NULL DEFAULT 1;
ALTER TABLE session ALTER COLUMN round SET NOT NULL;
ALTER TABLE session ALTER COLUMN round SET DEFAULT 1;

-- A round is a positive ordinal. `0` or a negative number is not "before the first round"; it is a
-- row the report would print as "Round 0".
ALTER TABLE session DROP CONSTRAINT IF EXISTS session_round_positive;
ALTER TABLE session ADD CONSTRAINT session_round_positive CHECK (round >= 1);

-- Number what is already there. The index is dropped first so a replay renumbers without tripping
-- over the numbering it wrote last time, and recreated immediately after.
DROP INDEX IF EXISTS session_relationship_round_key;

WITH numbered AS (
  SELECT s.record_id,
         row_number() OVER (
           PARTITION BY s.relationship_id
           ORDER BY r.date, s.record_id
         ) AS round
    FROM session s
    JOIN record r ON r.id = s.record_id
)
UPDATE session s
   SET round = numbered.round
  FROM numbered
 WHERE s.record_id = numbered.record_id
   AND s.round <> numbered.round;

CREATE UNIQUE INDEX IF NOT EXISTS session_relationship_round_key
  ON session (relationship_id, round);
