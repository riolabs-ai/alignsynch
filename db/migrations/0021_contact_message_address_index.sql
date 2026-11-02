-- 0021_contact_message_address_index.sql — the contact throttle's second bucket.
--
-- `0020` created `contact_message` with one index the limit reads: `(ip_hash, created_at)`, "how
-- many from this machine in the window". This card's acceptance asks for a **per-address** throttle
-- as well, because one reply address a spammer holds constant is one sender however many machines
-- post it, and a client-only limit lets a botnet through.
--
-- A second file rather than an edit to `0020`: that file is already recorded in
-- `schema_migrations` on the demo branch (a `CREATE TABLE IF NOT EXISTS` run by the previous card),
-- and a migration that has been applied is never rewritten — a fresh deployment would get the new
-- index and the demo branch would not, which is exactly the drift the ledger exists to prevent.
--
-- `lower(email)`: `Ada@Example.test` and `ada@example.test` are one mailbox, and a budget spent by
-- pressing Shift is no budget. The same expression appears on the right-hand side of
-- `countRecentContactMessages()` in `lib/contact/store.ts`, so the index is what that query is
-- planned against.
CREATE INDEX IF NOT EXISTS contact_message_email_created_idx
  ON contact_message (lower(email), created_at DESC);
