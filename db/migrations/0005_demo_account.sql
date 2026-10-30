-- 0005_demo_account.sql — the three demo accounts and the party they are (#183, part 1 of 2).
--
-- Two additions, one reason each:
--
--   party.user_id     which signed-in account is this party. Until #183 a party proved itself
--                     with the per-instance bearer token in `party.access_token_hash` and had
--                     no idea a user existed; the demo surface signs in as a person, so the row
--                     that names that person needs somewhere to record them.
--   demo_account      the three seeded demo accounts, and the only place a demo password lives.
--
-- **`party.user_id` is nullable on purpose.** Every party `db:seed` writes from the fixtures is
-- a `(role, name)` pair with no account behind it, and `0002`'s flow parties prove themselves
-- with a token, not a user. NULL is the honest value for both: not "an unknown user" but
-- "nobody signed in as this party". A NOT NULL column would force the seed to invent an account
-- for Avery in every fixture instance, which is exactly the fixture-vs-runtime confusion this
-- schema avoided for `user_profile`.
--
-- **`demo_account.password` is plain text, and that is a considered decision.** The demo panel
-- (#183 part 2) signs a browser in without ever sending it a password: a server action reads
-- this row and presents the credential to Neon Auth on the person's behalf. A hash cannot be
-- presented to a sign-in endpoint, so the choice is plain text here or a plain-text password in
-- an environment variable — and an env var cannot be generated per seed run. What makes it
-- safe is scope, all of which is enforced elsewhere and stated here so it cannot be quietly
-- widened:
--
--   * the table is only ever read under `DEMO_AUTH=1` (the seed writes it under the same flag,
--     and deletes it when the flag is off);
--   * the address domain is pinned to `@demo.alignsynch.test` by the CHECK below, so a real
--     person's credential cannot be stored here by mistake;
--   * no row here is ever rendered, logged, returned from a route, or put in a fixture — the
--     login panel receives a session, never a password;
--   * a demo account owns nothing: it is created by `db:seed`, deleted by `db:seed`, and its
--     password is regenerated on every run.
--
-- The row is a credential for a fake person, in a database the app already trusts with its
-- real ones. Treating it as radioactive while a real password hash sits one table over would
-- be the incoherent choice.
--
-- Idempotent on purpose, like 0001–0004.

-- Which signed-in account this party is. Text, like `user_profile.user_id`: the identifier is
-- Neon Auth's, not a kebab id this repo authors.
ALTER TABLE party ADD COLUMN IF NOT EXISTS user_id TEXT;

-- One account cannot be both parties of one instance. Scoped to the instance because being
-- Avery in one assessment says nothing about being anyone in the next — a global UNIQUE would
-- be wrong, and a global "one party per person" rule is not a rule this product has.
CREATE UNIQUE INDEX IF NOT EXISTS party_instance_user_key
  ON party (instance_record_id, user_id)
  WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS demo_account (
  -- The address the panel signs in as, and the seed's key: three of them, by address.
  email       TEXT PRIMARY KEY,
  -- Neon Auth's user id — the join key to `user_profile`, which is where the role lives. The
  -- role is NOT copied here: one fact, one column, and it is the profile's.
  user_id     TEXT NOT NULL UNIQUE,
  -- See the header. Never rendered, never logged, never committed.
  password    TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT demo_account_email_domain CHECK (
    email LIKE '%@demo.alignsynch.test'
  ),
  CONSTRAINT demo_account_email_shape CHECK (
    position('@' in email) > 1 AND length(email) <= 254
  ),
  CONSTRAINT demo_account_password_present CHECK (length(password) >= 16)
);

-- No index on `user_id`: the UNIQUE constraint already carries one, and the read path
-- (`/demo`'s server action) looks up by `email`, which the primary key indexes.
