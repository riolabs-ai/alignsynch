-- 0033_account_deletion.sql — the indexes an erasure sweep needs, and nothing else (#278).
--
-- The build that uses this file is `lib/account/purge.ts`. Deleting an account is a sweep over
-- every column that identifies a person (`docs/ACCOUNT-DELETION-SPEC.md` §1.1), and the sweep
-- filters those columns by an account id. Six of the tables it reaches do not have an index that
-- leads with that id, so each statement would be a sequential scan over a table whose size has
-- nothing to do with the one person being deleted.
--
-- **Index-only, on purpose.** No column, no constraint, no `gap` anything (V2 keeps that rule):
-- `party.user_id` is already nullable and the app never constrains `neon_auth` (§3.1–§3.2 of the
-- spec), so the schema change this card needs is exactly none. Everything below is
-- `IF NOT EXISTS`-idempotent, so applying it to a database that has already been swept, or to one
-- another branch already migrated, is a no-op.
--
-- **Why each one is not already covered:**
--
--   party_user_idx                        `party_session_user_key` is `UNIQUE (session_record_id,
--                                         user_id) WHERE user_id IS NOT NULL` — a two-column index
--                                         whose *leading* column is the session, so `WHERE user_id
--                                         = $1` cannot use it. A partial index on the one column
--                                         also stays small: every seat that ever signed in is in it,
--                                         at 8 rows per relationship at most.
--   relationship_counterparty_user_idx    `relationship`'s only index leads with
--                                         `initiator_user_id`, so the other side of every
--                                         relationship is a scan for the sweep.
--   relationship_member_user_idx          `relationship_member_key` is `UNIQUE (relationship_id,
--                                         user_id)` — the same two-column trap.
--   contact_message_assignee_idx          the support inbox reads by address and by status; the
--                                         sweep reads by the operator id that handled the message.
--   contact_reply_author_idx              `author_user_id` is `NOT NULL`, so there is no partial
--                                         predicate to write; the sweep deletes the replies of a
--                                         deleted operator.
--   record_owner_user_idx                 a private template is reachable by one account through
--                                         `owner_user_id` (`0029`), and archiving it is one
--                                         statement in the sweep.
--
-- Not indexed on purpose: `billing_subscription.user_id`, `password_reset.email`,
-- `email_event.recipient` and `news_signup.email`. The first is retained by the accounting
-- exception and never queried by id during a deletion, and the last three are already keyed or
-- indexed (or are email-keyed primaries) by the tables that write them. An index with no reader is
-- a write cost on every insert.

-- party: the partial UNIQUE (session_record_id, user_id) cannot serve WHERE user_id = $1
CREATE INDEX IF NOT EXISTS party_user_idx ON party (user_id) WHERE user_id IS NOT NULL;

-- relationship: the only existing index leads with initiator_user_id
CREATE INDEX IF NOT EXISTS relationship_counterparty_user_idx
  ON relationship (counterparty_user_id)
  WHERE counterparty_user_id IS NOT NULL;

-- relationship_member: UNIQUE (relationship_id, user_id) does not lead with user_id
CREATE INDEX IF NOT EXISTS relationship_member_user_idx ON relationship_member (user_id);

-- the support tables, reached by the operator id rather than by user id today
CREATE INDEX IF NOT EXISTS contact_message_assignee_idx
  ON contact_message (assigned_user_id)
  WHERE assigned_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS contact_reply_author_idx ON contact_reply (author_user_id);

-- a private template the deleted account owned
CREATE INDEX IF NOT EXISTS record_owner_user_idx
  ON record (owner_user_id)
  WHERE owner_user_id IS NOT NULL;
