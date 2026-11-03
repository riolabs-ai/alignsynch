-- 0028_support_inbox.sql — the support inbox: triage state, assignment, and the reply (#506).
--
-- **What was missing.** `0020` gave `/help` a place to keep a message and `0027` gave the mail
-- provider a place to say what became of one; nothing in between let a person answer it. A
-- `contact_message` row could only be read by hand in a SQL client, and "we replied" was a fact
-- living in somebody's mail client. This file adds the two things that make the console screen
-- (`/admin/inbox`) possible: a triage status on the message, and one row per reply attempt.
--
-- **`status` is the support seat's own word, not the provider's.** Four values, and each one is a
-- state somebody chose:
--
--   new       arrived, nobody has claimed it. The column default, so a row the public route
--             writes is in the queue without the route knowing this screen exists.
--   open      a person is working it. A reply that the provider accepted leaves the message
--             `open`: the conversation continues, and a reply arriving is not a resolution.
--   waiting   **a reply was attempted and the provider did not accept it.** The card's rule —
--             "a 4xx leaves the message `waiting` with the provider error stored" — is why the
--             word means that and not "waiting for the customer": the state exists to be visible
--             on the row, and the error it is waiting on is `contact_reply.error` below.
--   closed    resolved. Reversible: nothing deletes the row, and a closed message can be reopened
--             with a reason like any other transition.
--
-- The vocabulary is a CHECK and not a lookup table: four literals that a screen and a server
-- action both name, and a table would be a fifth place to read `waiting` from.
--
-- **`assigned_user_id` is the seat, and it is not a foreign key.** It holds
-- `user_profile.user_id` for the operator who claimed the message; there is no FK for the reason
-- `0023`'s `admin_action` has none — the app does not constrain the managed auth schema, and an
-- account deleted upstream must not cascade a message out of the inbox or blank the record of who
-- answered it. The pair moves together (`assigned_at` is set with it), which the CHECK below
-- makes a property of the table rather than of the one statement that happens to write it.
--
-- **`sent_at` on the message is the last reply the provider accepted**, and it is written in the
-- same statement that flips the status — never on the attempt. `contact_reply.sent_at` is the
-- per-attempt instants, and the constraint `contact_reply_sent_has_instant` is what makes "sent
-- only after the provider accepted" a property of the row rather than a promise in a route: a
-- `sent` reply with no instant, or an instant on a reply that is not `sent`, is refused by
-- Postgres. `0027` recorded the provider's answer; this records ours.
--
-- **The reply's error is stored, not swallowed.** `error` is the provider's refusal as the
-- console shows it — the status code and the provider's own message, truncated. It is NOT a log
-- line: no line in this feature prints a recipient address, and the body of a provider error can
-- echo the request (recipient included), so it goes to this column and to the screen and nowhere
-- else. `contact_reply_failed_has_error` refuses a `failed` reply with nothing to show: a failure
-- nobody can read is the defect the card exists to remove.
--
-- **No Gap column, no `instance` noun.** This file adds columns and one table that mirror a
-- support conversation; `db:verify`'s two name bans apply to them exactly as they do to the rest
-- of `public`, and V25 checks that the vocabulary and the pairing constraints exist, because a
-- database migrated without this file is a request-time 500 on the first visit to the inbox.
--
-- Idempotent on purpose, like 0001–0027: `db:migrate` ledgers each file in `schema_migrations` and
-- skips what it applied, and a re-run of this file alone is a no-op.
ALTER TABLE contact_message ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'new';

-- A vocabulary constraint is replaced rather than duplicated: `ADD CONSTRAINT` has no
-- `IF NOT EXISTS`, and a second copy of the same CHECK would be two places to keep in step.
ALTER TABLE contact_message DROP CONSTRAINT IF EXISTS contact_message_status_vocabulary;
ALTER TABLE contact_message
  ADD CONSTRAINT contact_message_status_vocabulary
  CHECK (status IN ('new', 'open', 'waiting', 'closed'));

ALTER TABLE contact_message ADD COLUMN IF NOT EXISTS assigned_user_id TEXT;
ALTER TABLE contact_message ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;

-- The two assignment columns are one fact: a seat, and when it was taken. Half of the pair says
-- nothing a screen can render, so the table refuses it.
ALTER TABLE contact_message DROP CONSTRAINT IF EXISTS contact_message_assignment_is_a_pair;
ALTER TABLE contact_message
  ADD CONSTRAINT contact_message_assignment_is_a_pair
  CHECK (
    (assigned_user_id IS NULL AND assigned_at IS NULL)
    OR (assigned_user_id IS NOT NULL AND assigned_at IS NOT NULL)
  );

-- The instant the provider accepted the message-level reply. NULL means no reply has landed yet;
-- it is never set on the attempt (`contact_reply.sent_at` and its CHECK cover that half).
ALTER TABLE contact_message ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;

-- The inbox list's read: "the newest row in each status", which is how a queue is worked.
CREATE INDEX IF NOT EXISTS contact_message_status_created_idx
  ON contact_message (status, created_at DESC);

-- The thread's read: the seat's messages against the person's, oldest first. The FK is the one
-- cascade this file wants — a message that is deleted takes its thread with it, because a reply
-- to a message nobody has is not a record of anything.
CREATE TABLE IF NOT EXISTS contact_reply (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id      UUID        NOT NULL REFERENCES contact_message (id) ON DELETE CASCADE,
  -- `user_profile.user_id` of the operator who wrote it. No FK, for the reason given above.
  author_user_id  TEXT        NOT NULL CHECK (length(btrim(author_user_id)) > 0),
  body            TEXT        NOT NULL CHECK (length(btrim(body)) > 0),
  -- `sending` is the row as it exists between "stored" and "the provider answered". It is a real
  -- state, not a transient one: a process that dies during the send leaves a `sending` reply, which
  -- a reader can see and retry, instead of a `sent` row for a message nobody received.
  state           TEXT        NOT NULL,
  -- The provider's own id for an accepted message, when it answers with one.
  provider_id     TEXT,
  -- The provider's refusal, truncated: status code plus its message. Never a log line.
  error           TEXT,
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT contact_reply_state_vocabulary CHECK (state IN ('sending', 'sent', 'failed')),
  CONSTRAINT contact_reply_sent_has_instant CHECK ((state = 'sent') = (sent_at IS NOT NULL)),
  CONSTRAINT contact_reply_failed_has_error CHECK (state <> 'failed' OR error IS NOT NULL)
);

-- One index, both reads it serves: the thread (a message's replies, oldest first) and the
-- "has anybody answered this" count the inbox list draws per row.
CREATE INDEX IF NOT EXISTS contact_reply_message_created_idx
  ON contact_reply (message_id, created_at);
