-- 0002_two_party_flow.sql — the two-party flow (#146).
--
-- Three additions, and nothing else. #145's six tables are the model's mirror; this
-- file adds only what a flow between two people needs and the model does not already
-- carry:
--
--   party.access_token_hash    which party is asking. The hash, never the token.
--   instance_invite            the single-use invitation the Counterparty claims.
--   (the indexes that make both lookups a key read)
--
-- **No `status` column, deliberately.** The instance's status — `awaiting_counterparty`,
-- `answering`, `complete` — is a function of rows that already exist: the counterparty
-- party row, the invite's `claimed_at`, and the opinion rows. A column would be a second
-- authored copy of that fact and could disagree with the rows it summarises, which is the
-- same defect a stored Gap would be. `instanceStatusOf()` in `lib/flow/state.ts` computes
-- it on every read; `db:verify` recomputes it and asserts it against the rows.
--
-- **No `gap` column, again.** The Gap is `gapOf()` over two scores (`content/record.ts`),
-- computed on every render by `lib/assessment-report.ts`. This file must never grow one:
-- no migration, table or generated column in this repo is named `gap`.
--
-- Idempotent on purpose, like 0001: `db:migrate` records each file in `schema_migrations`
-- and skips what it has already applied, and a re-run of this file alone is still a no-op.
--
-- The copy of the Aspects is **not** a new table. #145 already made it structural: an
-- instance is a `record` carrying `record_type = 'assessment'` plus an `assessment_instance`
-- row, and its Aspects are that record's own `item` rows. Creating an instance copies the
-- template's `item` rows into rows owned by the instance record (`INSERT … SELECT`), so
-- "a copy, never an alias" is a property of the primary key rather than a convention.

-- The party's session token, hashed with SHA-256. NULL means "a party row with no way to
-- sign in" — every `db:seed` party, which mirrors a fixture and is read at
-- `/assessment/[slug]` without a session. A flow instance's parties always carry one.
ALTER TABLE party ADD COLUMN IF NOT EXISTS access_token_hash TEXT;

-- One token, one party. A partial index because a seeded party's NULL must not collide
-- with the next seeded party's NULL.
CREATE UNIQUE INDEX IF NOT EXISTS party_access_token_hash_key
  ON party (access_token_hash)
  WHERE access_token_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS instance_invite (
  instance_record_id TEXT PRIMARY KEY
    REFERENCES assessment_instance (record_id) ON DELETE CASCADE,
  email TEXT NOT NULL CHECK (position('@' in email) > 1),
  counterparty_name TEXT NOT NULL CHECK (length(btrim(counterparty_name)) > 0),
  -- The hash of the token that goes in the link, never the token itself: the row is
  -- readable by anyone with database access and the link is a bearer credential.
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Seven days, from `INVITE_TTL_MS` in `lib/flow/tokens.ts`.
  expires_at TIMESTAMPTZ NOT NULL,
  -- Set by the one claim that consumed it. A second claim reads this and is refused.
  claimed_at TIMESTAMPTZ,
  CONSTRAINT invite_expires_after_creation CHECK (expires_at > created_at),
  CONSTRAINT invite_claimed_after_creation CHECK (claimed_at IS NULL OR claimed_at >= created_at)
);
