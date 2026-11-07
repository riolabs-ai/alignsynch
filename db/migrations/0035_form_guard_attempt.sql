-- 0035_form_guard_attempt.sql — the window two public forms count over (#615).
--
-- **Why this table exists at all.** The contact form has counted its own submissions since #395,
-- because "five per client per ten minutes" is a question the `contact_message` rows can answer:
-- one message, one row. The news signup cannot answer it the same way. Its list is one row per
-- *address*, kept forever (`0019_news_signup.sql`), so a second submit of the same address writes
-- nothing at all — which is exactly the shape a mail-bombing run has. Counting the list would count
-- the outcome, not the attempts, and an attempt that is refused or that duplicates an existing row
-- is the thing being throttled.
--
-- **Nothing here identifies anybody.** Both buckets are salted SHA-256 digests
-- (`lib/forms/ip.ts::bucketHashOf`): `client_hash` of the forwarded address, `address_hash` of the
-- submitted mailbox. The issue that asked for this (#615) is explicit that a row stores a hash and
-- never an address — the address itself already lives in `news_signup`, where it is the product,
-- and it must not also become a log of who tried what, when.
--
-- **`client_hash` and `address_hash` are both nullable and that is the honest shape**: the auth
-- proxy has no address to bucket (`sign-in/email` names an account only after it is accepted), and
-- a news submit from a direct connection — no proxy header, so no client identity — still has an
-- address bucket. The CHECK refuses a row with neither, which would count nothing.
--
-- **The rows are a window, not a record, and they are pruned by the writer.** `recordAttempt()`
-- deletes everything older than twice the window on every write, so the table holds at most a few
-- minutes of traffic and needs no cron, no retention script and no operator. That is why there is
-- no `V` rule in `scripts/db-verify.mjs` for it: the invariant is enforced at the insert, and a
-- database where the sweep stopped still cannot grow past the request rate.
CREATE TABLE IF NOT EXISTS form_guard_attempt (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  form         TEXT        NOT NULL CHECK (length(btrim(form)) > 0),
  client_hash  TEXT,
  address_hash TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT form_guard_attempt_counts_something CHECK (client_hash IS NOT NULL OR address_hash IS NOT NULL)
);

-- The two reads: "how many from this client" and "how many naming this address", inside the window.
CREATE INDEX IF NOT EXISTS form_guard_attempt_client_idx
  ON form_guard_attempt (form, client_hash, created_at DESC);

CREATE INDEX IF NOT EXISTS form_guard_attempt_address_idx
  ON form_guard_attempt (form, address_hash, created_at DESC);

-- The sweep's read, and an operator's "what has been knocking" query.
CREATE INDEX IF NOT EXISTS form_guard_attempt_created_idx
  ON form_guard_attempt (created_at DESC);
