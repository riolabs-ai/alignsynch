-- 0029_record_ownership_visibility.sql — a template has an owner and a visibility (#533 phase 1).
--
-- #533 makes a template a product: one membership product in as many variations as there are
-- authors. Two facts on `record` decide who it belongs to and who may find it, and neither is
-- derivable from a column that already exists:
--
--   owner_user_id   the member whose template this is. NULL is **not** "unknown": it is the
--                   platform's own row — a fixture, an authored sample, or a template an admin
--                   curated — which has no member owner by definition. That is the same absence
--                   `record.author_user_id` (0011) carries, and the same sentence this schema
--                   already uses for a seeded party's `user_id` (0005).
--   visibility      'public' | 'private'. Public listing is **admin-curated**: a member creates
--                   private templates and an admin decides what the catalog shows. The column
--                   records the fact; who may write it is a rule for the card that builds the
--                   screens, not for this file.
--
-- **`owner_user_id` is TEXT, not `uuid`, although the card writes `uuid`.** Every Neon Auth id in
-- this schema is TEXT on purpose — `party.user_id` (0001/0005), `user_profile.user_id` (0003),
-- `billing_subscription.user_id` (0009), `record.author_user_id` (0011),
-- `relationship.initiator_user_id` (0013) — because the identifier belongs to the managed schema,
-- not to this one (0003's rule, restated in 0011). This is not a style preference: `user_profile`
-- and `relationship` already hold ids that are *not* UUIDs (the demo branch carries the sentinel
-- `demo-live-owner-505`), so a `uuid` column would refuse a value every neighbouring column
-- accepts, and comparing it with `record.author_user_id` — the column it will be displayed beside
-- — would need a cast at every call site. The card's intent (an owner, NULL for platform-owned) is
-- unchanged; only the storage type follows the convention the rest of the schema already set.
--
-- **`visibility` defaults to `public`.** Every row that exists is a published fixture or an
-- authored sample, and a fixture is not a member's private draft — so the honest default for the
-- rows already here is `public`, and the member path has to say `private` explicitly. That is also
-- the safe direction for the catalog: the failure mode of a missing write is a template that is
-- visible, which is a review finding, not a template that vanishes from the member who owns it.
--
-- The index is the one read the feature has: "the private templates of this member" and "the
-- public catalog" are both `WHERE visibility = … [AND owner_user_id = …]` over `record`.
--
-- No `gap` column, nothing named like one: the Gap stays `gapOf()` over two scores.
--
-- Idempotent on purpose, like 0001–0028: `db:migrate` ledgers this file and skips what it applied,
-- and a re-run of this file alone must still be a no-op — every statement below converges.

-- The owner. Nullable, no default: NULL means platform-owned, and a default could only invent an
-- owner for a row nobody owns.
ALTER TABLE record ADD COLUMN IF NOT EXISTS owner_user_id TEXT NULL;

-- The visibility. Added with the model's default so the existing rows are filled by the same
-- statement that creates the column, then pinned NOT NULL and given the DEFAULT explicitly so a
-- re-run on a column that already exists converges instead of no-op'ing half the change.
ALTER TABLE record ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public';
ALTER TABLE record ALTER COLUMN visibility SET NOT NULL;
ALTER TABLE record ALTER COLUMN visibility SET DEFAULT 'public';

-- The vocabulary, as a CHECK rather than a lookup table: two values that are read on every catalog
-- query, and a third would be a product decision that deserves its own migration.
ALTER TABLE record DROP CONSTRAINT IF EXISTS record_visibility_vocabulary;
ALTER TABLE record
  ADD CONSTRAINT record_visibility_vocabulary CHECK (visibility IN ('public', 'private'));

-- The catalog read and the member's own list are the same index: filter by visibility, then by
-- owner.
CREATE INDEX IF NOT EXISTS record_visibility_owner_idx ON record (visibility, owner_user_id);
