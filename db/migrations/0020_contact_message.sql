-- 0020_contact_message.sql — the public contact form's inbox (owner, 2026-11-02).
--
-- One row per message a visitor submits from `/help`. The table exists because the form's
-- promise is that **a message is kept before it is mailed**: `app/api/contact/route.ts` inserts
-- here first and only then calls the mailer, so a provider outage is a delayed notification
-- rather than a lost message, and the page can tell the sender which of the two happened
-- without guessing.
--
-- **No address is stored that the sender did not type.** `email` is the reply address from the
-- form, and the mailer puts it in `Reply-To`; the mailbox the message is sent *to* is the brand
-- record's (`data/brands/*.ts`), read at send time and never copied into a row. A row that
-- outlives a routing change would otherwise claim a destination that no longer exists.
--
-- **`ip_hash`, not the address.** The rate limit is per client, and the client is identified by
-- a salted SHA-256 of the forwarded address (`lib/contact/ip.ts`) — enough to count repeats in a
-- window, and not a location log. No user agent beyond a truncated one, no cookies, no session.
--
-- **`mail_outcome` is the send's result, and `NULL` means "not attempted yet".** The three
-- non-null values are `lib/flow/email.ts`'s `MailOutcome`, so the column and the transport
-- cannot drift into a fourth word: `sent` is a 2xx, `unset` is a deployment with no
-- `RESEND_API_KEY` (nothing was attempted), `failed` is a refused or unreachable provider. A row
-- with `NULL` is a message whose process died between the insert and the update — visible as
-- such rather than counted as sent.
--
-- No Gap column, no `instance` noun: this table has nothing to do with the content model, and
-- `db:verify`'s two name bans apply to it exactly as they apply to the rest of `public`.
CREATE TABLE IF NOT EXISTS contact_message (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL CHECK (length(btrim(name)) > 0),
  email        TEXT        NOT NULL CHECK (email LIKE '%_@_%._%'),
  message      TEXT        NOT NULL CHECK (length(btrim(message)) > 0),
  ip_hash      TEXT,
  user_agent   TEXT,
  mail_outcome TEXT        CHECK (mail_outcome IN ('sent', 'unset', 'failed')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The operator's read: newest first, which is how a message is answered.
CREATE INDEX IF NOT EXISTS contact_message_created_idx
  ON contact_message (created_at DESC);

-- The rate limit's read: "how many from this client in the last window".
CREATE INDEX IF NOT EXISTS contact_message_ip_created_idx
  ON contact_message (ip_hash, created_at DESC);
