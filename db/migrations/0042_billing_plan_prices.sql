-- 0042_billing_plan_prices.sql — the approved three-plan catalogue's amounts, in rows (#1127).
--
-- `0018` wrote the catalogue as it stood in November 2026; the owner then approved one catalogue
-- (2026-11-17, issue #1127) and `data/billing-plans.ts` carries it:
--
--   plan            tier/interval        $
--   Single          basic/month       9.99
--   Single Annual   basic/year       99.00
--   Family          principal/month  19.99
--   (unclaimed)     principal/year  162.72
--
-- `lib/billing/catalogue.ts` reads `billing_plan` for every figure the pricing page prints, and
-- `scripts/db-verify.mjs` V13 compares those rows back to the fixture. So a price that changes in
-- the fixture and not here is a page that sells yesterday's number against a checkout — the exact
-- drift `0018` was written to end. This file is that change, as rows.
--
-- The same `INSERT … ON CONFLICT (id, interval) DO UPDATE` shape as `0018`, for the same reason: a
-- database seeded before this file ran holds the old amounts, and `DO NOTHING` would leave them
-- there while the ledger recorded the catalogue as applied. The conflict target is the primary key,
-- the values are complete, so a second run writes the same six rows and changes nothing.
--
-- **`principal/year` is left at its seeded amount on purpose.** No approved plan claims it — the
-- catalogue sells Family monthly only — so there is no approved figure to write into it, and
-- putting an invented one here is exactly the "no fourth plan, no invented price" line the card
-- holds. The row keeps the amount it was created with on the provider's test account, and the
-- card's handoff names it as the one open catalogue item: either the owner approves a Family Annual
-- price, or the row is retired.
--
-- No tier is renamed and no row is deleted: `0018` retired `pro` and `enterprise` because the
-- fixture no longer authored them, while `free` / `basic` / `principal` are still the three tiers
-- `data/billing-plans.ts` authors and their ids are what a `billing_subscription` points at.
INSERT INTO billing_plan (id, interval, name, price_cents, active)
VALUES
  ('free',      'month', 'Free',          0, TRUE),
  ('free',      'year',  'Free',          0, TRUE),
  ('basic',     'month', 'Basic',       999, TRUE),
  ('basic',     'year',  'Basic',      9900, TRUE),
  ('principal', 'month', 'Principal',  1999, TRUE),
  ('principal', 'year',  'Principal', 16272, TRUE)
ON CONFLICT (id, interval) DO UPDATE SET
  name        = EXCLUDED.name,
  price_cents = EXCLUDED.price_cents,
  active      = EXCLUDED.active;
