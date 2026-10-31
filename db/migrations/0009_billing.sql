-- 0009_billing.sql — plans, one live subscription per account, and webhook idempotency (#289).
--
-- Three tables and a partial unique index. What is deliberately NOT here, and why:
--
--   no `gap` column              The standing rule. Nothing in this file stores a verdict; the
--                                gate reads an instance count and a mode (`lib/billing/entitlements.ts`).
--   no `plan` column on user     Entitlement is derived from the subscription row, never cached
--                                on the account: a cache is a second truth a webhook has to
--                                remember to invalidate, and the first missed invalidation is a
--                                person paying for a plan the product does not give them.
--   no price on the subscription The price is the plan's, and the plan's price is the fixture's
--                                (`data/billing-plans.ts`). A copy on the subscription is exactly
--                                the drift `billing_plan` exists to prevent.
--   no FK to neon_auth."user"    Same rule as 0003: the app does not constrain Neon's managed
--                                schema. `user_id` is the join key; `db:verify` reports an orphan.
--   no tax, invoice, coupon or   Those belong to the provider, and the card puts them out of
--   dunning columns              scope. A column nobody maintains is worse than an absent one.
--
-- `billing_plan` is a *mirror* of the fixture, not an authority: `scripts/db-seed.mjs` writes it
-- from `billingPlanRows()` and `db:verify` (V13) compares the rows back, both directions. A
-- surface may render these rows instead of a price literal — `lib/db/billing.ts::readBillingPlans`
-- exists for that — and a hand-edited price is a V13 failure, not a quietly different charge.
--
-- Idempotent on purpose, like every migration here: `db:migrate` records each file in
-- `schema_migrations` and skips what it has already applied, but a re-run of this file alone must
-- still be a no-op.

-- The tiers as rows: one per (tier, interval), which is exactly the pair a checkout buys.
-- `id` is the tier the entitlement reads ('free', 'basic', …); `interval` is what the price is
-- for, because the page states two prices per tier and a single row cannot carry both without a
-- column per interval (which would be a second place to add a third interval).
CREATE TABLE IF NOT EXISTS billing_plan (
  id          TEXT    NOT NULL,
  interval    TEXT    NOT NULL CHECK (interval IN ('month', 'year')),
  name        TEXT    NOT NULL,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  -- Offered today. A retired tier is `false`, never deleted: a subscription's FK must keep
  -- resolving after the tier stops being sold.
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (id, interval)
);

-- One account's purchase, as the provider reports it. `provider_subscription_id` is the
-- idempotency key for webhook replays: the second delivery updates this row, it does not add one.
CREATE TABLE IF NOT EXISTS billing_subscription (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Neon Auth's user id. Text because the identifier is the managed schema's, not ours (0003).
  user_id                  TEXT        NOT NULL,
  plan_id                  TEXT        NOT NULL,
  interval                 TEXT        NOT NULL CHECK (interval IN ('month', 'year')),
  -- The adapters this vocabulary names (`lib/billing/types.ts`). `mock` is what this build
  -- constructs; the second value is here so the adapter that adds it needs no migration.
  provider                 TEXT        NOT NULL CHECK (provider IN ('mock', 'stripe')),
  provider_subscription_id TEXT        NOT NULL,
  -- Our five words, not a provider's twenty. `lib/db/billing.ts` normalizes on the way in.
  status                   TEXT        NOT NULL
    CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'incomplete')),
  current_period_end       TIMESTAMPTZ NOT NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT billing_subscription_provider_id_key UNIQUE (provider_subscription_id),
  -- The tier must exist at the interval it was bought at. Seeding the plans is a prerequisite of
  -- any subscription, which is what keeps `billing_plan` from being decorative.
  CONSTRAINT billing_subscription_plan_fk FOREIGN KEY (plan_id, interval)
    REFERENCES billing_plan (id, interval)
);

-- One *live* subscription per account. The partial predicate is what allows history: a cancelled
-- row stays for the audit trail, and an upgrade writes a new row instead of overwriting the old.
CREATE UNIQUE INDEX IF NOT EXISTS billing_subscription_live_user_key
  ON billing_subscription (user_id)
  WHERE status IN ('active', 'trialing', 'past_due');

CREATE INDEX IF NOT EXISTS billing_subscription_user_idx
  ON billing_subscription (user_id, updated_at DESC);

-- Webhook idempotency: the provider's event id, unique per provider. `applyBillingEventOnce()`
-- inserts here in the same transaction as the subscription write, so "recorded but not applied"
-- and "applied but not recorded" cannot both happen.
--
-- The uniqueness is on the PAIR, not on `provider_event_id` alone: an event id is unique within
-- the provider that minted it, and two providers' id spaces are not ours to assume disjoint. The
-- second adapter therefore cannot be handed a collision by the first, which is the property the
-- acceptance's "deliver the same event twice, count = 1" is about.
CREATE TABLE IF NOT EXISTS billing_event (
  id                BIGSERIAL   PRIMARY KEY,
  provider          TEXT        NOT NULL CHECK (provider IN ('mock', 'stripe')),
  provider_event_id TEXT        NOT NULL,
  type              TEXT        NOT NULL,
  -- SHA-256 of the exact body. Two rows can never share (provider, event id); a *replay with
  -- different bytes* is therefore visible as a changed digest on the same row, not as a second
  -- application.
  payload_digest    TEXT        NOT NULL,
  received_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT billing_event_provider_id_key UNIQUE (provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS billing_event_received_idx ON billing_event (received_at DESC);
