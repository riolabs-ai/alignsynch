-- 0008_initiator_email.sql — the other party's address, so the unlock notice can reach them (#258).
--
-- When a submit makes an instance `complete`, the other party is emailed once, on that
-- transition (#258). Two people share an instance, so the notice needs **two** addresses, and
-- until this file the database held exactly one: `instance_invite.email` is the Counterparty's,
-- typed into the create form. The Initiator's was never stored — `0003_user_profile.sql` records
-- why (the address belongs to Neon Auth, and the app keeps no second copy of a credential store
-- it does not own), so the only moment it is in hand is the create request itself, where
-- `currentUser()` resolves the session.
--
--   instance_invite.initiator_email   the address the signed-in creator answered with; NULL when
--                                     they created the instance signed out.
--
-- **Why this row and not `party`.** Each address then has exactly one home: the invitation row
-- already carries the Counterparty's address, the two names, the token hash and the claim, and it
-- is written in the same transaction that writes the Initiator's seat. A `party.email` would put
-- the Counterparty's address in two places with nothing to compare them — the duplication this
-- schema has refused for `status`, for the Gap and for the mode.
--
-- **NULL is honest and is not a backfill.** Every instance created before this column, and every
-- create that happens signed out, has no Initiator address; the notice for those completes sends
-- nothing and the in-app marker `0007` added is the whole delivery. That is the same degraded
-- path the invitation takes with no mailer configured, and it is deliberately not an error.
--
-- **No notification state, no `notified_at`, no queue.** The transition is terminal: `submitAnswers`
-- takes the row lock, and a second submit reads `complete` and is refused (`frozen`), so the one
-- successful write that produces `complete` is the one that sends. A column recording "we emailed"
-- would be a second authored copy of that fact, and it would have to be updated by the send — which
-- is precisely the failure mode this repo keeps out of the write path.
--
-- Idempotent on purpose, like 0001–0007.
ALTER TABLE instance_invite ADD COLUMN IF NOT EXISTS initiator_email TEXT NULL;

-- The SQL twin of the shape the create form already enforces on `email`, and of the same rule the
-- schema spells for a profile field: one `@`, not the last character, no padded whitespace. NULL is
-- "we do not know an address for this seat" and not "an empty string was stored".
ALTER TABLE instance_invite
  DROP CONSTRAINT IF EXISTS invite_initiator_email_shape;
ALTER TABLE instance_invite
  ADD CONSTRAINT invite_initiator_email_shape CHECK (
    initiator_email IS NULL
    OR (
      position('@' in initiator_email) > 1
      AND length(initiator_email) <= 254
      AND initiator_email = btrim(initiator_email)
    )
  );
