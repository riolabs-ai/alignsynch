-- 0027_email_event.sql — what the mail provider says happened to a message (#439b).
--
-- **Why this table exists.** The app sends (invitations, password resets, the news confirmation)
-- and, until this file, believed every send that returned a 2xx. A provider answers 2xx when it
-- *accepts* a message, not when a mailbox receives it: a hard bounce and a spam complaint arrive
-- minutes later, on a webhook, and nothing recorded them. So an address that never accepted mail
-- stayed on the list forever, and the broadcast surface (#507) had no row to read before sending.
-- One row per delivery the provider reports is that record.
--
-- **`provider_event_id` is the delivery's identity, and unique.** The provider's payload carries
-- no id of its own (measured: the JSON body has `type`, `created_at` and `data` and nothing else) —
-- the id is the `svix-id` header, which the signature covers. Delivery is at-least-once: a failed
-- acknowledgement is retried, and a retry must not become a second row, a second mark, or a second
-- thing #507 counts. The UNIQUE constraint is what makes that a property of the table rather than
-- of the insert statement that happens to pass through it; the writer is
-- `INSERT … ON CONFLICT (provider_event_id) DO NOTHING`, in the same transaction as the mark.
--
-- **`payload` is the provider's own object, as received.** It is the only copy of the bounce
-- message, the SMTP diagnostic code and the provider's event name, and none of those are modelled
-- as columns: a column per field is a second schema the provider can move under us, and every
-- event type carries a different `data` shape. It is not a junk drawer in the sense `0026` means —
-- nothing reads it to make a decision, and the decision's inputs (`type`, `recipient`,
-- `occurred_at`) are columns. **It does contain the recipient's address**, which is why no log
-- line in this feature ever prints a payload.
--
-- **`occurred_at` is the event's instant, `created_at` is the row's.** The provider stamps when
-- the bounce happened (`data.created_at`, with the envelope's own `created_at` as the fallback);
-- the row is written when the delivery reached us, which can be later after a retry. Two columns
-- because they answer different questions, and #506 sorts a thread by the first while an operator
-- debugging a delayed webhook reads the second.
--
-- **`ip_hash`, not the address.** The endpoint is unauthenticated apart from its signature, so it
-- is rate-limited per client the same way `0020_contact_message.sql` limits the public form: a
-- salted SHA-256 of the forwarded address (`lib/contact/ip.ts`), enough to count one client's
-- deliveries inside a window and not a location log. It is nullable because a delivery with no
-- proxy header has no address to hash, and one bucket for "unidentifiable" is the honest shape.
--
-- **The two marks on `news_signup` are the whole point of the inbound half.** A hard bounce sets
-- `bounced_at`; a complaint sets `complained_at`. Both are nullable instants, written once
-- (`COALESCE(column, $2)`), because the first bounce is the fact and a repeated delivery of the
-- same event is the same fact. A **soft** bounce marks nothing: the receiving server refused the
-- message *for now* and may accept the next one, and cutting a real address off after one
-- transient refusal is the failure this rule exists to prevent. The columns are not a boolean
-- because "when" is what a support read (#506) shows a person, and a boolean would have to be
-- paired with a second column to answer it.
--
-- No Gap column, no `instance` noun: this file adds one table and two nullable columns, and neither
-- names an old noun (`db:verify` V2/V16 keep both rules).
--
-- Idempotent on purpose, like 0001–0026: `db:migrate` ledgers each file in `schema_migrations` and
-- skips what it applied, and a re-run of this file alone is a no-op.
CREATE TABLE IF NOT EXISTS email_event (
  id                BIGSERIAL   PRIMARY KEY,
  -- The `svix-id` header: the delivery's identity, and the replay's only defence.
  provider_event_id TEXT        NOT NULL,
  -- `email.bounced`, `email.complained`, `email.delivered` — the provider's own vocabulary.
  type              TEXT        NOT NULL CHECK (length(btrim(type)) > 0),
  -- Lower-cased, because one mailbox is one row and `news_signup.email` is lower-cased too.
  recipient         TEXT        NOT NULL,
  -- The subject is a convenience for the support read; a provider event may omit it.
  subject           TEXT,
  occurred_at       TIMESTAMPTZ NOT NULL,
  payload           JSONB       NOT NULL,
  ip_hash           TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT email_event_provider_event_id_key UNIQUE (provider_event_id),
  CONSTRAINT email_event_recipient_is_lowercased CHECK (recipient = lower(btrim(recipient))),
  CONSTRAINT email_event_recipient_is_shaped CHECK (recipient ~ '^[^[:space:]@]+@[^[:space:]@]+$'),
  CONSTRAINT email_event_occurred_at_is_an_instant CHECK (occurred_at > '2020-01-01')
);

-- The support read (#506): everything that happened to one address, newest first.
CREATE INDEX IF NOT EXISTS email_event_recipient_occurred_idx
  ON email_event (recipient, occurred_at DESC);

-- The operator's read and the rate limit's window: newest deliveries first.
CREATE INDEX IF NOT EXISTS email_event_created_idx
  ON email_event (created_at DESC);

-- The rate limit's read: "how many deliveries from this client inside the window".
CREATE INDEX IF NOT EXISTS email_event_ip_created_idx
  ON email_event (ip_hash, created_at DESC);

-- The suppression marks. Nullable instants, because "never bounced" and "bounced at 14:02" are the
-- two states and a default instant would make the first one a lie. The application writes them
-- through `lib/db/email-events.ts` and nothing else; `scripts/db-verify.mjs` V24 checks that the
-- columns exist, because a webhook that writes to a column no migration created is a 500 on the
-- first bounce rather than a caught bug.
ALTER TABLE news_signup ADD COLUMN IF NOT EXISTS bounced_at    TIMESTAMPTZ;
ALTER TABLE news_signup ADD COLUMN IF NOT EXISTS complained_at TIMESTAMPTZ;
