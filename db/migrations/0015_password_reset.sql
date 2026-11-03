-- 0015_password_reset.sql — the app's own forgot-password flow.
--
-- Until this file there was no way to set a password outside sign-up, and no way back in for
-- anybody who had forgotten one. The gap was worse for a Google-only account: `neon_auth.account`
-- holds one `google` row and no `credential` row, so the account has never had a password and
-- there was no call in the app that could give it one. If the Google provider is unavailable —
-- a rotated client, an outage, a locked personal account — that person is locked out
-- permanently rather than temporarily.
--
-- **Why this table exists at all.** The app owns no users and no sessions: they live in Neon
-- Auth's `neon_auth` schema, which this repo never migrates. What the app *does* own is the
-- decision "this address asked for a reset link, and here is the single-use proof". That is one
-- row per request:
--
--   password_reset   one row per request, and the whole rate-limit ledger. `user_id` is NULL
--                    when no account has that address — the row is still written, because a
--                    limiter that only counted known addresses would be an existence oracle.
--                    `token_hash` is NULL for the same reason, and otherwise holds SHA-256 of
--                    the token; `lib/flow/tokens.ts` is the one minting/hashing module and is
--                    reused here rather than re-implemented.
--                    `requester_hash` is SHA-256 of the client address, never the address
--                    itself: it exists only to count requests from one place, and a hash is
--                    enough for a count and not enough to keep a visitor log.
--
-- **The password itself is never written here.** Setting one is the auth server's job — it owns
-- the hash algorithm, the salt and the session store. `lib/auth/password-provider.ts` spends a
-- single-use grant against Neon Auth's own `/reset-password` endpoint, which creates the
-- `credential` row for an account that has none (the Google-only case) or updates the existing
-- one, and this table only records that the request happened. That split is why a change of
-- Better Auth's hashing costs this repo nothing.
--
-- **Single use is structural, not remembered.** `used_at` is written in the same transaction that
-- marks the request spent, and `db/password-reset` refuses a row that already carries it; the
-- provider's own grant is consumed on its side too, so a replayed link is refused twice over.
-- A successful set also stamps every *other* unused row for that user, which is what makes
-- "invalidated on password change" true for links already sitting in an inbox.
--
-- Idempotent on purpose, like 0001–0014: `db:migrate` ledgers this file and skips it on a
-- re-run, and every statement below is guarded so a replay is a no-op.

CREATE TABLE IF NOT EXISTS password_reset (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The address as asked, lowercased. Stored even when no account has it: it is the rate-limit
  -- key, and the answer to "does this exist" is never read back out of the table.
  email          TEXT        NOT NULL,
  -- `neon_auth."user".id` when exactly one account has that address, else NULL.
  user_id        TEXT,
  -- SHA-256 of the token, lowercase hex — the only form of a token this repo stores.
  token_hash     TEXT,
  -- SHA-256 of the client address, for the per-IP limiter. Never the address itself.
  requester_hash TEXT        NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- NULL when no token was minted (no account), which is also why it is nullable: a request with
  -- nothing to send has nothing to expire.
  expires_at     TIMESTAMPTZ,
  used_at        TIMESTAMPTZ
);

-- One row per token, and the equality lookup the consume path is. Partial, because every request
-- for an address with no account carries NULL and NULLs are not duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS password_reset_token_hash_key
  ON password_reset (token_hash)
  WHERE token_hash IS NOT NULL;

-- The per-address limiter: newest first, within the window, for one address.
CREATE INDEX IF NOT EXISTS password_reset_email_created_idx
  ON password_reset (email, created_at DESC);

-- The per-IP limiter. Same shape, different key.
CREATE INDEX IF NOT EXISTS password_reset_requester_created_idx
  ON password_reset (requester_hash, created_at DESC);

-- "Invalidate every link this account still has" after a password change, without a sequential
-- scan. Partial on the same condition the update uses.
CREATE INDEX IF NOT EXISTS password_reset_user_open_idx
  ON password_reset (user_id)
  WHERE used_at IS NULL;
