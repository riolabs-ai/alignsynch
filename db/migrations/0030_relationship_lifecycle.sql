-- 0030_relationship_lifecycle.sql — a relationship has a lifecycle (#533 phase 1).
--
-- #533's shape is `draft → pending → published → active → complete`, plus the two terminal
-- outcomes `void` and `expired`. Until now the lifecycle was implicit: a relationship existed or
-- it did not, and #340's session status (`lib/flow/state.ts::instanceStatusOf`) described the
-- *assessment cycle*, not the subscription it runs under. This file stores the one fact no row
-- could previously carry — which of the seven states the relationship itself is in — and the three
-- instants a reader needs beside it:
--
--   status          the seven words, closed by a CHECK. `draft` is the creation default: a
--                   relationship nobody has confirmed yet is not published, and a default of
--                   `published` would put a half-configured relationship in a counterparty's inbox.
--                   The transition table (which status may move to which, and which actor may make
--                   that move) is **not** in SQL: it is `lib/relationship/status.ts`, as pure data,
--                   so it is testable without a database and reviewable in one screen. A CHECK can
--                   express a vocabulary; it cannot express "the counterparty may not publish".
--   published_at    when the invite went out and the initiator's own session opened. Distinct from
--                   `created_at`: a relationship is created when the initiator saves a draft and
--                   published when they commit to it, and the trial (14 days, #533) starts at the
--                   second, not the first.
--   completed_at    when the subscription finished. `complete` describes the **subscription**, not
--                   the work: a relationship may carry several assessment rounds, and this stays
--                   NULL while any of them can still run.
--   void_reason     why an operator ended it (support's force-close, #503's repair path). Text and
--                   not an enum, because the reason is a sentence a person wrote; the audit row in
--                   `admin_action` names who wrote it.
--
-- **`status` is a stored fact here, and that is not the usual rule in this schema.** `session`'s
-- status is derived (`instanceStatusOf`), the invitation's state is derived (`inviteStateOf`), and
-- the Gap is a function — each because the rows already implied it. A relationship's lifecycle is
-- the exception: `draft` and `pending` differ by nothing but a person's intent, `published` and
-- `active` differ by the counterparty's acceptance *and* a live subscription, and `void` differs
-- from `expired` by who decided. No row can imply those distinctions, which is exactly the test
-- this schema applies before it stores a status.
--
-- **The backfill is derived from the rows, once.** Every relationship that exists was created from
-- a template and played: if any of its parties recorded `accepted_at` (0016), the counterparty took
-- the seat and the relationship is `active`; otherwise it was published and never accepted, so it
-- is `published`. `draft` is never backfilled — nothing before this file could be a draft, because
-- nothing before this file could be created before publishing. `published_at` is backfilled from
-- the relationship's own `created_at`, which is the first instant it can have been published (0013
-- set it from the session's record date); inventing `now()` would claim a publish nobody made at
-- migration time. `completed_at` and `void_reason` stay NULL: no row records either, and NULL is
-- the honest absence.
--
-- No `gap` column, nothing named like one: the Gap stays `gapOf()` over two scores.
--
-- Idempotent on purpose, like 0001–0029: `db:migrate` ledgers this file and skips what it applied,
-- and a re-run of this file alone must still be a no-op. The backfill is guarded on
-- `status = 'draft'`, which is the state the ADD leaves every existing row in, so a replay
-- re-derives the same answer instead of moving a status somebody has since changed on purpose.

ALTER TABLE relationship ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE relationship ALTER COLUMN status SET NOT NULL;
ALTER TABLE relationship ALTER COLUMN status SET DEFAULT 'draft';

ALTER TABLE relationship DROP CONSTRAINT IF EXISTS relationship_status_vocabulary;
ALTER TABLE relationship
  ADD CONSTRAINT relationship_status_vocabulary CHECK (
    status IN ('draft', 'pending', 'published', 'active', 'complete', 'void', 'expired')
  );

ALTER TABLE relationship ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ NULL;
ALTER TABLE relationship ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ NULL;
ALTER TABLE relationship ADD COLUMN IF NOT EXISTS void_reason TEXT NULL;

-- A publish cannot follow its own completion, and neither can predate the relationship. Both are
-- `>=`, not `>`: a create-then-immediately-publish run may share an instant with `created_at`.
ALTER TABLE relationship DROP CONSTRAINT IF EXISTS relationship_completed_after_published;
ALTER TABLE relationship
  ADD CONSTRAINT relationship_completed_after_published CHECK (
    completed_at IS NULL
    OR (published_at IS NOT NULL AND completed_at >= published_at)
  );

ALTER TABLE relationship DROP CONSTRAINT IF EXISTS relationship_published_after_creation;
ALTER TABLE relationship
  ADD CONSTRAINT relationship_published_after_creation CHECK (
    published_at IS NULL OR published_at >= created_at
  );

-- The backfill. `accepted_at` on any party of any session of the relationship is the one recorded
-- fact that separates "went live and was answered" from "went live": 0016 stores the acceptance
-- instant, and a party who accepted holds the seat.
UPDATE relationship r
   SET status = CASE
         WHEN EXISTS (
           SELECT 1
             FROM session s
             JOIN party p ON p.session_record_id = s.record_id
            WHERE s.relationship_id = r.id
              AND p.accepted_at IS NOT NULL
         ) THEN 'active'
         ELSE 'published'
       END,
       published_at = r.created_at
 WHERE r.status = 'draft';

-- The lifecycle read is "this initiator's relationships, newest first" and "the ones awaiting a
-- counterparty"; both are `(initiator_user_id, status)`. A partial index on the statuses that are
-- still in flight would be smaller, but the catalog also reads terminal rows, and the table is one
-- row per purchased relationship.
CREATE INDEX IF NOT EXISTS relationship_initiator_status_idx
  ON relationship (initiator_user_id, status);
