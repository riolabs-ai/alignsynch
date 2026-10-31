-- 0010_invite_resend.sql — re-invite records when it happened, and how often (#275).
--
-- A re-invite is the Initiator's recovery action while an invitation is unclaimed (expired or
-- not): it mints a new token, overwrites `token_hash` / `expires_at` / `email` in one transaction,
-- and the old link dies as `unknown` — it no longer names an invitation. Two facts the flow has to
-- keep, and nothing else:
--
--   resent_at      WHEN the live token was last (re)issued. The cooldown (`RESEND_COOLDOWN_MS`,
--                  24 h) is a comparison against this instant, and it belongs to the token: the
--                  original `created_at` is the instance's own fact and must not be rewritten by a
--                  reissue.
--   resent_count   HOW MANY lifetime re-invites. The cap (`RESEND_LIFETIME_CAP`, 3) is the only
--                  rule that cannot be derived from `resent_at` alone — a cooldown still permits
--                  one send a day forever — so this is the one column the cap needs.
--
-- **No `status`, no `revoked_at`, no `state`.** Whether an invitation is live, expired, claimed or
-- superseded stays derived: `claimed_at` and `expires_at` are compared with the instant of the read
-- (`lib/flow/invite-state.ts`), and a superseded link is one whose hash no longer exists. A
-- `state` column would be a second authored copy of those two columns, the same defect this schema
-- has refused for the instance's status (`0002_two_party_flow.sql`), the Gap, and the mode.
--
-- **One live token per relationship stays structural.** The PK on `instance_record_id` allows one
-- row per invitation and `UNIQUE(token_hash)` forbids a repeat hash; the re-invite is an UPDATE of
-- that row, so there is no code path that could produce two live links for one relationship.
--
-- **No `gap` column** — nothing here is named like one, and `db:verify` V2 fails on the name.
--
-- Idempotent on purpose, like 0001–0009: `db:migrate` records each file in `schema_migrations`, a
-- re-run of this file alone is a no-op, and every statement below can be replayed safely.
ALTER TABLE instance_invite ADD COLUMN IF NOT EXISTS resent_at TIMESTAMPTZ NULL;
ALTER TABLE instance_invite ADD COLUMN IF NOT EXISTS resent_count INT NOT NULL DEFAULT 0;

-- A reissue cannot predate the invitation it reissues. `>=` and not `>`: the SQL twin of the
-- cooldown's `now` being the same instant as `created_at` on a create-then-immediately-fix run.
ALTER TABLE instance_invite DROP CONSTRAINT IF EXISTS invite_resent_after_creation;
ALTER TABLE instance_invite
  ADD CONSTRAINT invite_resent_after_creation CHECK (resent_at IS NULL OR resent_at >= created_at);

-- A negative count is not a budget anybody could spend, and `0` with a `resent_at` is two columns
-- disagreeing about whether a re-invite ever happened (V13 in `scripts/db-verify.mjs` names it on
-- live rows; this is the structural half).
ALTER TABLE instance_invite DROP CONSTRAINT IF EXISTS invite_resent_count_nonnegative;
ALTER TABLE instance_invite ADD CONSTRAINT invite_resent_count_nonnegative CHECK (resent_count >= 0);
