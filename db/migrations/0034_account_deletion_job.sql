-- 0034_account_deletion_job.sql — the identity a half-finished deletion must not lose (#278, t_ae23e60c).
--
-- §7 orders the auth delete (step 3) **before** the `public` scrub (step 4) so that a failed scrub
-- can never leave an account that can still sign in. The price of that order is the state this
-- table exists for: once step 3 has succeeded and step 4 has not, the account is gone and the only
-- copy of who it was — `{user_id, email, names, roles}` — lived in the function's memory. Measured
-- (t_091acbc0, §7 test T9): a scrub connection injected to fail leaves every `public` row correctly
-- rolled back and the account unable to sign in, and then a second attempt answers
-- `unknown-account`, because `authUserOf()` has no row left to read. The person's name and address
-- stay in `party`, `record.summary`, `session.name`, `user_profile`, `contact_message`,
-- `news_signup` and the rest of §1.1, permanently, with nothing that could finish the sweep.
--
-- **Why a row, and not a re-derivation from `public`.** The address is the only key for
-- `news_signup`, `contact_message`, `admin_invite`, `password_reset` and `coach_invite`, and no
-- `public` table holds an address joined to an account id: `0003_user_profile.sql` refuses to keep
-- a second copy of a credential store it does not own, and `0023_admin_role_audit.sql` repeats the
-- refusal ("`user_profile` carries no email"). A retry that re-derived the identity would recover
-- the seats — `party.user_id` survives the rollback — and no address at all, so the email-keyed
-- rows would survive the sweep that is supposed to delete them. The address has to be written down
-- while the auth user still exists.
--
-- **Why it outlives the auth delete.** It IS the retry. The row is written between §7's step 2 and
-- step 3, so it is durable before the irreversible call, and it is the read that
-- `runAccountDeletion()` falls back to when `neon_auth` has no such user. The attempt that finishes
-- the scrub clears it in the same transaction as the last statement of the sweep.
--
-- **The person cannot retry from the browser, and the table is why that is survivable.** Measured
-- on the demo branch (t_ae23e60c): after the auth delete, `GET /get-session` still answers `200`
-- and names no user, so `currentUser()` is `null` and `deleteAccountAction` answers `unauthorized`
-- before it could reach the sweep. There is no session left to carry an id. The open row is
-- therefore what an operator resumes from (§7, "when the scrub does not land"), and what makes
-- `runAccountDeletion()` idempotent for a caller that does have the id.
--
-- **The two states, and the CHECK that keeps them apart.**
--
--   finished_at IS NULL       a deletion is in flight. `email`, `names` and `roles` are here, which
--                             is the only personal data this table ever holds, and the row is
--                             cleared by the attempt that finishes the scrub.
--   finished_at IS NOT NULL   the sweep landed. The identity columns are cleared in the same
--                             UPDATE that stamps the instant, so what remains is an opaque account
--                             id and two instants — §6's standing argument for
--                             `template_version.published_by`: a bare account id with no name or
--                             address is pseudonymous once the account is gone.
--
-- No FK to `neon_auth`: `0003`'s rule is that the app never constrains the managed schema, and an
-- FK is exactly what would make the auth-side delete fail on a locked table (§3.2). No retry
-- counter and no error text: an unfinished row is the signal, and the attempts are an operator's
-- log line, not a fact the schema should hold.
--
-- Idempotent on purpose, like 0001–0033: `db:migrate` replays every file and `schema_migrations`
-- records it, so a second apply must be a no-op.

CREATE TABLE IF NOT EXISTS account_deletion_job (
  -- `neon_auth."user".id` — the join key the whole sweep filters on. Text, like every other auth id
  -- in `public`, and the primary key because one account has at most one deletion in flight.
  user_id     TEXT        PRIMARY KEY,
  -- The address, lowercased, exactly as §7 step 2 read it from the auth row. NULL once the row is
  -- finished: the sweep is over and this is the one column here that is a person's identifier.
  email       TEXT        NULL,
  -- Every `party.name` the account held — §1.2's search strings, and the reason `party` alone is
  -- not enough on the retry path (they must be read before the seat is anonymised, and a retry
  -- never sees the pre-anonymisation seat).
  names       TEXT[]      NOT NULL DEFAULT '{}',
  -- The roles whose seats it held. Decides the `session_invite` row decision (§2.6).
  roles       TEXT[]      NOT NULL DEFAULT '{}',
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- NULL means "the sweep has not landed yet". Stamped by the attempt that commits the scrub.
  finished_at TIMESTAMPTZ NULL,
  CONSTRAINT account_deletion_job_identity_is_pending CHECK (
    (finished_at IS NULL AND email IS NOT NULL)
    OR (finished_at IS NOT NULL AND email IS NULL AND cardinality(names) = 0)
  ),
  CONSTRAINT account_deletion_job_email_is_lowercased CHECK (
    email IS NULL OR email = lower(btrim(email))
  ),
  CONSTRAINT account_deletion_job_finishes_after_start CHECK (
    finished_at IS NULL OR finished_at >= started_at
  ),
  CONSTRAINT account_deletion_job_roles_are_known CHECK (
    roles <@ ARRAY['initiator', 'counterparty']::TEXT[]
  )
);

-- The operator's read: "is any deletion unfinished?". A few hundred rows at most, and every row
-- after this one is a finished deletion, so the partial index keeps that read off the bulk.
CREATE INDEX IF NOT EXISTS account_deletion_job_open
  ON account_deletion_job (started_at)
  WHERE finished_at IS NULL;
