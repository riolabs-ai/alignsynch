-- 0019_news_signup.sql — the footer's news list, one row per address.
--
-- **Why this table exists at all.** The footer's band used to be a form with no handler (#272,
-- removed for that reason): it took an address and promised delivery with nothing behind it.
-- The promise is real now — a send is a single `fetch` to Resend and it can fail — so the
-- *list* is the durable asset and the message is the notification. Storing the row first and
-- sending second is what makes "stored but not sent" a state a person can be told about,
-- instead of a subscription that vanished because the mail provider was rate-limiting.
--
-- **One row per address, as a property of the table.** `email` is the primary key: a second
-- submit is `ON CONFLICT (email) DO NOTHING`, which is a no-op rather than a duplicate row or a
-- unique-violation 500. Unsubscribing is a delete of that key, so there is no soft-delete flag
-- to drift.
--
-- **Lower-cased is a CHECK, not a convention.** `Mailbox@Example.com` and `mailbox@example.com`
-- are one mailbox, and the application normalises before it writes; the CHECK makes the
-- invariant true of rows that arrive from `psql` too, which is the same argument `0017_step.sql`
-- makes for its provenance constraint. The `length` CHECK on the two text columns keeps an empty
-- string — which is what a truncated form post would carry — out of the list.
--
-- **`source` is the page path the person signed up from**, and nothing else about them is kept:
-- no IP, no user agent, no marketing consent flag beyond the row's existence. `created_at` is
-- the instant the row was written, passed by the caller rather than defaulted so the writer and
-- the row cannot disagree about it.
CREATE TABLE IF NOT EXISTS news_signup (
  email      TEXT        PRIMARY KEY,
  source     TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT news_signup_email_is_lowercased CHECK (email = lower(btrim(email))),
  CONSTRAINT news_signup_email_is_shaped CHECK (email ~ '^[^[:space:]@]+@[^[:space:]@]+$'),
  CONSTRAINT news_signup_source_is_a_path CHECK (source ~ '^/'),
  CONSTRAINT news_signup_created_at_is_an_instant CHECK (created_at > '2020-01-01')
);
