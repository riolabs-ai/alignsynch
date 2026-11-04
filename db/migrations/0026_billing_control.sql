-- 0026_billing_control.sql — what an operator needs to see and to grant (#505, epic #500).
--
-- Billing exists and the console cannot see it. Two facts were missing from the schema, and
-- neither of them is a card number:
--
--   billing_subscription.livemode   the provider's own live/test flag, per row
--   plan_grant                      a tier given to one relationship for one period, with a reason
--
-- **No card data, ever.** Nothing in this file can hold a number printed on a card: there is no
-- PAN, no last four, no expiry, no CVC, no billing address and no provider customer object. The
-- three provider columns `billing_subscription` carries are an id, a state and — from here — a
-- boolean the provider reports about the *object*, and `lib/db/admin-billing.ts` names the columns
-- the console reads, so a payload that grew a `card: { last4 }` cannot reach a render by being
-- selected. That is the card's hard rule, and it is kept by the read rather than by a redaction.
--
-- **Why `livemode` is a column and not `provider = 'mock'`.** Both adapters this build carries are
-- test-mode today — the mock charges nothing, and the hosted adapter refuses any key that is not
-- `sk_test_` — so deriving "test" from `provider` would be true and would stay true only until the
-- first live key. The provider reports the fact on every object it sends (`livemode: false` on a
-- test-mode subscription), so it is stored as the provider said it, not inferred. **The default is
-- `FALSE`**, which is the safe direction: a row written before this column existed, and any
-- adapter that has not been taught to read the flag, claims test mode. Nothing here marks a
-- charge as real until the provider says it is.
--
-- **Why `plan_grant` is a table and not a column on `billing_subscription`.** A comp is not a
-- purchase: no money moved, no provider event exists, and `billing_subscription` is written from
-- provider reports only (`lib/db/billing.ts::writeSubscription`). Putting a granted tier there
-- would make the next webhook overwrite a gift with the truth about a card, and would make a gift
-- indistinguishable from a paid period in every query that asks "what did this account buy". So a
-- grant is its own row, with its own reason, its own author and its own period — auditable beside
-- the purchase rather than inside it.
--
-- **Idempotent by period, not by click.** `plan_grant_period_key` is `(relationship_id,
-- period_start)`: comping a period twice is a constraint violation, and
-- `lib/admin/billing-control.ts` refuses it as `period-already-granted` *before* the statement
-- runs, inside the transaction, so the second attempt writes neither a grant nor an audit row.
-- Clicking a button twice is not a fact about billing; covering one period twice is a mistake
-- somebody can make, and this is the constraint that makes it unrepresentable. An **extension** is
-- the same table with a later `period_start`, which is why the key is on the start and not on the
-- relationship.
--
-- **No `gap` column, nothing named like one.** `db:verify` V2 fails on the name, and this table is
-- a grant, not a measurement.
--
-- Idempotent on purpose, like 0001–0025: `db:migrate` ledgers this file and skips it on a re-run,
-- and every statement below is guarded so a replay changes nothing.

/* ------------------------------------------------------------------ *
 * 1. The provider's live/test flag, per subscription
 * ------------------------------------------------------------------ */

ALTER TABLE billing_subscription
  ADD COLUMN IF NOT EXISTS livemode BOOLEAN NOT NULL DEFAULT FALSE;

-- A comment on the column, because `information_schema` is where an operator looks when a row
-- says `livemode = false` and nobody remembers why the default is the quiet one.
COMMENT ON COLUMN billing_subscription.livemode IS
  'The provider''s own live/test flag for this subscription object. FALSE is test mode (and the default: nothing claims a real charge until the provider says so). Never derived from `provider`.';

/* ------------------------------------------------------------------ *
 * 2. A grant: a tier given to one relationship for one period
 * ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS plan_grant (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The relationship the tier is given to. `TEXT` because `relationship.id` is (0013), and
  -- `ON DELETE CASCADE` because a grant has no meaning without the row it lifts.
  relationship_id TEXT        NOT NULL REFERENCES relationship (id) ON DELETE CASCADE,
  -- The tier granted. Not an FK to `billing_plan`: a grant is for a relationship and a period, and
  -- `billing_plan` is keyed by `(id, interval)` because that pair is what a checkout buys. The
  -- vocabulary is still that fixture's — `lib/admin/billing-control.ts` refuses a tier
  -- `data/billing-plans.ts` does not author — and the read joins it for the display name.
  plan_id         TEXT        NOT NULL,
  -- `comp` gives a tier for a period; `extend` pushes the same plan's period out. Both are the
  -- same row shape, and both are separately auditable from a paid period, which is the point.
  kind            TEXT        NOT NULL CHECK (kind IN ('comp', 'extend')),
  -- The period the grant covers, `[start, end)`. Instants, like every other period in this schema.
  period_start    TIMESTAMPTZ NOT NULL,
  period_end      TIMESTAMPTZ NOT NULL,
  -- Why. The same eight-character floor `admin_action` carries (`0023`), and for the same reason:
  -- the controller refuses a short reason before the transaction opens, and the column refuses a
  -- hand-written INSERT that skipped it. Two places, one rule, so a reason cannot be absent from
  -- either half of the audit.
  reason          TEXT        NOT NULL CHECK (length(btrim(reason)) >= 8),
  -- `user_profile.user_id` of the operator who granted it. No FK, for 0023's reason: the app does
  -- not constrain the managed auth schema, and an account deleted upstream must not delete the
  -- record of what it granted.
  granted_by      TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- The period must be a period. A zero-length or backwards window is not a grant anybody meant.
  CONSTRAINT plan_grant_period_order CHECK (period_end > period_start),
  -- **The idempotency key.** One grant per relationship per period start, whoever asks and however
  -- many times they click. An extension starts at a later instant and is therefore a second row.
  CONSTRAINT plan_grant_period_key UNIQUE (relationship_id, period_start)
);

-- The console's read: the newest grant per relationship, and a relationship's own history. The
-- unique key above already indexes `(relationship_id, period_start)`, so this index is for the
-- second question — "everything granted in the last month" — which is what the screen's stat card
-- counts.
CREATE INDEX IF NOT EXISTS plan_grant_created_idx ON plan_grant (created_at DESC);
