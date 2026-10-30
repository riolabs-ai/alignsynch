-- 0003_user_profile.sql — the profile a signed-in person owns (#164).
--
-- The first `public` table that is not authored content: no fixture authors a row, and a
-- person writes theirs at runtime. It mirrors `content/identity.ts` column for column, and
-- the read path (`lib/db/profile-rows.ts`) `safeParse`s rows back through `zUserProfile`, so
-- the database inherits the model's invariants instead of re-encoding them — the same rule
-- 0001 follows for record/assessment.
--
-- What is NOT here, and why:
--
--   no email / password       Those live in `neon_auth` (Neon's Managed Better Auth) and the
--                            app cannot change them from here. A second copy would be a
--                            credential store we do not own, and it could only drift.
--   no role / is_admin        `MUST NOT` in #164: admin vs platform user is a separate
--                            decision. #156 must not depend on this card inventing one.
--   no foreign key to `neon_auth."user"`
--                            The app never migrates or constrains Neon's managed schema, and
--                            0001's own rule is that nothing in this directory touches it. The
--                            auth user id is the join key; a profile whose user was deleted in
--                            the managed schema is an orphan row, not a broken constraint —
--                            and `db:verify` can report it without the app owning the table.
--
-- Numbered 0003 because 0002 is in flight on a sibling card (`0002_two_party_flow.sql`).
-- `db:migrate` applies by filename, so landing them in either order is safe: neither file
-- reads anything the other creates.
--
-- Idempotent on purpose — `db:migrate` ledgers each file and skips what it applied, but a
-- re-run of this file alone must still be a no-op.

CREATE TABLE IF NOT EXISTS user_profile (
  -- Neon Auth's user id. Text because the identifier is the managed schema's, not a kebab
  -- id this repo authors (see `zUserId`).
  user_id      TEXT PRIMARY KEY,
  -- The URL identity: `/profile/<handle>`. Unique across people, and one person's to change
  -- only through the settings form — the constraint is what makes the URL unambiguous.
  handle       TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  -- One paragraph. NULL is "not said"; the schema forbids an empty string, which would
  -- render a blank band the owner never chose.
  bio          TEXT,
  -- The pair `zPlayer` already models: the ISO-3166 label and the lowercase alpha-2 the flag
  -- is keyed by. Both or neither — the SQL twin of `zProfileFields`' refinement.
  country      TEXT,
  country_code TEXT,
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_profile_handle_shape CHECK (
    handle ~ '^[a-z0-9]([a-z0-9-]{1,28}[a-z0-9])$'
  ),
  CONSTRAINT user_profile_display_name_present CHECK (
    length(btrim(display_name)) BETWEEN 1 AND 60
  ),
  CONSTRAINT user_profile_bio_length CHECK (bio IS NULL OR length(bio) <= 280),
  CONSTRAINT user_profile_country_pair CHECK ((country IS NULL) = (country_code IS NULL)),
  CONSTRAINT user_profile_country_code_shape CHECK (
    country_code IS NULL OR country_code ~ '^[a-z]{2}$'
  )
);

-- `/profile/<handle>` is a lookup by handle and nothing else is. The UNIQUE constraint
-- already indexes it; this comment records why no second index exists.
