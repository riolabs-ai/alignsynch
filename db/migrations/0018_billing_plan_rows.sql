-- 0018_billing_plan_rows.sql — the eight plans `data/billing-plans.ts` offers, as rows (#289 follow-up).
--
-- **The defect this closes.** `0009_billing.sql` creates `billing_plan` and says the table is a
-- *mirror* of the fixture, written by `db:seed` and compared back by `db:verify` (V13). Both halves
-- were true, and neither runs on a database that was never seeded: production ran `db:migrate`
-- and nothing else, so `billing_plan` held **zero** rows while the pricing page offered four tiers
-- at two prices each. V13 reported it as eight violations (`billing_plan has no row for
-- free/month`, …) — a plan a surface can render with no billing record behind it, which is the
-- same defect class as a badge reporting a status nobody measures.
--
-- **Why a migration and not the seed.** `db:seed` mirrors the whole content model: records, items,
-- parties, opinions, a demo account. That is demo content, and it has no business being written
-- into the production branch — the failure mode is fake relationships, not a missing price. The
-- plans are the one part of that seed which is *product data*: every install must have them
-- before a checkout can reference one (`billing_subscription_plan_fk`). So the rows land here, in
-- the same ordered migration path every other structural fact uses, and they are the only thing
-- this file writes.
--
-- **Every value is the fixture's, verbatim.** The eight rows are
-- `billingPlanRows()` from `data/billing-plans.ts` — that file is the authority, this file is a
-- copy of it. Nothing here is rounded, invented or re-derived: `price_cents` is the integer
-- **amount charged at that interval** (`year` is the yearly total, not the monthly-equivalent the
-- page prints), `name` is the card's title, and `active` is `true` because all four tiers are sold
-- today. `tests/billing-plan-migration.test.ts` parses this file's VALUES and fails when it stops
-- equaling the fixture, so the copy cannot drift in silence.
--
-- **The table has no `currency` column, and this file does not add one.** The card's row check
-- names `price` / `currency`; the shipped schema is `(id, interval, name, price_cents, active)`
-- and every row is in the brand's single billing currency, so a per-row currency would be a second
-- price authority next to the fixture. The prices below are integer cents, the convention the rest
-- of the tree follows (`BillingPlan.monthlyCents`).
--
-- **`ON CONFLICT (id, interval) DO NOTHING`, not `DO UPDATE`.** `db:migrate` runs every file in
-- order against a branch that may already hold rows — the dev branch was seeded, a re-run replays
-- nothing, and a partially applied file must be safe to repeat. `DO NOTHING` also keeps the
-- migration additive: rewriting a price a live `billing_subscription` references is a business
-- decision with a customer on the other end, not something a replayed DDL file should do silently.
-- A row that disagrees with the fixture is V13's job to name, and `pnpm db:seed` (or a deliberate
-- update) is the repair path — never a migration that quietly reprices a plan.
--
-- Idempotent on purpose, like every migration here: `schema_migrations` already skips a file it
-- has applied, and a re-run of this file alone inserts nothing because the primary key is the
-- conflict target.

-- The eight plans, in the fixture's order (tier order, month before year). One row per
-- (id, interval) — the pair a checkout buys.
INSERT INTO billing_plan (id, interval, name, price_cents, active) VALUES
  ('free',       'month', 'Free',        0, TRUE),
  ('free',       'year',  'Free',        0, TRUE),
  ('basic',      'month', 'Basic',     999, TRUE),
  ('basic',      'year',  'Basic',    9588, TRUE),
  ('pro',        'month', 'Pro',      1999, TRUE),
  ('pro',        'year',  'Pro',     20388, TRUE),
  ('enterprise', 'month', 'Enterprise', 4999, TRUE),
  ('enterprise', 'year',  'Enterprise', 47988, TRUE)
ON CONFLICT (id, interval) DO NOTHING;
