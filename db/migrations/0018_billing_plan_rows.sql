-- 0018_billing_plan_rows.sql — the three-tier catalogue, in rows (owner, 2026-11-02).
--
-- `billing_plan` has been empty in production since 0009 created it, which is why `/pricing`
-- renders "—/mo": `lib/billing/catalogue.ts` reads the table, a table with no row for a
-- (tier, interval) pair is a card with no price, and V13 in `scripts/db-verify.mjs` is the check
-- that should have said so. This file is the row set, and the migration is the write path —
-- **never `db:seed`**, which also imports the demo relationships and has no business in
-- production.
--
-- Exactly the rows `data/billing-plans.ts::billingPlanRows()` authors, so V13 has nothing to
-- report afterwards:
--
--   free/month        0      free/year        0
--   basic/month     895      basic/year    8592   ($71.60/mo equivalent)
--   principal/month 1695     principal/year 16272  ($135.60/mo equivalent)
--
--   monthly × 12 × 0.8 = the yearly amount charged once: 895 × 12 = 10740, less 20% = 8592.
--   1695 × 12 = 20340, less 20% = 16272. Both divide by 12 with no remainder, which is the
--   arithmetic the pricing card prints.
--
-- **`pro` is now `principal` and `enterprise` is gone.** The first is a rename, the second is a
-- removal, and neither is left to chance: the delete below is what stops the database from
-- disagreeing with the fixture, and V13 reports a row the fixture no longer authors rather than
-- letting an old price sit in the table.
--
-- **`ON CONFLICT … DO UPDATE`, not `DO NOTHING`.** Every database that has ever run `db:seed`
-- already holds `free`, `basic`, `pro` and `enterprise` — `basic/month` at 999 cents. `DO
-- NOTHING` would insert the new `principal` rows and then leave `basic` at the old price, which
-- is precisely the page-and-checkout-disagree defect this file exists to remove. The conflict
-- target is the primary key `(id, interval)`, the values are complete, so a second run writes
-- the same six rows and changes nothing: idempotent in the same sense, and convergent instead of
-- stuck on the first (wrong) value.
INSERT INTO billing_plan (id, interval, name, price_cents, active)
VALUES
  ('free',      'month', 'Free',          0, TRUE),
  ('free',      'year',  'Free',          0, TRUE),
  ('basic',     'month', 'Basic',       895, TRUE),
  ('basic',     'year',  'Basic',      8592, TRUE),
  ('principal', 'month', 'Principal',  1695, TRUE),
  ('principal', 'year',  'Principal', 16272, TRUE)
ON CONFLICT (id, interval) DO UPDATE SET
  name        = EXCLUDED.name,
  price_cents = EXCLUDED.price_cents,
  active      = EXCLUDED.active;

-- The two retired tiers, deleted rather than retired: nothing in the fixture names them, so a row
-- left behind is a second price list (V13's exact wording). The delete is idempotent — a second
-- run matches no row — and it is narrow: two literal ids, never a wildcard, so a tier added to
-- the fixture later cannot be swept up by a re-run of this file.
--
-- No `billing_subscription` may be left pointing at one of these. If one is, this DELETE fails on
-- `billing_subscription_plan_fk` and the migration rolls back — on purpose. Which tier that
-- customer is on now is a decision for a person holding the invoice, and a migration that
-- silently rewrote a paid subscription would be worse than one that refused to run. No such row
-- exists in any environment today (billing has not opened), so this is the honest guard rather
-- than a live obstacle.
DELETE FROM billing_plan WHERE id IN ('pro', 'enterprise');

-- **If this file is skipped by `db:migrate`, the ledger holds a superseded copy of it.** The
-- archived `billing_plan` card applied a file of this same name whose body was `INSERT … DO
-- NOTHING` against a seeded branch — it inserted nothing and deleted nothing, so the catalogue on
-- that branch is still the four old tiers while `schema_migrations` says `0018` ran. The ledger
-- is keyed on the name alone, so the corrected content cannot run until that stale row is
-- removed:
--
--   DELETE FROM schema_migrations WHERE name = '0018_billing_plan_rows.sql';
--   pnpm db:migrate
--
-- That is a one-off repair for one database that ran a branch which never merged; it is not part
-- of this file, because a migration must not edit the ledger that is deciding whether to run it.
